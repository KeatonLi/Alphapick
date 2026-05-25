#!/bin/bash
# QuantForge Windows deploy script
# Compatible with Git Bash / MSYS2 / WSL + sshpass password auth

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVER_HOST="${SERVER_HOST:-111.231.107.210}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PORT="${SERVER_PORT:-22}"
REMOTE_DIR="${REMOTE_DIR:-/opt/quantforge}"
SERVER_PASSWORD="${SERVER_PASSWORD:-}"

# Prompt for password if not set (avoid hardcoding secrets)
if [ -z "$SERVER_PASSWORD" ]; then
  echo -en "${YELLOW}Server password: ${NC}"
  read -r -s SERVER_PASSWORD
  echo ""
  if [ -z "$SERVER_PASSWORD" ]; then
    echo -e "${RED}Password required${NC}"
    exit 1
  fi
fi

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo -e "${RED}Error: $1 not found${NC}"
    exit 1
  fi
}

do_ssh() {
  if [ -n "$SERVER_PASSWORD" ]; then
    sshpass -p "$SERVER_PASSWORD" ssh \
      -o StrictHostKeyChecking=no \
      -o ConnectTimeout=10 \
      -p "$SERVER_PORT" "$@"
  else
    ssh \
      -o StrictHostKeyChecking=no \
      -o ConnectTimeout=10 \
      -p "$SERVER_PORT" "$@"
  fi
}

do_scp() {
  if [ -n "$SERVER_PASSWORD" ]; then
    sshpass -p "$SERVER_PASSWORD" scp \
      -o StrictHostKeyChecking=no \
      -P "$SERVER_PORT" "$@"
  else
    scp \
      -o StrictHostKeyChecking=no \
      -P "$SERVER_PORT" "$@"
  fi
}

# Upload remote script as a temp file, execute, then delete
run_remote() {
  local content="$1"
  local remote_path="/tmp/qf_deploy_$$.sh"
  printf '%s\n' "$content" | do_ssh "$SERVER_USER@$SERVER_HOST" "cat > $remote_path && chmod +x $remote_path && bash $remote_path && rm -f $remote_path"
}

build_project() {
  echo -e "${BLUE}[1/6] Building frontend...${NC}"
  if [ ! -d frontend ]; then
    echo -e "${RED}frontend directory not found${NC}"
    exit 1
  fi
  cd frontend
  cat > .env.production << EOF
VITE_API_URL=http://${SERVER_HOST}:8084/api
EOF
  npm install
  npm run build
  rm -f .env.production
  if [ ! -d dist ]; then
    echo -e "${RED}Build failed, dist not found${NC}"
    exit 1
  fi
  cp server.js dist/server.js
  cd ..
  echo -e "${GREEN}Frontend built${NC}"
}

prepare_server() {
  echo -e "${BLUE}[2/6] Preparing server...${NC}"
  run_remote "set -e
mkdir -p /opt/quantforge
cd /opt/quantforge
[ -f backend.pid ] && kill \$(cat backend.pid) 2>/dev/null || true
[ -f frontend.pid ] && kill \$(cat frontend.pid) 2>/dev/null || true
pkill -f 'uvicorn.*8084' 2>/dev/null || true
pkill -f 'node.*server' 2>/dev/null || true
sleep 2
[ -f backend.log ] && mv backend.log backend.log.\$(date +%Y%m%d_%H%M%S) || true
[ -f frontend.log ] && mv frontend.log frontend.log.\$(date +%Y%m%d_%H%M%S) || true
rm -rf frontend-dist
echo done"
  echo -e "${GREEN}Server prepared${NC}"
}

upload_files() {
  echo -e "${BLUE}[3/6] Uploading files...${NC}"
  do_scp -r backend "$SERVER_USER@$SERVER_HOST:/opt/quantforge/"
  do_scp -r frontend/dist "$SERVER_USER@$SERVER_HOST:/opt/quantforge/frontend-dist"
  do_scp backend/.env "$SERVER_USER@$SERVER_HOST:/opt/quantforge/.env"
  echo -e "${GREEN}Files uploaded${NC}"
}

install_deps() {
  echo -e "${BLUE}[4/6] Installing Python dependencies...${NC}"
  do_ssh "$SERVER_USER@$SERVER_HOST" "cd /opt/quantforge/backend && pip3 install -r requirements.txt --quiet"
  echo -e "${GREEN}Dependencies installed${NC}"
}

start_services() {
  echo -e "${BLUE}[5/6] Starting services...${NC}"
  run_remote "set -e
cd /opt/quantforge
set -a; . .env; set +a
cd backend
nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8084 > ../backend.log 2>&1 &
echo \$! > ../backend.pid
cd ../frontend-dist
nohup node server.js > ../frontend.log 2>&1 &
echo \$! > ../frontend.pid
sleep 8
curl -sf http://localhost:8084/api/health && echo ' backend-ok'
curl -sf http://localhost:3002 > /dev/null && echo ' frontend-ok'
ps aux | grep -E 'uvicorn.*8084|node.*server' | grep -v grep
echo all started"
  echo -e "${GREEN}Services started${NC}"
}

show_info() {
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  QuantForge Deployed${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo -e "  Frontend: ${BLUE}http://$SERVER_HOST:3002${NC}"
  echo -e "  Backend:  ${BLUE}http://$SERVER_HOST:8084/api${NC}"
  echo -e "  Health:   ${BLUE}http://$SERVER_HOST:8084/api/health${NC}"
  echo ""
  echo -e "${YELLOW}Logs:${NC}"
  echo -e "  ssh $SERVER_USER@$SERVER_HOST tail -f $REMOTE_DIR/backend.log"
  echo -e "  ssh $SERVER_USER@$SERVER_HOST tail -f $REMOTE_DIR/frontend.log"
  echo -e "${GREEN}========================================${NC}"
}

main() {
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  QuantForge Deploy (Windows)${NC}"
  echo -e "${GREEN}========================================${NC}"
  need_cmd sshpass
  need_cmd scp
  need_cmd npm

  build_project
  prepare_server
  upload_files
  install_deps
  start_services
  show_info
}

main "$@"
