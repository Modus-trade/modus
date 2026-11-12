import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Eye,
  History,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { api, datetime, errorMessage, type Ticket, type User } from "../lib";
import type { KnowledgeDraft, ManagedArticle } from "../knowledge";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";
import { Failure, Loading } from "./common";
import "../knowledge.css";

const actions: Record<string, string> = {
  draft_saved: "Сохранён черновик",
  submitted: "Отправлено на проверку",
  published: "Опубликована версия",
  withdrawn: "Публикация снята",
  reported: "Получено сообщение о данных",
};
const fieldNames: Record<string, string> = {
  title: "Название",
  summary: "Когда подходит",
  body: "Порядок действий",
};

export function KnowledgeEditor({
  ticketId,
  onClose,
}: {
  ticketId: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const query = useQuery<ManagedArticle | null>({
    queryKey: ["knowledge-publication", ticketId],
    queryFn: async ({ signal }) =>
      (await api.get(`/tickets/${ticketId}/knowledge-article`, { signal }))
        .data,
    retry: false,
  });
  const [draft, setDraft] = useState<KnowledgeDraft | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview" | "history">("edit");
  const [reviewed, setReviewed] = useState(false);
  const [warningsReviewed, setWarningsReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [oldVersion, setOldVersion] = useState<{
    title: string;
    summary: string;
    body: string;
    version: number;
  } | null>(null);
  const path = `/tickets/${ticketId}/knowledge-article`;

  function load(data: ManagedArticle | null) {
    setDraft(
      data?.draft ?? {
        title: "",
        summary: "",
        body: "",
        visibility: "DEPARTMENT",
        owner_department: "Подразделение автора обращения",
        confidential_case: false,
        version: 0,
        status: "DRAFT",
        review_days: 90,
        updated_at: "",
      },
    );
    setLoaded(true);
    setDirty(false);
    setReviewed(false);
    setWarningsReviewed(false);
  }
  useEffect(() => {
    if (query.isSuccess && !loaded) load(query.data);
  }, [query.data, query.isSuccess, loaded]);
  useEffect(() => {
    window.addEventListener("access-changed", onClose);
    return () => window.removeEventListener("access-changed", onClose);
  }, [onClose]);

  function update(values: Partial<KnowledgeDraft>) {
    setDraft((current) => (current ? { ...current, ...values } : current));
    setDirty(true);
    setReviewed(false);
    setWarningsReviewed(false);
  }

  async function persist() {
    if (!draft) throw new Error("Черновик ещё загружается");
    const { data } = await api.put<ManagedArticle>(path, {
      title: draft.title,
      summary: draft.summary,
      body: draft.body,
      visibility: draft.visibility,
      confidential_case: draft.confidential_case,
      review_days: draft.review_days,
      expected_version: draft.version,
    });
    qc.setQueryData(["knowledge-publication", ticketId], data);
    load(data);
    await qc.invalidateQueries({ queryKey: ["knowledge-manage"] });
    return data;
  }

  async function save(preview = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (dirty || !query.data) await persist();
      if (preview) setMode("preview");
      else toast.success("Черновик сохранён");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function act(action: "submit" | "approve" | "withdraw") {
    if (!draft || busy) return;
    setBusy(true);
    setError("");
    try {
      const payload =
        action === "withdraw"
          ? { expected_version: query.data?.published_version }
          : {
              expected_version: draft.version,
              reviewed,
              warnings_reviewed: warningsReviewed,
            };
      const { data } = await api.post<ManagedArticle>(
        `${path}/${action}`,
        payload,
      );
      qc.setQueryData(["knowledge-publication", ticketId], data);
      load(data);
      await qc.invalidateQueries({ queryKey: ["knowledge-manage"] });
      await qc.invalidateQueries({ queryKey: ["knowledge"] });
      toast.success(
        action === "approve"
          ? "Инструкция опубликована"
          : action === "submit"
            ? "Инструкция отправлена на проверку"
            : "Публикация снята",
      );
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  const data = query.data;
  const risks = data?.findings ?? [];
  const blocked =
    draft?.confidential_case || risks.some((risk) => risk.severity === "block");
  const canConfirm =
    reviewed && (!risks.length || warningsReviewed) && !blocked;
  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="Подготовка инструкции"
    >
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <Failure retry={() => query.refetch()} />
      ) : !loaded ? (
        <Loading />
      ) : (
        draft && (
          <>
            <div className="knowledge-editor-status">
              <span>
                {data?.is_published
                  ? `Опубликована версия ${data.published_version}`
                  : "Материал доступен редакторам"}
              </span>
              {data?.is_published && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => act("withdraw")}
                >
                  Снять публикацию
                </Button>
              )}
            </div>
            {data && data.open_reports > 0 && (
              <div className="knowledge-alert" role="alert">
                <strong>
                  <AlertTriangle size={17} /> Есть сообщения о возможных
                  закрытых данных
                </strong>
                {data.reports.map((report) => (
                  <p key={report.id}>{report.reason}</p>
                ))}
              </div>
            )}
            <div
              className="knowledge-editor-tabs"
              role="group"
              aria-label="Подготовка инструкции"
            >
              <Button
                variant={mode === "edit" ? "default" : "ghost"}
                disabled={busy}
                onClick={() => setMode("edit")}
              >
                Текст
              </Button>
              <Button
                variant={mode === "preview" ? "default" : "ghost"}
                disabled={busy}
                onClick={() => save(true)}
              >
                <Eye size={16} /> Проверка
              </Button>
              <Button
                variant={mode === "history" ? "default" : "ghost"}
                disabled={busy}
                onClick={() => setMode("history")}
              >
                <History size={16} /> История
              </Button>
            </div>
            {mode === "edit" && (
              <div className="form-stack">
                <p className="muted">
                  Сформулируйте общие действия для коллег. Проверьте имена,
                  обстоятельства случая, контакты и служебные сведения.
                </p>
                <label>
                  Название
                  <input
                    value={draft.title}
                    maxLength={250}
                    onChange={(event) => update({ title: event.target.value })}
                    placeholder="Как восстановить доступ к рабочей системе"
                  />
                </label>
                <label>
                  Когда подходит
                  <textarea
                    value={draft.summary}
                    rows={2}
                    maxLength={600}
                    onChange={(event) =>
                      update({ summary: event.target.value })
                    }
                    placeholder="Симптомы и условия применения"
                  />
                </label>
                <label>
                  Порядок действий и проверка результата
                  <textarea
                    value={draft.body}
                    rows={8}
                    maxLength={15000}
                    onChange={(event) => update({ body: event.target.value })}
                    placeholder={
                      "1. Выполните первый шаг.\n2. Проверьте результат.\nЕсли проблема сохраняется, создайте обращение."
                    }
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Кому доступно
                    <select
                      value={draft.visibility}
                      onChange={(event) =>
                        update({
                          visibility: event.target
                            .value as KnowledgeDraft["visibility"],
                        })
                      }
                    >
                      <option value="DEPARTMENT">
                        {draft.owner_department}
                      </option>
                      <option value="COMPANY">
                        Всем сотрудникам · проверка администратором
                      </option>
                    </select>
                  </label>
                  <label>
                    Повторная проверка
                    <select
                      value={draft.review_days}
                      onChange={(event) =>
                        update({ review_days: Number(event.target.value) })
                      }
                    >
                      <option value={30}>Через 30 дней</option>
                      <option value={90}>Через 90 дней</option>
                      <option value={180}>Через 180 дней</option>
                      <option value={365}>Через год</option>
                    </select>
                  </label>
                </div>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={draft.confidential_case}
                    onChange={(event) =>
                      update({ confidential_case: event.target.checked })
                    }
                  />{" "}
                  Материал описывает персональный или конфиденциальный случай
                </label>
                {draft.confidential_case && (
                  <p className="knowledge-alert">
                    Такой черновик сохраняется для редакторов. Для публикации
                    подготовьте обобщённую инструкцию и повторно проверьте
                    содержание.
                  </p>
                )}
                <div className="form-actions">
                  <Button
                    variant="outline"
                    disabled={busy || (!dirty && !!data)}
                    loading={busy}
                    onClick={() => save()}
                  >
                    Сохранить черновик
                  </Button>
                  <Button disabled={busy} onClick={() => save(true)}>
                    Проверить публикацию
                  </Button>
                </div>
              </div>
            )}
            {mode === "preview" && (
              <div className="form-stack">
                <div className="knowledge-audience">
                  <ShieldCheck size={18} />
                  <span>
                    Увидят{" "}
                    {draft.visibility === "COMPANY"
                      ? "все сотрудники компании"
                      : `сотрудники подразделения «${draft.owner_department}»`}
                  </span>
                </div>
                <article className="knowledge-preview">
                  <h2>{draft.title || "Название ещё не заполнено"}</h2>
                  <p>{draft.summary}</p>
                  <div className="knowledge-body">{draft.body}</div>
                </article>
                {risks.length > 0 && (
                  <div className="knowledge-alert">
                    <strong>Данные, которые требуют проверки</strong>
                    <ul>
                      {risks.map((risk) => (
                        <li key={`${risk.field}-${risk.kind}`}>
                          {fieldNames[risk.field]} · {risk.message}
                        </li>
                      ))}
                    </ul>
                    <p>
                      Автоматическая проверка дополняет проверку редактором.
                    </p>
                  </div>
                )}
                {blocked && (
                  <p className="form-error">
                    Устраните отмеченные секреты или конфиденциальные
                    обстоятельства перед отправкой на проверку.
                  </p>
                )}
                {draft.status !== "PUBLISHED" && (
                  <>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={reviewed}
                        onChange={(event) => setReviewed(event.target.checked)}
                      />{" "}
                      Я проверил корректность, обезличенность и допустимость
                      текста для указанной аудитории
                    </label>
                    {risks.length > 0 && (
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={warningsReviewed}
                          onChange={(event) =>
                            setWarningsReviewed(event.target.checked)
                          }
                        />{" "}
                        Отмеченные сведения проверены и разрешены для выбранной
                        аудитории
                      </label>
                    )}
                  </>
                )}
                {draft.status === "DRAFT" && (
                  <Button
                    disabled={busy || !canConfirm}
                    loading={busy}
                    onClick={() => act("submit")}
                  >
                    Отправить на проверку
                  </Button>
                )}
                {draft.status === "IN_REVIEW" &&
                  (data?.can_publish ? (
                    <Button
                      disabled={busy || !canConfirm}
                      loading={busy}
                      onClick={() => act("approve")}
                    >
                      Подтвердить и опубликовать
                    </Button>
                  ) : (
                    <p className="knowledge-waiting">
                      Ожидает подтверждения администратора. Инструкция появится
                      у читателей после публикации.
                    </p>
                  ))}
                {draft.status === "PUBLISHED" && (
                  <p className="knowledge-waiting">
                    Версия проверена. Для новой публикации сохраните изменения в
                    черновике и отправьте его на проверку.
                  </p>
                )}
              </div>
            )}
            {mode === "history" && (
              <div className="knowledge-version-history">
                <h3>Опубликованные версии</h3>
                {!data?.revisions.length && (
                  <p className="muted">Проверенных публикаций пока нет.</p>
                )}
                {data?.revisions.map((version) => (
                  <div className="knowledge-version" key={version.version}>
                    <span>
                      <strong>Версия {version.version}</strong>
                      <small>
                        {version.reviewer} · {datetime(version.approved_at)}
                      </small>
                    </span>
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        try {
                          setOldVersion(
                            (
                              await api.get(
                                `${path}/revisions/${version.version}`,
                              )
                            ).data,
                          );
                        } catch (failure) {
                          setError(errorMessage(failure));
                        }
                      }}
                    >
                      Посмотреть
                    </Button>
                  </div>
                ))}
                {oldVersion && (
                  <article className="knowledge-preview">
                    <strong>
                      Версия {oldVersion.version} · {oldVersion.title}
                    </strong>
                    <p>{oldVersion.summary}</p>
                    <div className="knowledge-body">{oldVersion.body}</div>
                  </article>
                )}
                <h3>Действия редакторов</h3>
                {data?.history.map((event) => (
                  <p key={event.id}>
                    {actions[event.action] || event.action}
                    <small className="knowledge-history-meta">
                      {event.actor} · {datetime(event.created_at)}
                    </small>
                  </p>
                ))}
              </div>
            )}
            {error && (
              <div className="knowledge-alert" role="alert">
                <p>{error}</p>
                <button
                  className="text-link"
                  disabled={busy}
                  onClick={async () => {
                    const result = await query.refetch();
                    if (result.isSuccess) {
                      load(result.data);
                      setError("");
                    }
                  }}
                >
                  Загрузить актуальную версию
                </button>
              </div>
            )}
          </>
        )
      )}
    </Modal>
  );
}

export default function KnowledgePublisher({
  ticket,
  user,
}: {
  ticket: Ticket;
  user: User;
}) {
  const [open, setOpen] = useState(false);
  if (
    user.role === "EMPLOYEE" ||
    ticket.status !== "CLOSED" ||
    !ticket.resolution_confirmed_at ||
    ticket.type === "PRAISE"
  )
    return null;
  return (
    <section className="panel padded knowledge-publication">
      <h3>
        <BookOpen size={18} /> Инструкция для коллег
      </h3>
      <p className="muted">
        Подготовьте обобщённые действия и выберите аудиторию.
      </p>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Открыть редактор
      </Button>
      {open && (
        <KnowledgeEditor ticketId={ticket.id} onClose={() => setOpen(false)} />
      )}
    </section>
  );
}
