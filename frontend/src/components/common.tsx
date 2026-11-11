import { Inbox, ArrowUpRight, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { statuses, types, date, type Ticket } from "../lib";
export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge status-${status}`}>
      <i />
      {statuses[status]}
    </span>
  );
}
export function Empty({
  title = "Здесь пока ничего нет",
  text = "Попробуйте изменить фильтры или создайте новое обращение.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty">
      <Inbox size={38} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function Loading() {
  return (
    <div className="skeletons">
      {[1, 2, 3, 4].map((i) => (
        <div className="skeleton" key={i} />
      ))}
    </div>
  );
}
export function Failure({ retry }: { retry: () => void }) {
  return (
    <div className="empty">
      <AlertCircle />
      <h3>Не удалось загрузить данные</h3>
      <button className="button button-outline" onClick={retry}>
        Попробовать снова
      </button>
    </div>
  );
}
export function TicketTable({ tickets }: { tickets: Ticket[] }) {
  return tickets.length ? (
    <div className="table-scroll">
      <table className="ticket-table">
        <thead>
          <tr>
            <th>Обращение</th>
            <th>Статус</th>
            <th>Приоритет</th>
            <th>Ответственный</th>
            <th>Создано</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.id}>
              <td>
                <Link className="ticket-link" to={`/tickets/${t.id}`}>
                  <span className={`type-icon type-${t.type}`}>
                    {t.type === "PROBLEM"
                      ? "!"
                      : t.type === "PROPOSAL"
                        ? "↗"
                        : "✧"}
                  </span>
                  <span>
                    <span className="ticket-meta">
                      {t.number}
                      <span>·</span>
                      {types[t.type]}
                      {t.overdue && (
                        <span className="overdue-label">Срок ответа истёк</span>
                      )}
                    </span>
                    <strong>{t.title}</strong>
                    <small>{t.category_name}</small>
                  </span>
                </Link>
              </td>
              <td>
                <Badge status={t.status} />
              </td>
              <td>
                <span className={`priority priority-${t.priority}`}>
                  <i />
                  <i />
                  <i />
                </span>
                <span className="muted">
                  {
                    { HIGH: "Высокий", MEDIUM: "Средний", LOW: "Низкий" }[
                      t.priority as "HIGH"
                    ]
                  }
                </span>
              </td>
              <td>
                <div className="person">
                  <span className="avatar small">
                    {t.assignee_name
                      ?.split(" ")
                      .map((x) => x[0])
                      .slice(0, 2)
                      .join("") || "—"}
                  </span>
                  <span>{t.assignee_name || "Не назначен"}</span>
                </div>
              </td>
              <td className="muted nowrap">{date(t.created_at)}</td>
              <td>
                <Link
                  to={`/tickets/${t.id}`}
                  className="row-arrow"
                  aria-label={`Открыть ${t.number}`}
                >
                  <ArrowUpRight size={18} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty />
  );
}
