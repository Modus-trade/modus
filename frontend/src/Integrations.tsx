import OneCPanel from "./components/OneCPanel";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Network,
  RefreshCw,
  ShieldCheck,
  ArrowUpRight,
  Building2,
  BellRing,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage, type User } from "./lib";
import { Button } from "./components/ui/button";
import { Loading, Failure } from "./components/common";
import { AnimatedTabs } from "./components/motion";
import "./integrations.css";
import BitrixBotPanel from "./components/BitrixBotPanel";

const base = "/integrations/bitrix";
export const exchangeError = (value: string) =>
  (
    ({
      EMPLOYEE_NOT_LINKED_OR_INACTIVE:
        "Исполнитель не связан с активным сотрудником этого портала. Проверьте связь аккаунтов.",
      insufficient_scope:
        "Вебхуку не хватает прав. Проверьте настройки доступа в Битрикс24.",
      INSUFFICIENT_SCOPE:
        "Вебхуку не хватает прав. Проверьте настройки доступа в Битрикс24.",
      NETWORK_OR_INVALID_RESPONSE:
        "Нет подтверждения от портала. Проверьте подключение и состояние операции.",
      NOTIFICATION_NOT_DELIVERED:
        "Портал не принял уведомление. Проверьте получателя и повторите отправку.",
      WEBHOOK_NOT_CONFIGURED: "Не настроен адрес вебхука на сервере.",
      INVALID_PUBLIC_URL: "Адрес Модуса для ссылок настроен неправильно.",
      REMOTE_SERVER_ERROR: "Битрикс24 временно недоступен.",
    }) as Record<string, string>
  )[value] || value;

export const exchangeStates: Record<string, string> = {
  pending: "Ожидает",
  sent: "Готово",
  error: "Ошибка",
  skipped: "Пропущено",
  uncertain: "Нужна проверка",
  sending: "Отправляется",
  waiting: "Ждёт начала работы",
  linked: "Связана",
  creating: "Создаётся",
  needs_result: "Нужен результат",
  review_required: "Нужна проверка",
  off: "Не подключена",
};
export const exchangeDate = (v?: string | null) =>
  v
    ? new Date(/Z$|[+-]\d\d:\d\d$/.test(v) ? v : `${v}Z`).toLocaleString(
        "ru-RU",
      )
    : "—";
interface Entry {
  id: number;
  kind: string;
  external_id: number;
  user_id: number | null;
  local_name: string;
  name: string;
  email?: string;
  active?: boolean;
  department_ids?: number[];
  head_id?: number;
  parent_id?: number;
  position?: string;
  synced_at: string;
  managed: boolean;
}
interface Job {
  id: number;
  kind: string;
  state: string;
  message: string;
  attempts: number;
  created_at: string;
  recipient?: string;
  ticket_id?: number;
  internal_created: boolean;
}
interface Overview {
  mode: string;
  portal: string;
  public_url: string;
  health: string;
  synced_at?: string;
  directory: Entry[];
  jobs: Job[];
}

