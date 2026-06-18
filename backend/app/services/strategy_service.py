"""Deterministic quant scoring for daily stock recommendations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


STRATEGY_VERSION = "qf-db-strength-v2"


@dataclass(frozen=True)
class FactorScore:
    momentum: float
    trend: float
    liquidity: float
    source_quality: float
    risk_penalty: float

    @property
    def total(self) -> float:
        raw = (
            self.momentum * 0.30
            + self.trend * 0.25
            + self.liquidity * 0.20
            + self.source_quality * 0.15
            - self.risk_penalty * 0.10
        )
        return round(max(0.0, min(raw, 100.0)), 4)

    def as_dict(self) -> dict[str, float]:
        return {
            "momentum": round(self.momentum, 4),
            "trend": round(self.trend, 4),
            "liquidity": round(self.liquidity, 4),
            "source_quality": round(self.source_quality, 4),
            "risk_penalty": round(self.risk_penalty, 4),
            "total": self.total,
        }


def _clamp(value: float, lower: float = 0.0, upper: float = 100.0) -> float:
    return max(lower, min(value, upper))


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _source_quality(source: str | None) -> float:
    if source == "db_snapshot":
        return 92
    if source in {"lxsz", "akshare", "tencent"}:
        return 88
    return 70


def _liquidity_score(turnover: float, volume: float) -> float:
    if turnover > 0:
        return _clamp(turnover * 8)
    if volume <= 0:
        return 0
    # Tencent volume is commonly reported in hands. 100k hands is modest,
    # 5m hands is very liquid. Keep this as a fallback, not the dominant factor.
    return _clamp((volume / 5_000_000) * 80)


def _reason(stock: dict[str, Any], factors: FactorScore) -> str:
    change_pct = _to_float(stock.get("change_pct"))
    turnover = _to_float(stock.get("turnover"))
    continuous_days = int(_to_float(stock.get("continuous_days")))
    sector = stock.get("sector") or "Unclassified"
    return (
        f"Momentum {change_pct:.2f}%, trend {continuous_days} day(s), "
        f"turnover {turnover:.2f}%, sector {sector}. "
        f"Score {factors.total:.1f}."
    )


def score_candidate(stock: dict[str, Any]) -> dict[str, Any] | None:
    """Score one candidate. Return None when it should be filtered out."""
    code = str(stock.get("code", "")).removeprefix("sh").removeprefix("sz").removeprefix("bj")
    price = _to_float(stock.get("price"))
    change_pct = _to_float(stock.get("change_pct"))
    turnover = _to_float(stock.get("turnover"))
    volume = _to_float(stock.get("volume"))
    continuous_days = _to_float(stock.get("continuous_days"))

    if not code or price <= 0:
        return None
    if price < 5 or price > 80:
        return None
    if code.startswith(("300", "301", "688", "4", "8")):
        return None
    if change_pct <= -3:
        return None

    momentum = _clamp(50 + change_pct * 6)
    trend = _clamp(continuous_days * 18)
    liquidity = _liquidity_score(turnover, volume)
    source_quality = _source_quality(stock.get("source"))

    risk_penalty = 0.0
    if change_pct >= 8:
        risk_penalty += 35
    if turnover >= 18:
        risk_penalty += 20
    if continuous_days >= 5:
        risk_penalty += 15

    factors = FactorScore(
        momentum=momentum,
        trend=trend,
        liquidity=liquidity,
        source_quality=source_quality,
        risk_penalty=_clamp(risk_penalty),
    )

    return {
        **stock,
        "code": code,
        "score": factors.total,
        "strategy_version": STRATEGY_VERSION,
        "factor_snapshot": factors.as_dict(),
        "reason": _reason(stock, factors),
    }


def rank_candidates(candidates: list[dict[str, Any]], top_n: int = 5) -> list[dict[str, Any]]:
    scored = [item for item in (score_candidate(candidate) for candidate in candidates) if item is not None]
    scored.sort(
        key=lambda item: (
            -_to_float(item.get("score")),
            -_to_float(item.get("continuous_days")),
            -_to_float(item.get("turnover")),
            str(item.get("code", "")),
        )
    )
    for idx, item in enumerate(scored[:top_n], start=1):
        item["rank"] = idx
    return scored[:top_n]
