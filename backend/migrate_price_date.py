"""添加 price_updated_date 字段到 recommendations 表
使 update_recommend_prices 具备幂等性，防止同一天多次更新导致 tracking_days 重复计数
"""
import pymysql
from app.config import settings

conn = pymysql.connect(
    host=settings.QUANTFORGE_DB_HOST,
    port=settings.QUANTFORGE_DB_PORT,
    user=settings.QUANTFORGE_DB_USER,
    passwd=settings.QUANTFORGE_DB_PASSWORD,
    db=settings.QUANTFORGE_DB_NAME,
    charset='utf8mb4',
)
cursor = conn.cursor()

try:
    cursor.execute(
        "ALTER TABLE recommendations ADD COLUMN price_updated_date DATE DEFAULT NULL COMMENT '最近一次价格更新的交易日日期'"
    )
    print("OK: 添加 price_updated_date 列")
except pymysql.OperationalError as e:
    if "Duplicate column" in str(e):
        print("跳过（已存在）: price_updated_date")
    else:
        raise e

# 将已完结记录的 price_updated_date 设为 recommend_date + tracking_days（近似值，仅用于状态保持）
cursor.execute(
    "UPDATE recommendations SET price_updated_date = recommend_date + INTERVAL tracking_days DAY "
    "WHERE status = 'completed' AND tracking_days > 0 AND price_updated_date IS NULL"
)
print(f"更新了 {cursor.rowcount} 条已完结记录的 price_updated_date")

cursor.close()
conn.close()
print("迁移完成")
