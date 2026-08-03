"""智能股票分析 API：创建分析、历史列表、单条详情。"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.services.analyze_service import (
    analyze_stock,
    get_analysis_detail,
    get_analyses,
)


router = APIRouter(
    prefix="/api/analyze",
    tags=["analyze"],
    dependencies=[Depends(get_current_user)],
)
limiter = Limiter(key_func=get_remote_address)


class AnalyzeRequest(BaseModel):
    query: str


@router.post("")
@limiter.limit("10/minute")
async def create_analysis(request: Request, payload: AnalyzeRequest, db: Session = Depends(get_db)):
    """输入代码或名称，生成智能分析报告并入库。"""
    result = await analyze_stock(db, payload.query)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("")
def analyze_list(limit: int = 20, db: Session = Depends(get_db)):
    """历史分析列表（按时间倒序）。"""
    limit = max(1, min(limit, 100))
    return get_analyses(db, limit=limit)


@router.get("/{analysis_id}")
def analyze_detail(analysis_id: int, db: Session = Depends(get_db)):
    """单条分析完整报告。"""
    result = get_analysis_detail(db, analysis_id)
    if result is None:
        raise HTTPException(status_code=404, detail="analysis not found")
    return result
