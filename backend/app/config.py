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
    LLM_AUTH_TOKEN: str = os.getenv("LLM_AUTH_TOKEN", "")
    LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "https://api.deepseek.com")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "DeepSeek-V4-Flash")

    @property
    def database_url(self) -> str:
        env_url = os.getenv("DATABASE_URL", "")
        if env_url:
            return env_url
        return (
            f"mysql+pymysql://{self.QUANTFORGE_DB_USER}:{self.QUANTFORGE_DB_PASSWORD}"
            f"@{self.QUANTFORGE_DB_HOST}:{self.QUANTFORGE_DB_PORT}/{self.QUANTFORGE_DB_NAME}"
        )


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
