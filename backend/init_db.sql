-- ============================================================
-- QuantForge 数据库初始化脚本
-- 数据库: quantforge | 字符集: utf8mb4
-- ============================================================

CREATE DATABASE IF NOT EXISTS quantforge
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE quantforge;

-- ─── 用户表 ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
    password_hash VARCHAR(128) NOT NULL COMMENT '密码哈希',
    role VARCHAR(10) NOT NULL DEFAULT 'user' COMMENT '角色: admin / user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- ─── 市场报告表 ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_date DATE NOT NULL UNIQUE COMMENT '报告日期',
    market_summary TEXT COMMENT '市场概况',
    index_data TEXT COMMENT '指数数据 JSON',
    hot_sectors TEXT COMMENT '热门板块 JSON',
    ai_report TEXT COMMENT 'AI 分析报告',
    html_report_path VARCHAR(500) COMMENT 'HTML 报告文件路径',
    yesterday_limit_ups TEXT COMMENT '昨日涨停股代码列表 JSON',
    yesterday_limit_ups_performance DECIMAL(5,2) COMMENT '昨日涨停股今日平均涨幅',
    hsgt_flow TEXT COMMENT '沪深港通资金流 JSON',
    sectors_full TEXT COMMENT '全量行业板块 JSON',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='市场报告表';

-- ─── 推荐表 ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recommendations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recommend_date DATE NOT NULL COMMENT '推荐日期',
    stock_code VARCHAR(10) NOT NULL COMMENT '股票代码',
    stock_name VARCHAR(50) NOT NULL COMMENT '股票名称',
    recommend_price DECIMAL(10,3) NOT NULL COMMENT '推荐价格',
    rec_rank INT COMMENT '策略排名',
    score DECIMAL(10,4) COMMENT '量化综合分',
    strategy_version VARCHAR(50) COMMENT '策略版本',
    factor_snapshot TEXT COMMENT '因子快照 JSON',
    current_price DECIMAL(10,3) COMMENT '最新价格',
    return_rate DECIMAL(10,4) COMMENT '收益率',
    reason TEXT COMMENT '推荐理由',
    tracking_days INT DEFAULT 0 COMMENT '已跟踪交易日数（0-7）',
    status VARCHAR(20) DEFAULT 'tracking' COMMENT '状态: tracking / completed',
    price_day1 DECIMAL(10,3) COMMENT '持股第1天价格',
    price_day2 DECIMAL(10,3) COMMENT '持股第2天价格',
    price_day3 DECIMAL(10,3) COMMENT '持股第3天价格',
    price_day5 DECIMAL(10,3) COMMENT '持股第5天价格',
    price_day7 DECIMAL(10,3) COMMENT '持股第7天价格',
    return_rate_day1 DECIMAL(10,4) COMMENT '第1天收益率',
    return_rate_day2 DECIMAL(10,4) COMMENT '第2天收益率',
    return_rate_day3 DECIMAL(10,4) COMMENT '第3天收益率',
    return_rate_day5 DECIMAL(10,4) COMMENT '第5天收益率',
    return_rate_day7 DECIMAL(10,4) COMMENT '第7天收益率',
    final_return_rate DECIMAL(10,4) COMMENT '最终跟踪收益率',
    max_gain DECIMAL(10,4) COMMENT '最大涨幅',
    max_drawdown DECIMAL(10,4) COMMENT '最大回撤',
    price_updated_date DATE COMMENT '最近价格更新日期',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_recommend_date (recommend_date),
    INDEX idx_stock_code (stock_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='量化推荐表';

-- ─── 生成任务表 ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS generation_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_type VARCHAR(20) NOT NULL COMMENT '任务类型: report / recommend / all',
    target_date DATE NOT NULL COMMENT '目标日期',
    status VARCHAR(20) DEFAULT 'pending' COMMENT '状态: pending / running / completed / failed',
    current_step INT DEFAULT 0 COMMENT '当前步骤',
    total_steps INT DEFAULT 0 COMMENT '总步骤数',
    step_label VARCHAR(200) COMMENT '当前步骤描述',
    progress_pct INT DEFAULT 0 COMMENT '进度百分比 0-100',
    candidate_stocks TEXT COMMENT '候选股票 JSON',
    result TEXT COMMENT '生成结果 JSON',
    error_message TEXT COMMENT '错误信息',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='生成任务表';

-- ─── 定时任务配置表 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedule_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    enabled BOOLEAN DEFAULT FALSE COMMENT '是否启用定时任务',
    run_time VARCHAR(5) DEFAULT '16:00' COMMENT '运行时间 HH:MM',
    run_report BOOLEAN DEFAULT TRUE COMMENT '是否自动生成报告',
    run_recommend BOOLEAN DEFAULT TRUE COMMENT '是否自动生成推荐',
    last_run_at VARCHAR(19) COMMENT '上次运行时间',
    last_run_result VARCHAR(200) COMMENT '上次运行结果',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='定时任务配置表';

-- ─── 数据采集日志表 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_fetch_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source_name VARCHAR(50) NOT NULL COMMENT '数据源: akshare / tencent / eastmoney',
    data_type VARCHAR(50) NOT NULL COMMENT '类型: index_daily / sector_summary / stock_daily / hsgt_flow / limit_up_pool / trade_calendar / stock_spot',
    target_date DATE NOT NULL COMMENT '采集的目标数据日期',
    status VARCHAR(20) NOT NULL COMMENT 'success / failed / empty',
    request_params TEXT COMMENT '请求参数 JSON',
    response_size INT COMMENT '响应字节数',
    error_message TEXT COMMENT '失败时的错误信息',
    retry_count INT DEFAULT 0 COMMENT '实际重试次数',
    duration_ms INT COMMENT '采集耗时（毫秒）',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_fetch_type_date (data_type, target_date),
    INDEX idx_fetch_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据采集日志表';

-- ─── 原始数据记录表 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS raw_data_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source_name VARCHAR(50) NOT NULL COMMENT '数据源标识',
    data_type VARCHAR(50) NOT NULL COMMENT '数据类型标识',
    target_date DATE NOT NULL COMMENT '数据日期',
    raw_json MEDIUMTEXT NOT NULL COMMENT 'API 原始 JSON 响应',
    fetch_log_id INT COMMENT '关联 data_fetch_log.id',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    UNIQUE KEY uq_data_type_target_date (data_type, target_date),
    FOREIGN KEY (fetch_log_id) REFERENCES data_fetch_log(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='原始数据记录表';

-- ─── 默认数据 ────────────────────────────────────────────────
INSERT INTO schedule_config (enabled, run_time, run_report, run_recommend)
VALUES (FALSE, '16:00', TRUE, TRUE);
