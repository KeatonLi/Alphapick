# ============================================================
# AlphaPick 微信云托管镜像
# 多阶段构建：
#   stage 1  前端构建（Node + Vite）
#   stage 2  后端 Python 依赖安装
#   stage 3  运行镜像（nginx 单端口入口 + uvicorn 内部 8084）
# ============================================================

# ---------- stage 1: 前端构建 ----------
FROM node:22-alpine AS frontend-build
WORKDIR /build
# playwright 仅用于冒烟测试，跳过浏览器下载以加速构建
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
# 锁定 npm 版本与本地开发一致，避免基础镜像内置 npm 漂移导致锁文件失配
RUN npm install -g npm@10.9.8
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---------- stage 2: 后端依赖 ----------
FROM python:3.11-slim AS backend-deps
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /build
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# ---------- stage 3: 运行镜像 ----------
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=Asia/Shanghai \
    PORT=80

# 安装 nginx、中文字体（海报/图表）、时区、gettext(envsubst)
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      nginx \
      fonts-wqy-microhei \
      fonts-noto-cjk \
      tzdata \
      gettext-base \
 && rm -rf /var/lib/apt/lists/* \
 && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
 && rm -f /etc/nginx/sites-enabled/default

WORKDIR /app

# 拷贝 Python 依赖（跨阶段，与 stage2 同基镜像）
COPY --from=backend-deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages

# 拷贝后端代码
COPY backend/ ./backend/

# 拷贝前端构建产物
COPY --from=frontend-build /build/dist/ ./frontend/dist/

# 拷贝 nginx 模板与启动脚本
COPY deploy/nginx.conf.template /app/deploy/nginx.conf.template
COPY deploy/start.sh /app/deploy/start.sh
RUN chmod +x /app/deploy/start.sh

# 暴露健康检查与云托管入口端口
EXPOSE 80

CMD ["/app/deploy/start.sh"]
