from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.services.recommend_service import (
    get_available_recommend_dates,
    get_recommend_by_date,
    get_recommend_stats,
)

router = APIRouter(prefix="/api/picks", tags=["picks"], dependencies=[Depends(get_current_user)])


@router.get("/daily")
async def daily_picks(target_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db)):
    target = target_date or date.today()
    result = await get_recommend_by_date(db, target)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    stats = await get_recommend_stats(db)
    return {
        **result,
        "meta": {
            "date": str(target),
            "data_status": "ready" if result.get("data") else "missing_picks",
            "stats": stats.get("data", {}) if stats.get("success") else {},
        },
    }


@router.get("/latest")
async def latest_picks(db: Session = Depends(get_db)):
    dates = get_available_recommend_dates(db, days=365).get("data", [])
    if not dates:
        return {"success": True, "data": [], "meta": {"date": None, "data_status": "missing_picks"}}
    latest = date.fromisoformat(dates[0])
    return await daily_picks(latest, db)


@router.get("/dates")
def pick_dates(days: int = Query(365, ge=1, le=2000), db: Session = Depends(get_db)):
    return get_available_recommend_dates(db, days=days)


@router.get("/trade-dates")
def pick_trade_dates(days: int = Query(365, ge=1, le=2000)):
    from app.utils.akshare_utils import get_trade_dates_for_frontend

    return get_trade_dates_for_frontend(days=days)
