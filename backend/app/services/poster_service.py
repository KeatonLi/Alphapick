"""市场海报生成服务：使用 Pillow 生成公众号风格的市场日报海报"""
import io
import os
import base64
import math
import random
from datetime import date
from typing import Dict, List, Optional, Any

PILLOW_AVAILABLE = False
try:
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
    PILLOW_AVAILABLE = True
except ImportError:
    pass


# ─── 海报配色 ──────────────────────────────────────────────────────────────────

BG_TOP = (12, 18, 38)
BG_BOTTOM = (22, 45, 78)
CARD_BG = (255, 255, 255)
CARD_BG_SEMI = (255, 255, 255, 220)
ACCENT_BLUE = (59, 130, 246)
ACCENT_GOLD = (251, 191, 36)
ACCENT_CYAN = (34, 211, 238)
ACCENT_PURPLE = (139, 92, 246)
TEXT_WHITE = (255, 255, 255)
TEXT_LIGHT = (203, 213, 225)
TEXT_DARK = (30, 41, 59)
TEXT_SECONDARY = (100, 116, 139)
TEXT_MUTED = (148, 163, 184)
STOCK_UP = (239, 68, 68)
STOCK_DOWN = (34, 197, 94)
STOCK_UP_BG = (254, 226, 226)
STOCK_DOWN_BG = (220, 252, 231)
DIVIDER = (226, 232, 240)


# ─── 字体加载 ──────────────────────────────────────────────────────────────────

def _load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    font_candidates = []
    if bold:
        font_candidates += [
            "/System/Library/Fonts/STHeiti Medium.ttc",
            "/System/Library/AssetsV2/com_apple_MobileAsset_Font8/86ba2c91f017a3749571a82f2c6d890ac7ffb2fb.asset/AssetData/PingFang.ttc",
            "/System/Library/Fonts/Hiragino Sans GB.ttc",
        ]
    font_candidates += [
        "/System/Library/AssetsV2/com_apple_MobileAsset_Font8/86ba2c91f017a3749571a82f2c6d890ac7ffb2fb.asset/AssetData/PingFang.ttc",
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/AssetsV2/com_apple_MobileAsset_Font8/5feac9245cca79adaf638ded7a4994b1ddb33ca0.asset/AssetData/Hei.ttf",
    ]
    font_candidates += [
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
    ]
    for path in font_candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _get_fonts() -> Dict[str, ImageFont.FreeTypeFont]:
    return {
        "title": _load_font(48, bold=True),
        "subtitle": _load_font(28, bold=True),
        "heading": _load_font(26, bold=True),
        "body": _load_font(21),
        "body_bold": _load_font(21, bold=True),
        "small": _load_font(17),
        "small_bold": _load_font(17, bold=True),
        "tiny": _load_font(13),
        "number_lg": _load_font(60, bold=True),
        "number_md": _load_font(38, bold=True),
        "number_sm": _load_font(24, bold=True),
        "number_xs": _load_font(18, bold=True),
        "date": _load_font(20, bold=True),
    }


# ─── 背景装饰 ──────────────────────────────────────────────────────────────────

def _draw_bg_decorations(img: Image.Image, width: int, height: int):
    """绘制背景装饰：渐变 + 微弱光点"""
    draw = ImageDraw.Draw(img)

    # 渐变背景
    for y in range(height):
        ratio = y / height
        r = int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * ratio)
        g = int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * ratio)
        b = int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    # 微弱装饰光点（模拟星空感）
    random.seed(42)
    for _ in range(40):
        x = random.randint(0, width)
        y = random.randint(0, height)
        size = random.randint(1, 3)
        alpha = random.randint(15, 35)
        draw.ellipse([x - size, y - size, x + size, y + size],
                     fill=(180, 200, 230, alpha))


# ─── 绘图工具 ──────────────────────────────────────────────────────────────────

def _text_center_x(draw: ImageDraw.Draw, text: str, width: int, font: ImageFont.FreeTypeFont) -> int:
    bbox = draw.textbbox((0, 0), text, font=font)
    return (width - (bbox[2] - bbox[0])) // 2


def _text_width(draw: ImageDraw.Draw, text: str, font: ImageFont.FreeTypeFont) -> int:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0]


