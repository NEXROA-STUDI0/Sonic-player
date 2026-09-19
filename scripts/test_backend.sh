#!/usr/bin/env bash
set -u

BASE_URL="${BASE_URL:-http://localhost:8005}"
failures=0

check() {
  local name="$1"
  local expected_status="$2"
  local url="$3"
  local body status
  body=$(curl --max-time 20 -sS -w $'\n%{http_code}' "$url") || {
    echo "FAIL $name: request failed"
    failures=$((failures + 1))
    return
  }
  status="${body##*$'\n'}"
  body="${body%$'\n'*}"
  if [[ "$status" != "$expected_status" ]]; then
    echo "FAIL $name: expected HTTP $expected_status, got $status; body=$body"
    failures=$((failures + 1))
    return
  fi
  echo "PASS $name: HTTP $status"
}

check "health" 200 "$BASE_URL/health"
check "missing search query" 400 "$BASE_URL/search"
check "invalid search limit" 400 "$BASE_URL/search?q=test&limit=abc"
check "invalid search offset" 400 "$BASE_URL/search?q=test&offset=abc"
check "invalid playlist limit" 400 "$BASE_URL/search_playlists?q=test&limit=abc"
check "invalid uploader limit" 400 "$BASE_URL/uploader_tracks?uploader=test&limit=abc"
check "invalid video id" 400 "$BASE_URL/stream/not-a-video-id"
check "blocked proxy domain" 403 "$BASE_URL/proxy?url=http%3A%2F%2Flocalhost%2Fsecret"
check "empty lyrics" 200 "$BASE_URL/lyrics"
check "local file list" 200 "$BASE_URL/local_list"
check "youtube search" 200 "$BASE_URL/search?q=test%20music&limit=3&offset=0"

if [[ "$failures" -gt 0 ]]; then
  echo "$failures backend test(s) failed"
  exit 1
fi

echo "All backend tests passed"
