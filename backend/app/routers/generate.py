"""Async generation task APIs."""

import asyncio
import json
import threading
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.dependencies import get_current_user, require_admin
from app.models import GenerationTask, MarketReport, Recommendation
from app.models.user import User
from app.services.recommend_service import generate_recommendations, update_recommend_prices
from app.services.report_service import generate_daily_report


router = APIRouter(prefix="/api/generate", tags=["generate"], dependencies=[Depends(get_current_user)])


def _update_task(task_id: int, **kwargs):
    db = SessionLocal()
    try:
        task = db.query(GenerationTask).filter(GenerationTask.id == task_id).first()
        if task:
            for key, value in kwargs.items():
                setattr(task, key, value)
            task.updated_at = datetime.now()
            db.commit()
    finally:
        db.close()


async def _run_report(task_id: int, target_date: date):
    try:
        async def on_progress(step: int, total: int, label: str, pct: int):
            _update_task(
                task_id,
                status="running",
                current_step=step,
                total_steps=total,
                step_label=label,
                progress_pct=pct,
            )

        _update_task(task_id, status="running", current_step=1, total_steps=5, step_label="reading market data", progress_pct=5)
        db = SessionLocal()
        try:
            result = await generate_daily_report(db, report_date=target_date, on_progress=on_progress)
        finally:
            db.close()

        if not result["success"]:
            _update_task(task_id, status="failed", error_message=result.get("error", "report generation failed"), progress_pct=100)
            return

        _update_task(
            task_id,
            current_step=5,
            step_label="report generated",
            progress_pct=100,
            result=json.dumps({"date": str(target_date)}, ensure_ascii=False),
            status="completed",
        )
    except Exception as exc:
        _update_task(task_id, status="failed", error_message=str(exc), progress_pct=100)


async def _run_recommend(task_id: int, target_date: date):
    try:
        _update_task(
            task_id,
            status="running",
            current_step=1,
            total_steps=3,
            step_label="reading normalized DB snapshots",
            progress_pct=20,
        )
        db = SessionLocal()
        try:
            result = await generate_recommendations(db, rec_date=target_date)
            recs = (
                db.query(Recommendation)
                .filter(Recommendation.recommend_date == target_date)
                .order_by(Recommendation.rec_rank.asc(), Recommendation.id.asc())
                .all()
            )
        finally:
            db.close()

        if not result["success"]:
            _update_task(task_id, status="failed", error_message=result.get("error", "recommendation generation failed"), progress_pct=100)
            return

        _update_task(
            task_id,
            status="completed",
            current_step=3,
            step_label="recommendations generated from DB snapshots",
            candidate_stocks=json.dumps([
                {
                    "code": r.stock_code,
                    "name": r.stock_name,
                    "price": float(r.recommend_price) if r.recommend_price else 0,
                    "rank": r.rec_rank or 0,
                    "score": float(r.score) if r.score is not None else 0,
                    "reason": r.reason or "",
                }
                for r in recs
            ], ensure_ascii=False),
            result=json.dumps({"date": str(target_date), **result.get("data", {})}, ensure_ascii=False),
            progress_pct=100,
        )
    except Exception as exc:
        _update_task(task_id, status="failed", error_message=str(exc), progress_pct=100)


@router.post("/report")
async def start_report(
    report_date: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    target_date = report_date or date.today()
    existing = db.query(MarketReport).filter(MarketReport.report_date == target_date).first()
    if existing and existing.ai_report:
        return {"success": True, "data": {"task_id": None, "message": f"{target_date} report already exists"}}

    task = GenerationTask(task_type="report", target_date=target_date, status="pending", total_steps=5)
    db.add(task)
    db.commit()
    db.refresh(task)
    threading.Thread(target=lambda: asyncio.run(_run_report(task.id, target_date)), daemon=True).start()
    return {"success": True, "data": {"task_id": task.id}}


@router.post("/recommend")
async def start_recommend(
    rec_date: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    target_date = rec_date or date.today()
    existing = db.query(Recommendation).filter(Recommendation.recommend_date == target_date).first()
    if existing:
        return {"success": True, "data": {"task_id": None, "message": f"{target_date} recommendations already exist"}}

    task = GenerationTask(task_type="recommend", target_date=target_date, status="pending", total_steps=3)
    db.add(task)
    db.commit()
    db.refresh(task)
    threading.Thread(target=lambda: asyncio.run(_run_recommend(task.id, target_date)), daemon=True).start()
    return {"success": True, "data": {"task_id": task.id}}


async def _run_all(task_id: int, target_date: date):
    db = SessionLocal()
    try:
        _update_task(task_id, status="running", current_step=1, total_steps=3, step_label="generating report", progress_pct=10)

        async def on_progress(step, total, label, pct):
            _update_task(task_id, status="running", current_step=1, total_steps=3, step_label=f"report: {label}", progress_pct=max(10, pct // 3))

        report = await generate_daily_report(db, report_date=target_date, on_progress=on_progress)
        if not report["success"]:
            _update_task(task_id, status="failed", error_message=f"report failed: {report.get('error')}", progress_pct=100)
            return

        _update_task(task_id, current_step=2, step_label="generating DB-only recommendations", progress_pct=45)
        rec = await generate_recommendations(db, rec_date=target_date)
        if not rec["success"]:
            _update_task(task_id, status="failed", error_message=f"recommendation failed: {rec.get('error')}", progress_pct=100)
            return

        _update_task(task_id, current_step=3, step_label="updating DB-only tracking prices", progress_pct=80)
        await update_recommend_prices(db)

        _update_task(task_id, current_step=3, status="completed", step_label="all tasks completed", progress_pct=100)
    except Exception as exc:
        _update_task(task_id, status="failed", error_message=str(exc), progress_pct=100)
    finally:
        db.close()


@router.post("/all")
async def start_all(
    report_date: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    target_date = report_date or date.today()
    task = GenerationTask(task_type="all", target_date=target_date, status="pending", total_steps=3)
    db.add(task)
    db.commit()
    db.refresh(task)
    threading.Thread(target=lambda: asyncio.run(_run_all(task.id, target_date)), daemon=True).start()
    return {"success": True, "data": {"task_id": task.id}}


@router.get("/task/{task_id}")
async def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(GenerationTask).filter(GenerationTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="task not found")

    candidates = []
    if task.candidate_stocks:
        try:
            candidates = json.loads(task.candidate_stocks)
        except json.JSONDecodeError:
            pass

    result = None
    if task.result:
        try:
            result = json.loads(task.result)
        except json.JSONDecodeError:
            pass

    return {
        "success": True,
        "data": {
            "id": task.id,
            "task_type": task.task_type,
            "target_date": str(task.target_date),
            "status": task.status,
            "current_step": task.current_step,
            "total_steps": task.total_steps,
            "step_label": task.step_label or "",
            "progress_pct": task.progress_pct,
            "candidate_stocks": candidates,
            "result": result,
            "error_message": task.error_message,
            "created_at": str(task.created_at),
            "updated_at": str(task.updated_at),
        },
    }


@router.delete("/report")
async def delete_report(
    report_date: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    target = report_date or date.today()
    deleted = db.query(MarketReport).filter(MarketReport.report_date == target).delete()
    db.commit()
    return {"success": True, "data": {"date": str(target), "deleted": deleted}}


@router.delete("/recommend")
async def delete_recommendations(
    rec_date: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    target = rec_date or date.today()
    deleted = db.query(Recommendation).filter(Recommendation.recommend_date == target).delete()
    db.commit()
    return {"success": True, "data": {"date": str(target), "deleted": deleted}}
