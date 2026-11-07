#!/bin/bash
# 로보메이커스 워드블럭 — macOS 로컬 실행 (더블클릭)
cd "$(dirname "$0")"
PORT=8000
while lsof -i :$PORT >/dev/null 2>&1; do PORT=$((PORT+1)); done
URL="http://localhost:$PORT/"
echo ""
echo "  로보메이커스 워드블럭 실행 중: $URL"
echo "  이 창을 닫으면 종료됩니다."
echo ""
( sleep 1; open -a "Google Chrome" "$URL" 2>/dev/null || open "$URL" ) &
if command -v python3 >/dev/null 2>&1 && python3 -c 'import http.server' 2>/dev/null; then
  exec python3 -m http.server $PORT --bind 127.0.0.1
elif command -v ruby >/dev/null 2>&1; then
  exec ruby -run -e httpd . -p $PORT -b 127.0.0.1
else
  echo "python3 가 필요합니다. 터미널에서 'xcode-select --install' 을 실행한 뒤 다시 더블클릭하세요."
  read -r
fi
