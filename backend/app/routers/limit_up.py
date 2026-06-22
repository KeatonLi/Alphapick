from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.limit_up_service import get_limit_up_dates, get_limit_up_overview

router = APIRouter(prefix="/api/limit-up", tags=["limit-up"], dependencies=[Depends(get_current_user)])


@router.get("")
def limit_up_overview(
    target_date: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return get_limit_up_overview(db, target_date)


@router.get("/dates")
def limit_up_dates(
    days: int = Query(60, ge=1, le=365),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return get_limit_up_dates(db, days)
