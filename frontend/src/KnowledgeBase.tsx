import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Search,
  ArrowUpRight,
  ShieldCheck,
  Flag,
  ThumbsUp,
  Check,
} from "lucide-react";
import { api, datetime, errorMessage, type Category, type User } from "./lib";
import type { KnowledgeArticle, KnowledgeContext } from "./knowledge";
import { Button } from "./components/ui/button";
import { Modal } from "./components/ui/dialog";
import { Empty, Failure, Loading } from "./components/common";
import { KnowledgeEditor } from "./components/KnowledgePublisher";
import "./knowledge.css";

const states: Record<string, string> = {
  DRAFT: "Черновики",
  IN_REVIEW: "На проверке",
  PUBLISHED: "Опубликовано",
  REVIEW_DUE: "Требуют обновления",
};
interface ManagedSummary {
  id: number;
  source_ticket_id: number;
  title: string;
  summary: string;
  status: string;
  audience: string;
  updated_at: string;
  open_reports: number;
}

function Reader({
  item,
  onClose,
  onNew,
}: {
  item: KnowledgeArticle;
  onClose: () => void;
  onNew: (context?: KnowledgeContext) => void;
}) {
  const qc = useQueryClient();
  const [attemptId] = useState(() => crypto.randomUUID());
  const query = useQuery<KnowledgeArticle>({
    queryKey: ["knowledge-reader", item.id, item.version, attemptId],
    queryFn: async ({ signal }) =>
      (
        await api.post(
          `/knowledge/${item.id}/view`,
          { attempt_id: attemptId, expected_version: item.version },
          { signal },
        )
      ).data,
    retry: false,
    refetchInterval: 30000,
  });
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reported, setReported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [helped, setHelped] = useState(false);
  useEffect(() => {
    window.addEventListener("access-changed", onClose);
    return () => window.removeEventListener("access-changed", onClose);
  }, [onClose]);

  async function feedback(value: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.post(`/knowledge/${item.id}/feedback`, {
        attempt_id: attemptId,
        expected_version: item.version,
        helped: value,
      });
      setHelped(value);
      void qc.invalidateQueries({ queryKey: ["knowledge-metrics"] });
      if (!value) {
        onClose();
        onNew({ attemptId, title: item.title, categoryId: item.category_id });
      }
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function report(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post(`/knowledge/${item.id}/report`, {
        expected_version: item.version,
        reason,
      });
      setReported(true);
      setReportOpen(false);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={() => !busy && onClose()} title="Инструкция">
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <div className="knowledge-unavailable">
          <BookOpen size={30} />
          <h3>Инструкция обновлена или доступ изменился</h3>
          <p>Вернитесь к списку и откройте актуальную публикацию.</p>
          <Button onClick={onClose}>К инструкциям</Button>
        </div>
      ) : (
        <>
          <span className="knowledge-category">{query.data.category_name}</span>
          <h2 className="knowledge-reader-title">{query.data.title}</h2>
          <div className="knowledge-reader-meta">
            <ShieldCheck size={16} /> Проверено{" "}
            {datetime(query.data.verified_at)}
            <span>{query.data.audience}</span>
          </div>
          <div className="knowledge-applicability">
            <strong>Когда подходит</strong>
            <p>{query.data.summary}</p>
          </div>
          <h3>Порядок действий</h3>
          <div className="knowledge-body">{query.data.body}</div>
          <div className="knowledge-reader-actions">
            <Button disabled={busy || helped} onClick={() => feedback(true)}>
              {helped ? <Check size={17} /> : <ThumbsUp size={17} />}
              {helped ? "Результат сохранён" : "Решил вопрос по инструкции"}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => feedback(false)}
            >
              Не помогло — создать обращение
            </Button>
          </div>
          <div className="knowledge-report-link">
            {reported ? (
              <p role="status">Сообщение отправлено администратору.</p>
            ) : (
              <button
                className="text-link"
                onClick={() => setReportOpen(!reportOpen)}
              >
                <Flag size={15} /> Сообщить о конфиденциальных данных
              </button>
            )}
          </div>
          {reportOpen && (
            <form
              onSubmit={report}
              className="form-stack knowledge-report-form"
            >
              <label>
                Что требует проверки
                <textarea
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Укажите место в инструкции и причину. Текст сообщения увидит администратор."
                />
              </label>
              <Button
                disabled={busy || reason.trim().length < 10}
                loading={busy}
              >
                Отправить администратору
              </Button>
            </form>
          )}
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}

export default function KnowledgeBase({
  user,
  onNew,
}: {
  user: User;
  onNew: (context?: KnowledgeContext) => void;
}) {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState("catalog");
  const [state, setState] = useState("DRAFT");
  const [reader, setReader] = useState<KnowledgeArticle | null>(null);
  const [editor, setEditor] = useState<number | null>(null);
  useEffect(() => {
    const resetAccess = () => {
      setReader(null);
      setEditor(null);
      setTab("catalog");
    };
    window.addEventListener("access-changed", resetAccess);
    return () => window.removeEventListener("access-changed", resetAccess);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const categories = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/categories")).data,
  });
  const query = useQuery<{ items: KnowledgeArticle[]; total: number }>({
    queryKey: ["knowledge", q, category, page],
    queryFn: async ({ signal }) =>
      (
        await api.post(
          "/knowledge/search",
          {
            page,
            q,
            ...(category ? { category_id: Number(category) } : {}),
          },
          { signal },
        )
      ).data,
    refetchInterval: 30000,
  });
  const management = useQuery<{ items: ManagedSummary[] }>({
    queryKey: ["knowledge-manage"],
    queryFn: async ({ signal }) =>
      (await api.get("/knowledge/manage", { signal })).data,
    enabled: user.role !== "EMPLOYEE",
    retry: false,
  });
  const managed = management.data?.items ?? [];
  const filtered = managed.filter((item) => item.status === state);
  useEffect(() => {
    if (query.data && page > Math.max(1, Math.ceil(query.data.total / 20)))
      setPage(1);
  }, [query.data, page]);
  return (
    <div className="page-enter knowledge-page">
      <div className="page-heading">
        <div>
          <h1>Инструкции и ответы</h1>
          <p>Найдите готовые действия для своей рабочей ситуации.</p>
        </div>
        <Button onClick={() => onNew()}>Создать обращение</Button>
      </div>
      {user.role !== "EMPLOYEE" && (
        <div
          className="knowledge-section-tabs"
          role="group"
          aria-label="Раздел инструкций"
        >
          <button
            className={tab === "catalog" ? "selected" : ""}
            onClick={() => setTab("catalog")}
          >
            Инструкции для сотрудников
          </button>
          <button
            className={tab === "manage" ? "selected" : ""}
            onClick={() => setTab("manage")}
          >
            Работа с публикациями
          </button>
        </div>
      )}
      {tab === "catalog" ? (
        <>
          <section
            className="panel knowledge-search-area"
            aria-label="Поиск инструкций"
          >
            <div className="knowledge-search">
              <div className="search-input">
                <Search size={20} />
                <input
                  type="search"
                  aria-label="Поиск инструкций"
                  placeholder="Что нужно сделать или исправить?"
                  maxLength={250}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <select
                aria-label="Категория инструкции"
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Все категории</option>
                {categories.data?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            {(search || category) && (
              <button
                className="text-link knowledge-reset"
                onClick={() => {
                  setSearch("");
                  setQ("");
                  setCategory("");
                  setPage(1);
                }}
              >
                Сбросить фильтры
              </button>
            )}
          </section>
          <div className="knowledge-results-heading">
            <h2>
              {q || category ? "Подходящие инструкции" : "Доступные инструкции"}
            </h2>
            {query.data && !query.isError && (
              <span className="muted" role="status">
                {query.data.total}
              </span>
            )}
          </div>
          {query.isPending ? (
            <Loading />
          ) : query.isError ? (
            <Failure retry={() => query.refetch()} />
          ) : query.data.items.length ? (
            <div className="knowledge-grid">
              {query.data.items.map((item) => (
                <article className="panel knowledge-entry" key={item.id}>
                  <div className="knowledge-entry-top">
                    <span className="knowledge-entry-icon">
                      <BookOpen size={21} />
                    </span>
                    <span className="knowledge-category">
                      {item.category_name}
                    </span>
                  </div>
                  <h2>{item.title}</h2>
                  <p>{item.summary}</p>
                  <div className="knowledge-entry-footer">
                    <span>
                      <ShieldCheck size={14} /> Проверено{" "}
                      {datetime(item.verified_at)}
                      <small>{item.audience}</small>
                    </span>
                    <Button
                      variant="ghost"
                      aria-label={`Читать ${item.title}`}
                      onClick={() => setReader(item)}
                    >
                      Читать
                      <ArrowUpRight size={21} />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="panel knowledge-empty">
              <BookOpen size={32} />
              <Empty
                title={
                  q || category
                    ? "Подходящих инструкций пока нет"
                    : "Инструкции готовятся"
                }
                text={
                  q || category
                    ? "Попробуйте другие слова или создайте обращение."
                    : "Здесь появятся проверенные инструкции, доступные вам."
                }
              />
            </div>
          )}
          {(query.data?.total ?? 0) > 20 && (
            <div className="pagination">
              <span>Найдено {query.data?.total}</span>
              <div>
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Назад
                </Button>
                <span>{page}</span>
                <Button
                  variant="outline"
                  disabled={page * 20 >= (query.data?.total ?? 0)}
                  onClick={() => setPage(page + 1)}
                >
                  Далее
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div
            className="knowledge-workflow-tabs"
            role="group"
            aria-label="Состояние публикаций"
          >
            {Object.entries(states).map(([key, label]) => (
              <button
                key={key}
                className={state === key ? "selected" : ""}
                onClick={() => setState(key)}
              >
                {label}
                <span>
                  {managed.filter((item) => item.status === key).length}
                </span>
              </button>
            ))}
          </div>
          {management.isPending ? (
            <Loading />
          ) : management.isError ? (
            <Failure retry={() => management.refetch()} />
          ) : filtered.length ? (
            <div className="knowledge-management-list">
              {filtered.map((item) => (
                <article
                  className="panel knowledge-management-card"
                  key={item.id}
                >
                  <div>
                    <span className="knowledge-category">{item.audience}</span>
                    <h3>{item.title}</h3>
                    <p>
                      {item.summary ||
                        "Заполните условия применения и порядок действий."}
                    </p>
                    <small className="muted">
                      Изменено {datetime(item.updated_at)}
                    </small>
                    {item.open_reports > 0 && (
                      <p className="knowledge-report-warning">
                        Сообщений о данных {item.open_reports}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setEditor(item.source_ticket_id)}
                  >
                    Открыть редактор
                  </Button>
                </article>
              ))}
            </div>
          ) : (
            <div className="panel knowledge-empty">
              <Empty
                title="Материалов в этом состоянии пока нет"
                text="Подготовить новую инструкцию можно из карточки обращения с подтверждённым результатом."
              />
            </div>
          )}
        </>
      )}
      {reader && (
        <Reader item={reader} onClose={() => setReader(null)} onNew={onNew} />
      )}
      {editor !== null && (
        <KnowledgeEditor ticketId={editor} onClose={() => setEditor(null)} />
      )}
    </div>
  );
}
