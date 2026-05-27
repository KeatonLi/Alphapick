from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.analysis_service import (
    get_weekday_stats,
    get_holding_period_stats,
    get_return_distribution,
    generate_insights,
)

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.get("/weekday-stats")
def weekday_stats(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """统计每周各交易日的推荐效果"""
    return get_weekday_stats(db, start_date, end_date)


@router.get("/holding-period-stats")
def holding_period_stats(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """统计不同持仓天数的收益表现"""
    return get_holding_period_stats(db, start_date, end_date)


@router.get("/return-distribution")
def return_distribution(
    holding_days: int = Query(3, ge=1, le=3),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """获取指定持仓天数的收益分布直方图数据"""
    return get_return_distribution(db, holding_days, start_date, end_date)


@router.get("/insights")
def insights(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """自动生成关键洞察"""
    return generate_insights(db, start_date, end_date)
