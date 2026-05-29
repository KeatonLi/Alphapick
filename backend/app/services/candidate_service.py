# backend/app/services/candidate_service.py
"""
量化推荐候选池服务
数据来源：同花顺服务端选股池 + 腾讯批量行情
流程：
  1. THS 选股池（lxsz + cxg，~500只）
  2. 腾讯批量行情获取实时价格
  3. 过滤主板 + 排序取 TOP N
  4. 并发获取每只的消息面（新闻标题）
  5. 送 AI 精选
"""

import asyncio
import json
import requests

import akshare as ak

# ─── 主板过滤 ────────────────────────────────────────────────────────────
# 沪主板: 600/601/603  深主板: 000/001/002
_ZHU_BAN_PREFIXES = ('60', '00', '001', '002')


def _is_zhuban(code: str) -> bool:
    """判断是否主板股票（排除创业板300/301、科创板688、北交所4/8）"""
    return code.startswith(_ZHU_BAN_PREFIXES)


# ─── THS 选股池 ──────────────────────────────────────────────────────────

MIN_PRICE = 5
MAX_PRICE = 200
MIN_CONTINUOUS_DAYS = 3


def _to_code(raw: str) -> str:
    """THS返回的股票代码可能是 6位数字，转成标准格式"""
    raw = str(raw).strip()
    if len(raw) == 6:
        if raw.startswith(('0', '3')):
            return f"sz{raw}"
        elif raw.startswith(('4', '8')):
            return f"bj{raw}"
        else:
            return f"sh{raw}"
    return raw


def get_ths_candidates() -> dict:
    """
    从同花顺服务端筛选池获取候选股票列表
    合并 理想选股 + 持续强势股
    """
    lxsz = ak.stock_rank_lxsz_ths()
    cxg = ak.stock_rank_cxg_ths()

    seen = set()
    candidates = []

    # 理想选股
    if lxsz is not None and not lxsz.empty:
        for _, row in lxsz.iterrows():
            code = _to_code(row.get('股票代码', ''))
            if not code or code in seen:
                continue
            try:
                price = float(row.get('收盘价', 0) or 0)
                change_pct = float(row.get('涨跌幅', 0) or 0)
                continuous_days = int(row.get('连涨天数', 0) or 0)
                turnover = float(row.get('累计换手率', 0) or 0)
                sector = str(row.get('所属行业', ''))
            except (ValueError, TypeError):
                continue
            if continuous_days < MIN_CONTINUOUS_DAYS:
                continue
            if price <= 0 or price > MAX_PRICE:
                continue
            seen.add(code)
            candidates.append({
                'code': code,
                'name': str(row.get('股票简称', '')),
                'price': price,
                'change_pct': change_pct,
                'continuous_days': continuous_days,
                'turnover': turnover,
                'sector': sector,
                'source': 'lxsz',
            })

    # 持续强势股
    if cxg is not None and not cxg.empty:
        for _, row in cxg.iterrows():
            code = _to_code(row.get('股票代码', ''))
            if not code or code in seen:
                continue
            try:
                price = float(row.get('最新价', 0) or 0)
                change_pct = float(row.get('涨跌幅', 0) or 0)
                turnover = float(row.get('换手率', 0) or 0)
            except (ValueError, TypeError):
                continue
            if price <= 0 or price > MAX_PRICE:
                continue
            seen.add(code)
            candidates.append({
                'code': code,
                'name': str(row.get('股票简称', '')),
                'price': price,
                'change_pct': change_pct,
                'continuous_days': 0,
                'turnover': turnover,
                'sector': '',
                'source': 'cxg',
            })

    return {
        'success': True,
        'data': candidates,
        'total': len(candidates),
        'from_lxsz': len([c for c in candidates if c['source'] == 'lxsz']),
        'from_cxg': len([c for c in candidates if c['source'] == 'cxg']),
    }




# ─── 腾讯批量行情 ──────────────────────────────────────────────────────

def _fetch_tencent_prices(codes: list) -> dict:
    """用腾讯 qt.gtimg.cn 批量获取行情，返回 {code: {price, change_pct, volume, turnover}}"""
    import requests
    from app.utils.akshare_utils import _to_tencent_code, _from_tencent_code

    result = {}
    batch_size = 80
    for i in range(0, len(codes), batch_size):
        batch = codes[i:i + batch_size]
        tencent_codes = [_to_tencent_code(c) for c in batch]
        try:
            r = requests.get(
                f"https://qt.gtimg.cn/q={','.join(tencent_codes)}",
                headers={"Referer": "https://finance.qq.com", "User-Agent": "Mozilla/5.0"},
                timeout=10,
            )
            for line in r.text.strip().split("\n"):
                if "~\"" not in line:
                    continue
                parts = line.split("~")
                if len(parts) < 35:
                    continue
                raw_code = parts[2] if len(parts) > 2 else ""
                clean_code = _from_tencent_code(raw_code)
                if clean_code not in codes:
                    continue
                price = float(parts[3]) if parts[3] not in ("", "0") else 0
                change_pct = float(parts[32]) if parts[32] not in ("",) else 0
                volume = float(parts[6]) if parts[6] not in ("",) else 0
                turnover = float(parts[36]) if len(parts) > 36 and parts[36] not in ("", "None") else 0
                result[clean_code] = {
                    "price": price, "change_pct": change_pct,
                    "volume": volume, "turnover": turnover,
                }
        except Exception:
            continue
    return result


