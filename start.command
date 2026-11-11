#!/bin/zsh
set -e
unsetopt BG_NICE
cd "${0:A:h}"
if [[ ! -x backend/.venv/bin/python || ! -d frontend/node_modules ]]; then
  echo 'Сначала установите зависимости по инструкции в README.md.'
  read '?Нажмите Enter для выхода…'
  exit 1
fi
echo 'Модус: http://127.0.0.1:5173'
echo 'Для остановки нажмите Ctrl+C или закройте терминал.'
backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 &
modus_backend_pid=$!
trap 'kill "$modus_backend_pid" 2>/dev/null || true' EXIT
trap 'exit 0' INT TERM
npm --prefix frontend run dev
