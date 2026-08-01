#!/bin/bash
# AlphaPick 一键部署脚本
# 自动检测 SSH 认证方式，构建前端、上传代码、安装依赖、重启服务
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

SERVER_HOST="${SERVER_HOST:-111.231.107.210}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PORT="${SERVER_PORT:-22}"
REMOTE_DIR="${REMOTE_DIR:-/opt/alphapick}"

AUTH_MODE=""
SSH_OPTS=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 -p "$SERVER_PORT")
SCP_OPTS=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -P "$SERVER_PORT")

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo -e "${RED}错误: 未找到 $1，请先安装${NC}"; exit 1
  fi
}

detect_auth_mode() {
  echo -e "${BLUE}[1/6] 检查 SSH 登录方式...${NC}"
  if ssh "${SSH_OPTS[@]}" -o BatchMode=yes "$SERVER_USER@$SERVER_HOST" "echo connected" >/dev/null 2>&1; then
    AUTH_MODE="ssh-key"
    echo -e "${GREEN}→ 使用 SSH 密钥免密登录${NC}"
    return
  fi
  if command -v sshpass >/dev/null 2>&1; then
    if [ -z "${SERVER_PASSWORD:-}" ]; then
      echo -e "${YELLOW}请输入服务器密码:${NC}"
      read -r -s SERVER_PASSWORD; echo ""
    fi
    export SSHPASS="$SERVER_PASSWORD"
    if sshpass -e ssh "${SSH_OPTS[@]}" "$SERVER_USER@$SERVER_HOST" "echo connected" >/dev/null 2>&1; then
      AUTH_MODE="sshpass"
      echo -e "${GREEN}→ 使用 sshpass 密码登录${NC}"
      return
    fi
    echo -e "${RED}sshpass 登录失败${NC}"; exit 1
  fi
  echo -e "${RED}未找到可用的 SSH 认证方式（请配置 SSH 密钥或安装 sshpass）${NC}"; exit 1
}

ssh_run() { if [ "$AUTH_MODE" = "sshpass" ]; then sshpass -e ssh "${SSH_OPTS[@]}" "$SERVER_USER@$SERVER_HOST" "$@"; else ssh "${SSH_OPTS[@]}" "$SERVER_USER@$SERVER_HOST" "$@"; fi; }
scp_run() { if [ "$AUTH_MODE" = "sshpass" ]; then sshpass -e scp "${SCP_OPTS[@]}" "$@"; else scp "${SCP_OPTS[@]}" "$@"; fi; }
remote_bash() {
  if [ "$AUTH_MODE" = "sshpass" ]; then
    sshpass -e ssh "${SSH_OPTS[@]}" "$SERVER_USER@$SERVER_HOST" "bash -s -- $*"
  else
    ssh "${SSH_OPTS[@]}" "$SERVER_USER@$SERVER_HOST" "bash -s -- $*"
  fi
}

build_project() {
  echo -e "${BLUE}[2/6] 构建前端...${NC}"
  if [ ! -d frontend ]; then echo -e "${RED}frontend 目录不存在${NC}"; exit 1; fi
  (
    cd frontend
    cat > .env.production << EOF
VITE_API_URL=http://${SERVER_HOST}:8084/api
EOF
    npm install
    npm run build
    rm -f .env.production
    if [ ! -d dist ]; then echo -e "${RED}构建失败，dist 目录未生成${NC}"; exit 1; fi
    cp server.js dist/server.js
  )
  echo -e "${GREEN}前端构建完成${NC}"
}

prepare_server() {
  echo -e "${BLUE}[3/6] 准备服务器环境...${NC}"
  remote_bash "$REMOTE_DIR" << 'EOF'
set -e; REMOTE_DIR="$1"; cd "$REMOTE_DIR"
# 停止旧服务
[ -f backend.pid ] && kill $(cat backend.pid) 2>/dev/null || true
[ -f frontend.pid ] && kill $(cat frontend.pid) 2>/dev/null || true
pkill -f 'uvicorn.*8084' 2>/dev/null || true
pkill -f 'node.*server' 2>/dev/null || true
sleep 2
# 备份日志
[ -f backend.log ] && mv backend.log "backend.log.$(date +%Y%m%d_%H%M%S)" || true
[ -f frontend.log ] && mv frontend.log "frontend.log.$(date +%Y%m%d_%H%M%S)" || true
# 清理旧文件
rm -rf frontend-dist
echo "服务器就绪"
EOF
  echo -e "${GREEN}服务器环境准备完成${NC}"
}

upload_files() {
  echo -e "${BLUE}[4/6] 上传文件...${NC}"
  ssh_run "mkdir -p '$REMOTE_DIR'"
  scp_run -r backend "$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/"
  scp_run -r frontend/dist "$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/frontend-dist"
  scp_run backend/.env "$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/.env"
  echo -e "${GREEN}文件上传完成${NC}"
}

install_deps() {
  echo -e "${BLUE}[5/6] 安装 Python 依赖...${NC}"
  ssh_run "cd '$REMOTE_DIR/backend' && pip3 install -r requirements.txt --quiet"
  echo -e "${GREEN}依赖安装完成${NC}"
}

start_services() {
  echo -e "${BLUE}[6/6] 启动服务...${NC}"
  remote_bash "$REMOTE_DIR" << 'EOF'
set -e; REMOTE_DIR="$1"; cd "$REMOTE_DIR"
[ -f .env ] && set -a && source .env && set +a
[ -d backend ] || { echo "后端目录不存在"; exit 1; }
[ -d frontend-dist ] || { echo "前端目录不存在"; exit 1; }

cd backend
nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8084 > ../backend.log 2>&1 &
echo $! > ../backend.pid

cd ../frontend-dist
nohup node server.js > ../frontend.log 2>&1 &
echo $! > ../frontend.pid

echo "等待服务启动..."
for i in $(seq 1 10); do
  if curl -sf http://localhost:8084/api/health >/dev/null 2>&1; then
    echo "后端正常"; break
  fi
  echo "等待后端... ($i/10)"; sleep 3
done
for i in $(seq 1 10); do
  if curl -sf http://localhost:3002 >/dev/null 2>&1; then
    echo "前端正常"; break
  fi
  echo "等待前端... ($i/10)"; sleep 2
done

echo "服务状态:"
ps aux | grep -E 'uvicorn.*8084|node.*server' | grep -v grep
echo "部署完成"
EOF
  echo -e "${GREEN}服务启动完成${NC}"
}

show_info() {
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  AlphaPick 部署完成${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo -e "  前端: ${BLUE}http://$SERVER_HOST:3002${NC}"
  echo -e "  后端: ${BLUE}http://$SERVER_HOST:8084/api${NC}"
  echo -e "  健康: ${BLUE}http://$SERVER_HOST:8084/api/health${NC}"
  echo ""
  echo -e "${YELLOW}查看日志:${NC}"
  echo -e "  ssh $SERVER_USER@$SERVER_HOST 'tail -f $REMOTE_DIR/backend.log'"
  echo -e "  ssh $SERVER_USER@$SERVER_HOST 'tail -f $REMOTE_DIR/frontend.log'"
  echo -e "${GREEN}========================================${NC}"
}

main() {
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  AlphaPick 一键部署${NC}"
  echo -e "${GREEN}========================================${NC}"
  need_cmd npm; need_cmd ssh; need_cmd scp
  detect_auth_mode
  build_project
  prepare_server
  upload_files
  install_deps
  start_services
  show_info
}

main
