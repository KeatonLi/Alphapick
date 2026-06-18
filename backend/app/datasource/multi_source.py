"""多源数据管理器 — 按优先级轮询 Provider，自动降级

使用示例：
    from app.datasource.multi_source import multi_source

    # 获取个股信息（自动尝试 AKShare → 腾讯 → 新浪）
    result = multi_source.get_stock_info("600519")
    if result["success"]:
        print(result["data"])

    # 获取全市场实时行情（自动尝试 AKShare → 腾讯）
    result = multi_source.get_stock_spot()
"""

import logging
from datetime import date
from typing import Optional

from app.datasource.providers import AkShareProvider, TencentProvider, SinaProvider

logger = logging.getLogger(__name__)


class MultiSourceManager:
    """多源数据管理器

    管理多个 Provider，按优先级排序。
    每次请求按优先级尝试，第一个成功的结果直接返回。
    全部失败时返回最后一个错误。
    """

    def __init__(self):
        self._providers = []
        self._register_default_providers()

    def _register_default_providers(self):
        """注册默认 Provider（按优先级排序）"""
        providers = [
            AkShareProvider(),   # 主源：数据最全
            TencentProvider(),   # 备1：实时行情快
            SinaProvider(),      # 备2：极简稳定
        ]
        # 按 priority 升序排序（数字越小越优先）
        self._providers = sorted(providers, key=lambda p: p.priority)
        logger.info(
            f"[MultiSource] Registered {len(self._providers)} providers: "
            f"{', '.join(p.name for p in self._providers)}"
        )

    def register(self, provider):
        """注册自定义 Provider"""
        self._providers.append(provider)
        self._providers.sort(key=lambda p: p.priority)
        logger.info(f"[MultiSource] Registered provider: {provider.name}")

    def _try_providers(self, method_name: str, *args, **kwargs):
        """按优先级尝试所有 Provider 的指定方法

        Args:
            method_name: Provider 方法名（如 "get_stock_info"）
            *args, **kwargs: 传递给方法的参数

        Returns:
            第一个成功 Provider 的结果，或最后一个失败的错误
        """
        last_error = None
        for provider in self._providers:
            try:
                method = getattr(provider, method_name)
                result = method(*args, **kwargs)
                if result.get("success"):
                    # 记录使用了哪个 Provider
                    result["_source"] = provider.name
                    logger.debug(
                        f"[MultiSource] {method_name} succeeded via {provider.name}"
                    )
                    return result
                else:
                    last_error = result.get("error", "未知错误")
                    logger.debug(
                        f"[MultiSource] {method_name} failed via {provider.name}: {last_error}"
                    )
            except Exception as e:
                last_error = str(e)
                logger.warning(
                    f"[MultiSource] {method_name} exception via {provider.name}: {e}"
                )

        # 全部失败
        return {
            "success": False,
            "error": last_error or "所有数据源均不可用",
            "_source": None,
        }

    # ── 个股行情 ──

    def get_stock_info(self, code: str) -> dict:
        return self._try_providers("get_stock_info", code)

    def get_stock_daily(self, code: str, days: int = 60, adjust: str = "qfq") -> dict:
        return self._try_providers("get_stock_daily", code, days, adjust)

    def get_stock_spot(self, code: Optional[str] = None) -> dict:
        return self._try_providers("get_stock_spot", code)

    # ── 指数行情 ──

    def get_index_daily(self, idx_code: str) -> dict:
        return self._try_providers("get_index_daily", idx_code)

    def get_market_index(self) -> dict:
        return self._try_providers("get_market_index")

    # ── 板块行情 ──

    def get_hot_sectors(self, top_n: int = 10) -> dict:
        return self._try_providers("get_hot_sectors", top_n)

    # ── 资金流向 ──

    def get_hsgt_flow(self) -> dict:
        return self._try_providers("get_hsgt_flow")

    # ── 涨停池 ──

    def get_limit_up_pool(self, target_date: date) -> dict:
        return self._try_providers("get_limit_up_pool", target_date)

    # ── 交易日历 ──

    def get_trade_calendar(self) -> dict:
        return self._try_providers("get_trade_calendar")


# 全局单例
multi_source = MultiSourceManager()
