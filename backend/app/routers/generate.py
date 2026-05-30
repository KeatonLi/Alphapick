"""生成任务 API：异步启动报告/推荐生成，支持前端轮询进度"""
import asyncio
import json
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.dependencies import get_current_user, require_admin
from app.models.user import User
from app.models import GenerationTask, MarketReport, Recommendation
from app.services.report_service import generate_daily_report
from app.services.recommend_service import generate_recommendations, update_recommend_prices
from app.services.candidate_service import get_ma_filtered_candidates, format_candidates_for_ai
from app.utils.ai_client import chat
from app.prompts import RECOMMEND_SYSTEM_PROMPT, RECOMMEND_OUTPUT_FORMAT

router = APIRouter(prefix="/api/generate", tags=["generate"], dependencies=[Depends(get_current_user)])


def _update_task(task_id: int, **kwargs):
    """同步更新任务状态"""
    db = SessionLocal()
    try:
        task = db.query(GenerationTask).filter(GenerationTask.id == task_id).first()
        if task:
            for k, v in kwargs.items():
                setattr(task, k, v)
            task.updated_at = datetime.now()
            db.commit()
    finally:
        db.close()


async def _run_report(task_id: int, target_date: date):
    """后台执行报告生成"""
    try:
        async def on_progress(step: int, total: int, label: str, pct: int):
            _update_task(task_id, status="running", current_step=step, total_steps=total,
                         step_label=label, progress_pct=pct)

        _update_task(task_id, status="running", current_step=1, total_steps=5,
                     step_label="正在读取市场数据...", progress_pct=5)

        db = SessionLocal()
        try:
            result = await generate_daily_report(db, report_date=target_date, on_progress=on_progress)
        finally:
            db.close()

        if not result["success"]:
            _update_task(task_id, status="failed", error_message=result.get("error", "生成失败"),
                         progress_pct=100)
            return

        _update_task(task_id, current_step=5, step_label="报告生成完成 ✅", progress_pct=100,
                     result=json.dumps({"date": str(target_date)}, ensure_ascii=False),
                     status="completed")
    except Exception as e:
        _update_task(task_id, status="failed", error_message=str(e), progress_pct=100)


