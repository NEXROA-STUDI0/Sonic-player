#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# Sonic Player — One Script to Rule Them All
# Setup · Update · Run  —  Works on PC & Termux
# ═══════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()  { echo -e "  ${CYAN}→${NC} $1"; }
ok()    { echo -e "  ${GREEN}✓${NC} $1"; }
warn()  { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail()  { echo -e "  ${RED}✗${NC} $1"; }

IS_TERMUX=false
[ -n "$TERMUX_VERSION" ] && IS_TERMUX=true

# Where am I?
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ─────────────────────────────────────────────────────────
# 1. Install all dependencies
# ─────────────────────────────────────────────────────────
install_deps() {
  echo ""
  echo -e "  ${CYAN}╔══════════════════════════════════════╗${NC}"
  echo -e "  ${CYAN}║${NC}  📦  Installing Dependencies        ${CYAN}║${NC}"
  echo -e "  ${CYAN}╚══════════════════════════════════════╝${NC}"
  echo ""

  if [ "$IS_TERMUX" = true ]; then
    # Fix broken packages first
    apt --fix-broken install -y 2>/dev/null || true
    dpkg --configure -a 2>/dev/null || true

    # Install base packages
    for pkg in python nodejs ffmpeg git curl; do
      if ! command -v "$pkg" &>/dev/null; then
        info "Installing $pkg..."
        apt-get install -y "$pkg" 2>/dev/null || true
      fi
    done

    # Install/upgrade yt-dlp — pip FIRST (distro apt copies are ancient
    # and YouTube blocks them, which silently breaks playback)
    info "Installing yt-dlp..."
    if ! command -v yt-dlp &>/dev/null; then
      pip install -U yt-dlp 2>/dev/null || apt-get install -y yt-dlp 2>/dev/null || true
    else
      pip install -U yt-dlp 2>/dev/null || true
    fi
    command -v yt-dlp &>/dev/null && ok "yt-dlp $(yt-dlp --version 2>/dev/null)" || warn "yt-dlp not found — run: pkg install yt-dlp"

  else
    # PC: pip first (never trust distro apt copies — too old for YouTube)
    if ! command -v yt-dlp &>/dev/null; then
      info "Installing yt-dlp..."
      pip3 install -U yt-dlp 2>/dev/null || pip3 install -U --break-system-packages yt-dlp 2>/dev/null || pip install -U yt-dlp 2>/dev/null || pip install -U --break-system-packages yt-dlp 2>/dev/null || apt-get install -y yt-dlp 2>/dev/null || true
    else
      pip3 install -U yt-dlp 2>/dev/null || pip3 install -U --break-system-packages yt-dlp 2>/dev/null || true
    fi
    command -v yt-dlp &>/dev/null && ok "yt-dlp $(yt-dlp --version 2>/dev/null)" || warn "yt-dlp not found — run: pip install yt-dlp"
  fi

  # npm packages
  if [ ! -d "node_modules" ]; then
    info "Installing npm packages..."
    npm install 2>/dev/null || npm install --legacy-peer-deps 2>/dev/null || true
  fi
  [ -d "node_modules" ] && ok "npm packages ready" || warn "npm install failed"

  mkdir -p backend/downloads
  ok "Backend downloads folder ready"
}

# ─────────────────────────────────────────────────────────
# 2. Clone or update the project
# ─────────────────────────────────────────────────────────
update_project() {
  echo ""
  echo -e "  ${CYAN}╔══════════════════════════════════════╗${NC}"
  echo -e "  ${CYAN}║${NC}  🔄  Updating from GitHub           ${CYAN}║${NC}"
  echo -e "  ${CYAN}╚══════════════════════════════════════╝${NC}"
  echo ""

  # If we're already inside the project, pull
  if git status --porcelain &>/dev/null; then
    info "Pulling latest version..."
    git pull 2>/dev/null && ok "Project updated" || warn "Git pull failed"
  else
    info "Cloning Sonic Player..."
    cd /tmp
    rm -rf Sonic-player
    git clone https://github.com/NEXROA-STUDI0/Sonic-player.git 2>/dev/null
    cd Sonic-player
    SCRIPT_DIR="$(pwd)"
    ok "Project cloned"
  fi
}

# ─────────────────────────────────────────────────────────
# 3. Start the backend
# ─────────────────────────────────────────────────────────
start_backend() {
  # Kill any old backend — طرق كتير عشان نضمن
  fuser -k 8005/tcp 2>/dev/null || true
  pkill -f "server.py" 2>/dev/null || true
  pkill -f "python3.*8005" 2>/dev/null || true
  # Last resort: use lsof
  if command -v lsof &>/dev/null; then
    lsof -ti:8005 | xargs kill -9 2>/dev/null || true
  fi
  sleep 1
  # Double-check port is free
  if curl -s http://localhost:8005/health >/dev/null 2>&1; then
    warn "Port 8005 still in use — killing by force..."
    fuser -k -9 8005/tcp 2>/dev/null || true
    sleep 1
  fi

  info "Starting backend on port 8005..."
  cd "$SCRIPT_DIR/backend"
  python3 server.py &
  BACKEND_PID=$!
  cd "$SCRIPT_DIR"

  # Wait and check with health endpoint
  for i in 1 2 3 4 5; do
    sleep 1
    if curl -s http://localhost:8005/health >/dev/null 2>&1; then
      ok "Backend running on http://localhost:8005"
      return 0
    fi
  done
  warn "Backend failed to start — check: cd backend && python3 server.py"
  return 1
}

# ─────────────────────────────────────────────────────────
# 4. Start the frontend
# ─────────────────────────────────────────────────────────
start_frontend() {
  # Kill any old frontend
  pkill -f "next dev" 2>/dev/null || true
  pkill -f "next start" 2>/dev/null || true
  sleep 0.5

  if [ "$IS_TERMUX" = true ]; then
    info "Starting frontend (Termux — Webpack mode)..."
    npx next dev -p 3004 --webpack 2>/dev/null &
  else
    if [ -d ".next" ]; then
      info "Starting frontend (production)..."
      npx next start -p 3004 2>/dev/null &
    else
      info "Starting frontend (dev mode)..."
      npx next dev -p 3004 2>/dev/null &
    fi
  fi

  FRONTEND_PID=$!
  sleep 4
  if curl -s -o /dev/null -w "" http://localhost:3004 2>/dev/null; then
    ok "Frontend running on http://localhost:3004"
  else
    warn "Frontend still loading... (try again in a few seconds)"
  fi
}

# ─────────────────────────────────────────────────────────
# 5. Show status
# ─────────────────────────────────────────────────────────
show_status() {
  echo ""
  echo -e "  ${GREEN}╔══════════════════════════════════════╗${NC}"
  echo -e "  ${GREEN}║${NC}  🎵 ${BOLD}Sonic Player is running!${NC}      ${GREEN}║${NC}"
  echo -e "  ${GREEN}║${NC}                                     ${GREEN}║${NC}"
  echo -e "  ${GREEN}║${NC}  🌐  http://localhost:3004           ${GREEN}║${NC}"
  echo -e "  ${GREEN}║${NC}  ⚙️   http://localhost:8005           ${GREEN}║${NC}"
  echo -e "  ${GREEN}║${NC}                                     ${GREEN}║${NC}"
  echo -e "  ${GREEN}║${NC}  ${YELLOW}⚠${NC} Press Ctrl+C to stop           ${GREEN}║${NC}"
  echo -e "  ${GREEN}╚══════════════════════════════════════╝${NC}"
  echo ""
}

# ─────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────

echo ""
echo -e "  ${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "  ${CYAN}║${NC}  🎵 ${BOLD}Sonic Player${NC}                    ${CYAN}║${NC}"
  echo -e "  ${CYAN}║${NC}  by NEXORA                         ${CYAN}║${NC}"
echo -e "  ${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

# Parse command: install, update, start, or all (default)
CMD="${1:-start}"

case "$CMD" in
  install|setup)
    install_deps
    ;;
  update)
    update_project
    install_deps
    ;;
  start|run|"")
    update_project
    install_deps
    start_backend
    start_frontend
    show_status
    # Wait for Ctrl+C
    trap "echo ''; info 'Stopping...'; pkill -f 'python3 server.py' 2>/dev/null; pkill -f 'next' 2>/dev/null; ok 'Stopped.'; exit 0" INT TERM
    wait
    ;;
  *)
    echo -e "  ${YELLOW}Usage:${NC} bash sonic.sh [install|update|start]"
    echo -e "  ${YELLOW}       ${NC}bash sonic.sh       → full setup + start"
    echo -e "  ${YELLOW}       ${NC}bash sonic.sh start → same as above"
    echo -e "  ${YELLOW}       ${NC}bash sonic.sh install → install deps only"
    echo -e "  ${YELLOW}       ${NC}bash sonic.sh update  → git pull + install deps"
    ;;
esac
