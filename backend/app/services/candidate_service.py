# backend/app/services/candidate_service.py
"""
量化推荐候选池服务
数据来源：同花顺服务端筛选好的选股池
- 理想选股 (stock_rank_lxsz_ths): 连涨天数+换手率筛选，~192只，0.5秒
- 持续强势股 (stock_rank_cxg_ths): 持续创新高，~398只，1.9秒
两个池合并去重后，对每只股票取日线计算 MA 条件
"""

import asyncio
import numpy as np
from typing import Optional

import akshare as ak
from app.utils.akshare_utils import get_stock_daily

MA_SHORT = 5
MA_MID = 10
MA_LONG = 20

MIN_PRICE = 5
MAX_PRICE = 200
MIN_CONTINUOUS_DAYS = 3  # 最少连涨天数


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
    合并 理想选股 + 持续强势股，按连涨天数过滤
    """
    lxsz = ak.stock_rank_lxsz_ths()  # 理想选股
    cxg = ak.stock_rank_cxg_ths()     # 持续强势股

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
                prev_high = float(row.get('前期高点', 0) or 0)
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
                'continuous_days': 0,  # 持续强势股无连涨天数，用0表示
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


async def get_ma_filtered_candidates(top_n: int = 50) -> dict:
    """
    获取经过 MA 多头条件过滤的候选股票

    Step 1: 从 THS 服务端池获取候选（~500只）
    Step 2: 对候选股票并发获取日线，计算 MA5>MA10>MA20 条件
    Step 3: 按换手率降序取 top_n
    """
    ths_result = get_ths_candidates()
    if not ths_result['success']:
        return ths_result

    candidates_base = ths_result['data']
    if not candidates_base:
        return {'success': False, 'error': 'THS 选股池返回为空'}

    # ─── Stage 2: 并发获取日线，筛选 MA 多头 ───────────────────────────────
    semaphore = asyncio.Semaphore(15)

    async def fetch_and_check(stock: dict) -> Optional[dict]:
        async with semaphore:
            try:
                result = await get_stock_daily(stock['code'], days=25)
                if not result['success'] or len(result['data']) < 21:
                    return None
                daily_data = result['data']
                closes = [d['收盘'] for d in daily_data]
                volumes = [d['成交量'] for d in daily_data]

                ma5 = np.mean(closes[-5:])
                ma10 = np.mean(closes[-10:])
                ma20 = np.mean(closes[-20:])
                current_price = closes[-1]
                avg_vol_20 = np.mean(volumes[-20:])
                current_vol = volumes[-1]
                vol_ratio = current_vol / avg_vol_20 if avg_vol_20 > 0 else 0

                # MA 多头排列
                if not (ma5 > ma10 > ma20):
                    return None
                # 价格在均线上方
                if current_price < ma20:
                    return None

                return {
                    **stock,
                    'ma5': round(ma5, 2),
                    'ma10': round(ma10, 2),
                    'ma20': round(ma20, 2),
                    'volume_ratio': round(vol_ratio, 2),
                }
            except Exception:
                return None

    tasks = [fetch_and_check(s) for s in candidates_base]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    candidates = [r for r in results if isinstance(r, dict) and r is not None]

    # 按换手率降序
    candidates.sort(key=lambda x: x.get('turnover', 0), reverse=True)
    candidates = candidates[:top_n]

    return {
        'success': True,
        'data': candidates,
        'total_ths': len(candidates_base),
        'after_ma_filter': len(candidates),
    }


def format_candidates_for_ai(candidates: list) -> str:
    """将候选池格式化为 AI 输入"""
    lines = []
    for s in candidates:
        source_tag = '⭐' if s.get('source') == 'lxsz' else '◆'
        lines.append(
            f"{source_tag}{s['code']} {s['name']} "
            f"现价:{s['price']} 涨幅:{s.get('change_pct', 0):.2f}% "
            f"换手:{s.get('turnover', 0):.2f}% 连涨:{s.get('continuous_days', 0)}天 "
            f"MA5:{s.get('ma5', 0)} MA10:{s.get('ma10', 0)} MA20:{s.get('ma20', 0)} "
            f"板块:{s.get('sector', '')}"
        )
    return '\n'.join(lines)
