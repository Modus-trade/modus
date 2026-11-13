import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, errorMessage, statuses } from "../lib";
import "../onec.css";
type Group = {
  key: string;
  name: string;
  code: string;
  count: number;
  open: number;
  participations: number;
};
type Data = {
  groups: Group[];
  total: number;
  tickets: { id: number; number: string; title: string; status: string }[];
};
export default function OneCAnalytics() {
  const [mode, setMode] = useState("mock"),
    [group, setGroup] = useState("items"),
    [days, setDays] = useState("90"),
    [key, setKey] = useState(""),
    [page, setPage] = useState(1);
  const q = useQuery<Data>({
    queryKey: ["onec-analytics", mode, group, days, key, page],
    queryFn: async () =>
      (
        await api.get("/integrations/onec/analytics", {
          params: { mode, group, days, key: key || undefined, page },
        })
      ).data,
  });
  function change(set: (s: string) => void, value: string) {
    set(value);
    setKey("");
    setPage(1);
  }
  return (
    <section className="panel padded onec-analytics">
      <div className="onec-heading">
        <div>
          <span className="eyebrow">ПОВТОРЯЮЩИЕСЯ ПРОБЛЕМЫ</span>
          <h2>Что требует внимания в 1С</h2>
          <p className="muted">
            Рейтинг по числу обращений типа «Проблема», доступных вам. Поставщик
            определяется по заказу поставщику.
          </p>
        </div>
      </div>
      <div className="onec-filters">
        <label>
          Источник
          <select
            value={mode}
            onChange={(e) => change(setMode, e.target.value)}
          >
            <option value="mock">Демонстрационные данные</option>
            <option value="real">Реальная 1С</option>
          </select>
        </label>
        <label>
          Группировка
          <select
            value={group}
            onChange={(e) => change(setGroup, e.target.value)}
          >
            <option value="items">Товары и материалы</option>
            <option value="suppliers">Поставщики</option>
          </select>
        </label>
        <label>
          Период
          <select
            value={days}
            onChange={(e) => change(setDays, e.target.value)}
          >
            <option value="30">30 дней</option>
            <option value="90">90 дней</option>
            <option value="365">Год</option>
          </select>
        </label>
      </div>
      {q.isPending && <p>Считаем обращения…</p>}
      {q.isError && <p role="alert">{errorMessage(q.error)}</p>}
      {q.data && !q.data.groups.length && (
        <div className="onec-empty">
          Пока нет связанных проблем за этот период. Создайте обращение типа
          «Проблема» и выберите позицию или заказ из 1С.
        </div>
      )}
      <div className="onec-ranks">
        {q.data?.groups.map((g, i) => (
          <button
            type="button"
            key={g.key}
            className={key === g.key ? "selected" : ""}
            onClick={() => {
              setKey(g.key);
              setPage(1);
            }}
          >
            <span className="onec-rank-number">{i + 1}</span>
            <span className="onec-rank-name">
              <strong>{g.name}</strong>
              <small>
                {g.code} · В работе и на проверке: {g.open}
              </small>
              <span
                className="onec-bar"
                style={{
                  width: `${Math.max(5, (100 * g.count) / (q.data?.groups[0].count || 1))}%`,
                }}
              />
            </span>
            <span>
              <b>{g.count}</b>
              <small>обращений</small>
            </span>
            <span>
              <b>{g.participations}</b>
              <small>участий*</small>
            </span>
          </button>
        ))}
      </div>
      {!!q.data?.groups.length && (
        <small className="muted">
          * Автор и присоединившиеся в каждом обращении. Один сотрудник может
          участвовать в нескольких обращениях.
        </small>
      )}
      {key && (
        <div className="onec-drill">
          <h3>Связанные обращения · {q.data?.total || 0}</h3>
          {q.data?.tickets.map((t) => (
            <Link key={t.id} to={`/tickets/${t.id}`}>
              <span>
                {t.number} · {t.title}
              </span>
              <small>
                {statuses[t.status as keyof typeof statuses] || t.status} ↗
              </small>
            </Link>
          ))}
          <div className="onec-pagination">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Назад
            </button>
            <span>{page}</span>
            <button
              disabled={page * 20 >= (q.data?.total || 0)}
              onClick={() => setPage((p) => p + 1)}
            >
              Далее
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
