# backend/app/services/candidate_service.py
"""
量化推荐候选池服务
数据来源：同花顺服务端选股池 + 东方财富热度排名
流程：
  1. THS 选股池（lxsz + cxg，~500只）
  2. 东方财富热度排名前 50
  3. 取交集 + 过滤主板
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


# ─── 东方财富热度排名 ──────────────────────────────────────────────────

_HOT_RANK_CACHE = {"data": None, "timestamp": 0}
_HOT_CACHE_TTL = 300


def _fetch_hot_rank() -> dict:
    """获取东方财富热度排名前 50，带 5 分钟缓存"""
    import time
    now = time.time()
    if (_HOT_RANK_CACHE["data"] is not None
            and now - _HOT_RANK_CACHE["timestamp"] < _HOT_CACHE_TTL):
        return _HOT_RANK_CACHE["data"]

    try:
        url = "https://push2.eastmoney.com/api/qt/clist/get"
        params = {
            'pn': 1, 'pz': 100, 'po': 1, 'np': 1,
            'fields': 'f12,f14,f2,f3,f62',
            'fid': 'f62',
            'fs': 'm:0+t:6+f:!2,m:0+t:80+f:!2,m:1+t:2+f:!2,m:1+t:23+f:!2',
        }
        headers = {'User-Agent': 'Mozilla/5.0', 'Referer': 'https://quote.eastmoney.com/'}
        r = requests.get(url, params=params, headers=headers, timeout=15)
        items = r.json().get('data', {}).get('diff', [])

        result = []
        for i, item in enumerate(items):
            code = str(item.get('f12', ''))
            if not code:
                continue
            result.append({
                'code': code,
                'name': item.get('f14', ''),
                'hot_score': item.get('f62', 0),
                'hot_rank': i + 1,
                'price': item.get('f2', 0) / 100 if item.get('f2') else 0,
                'change_pct': item.get('f3', 0) / 100 if item.get('f3') else 0,
            })

        output = {'success': True, 'data': result}
        _HOT_RANK_CACHE["data"] = output
        _HOT_RANK_CACHE["timestamp"] = now
        return output
    except Exception as e:
        return {'success': False, 'error': str(e)}


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
    """
    获取候选池：THS 选股池 ∩ 东方财富热度前 N → 过滤主板 → 补充消息面

    返回候选数据（含 hot_rank、news 等字段）。
    top_n 控制取热度排名前多少名做交集（默认 50）。
    """
    # Step 1: THS 池
    ths_result = get_ths_candidates()
    if not ths_result['success']:
        return ths_result
    # THS code 带 sh/sz 前缀，用裸 code（去掉前缀）做匹配 key
    ths_pool = {}
    for s in ths_result['data']:
        raw = s['code']
        for prefix in ('sh', 'sz', 'bj'):
            if raw.startswith(prefix):
                raw = raw[len(prefix):]
                break
        ths_pool[raw] = s

    if not ths_pool:
        return {'success': False, 'error': 'THS 选股池返回为空'}

    # Step 2: 热度排名
    hot_result = _fetch_hot_rank()
    if not hot_result['success']:
        return {'success': False, 'error': f"热度排名获取失败: {hot_result['error']}"}

    hot_top = hot_result['data'][:top_n]

    # Step 3: 取交集 + 过滤主板
    candidates = []
    for item in hot_top:
        code = item['code']
        ths_info = ths_pool.get(code)
        if ths_info is None:
            continue  # 不在 THS 池，跳过
        if not _is_zhuban(code):
            continue  # 非主板，跳过

        candidates.append({
            **ths_info,
            'hot_rank': item['hot_rank'],
            'hot_score': item['hot_score'],
        })

    # Step 4: 并发获取消息面
    news_map = await _batch_fetch_news([s['code'] for s in candidates], limit=3)

    for s in candidates:
        s['news'] = news_map.get(s['code'], [])

    return {
        'success': True,
        'data': candidates,
        'total_ths': ths_result['total'],
        'hot_top_n': len(hot_top),
        'after_filter': len(candidates),
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
