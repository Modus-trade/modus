#!/bin/zsh
set -e
unsetopt BG_NICE
cd "${0:A:h}"
modus_api_dir=backend
modus_ui_dir=frontend
[[ -d modus-back ]] && modus_api_dir=modus-back
[[ -d modus-front ]] && modus_ui_dir=modus-front
export MODUS_BACKEND_DIR="$modus_api_dir"
if [[ ! -x "$modus_api_dir/.venv/bin/python" || ! -d "$modus_ui_dir/node_modules" ]]; then
  echo 'Сначала установите зависимости по инструкции в README.md.'
  read '?Нажмите Enter для выхода…'
  exit 1
fi
# Единая база на сервере: держим SSH-туннель (сам переподключается при смене сети).
if grep -qE '^DB_TUNNEL=' "$modus_api_dir/.env" 2>/dev/null; then
  ./db-tunnel.sh &
  modus_tunnel_pid=$!
  for i in {1..15}; do nc -z 127.0.0.1 5433 2>/dev/null && break; sleep 1; done
fi
(cd "$modus_api_dir" && .venv/bin/python -m alembic upgrade head)
echo 'Модус: http://127.0.0.1:5173'
echo 'Для остановки нажмите Ctrl+C или закройте терминал.'
"$modus_api_dir/.venv/bin/python" -m uvicorn app.main:app --app-dir "$modus_api_dir" --host 127.0.0.1 --port 8000 &
modus_backend_pid=$!
trap 'kill "$modus_backend_pid" ${modus_tunnel_pid:-} 2>/dev/null || true' EXIT
trap 'exit 0' INT TERM
npm --prefix "$modus_ui_dir" run dev