# ─── 个股新闻 ────────────────────────────────────────────────────────────

_NEWS_CACHE = {}
_NEWS_CACHE_TTL = 600


async def _fetch_stock_news(code: str, limit: int = 3) -> list:
    """获取单只股票的最近新闻标题（带10分钟缓存）"""
    cache_key = f"{code}:{limit}"
    import time
    now = time.time()
    cached = _NEWS_CACHE.get(cache_key)
    if cached and now - cached['timestamp'] < _NEWS_CACHE_TTL:
        return cached['data']

    try:
        url = "http://search-api-web.eastmoney.com/search/jsonp"
        params = {
            "cb": "jQuery",
            "param": json.dumps({
                "uid": "", "keyword": code, "type": ["cmsArticleWebOld"],
                "client": "web", "clientType": "web", "clientVersion": "current",
                "param": {
                    "cmsArticleWebOld": {
                        "searchScope": "default", "sort": "default",
                        "pageIndex": 1, "pageSize": limit,
                    }
                }
            })
        }
        headers = {'User-Agent': 'Mozilla/5.0', 'Referer': 'https://finance.eastmoney.com/'}
        loop = asyncio.get_event_loop()
        r = await loop.run_in_executor(
            None, lambda: requests.get(url, params=params, headers=headers, timeout=10))
        data = json.loads(r.text.strip('jQuery(').rstrip(')'))
        items = data.get('result', {}).get('cmsArticleWebOld', [])
        titles = [
            item.get('title', '').replace('<em>', '').replace('</em>', '')
            for item in items[:limit]
        ]
        _NEWS_CACHE[cache_key] = {'data': titles, 'timestamp': now}
        return titles
    except Exception:
        return []


async def _batch_fetch_news(codes: list, limit: int = 3) -> dict:
    """并发获取多只股票的新闻，返回 {code: [title, ...]}"""
    semaphore = asyncio.Semaphore(10)

    async def fetch_one(code: str) -> tuple:
        async with semaphore:
            titles = await _fetch_stock_news(code, limit)
            return code, titles

    tasks = [fetch_one(c) for c in codes]
    results = await asyncio.gather(*tasks)
    return dict(results)


# ─── 主流程 ──────────────────────────────────────────────────────────────

async def get_ma_filtered_candidates(top_n: int = 50) -> dict:
    """获取候选池：THS 选股池 → 腾讯行情 → 主板过滤 → 新闻
    不再依赖东方财富热度排名（push2 已封）。

    返回候选数据（含 news 等字段）。
    top_n 控制最终返回多少只（默认 50）。
    """
    # Step 1: THS 池
    ths_result = get_ths_candidates()
    if not ths_result['success']:
        return ths_result

    candidates = ths_result['data']
    if not candidates:
        return {'success': False, 'error': 'THS 选股池返回为空'}

    # Step 2: 腾讯批量获取实时行情
    bare_codes = []
    for s in candidates:
        c = s['code']
        for prefix in ('sh', 'sz', 'bj'):
            if c.startswith(prefix):
                c = c[len(prefix):]
                break
        bare_codes.append(c)

    price_map = _fetch_tencent_prices(bare_codes)

    # Step 3: 合并行情数据 + 过滤主板 + 排序
    merged = []
    for s in candidates:
        c = s['code']
        for prefix in ('sh', 'sz', 'bj'):
            if c.startswith(prefix):
                c = c[len(prefix):]
                break

        if c not in price_map:
            continue
        if not _is_zhuban(c):
            continue

        qt = price_map[c]
        merged.append({
            **s,
            'price': qt['price'],
            'change_pct': s.get('change_pct', qt['change_pct']),
            'volume': qt['volume'],
            'turnover': qt.get('turnover', s.get('turnover', 0)),
        })

    # 按连续上涨天数 + 换手率排序（lxsz 优先于 cxg）
    merged.sort(key=lambda x: (
        0 if x.get('source') == 'lxsz' else 1,
        -x.get('continuous_days', 0),
        -x.get('turnover', 0),
    ))

    # 取 TOP N
    merged = merged[:top_n]

    # Step 4: 并发获取消息面
    news_map = await _batch_fetch_news(
        [s['code'] for s in merged], limit=3
    )
    for idx, s in enumerate(merged):
        s['news'] = news_map.get(s['code'], [])
        s['hot_rank'] = idx + 1
        s['hot_score'] = 0

    return {
        'success': True,
        'data': merged,
        'total_ths': ths_result['total'],
        'after_filter': len(merged),
    }


def format_candidates_for_ai(candidates: list) -> str:
    """将候选池格式化为 AI 输入（含消息面）"""
    lines = []
    for s in candidates:
        source_tag = '⭐' if s.get('source') == 'lxsz' else '◆'
        news_str = ' | '.join(s.get('news', [])) if s.get('news') else '无近期新闻'
        lines.append(
            f"{source_tag}{s['code']} {s['name']} "
            f"现价:{s['price']} 涨幅:{s.get('change_pct', 0):.2f}% "
            f"换手:{s.get('turnover', 0):.2f}% 连涨:{s.get('continuous_days', 0)}天 "
            f"板块:{s.get('sector', '')} "
            f"热度:#{s.get('hot_rank', '?')} "
            f"消息面:{news_str}"
        )
    return '\n'.join(lines)
