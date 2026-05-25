#!/usr/bin/env python3
"""数据库迁移：为 market_reports 表添加情绪字段
用法: python migrate_mood_fields.py
需要在有数据库写权限的环境执行（本地或服务器）"""
import sys
import pymysql

# 数据库连接
DB_HOST = "localhost"
DB_PORT = 13306
DB_USER = "root"
DB_PASSWORD = "quantforge2024"
DB_NAME = "quantforge"

def migrate():
    connection = pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        charset='utf8mb4'
    )
    try:
        with connection.cursor() as cursor:
            # 检查字段是否已存在
            cursor.execute("DESCRIBE market_reports")
            columns = [row[0] for row in cursor.fetchall()]

            if 'yesterday_limit_ups' not in columns:
                cursor.execute("""
                    ALTER TABLE market_reports
                    ADD COLUMN yesterday_limit_ups TEXT NULL COMMENT '昨日涨停股代码列表JSON'
                    AFTER html_report_path
                """)
                print("✓ 添加 yesterday_limit_ups 字段成功")

            if 'yesterday_limit_ups_performance' not in columns:
                cursor.execute("""
                    ALTER TABLE market_reports
                    ADD COLUMN yesterday_limit_ups_performance DECIMAL(5,2) NULL COMMENT '昨日涨停股今日平均涨幅'
                    AFTER yesterday_limit_ups
                """)
                print("✓ 添加 yesterday_limit_ups_performance 字段成功")

            if 'yesterday_limit_ups' in columns and 'yesterday_limit_ups_performance' in columns:
                print("✓ 字段已存在，无需迁移")

        connection.commit()
        print("✓ 迁移完成")

    finally:
        connection.close()

if __name__ == "__main__":
    migrate()
