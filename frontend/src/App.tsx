import { useEffect, useState } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  LayoutDashboard,
  Inbox,
  Layers3,
  Users,
  LogOut,
  LoaderCircle,
  Menu,
  X,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  CircleHelp,
  Unplug,
  Radar,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage, type AttentionSummary, type User } from "./lib";
import { Disclosure, useRouteMotion } from "./components/motion";
import { clearSession } from "./session";
import { Button } from "./components/ui/button";
import { Loading } from "./components/common";
import Dashboard from "./Dashboard";
import Attention from "./Attention";
import NotificationBell from "./components/NotificationBell";
import { useRealtime, type NotificationList } from "./realtime";
import Tickets, { NewTicket } from "./Tickets";
import TicketDetail from "./TicketDetail";
import Administration from "./Administration";
import Integrations from "./Integrations";
import KnowledgeBase from "./KnowledgeBase";
import type { KnowledgeContext } from "./knowledge";

/** Официальный логотип «Модус Трейд» (тот же SVG, что на modus-trade.kz и в мобильном приложении). */
function Logo() {
  return (
    <div className="brand">
      <img className="brand-logo" src="/brand/modus-logo.svg" alt="Модус Трейд" width={132} height={42} />
    </div>
  );
}
function Login() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api.post("/auth/login", { email, password });
      qc.setQueryData(["me"], r.data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-art">
        <Logo />
        <div className="orbital">
          <div className="orbit o1" />
          <div className="orbit o2" />
          <div className="orbit o3" />
          <div className="core">
            <Sparkles size={56} />
          </div>
          <span className="orbit-chip oc1">
            Идея становится действием <ArrowUpRight size={16} />
          </span>
          <span className="orbit-chip oc2">
            <span className="live-dot" />
            Каждый голос имеет значение
          </span>
        </div>
        <div className="login-statement">
          <span className="eyebrow">ОБРАТНАЯ СВЯЗЬ, КОТОРАЯ РАБОТАЕТ</span>
          <h1>
            Большие перемены
            <br />
            начинаются <em>с вас.</em>
          </h1>
          <p>
            Делитесь идеями, сообщайте о проблемах
            <br />и следите, как компания становится лучше.
          </p>
        </div>
        <div className="art-footer">
          ГК «Модус Трейд»<span>Внутренняя платформа</span>
        </div>
      </div>
      <div className="login-form-wrap">
        <div className="login-form">
          <span className="eyebrow">РАДЫ ВАС ВИДЕТЬ</span>
          <h2>Вход в систему</h2>
          <p className="muted">
            Ваши идеи. Понятный процесс. Видимый результат.
          </p>
          <form onSubmit={login}>
            <label>
              Рабочая почта
              <input
                type="email"
                required
                placeholder="name@modus.demo"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Пароль
              <input
                type="password"
                required
                placeholder="Введите пароль"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button loading={busy} disabled={busy} className="full">
              {busy ? "Входим…" : "Войти"}
              <ArrowRight size={18} />
            </Button>
          </form>
          <div className="demo-box">
            <div>
              <ShieldCheck size={17} />
              Демонстрационный доступ
            </div>
            <p>Выберите роль, затем нажмите «Войти».</p>
            <div className="demo-roles">
              {[
                ["employee", "Сотрудник"],
                ["manager.procurement", "Руководитель"],
                ["admin", "Администратор"],
              ].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => {
                    setEmail(v + "@modus.demo");
                    setPassword("demo1234");
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
            <small>Все данные вымышлены. Пароль: demo1234</small>
          </div>
          <p className="login-note">
            <ShieldCheck size={14} />
            Доступ только для сотрудников компании
          </p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const qc = useQueryClient();
  const me = useQuery<User | null>({
    queryKey: ["me"],
    queryFn: async ({ signal }) => (await api.get("/auth/me", { signal })).data,
    retry: false,
  });
  const attention = useQuery<Pick<AttentionSummary, "counts">>({
    queryKey: ["navigation-attention"],
    queryFn: async ({ signal }) =>
      (await api.get("/analytics/attention", { params: { page_size: 1 }, signal })).data,
    enabled: me.data?.role === "ADMIN",
    refetchInterval: 30000,
  });
  const [mobile, setMobile] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [knowledgeContext, setKnowledgeContext] = useState<KnowledgeContext | undefined>();
  const [help, setHelp] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const routeMotion = useRouteMotion();
  const fetching = useIsFetching();
  useRealtime(me.data?.id);
  // Открыли обращение — события по нему считаются прочитанными.
  const openedTicket = location.pathname.match(/^\/tickets\/(\d+)$/)?.[1];
  useEffect(() => {
    if (!openedTicket || !me.data) return;
    const list = qc.getQueryData<NotificationList>(["notifications"]);
    if (list && !list.items.some((n) => !n.read_at && String(n.ticket_id) === openedTicket)) return;
    api
      .post(`/notifications/read-ticket/${openedTicket}`)
      .then(() => qc.invalidateQueries({ queryKey: ["notifications"] }))
      .catch(() => undefined);
  }, [openedTicket, me.data, qc]);
  if (me.isPending)
    return (
      <div className="startup">
        <Logo />
        <Loading />
      </div>
    );
  if (!me.data) return <Login />;
  const user = me.data;
  const manager = user.role !== "EMPLOYEE";
  const admin = user.role === "ADMIN";
  const nav: { path: string; label: string; icon: LucideIcon; alert?: number }[] = [
    ...(admin
      ? [
          { path: "/", label: "Требует внимания", icon: Radar, alert: attention.data?.counts.total },
          { path: "/overview", label: "Аналитика", icon: LayoutDashboard },
        ]
      : manager
        ? [{ path: "/", label: "Обзор", icon: LayoutDashboard }]
        : []),
    {
      path: "/tickets",
      label: admin ? "Все обращения" : manager ? "Инбокс" : "Мои обращения",
      icon: Inbox,
    },
    { path: "/knowledge", label: "Инструкции и ответы", icon: BookOpen },
    ...(admin
      ? [
          { path: "/categories", label: "Категории", icon: Layers3 },
          { path: "/users", label: "Пользователи", icon: Users },
          { path: "/integrations", label: "Интеграции", icon: Unplug },
          { path: "/unassigned", label: "Нераспределённые", icon: Unplug, alert: attention.data?.counts.unassigned },
        ]
      : []),
  ];
  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await api.post("/auth/logout");
      await clearSession(qc);
      setMobile(false);
      setNewOpen(false);
      setHelp(false);
      navigate("/", { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoggingOut(false);
    }
  }
  return (
    <div className="app" onClickCapture={routeMotion}>
      <div
        className="fetch-progress"
        data-active={fetching > 0}
        aria-hidden="true"
      />
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <Logo />
        <button
          className="mobile-close icon-button"
          onClick={() => setMobile(false)}
          aria-label="Закрыть меню"
        >
          <X />
        </button>
        <div className="workspace-label">РАЗДЕЛЫ</div>
        <nav>
          {nav.map(({ path, label, icon: Icon, alert }) => (
            <NavLink
              key={path}
              to={path}
              end
              onClick={() => setMobile(false)}
              className={({ isActive }) =>
                isActive ? "nav-item active" : "nav-item"
              }
            >
              <Icon size={19} />
              <span className="nav-label">{label}</span>
              {!!alert && <span className="nav-live" role="img" aria-label={`Требуют внимания обращений ${alert}`} title={`Требуют внимания обращений ${alert}`} />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="idea-note">
            <div className="mini-spark">
              <Sparkles size={19} />
            </div>
            <h4>Есть идея?</h4>
            <p>
              Даже небольшое предложение
              <br />
              может изменить многое.
            </p>
            <button onClick={() => setNewOpen(true)}>
              Поделиться идеей
              <ArrowUpRight size={15} />
            </button>
          </div>
          <button
            className="help-link"
            aria-expanded={help}
            aria-controls="help-content"
            onClick={() => setHelp(!help)}
          >
            <CircleHelp size={17} />
            Как это работает
          </button>
          <Disclosure open={help} id="help-content">
            <p className="help-text">
              Создайте обращение. Категория определит ответственного. В карточке
              вы увидите статус, уточнения и результат рассмотрения.
            </p>
          </Disclosure>
          <div className="sidebar-company">
            <span className="live-dot" />
            ГК «Модус Трейд»<span>v1.0</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            onClick={() => setMobile(true)}
            aria-label="Открыть меню"
          >
            <Menu size={20} />
          </button>
          <div className="topbar-right">
            <NotificationBell />
            <div className="person">
              <span className="avatar">
                {user.full_name
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <div>
                <strong>{user.full_name}</strong>
                <small>{user.department}</small>
              </div>
            </div>
            <button
              className="icon-button logout"
              title="Выйти"
              aria-label={loggingOut ? "Выходим…" : "Выйти"}
              aria-busy={loggingOut}
              disabled={loggingOut}
              onClick={logout}
            >
              {loggingOut ? (
                <LoaderCircle size={18} className="button-spinner" />
              ) : (
                <LogOut size={18} />
              )}
            </button>
          </div>
        </header>
        <main key={location.pathname}>
          <Routes>
            <Route
              path="/"
              element={
                admin ? (
                  <Attention />
                ) : manager ? (
                  <Dashboard user={user} onNew={() => setNewOpen(true)} />
                ) : (
                  <Navigate to="/tickets" replace />
                )
              }
            />
            <Route
              path="/overview"
              element={
                admin ? (
                  <Dashboard user={user} onNew={() => setNewOpen(true)} />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/tickets"
              element={<Tickets user={user} onNew={() => setNewOpen(true)} />}
            />
            <Route
              path="/unassigned"
              element={
                admin ? (
                  <Tickets
                    user={user}
                    unassigned
                    onNew={() => setNewOpen(true)}
                  />
                ) : (
                  <Navigate to="/tickets" replace />
                )
              }
            />
            <Route path="/tickets/:id" element={<TicketDetail user={user} />} />
            <Route path="/knowledge" element={<KnowledgeBase user={user} onNew={(context) => { setKnowledgeContext(context); setNewOpen(true); }} />} />
            <Route
              path="/categories"
              element={
                admin ? (
                  <Administration kind="categories" />
                ) : (
                  <Navigate to="/tickets" replace />
                )
              }
            />
            <Route
              path="/users"
              element={
                admin ? (
                  <Administration kind="users" />
                ) : (
                  <Navigate to="/tickets" replace />
                )
              }
            />
            <Route path="/integrations" element={admin ? <Integrations /> : <Navigate to="/tickets" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <NewTicket open={newOpen} initialKnowledge={knowledgeContext} onClose={() => { setNewOpen(false); setKnowledgeContext(undefined); }} />
    </div>
  );
}
