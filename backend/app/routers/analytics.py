from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.services.analysis_service import (
    generate_insights,
    get_holding_period_stats,
    get_price_range_stats,
    get_return_distribution,
    get_stock_type_stats,
    get_success_trend,
    get_volatility_stats,
    get_weekday_stats,
)

router = APIRouter(prefix="/api/analytics", tags=["analytics"], dependencies=[Depends(get_current_user)])


@router.get("/overview")
def analytics_overview(start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None), db: Session = Depends(get_db)):
    return {
        "success": True,
        "data": {
            "weekday": get_weekday_stats(db, start_date, end_date),
            "holding_period": get_holding_period_stats(db, start_date, end_date),
            "success_trend": get_success_trend(db, start_date, end_date),
        },
    }


@router.get("/weekday-stats")
def analytics_weekday_stats(start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None), db: Session = Depends(get_db)):
    return get_weekday_stats(db, start_date, end_date)


@router.get("/holding-period")
def analytics_holding_period(start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None), db: Session = Depends(get_db)):
    return get_holding_period_stats(db, start_date, end_date)


@router.get("/holding-period-stats")
def analytics_holding_period_stats(start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None), db: Session = Depends(get_db)):
    return get_holding_period_stats(db, start_date, end_date)


@router.get("/return-distribution")
def analytics_return_distribution(holding_days: int = Query(3, ge=1, le=7), start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None), db: Session = Depends(get_db)):
    return get_return_distribution(db, holding_days, start_date, end_date)


@router.get("/success-trend")
def analytics_success_trend(start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None), db: Session = Depends(get_db)):
    return get_success_trend(db, start_date, end_date)


@router.get("/risk")
def analytics_risk(start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None), db: Session = Depends(get_db)):
    return get_volatility_stats(db, start_date, end_date)


@router.get("/stock-profile")
def analytics_stock_profile(start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None), db: Session = Depends(get_db)):
    return {
        "success": True,
        "data": {
            "price_range": get_price_range_stats(db, start_date, end_date),
            "stock_type": get_stock_type_stats(db, start_date, end_date),
        },
    }


@router.get("/price-range-stats")
def analytics_price_range_stats(start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None), db: Session = Depends(get_db)):
    return get_price_range_stats(db, start_date, end_date)


@router.get("/stock-type-stats")
def analytics_stock_type_stats(start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None), db: Session = Depends(get_db)):
    return get_stock_type_stats(db, start_date, end_date)


@router.get("/volatility-stats")
def analytics_volatility_stats(start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None), db: Session = Depends(get_db)):
    return get_volatility_stats(db, start_date, end_date)


@router.get("/insights")
def analytics_insights(start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None), db: Session = Depends(get_db)):
    return generate_insights(db, start_date, end_date)
