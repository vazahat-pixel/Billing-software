#!/usr/bin/env bash
# Blocks a deploy when a source file looks like injected/obfuscated code: a very long line, or a long
# run of whitespace hiding code off-screen (how api.js / vite.config.js were tampered with in Oct 2026).
set -euo pipefail
cd "$(dirname "$0")/../.."

bad=0
while IFS= read -r f; do
  [ -f "$f" ] || continue
  if awk 'length($0) > 2000 { exit 1 } /[ \t]{200,}/ { exit 1 }' "$f"; then :; else
    echo "BLOCKED: suspicious long line / hidden whitespace in $f"
    bad=1
  fi
done < <(git ls-files '*.js' '*.cjs' '*.mjs' '*.jsx' '*.ts' '*.json' \
  | grep -v -E '(^|/)(dist|build|node_modules|renderer|coverage)/|\.min\.|package-lock\.json$|/fixtures/|/blueprint/|jsm-blueprint/')

for f in api.js backend/api.js; do
  if [ -e "$f" ]; then echo "BLOCKED: $f must not exist (it was an injected loader)"; bad=1; fi
done
if git grep -n -E '"(start|build|dev|postinstall|preinstall|prepare)":[^,]*node [^"]*api\.js' -- '*package.json' >/dev/null; then
  echo "BLOCKED: a package.json script runs api.js"; bad=1
fi

[ "$bad" -eq 0 ] && echo "obfuscation check passed"
exit "$bad"
