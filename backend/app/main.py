from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.routers import stock, recommend, report
from app.database import engine, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="QuantForge API", version="1.0.0")

# Rate limiter - 限制每个IP的请求频率
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


@app.get("/api/health")
async def health():
    return {"status": "ok"}
