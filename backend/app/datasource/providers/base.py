"""数据源 Provider 抽象基类 — 统一接口，便于多源互备"""

from abc import ABC, abstractmethod
from datetime import date
from typing import Optional


class DataProvider(ABC):
    """数据源 Provider 基类

    每个具体 Provider 实现以下接口，MultiSourceManager 按优先级轮询。
    返回统一格式 dict: {"success": bool, "data": ..., "error": str|None}
    """

    name: str = "unknown"
    priority: int = 0  # 数字越小优先级越高

    # ── 个股行情 ──

    @abstractmethod
    def get_stock_info(self, code: str) -> dict:
        """获取股票基本信息
        Returns: {"success": True, "data": {"股票代码": ..., "股票简称": ..., ...}}
        """
        ...

    @abstractmethod
    def get_stock_daily(self, code: str, days: int = 60, adjust: str = "qfq") -> dict:
        """获取个股日线行情
        Returns: {"success": True, "data": [{"日期": ..., "开盘": ..., "收盘": ..., ...}, ...]}
        """
        ...

    @abstractmethod
    def get_stock_spot(self, code: Optional[str] = None) -> dict:
        """获取实时行情快照
        code 为 None 时返回全市场列表
        Returns: {"success": True, "data": [{"code": ..., "name": ..., "price": ..., "change_pct": ...}, ...]}
        """
        ...

    # ── 指数行情 ──

    @abstractmethod
    def get_index_daily(self, idx_code: str) -> dict:
        """获取指数日线数据
        Returns: {"success": True, "data": [{"date": ..., "open": ..., "close": ..., ...}, ...]}
        """
        ...

    @abstractmethod
    def get_market_index(self) -> dict:
        """获取主要指数行情（上证/深证/创业板）
        Returns: {"success": True, "data": [{"name": ..., "code": ..., "close": ..., "change_pct": ...}, ...]}
        """
        ...

    # ── 板块行情 ──

    @abstractmethod
    def get_hot_sectors(self, top_n: int = 10) -> dict:
        """获取热门板块
        Returns: {"success": True, "data": [{"name": ..., "change_pct": ..., "leading_stock": ...}, ...]}
        """
        ...

    # ── 资金流向 ──

    @abstractmethod
    def get_hsgt_flow(self) -> dict:
        """获取沪深港通资金流
        Returns: {"success": True, "data": {"today": {...}, "history": [...]}}
        """
        ...

    # ── 涨停池 ──

    @abstractmethod
    def get_limit_up_pool(self, target_date: date) -> dict:
        """获取涨停池
        Returns: {"success": True, "data": [{...}, ...]}
        """
        ...

    # ── 交易日历 ──

    @abstractmethod
    def get_trade_calendar(self) -> dict:
        """获取交易日历
        Returns: {"success": True, "data": ["YYYY-MM-DD", ...]}
        """
        ...

    def is_available(self) -> bool:
        """Provider 是否可用（可覆盖做健康检查）"""
        return True
