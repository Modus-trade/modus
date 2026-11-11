import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlarmClock,
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Radar,
  RefreshCw,
  Search,
  ShieldCheck,
  Unplug,
  UserRoundX,
  X,
} from "lucide-react";
import {
  api,
  datetime,
  priorities,
  type AttentionReason,
  type AttentionSummary,
} from "./lib";
import { Failure, Loading, TicketTable } from "./components/common";
import { AnimatedTabs } from "./components/motion";

const groups = [
  {
    key: "unassigned",
    label: "Без ответственного",
    note: "Назначьте того, кто поможет",
    icon: UserRoundX,
    action: "Распределить обращения",
    tone: "red",
  },
  {
    key: "overdue",
    label: "Просрочен первый ответ",
    note: "Сотрудники ждут реакции",
    icon: AlarmClock,
    action: "Проверить сроки",
    tone: "amber",
  },
  {
    key: "stale",
    label: "Без движения",
    note: "Помогите процессу двигаться",
    icon: Clock3,
    action: "Посмотреть историю",
    tone: "blue",
  },
] as const;

export default function Attention() {
  const [params, setParams] = useSearchParams();
  const initialReason = params.get("reason");
  const [reason, setReason] = useState<AttentionReason | "all">(
    initialReason === "unassigned" ||
      initialReason === "overdue" ||
      initialReason === "stale"
      ? initialReason
      : "all",
  );
  const [days, setDays] = useState(() =>
    [3, 7, 14, 30].includes(Number(params.get("days")))
      ? Number(params.get("days"))
      : 7,
  );
  const [q, setQ] = useState(params.get("q") || "");
  const [priority, setPriority] = useState(() =>
    ["HIGH", "MEDIUM", "LOW"].includes(params.get("priority") || "")
      ? params.get("priority")!
      : "",
  );
  const [page, setPage] = useState(() =>
    Math.max(1, Math.floor(Number(params.get("page"))) || 1),
  );
  useEffect(() => {
    const next = new URLSearchParams();
    if (reason !== "all") next.set("reason", reason);
    if (days !== 7) next.set("days", String(days));
    if (q) next.set("q", q);
    if (priority) next.set("priority", priority);
    if (page !== 1) next.set("page", String(page));
    if (next.toString() !== params.toString())
      setParams(next, { replace: true });
  }, [reason, days, q, priority, page, params, setParams]);
  const query = useQuery<AttentionSummary>({
    queryKey: ["attention", reason, days, q, priority, page],
    queryFn: async ({ signal }) =>
      (
        await api.get("/analytics/attention", {
          signal,
          params: {
            reason,
            stale_days: days,
            ...(q ? { q } : {}),
            ...(priority ? { priority } : {}),
            page,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
    refetchInterval: 60000,
  });
  const data = query.data;
  useEffect(() => {
    if (data && !query.isPlaceholderData) {
      const lastPage = Math.max(1, Math.ceil(data.total / 10));
      if (page > lastPage) setPage(lastPage);
    }
  }, [data, page, query.isPlaceholderData]);
  function selectReason(value: AttentionReason | "all", scrollToQueue = false) {
    setReason(value);
    setPage(1);
    if (scrollToQueue)
      document.getElementById("attention-queue")?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
  }
  const reset = () => {
    setQ("");
    setPriority("");
    selectReason("all");
  };
  return (
    <div className="attention-page page-enter">
      <div className="page-heading attention-heading">
        <div>
          <span className="eyebrow">
            <Radar size={13} /> ЦЕНТР ВНИМАНИЯ
          </span>
          <h1>
            Важное — <span>на первом плане.</span>
          </h1>
          <p>
            Все сигналы в одном месте. Помогите каждому обращению дойти до
            результата.
          </p>
        </div>
        <button
          className="button button-outline attention-refresh"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw
            size={16}
            className={query.isFetching ? "button-spinner" : ""}
          />
          Обновить
        </button>
      </div>
      {!data ? (
        query.isPending ? (
          <Loading />
        ) : (
          <Failure retry={() => query.refetch()} />
        )
      ) : (
        <>
          <section className="attention-brief" aria-label="Сводка внимания">
            <div className="attention-brief-copy">
              <span className="attention-live">
                <span />
                ОПЕРАТИВНАЯ СВОДКА
              </span>
              <h2>
                {data.counts.total ? (
                  <>
                    Есть вопросы,
                    <br />
                    которым нужно <em>ваше внимание.</em>
                  </>
                ) : (
                  <>
                    Всё под контролем.
                    <br />
                    <em>Очередь внимания пуста.</em>
                  </>
                )}
              </h2>
              <p>
                {data.counts.total
                  ? "Начните с обращений без ответственного и просроченного ответа. Остальные — держите в поле зрения."
                  : "Открытые обращения распределены, сроки ответа соблюдены, длительных пауз нет."}
              </p>
              <div className="attention-brief-footer">
                <ShieldCheck size={15} />
                Только открытые обращения
                <span>Обновлено {datetime(data.generated_at)}</span>
              </div>
            </div>
            <div className="attention-orbit" aria-hidden="true">
              <div />
              <div />
              <Radar size={58} />
              <span className="attention-orbit-dot" />
            </div>
            <button
              className="attention-total"
              onClick={() => selectReason("all", true)}
            >
              <span>В фокусе</span>
              <strong>{data.counts.total.toLocaleString("ru-RU")}</strong>
              <span>
                уникальных обращений <ArrowUpRight size={17} />
              </span>
            </button>
          </section>
          <section
            className="attention-cards"
            aria-label="Фильтры по причинам внимания"
          >
            {groups.map(({ key, label, note, icon: Icon, action, tone }) => (
              <button
                key={key}
                className={`attention-card tone-${tone} ${reason === key ? "is-selected" : ""}`}
                aria-pressed={reason === key}
                onPointerMove={(event) => {
                  if (event.pointerType !== "mouse") return;
                  const card = event.currentTarget;
                  const rect = card.getBoundingClientRect();
                  card.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
                  card.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
                }}
                onClick={() => selectReason(reason === key ? "all" : key, true)}
              >
                <span className="attention-card-halo" aria-hidden="true" />
                <span className="attention-card-circuit" aria-hidden="true">
                  <i /><i /><i />
                </span>
                <div className="attention-card-head">
                  <span className="attention-card-icon">
                    <Icon size={22} />
                  </span>
                  <span className="attention-card-count">
                    {data.counts[key]}
                  </span>
                </div>
                <h3>{label}</h3>
                <p>
                  {key === "stale"
                    ? `Нет активности ${days} дней и дольше`
                    : note}
                </p>
                <span className="attention-card-action">
                  {action}
                  <ArrowRight size={17} />
                </span>
              </button>
            ))}
          </section>
          <div className="attention-explainer">
            <p>
              <CircleHelp size={16} />
              Одно обращение может иметь несколько причин внимания. В списке оно
              появится один раз.
            </p>
            <label>
              Без движения
              <select
                aria-label="Период отсутствия активности"
                value={days}
                onChange={(e) => {
                  setDays(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[3, 7, 14, 30].map((n) => (
                  <option key={n} value={n}>
                    от {n} дней
                  </option>
                ))}
              </select>
            </label>
          </div>
          <section
            id="attention-queue"
            className="panel attention-queue"
            aria-label="Очередь проблемных обращений"
          >
            <div className="panel-title">
              <div>
                <span className="eyebrow">ОТ СИГНАЛА К ДЕЙСТВИЮ</span>
                <h3>
                  Очередь внимания{" "}
                  <span className="count-pill">{data.total}</span>
                </h3>
                <p>
                  Сначала несколько причин внимания, затем высокий приоритет и
                  самое давнее действие.
                </p>
              </div>
              <Link className="text-link" to="/tickets">
                Все обращения
                <ArrowUpRight size={16} />
              </Link>
            </div>
            <AnimatedTabs value={reason} label="Причина внимания">
              {[{ key: "all", label: "Все сигналы" }, ...groups].map((g) => (
                <button
                  key={g.key}
                  className={reason === g.key ? "selected" : ""}
                  aria-pressed={reason === g.key}
                  onClick={() => selectReason(g.key as AttentionReason | "all")}
                >
                  {g.label}
                  <span className="count-pill">
                    {data.counts[g.key as keyof typeof data.counts] ??
                      data.counts.total}
                  </span>
                </button>
              ))}
            </AnimatedTabs>
            <div className="filterbar attention-filterbar">
              <div className="search-input">
                <Search size={18} />
                <input
                  aria-label="Поиск в очереди внимания"
                  placeholder="Номер, заголовок или описание…"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                />
                {q && (
                  <button
                    className="search-clear"
                    aria-label="Очистить поиск"
                    onClick={() => {
                      setQ("");
                      setPage(1);
                    }}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
              <select
                aria-label="Приоритет обращения"
                value={priority}
                onChange={(e) => {
                  setPriority(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Все приоритеты</option>
                {Object.entries(priorities).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <span
                className="attention-results"
                role="status"
                aria-live="polite"
              >
                {query.isFetching ? "Обновляем…" : `Найдено: ${data.total}`}
              </span>
            </div>
            {query.isError ? (
              <Failure retry={() => query.refetch()} />
            ) : (
              <div
                className={query.isPlaceholderData ? "attention-updating" : ""}
                aria-busy={query.isFetching}
              >
                {data.items.length ? (
                  <TicketTable tickets={data.items} attention />
                ) : (
                  <div className="attention-empty">
                    <span>
                      <CheckCheck size={30} />
                    </span>
                    <h3>
                      {q || priority || reason !== "all"
                        ? "По этим условиям обращений нет"
                        : "Ничего не требует вмешательства"}
                    </h3>
                    <p>
                      {q || priority || reason !== "all"
                        ? "Измените поиск или вернитесь ко всем сигналам."
                        : "Новые сигналы появятся здесь автоматически."}
                    </p>
                    {(q || priority || reason !== "all") && (
                      <button className="button button-outline" onClick={reset}>
                        Сбросить фильтры
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="pagination">
              <span>
                {data.total
                  ? `${(page - 1) * 10 + 1}–${Math.min(page * 10, data.total)} из ${data.total}`
                  : "0 обращений"}
              </span>
              <div>
                <button
                  className="icon-button"
                  disabled={page === 1 || query.isPlaceholderData}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="Предыдущая страница"
                >
                  <ChevronLeft size={18} />
                </button>
                <span>
                  {page} / {Math.max(1, Math.ceil(data.total / 10))}
                </span>
                <button
                  className="icon-button"
                  disabled={page * 10 >= data.total || query.isPlaceholderData}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Следующая страница"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </section>
          {!data.notifications.enabled && (
            <div className="attention-integration">
              <span className="attention-integration-icon">
                <Unplug size={18} />
              </span>
              <div>
                <strong>Уведомления — следующий этап</strong>
                <p>
                  Отправка ещё не подключена. Ошибки доставки появятся здесь
                  после подключения и журналирования уведомлений.
                </p>
              </div>
              <span className="subtle-tag">Не подключено</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
