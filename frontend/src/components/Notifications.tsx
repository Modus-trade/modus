import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { api, datetime, errorMessage } from "../lib";
import { Modal } from "./ui/dialog";
interface Item { id: number; ticket_id: number; message: string; created_at: string; read_at: string | null; href: string }
export function Notifications() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [unread, setUnread] = useState(false);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery<{ items: Item[]; total: number; unread_count: number }>({
    queryKey: ["notifications", page, unread],
    queryFn: async () => (await api.get("/notifications", { params: { page, unread_only: unread } })).data,
    refetchInterval: 15000,
  });
  async function read(item?: Item) {
    setBusy(true);
    try {
      await api.post(item ? `/notifications/${item.id}/read` : "/notifications/read-all");
      if (item) { setOpen(false); navigate(item.href); }
      else setPage(1);
      await qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch (e) { toast.error(errorMessage(e)); }
    finally { setBusy(false); }
  }
  const count = query.data?.unread_count || 0;
  return <>
    <button className="notification-bell icon-button" aria-label={`Уведомления: ${count} непрочитанных`} onClick={() => setOpen(true)}><Bell size={20} />{count > 0 && <span>{count > 99 ? "99+" : count}</span>}</button>
    <Modal open={open} onClose={() => setOpen(false)} title="Уведомления">
      <div className="notification-toolbar"><button className="text-link" onClick={() => { setUnread(!unread); setPage(1); }}>{unread ? "Показать все" : "Только непрочитанные"}</button><button className="text-link" disabled={busy || !count} onClick={() => read()}><CheckCheck size={16} />Прочитать все</button></div>
      {query.isPending ? <p>Загружаем уведомления…</p> : query.isError ? <button className="button button-outline" onClick={() => query.refetch()}>Повторить загрузку</button> : <>
        <div className="notification-list">{query.data.items.map((item) => <button key={item.id} disabled={busy} className={`notification-item ${item.read_at ? "" : "is-unread"}`} onClick={() => read(item)}><span className="notification-dot" /><span><strong>{item.message}</strong><small>Обращение №{item.ticket_id} · {datetime(item.created_at)}</small></span><span aria-hidden="true">↗</span></button>)}</div>
        {!query.data.items.length && <p className="notification-empty">{unread ? "Все уведомления прочитаны" : "Здесь появятся назначения, ответы и результаты рассмотрения"}</p>}
        {query.data.total > 20 && <div className="pagination"><button disabled={page === 1} onClick={() => setPage(page - 1)}>Назад</button><span>{page}</span><button disabled={page * 20 >= query.data.total} onClick={() => setPage(page + 1)}>Далее</button></div>}
      </>}
    </Modal>
  </>;
}
