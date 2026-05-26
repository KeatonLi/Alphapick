"""添加 tracking_days, price_day1/2/3 字段到 recommendations 表"""
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

alterations = [
    "ALTER TABLE recommendations ADD COLUMN tracking_days INT DEFAULT 0 COMMENT '已跟踪交易日数（0-3）'",
    "ALTER TABLE recommendations ADD COLUMN price_day1 DECIMAL(10,3) DEFAULT NULL COMMENT '持股第一天价格'",
    "ALTER TABLE recommendations ADD COLUMN price_day2 DECIMAL(10,3) DEFAULT NULL COMMENT '持股第二天价格'",
    "ALTER TABLE recommendations ADD COLUMN price_day3 DECIMAL(10,3) DEFAULT NULL COMMENT '持股第三天价格'",
]

for sql in alterations:
    try:
        cursor.execute(sql)
        print(f"OK: {sql.split('ADD')[1].strip()}")
    except pymysql.OperationalError as e:
        if "Duplicate column" in str(e):
            print(f"跳过（已存在）: {sql.split('ADD')[1].strip()}")
        else:
            raise e

# 将历史记录的 tracking_days 设为 3（已完结，不再更新）
cursor.execute("UPDATE recommendations SET tracking_days = 3 WHERE tracking_days IS NULL AND current_price IS NOT NULL")
print(f"更新了 {cursor.rowcount} 条历史记录 tracking_days = 3")
cursor.execute("UPDATE recommendations SET tracking_days = 0 WHERE tracking_days IS NULL")
print(f"更新了 {cursor.rowcount} 条空记录 tracking_days = 0")

cursor.close()
conn.close()
print("迁移完成")
