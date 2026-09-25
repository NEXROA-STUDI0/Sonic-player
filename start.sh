#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# Sonic Player — Start Script
# Starts both Frontend (Next.js :3004) + Backend (stdlib :8005)
# ═══════════════════════════════════════════════════════════

set +e  # Don't exit on error - we handle them

# ── Kill only OUR processes (never touch other apps) ──
pkill -f "backend/server.py" 2>/dev/null
pkill -f "next-server" 2>/dev/null
pkill -f "next start" 2>/dev/null
pkill -f "next dev" 2>/dev/null
sleep 1

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "  ${CYAN}┌──────────────────────────┐${NC}"
echo -e "  ${CYAN}│${NC}  ${BOLD}🎵 Sonic Player${NC}          ${CYAN}│${NC}"
echo -e "  ${CYAN}│${NC}  by NEXORA                 ${CYAN}│${NC}"
echo -e "  ${CYAN}└──────────────────────────┘${NC}"
echo -e "  ${YELLOW}⚠️  تنبيه أمني — هذا التطبيق للأغراض التعليمية فقط.${NC}"
echo -e "  ${YELLOW}   استخدام YouTube قد يخالف شروط الخدمة (ToS).${NC}"
echo -e "  ${YELLOW}   المستخدم وحده يتحمل المسؤولية.${NC}"
echo ""

# ── Check if install needed ──
if [ ! -d "node_modules" ] || [ ! -f "node_modules/next/package.json" ]; then
  echo -e "  ${YELLOW}⚠ Dependencies not found. Running install first...${NC}"
  bash install.sh
  echo ""
fi

# ── Detect Python command ──
if command -v python3 &>/dev/null; then
  PYTHON=python3
else
  PYTHON=python
fi

# ── Detect OS ──
if [ -n "$TERMUX_VERSION" ]; then
  IS_TERMUX=true
  NEXT_CMD="npx next dev -p 3004 --webpack"
else
  IS_TERMUX=false
  NEXT_CMD="npx next start -p 3004"
fi

# ── Check Node version (Next.js needs >= 20) ──
if command -v node &>/dev/null; then
  NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null)
  if [ "${NODE_MAJOR:-0}" -lt 20 ]; then
    echo -e "  ${RED}✗${NC} Node.js >= 20 required (found v$(node --version)). Update Node first."
    exit 1
  fi
else
  echo -e "  ${RED}✗${NC} Node.js not found. Install Node >= 20 first."
  exit 1
fi

# ── Check yt-dlp availability AND freshness ──
# Stale yt-dlp = YouTube 403 = songs won't play. Upgrade if older than ~180 days.
echo -e "  ${CYAN}→${NC} Checking yt-dlp..."
YTDLP_STATUS=$($PYTHON -c "
try:
    import yt_dlp, datetime
    v = yt_dlp.version.__version__
    p = [int(x) for x in v.split('.')[:3]]
    while len(p) < 3:
        p.append(1)
    age = (datetime.date.today() - datetime.date(p[0], p[1], min(p[2], 28))).days
    print('STALE' if age > 180 else 'FRESH:' + v)
except Exception:
    print('MISSING')
" 2>/dev/null)
if [[ "$YTDLP_STATUS" == FRESH:* ]]; then
  echo -e "  ${GREEN}✓${NC} yt-dlp ${YTDLP_STATUS#FRESH:} (fresh)"
else
  if [[ "$YTDLP_STATUS" == "STALE" ]]; then
    echo -e "  ${YELLOW}⚠${NC} yt-dlp is outdated (YouTube will block it) — upgrading..."
  else
    echo -e "  ${YELLOW}⚠${NC} yt-dlp not found — installing..."
  fi
  $PYTHON -m pip install -U yt-dlp -q 2>/dev/null || $PYTHON -m pip install -U --break-system-packages yt-dlp -q
  if $PYTHON -c "import yt_dlp" >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} yt-dlp ready ($($PYTHON -c "import yt_dlp; print(yt_dlp.version.__version__)" 2>/dev/null))"
  else
    echo -e "  ${RED}✗${NC} yt-dlp installation failed — backend may not work correctly"
  fi
