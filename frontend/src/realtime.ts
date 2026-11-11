import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export type AppNotification = {
  id: number;
  kind: "assigned" | "comment" | "clarification" | "status" | "result" | string;
  title: string;
  body: string;
  ticket_id: number;
  ticket_number: string | null;
  ticket_title: string | null;
  actor_name: string | null;
  created_at: string;
  read: boolean;
};

export type NotificationList = { items: AppNotification[]; unread: number };

type ServerEvent =
  | { type: "ticket_changed"; ticket_id: number; reason: string }
  | { type: "notification"; notification: AppNotification };

/** Данные, которые зависят от обращений: перечитываем их при живом событии. */
function refreshTickets(qc: QueryClient, ticketId: number) {
  const keep = new Set(["me", "categories", "assignees", "notifications"]);
  qc.invalidateQueries({
    predicate: (q) => {
      const [key, id] = q.queryKey as [string, unknown];
      if (key === "ticket") return String(id) === String(ticketId);
      return !keep.has(key);
    },
  });
}

/**
 * Живое соединение с сервером: новые обращения, статусы, комментарии и уведомления
 * появляются без перезагрузки. Переподключается сам с нарастающей паузой.
 */
export function useRealtime(userId: number | undefined) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;
    let ws: WebSocket | null = null;
    let stopped = false;
    let attempt = 0;
    let retry: number | undefined;
    let ping: number | undefined;

    const connect = () => {
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${protocol}//${location.host}/api/ws`);
      ws.onopen = () => {
        // После обрыва могли пропустить события — перечитываем всё.
        if (attempt > 0) qc.invalidateQueries();
        attempt = 0;
        ping = window.setInterval(() => ws?.readyState === 1 && ws.send("ping"), 25000);
      };
      ws.onmessage = (e) => {
        if (e.data === "pong") return;
        let event: ServerEvent;
        try {
          event = JSON.parse(e.data);
        } catch {
          return;
        }
        if (event.type === "ticket_changed") refreshTickets(qc, event.ticket_id);
        if (event.type === "notification") {
          const n = event.notification;
          qc.setQueryData<NotificationList>(["notifications"], (old) =>
            old
              ? { items: [n, ...old.items.filter((x) => x.id !== n.id)].slice(0, 30), unread: old.unread + 1 }
              : old,
          );
          qc.invalidateQueries({ queryKey: ["notifications"] });
          toast(n.title, {
            description: n.body || n.ticket_title || undefined,
            action: { label: "Открыть", onClick: () => navigate(`/tickets/${n.ticket_id}`) },
          });
        }
      };
      ws.onclose = () => {
        window.clearInterval(ping);
        if (stopped) return;
        attempt += 1;
        retry = window.setTimeout(connect, Math.min(15000, 1000 * 2 ** Math.min(attempt, 4)));
      };
    };

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retry);
      window.clearInterval(ping);
      ws?.close();
    };
  }, [userId, qc, navigate]);
}
