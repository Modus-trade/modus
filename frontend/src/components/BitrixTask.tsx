import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Network, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage, type Ticket, type User } from "../lib";
import { exchangeDate, exchangeStates, exchangeError } from "../Integrations";
import { Button } from "./ui/button";
interface Task {
  mode: string;
  enabled: boolean;
  state: string;
  external_id?: number;
  remote_status?: string;
  remote_deadline?: string;
  checked_at?: string;
  assignee_name?: string;
  url?: string;
  error?: string;
}
export default function BitrixTask({
  ticket,
  user,
}: {
  ticket: Ticket;
  user: User;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const path = `/integrations/bitrix/tickets/${ticket.id}`;
  const q = useQuery<Task>({
    queryKey: ["bitrix-task", ticket.id],
    queryFn: async () => (await api.get(path)).data,
    refetchInterval: 10000,
  });
  const manager = user.role !== "EMPLOYEE" || ticket.assignee_id === user.id;
  async function change(mock = false) {
    setBusy(true);
    try {
      if (mock) await api.post(path + "/mock-complete", { result });
      else await api.put(path, { enabled: !q.data?.enabled });
      await qc.invalidateQueries({ queryKey: ["bitrix-task", ticket.id] });
      await qc.invalidateQueries({ queryKey: ["ticket", String(ticket.id)] });
      toast.success(
        mock ? "МОК-результат передан автору" : "Настройка сохранена",
      );
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (q.isPending)
    return (
      <section className="panel padded">
        <p>Загружаем связь с Битрикс24…</p>
      </section>
    );
  if (!q.data)
    return (
      <section className="panel padded">
        <p>Не удалось загрузить состояние Битрикс24.</p>
        <button onClick={() => q.refetch()}>Повторить</button>
      </section>
    );
  const d = q.data;
  return (
    <section className="panel padded bitrix-task">
      <div className="bitrix-task-heading">
        <Network size={22} />
        <h3>Задача в Битрикс24</h3>
      </div>
      <span className={`exchange-state ${d.state}`}>
        {d.mode === "mock" ? "МОК · " : ""}
        {exchangeStates[d.state] || d.state}
      </span>
      {d.mode === "off" ? (
        <p className="muted">
          Интеграцию включает администратор в разделе «Интеграции».
        </p>
      ) : (
        <>
          {manager &&
            !["IMPLEMENTED", "CLOSED", "REJECTED"].includes(ticket.status) && (
              <label className="bitrix-task-toggle">
                <input
                  type="checkbox"
                  checked={d.enabled}
                  disabled={busy}
                  onChange={() => change()}
                />
                <span>
                  {d.external_id
                    ? "Синхронизировать связанную задачу"
                    : "Создавать задачу в Битрикс24 при начале работы"}
                </span>
              </label>
            )}
          {!d.external_id && d.enabled && (
            <p className="muted">
              Назначьте сотрудника, связанного с Битрикс24, и переведите
              обращение в «В работе».
            </p>
          )}
          {d.external_id && (
            <>
              <dl>
                <dt>Задача</dt>
                <dd>#{d.external_id}</dd>
                <dt>Исполнитель в портале</dt>
                <dd>{d.assignee_name || "—"}</dd>
                <dt>Статус в портале</dt>
                <dd>
                  {(
                    {
                      "2": "Ожидает выполнения",
                      "3": "Выполняется",
                      "4": "Ждёт контроля",
                      "5": "Завершена",
                      "6": "Отложена",
                    } as Record<string, string>
                  )[d.remote_status || ""] ||
                    d.remote_status ||
                    "Обновляется"}
                </dd>
                <dt>Срок в портале</dt>
                <dd>{exchangeDate(d.remote_deadline)}</dd>
              </dl>
              {d.url && (
                <a
                  className="bitrix-task-link"
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Открыть в Битрикс24
                  <ArrowUpRight size={16} />
                </a>
              )}
              <small className="muted">
                Проверено: {exchangeDate(d.checked_at)}. Обновление примерно раз
                в минуту.
              </small>
            </>
          )}
          {d.error && (
            <p className="form-error" role="alert">
              {exchangeError(d.error)}
            </p>
          )}
          {d.external_id && (
            <p className="muted">
              Исполнитель и срок передаются при создании. Последующие изменения
              задачи ведите в Битрикс24. Завершите её с закреплённым результатом
              — автор получит его на проверку.
            </p>
          )}
          {d.mode === "mock" &&
            d.external_id &&
            user.role === "ADMIN" &&
            ticket.status === "IN_PROGRESS" && (
              <div className="form-stack">
                <label>
                  МОК: результат работы
                  <textarea
                    value={result}
                    onChange={(e) => setResult(e.target.value)}
                    placeholder="Что было исправлено"
                  />
                </label>
                <Button
                  disabled={busy || result.trim().length < 3}
                  onClick={() => change(true)}
                >
                  Смоделировать завершение
                </Button>
              </div>
            )}
        </>
      )}
    </section>
  );
}
