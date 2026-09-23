#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# Sonic Player — Setup & Install Script
# Works on Linux, macOS, and Termux (Android)
# ═══════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

# Detect OS
detect_os() {
  if [ -n "$TERMUX_VERSION" ]; then
    echo "termux"
  elif [ "$(uname)" = "Darwin" ]; then
    echo "macos"
  elif [ "$(uname)" = "Linux" ]; then
    echo "linux"
  else
    echo "unknown"
  fi
}

OS=$(detect_os)

print_banner() {
  echo ""
  echo -e "  ${CYAN}┌──────────────────────────┐${NC}"
  echo -e "  ${CYAN}│${NC}  ${BOLD}🎵 Sonic Player${NC}          ${CYAN}│${NC}"
  echo -e "  ${CYAN}│${NC}  by NEXORA                 ${CYAN}│${NC}"
  echo -e "  ${CYAN}└──────────────────────────┘${NC}"
  echo ""
  echo -e "  ${PURPLE}📱${NC} OS Detected: ${BOLD}$OS${NC}"
  echo ""
}

step() {
  echo -e "\n  ${GREEN}━━━${NC} ${BOLD}$1${NC}"
}

info() {
  echo -e "  ${CYAN}→${NC} $1"
}

ok() {
  echo -e "  ${GREEN}✓${NC} $1"
}

warn() {
  echo -e "  ${YELLOW}⚠${NC} $1"
}

fail() {
  echo -e "  ${RED}✗${NC} $1"
}

