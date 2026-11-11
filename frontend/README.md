# Модус Трейд — сайт

Веб-интерфейс системы обратной связи сотрудников. Работает с API из [modus-back](https://github.com/Modus-trade/modus-back).
Демо: https://modus-trade.makquiz.site · Полный проект и документация: [Modus-trade/modus](https://github.com/Modus-trade/modus)

## Запуск у себя

Нужен Node.js 22+. Сначала запустите бэкенд (см. README `modus-back`), затем:

```bash
npm ci
npm run dev            # http://localhost:5173
```

Запросы `/api` и WebSocket `/api/ws` проксируются на `http://127.0.0.1:8000`, поэтому cookie сессии работает как на боевом сайте.
Вход: `employee@modus.demo`, `manager.procurement@modus.demo` или `admin@modus.demo`, пароль `demo1234`.

Если бэкенд на другом адресе, создайте `.env.local`:

```
API_TARGET=http://127.0.0.1:8001
```

| Команда | Что делает |
| --- | --- |
| `npm run dev` | разработка с горячей перезагрузкой |
| `npm test` | тесты |
| `npm run build` | проверка TypeScript и сборка в `dist/` |

## Структура

```text
src/
  App.tsx               маршруты, шапка, вход
  Dashboard.tsx         обзор и аналитика
  Tickets.tsx           список, фильтры, создание обращения
  TicketDetail.tsx      карточка: обсуждение, статусы, результат, история
  Attention.tsx         центр внимания администратора
  Administration.tsx    категории и пользователи
  realtime.ts           WebSocket: живые обновления и уведомления
  components/           колокольчик, UI-компоненты
  lib.ts                axios-клиент и типы
public/                 логотип, favicon, шрифт Manrope
```

Стек: React 18, TypeScript, Vite, TanStack Query, React Router, React Hook Form + Zod, Recharts, Tailwind.

## Деплой

Пуш в `main` запускает GitHub Actions:
1. тесты и сборка;
2. выкладка на https://modus-trade.makquiz.site без простоя (`index.html` заменяется последним);
3. копия кода в `Modus-trade/modus/frontend`.

Если сборка падает, сайт не меняется. Статус виден во вкладке **Actions**.
