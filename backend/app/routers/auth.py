from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ─── Pydantic 模型 ──────────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class UserInfo(BaseModel):
    id: int
    username: str
    role: str
    created_at: str

    @classmethod
    def from_orm(cls, user: User) -> "UserInfo":
        return cls(
            id=user.id,
            username=user.username,
            role=user.role,
            created_at=user.created_at.strftime("%Y-%m-%d %H:%M:%S") if user.created_at else "",
        )


# ─── 工具函数 ──────────────────────────────────────────────────────────────


def create_access_token(user: User) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.JWT_EXPIRE_DAYS)
    payload = {
        "user_id": user.id,
        "username": user.username,
        "role": user.role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


# ─── API 端点 ──────────────────────────────────────────────────────────────


@router.post("/register")
async def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """注册新用户"""
    if len(body.username) < 2 or len(body.username) > 50:
        raise HTTPException(status_code=400, detail="用户名长度需在 2-50 字符之间")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="密码长度至少 6 位")

    existing = db.query(User).filter(User.username == body.username).first()
    if existing:
        raise HTTPException(status_code=409, detail="用户名已存在")

    user = User(
        username=body.username,
        password_hash=pwd_context.hash(body.password),
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user)
    return {
        "success": True,
        "data": {
            "token": token,
            "user": UserInfo.from_orm(user).model_dump(),
        },
    }


@router.post("/login")
async def login(body: LoginRequest, db: Session = Depends(get_db)):
    """用户登录"""
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not pwd_context.verify(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    token = create_access_token(user)
    return {
        "success": True,
        "data": {
            "token": token,
            "user": UserInfo.from_orm(user).model_dump(),
        },
    }


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """获取当前登录用户信息"""
    return {
        "success": True,
        "data": UserInfo.from_orm(current_user).model_dump(),
    }


@router.put("/role/{user_id}")
async def update_role(
    user_id: int,
    role: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """管理员修改用户角色"""
    if role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="角色只能是 admin 或 user")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    user.role = role
    db.commit()
    return {"success": True, "data": {"message": f"用户 {user.username} 角色已更新为 {role}"}}


@router.get("/users")
async def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """管理员查看所有用户"""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return {
        "success": True,
        "data": [UserInfo.from_orm(u).model_dump() for u in users],
    }
