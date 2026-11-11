import { useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { api, roles, errorMessage, type User } from "./lib";
import { Disclosure, useRouteMotion } from "./components/motion";
import { clearSession } from "./session";
import { Button } from "./components/ui/button";
import { Loading } from "./components/common";
import Dashboard from "./Dashboard";
import Tickets, { NewTicket } from "./Tickets";
import TicketDetail from "./TicketDetail";
import Administration from "./Administration";

function Logo() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <i />
      </span>
      <div>
        МОДУС ТРЕЙД<span>ПРОСТРАНСТВО УЛУЧШЕНИЙ</span>
      </div>
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
          <h2>Войти в пространство</h2>
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
  const [mobile, setMobile] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const routeMotion = useRouteMotion();
  const fetching = useIsFetching();
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
  const nav = [
    ...(manager ? [{ path: "/", label: "Обзор", icon: LayoutDashboard }] : []),
    {
      path: "/tickets",
      label: admin ? "Все обращения" : manager ? "Инбокс" : "Мои обращения",
      icon: Inbox,
    },
    ...(admin
      ? [
          { path: "/unassigned", label: "Нераспределённые", icon: Unplug },
          { path: "/categories", label: "Категории", icon: Layers3 },
          { path: "/users", label: "Пользователи", icon: Users },
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
        <div className="workspace-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        <nav>
          {nav.map(({ path, label, icon: Icon }) => (
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
              {path === "/" && <span className="nav-live" />}
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
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              onClick={() => setMobile(true)}
              aria-label="Открыть меню"
            >
              <Menu size={20} />
            </button>
            <span>Рабочее пространство</span>
            <span>/</span>
            <strong>
              {nav.find((n) => n.path === location.pathname)?.label ||
                "Обращение"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="role-label">
              <ShieldCheck size={13} />
              {roles[user.role]}
            </span>
            <span className="divider" />
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
                manager ? (
                  <Dashboard user={user} onNew={() => setNewOpen(true)} />
                ) : (
                  <Navigate to="/tickets" replace />
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer className="page-footer">
          <span>Модус · Сделаем работу лучше вместе</span>
          <span>
            <span className="live-dot" />
            Система обратной связи
          </span>
        </footer>
      </div>
      <NewTicket open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}
