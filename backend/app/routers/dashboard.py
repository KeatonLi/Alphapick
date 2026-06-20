from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.services.dashboard_service import build_dashboard_async


router = APIRouter(prefix="/api/dashboard", tags=["dashboard"], dependencies=[Depends(get_current_user)])


@router.get("")
async def dashboard(db: Session = Depends(get_db)):
    return await build_dashboard_async(db)