fi

# ── Bot-wall probe: can this network actually stream from YouTube? ──
# Search works even when streams are blocked, so test a real extraction.
echo -e "  ${CYAN}→${NC} Probing YouTube playback..."
PROBE_OUT=$($PYTHON -m yt_dlp --skip-download --no-warnings --socket-timeout 8 --retries 0 --print id "https://www.youtube.com/watch?v=WT1t0X-18w8" 2>&1)
if [ "$PROBE_OUT" = "WT1t0X-18w8" ]; then
  echo -e "  ${GREEN}✓${NC} YouTube playback OK"
elif echo "$PROBE_OUT" | grep -qi "sign in to confirm"; then
  echo -e "  ${RED}✗${NC} YouTube is blocking streams on this network (bot check)."
  echo -e "     Search & lyrics will work, but audio needs login cookies:"
  echo -e "     1) Install the 'Get cookies.txt LOCALLY' browser extension"
  echo -e "     2) Log into YouTube, export cookies to cookies.txt in this folder"
  echo -e "     3) Restart with: SONIC_YTDLP_COOKIES=cookies.txt bash start.sh"
else
  echo -e "  ${YELLOW}⚠${NC} Playback probe inconclusive — continuing anyway"
fi

# ── Start Backend ──
echo -e "  ${GREEN}━━━${NC} ${BOLD}Starting Backend (port 8005)...${NC}"
cd backend
$PYTHON server.py &
BACKEND_PID=$!
cd ..
sleep 2
# Check backend with actual HTTP request
if curl -s http://localhost:8005/health >/dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} Backend running on http://localhost:8005"
else
  # Try waiting a bit more
  sleep 2
  if curl -s http://localhost:8005/health >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Backend running on http://localhost:8005"
  else
    echo -e "  ${RED}✗${NC} Backend failed to start — trying once more..."
    pkill -f "python3 server.py" 2>/dev/null
    sleep 1
    cd backend && $PYTHON server.py &
    BACKEND_PID=$!
    cd ..
    sleep 3
    if curl -s http://localhost:8005/health >/dev/null 2>&1; then
      echo -e "  ${GREEN}✓${NC} Backend running on http://localhost:8005"
    else
      echo -e "  ${RED}✗${NC} Backend still not responding. Run manually: cd Sonic-player/backend && python3 server.py"
    fi
  fi
fi

# ── Start Frontend ──
echo -e "  ${GREEN}━━━${NC} ${BOLD}Starting Frontend (port 3004)...${NC}"

if [ "$IS_TERMUX" = true ]; then
  # Termux: use dev mode with Webpack (Turbopack doesn't support ARM64)
  echo -e "  ${CYAN}→${NC} Termux detected — using Webpack mode"
  $NEXT_CMD &
  FRONTEND_PID=$!
  sleep 5
elif [ -d ".next" ]; then
  # Has production build
  $NEXT_CMD &
  FRONTEND_PID=$!
  sleep 3
  if kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Frontend running on http://localhost:3004"
  else
    echo -e "  ${YELLOW}⚠${NC} Production start failed — trying dev mode..."
    npx next dev -p 3004 &
    FRONTEND_PID=$!
    sleep 4
  fi
else
  # No build — dev mode
  echo -e "  ${CYAN}→${NC} No production build found — starting dev mode"
  npx next dev -p 3004 &
  FRONTEND_PID=$!
  sleep 4
fi

echo ""
echo -e "  ${CYAN}┌─────────────────────────────────────┐${NC}"
echo -e "  ${CYAN}│${NC}  🌐  ${BOLD}http://localhost:3004${NC}              ${CYAN}│${NC}"
echo -e "  ${CYAN}│${NC}  ⚙️   ${BOLD}http://localhost:8005${NC}              ${CYAN}│${NC}"
echo -e "  ${CYAN}└─────────────────────────────────────┘${NC}"
echo ""
echo -e "  ${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# Trap to kill both on exit
cleanup() {
  echo ""
  echo -e "  ${CYAN}→${NC} Stopping services..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  echo -e "  ${GREEN}✓${NC} Stopped."
  exit 0
}
trap cleanup INT TERM

wait
