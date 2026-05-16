from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import stock, recommend, report
from app.database import engine, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="QuantForge API", version="1.0.0")

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
