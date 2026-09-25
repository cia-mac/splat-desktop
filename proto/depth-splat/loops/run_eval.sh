#!/bin/zsh
# usage: run_eval.sh <cfgfile relative to proto dir> <tag> [extra query]
cd "$(dirname "$0")/../results" || exit 1
CFG="$1"; TAG="$2"; EXTRA="$3"
rm -f eval_${TAG}.json eval_partial.json
osascript -e 'tell application "Safari" to quit' 2>/dev/null; sleep 2
open -a Safari "http://127.0.0.1:8791/?eval=1&tag=${TAG}&cfgfile=${CFG}&r=${TAG}${EXTRA}"
for i in $(seq 1 120); do [ -f eval_${TAG}.json ] && break; sleep 4; done
[ -f eval_${TAG}.json ] && echo "done ${TAG}" || echo "TIMEOUT ${TAG}"
