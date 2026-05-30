"""定时任务配置 API"""
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.dependencies import get_current_user, require_admin
from app.models.user import User
from app.models import ScheduleConfig, MarketReport, Recommendation

router = APIRouter(prefix="/api/schedule", tags=["schedule"], dependencies=[Depends(get_current_user)])


def get_or_create_config(db: Session) -> ScheduleConfig:
    config = db.query(ScheduleConfig).first()
    if not config:
        config = ScheduleConfig(
            enabled=False,
            run_time="16:00",
            run_report=True,
            run_recommend=True,
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.get("/config")
async def get_config(db: Session = Depends(get_db)):
    """获取定时任务配置"""
    config = get_or_create_config(db)

    # 计算距离上次运行的时间
    last_run_info = None
    if config.last_run_at:
        try:
            last_dt = datetime.strptime(config.last_run_at, "%Y-%m-%d %H:%M:%S")
            diff = datetime.now() - last_dt
            hours, remainder = divmod(int(diff.total_seconds()), 3600)
            minutes = remainder // 60
            if hours > 0:
                last_run_info = f"{hours}小时{minutes}分钟前"
            else:
                last_run_info = f"{minutes}分钟前"
        except Exception:
            pass

    return {
        "success": True,
        "data": {
            "enabled": config.enabled,
            "run_time": config.run_time,
            "run_report": config.run_report,
            "run_recommend": config.run_recommend,
            "last_run_at": config.last_run_at,
            "last_run_result": config.last_run_result,
            "last_run_info": last_run_info,
        },
    }


@router.post("/config")
async def save_config(
    enabled: bool = False,
    run_time: str = "16:00",
    run_report: bool = True,
    run_recommend: bool = True,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """保存定时任务配置"""
    if not (0 <= int(run_time.split(":")[0]) <= 23 and 0 <= int(run_time.split(":")[1]) <= 59):
        raise HTTPException(status_code=400, detail="时间格式错误，请使用 HH:MM 格式")

    config = get_or_create_config(db)
    config.enabled = enabled
    config.run_time = run_time
    config.run_report = run_report
    config.run_recommend = run_recommend
    db.commit()

    # 联动 datasource 调度器，动态更新 APScheduler
    from app.datasource.scheduler import update_schedule
    update_schedule(enabled, run_time)

    return {"success": True, "data": {"message": "定时任务配置已保存"}}


def run_scheduled_tasks():
    """定时任务执行逻辑（由 scheduler 调用）"""
    db = SessionLocal()
    try:
        config = db.query(ScheduleConfig).first()
        if not config or not config.enabled:
            return

        today = date.today()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        results = []

        if config.run_report:
            existing = db.query(MarketReport).filter(
                MarketReport.report_date == today
            ).first()
            if existing and existing.ai_report:
                results.append("报告已存在，跳过")
            else:
                from app.services.report_service import generate_daily_report
                import asyncio
                result = asyncio.run(generate_daily_report(db, report_date=today))
                results.append(f"报告: {'成功' if result['success'] else '失败'}")

        if config.run_recommend:
            existing = db.query(Recommendation).filter(
                Recommendation.recommend_date == today
            ).first()
            if existing:
                results.append("推荐已存在，跳过")
            else:
                from app.services.recommend_service import generate_recommendations
                import asyncio
                result = asyncio.run(generate_recommendations(db, rec_date=today))
                results.append(f"推荐: {'成功' if result['success'] else '失败'}")

        config.last_run_at = now
        config.last_run_result = " | ".join(results)
        db.commit()

    except Exception as e:
        config = db.query(ScheduleConfig).first()
        if config:
            config.last_run_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            config.last_run_result = f"错误: {str(e)}"
            db.commit()
    finally:
        db.close()
