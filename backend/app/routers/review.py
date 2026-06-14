from datetime import date
from typing import Optional

from fastapi import APIRouter, Body, Depends, Query, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.user import User
from app.services.recommend_service import (
    batch_delete_recommendations,
    batch_reset_tracking,
    batch_update_tracking_prices,
    delete_recommendation,
    get_all_recommendations,
    get_recommend_stats,
    reset_recommend_tracking,
    update_recommend_prices,
)

router = APIRouter(prefix="/api/review", tags=["review"], dependencies=[Depends(get_current_user)])
limiter = Limiter(key_func=get_remote_address)


def _filter_history(rows: list[dict], start_date: Optional[date], end_date: Optional[date], status: Optional[str]) -> list[dict]:
    result = []
    for row in rows:
        rec_date = date.fromisoformat(row["recommend_date"])
        if start_date and rec_date < start_date:
            continue
        if end_date and rec_date > end_date:
            continue
        if status and status != "all" and row.get("status") != status:
            continue
        result.append(row)
    return result


def _avg(values: list[float]) -> float:
    return round(sum(values) / len(values), 4) if values else 0


def _win_rate(values: list[float]) -> float:
    return round(sum(1 for value in values if value > 0) / len(values) * 100, 2) if values else 0


def _summary(rows: list[dict]) -> dict:
    completed = [row for row in rows if row.get("status") == "completed"]
    tracking = [row for row in rows if row.get("status") == "tracking"]
    by_day = {}
    for day in (1, 3, 5, 7):
        values = [row.get(f"return_rate_day{day}", 0) for row in rows if row.get(f"price_day{day}", 0) > 0]
        by_day[f"avg_return_day{day}"] = _avg(values)
        by_day[f"win_rate_day{day}"] = _win_rate(values)
    final_returns = [row.get("final_return_rate", 0) for row in completed]
    return {
        "total_recommendations": len(rows),
        "completed_count": len(completed),
        "tracking_count": len(tracking),
        "win_rate": _win_rate(final_returns),
        "avg_return": _avg(final_returns),
        "max_gain": max([row.get("max_gain", 0) for row in rows], default=0),
        "max_drawdown": min([row.get("max_drawdown", 0) for row in rows], default=0),
        **by_day,
    }


@router.get("/history")
def review_history(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    result = get_all_recommendations(db)
    rows = _filter_history(result.get("data", []), start_date, end_date, status)
    return {"success": True, "data": rows, "summary": _summary(rows)}


@router.get("/summary")
async def review_summary(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    if not start_date and not end_date:
        stats = await get_recommend_stats(db)
        return stats
    rows = _filter_history(get_all_recommendations(db).get("data", []), start_date, end_date, None)
    return {"success": True, "data": _summary(rows)}


@router.post("/update-prices")
@limiter.limit("10/minute")
async def review_update_prices(request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return await update_recommend_prices(db)


@router.post("/batch/update")
@limiter.limit("10/minute")
async def review_batch_update(request: Request, ids: list[int] = Body(...), db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return batch_update_tracking_prices(db, ids)


@router.post("/batch/reset")
@limiter.limit("10/minute")
async def review_batch_reset(request: Request, ids: list[int] = Body(...), db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return batch_reset_tracking(db, ids)


@router.post("/batch/delete")
@limiter.limit("10/minute")
async def review_batch_delete(request: Request, ids: list[int] = Body(...), db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return batch_delete_recommendations(db, ids)


@router.post("/item/{rec_id}/reset")
def review_reset_item(rec_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return reset_recommend_tracking(db, rec_id)


@router.delete("/item/{rec_id}")
def review_delete_item(rec_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return delete_recommendation(db, rec_id)
