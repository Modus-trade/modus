import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Send,
  Paperclip,
  Clock3,
  CheckCircle2,
  MessageSquare,
  History as HistoryIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  api,
  datetime,
  errorMessage,
  statuses,
  priorities,
  types,
  transitions,
  type Ticket,
  type User,
} from "./lib";
import { Badge, Failure, Loading } from "./components/common";
import { AnimatedTabs } from "./components/motion";
import { Button } from "./components/ui/button";

export default function TicketDetail({ user }: { user: User }) {
  const { id } = useParams();
  const qc = useQueryClient();
  const query = useQuery<Ticket>({
    queryKey: ["ticket", id],
    queryFn: async () => (await api.get(`/tickets/${id}`)).data,
  });
  const people = useQuery<User[]>({
    queryKey: ["assignees"],
    queryFn: async () => (await api.get("/assignees")).data,
    enabled: user.role !== "EMPLOYEE",
  });
  const [body, setBody] = useState("");
  const [clarify, setClarify] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("comments");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [assignee, setAssignee] = useState("");
  const [resolution, setResolution] = useState("");
  const t = query.data;
  useEffect(() => {
    if (t) {
      setStatus(t.status);
      setPriority(t.priority);
      setAssignee(t.assignee_id?.toString() || "");
      setResolution(t.resolution || "");
    }
  }, [t]);
  if (query.isPending) return <Loading />;
  if (!t) return <Failure retry={() => query.refetch()} />;
  const manager = user.role !== "EMPLOYEE";
  const final = ["CLOSED", "IMPLEMENTED", "REJECTED"].includes(t.status);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch(`/tickets/${id}`, {
        status,
        priority,
        assignee_id: assignee ? Number(assignee) : null,
        resolution,
      });
      await qc.invalidateQueries();
      toast.success("Изменения сохранены");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/tickets/${id}/comments`, {
        body,
        is_clarification_request:
          clarify && t?.status !== "AWAITING_CLARIFICATION",
      });
      setBody("");
      setClarify(false);
      await qc.invalidateQueries();
      toast.success("Комментарий отправлен");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File) {
    const data = new FormData();
    data.append("file", file);
    setBusy(true);
    try {
      await api.post(`/tickets/${id}/attachments`, data);
      await qc.invalidateQueries();
      toast.success("Файл прикреплён");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-enter">
      <Link to="/tickets" className="back-link">
        <ArrowLeft size={16} />К обращениям
      </Link>
      <div className="detail-heading">
        <div>
          <div className="ticket-meta">
            {t.number}
            <span>·</span>
            {types[t.type]}
            <span>·</span>
            {t.category_name}
          </div>
          <h1>{t.title}</h1>
        </div>
        <Badge status={t.status} />
      </div>
      <div className="detail-grid">
        <div className="detail-main">
          <section className="panel padded">
            <h3>Описание обращения</h3>
            <p className="ticket-description">{t.description}</p>
            {t.proposed_solution && (
              <>
                <h4>Предполагаемое решение</h4>
                <p className="ticket-description">{t.proposed_solution}</p>
              </>
            )}
            {t.resolution && (
              <div className="resolution">
                <h4>
                  <CheckCircle2 size={18} />
                  Результат рассмотрения
                </h4>
                <p>{t.resolution}</p>
              </div>
            )}
            <div className="attachment-list">
              {t.attachments.map((a) => (
                <a
                  href={`/api/attachments/${a.id}`}
                  key={a.id}
                  className="attachment"
                >
                  <Paperclip size={16} />
                  <span>
                    {a.filename}
                    <small>{(a.size_bytes / 1024).toFixed(1)} КБ</small>
                  </span>
                </a>
              ))}
            </div>
            {!final && (
              <label className="attach-action">
                <Paperclip size={15} />
                Прикрепить файл
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.docx,.xlsx,.txt"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload(file);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </section>
          <section className="panel">
            <AnimatedTabs value={tab} label="Раздел обращения">
              <button
                className={tab === "comments" ? "selected" : ""}
                aria-pressed={tab === "comments"}
                onClick={() => setTab("comments")}
              >
                <MessageSquare size={15} />
                Обсуждение{" "}
                <span className="count-pill">{t.comments.length}</span>
              </button>
              <button
                className={tab === "history" ? "selected" : ""}
                aria-pressed={tab === "history"}
                onClick={() => setTab("history")}
              >
                <HistoryIcon size={15} />
                История изменений
              </button>
            </AnimatedTabs>
            <div className="discussion tab-content" key={tab}>
              {tab === "history" ? (
                <div className="timeline">
                  {t.history.length === 0 ? (
                    <p className="muted">
                      Изменений пока нет. Обращение зарегистрировано.
                    </p>
                  ) : (
                    t.history.map((h) => (
                      <div className="timeline-item" key={h.id}>
                        <span className="timeline-dot" />
                        <div>
                          <strong>{h.actor_name}</strong>
                          <p>
                            {
                              {
                                status: "Статус",
                                priority: "Приоритет",
                                assignee_id: "Ответственный",
                                resolution: "Результат рассмотрения",
                              }[h.field as "status"]
                            }
                            :{" "}
                            <span className="muted">
                              {h.field === "resolution"
                                ? h.old_value || "Не указан"
                                : statuses[h.old_value || ""] ||
                                  priorities[h.old_value || ""] ||
                                  people.data?.find(
                                    (u) => String(u.id) === h.old_value,
                                  )?.full_name ||
                                  h.old_value ||
                                  "Не назначен"}
                            </span>{" "}
                            →{" "}
                            {h.field === "resolution"
                              ? h.new_value || "Не указан"
                              : statuses[h.new_value || ""] ||
                                priorities[h.new_value || ""] ||
                                people.data?.find(
                                  (u) => String(u.id) === h.new_value,
                                )?.full_name ||
                                h.new_value ||
                                "Не назначен"}
                          </p>
                          <small>{datetime(h.created_at)}</small>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <>
                  {t.comments.length === 0 && (
                    <p className="muted no-comments">
                      Обсуждение ещё не началось. Здесь появятся ответы и
                      уточнения.
                    </p>
                  )}
                  {t.comments.map((c) => (
                    <article
                      key={c.id}
                      className={`comment ${c.is_clarification_request ? "clarification" : ""}`}
                    >
                      <div className="comment-top">
                        <span className="avatar small">
                          {c.author_name
                            .split(" ")
                            .map((s) => s[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <strong>{c.author_name}</strong>
                        <time>{datetime(c.created_at)}</time>
                      </div>
                      {c.is_clarification_request && (
                        <span className="clarify-tag">Запрос уточнения</span>
                      )}
                      <p>{c.body}</p>
                    </article>
                  ))}
                  {!final ? (
                    <form className="comment-form" onSubmit={send}>
                      {t.status === "AWAITING_CLARIFICATION" &&
                        t.author_id === user.id && (
                          <p className="routing-note">
                            Нужны дополнительные сведения. Ваш ответ вернёт
                            обращение на рассмотрение.
                          </p>
                        )}
                      <textarea
                        required
                        rows={3}
                        maxLength={10000}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Напишите сообщение…"
                      />
                      <div className="comment-actions">
                        {manager && t.status !== "AWAITING_CLARIFICATION" ? (
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={clarify}
                              onChange={(e) => setClarify(e.target.checked)}
                            />
                            Запросить уточнение
                          </label>
                        ) : (
                          <span />
                        )}
                        <Button loading={busy} disabled={busy || !body.trim()}>
                          <Send size={15} />
                          Отправить
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <p className="closed-note">
                      <CheckCircle2 size={16} />
                      Рассмотрение завершено. Результат сохранён в карточке.
                    </p>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
        <aside className="detail-side">
          <section className="panel padded">
            <h3>Детали обращения</h3>
            <dl>
              <dt>Автор</dt>
              <dd>
                {t.author_name}
                <small>{t.department}</small>
              </dd>
              <dt>Ответственный</dt>
              <dd>{t.assignee_name || "Не назначен"}</dd>
              <dt>Приоритет</dt>
              <dd>{priorities[t.priority]}</dd>
              <dt>Создано</dt>
              <dd>{datetime(t.created_at)}</dd>
              <dt>Срок первого ответа</dt>
              <dd className={t.overdue ? "orange-text" : ""}>
                <Clock3 size={14} />
                {datetime(t.due_at)}
                {t.overdue && <small>Срок ответа истёк</small>}
              </dd>
              {t.first_response_at && (
                <>
                  <dt>Первый ответ</dt>
                  <dd>{datetime(t.first_response_at)}</dd>
                </>
              )}
            </dl>
          </section>
          {manager && t.status !== "CLOSED" && (
            <form className="panel padded form-stack" onSubmit={save}>
              <h3>Управление обращением</h3>
              <label>
                Статус
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value={t.status}>{statuses[t.status]}</option>
                  {transitions[t.status].map((s) => (
                    <option key={s} value={s}>
                      {statuses[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Приоритет
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  {Object.entries(priorities).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ответственный
                <select
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  <option value="">Не назначен</option>
                  {people.data?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Результат рассмотрения
                {["IMPLEMENTED", "REJECTED", "CLOSED"].includes(status) && (
                  <span className="required"> *</span>
                )}
                <textarea
                  rows={4}
                  required={["IMPLEMENTED", "REJECTED", "CLOSED"].includes(
                    status,
                  )}
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Решение, обоснование и предпринятые действия"
                />
              </label>
              <Button className="full" loading={busy} disabled={busy}>
                {busy ? "Сохраняем…" : "Сохранить изменения"}
              </Button>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
