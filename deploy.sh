#!/bin/bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVER_HOST="${SERVER_HOST:-111.231.107.210}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PORT="${SERVER_PORT:-22}"
REMOTE_DIR="${REMOTE_DIR:-/opt/quantforge}"

AUTH_MODE=""
SSH_COMMON_OPTS=(
  -o StrictHostKeyChecking=no
  -o UserKnownHostsFile=/dev/null
  -o ConnectTimeout=10
  -p "$SERVER_PORT"
)
SCP_COMMON_OPTS=(
  -o StrictHostKeyChecking=no
  -o UserKnownHostsFile=/dev/null
  -P "$SERVER_PORT"
)

check_dependencies() {
  for cmd in ssh scp npm; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      echo -e "${RED}错误: 未找到依赖命令 $cmd${NC}"
      exit 1
    fi
  done
}

detect_auth_mode() {
  echo -e "${BLUE}检查 SSH 登录方式...${NC}"
  if ssh "${SSH_COMMON_OPTS[@]}" -o BatchMode=yes "$SERVER_USER@$SERVER_HOST" "echo connected" >/dev/null 2>&1; then
    AUTH_MODE="ssh-key"
    echo -e "${GREEN}检测到 SSH 密钥免密登录${NC}"
    return
  fi
  if command -v sshpass >/dev/null 2>&1; then
    if [ -z "${SERVER_PASSWORD:-}" ]; then
      echo -e "${YELLOW}请输入服务器密码:${NC}"
      read -r -s -p "" SERVER_PASSWORD
      echo ""
    fi
    export SSHPASS="$SERVER_PASSWORD"
    if sshpass -e ssh "${SSH_COMMON_OPTS[@]}" "$SERVER_USER@$SERVER_HOST" "echo connected" >/dev/null 2>&1; then
      AUTH_MODE="sshpass"
      echo -e "${GREEN}使用 sshpass 部署${NC}"
      return
    fi
    echo -e "${RED}sshpass 登录失败${NC}"
    exit 1
  fi
  echo -e "${RED}未找到可用的 SSH 认证方式${NC}"
  exit 1
}

remote_ssh() {
  if [ "$AUTH_MODE" = "sshpass" ]; then
    sshpass -e ssh "${SSH_COMMON_OPTS[@]}" "$SERVER_USER@$SERVER_HOST" "$@"
  else
    ssh "${SSH_COMMON_OPTS[@]}" "$SERVER_USER@$SERVER_HOST" "$@"
  fi
}

remote_scp() {
  if [ "$AUTH_MODE" = "sshpass" ]; then
    sshpass -e scp "${SCP_COMMON_OPTS[@]}" "$@"
  else
    scp "${SCP_COMMON_OPTS[@]}" "$@"
  fi
}

run_remote_script() {
  if [ "$AUTH_MODE" = "sshpass" ]; then
    sshpass -e ssh "${SSH_COMMON_OPTS[@]}" "$SERVER_USER@$SERVER_HOST" "bash -s -- $*"
  else
    ssh "${SSH_COMMON_OPTS[@]}" "$SERVER_USER@$SERVER_HOST" "bash -s -- $*"
  fi
}

build_project() {
  echo -e "${BLUE}开始构建项目...${NC}"

  echo -e "${YELLOW}构建前端...${NC}"
  (
    cd frontend
    cat > .env.production << EOF
VITE_API_URL=http://${SERVER_HOST}:8084/api
EOF
    npm install
    npm run build
    rm -f .env.production
    if [ ! -d "dist" ]; then
      echo -e "${RED}前端构建失败，dist 目录不存在${NC}"
      exit 1
    fi
  )
  echo -e "${GREEN}前端构建完成${NC}"
}

