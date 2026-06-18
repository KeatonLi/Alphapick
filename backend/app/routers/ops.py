from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.datasource.router import trigger_all
from app.models.user import User
from app.routers.generate import get_task, start_all, start_recommend
from app.routers.schedule import get_config, save_config
from app.services.recommend_service import generate_recommendations, update_recommend_prices

router = APIRouter(prefix="/api/ops", tags=["ops"], dependencies=[Depends(require_admin)])


def _fetch_has_failures(fetch_result: dict) -> bool:
    if not fetch_result.get("success", False):
        return True
    data = fetch_result.get("data") or {}
    failed = data.get("failed", 0)
    return bool(failed)


@router.post("/run-daily")
async def ops_run_daily(target_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    target = target_date or date.today()
    fetch_result = trigger_all(target, db)
    if _fetch_has_failures(fetch_result):
        return {"success": False, "error": "data fetch failed", "data": {"date": str(target), "fetch": fetch_result.get("data")}}
    task_result = await start_all(target, db, admin)
    return {"success": True, "data": {"date": str(target), "fetch": fetch_result.get("data"), "generation": task_result.get("data")}}


@router.post("/backtest")
async def ops_backtest(start_date: date = Query(...), end_date: date = Query(...), db: Session = Depends(get_db)):
    if start_date > end_date:
        return {"success": False, "error": "start_date must be before end_date"}

    from datetime import timedelta

    current = start_date
    results = []
    while current <= end_date:
        if current.weekday() < 5:
            fetch_result = trigger_all(current, db)
            fetch_data = fetch_result.get("data", {})
            if _fetch_has_failures(fetch_result):
                results.append({
                    "date": str(current),
                    "fetch_success": fetch_data.get("success", 0),
                    "fetch_total": fetch_data.get("total", 0),
                    "recommend_success": False,
                    "recommend_message": "skipped: data fetch failed",
                    "recommend_data": {},
                })
                current += timedelta(days=1)
                continue
            rec_result = await generate_recommendations(db, current)
            results.append({
                "date": str(current),
                "fetch_success": fetch_data.get("success", 0),
                "fetch_total": fetch_data.get("total", 0),
                "recommend_success": rec_result.get("success", False),
                "recommend_message": rec_result.get("message", ""),
                "recommend_data": rec_result.get("data", {}),
            })
        current += timedelta(days=1)

    tracking = await update_recommend_prices(db)
    return {
        "success": True,
        "data": {
            "start_date": str(start_date),
            "end_date": str(end_date),
            "days": len(results),
            "results": results,
            "tracking": tracking.get("data", {}),
        },
    }


@router.post("/fetch")
def ops_fetch(target_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db)):
    return trigger_all(target_date, db)


@router.post("/generate-picks")
async def ops_generate_picks(target_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return await start_recommend(target_date, db, admin)


@router.post("/update-returns")
async def ops_update_returns(db: Session = Depends(get_db)):
    return await update_recommend_prices(db)


@router.get("/task/{task_id}")
async def ops_task(task_id: int, db: Session = Depends(get_db)):
    return await get_task(task_id, db)


@router.get("/schedule")
async def ops_schedule(db: Session = Depends(get_db)):
    return await get_config(db)


@router.post("/schedule")
async def ops_save_schedule(
    request: Request,
    enabled: bool = Query(False),
    run_time: str = Query("16:00"),
    run_report: bool = Query(True),
    run_recommend: bool = Query(True),
    run_update_returns: bool = Query(True),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return await save_config(enabled, run_time, run_report, run_recommend, run_update_returns, db, admin)
