import os
from dotenv import load_dotenv
from functools import lru_cache

load_dotenv(override=True)


def _env(name: str, fallback_name: str = "", default: str = "") -> str:
    """读取环境变量：优先新名，回退旧名（兼容改名前的配置）。"""
    value = os.getenv(name)
    if value:
        return value
    if fallback_name:
        value = os.getenv(fallback_name)
        if value:
            return value
    return default


class Settings:
    # 服务器配置
    ALPHAPICK_PORT: int = int(_env("ALPHAPICK_PORT", "QUANTFORGE_PORT", "8084"))

    # JWT 密钥
    JWT_SECRET_KEY: str = _env("JWT_SECRET_KEY", "", "alphapick-dev-secret-key-change-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 7

    # 数据库配置
    ALPHAPICK_DB_HOST: str = _env("ALPHAPICK_DB_HOST", "QUANTFORGE_DB_HOST", "localhost")
    ALPHAPICK_DB_PORT: int = int(_env("ALPHAPICK_DB_PORT", "QUANTFORGE_DB_PORT", "3306"))
    ALPHAPICK_DB_USER: str = _env("ALPHAPICK_DB_USER", "QUANTFORGE_DB_USER", "root")
    ALPHAPICK_DB_PASSWORD: str = _env("ALPHAPICK_DB_PASSWORD", "QUANTFORGE_DB_PASSWORD", "")
    ALPHAPICK_DB_NAME: str = _env("ALPHAPICK_DB_NAME", "QUANTFORGE_DB_NAME", "alphapick")

    # AI API 配置（OpenAI 兼容协议；兼容旧 ANTHROPIC_*/DEEPSEEK_* 变量名）
    LLM_AUTH_TOKEN: str = (
        os.getenv("LLM_AUTH_TOKEN")
        or os.getenv("DEEPSEEK_API_KEY", "")
        or os.getenv("ANTHROPIC_AUTH_TOKEN", "")
    )
    LLM_BASE_URL: str = (
        os.getenv("LLM_BASE_URL")
        or os.getenv("DEEPSEEK_BASE_URL", "")
        or os.getenv("ANTHROPIC_BASE_URL", "")
    )
    LLM_MODEL: str = (
        os.getenv("LLM_MODEL")
        or os.getenv("DEEPSEEK_MODEL", "")
        or os.getenv("ANTHROPIC_MODEL", "")
    )

    @property
    def database_url(self) -> str:
        env_url = os.getenv("DATABASE_URL", "")
        if env_url:
            return env_url
        return (
            f"mysql+pymysql://{self.ALPHAPICK_DB_USER}:{self.ALPHAPICK_DB_PASSWORD}"
            f"@{self.ALPHAPICK_DB_HOST}:{self.ALPHAPICK_DB_PORT}/{self.ALPHAPICK_DB_NAME}"
            f"?charset=utf8mb4"
        )


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