prepare_server() {
  echo -e "${BLUE}准备服务器环境...${NC}"
  run_remote_script "$REMOTE_DIR" <<'EOF'
set -e
REMOTE_DIR="$1"
mkdir -p "$REMOTE_DIR"
cd "$REMOTE_DIR"

echo "停止现有服务..."
if [ -f "backend.pid" ]; then
  kill $(cat backend.pid) 2>/dev/null || true
  rm -f backend.pid
fi
if [ -f "frontend.pid" ]; then
  kill $(cat frontend.pid) 2>/dev/null || true
  rm -f frontend.pid
fi

# 清理残留
REMAINING=$(ps aux | grep -E "(uvicorn.*quantforge|uvicorn.*8084|node.*server\.js)" | grep -v grep | awk '{print $2}')
if [ -n "$REMAINING" ]; then
  for pid in $REMAINING; do kill "$pid" 2>/dev/null || true; done
  sleep 2
fi

# 备份旧日志
[ -f "backend.log" ] && mv backend.log "backend.log.$(date +%Y%m%d_%H%M%S)" || true
[ -f "frontend.log" ] && mv frontend.log "frontend.log.$(date +%Y%m%d_%H%M%S)" || true

echo "服务器环境准备完成"
EOF
  echo -e "${GREEN}服务器环境准备完成${NC}"
}

upload_files() {
  echo -e "${BLUE}上传文件到服务器...${NC}"

  remote_ssh "cd '$REMOTE_DIR' && rm -rf backend frontend-dist backend.pid frontend.pid && echo '旧文件清理完成'"

  echo -e "${YELLOW}上传 Python 后端...${NC}"
  remote_scp -r "backend" "$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/"

  echo -e "${YELLOW}上传前端构建产物...${NC}"
  cp frontend/server.js frontend/dist/server.js
  remote_scp -r "frontend/dist" "$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/frontend-dist"

  echo -e "${YELLOW}上传环境变量文件...${NC}"
  remote_scp "backend/.env" "$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/.env"

  echo -e "${GREEN}文件上传完成${NC}"
}

start_services() {
  echo -e "${BLUE}启动服务...${NC}"
  run_remote_script "$REMOTE_DIR" <<'EOF'
set -e
REMOTE_DIR="$1"
cd "$REMOTE_DIR"

if [ -f ".env" ]; then
  set -a; source .env; set +a
fi

[ -d "backend" ] || { echo "后端目录不存在"; exit 1; }
[ -d "frontend-dist" ] || { echo "前端目录不存在"; exit 1; }

echo "安装 Python 依赖..."
cd backend
pip3 install -r requirements.txt --quiet
cd ..

echo "启动后端服务 (端口 8084)..."
cd backend
nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8084 > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..
echo "$BACKEND_PID" > backend.pid
echo "后端 PID: $BACKEND_PID"

echo "启动前端服务 (端口 3002)..."
cd frontend-dist
nohup node server.js > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > ../frontend.pid
echo "前端 PID: $FRONTEND_PID"
cd ..

echo "等待服务启动..."
sleep 8

echo "后端健康检查..."
for i in $(seq 1 10); do
  if curl -sf http://localhost:8084/api/health >/dev/null 2>&1; then
    echo "后端正常"
    break
  fi
  echo "等待后端... ($i/10)"
  sleep 3
done

echo "前端健康检查..."
for i in $(seq 1 10); do
  if curl -sf http://localhost:3002 >/dev/null 2>&1; then
    echo "前端正常"
    break
  fi
  echo "等待前端... ($i/10)"
  sleep 2
done

echo "部署完成!"
ps aux | grep -E "(uvicorn.*8084|node.*server)" | grep -v grep
EOF
  echo -e "${GREEN}服务启动完成${NC}"
}

show_info() {
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  QuantForge 部署完成${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo -e "  前端: ${BLUE}http://$SERVER_HOST:3002${NC}"
  echo -e "  后端: ${BLUE}http://$SERVER_HOST:8084/api${NC}"
  echo -e "  健康检查: ${BLUE}http://$SERVER_HOST:8084/api/health${NC}"
  echo ""
  echo -e "${YELLOW}查看日志:${NC}"
  echo -e "  ssh $SERVER_USER@$SERVER_HOST 'tail -f $REMOTE_DIR/backend.log'"
  echo -e "  ssh $SERVER_USER@$SERVER_HOST 'tail -f $REMOTE_DIR/frontend.log'"
  echo -e "${GREEN}========================================${NC}"
}

main() {
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  QuantForge 一键部署${NC}"
  echo -e "${GREEN}========================================${NC}"

  check_dependencies
  detect_auth_mode
  build_project
  prepare_server
  upload_files
  start_services
  show_info
}

main
