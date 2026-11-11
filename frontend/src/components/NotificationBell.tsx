import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, CircleHelp, MessageSquare, Flag, UserCheck, BadgeCheck } from "lucide-react";
import { api } from "../lib";
import type { AppNotification, NotificationList } from "../realtime";

const ICONS: Record<string, typeof Bell> = {
  assigned: UserCheck,
  created: Bell,
  comment: MessageSquare,
  clarification: CircleHelp,
  status: Flag,
  result: BadgeCheck,
};

function ago(iso: string) {
  const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : iso + "Z");
  const s = (Date.now() - date.getTime()) / 1000;
  if (s < 60) return "только что";
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

/** Колокольчик: непрочитанные события и переход прямо в обращение. */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get<NotificationList>("/notifications")).data,
    staleTime: 60000,
  });
  const unread = data?.unread_count ?? 0;

  const readOne = useMutation({
    mutationFn: (id: number) => api.post(`/notifications/${id}/read`),
    onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const readAll = useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onMutate: () =>
      qc.setQueryData<NotificationList>(["notifications"], (old) =>
        old ? { ...old, unread_count: 0, items: old.items.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) } : old,
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  function go(n: AppNotification) {
    if (!n.read_at) {
      qc.setQueryData<NotificationList>(["notifications"], (old) =>
        old
          ? {
              ...old,
              unread_count: Math.max(0, old.unread_count - 1),
              items: old.items.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)),
            }
          : old,
      );
      readOne.mutate(n.id);
    }
    setOpen(false);
    navigate(n.href);
  }

  return (
    <div className="bell" ref={ref}>
      <button
        className="icon-button bell-button"
        aria-label={unread ? `Уведомления: ${unread} непрочитанных` : "Уведомления"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={18} />
        {unread ? <span className="bell-badge">{unread > 99 ? "99+" : unread}</span> : null}
      </button>
      {open ? (
        <div className="bell-panel" role="dialog" aria-label="Уведомления">
          <div className="bell-head">
            <strong>Уведомления</strong>
            {unread ? (
              <button className="bell-readall" onClick={() => readAll.mutate()}>
                <CheckCheck size={15} /> Прочитать все
              </button>
            ) : null}
          </div>
          <div className="bell-list">
            {data?.items.length ? (
              data.items.map((n) => {
                const Icon = ICONS[n.kind] ?? Bell;
                return (
                  <button key={n.id} className={`bell-item ${n.read_at ? "" : "unread"}`} onClick={() => go(n)}>
                    <span className={`bell-icon kind-${n.kind}`}>
                      <Icon size={16} />
                    </span>
                    <span className="bell-text">
                      <span className="bell-title">{n.message}</span>
                      <span className="bell-meta">
                        {n.ticket_number ? `${n.ticket_number} · ` : ""}
                        {ago(n.created_at)}
                      </span>
                    </span>
                    {!n.read_at ? <span className="bell-dot" aria-label="Не прочитано" /> : null}
                  </button>
                );
              })
            ) : (
              <div className="bell-empty">
                <Bell size={22} />
                <span>Новых событий нет</span>
                <small>Здесь появятся назначения, комментарии и решения по обращениям.</small>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
