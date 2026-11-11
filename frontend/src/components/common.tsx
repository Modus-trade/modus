import {
  Inbox,
  ArrowUpRight,
  AlertCircle,
  MessageSquareWarning,
  Lightbulb,
  Heart,
  UserRoundX,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  statuses,
  types,
  priorities,
  attentionLabels,
  date,
  datetime,
  type Ticket,
} from "../lib";
export function Badge({ status }: { status: string }) {
  return (
    <span key={status} className={`badge status-${status}`}>
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
    <div className="skeletons" role="status" aria-label="Загрузка данных">
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
export function TicketTable({
  tickets,
  attention = false,
}: {
  tickets: Ticket[];
  attention?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const ticketHref = (id: number) =>
    `/tickets/${id}${attention ? `?returnTo=${encodeURIComponent(location.pathname + location.search)}` : ""}`;
  return tickets.length ? (
    <div className="table-scroll refined-table-scroll">
      <table
        className={`ticket-table refined-ticket-table ${attention ? "attention-ticket-table" : ""}`}
      >
        <caption className="sr-only">
          {attention
            ? "Обращения, требующие внимания администратора"
            : "Список обращений"}
          . Откройте обращение по его заголовку.
        </caption>
        <thead>
          <tr>
            <th>Обращение / категория</th>
            <th>Статус</th>
            <th>Приоритет</th>
            <th>Ответственный</th>
            <th>{attention ? "Последнее действие" : "Создано"}</th>
            <th>
              <span className="sr-only">Открыть карточку</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => {
            const Icon =
              t.type === "PROBLEM"
                ? MessageSquareWarning
                : t.type === "PROPOSAL"
                  ? Lightbulb
                  : Heart;
            const urgent =
              t.overdue &&
              !["IMPLEMENTED", "REJECTED", "CLOSED"].includes(t.status);
            const tone = t.status === "IMPLEMENTED"
              ? "resolved"
              : ["REJECTED", "CLOSED"].includes(t.status)
                ? "neutral"
                : urgent || t.priority === "HIGH"
                  ? "critical"
                  : t.priority === "MEDIUM"
                    ? "moderate"
                    : "calm";
            return (
              <tr
                key={t.id}
                className={`ticket-row row-tone-${tone}${urgent ? " is-overdue" : ""}`}
                onClick={(event) => {
                  if (
                    !(event.target as Element).closest(
                      "a,button,input,select",
                    ) &&
                    !window.getSelection()?.toString()
                  )
                    navigate(ticketHref(t.id));
                }}
              >
                <td>
                  <div className="ticket-subject">
                    <span
                      className={`type-icon type-${t.type}`}
                      aria-hidden="true"
                    >
                      <Icon size={19} />
                    </span>
                    <div className="ticket-subject-copy">
                      <span className="ticket-meta">
                        <span className="ticket-number">{t.number}</span>
                        <span>·</span>
                        {types[t.type]}
                        {urgent && !attention && (
                          <span className="overdue-label">Ответ просрочен</span>
                        )}
                      </span>
                      <Link className="ticket-title-link" to={ticketHref(t.id)}>
                        {t.title}
                      </Link>
                      <span className="ticket-category">{t.category_name}</span>
                      {attention && (
                        <div className="ticket-signals">
                          {t.attention_reasons?.map((r) => (
                            <span key={r} className={`signal-chip signal-${r}`}>
                              {attentionLabels[r]}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <Badge status={t.status} />
                </td>
                <td>
                  <span className={`priority-chip level-${t.priority}`}>
                    <span
                      className={`priority priority-${t.priority}`}
                      aria-hidden="true"
                    >
                      <i />
                      <i />
                      <i />
                    </span>
                    {priorities[t.priority]}
                  </span>
                </td>
                <td>
                  {t.assignee_name ? (
                    <div className="person ticket-assignee">
                      <span className="avatar small" aria-hidden="true">
                        {t.assignee_name
                          .split(" ")
                          .map((x) => x[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <div>
                        <strong>{t.assignee_name}</strong>
                        <small>Ответственный</small>
                      </div>
                    </div>
                  ) : (
                    <span className="assignee-missing">
                      <UserRoundX size={16} />
                      Не назначен
                    </span>
                  )}
                </td>
                <td className="ticket-date">
                  <time
                    dateTime={
                      (attention
                        ? t.last_activity_at || t.updated_at
                        : t.created_at) + "Z"
                    }
                    title={datetime(
                      attention
                        ? t.last_activity_at || t.updated_at
                        : t.created_at,
                    )}
                  >
                    {date(
                      attention
                        ? t.last_activity_at || t.updated_at
                        : t.created_at,
                    )}
                  </time>
                  <small>
                    {attention ? "Последняя активность" : t.department}
                  </small>
                </td>
                <td>
                  <Link
                    to={ticketHref(t.id)}
                    className="row-arrow"
                    aria-label={`Открыть обращение ${t.number}: ${t.title}`}
                  >
                    <ArrowUpRight size={19} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty />
  );
}