def _wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int, draw: ImageDraw.Draw) -> List[str]:
    lines = []
    for paragraph in text.split('\n'):
        if not paragraph.strip():
            lines.append('')
            continue
        current = ''
        for char in paragraph:
            test = current + char
            bbox = draw.textbbox((0, 0), test, font=font)
            if bbox[2] - bbox[0] > max_width:
                if current:
                    lines.append(current)
                current = char
            else:
                current = test
        if current:
            lines.append(current)
    return lines


def _draw_glow_line(draw: ImageDraw.Draw, x1, y1, x2, y2, color=(59, 130, 246), width=2):
    """绘制简洁的渐变分隔线"""
    line_color = color + (120,)
    draw.line([(x1, y1), (x2, y2)], fill=line_color, width=width)


def _draw_section_icon(draw: ImageDraw.Draw, x: int, y: int, text: str, color=(59, 130, 246)):
    """绘制圆角小图标"""
    draw.rounded_rectangle([x, y, x + 32, y + 32], radius=8, fill=color)
    bbox = draw.textbbox((0, 0), text, font=_get_fonts()["small_bold"])
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text((x + (32 - tw) // 2, y + (32 - th) // 2 - 1), text, font=_get_fonts()["small_bold"], fill=(255, 255, 255))


# ─── 海报各区域绘制 ────────────────────────────────────────────────────────────

def _draw_header(draw: ImageDraw.Draw, width: int, margin: int, report_date: str,
                 market_summary: str, fonts: dict) -> int:
    """头部：日期 + 品牌 + 市场概况"""
    y = 60

    # 日期胶囊
    date_str = report_date.replace("-", ".")
    dw = _text_width(draw, date_str, fonts["date"])
    tag_x = (width - dw - 30) // 2
    draw.rounded_rectangle([tag_x, y, tag_x + dw + 30, y + 36], radius=18,
                           fill=(255, 255, 255, 25), outline=(255, 255, 255, 50), width=1)
    draw.text((tag_x + 15, y + 6), date_str, font=fonts["date"], fill=TEXT_LIGHT)
    y += 54

    # 品牌名
    cx = _text_center_x(draw, "AlphaPick", width, fonts["title"])
    draw.text((cx, y), "AlphaPick", font=fonts["title"], fill=TEXT_WHITE)
    y += 62

    # 副标题
    cx = _text_center_x(draw, "A 股市场日报", width, fonts["subtitle"])
    draw.text((cx, y), "A 股市场日报", font=fonts["subtitle"], fill=ACCENT_GOLD)
    y += 46

    # 市场概况
    if market_summary:
        cx = _text_center_x(draw, market_summary, width, fonts["body"])
        draw.text((cx, y), market_summary, font=fonts["body"], fill=TEXT_LIGHT)
        y += 32

    # 装饰分隔线
    y += 12
    _draw_glow_line(draw, width // 2 - 100, y, width // 2 + 100, y)
    y += 24
    return y


def _draw_index_section(draw: ImageDraw.Draw, width: int, margin: int, y: int,
                        indices: List[dict], fonts: dict) -> int:
    """三大指数卡片"""
    # Section header
    _draw_section_icon(draw, margin, y, "指", ACCENT_BLUE)
    draw.text((margin + 40, y + 2), "主要指数", font=fonts["heading"], fill=TEXT_WHITE)
    y += 48

    card_w = (width - margin * 2 - 16) // 3
    card_h = 160

    for i, idx in enumerate(indices[:3]):
        x = margin + i * (card_w + 8)
        # 卡片背景
        draw.rounded_rectangle([x, y, x + card_w, y + card_h], radius=14, fill=CARD_BG)
        # 顶部彩色条
        color = STOCK_UP if idx.get("change_pct", 0) >= 0 else STOCK_DOWN
        draw.rounded_rectangle([x, y, x + card_w, y + 8], radius=14, fill=color)
        draw.rectangle([x, y + 4, x + card_w, y + 8], fill=color)

        # 指数名
        name = idx.get("name", "")
        nw = _text_width(draw, name, fonts["small"])
        draw.text((x + (card_w - nw) // 2, y + 18), name, font=fonts["small"], fill=TEXT_MUTED)

        # 收盘价
        close_val = idx.get("close", 0)
        close_str = f"{close_val:.2f}" if isinstance(close_val, (int, float)) else str(close_val)
        cw = _text_width(draw, close_str, fonts["number_md"])
        draw.text((x + (card_w - cw) // 2, y + 52), close_str, font=fonts["number_md"], fill=TEXT_DARK)

        # 涨跌幅标签
        pct = idx.get("change_pct", 0)
        pct_str = f"{'+' if pct >= 0 else ''}{pct:.2f}%"
        pct_color = STOCK_UP if pct >= 0 else STOCK_DOWN
        pw = _text_width(draw, pct_str, fonts["number_sm"])
        tw = pw + 24
        tx = x + (card_w - tw) // 2
        ty = y + 108
        tag_bg = STOCK_UP_BG if pct >= 0 else STOCK_DOWN_BG
        draw.rounded_rectangle([tx, ty, tx + tw, ty + 36], radius=10, fill=tag_bg)
        draw.text((tx + 12, ty + 5), pct_str, font=fonts["number_sm"], fill=pct_color)

        # 卡片底部装饰点
        dot_y = y + card_h - 14
        draw.ellipse([x + card_w // 2 - 3, dot_y, x + card_w // 2 + 3, dot_y + 6],
                     fill=color + (60,))

    return y + card_h + 28


def _draw_sectors_section(draw: ImageDraw.Draw, width: int, margin: int, y: int,
                          sectors: List[dict], fonts: dict) -> int:
    """热门板块排行"""
    _draw_section_icon(draw, margin, y, "热", ACCENT_GOLD)
    draw.text((margin + 40, y + 2), "热门板块", font=fonts["heading"], fill=TEXT_WHITE)
    y += 48

    visible = sectors[:8]
    row_h = 48
    card_h = len(visible) * row_h + 12

    # 卡片背景
    draw.rounded_rectangle([margin, y, width - margin, y + card_h], radius=14, fill=CARD_BG)

    row_y = y + 6
    for i, s in enumerate(visible):
        pct = s.get("change_pct", 0)
        up = pct >= 0
        color = STOCK_UP if up else STOCK_DOWN

        # 排名数字
        rank_text = f"{i + 1:02d}"
        rank_color = ACCENT_GOLD if i < 3 else TEXT_MUTED
        draw.text((margin + 16, row_y + 10), rank_text, font=fonts["number_sm"], fill=rank_color)

        # 板块名
        draw.text((margin + 68, row_y + 10), s.get("name", ""), font=fonts["body"], fill=TEXT_DARK)

        # 领涨股
        leader = s.get("leading_stock", "")
        if leader:
            lt = f"▸ {leader}"
            draw.text((margin + 68, row_y + 32), lt, font=fonts["tiny"], fill=TEXT_MUTED)

        # 涨跌幅
        pct_str = f"{'+' if up else ''}{pct:.2f}%"
        pw = _text_width(draw, pct_str, fonts["number_sm"])
        draw.text((width - margin - pw - 16, row_y + 10), pct_str, font=fonts["number_sm"], fill=color)

        # 分隔线
        if i < len(visible) - 1:
            ly = row_y + row_h - 1
            draw.line([(margin + 16, ly), (width - margin - 16, ly)], fill=DIVIDER, width=1)

        row_y += row_h

    return y + card_h + 28


def _draw_limit_up_section(draw: ImageDraw.Draw, width: int, margin: int, y: int,
                           limit_up_data: List[dict], yesterday_perf, fonts: dict) -> int:
    """涨停板分析（紧凑版）"""
    if not limit_up_data:
        return y

    _draw_section_icon(draw, margin, y, "涨", STOCK_UP)
    draw.text((margin + 40, y + 2), "涨停板分析", font=fonts["heading"], fill=TEXT_WHITE)
    y += 48

    total = len(limit_up_data)
    yizi = sum(1 for s in limit_up_data if s.get("board_type") == "一字板")
    multi = sum(1 for s in limit_up_data if s.get("consecutive_days", 0) >= 2)
    max_consec = max((s.get("consecutive_days", 1) for s in limit_up_data), default=1)

    # 顶行指标
    stats = [
        (f"{total}", "涨停数"),
        (f"{yizi}", "一字板"),
        (f"{multi}", "连板≥2"),
        (f"{max_consec}板", "最高连板"),
    ]
    stat_w = (width - margin * 2 - 12) // 4
    stat_card_h = 68
    for i, (val, label) in enumerate(stats):
        sx = margin + i * (stat_w + 4)
        draw.rounded_rectangle([sx, y, sx + stat_w, y + stat_card_h], radius=10, fill=CARD_BG)
        vw = _text_width(draw, val, fonts["number_sm"])
        draw.text((sx + (stat_w - vw) // 2, y + 10), val, font=fonts["number_sm"], fill=STOCK_UP)
        lw = _text_width(draw, label, fonts["tiny"])
        draw.text((sx + (stat_w - lw) // 2, y + 40), label, font=fonts["tiny"], fill=TEXT_MUTED)
    y += stat_card_h + 8

    # 昨日涨停表现
    if yesterday_perf is not None:
        perf_color = STOCK_UP if yesterday_perf >= 0 else STOCK_DOWN
        perf_text = f"昨日涨停股今日平均涨幅：{'+' if yesterday_perf >= 0 else ''}{yesterday_perf:.2f}%"
        perf_w = _text_width(draw, perf_text, fonts["small"])
        draw.rounded_rectangle([margin, y, width - margin, y + 34], radius=10,
                               fill=(255, 255, 255, 30))
        draw.text((margin + 14, y + 7), perf_text, font=fonts["small"], fill=perf_color)
        y += 44

    # 连板龙头紧凑展示
    multi_day = sorted(
        [s for s in limit_up_data if s.get("consecutive_days", 0) >= 2],
        key=lambda x: -x["consecutive_days"]
    )[:6]
    if multi_day:
        row_h = 42
        visible = min(len(multi_day), 5)
        card_h = visible * row_h + 12
        draw.rounded_rectangle([margin, y, width - margin, y + card_h], radius=14, fill=CARD_BG)
        row_y = y + 6
        for i, s in enumerate(multi_day[:visible]):
            # 名次
            rank_text = f"#{i + 1}"
            draw.text((margin + 14, row_y + 9), rank_text, font=fonts["small_bold"],
                     fill=ACCENT_GOLD if i < 3 else TEXT_MUTED)
            # 名称
            draw.text((margin + 56, row_y + 9), s.get("name", ""), font=fonts["body"], fill=TEXT_DARK)
            # 连板
            conseq_text = f"{s.get('consecutive_days', 0)}连板 · {s.get('board_type', '')}"
            draw.text((margin + 56, row_y + 28), conseq_text, font=fonts["tiny"], fill=TEXT_MUTED)
            # 封单
            sealed = s.get("sealed_amount", 0)
            if sealed > 0:
                sealed_str = f"封{sealed:.0f}万" if sealed < 10000 else f"封{sealed/10000:.1f}亿"
                sw = _text_width(draw, sealed_str, fonts["tiny"])
                draw.text((width - margin - sw - 14, row_y + 9), sealed_str, font=fonts["tiny"], fill=TEXT_SECONDARY)

            if i < visible - 1:
                draw.line([(margin + 14, row_y + row_h - 1), (width - margin - 14, row_y + row_h - 1)],
                         fill=DIVIDER, width=1)
            row_y += row_h
        y += card_h + 20

    return y


def _draw_ai_section(draw: ImageDraw.Draw, width: int, margin: int, y: int,
                     ai_report: str, fonts: dict, poster_bottom: int) -> int:
    """AI 市场洞察"""
    if not ai_report:
        return y

    _draw_section_icon(draw, margin, y, "AI", ACCENT_PURPLE)
    draw.text((margin + 40, y + 2), "AI 市场洞察", font=fonts["heading"], fill=TEXT_WHITE)
    y += 48

    text_max_w = width - margin * 2 - 48
    lines = _wrap_text(ai_report, fonts["body"], text_max_w, draw)

    # 计算可用空间
    footer_height = 70
    available_h = poster_bottom - footer_height - y - 20
    line_h = 30
    max_lines = max(1, available_h // line_h)
    display_lines = lines[:max_lines]

    card_h = len(display_lines) * line_h + 28

    draw.rounded_rectangle([margin, y, width - margin, y + card_h], radius=14, fill=CARD_BG)
    # 左侧装饰条
    draw.rounded_rectangle([margin, y + 8, margin + 5, y + card_h - 8], radius=3, fill=ACCENT_PURPLE)

    text_y = y + 14
    for line in display_lines:
        draw.text((margin + 22, text_y), line, font=fonts["body"], fill=TEXT_SECONDARY)
        text_y += line_h

    return y + card_h + 16


def _draw_footer(draw: ImageDraw.Draw, width: int, margin: int, y: int, fonts: dict):
    """底部信息"""
    # 分隔线
    _draw_glow_line(draw, margin, y, width - margin, y)
    y += 14

    footer_text = "AlphaPick · AI 驱动 A 股分析 · 数据仅供参考"
    cx = _text_center_x(draw, footer_text, width, fonts["tiny"])
    draw.text((cx, y), footer_text, font=fonts["tiny"], fill=(120, 148, 175))
    y += 26

    url_text = "alphapick.pro"
    cx = _text_center_x(draw, url_text, width, fonts["tiny"])
    draw.text((cx, y), url_text, font=fonts["tiny"], fill=(80, 130, 180))


# ─── 主函数 ────────────────────────────────────────────────────────────────────

def generate_poster(
    report_date: str,
    market_summary: str,
    index_data: List[dict],
    hot_sectors: List[dict],
    ai_report: str,
    limit_up_data: Optional[List[dict]] = None,
    yesterday_limit_up_perf: Optional[float] = None,
) -> Optional[bytes]:
    """生成市场日报海报图片，返回 PNG bytes"""
    if not PILLOW_AVAILABLE:
        return None

    width = 1080
    height = 1920
    margin = 56

    fonts = _get_fonts()

    # 创建 RGBA 画布
    img = Image.new("RGBA", (width, height), (0, 0, 0, 255))
    draw = ImageDraw.Draw(img)

    # 1. 背景装饰
    _draw_bg_decorations(img, width, height)
    draw = ImageDraw.Draw(img)  # 重新获取 draw

    # 2. 头部
    y = _draw_header(draw, width, margin, report_date, market_summary, fonts)

    # 3. 三大指数
    if index_data:
        y = _draw_index_section(draw, width, margin, y, index_data, fonts)

    # 4. 涨停板分析（放置于指数和板块之间，位置靠前）
    if limit_up_data:
        y = _draw_limit_up_section(draw, width, margin, y, limit_up_data, yesterday_limit_up_perf, fonts)

    # 5. 热门板块
    if hot_sectors:
        y = _draw_sectors_section(draw, width, margin, y, hot_sectors, fonts)

    # 6. AI 分析（动态填充到接近底部）
    footer_reserved = 80  # 底部预留空间
    if ai_report:
        y = _draw_ai_section(draw, width, margin, y, ai_report, fonts, height - footer_reserved)

    # 7. 底部（固定位置）
    _draw_footer(draw, width, margin, height - footer_reserved, fonts)

    # 转换为 RGB 后导出 PNG
    rgb_img = Image.new("RGB", img.size, (0, 0, 0))
    rgb_img.paste(img, mask=img.split()[3] if img.mode == "RGBA" else None)

    buf = io.BytesIO()
    rgb_img.save(buf, format="PNG", quality=95)
    buf.seek(0)
    return buf.read()


def generate_poster_base64(
    report_date: str,
    market_summary: str,
    index_data: List[dict],
    hot_sectors: List[dict],
    ai_report: str,
    limit_up_data: Optional[List[dict]] = None,
    yesterday_limit_up_perf: Optional[float] = None,
) -> Optional[str]:
    """生成海报并返回 Base64 编码"""
    png_bytes = generate_poster(report_date, market_summary, index_data, hot_sectors,
                                ai_report, limit_up_data, yesterday_limit_up_perf)
    if png_bytes:
        return base64.b64encode(png_bytes).decode("utf-8")
    return None