async def _run_recommend(task_id: int, target_date: date):
    """后台执行推荐生成"""
    try:
        # Step 1: THS 池 ∩ 热度排名 → 主板候选 → 消息面
        _update_task(task_id, status="running", current_step=1, total_steps=3,
                     step_label="正在获取 THS 选股池 + 东方财富热度排名...", progress_pct=10)
        candidate_result = await get_ma_filtered_candidates(top_n=50)
        if not candidate_result["success"]:
            _update_task(task_id, status="failed",
                         error_message=f"候选池筛选失败: {candidate_result['error']}", progress_pct=100)
            return

        candidates = candidate_result.get("data", [])
        _update_task(task_id, step_label=f"THS池{candidate_result['total_ths']}只 ∩ 热度前{candidate_result['hot_top_n']} → {len(candidates)}只主板候选（含消息面）",
                     candidate_stocks=json.dumps([
                         {"code": s["code"], "name": s["name"], "price": s["price"],
                          "change_pct": s["change_pct"], "turnover": s.get("turnover", 0),
                          "continuous_days": s.get("continuous_days", 0), "sector": s.get("sector", ""),
                          "hot_rank": s.get("hot_rank"), "news": s.get("news", [])}
                         for s in candidates
                     ], ensure_ascii=False),
                     progress_pct=40)

        if not candidates:
            _update_task(task_id, status="completed",
                         step_label="无候选股票，跳过推荐",
                         result=json.dumps({"date": str(target_date), "count": 0, "total_candidates": 0}, ensure_ascii=False),
                         progress_pct=100)
            return

        # Step 2: AI 精选
        _update_task(task_id, current_step=2,
                     step_label="AI 正在从候选池中精选 5 只...", progress_pct=65)
        user_message = f"""候选股票数据：

{format_candidates_for_ai(candidates)}

{RECOMMEND_OUTPUT_FORMAT}"""
        ai_response = await chat([
            {"role": "system", "content": RECOMMEND_SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ])

        try:
            recommendations = json.loads(
                ai_response.strip().lstrip("```json").rstrip("```").strip()
            )
        except json.JSONDecodeError:
            _update_task(task_id, status="failed", error_message="AI 返回格式解析失败", progress_pct=100)
            return

        _update_task(task_id, step_label=f"AI 精选完成，{len(recommendations)} 只股票",
                     progress_pct=80)

        # 保存到数据库
        db = SessionLocal()
        try:
            for rec in recommendations:
                db_rec = Recommendation(
                    recommend_date=target_date,
                    stock_code=rec["code"],
                    stock_name=rec["name"],
                    recommend_price=rec["price"],
                    reason=rec.get("reason", ""),
                )
                db.add(db_rec)
            db.commit()
        finally:
            db.close()

        # Step 3: 完成
        _update_task(task_id, current_step=3, status="completed",
                     step_label=f"推荐生成完成 ✅ 共 {len(recommendations)} 只",
                     result=json.dumps({
                         "date": str(target_date),
                         "count": len(recommendations),
                         "total_candidates": len(candidates),
                     }, ensure_ascii=False),
                     progress_pct=100)
    except Exception as e:
        _update_task(task_id, status="failed", error_message=str(e), progress_pct=100)


@router.post("/report")
async def start_report(
    report_date: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """异步启动报告生成，返回 task_id"""
    target_date = report_date or date.today()

    # 检查是否已存在
    existing = db.query(MarketReport).filter(
        MarketReport.report_date == target_date
    ).first()
    if existing and existing.ai_report:
        return {"success": True, "data": {"task_id": None, "message": f"{target_date} 报告已存在，跳过生成"}}

    # 创建任务记录
    task = GenerationTask(
        task_type="report",
        target_date=target_date,
        status="pending",
        total_steps=4,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    # 后台执行（新线程，避免阻塞主事件循环）
    import threading
    threading.Thread(target=lambda: asyncio.run(_run_report(task.id, target_date)),
                     daemon=True).start()

    return {"success": True, "data": {"task_id": task.id}}


@router.post("/recommend")
async def start_recommend(
    rec_date: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """异步启动推荐生成，返回 task_id"""
    target_date = rec_date or date.today()

    # 检查是否已存在
    existing = db.query(Recommendation).filter(
        Recommendation.recommend_date == target_date
    ).first()
    if existing:
        return {"success": True, "data": {"task_id": None, "message": f"{target_date} 推荐已存在，跳过生成"}}

    # 创建任务记录
    task = GenerationTask(
        task_type="recommend",
        target_date=target_date,
        status="pending",
        total_steps=4,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    # 后台执行（新线程）
    import threading
    threading.Thread(target=lambda: asyncio.run(_run_recommend(task.id, target_date)),
                     daemon=True).start()

    return {"success": True, "data": {"task_id": task.id}}


async def _run_all(task_id: int, target_date: date):
    """后台执行全部生成：报告 → 推荐 → 更新现价"""
    db = SessionLocal()
    try:
        _update_task(task_id, status="running", current_step=1, total_steps=3,
                     step_label="正在生成市场报告...", progress_pct=10)
        async def on_progress(step, total, label, pct):
            _update_task(task_id, status="running", current_step=1, total_steps=3,
                         step_label=f"报告: {label}", progress_pct=max(10, pct // 3))
        result = await generate_daily_report(db, report_date=target_date, on_progress=on_progress)
        if not result["success"]:
            _update_task(task_id, status="failed", error_message=f"报告生成失败: {result.get('error')}", progress_pct=100)
            return

        _update_task(task_id, current_step=2, step_label="正在生成量化推荐...", progress_pct=40)
        rec_result = await generate_recommendations(db, rec_date=target_date)
        if not rec_result["success"]:
            _update_task(task_id, status="failed", error_message=f"推荐生成失败: {rec_result.get('error')}", progress_pct=100)
            return

        _update_task(task_id, current_step=3, step_label="正在更新现价...", progress_pct=75)
        await update_recommend_prices(db)

        _update_task(task_id, current_step=3, status="completed",
                     step_label="全部生成完成 ✅",
                     progress_pct=100)
    except Exception as e:
        _update_task(task_id, status="failed", error_message=str(e), progress_pct=100)
    finally:
        db.close()


@router.post("/all")
async def start_all(
    report_date: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """异步启动全部生成：报告 + 推荐 + 更新现价"""
    target_date = report_date or date.today()

    task = GenerationTask(
        task_type="all",
        target_date=target_date,
        status="pending",
        total_steps=3,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    import threading
    threading.Thread(target=lambda: asyncio.run(_run_all(task.id, target_date)),
                     daemon=True).start()

    return {"success": True, "data": {"task_id": task.id}}


@router.get("/task/{task_id}")
async def get_task(task_id: int, db: Session = Depends(get_db)):
    """获取任务状态（供前端轮询）"""
    task = db.query(GenerationTask).filter(GenerationTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    # 解析候选股票
    candidates = []
    if task.candidate_stocks:
        try:
            candidates = json.loads(task.candidate_stocks)
        except json.JSONDecodeError:
            pass

    result_data = None
    if task.result:
        try:
            result_data = json.loads(task.result)
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
            "result": result_data,
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
    """删除指定日期的市场报告（可重新生成）"""
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
    """删除指定日期的量化推荐（可重新生成）"""
    target = rec_date or date.today()
    deleted = db.query(Recommendation).filter(Recommendation.recommend_date == target).delete()
    db.commit()
    return {"success": True, "data": {"date": str(target), "deleted": deleted}}