spinner() {
  local pid=$1
  local msg=$2
  local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
  local i=0
  while kill -0 "$pid" 2>/dev/null; do
    printf "\r  ${CYAN}%s${NC} %s" "${spin:$i:1}" "$msg"
    i=$(( (i+1) % ${#spin} ))
    sleep 0.1
  done
  printf "\r${GREEN}  ✓${NC} %-50s\n" "$msg"
}

# ─────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────

print_banner

# ── 1. System Dependencies ──
step "1/5  Checking System Dependencies"

if [ "$OS" = "termux" ]; then
  PKG_MANAGER="pkg"
  PKG_INSTALL="$PKG_MANAGER install -y"
  
  # Check if pkg is available
  if ! command -v pkg &>/dev/null; then
    fail "pkg not found. Are you in Termux?"
    exit 1
  fi

  for dep in nodejs python ffmpeg; do
    if command -v "$dep" &>/dev/null; then
      ok "$dep already installed"
    else
      info "Installing $dep..."
      $PKG_INSTALL "$dep" 2>&1
      ok "$dep installed"
    fi
  done
else
  # Linux / macOS
  for dep in node python3; do
    if command -v "$dep" &>/dev/null; then
      ok "$dep $(command -v $dep)"
    else
      if [ "$dep" = "node" ]; then
        warn "Node.js not found. Attempting to install..."
        if command -v nvm &>/dev/null; then
          nvm install 18 2>&1
        elif command -v apt-get &>/dev/null; then
          # Debian/Ubuntu — install via NodeSource
          curl -fsSL https://deb.nodesource.com/setup_22.x | bash - 2>&1 | tail -5
          apt-get install -y nodejs 2>&1 | tail -5
        elif command -v brew &>/dev/null; then
          brew install node 2>&1 | tail -5
        elif command -v pkg &>/dev/null; then
          pkg install -y nodejs 2>&1
        else
          fail "Cannot auto-install Node.js. Please install Node.js 18+ manually."
          fail "Visit: https://nodejs.org or use nvm: https://github.com/nvm-sh/nvm"
          exit 1
        fi
        if ! command -v node &>/dev/null; then
          fail "Node.js installation failed. Please install Node.js 18+ manually."
          exit 1
        fi
        ok "Node.js installed: $(node --version)"
      else
        fail "$dep not found. Please install Python 3."
        exit 1
      fi
    fi
  done

  # Check ffmpeg
  if command -v ffmpeg &>/dev/null; then
    ok "ffmpeg $(ffmpeg -version 2>&1 | head -1 | grep -oP 'version \K[^ ]+' || echo 'found')"
  else
    warn "ffmpeg not found. Install: sudo apt install ffmpeg (Linux) or brew install ffmpeg (macOS)"
  fi
fi

# ── 2. Python Backend Dependencies ──
step "2/5  Installing Python Backend Packages"

cd "$(dirname "$0")"

if [ "$OS" = "termux" ]; then
  PYTHON=python
  PIP="python -m pip"
  # Install pip if missing
  if ! $PYTHON -m pip --version &>/dev/null; then
    info "Installing python-pip..."
    pkg install -y python-pip 2>&1
  fi
else
  PYTHON=python3
  # Detect pip command properly
  if command -v pip3 &>/dev/null; then
    PIP=pip3
  elif command -v pip &>/dev/null; then
    PIP=pip
  else
    PIP="$PYTHON -m pip"
  fi
fi

if [ "$OS" = "termux" ]; then
  # Termux: install yt-dlp via pkg (no Rust needed!)
  info "Installing yt-dlp via pkg..."
  pkg install -y yt-dlp 2>&1
  if command -v yt-dlp &>/dev/null; then
    ok "yt-dlp installed via pkg"
  else
    warn "yt-dlp install via pkg failed, trying pip..."
    $PYTHON -m pip install yt-dlp 2>&1
  fi
else
  # Linux/macOS: only need yt-dlp (stdlib handles everything else)
  # -U ensures stale installs get upgraded (old yt-dlp = YouTube 403 = no playback)
  info "Installing/upgrading yt-dlp..."
  $PIP install -U yt-dlp 2>&1 || $PIP install -U --break-system-packages yt-dlp 2>&1
fi

if command -v yt-dlp &>/dev/null || $PYTHON -c "import yt_dlp" 2>/dev/null; then
  ok "yt-dlp ready ✓"
else
  warn "yt-dlp not found. Install manually: pkg install yt-dlp (Termux) or pip install yt-dlp"
fi

ok "Backend uses Python stdlib — zero extra packages needed! ✓"

# ── 3. Node.js Frontend Dependencies ──
step "3/5  Installing Frontend (npm) Packages"

info "Installing Next.js, React, and dependencies..."
echo ""
if [ -d "node_modules" ] && [ -f "node_modules/next/package.json" ]; then
  ok "node_modules with Next.js found — skipping npm install"
else
  if [ -d "node_modules" ]; then
    warn "node_modules موجود بس packages ناقصة — هانصب من الأول..."
    rm -rf node_modules .next
  fi
  npm install 2>&1
  echo ""
  if [ -d "node_modules/.bin/next" ] || [ -f "node_modules/.bin/next" ]; then
    ok "Frontend dependencies installed"
  else
    fail "npm install failed. Check your internet connection."
  fi
fi

# ── 4. Create Downloads Folder ──
step "4/5  Setting Up Local Storage"

mkdir -p backend/downloads
ok "Downloads folder ready: backend/downloads/"

# ── 5. Build Frontend ──
step "5/5  Building Frontend"

if [ -d ".next" ]; then
  info "Removing old build cache..."
  rm -rf .next
fi

info "Building Sonic Player ..."
echo ""
npx next build 2>&1
echo ""
if [ -d ".next" ]; then
  ok "Build complete! ✓"
else
  warn "Build failed. You can run 'npm run build' manually later."
fi

# ── Done ──
echo ""
echo -e "  ${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "  ${GREEN}║${NC}  🎵 ${BOLD}Sonic Player is ready!${NC}         ${GREEN}║${NC}"
echo -e "  ${GREEN}║${NC}                                     ${GREEN}║${NC}"
echo -e "  ${GREEN}║${NC}  Run:  ${CYAN}./start.sh${NC}                   ${GREEN}║${NC}"
echo -e "  ${GREEN}║${NC}        or                           ${GREEN}║${NC}"
echo -e "  ${GREEN}║${NC}        ${CYAN}sh start.sh${NC}                    ${GREEN}║${NC}"
echo -e "  ${GREEN}║${NC}                                     ${GREEN}║${NC}"
echo -e "  ${GREEN}║${NC}  📱  Frontend → http://localhost:3004 ${GREEN}║${NC}"
echo -e "  ${GREEN}║${NC}  ⚙️   Backend  → http://localhost:8005 ${GREEN}║${NC}"
echo -e "  ${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""
