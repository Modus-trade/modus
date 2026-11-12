import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { clearSession } from "./session";

export type AppNotification = {
  id: number;
  kind: "assigned" | "created" | "comment" | "clarification" | "status" | "result" | string;
  message: string;
  ticket_id: number;
  ticket_number: string | null;
  created_at: string;
  read_at: string | null;
  href: string;
};

export type NotificationList = { items: AppNotification[]; total: number; unread_count: number };

type ServerEvent =
  | { type: "ticket_changed"; ticket_id: number; reason: string }
  | { type: "knowledge_changed" | "access_changed" }
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
        if (attempt > 0) {
          window.dispatchEvent(new Event("knowledge-changed"));
          void qc.resetQueries({ predicate: query => String(query.queryKey[0]).startsWith("knowledge") });
          void qc.invalidateQueries({ queryKey: ["me"] });
        }
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
        if (event.type === "knowledge_changed") {
          window.dispatchEvent(new Event("knowledge-changed"));
          void qc.resetQueries({ predicate: query => ["knowledge", "knowledge-reader", "knowledge-suggestions", "knowledge-manage"].includes(String(query.queryKey[0])) });
        }
        if (event.type === "access_changed") {
          window.dispatchEvent(new Event("access-changed"));
          window.dispatchEvent(new Event("knowledge-changed"));
          void qc.resetQueries();
        }
        if (event.type === "notification") {
          const n = event.notification;
          qc.setQueryData<NotificationList>(["notifications"], (old) =>
            old
              ? {
                  items: [n, ...old.items.filter((x) => x.id !== n.id)].slice(0, 20),
                  total: old.total + 1,
                  unread_count: old.unread_count + 1,
                }
              : old,
          );
          qc.invalidateQueries({ queryKey: ["notifications"] });
          toast(n.message, {
            description: n.ticket_number ? `Обращение ${n.ticket_number}` : undefined,
            action: { label: "Открыть", onClick: () => navigate(n.href) },
          });
        }
      };
      ws.onclose = async () => {
        window.clearInterval(ping);
        if (stopped) return;
        attempt += 1;
        // Сервер не пускает уже несколько раз подряд — возможно, сессия истекла.
        // Тогда не стучимся бесконечно, а выходим на страницу входа.
        if (attempt >= 2) {
          const me = await fetch("/api/auth/me", { credentials: "include" }).catch(() => null);
          if (stopped) return;
          if (me?.status === 401) {
            stopped = true;
            await clearSession(qc);
            return;
          }
        }
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
