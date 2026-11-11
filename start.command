#!/bin/zsh
set -e
unsetopt BG_NICE
cd "${0:A:h}"
if [[ ! -x backend/.venv/bin/python || ! -d frontend/node_modules ]]; then
  echo 'Сначала установите зависимости по инструкции в README.md.'
  read '?Нажмите Enter для выхода…'
  exit 1
fi
# Единая база на сервере: поднимаем SSH-туннель, если он указан в backend/.env.
DB_TUNNEL=$(grep -E '^DB_TUNNEL=' backend/.env 2>/dev/null | cut -d= -f2-)
if [[ -n "$DB_TUNNEL" ]] && ! pgrep -f "5433:127.0.0.1:5433" >/dev/null; then
  echo "Подключение к базе на сервере $DB_TUNNEL…"
  ssh -f -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -L 5433:127.0.0.1:5433 "$DB_TUNNEL" || {
    echo 'Не удалось подключиться к серверу базы данных.'; read '?Нажмите Enter для выхода…'; exit 1; }
fi
(cd backend && .venv/bin/python -m alembic upgrade head)
echo 'Модус: http://127.0.0.1:5173'
echo 'Для остановки нажмите Ctrl+C или закройте терминал.'
backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 &
modus_backend_pid=$!
trap 'kill "$modus_backend_pid" 2>/dev/null || true' EXIT
trap 'exit 0' INT TERM
npm --prefix frontend run dev