function BitrixIntegrations() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("employees");
  const query = useQuery<Overview>({
    queryKey: ["bitrix"],
    queryFn: async () => (await api.get(base)).data,
    refetchInterval: 10000,
  });
  const users = useQuery<User[]>({
    queryKey: ["users"],
    refetchInterval: 10000,
    queryFn: async () => (await api.get("/users")).data,
  });
  async function action(path: string, data = {}, method = "post") {
    setBusy(true);
    try {
      await api.request({ url: base + path, method, data });
      await qc.invalidateQueries({ queryKey: ["bitrix"] });
      await qc.invalidateQueries({ queryKey: ["assignees"] });
      toast.success(
        path === "/sync" ? "Синхронизация поставлена в очередь" : "Готово",
      );
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (query.isPending) return <Loading />;
  if (!query.data) return <Failure retry={() => query.refetch()} />;
  const d = query.data;
  const employees = d.directory.filter((e) => e.kind === "employee");
  const departments = d.directory.filter((e) => e.kind === "department");
  const name = (id?: number) =>
    employees.find((e) => e.external_id === id)?.name || "Не назначен";
  const problems = d.jobs.filter((j) =>
    ["error", "uncertain"].includes(j.state),
  ).length;
  return (
    <div className="integration-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ЕДИНОЕ РАБОЧЕЕ ПРОСТРАНСТВО</span>
          <h1>
            Связь с Битрикс24
            <span className={`integration-mode ${d.mode}`}>
              <i />
              {d.mode === "real"
                ? "Реальный портал"
                : d.mode === "mock"
                  ? "МОК · демо"
                  : "Выключено"}
            </span>
          </h1>
          <p>Сотрудники, задачи и события — рядом с обращениями.</p>
        </div>
      </div>
      <section className="integration-hero">
        <div>
          <Network size={32} />
          <h2>Команда на связи.</h2>
          <p>
            {d.mode === "real"
              ? d.portal
              : d.mode === "mock"
                ? "Демонстрационные данные. Запросы в портал не отправляются."
                : "Выберите режим, чтобы начать обмен."}
          </p>
          <small>Последний импорт: {exchangeDate(d.synced_at)}</small>
        </div>
        <div className="integration-controls">
          <div className="integration-mode-switch" role="radiogroup" aria-label="Режим обмена">
            <span>Режим обмена</span>
            <div>
              {[
                ["off", "Выключено"],
                ["mock", "МОК · демо"],
                ["real", "Реальный портал"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={d.mode === value}
                  className={d.mode === value ? "selected" : ""}
                  disabled={busy}
                  onClick={() => d.mode !== value && action("/mode", { mode: value }, "put")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="integration-actions">
            <Button
              variant="outline"
              disabled={busy || d.mode === "off"}
              onClick={() => action("/check")}
            >
              <ShieldCheck size={16} />
              Проверить связь
            </Button>
            <Button
              disabled={busy || d.mode === "off"}
              onClick={() => action("/sync")}
            >
              <RefreshCw size={16} />
              Синхронизировать
            </Button>
          </div>
        </div>
      </section>
      <section className="metrics integration-metrics">
        {[
          { label: "Подразделений", value: departments.length, note: "Из оргструктуры портала", icon: Building2 },
          { label: "Сотрудников", value: employees.length, note: "Синхронизировано с Модусом", icon: Network },
          { label: "Ошибок обмена", value: problems, note: "В последних 100 событиях", icon: BellRing },
        ].map(({ label, value, note, icon: Icon }) => (
          <div className="metric" key={label}>
            <div className="metric-top">
              <span>{label}</span>
              <span className="metric-icon">
                <Icon size={18} />
              </span>
            </div>
            <div className="metric-value">{value}</div>
            <div className="metric-note">{note}</div>
          </div>
        ))}
      </section>
      <details className="panel padded integration-diagnostics">
        <summary>Состояние подключения и ссылки</summary>
        <pre>
          {(() => {
            try {
              return JSON.stringify(JSON.parse(d.health), null, 2);
            } catch {
              return d.health;
            }
          })()}
        </pre>
        <p>
          Ссылки в уведомлениях: <strong>{d.public_url}</strong>
        </p>
        {/localhost|127\.0\.0\.1/.test(d.public_url) && (
          <p className="orange-text">
            Сейчас ссылка доступна только на этом компьютере. Для команды
            задайте MODUS_PUBLIC_URL в backend/.env и перезапустите API.
          </p>
        )}
      </details>
      <BitrixBotPanel key={d.mode} mode={d.mode} people={d.directory} />
      <AnimatedTabs value={tab} label="Раздел интеграции">
        {[
          ["employees", "Сотрудники"],
          ["departments", "Оргструктура"],
          ["events", "Журнал обмена"],
        ].map(([key, label]) => (
          <button
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "selected" : ""}
            key={key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </AnimatedTabs>
      {tab === "employees" && (
        <section className="panel padded">
          <div className="integration-section-head">
            <div>
              <h3>Синхронизация сотрудников</h3>
              <p className="muted">
                Импорт не выдаёт права администратора и не меняет пароль.
                Существующий аккаунт можно связать вручную.
              </p>
            </div>
            <input
              aria-label="Поиск сотрудника"
              placeholder="Имя, почта или должность…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="integration-table-wrap">
            <table className="integration-table">
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Подразделение / руководитель</th>
                  <th>Аккаунт Модус</th>
                  <th>Состояние</th>
                </tr>
              </thead>
              <tbody>
                {employees
                  .filter((e) =>
                    `${e.name} ${e.email} ${e.position}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((e) => (
                    <tr key={e.id}>
                      <td>
                        <strong>{e.name}</strong>
                        <small>{e.position || "Должность не указана"}</small>
                        <small>{e.email}</small>
                      </td>
                      <td>
                        {(e.department_ids || []).map((id) => {
                          const dep = departments.find(
                            (d) => d.external_id === id,
                          );
                          return (
                            <div key={id}>
                              {dep?.name || `#${id}`}
                              <small>{name(dep?.head_id)}</small>
                            </div>
                          );
                        })}
                      </td>
                      <td>
                        <select
                          aria-label={`Учётная запись: ${e.name}`}
                          disabled={busy}
                          value={e.user_id || ""}
                          onChange={(event) =>
                            action(
                              `/directory/${e.id}/link`,
                              { user_id: Number(event.target.value) },
                              "put",
                            )
                          }
                        >
                          <option value="" disabled>
                            Выберите аккаунт
                          </option>
                          {users.data
                            ?.filter((u) => u.is_active || u.id === e.user_id)
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.full_name} · {u.email}
                              </option>
                            ))}
                        </select>
                        <small>
                          {e.managed
                            ? "Импортирован · пароль задаётся в «Пользователи»"
                            : "Связан вручную"}
                        </small>
                      </td>
                      <td>
                        <span
                          className={`exchange-state ${e.active ? "sent" : "skipped"}`}
                        >
                          {e.active ? "Активен" : "Неактивен"}
                        </span>
                        <small>{exchangeDate(e.synced_at)}</small>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!employees.length && (
            <p className="integration-empty">
              Сотрудников пока нет. Запустите синхронизацию — результат появится
              здесь.
            </p>
          )}
        </section>
      )}
      {tab === "departments" && (
        <section className="integration-departments">
          {departments.map((d) => (
            <article className="panel padded" key={d.id}>
              <Building2 />
              <h3>{d.name}</h3>
              <p>{name(d.head_id)}</p>
              <small className="muted">
                {d.parent_id
                  ? `В составе: ${departments.find((p) => p.external_id === d.parent_id)?.name || d.parent_id}`
                  : "Верхний уровень структуры"}
              </small>
            </article>
          ))}
          {!departments.length && <p>Сначала синхронизируйте оргструктуру.</p>}
        </section>
      )}
      {tab === "events" && (
        <section className="panel padded">
          <h2>Доставка событий</h2>
          <p className="muted">
            Последние 100 событий. Ошибки повторяются до 5 попыток. При
            неизвестном результате отправки автоповтор остановлен.
          </p>
          <div className="integration-events">
            {d.jobs.map((j) => (
              <article key={j.id}>
                <div className="integration-event-icon">
                  {j.kind === "notification" ? (
                    <BellRing size={20} />
                  ) : (
                    <RefreshCw size={20} />
                  )}
                </div>
                <div className="integration-event-body">
                  <strong>
                    {j.kind === "notification"
                      ? j.recipient
                      : {
                          directory: "Синхронизация команды",
                          task_create: "Создание задачи",
                          task_result: "Результат задачи",
                          account_link: "Связь аккаунта",
                        }[j.kind] || j.kind}
                  </strong>
                  <p>{exchangeError(j.message) || "В очереди на отправку"}</p>
                  <small>
                    {exchangeDate(j.created_at)} · попыток: {j.attempts}
                  </small>
                  {j.ticket_id && (
                    <Link to={`/tickets/${j.ticket_id}`}>
                      Открыть обращение <ArrowUpRight size={14} />
                    </Link>
                  )}
                </div>
                <div className="integration-delivery">
                  {j.internal_created && (
                    <small>
                      <CheckCircle2 size={13} />
                      Внутри системы — создано
                    </small>
                  )}
                  <span className={`exchange-state ${j.state}`}>
                    Битрикс24 — {exchangeStates[j.state] || j.state}
                  </span>
                  {["error", "skipped"].includes(j.state) && (
                    <button
                      disabled={busy}
                      onClick={() => action(`/jobs/${j.id}/retry`)}
                    >
                      Повторить
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!d.jobs.length && (
            <p className="integration-empty">Здесь появится история обмена.</p>
          )}
        </section>
      )}
    </div>
  );
}

export default function Integrations(){return <><OneCPanel/><BitrixIntegrations/></>}
