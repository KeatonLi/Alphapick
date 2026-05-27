#!/usr/bin/env python3
"""
[已废弃] 价格更新改为从页面按钮触发，不再依赖 cron。
请在服务器上移除 crontab 条目：
  crontab -e  # 删除 update_prices.py 相关行
"""
import sys
print("[update-prices] 已废弃：价格更新改为页面按钮触发")
sys.exit(0)
