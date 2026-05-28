import os
from dotenv import load_dotenv
from functools import lru_cache

load_dotenv(override=True)


class Settings:
    # 服务器配置
    QUANTFORGE_PORT: int = int(os.getenv("QUANTFORGE_PORT", "8084"))

    # JWT 密钥
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "quantforge-dev-secret-key-change-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 7

    # 数据库配置
    QUANTFORGE_DB_HOST: str = os.getenv("QUANTFORGE_DB_HOST", "localhost")
    QUANTFORGE_DB_PORT: int = int(os.getenv("QUANTFORGE_DB_PORT", "3306"))
    QUANTFORGE_DB_USER: str = os.getenv("QUANTFORGE_DB_USER", "root")
    QUANTFORGE_DB_PASSWORD: str = os.getenv("QUANTFORGE_DB_PASSWORD", "")
    QUANTFORGE_DB_NAME: str = os.getenv("QUANTFORGE_DB_NAME", "quantforge")

    # AI API 配置
    ANTHROPIC_AUTH_TOKEN: str = os.getenv("ANTHROPIC_AUTH_TOKEN", "")
    ANTHROPIC_BASE_URL: str = os.getenv("ANTHROPIC_BASE_URL", "https://api.minimaxi.com/anthropic")
    ANTHROPIC_MODEL: str = os.getenv("ANTHROPIC_MODEL", "MiniMax-M2.7-highspeed")

    @property
    def database_url(self) -> str:
        return (
            f"mysql+pymysql://{self.QUANTFORGE_DB_USER}:{self.QUANTFORGE_DB_PASSWORD}"
            f"@{self.QUANTFORGE_DB_HOST}:{self.QUANTFORGE_DB_PORT}/{self.QUANTFORGE_DB_NAME}"
        )


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
