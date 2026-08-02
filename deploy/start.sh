#!/bin/sh
# AlphaPick 容器启动脚本（微信云托管）
# 1. 启动 FastAPI 后端（内部端口 8084，不对外）
# 2. 渲染 nginx 配置并前台启动（监听 $PORT，默认 80）

set -e

export PORT="${PORT:-80}"

# 启动后端（内部端口 8084，由 nginx 对外代理）
cd /app/backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8084 &
BACKEND_PID=$!

# 渲染 nginx 配置（替换 ${PORT}）
mkdir -p /etc/nginx/conf.d
envsubst '${PORT}' < /app/deploy/nginx.conf.template > /etc/nginx/conf.d/default.conf

# 前台运行 nginx
nginx -g 'daemon off;' &
NGINX_PID=$!

# 任一进程退出则整体退出，触发云托管自动重启
while kill -0 $BACKEND_PID 2>/dev/null && kill -0 $NGINX_PID 2>/dev/null; do
    sleep 2
done

if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "[start] 后端已退出，关闭 nginx"
    kill $NGINX_PID 2>/dev/null || true
else
    echo "[start] nginx 已退出，关闭后端"
    kill $BACKEND_PID 2>/dev/null || true
fi
exit 1
