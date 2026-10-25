#!/bin/bash
# 截图工具：用无头 Chrome 渲染页面并保存 PNG。
# 所有临时文件都落在项目内的 .chrome/ 目录，不写工作区之外，因此不需要额外授权。
#
# 用法：
#   scripts/shot.sh <url> <输出文件> [宽] [高]
# 例子：
#   scripts/shot.sh http://127.0.0.1:4321/ shots/home.png 1280 1000
#   scripts/shot.sh http://127.0.0.1:4321/ shots/mobile.png 390 844

set -u

URL="${1:?用法: scripts/shot.sh <url> <输出文件> [宽] [高]}"
OUT="${2:?缺少输出文件路径}"
W="${3:-1280}"
H="${4:-900}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
WORK="$ROOT/.chrome"
PROFILE="$WORK/profile-$$"

# 清掉上一次可能残留的实例，避免锁文件和重复弹窗
pkill -f "user-data-dir=$WORK/profile-" 2>/dev/null

mkdir -p "$WORK/home" "$WORK/tmp" "$(dirname "$OUT")"
rm -rf "$PROFILE"
mkdir -p "$PROFILE"
rm -f "$OUT"

HOME="$WORK/home" TMPDIR="$WORK/tmp" "$CHROME" \
  --headless=new \
  --no-sandbox \
  --disable-gpu \
  --hide-scrollbars \
  --no-first-run \
  --no-default-browser-check \
  --disable-crash-reporter \
  --disable-breakpad \
  --password-store=basic \
  --use-mock-keychain \
  --disable-sync \
  --crash-dumps-dir="$WORK/tmp" \
  --disk-cache-dir="$WORK/tmp" \
  --user-data-dir="$PROFILE" \
  --window-size="$W,$H" \
  --virtual-time-budget=4000 \
  --screenshot="$OUT" \
  "$URL" >"$WORK/last-run.log" 2>&1 &
PID=$!

# 等文件出现（Chrome 截图后常常不退出，等文件比等进程可靠）
for _ in $(seq 1 60); do
  [ -s "$OUT" ] && break
  sleep 0.5
done
sleep 0.5

kill "$PID" 2>/dev/null
wait "$PID" 2>/dev/null || true
pkill -f "user-data-dir=$PROFILE" 2>/dev/null
sleep 0.2
rm -rf "$PROFILE"

if [ -s "$OUT" ]; then
  echo "OK  $OUT  $(du -h "$OUT" | cut -f1)  ${W}x${H}"
else
  echo "FAIL  渲染失败，日志：$WORK/last-run.log"
  tail -5 "$WORK/last-run.log"
  exit 1
fi
