import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Plus,
  ArrowRight,
  MessageSquare,
  CheckCheck,
  Clock3,
  AlarmClock,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  api,
  statuses,
  types,
  type Summary,
  type Ticket,
  type User,
} from "./lib";
import { Button } from "./components/ui/button";
import { Failure, Loading, TicketTable } from "./components/common";
const colors = ["#ed151c", "#0b2d48", "#9bb1c5"];
export default function Dashboard({
  user,
  onNew,
}: {
  user: User;
  onNew: () => void;
}) {
  const summary = useQuery<Summary>({
    queryKey: ["summary"],
    queryFn: async () => (await api.get("/analytics/summary")).data,
  });
  const recent = useQuery<{ items: Ticket[] }>({
    queryKey: ["recent"],
    queryFn: async () =>
      (await api.get("/tickets", { params: { page_size: 5 } })).data,
  });
  if (summary.isPending) return <Loading />;
  if (!summary.data) return <Failure retry={() => summary.refetch()} />;
  const d = summary.data;
  const metrics = [
    {
      label: "Всего обращений",
      value: d.total,
      unit: "",
      icon: MessageSquare,
      note: "Доступные вам",
      color: "mint",
    },
    {
      label: "Доля закрытых",
      value: d.closed_percent,
      unit: "%",
      icon: CheckCheck,
      note: "С финальным статусом «Закрыто»",
      color: "violet",
    },
    {
      label: "Время первого ответа",
      value: d.average_first_response_hours ?? "—",
      unit: d.average_first_response_hours === null ? "" : "ч",
      icon: Clock3,
      note: "В среднем по обращениям",
      color: "blue",
    },
    {
      label: "Просрочено",
      value: d.overdue_count,
      unit: "",
      icon: AlarmClock,
      note: "Требуют первого ответа",
      color: "orange",
    },
  ];
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <h1>
            Каждая идея <span>имеет значение.</span>
          </h1>
          <p>
            Здравствуйте, {user.full_name.split(" ")[0]}. Вот что происходит с
            обращениями.
          </p>
        </div>
        <Button onClick={onNew}>
          <Plus size={18} />
          Новое обращение
        </Button>
      </div>
      {user.role !== "ADMIN" && (
        <section className="hero-banner">
          <div className="hero-text">
            <span className="hero-tag">
              <Sparkles size={14} />
              ОБРАТНАЯ СВЯЗЬ СОТРУДНИКОВ
            </span>
            <h2>
              От обратной связи —<br />к реальным улучшениям.
            </h2>
            <p>Открытый диалог. Прозрачные решения. Общий результат.</p>
            <button onClick={onNew}>
              Предложить улучшение <ArrowUpRight size={18} />
            </button>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="grid-plane" />
            <div className="hero-ring ring-one" />
            <div className="hero-ring ring-two" />
            <div className="hero-ring ring-three" />
            <div className="hero-cube">
              <Sparkles size={45} />
            </div>
            <span className="visual-label vl1">
              <span className="live-dot" />
              Новая идея
            </span>
            <span className="visual-label vl2">
              <CheckCheck size={15} />
              Воплощаем вместе
            </span>
            <span className="visual-point p1" />
            <span className="visual-point p2" />
          </div>
        </section>
      )}
      <section className="metrics">
        {metrics.map(({ label, value, unit, icon: Icon, note, color }) => (
          <div className={`metric ${color}`} key={label}>
            <div className="metric-top">
              <span>{label}</span>
              <span className="metric-icon">
                <Icon size={18} />
              </span>
            </div>
            <div className="metric-value">
              {value}
              <span>{unit}</span>
            </div>
            <div className="metric-note">
              {label === "Просрочено" && d.overdue_count > 0 ? (
                <span className="orange-dot" />
              ) : null}
              {note}
            </div>
          </div>
        ))}
      </section>
      <section className="chart-grid">
        <div className="panel">
          <div className="panel-title">
            <div>
              <h3>Характер обращений</h3>
              <p>О чём говорят сотрудники</p>
            </div>
            <span className="subtle-tag">Всего {d.total}</span>
          </div>
          <div className="type-chart">
            <div className="donut">
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie
                    data={Object.entries(types).map(([k, n]) => ({
                      name: n,
                      value: d.by_type[k] || 0,
                    }))}
                    dataKey="value"
                    innerRadius={64}
                    outerRadius={82}
                    paddingAngle={5}
                    stroke="none"
                  >
                    {colors.map((c) => (
                      <Cell key={c} fill={c} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#ffffff",
                      border: "1px solid #e0e6ee",
                      borderRadius: 10,
                    }}
                    itemStyle={{ color: "#0b2d48" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <strong>{d.total}</strong>
                <span>обращений</span>
              </div>
            </div>
            <div className="legend">
              {Object.entries(types).map(([k, n], i) => (
                <div key={k}>
                  <i style={{ background: colors[i] }} />
                  <span>{n}</span>
                  <strong>{d.by_type[k] || 0}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-title">
            <div>
              <h3>Движение к результату</h3>
              <p>Распределение по статусам</p>
            </div>
            <ArrowUpRight size={18} className="muted" />
          </div>
          <div className="status-funnel">
            {Object.entries(statuses).map(([k, n]) => (
              <div className="funnel-row" key={k}>
                <span>{n}</span>
                <div>
                  <i
                    className={`bar-${k}`}
                    style={{
                      width: `${Math.max(((d.by_status[k] || 0) / Math.max(...Object.values(d.by_status), 1)) * 100, 2)}%`,
                    }}
                  />
                </div>
                <strong>{d.by_status[k] || 0}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="panel recent-panel">
        <div className="panel-title">
          <div>
            <h3>
              Последние обращения <span className="count-pill">{d.total}</span>
            </h3>
            <p>Идеи и вопросы, которые двигают нас вперёд</p>
          </div>
          <Link className="text-link" to="/tickets">
            Все обращения
            <ArrowRight size={16} />
          </Link>
        </div>
        {recent.isPending ? (
          <Loading />
        ) : recent.isError ? (
          <Failure retry={() => recent.refetch()} />
        ) : (
          <TicketTable tickets={recent.data?.items || []} />
        )}
      </section>
      <section className="panel categories-chart">
        <div className="panel-title">
          <div>
            <h3>Темы обращений</h3>
            <p>Распределение по категориям</p>
          </div>
        </div>
        <div
          className="category-chart-scroll"
          tabIndex={0}
          role="region"
          aria-label="График тем обращений — горизонтальная прокрутка"
        >
          <div className="category-chart-canvas">
            <ResponsiveContainer
              width="100%"
              height={Math.max(240, Object.keys(d.by_category).length * 44)}
            >
              <BarChart
                layout="vertical"
                data={Object.entries(d.by_category).map(([name, value]) => ({
                  name,
                  value,
                }))}
                margin={{ left: 0, right: 25 }}
              >
                <CartesianGrid stroke="#12334d0d" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fill: "#526b80", fontSize: 13 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={230}
                  tick={{ fill: "#526b80", fontSize: 13 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "#12334d05" }}
                  contentStyle={{
                    background: "#ffffff",
                    border: "1px solid #e0e6ee",
                    borderRadius: 10,
                  }}
                />
                <Bar
                  dataKey="value"
                  name="Обращения"
                  fill="#153e5e"
                  radius={[0, 4, 4, 0]}
                  barSize={10}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
      {d.overdue_count > 0 && (
        <section className="panel recent-panel">
          <div className="panel-title">
            <div>
              <h3>
                <AlarmClock size={17} className="orange-text" />
                Требуют внимания
              </h3>
              <p>Обращения без первого ответа в установленный срок</p>
            </div>
            <span className="badge status-REJECTED">
              {d.overdue_count} просрочено
            </span>
          </div>
          <TicketTable tickets={d.overdue_tickets} />
        </section>
      )}
    </div>
  );
}
