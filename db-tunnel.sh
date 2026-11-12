#!/bin/zsh
# Держит SSH-туннель к общей базе: при смене сети или обрыве поднимает его заново.
# Запуск: ./db-tunnel.sh  (адрес сервера берётся из "$modus_api_dir/.env", DB_TUNNEL=...)
cd "${0:A:h}"
modus_api_dir=${MODUS_BACKEND_DIR:-modus-back}
HOST=$(grep -E '^DB_TUNNEL=' "$modus_api_dir/.env" 2>/dev/null | cut -d= -f2-)
[[ -z "$HOST" ]] && { echo 'В "$modus_api_dir/.env" не задан DB_TUNNEL'; exit 1; }
while true; do
  if ! nc -z -w 3 127.0.0.1 5433 2>/dev/null || ! "$modus_api_dir/.venv/bin/python" -c "
import psycopg,os,sys
url=[l.split('=',1)[1].strip() for l in open(os.environ.get('MODUS_BACKEND_DIR', 'modus-back') + '/.env') if l.startswith('DATABASE_URL=')][0]
psycopg.connect(url.replace('postgresql+psycopg','postgresql'), connect_timeout=5).close()" 2>/dev/null; then
    pkill -f "5433:127.0.0.1:5433" 2>/dev/null
    ssh -f -N -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=2 \
      -L 5433:127.0.0.1:5433 "$HOST" && echo "$(date '+%H:%M:%S') туннель к базе поднят"
  fi
  sleep 10
done
