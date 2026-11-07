#!/bin/bash
# 로보메이커스 워드블럭 — 리눅스/크롬북(Linux) 로컬 실행
cd "$(dirname "$0")"
PORT=${1:-8000}
URL="http://localhost:$PORT/"
echo "로보메이커스 워드블럭 실행 중: $URL  (Ctrl+C 로 종료)"
( sleep 1; (google-chrome "$URL" || chromium "$URL" || xdg-open "$URL") >/dev/null 2>&1 ) &
exec python3 -m http.server "$PORT" --bind 127.0.0.1
