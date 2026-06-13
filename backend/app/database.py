from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import settings

engine = create_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)


def ensure_runtime_schema():
    """Add lightweight backward-compatible columns for existing installs."""
    inspector = inspect(engine)
    if "recommendations" not in inspector.get_table_names():
        return

    existing = {col["name"] for col in inspector.get_columns("recommendations")}
    columns = {
        "rec_rank": "INT NULL COMMENT '策略排名'",
        "score": "DECIMAL(10,4) NULL COMMENT '量化综合分'",
        "strategy_version": "VARCHAR(50) NULL COMMENT '策略版本'",
        "factor_snapshot": "TEXT NULL COMMENT '因子快照 JSON'",
        "price_day5": "DECIMAL(10,3) NULL COMMENT '持股第五天价格'",
        "price_day7": "DECIMAL(10,3) NULL COMMENT '持股第七天价格'",
        "return_rate_day5": "DECIMAL(10,4) NULL COMMENT '第五天收益率'",
        "return_rate_day7": "DECIMAL(10,4) NULL COMMENT '第七天收益率'",
    }

    missing = [(name, ddl) for name, ddl in columns.items() if name not in existing]
    if not missing:
        return

    dialect = engine.dialect.name
    with engine.begin() as conn:
        for name, ddl in missing:
            if dialect == "mysql":
                conn.execute(text(f"ALTER TABLE recommendations ADD COLUMN {name} {ddl}"))
            else:
                fallback_type = "TEXT" if "TEXT" in ddl or "VARCHAR" in ddl else "NUMERIC"
                if name == "rec_rank":
                    fallback_type = "INTEGER"
                conn.execute(text(f"ALTER TABLE recommendations ADD COLUMN {name} {fallback_type}"))
