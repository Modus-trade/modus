import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Users, Layers3, Search } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage, roles, type User, type Category } from "./lib";
import { Button } from "./components/ui/button";
import { Modal } from "./components/ui/dialog";
import { Empty, Failure, Loading } from "./components/common";
export default function Administration({
  kind,
}: {
  kind: "users" | "categories";
}) {
  const qc = useQueryClient();
  const users = kind === "users";
  const query = useQuery<(User & Category)[]>({
    queryKey: [kind],
    queryFn: async () => (await api.get("/" + kind)).data,
  });
  const people = useQuery<User[]>({
    queryKey: ["assignees"],
    queryFn: async () => (await api.get("/assignees")).data,
  });
  const [editing, setEditing] = useState<Partial<User & Category> | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const values = Object.fromEntries(form);
    const data = users
      ? {
          email: values.email,
          full_name: values.full_name,
          role: values.role,
          department: values.department,
          position: values.position,
          is_active: values.is_active === "on",
          ...((values.password as string) ? { password: values.password } : {}),
        }
      : {
          name: values.name,
          description: values.description,
          default_assignee_id: values.default_assignee_id
            ? Number(values.default_assignee_id)
            : null,
          sla_first_response_hours: Number(values.sla_first_response_hours),
          sort_order: Number(values.sort_order),
          is_active: values.is_active === "on",
        };
    try {
      if (editing?.id) await api.patch(`/${kind}/${editing.id}`, data);
      else await api.post(`/${kind}`, data);
      await qc.invalidateQueries();
      setEditing(null);
      toast.success("Изменения сохранены");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const items = query.data?.filter((x) =>
    (users ? x.full_name + " " + x.email : x.name)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <span className="eyebrow">АДМИНИСТРИРОВАНИЕ</span>
          <h1>
            {users ? "Пользователи" : "Категории"}
            <span className="heading-count">{query.data?.length ?? "—"}</span>
          </h1>
          <p>
            {users
              ? "Люди, роли и подразделения вашего пространства."
              : "Настройте маршрутизацию и сроки первого ответа."}
          </p>
        </div>
        <Button onClick={() => setEditing({ is_active: true })}>
          <Plus size={18} />
          {users ? "Добавить пользователя" : "Новая категория"}
        </Button>
      </div>
      <div className="panel">
        <div className="filterbar">
          <div className="search-input">
            <Search size={17} />
            <input
              placeholder={users ? "Найти пользователя…" : "Найти категорию…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <Failure retry={() => query.refetch()} />
        ) : items?.length ? (
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  {(users
                    ? ["Пользователь", "Роль", "Подразделение", "Статус", ""]
                    : [
                        "Категория",
                        "Ответственный",
                        "Первый ответ",
                        "Статус",
                        "",
                      ]
                  ).map((x, i) => (
                    <th key={i}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="person">
                        <span className="directory-icon">
                          {users ? <Users size={18} /> : <Layers3 size={18} />}
                        </span>
                        <div>
                          <strong>{users ? item.full_name : item.name}</strong>
                          <small>{users ? item.email : item.description}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {users
                        ? roles[item.role]
                        : people.data?.find(
                            (p) => p.id === item.default_assignee_id,
                          )?.full_name || "Не назначен"}
                    </td>
                    <td>
                      {users
                        ? item.department
                        : `${item.sla_first_response_hours} ч`}
                    </td>
                    <td>
                      <span
                        className={`badge ${item.is_active ? "status-IMPLEMENTED" : "status-CLOSED"}`}
                      >
                        <i />
                        {item.is_active ? "Активен" : "Отключён"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label="Редактировать"
                        onClick={() => {
                          setError("");
                          setEditing(item);
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </div>
      <Modal
        open={editing !== null}
        onClose={() => !busy && setEditing(null)}
        title={`${editing?.id ? "Редактирование" : "Создание"} ${users ? "пользователя" : "категории"}`}
      >
        <form key={editing?.id || "new"} onSubmit={save} className="form-stack">
          {users ? (
            <>
              <label>
                Полное имя
                <input
                  name="full_name"
                  required
                  defaultValue={editing?.full_name}
                  maxLength={255}
                />
              </label>
              <label>
                Рабочая почта
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={editing?.email}
                />
              </label>
              <label>
                Пароль{" "}
                {editing?.id && (
                  <span className="optional">
                    оставьте пустым, чтобы сохранить текущий
                  </span>
                )}
                <input
                  name="password"
                  type="password"
                  minLength={8}
                  maxLength={72}
                  required={!editing?.id}
                  autoComplete="new-password"
                />
              </label>
              <div className="form-grid">
                <label>
                  Роль
                  <select
                    name="role"
                    defaultValue={editing?.role || "EMPLOYEE"}
                  >
                    {Object.entries(roles).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Подразделение
                  <input
                    name="department"
                    required
                    defaultValue={editing?.department}
                  />
                </label>
              </div>
              <label>
                Должность
                <input name="position" defaultValue={editing?.position} />
              </label>
            </>
          ) : (
            <>
              <label>
                Название
                <input
                  name="name"
                  required
                  defaultValue={editing?.name}
                  maxLength={200}
                />
              </label>
              <label>
                Описание
                <textarea
                  name="description"
                  defaultValue={editing?.description}
                  rows={3}
                />
              </label>
              <label>
                Ответственный по умолчанию
                <select
                  name="default_assignee_id"
                  defaultValue={editing?.default_assignee_id || ""}
                >
                  <option value="">Не назначен</option>
                  {people.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} · {p.department}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-grid">
                <label>
                  Первый ответ, часы
                  <input
                    name="sla_first_response_hours"
                    type="number"
                    required
                    min={1}
                    max={8760}
                    defaultValue={editing?.sla_first_response_hours ?? 48}
                  />
                </label>
                <label>
                  Порядок отображения
                  <input
                    name="sort_order"
                    required
                    type="number"
                    defaultValue={editing?.sort_order ?? 0}
                  />
                </label>
              </div>
            </>
          )}
          <label className="checkbox-label">
            <input
              name="is_active"
              type="checkbox"
              defaultChecked={editing?.is_active ?? true}
            />
            Активен
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <p className="muted">
            {users
              ? "Отключённый пользователь не сможет войти в систему."
              : "Отключённая категория недоступна для новых обращений. Существующая история сохраняется."}
          </p>
          <div className="form-actions">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              Отмена
            </Button>
            <Button loading={busy} disabled={busy}>
              {busy ? "Сохраняем…" : "Сохранить"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
