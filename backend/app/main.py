from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.routers import stock, recommend, report, generate, schedule, analysis, auth
from app.datasource.router import router as datasource_router
from app.database import engine, Base, SessionLocal

Base.metadata.create_all(bind=engine)

# 初始化默认 admin 账户
from app.models.user import User
from passlib.context import CryptContext

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _seed_admin():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                password_hash=_pwd_context.hash("admin123"),
                role="admin",
            )
            db.add(admin)
            db.commit()
            print("[seed] 默认管理员账户已创建 (admin / admin123)")
        else:
            print("[seed] 管理员账户已存在")
    finally:
        db.close()


_seed_admin()

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

app.include_router(auth.router)
app.include_router(stock.router)
app.include_router(recommend.router)
app.include_router(report.router)
app.include_router(generate.router)
app.include_router(schedule.router)
app.include_router(analysis.router)
app.include_router(datasource_router)


@app.on_event("startup")
async def startup_event():
    from app.datasource.scheduler import start_scheduler
    start_scheduler()


@app.on_event("shutdown")
async def shutdown_event():
    from app.datasource.scheduler import stop_scheduler
    stop_scheduler()


@app.get("/api/health")
async def health():
    return {"status": "ok"}
