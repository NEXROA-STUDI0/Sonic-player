#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# Sonic Player — Playback Triage
# Answers "songs won't play" in ~30 seconds with a verdict.
# Usage: bash scripts/diagnose.sh [BACKEND_URL] [VIDEO_ID]
# ═══════════════════════════════════════════════════════════
BASE="${1:-http://localhost:8005}"
VID="${2:-WT1t0X-18w8}"

echo "── Sonic playback triage ──"
echo "Backend: $BASE"
echo ""

# 1) Backend reachable?
HEALTH=$(curl -s -m 10 "$BASE/health" 2>/dev/null)
if [ -z "$HEALTH" ]; then
  echo "[FAIL] Backend is not responding."
  echo "FIX: start it:  python3 backend/server.py"
  exit 1
fi
echo "[OK] Backend responds."

# 2) yt-dlp status (from backend itself)
YTDLP=$(echo "$HEALTH" | python3 -c "import json,sys; print(json.load(sys.stdin).get('ytdlp', {}))" 2>/dev/null)
echo "yt-dlp info: $YTDLP"
if echo "$HEALTH" | python3 -c "import json,sys; exit(0 if json.load(sys.stdin).get('ytdlp',{}).get('available') else 1)" 2>/dev/null; then
  FRESH=$(echo "$HEALTH" | python3 -c "import json,sys; print(json.load(sys.stdin).get('ytdlp',{}).get('fresh'))" 2>/dev/null)
  if [ "$FRESH" = "True" ]; then
    echo "[OK] yt-dlp installed and fresh."
  else
    echo "[FAIL] yt-dlp is OUTDATED (YouTube blocks old versions)."
    echo "FIX: python3 -m pip install -U yt-dlp  (then restart backend)"
    exit 1
  fi
else
  echo "[FAIL] yt-dlp is MISSING on the server."
  echo "FIX: python3 -m pip install yt-dlp  (then restart backend)"
  exit 1
fi

# 3) Cookies configured?
COOKIES=$(echo "$HEALTH" | python3 -c "import json,sys; print(json.load(sys.stdin).get('cookies'))" 2>/dev/null)
echo "cookies configured: $COOKIES"

# 4) Live extraction probe (the real playback path)
echo ""
echo "Probing stream extraction (up to 60s)..."
CODE=$(curl -s -m 90 -o /dev/null -w "%{http_code}" "$BASE/stream/$VID" 2>/dev/null)
if [ "$CODE" = "200" ]; then
  echo "[OK] Extraction works (HTTP 200). Playback path is clear."
  echo "If a song still fails, try another track (that video may be restricted)."
elif [ "$CODE" = "503" ]; then
  echo "[FAIL] YouTube is blocking streams on this network (bot check, HTTP 503)."
  echo "FIX:"
  echo "  1) Install the 'Get cookies.txt LOCALLY' browser extension"
  echo "  2) Log into youtube.com, export cookies to cookies.txt in this folder"
  echo "  3) Restart: SONIC_YTDLP_COOKIES=cookies.txt bash start.sh"
  exit 1
else
  echo "[FAIL] Unexpected response from /stream/: HTTP $CODE"
  echo "FIX: check the backend terminal for errors."
  exit 1
fi

echo ""
echo "All checks passed."
