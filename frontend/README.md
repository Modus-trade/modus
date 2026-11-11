# Модус Трейд — фронтенд (React + Vite)

## Запуск у себя

Нужен Node 22+.

```bash
npm install
npm run dev                      # http://localhost:5173
```

Запросы `/api` проксируются на локальный бэкенд `http://127.0.0.1:8000`
(запустите репозиторий `modus-back`, см. его README). Вход: любой демо-пользователь, пароль `demo1234`.

Другой адрес бэкенда — создайте файл `.env.local`:

```
API_TARGET=http://127.0.0.1:8001
```

Тесты: `npm test`, сборка: `npm run build`.

## Как попадает на сервер

Пуш в `main` → GitHub Actions: тесты и сборка → выкладка на https://modus-trade.makquiz.site
без простоя → копия в репозиторий `modus/frontend`. Если сборка упала — сайт не меняется.
