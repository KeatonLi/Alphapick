from pydantic import BaseModel
from typing import Dict, List, Any
from datetime import datetime


class WeekdayStat(BaseModel):
    count: int
    win_count: int
    win_rate: float
    avg_return: float
    max_return: float
    min_return: float


class WeekdayStatsResponse(BaseModel):
    data: Dict[str, WeekdayStat]
    summary: Dict[str, Any]


class HoldingPeriodStat(BaseModel):
    count: int
    avg_return: float
    win_rate: float
    median_return: float


class OptimalPeriod(BaseModel):
    days: int
    reason: str


class HoldingPeriodStatsResponse(BaseModel):
    data: Dict[str, HoldingPeriodStat]
    optimal_period: OptimalPeriod


class ReturnDistributionResponse(BaseModel):
    bins: List[str]
    counts: List[int]
    percentiles: Dict[str, float]


class Insight(BaseModel):
    type: str
    icon: str
    title: str
    content: str


class InsightsResponse(BaseModel):
    insights: List[Insight]
    generated_at: datetime


class PriceRangeStat(BaseModel):
    count: int
    win_count: int
    win_rate: float
    avg_return: float
    avg_price: float


class PriceRangeStatsResponse(BaseModel):
    data: Dict[str, PriceRangeStat]
    summary: Dict[str, Any]


class StockTypeStat(BaseModel):
    count: int
    win_count: int
    win_rate: float
    avg_return: float


class StockTypeStatsResponse(BaseModel):
    data: Dict[str, StockTypeStat]
    summary: Dict[str, Any]


class VolatilityStat(BaseModel):
    avg_max_gain: float
    avg_max_drawdown: float
    max_gain_count: int
    max_drawdown_count: int
    gain_drawdown_ratio: float


class VolatilityStatsResponse(BaseModel):
    data: Dict[str, VolatilityStat]
    summary: Dict[str, Any]


class TrendDataPoint(BaseModel):
    month: str
    win_rate: float
    count: int
    avg_return: float


class SuccessTrendResponse(BaseModel):
    data: List[TrendDataPoint]
    summary: Dict[str, Any]
