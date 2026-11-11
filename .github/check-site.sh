#!/usr/bin/env bash
# Проверка из CI: сайт открылся, API доступен через него, демо-пользователь входит.
set -euo pipefail
URL=${1:-http://127.0.0.1:5173}
for _ in $(seq 1 90); do curl -fs -o /dev/null "$URL" && break; sleep 2; done
curl -fs "$URL" | grep -q 'id="root"' || { echo "Сайт не открылся"; exit 1; }
for _ in $(seq 1 60); do curl -fs "$URL/api/health" >/dev/null && break; sleep 2; done
jar=$(mktemp)
curl -fs -c "$jar" -H 'Content-Type: application/json' -H "Origin: $URL" \
  -d '{"email":"admin@modus.demo","password":"demo1234"}' "$URL/api/auth/login" >/dev/null
total=$(curl -fs -b "$jar" "$URL/api/tickets" | python3 -c 'import json,sys; print(json.load(sys.stdin)["total"])')
[ "$total" -gt 0 ] || { echo "Нет демо-обращений"; exit 1; }
echo "Сайт работает, вход выполнен, обращений: $total"
