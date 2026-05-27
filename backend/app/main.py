import threading
import time
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.routers import stock, recommend, report, mood, generate, schedule, analysis
from app.database import engine, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="QuantForge API", version="1.0.0")

# Rate limiter
limiter = Limiter(key_func=get_remote_address, default_limits=["30/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stock.router)
app.include_router(recommend.router)
app.include_router(report.router)
app.include_router(mood.router)
app.include_router(generate.router)
app.include_router(schedule.router)
app.include_router(analysis.router)


# ─── 定时任务调度器 ──────────────────────────────────────────────────────

def scheduler_loop():
    """每分钟检查是否需要执行定时任务"""
    last_run_date = None
    while True:
        try:
            now = datetime.now()
            from app.routers.schedule import get_or_create_config, run_scheduled_tasks
            from app.database import SessionLocal

            db = SessionLocal()
            try:
                config = get_or_create_config(db)
                if config.enabled:
                    target = f"{now.hour:02d}:{now.minute:02d}"
                    # 每分钟的第 0 秒检查，且今天还没运行过
                    if target == config.run_time and now.second < 5 and last_run_date != now.date():
                        last_run_date = now.date()
                        db.close()
                        run_scheduled_tasks()
                        db = SessionLocal()
            finally:
                db.close()
        except Exception:
            pass
        time.sleep(30)  # 每 30 秒检查一次


@app.on_event("startup")
async def start_scheduler():
    thread = threading.Thread(target=scheduler_loop, daemon=True)
    thread.start()


@app.get("/api/health")
async def health():
    return {"status": "ok"}
