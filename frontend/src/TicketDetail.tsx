import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { TicketInsights } from "./components/TicketInsights";
import { VoicePlayer, VoiceRecorder } from "./components/VoiceMessage";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Send,
  Paperclip,
  Clock3,
  CheckCircle2,
  MessageSquare,
  History as HistoryIcon,
  Users,
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
import { AssigneeRecommendations } from "./components/AssigneeRecommendations";
import ResolutionDeadline from "./components/ResolutionDeadline";
import ResolutionReview from "./components/ResolutionReview";
import BitrixTask from "./components/BitrixTask";
import { formatDeadline } from "./deadline";
import KnowledgePublisher from "./components/KnowledgePublisher";

export default function TicketDetail({ user }: { user: User }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const returnTo = params.get("returnTo");
  const fromAttention =
    user.role === "ADMIN" &&
    returnTo !== null &&
    /^\/(?:\?[^#]*)?$/.test(returnTo);
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
  const [shared, setShared] = useState(false);
  const [photo, setPhoto] = useState<number | null>(null);
  const [resolution, setResolution] = useState("");
  const t = query.data;
  useEffect(() => {
    if (t) {
      setShared(t.is_shared);
      setStatus(t.status);
      setPriority(t.priority);
      setAssignee(t.assignee_id?.toString() || "");
      setResolution(t.resolution || "");
    }
  }, [t]);
  if (query.isPending) return <Loading />;
  if (!t) return <Failure retry={() => query.refetch()} />;
  const manager = user.role !== "EMPLOYEE" || t.assignee_id === user.id;
  const final = ["CLOSED", "IMPLEMENTED", "REJECTED"].includes(t.status);
  const participant = t.viewer === "participant";
  function historyValue(field: string, value: string | null) {
    if (field === "resolution_due_at") return value ? formatDeadline(value) : "Не назначен";
    if (field === "resolution") return value || "Не указан";
    if (field === "resolution_review") return value === "confirm" ? "Подтверждено автором" : value === "rework" ? "Возвращено на доработку" : "Ожидает проверки";
    return statuses[value || ""] || priorities[value || ""] ||
      people.data?.find((person) => String(person.id) === value)?.full_name || value || "Не назначен";
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch(`/tickets/${id}`, {
        status,
        priority,
        assignee_id: assignee ? Number(assignee) : null,
        resolution,
        is_shared: shared,
        expected_status: t?.status,
        expected_resolution_review_version: t?.resolution_review_version ?? 0,
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
  async function sendVoice(file: File, seconds: number) {
    const data = new FormData();
    data.append("file", file);
    data.append("seconds", String(seconds));
    data.append("is_clarification_request", String(clarify && t?.status !== "AWAITING_CLARIFICATION"));
    try {
      await api.post(`/tickets/${id}/voice`, data);
      setClarify(false);
      await qc.invalidateQueries();
      toast.success("Голосовое отправлено");
    } catch (e) {
      toast.error(errorMessage(e));
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
      <Link to={fromAttention ? returnTo! : "/tickets"} className="back-link">
        <ArrowLeft size={16} />
        {fromAttention ? "К очереди внимания" : "К обращениям"}
      </Link>
      <div className="detail-heading">
        <div>
          <div className="ticket-meta">
            {t.number}
            <span>·</span>
            {types[t.type]}
            <span>·</span>
            {t.category_name}
            {t.source === "BITRIX24" && <span className="bitrix-source">Источник: Битрикс24</span>}
          </div>
          <h1>{t.title}</h1>
        </div>
        <Badge status={t.status} />
      </div>
      <StageTracker status={t.status} />
      <div className="detail-grid">
        <div className="detail-main">
          <section className="panel padded">
            <h3>Описание обращения</h3>
            {t.type === "PROBLEM" && (t.affected_count ?? 1) > 1 && (
              <p className="affected-count has-participants">
                Общая проблема · столкнулись {t.affected_count} {[2,3,4].includes((t.affected_count ?? 0) % 10) && ![12,13,14].includes((t.affected_count ?? 0) % 100) ? "сотрудника" : "сотрудников"}
              </p>
            )}
            {participant ? (
              <p className="muted">Описание видят автор и ответственный — здесь вы следите за стадией и результатом.</p>
            ) : (
              <p className="ticket-description">{t.description}</p>
            )}
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
            {t.attachments.some((a) => isImage(a.filename)) && (
              <div className="photo-grid">
                {t.attachments
                  .filter((a) => isImage(a.filename))
                  .map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="photo-thumb"
                      onClick={() => setPhoto(a.id)}
                      aria-label={`Открыть фото ${a.filename}`}
                    >
                      <img src={`/api/attachments/${a.id}`} alt={a.filename} loading="lazy" />
                    </button>
                  ))}
              </div>
            )}
            <div className="attachment-list">
              {t.attachments
                .filter((a) => !isImage(a.filename))
                .map((a) => (
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
            {photo !== null && <PhotoViewer id={photo} onClose={() => setPhoto(null)} />}
            {!final && !participant && (
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
          {participant ? (
            <section className="panel padded participant-note">
              <Users size={18} />
              <p>
                Вы присоединились к этой общей проблеме. Здесь видно стадию и итоговый результат,
                уведомления о них придут вам автоматически. Переписка доступна автору и ответственному.
              </p>
            </section>
          ) : (
          <>
          <ResolutionReview ticket={t} user={user} />
          <KnowledgePublisher ticket={t} user={user} />
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
                                resolution_due_at: "Срок решения",
                                resolution_review: "Проверка результата",
                              }[h.field as "status"]
                            }
                            :{" "}
                            <span className="muted">
                              {historyValue(h.field, h.old_value)}
                            </span>{" "}
                            →{" "}
                            {historyValue(h.field, h.new_value)}
                          </p>
                          {h.reason && <p className="deadline-history-reason">Причина: {h.reason}</p>}
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
                      {c.audio_id ? (
                        <VoicePlayer
                          src={`/api/attachments/${c.audio_id}`}
                          seconds={c.audio_seconds ?? null}
                          transcript={c.transcript ?? null}
                        />
                      ) : (
                        <p>{c.body}</p>
                      )}
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
                        <div className="comment-send">
                          {!body.trim() && <VoiceRecorder disabled={busy} onSend={sendVoice} />}
                          <Button loading={busy} disabled={busy || !body.trim()}>
                            <Send size={15} />
                            Отправить
                          </Button>
                        </div>
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
          </>
          )}
        </div>
        <aside className="detail-side">
          {!participant && <BitrixTask ticket={t} user={user} />}
          <section className="panel padded">
            <h3>Детали обращения</h3>
            <dl>
              {!participant && (
                <>
                  <dt>Автор</dt>
                  <dd>
                    {t.author_name}
                    <small>{t.department}</small>
                  </dd>
                </>
              )}
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
          {user.role !== "EMPLOYEE" && (
            <TicketInsights
              ticketId={t.id}
              final={["IMPLEMENTED", "REJECTED", "CLOSED"].includes(t.status)}
              onUseReply={(text) => {
                setBody(text);
                focusField(".comment-form textarea");
              }}
              onUseResult={(text) => {
                setResolution(text);
                focusField("textarea[placeholder^='Решение']");
              }}
            />
          )}
          <ResolutionDeadline ticket={t} user={user} />
          {manager && t.status !== "CLOSED" && (
            <form className="panel padded form-stack" onSubmit={save}>
              <h3>Управление обращением</h3>
              {t.type === "PROBLEM" && (
                <label className="shared-problem-toggle">
                  <input
                    type="checkbox"
                    checked={shared}
                    disabled={t.is_shared}
                    onChange={(e) => setShared(e.target.checked)}
                  />
                  <span>
                    <strong>Общая проблема</strong>
                    <small>
                      Заголовок и статус будут доступны сотрудникам для
                      присоединения. После публикации скрыть проблему нельзя.
                    </small>
                  </span>
                </label>
              )}
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
              {user.role === "ADMIN" && !final && (
                <AssigneeRecommendations
                  people={people.data || []}
                  categoryId={t.category_id}
                  selected={assignee}
                  onSelect={setAssignee}
                  disabled={busy}
                />
              )}
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

const STAGES = [
  { label: "Подано", statuses: ["NEW"] },
  { label: "Рассмотрение", statuses: ["IN_REVIEW", "AWAITING_CLARIFICATION"] },
  { label: "Реализация", statuses: ["IN_PROGRESS"] },
  { label: "Решение", statuses: ["IMPLEMENTED", "REJECTED", "CLOSED"] },
];

/** Путь обращения: автор сразу видит, на какой стадии его вопрос. */
function StageTracker({ status }: { status: string }) {
  const current = STAGES.findIndex((s) => s.statuses.includes(status));
  const last = current === STAGES.length - 1;
  const outcome = status === "REJECTED" ? "Отклонено" : status === "IMPLEMENTED" ? "Проверка автора" : status === "CLOSED" ? "Закрыто" : null;
  return (
    <ol className={`stage-tracker stage-${status}`} aria-label="Стадия обращения">
      {STAGES.map((s, i) => (
        <li key={s.label} className={i < current ? "done" : i === current ? "current" : ""} aria-current={i === current ? "step" : undefined}>
          <span className="stage-dot" />
          <span className="stage-label">
            {last && i === current && outcome ? outcome : s.label}
            {i === current && status === "AWAITING_CLARIFICATION" ? <small>нужен ответ автора</small> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

const isImage = (name: string) => /\.(jpe?g|png|gif|webp|heic)$/i.test(name);

/** Фото на весь экран: закрывается кликом по фону, крестиком или Esc. */
function PhotoViewer({ id, onClose }: { id: number; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  return createPortal(
    <div className="photo-viewer" role="dialog" aria-label="Просмотр фото" onClick={onClose}>
      <img src={`/api/attachments/${id}`} alt="" onClick={(e) => e.stopPropagation()} />
      <div className="photo-viewer-bar" onClick={(e) => e.stopPropagation()}>
        <a href={`/api/attachments/${id}`} download>
          Скачать
        </a>
        <button type="button" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>,
    document.body,
  );
}

function focusField(selector: string) {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLTextAreaElement>(selector);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus({ preventScroll: true });
  });
}
