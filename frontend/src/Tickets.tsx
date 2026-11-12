import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  ArrowUpDown,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  api,
  statuses,
  types,
  priorities,
  errorMessage,
  type Category,
  type Ticket,
  type User,
} from "./lib";
import { AnimatedTabs, Disclosure } from "./components/motion";
import { Button } from "./components/ui/button";
import { Modal } from "./components/ui/dialog";
import { Failure, Loading, TicketTable } from "./components/common";

import { SimilarProblems, JoinedProblems } from "./components/SimilarProblems";
import { SmartHint } from "./components/SmartHint";

export default function Tickets({
  user,
  onNew,
  unassigned = false,
}: {
  user: User;
  onNew: () => void;
  unassigned?: boolean;
}) {
  const [filters, setFilters] = useState<Record<string, string>>(
    user.role === "EMPLOYEE" ? {} : { sort: "affected_count" },
  );
  const [page, setPage] = useState(1);
  const [advanced, setAdvanced] = useState(false);
  const query = useQuery<{ items: Ticket[]; total: number }>({
    queryKey: ["tickets", filters, page, unassigned],
    queryFn: async () =>
      (
        await api.get("/tickets", {
          params: {
            ...filters,
            page,
            page_size: 10,
            ...(unassigned ? { unassigned: true } : {}),
          },
        })
      ).data,
  });
  const cats = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/categories")).data,
  });
  const assignees = useQuery<User[]>({
    queryKey: ["assignees"],
    queryFn: async () => (await api.get("/assignees")).data,
    enabled: user.role !== "EMPLOYEE",
  });
  function filter(k: string, v: string) {
    setFilters((f) => {
      const next = { ...f };
      if (v) next[k] = v;
      else delete next[k];
      return next;
    });
    setPage(1);
  }
  const title = unassigned
    ? "Нераспределённые"
    : user.role === "ADMIN"
      ? "Все обращения"
      : user.role === "MANAGER"
        ? "Инбокс"
        : "Мои обращения";
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ОБРАТНАЯ СВЯЗЬ</span>
          <h1>
            {title}
            <span className="heading-count">{query.data?.total ?? "—"}</span>
          </h1>
          <p>
            {unassigned
              ? "Назначьте ответственного, чтобы ни одно обращение не осталось без внимания."
              : "Каждое обращение — возможность сделать работу лучше."}
          </p>
        </div>
        <Button onClick={onNew}>
          <Plus size={18} />
          Новое обращение
        </Button>
      </div>
      {!unassigned && <JoinedProblems />}
      <div className="panel list-panel">
        <AnimatedTabs value={filters.status || ""} label="Статус обращений">
          <button
            className={!filters.status ? "selected" : ""}
            aria-pressed={!filters.status}
            onClick={() => filter("status", "")}
          >
            Все обращения
          </button>
          <button
            className={filters.status === "NEW" ? "selected" : ""}
            aria-pressed={filters.status === "NEW"}
            onClick={() => filter("status", "NEW")}
          >
            Новые
          </button>
          <button
            className={filters.status === "IN_PROGRESS" ? "selected" : ""}
            aria-pressed={filters.status === "IN_PROGRESS"}
            onClick={() => filter("status", "IN_PROGRESS")}
          >
            В работе
          </button>
          <button
            className={filters.status === "CLOSED" ? "selected" : ""}
            aria-pressed={filters.status === "CLOSED"}
            onClick={() => filter("status", "CLOSED")}
          >
            Закрытые
          </button>
        </AnimatedTabs>
        <div className="filterbar">
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="Поиск обращений"
              placeholder="Найти обращение…"
              value={filters.q || ""}
              onChange={(e) => filter("q", e.target.value)}
            />
          </div>
          <select
            aria-label="Тип обращения"
            value={filters.type || ""}
            onChange={(e) => filter("type", e.target.value)}
          >
            <option value="">Все типы</option>
            {Object.entries(types).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select
            aria-label="Статус"
            value={filters.status || ""}
            onChange={(e) => filter("status", e.target.value)}
          >
            <option value="">Все статусы</option>
            {Object.entries(statuses).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <button
            className={`button button-outline ${advanced ? "filter-active" : ""}`}
            aria-expanded={advanced}
            aria-controls="advanced-filters"
            onClick={() => setAdvanced(!advanced)}
          >
            <SlidersHorizontal size={16} />
            Фильтры
          </button>
        </div>
        <Disclosure open={advanced} id="advanced-filters">
          <div className="advanced-filters">
            <label>
              Категория
              <select
                value={filters.category_id || ""}
                onChange={(e) => filter("category_id", e.target.value)}
              >
                <option value="">Все категории</option>
                {cats.data?.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Приоритет
              <select
                value={filters.priority || ""}
                onChange={(e) => filter("priority", e.target.value)}
              >
                <option value="">Все приоритеты</option>
                {Object.entries(priorities).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Подразделение
              <input
                value={filters.department || ""}
                onChange={(e) => filter("department", e.target.value)}
                placeholder="Название подразделения"
              />
            </label>
            {user.role !== "EMPLOYEE" && (
              <label>
                Ответственный
                <select
                  value={filters.assignee_id || ""}
                  onChange={(e) => filter("assignee_id", e.target.value)}
                >
                  <option value="">Все ответственные</option>
                  {assignees.data?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Срок первого ответа
              <select
                value={filters.overdue || ""}
                onChange={(e) => filter("overdue", e.target.value)}
              >
                <option value="">Любой срок</option>
                <option value="true">Просрочено</option>
                <option value="false">Без просрочки</option>
              </select>
            </label>
            <label>
              <ArrowUpDown size={14} />
              Сортировка
              <select
                value={filters.sort || "created_at"}
                onChange={(e) => filter("sort", e.target.value)}
              >
                <option value="affected_count">По числу столкнувшихся</option>
                <option value="created_at">По дате создания</option>
                <option value="updated_at">По обновлению</option>
                <option value="due_at">По сроку ответа</option>
                <option value="number">По номеру</option>
                <option value="priority">По приоритету</option>
              </select>
            </label>
            <label>
              Порядок
              <select
                value={filters.order || "desc"}
                onChange={(e) => filter("order", e.target.value)}
              >
                <option value="desc">По убыванию</option>
                <option value="asc">По возрастанию</option>
              </select>
            </label>
            <button
              className="text-link"
              onClick={() => {
                setFilters({});
                setPage(1);
              }}
            >
              Сбросить фильтры
              <X size={14} />
            </button>
          </div>
        </Disclosure>
        <div
          className="tab-content"
          key={`${filters.status || "all"}:${page}:${query.status}`}
          aria-busy={query.isFetching}
        >
          {query.isPending ? (
            <Loading />
          ) : query.isError ? (
            <Failure retry={() => query.refetch()} />
          ) : (
            <TicketTable tickets={query.data.items} />
          )}
        </div>
        <div className="pagination">
          <span>Найдено: {query.data?.total ?? 0} обращений</span>
          <div>
            <button
              className="icon-button"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Предыдущая страница"
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              {page} / {Math.max(1, Math.ceil((query.data?.total || 0) / 10))}
            </span>
            <button
              className="icon-button"
              disabled={page * 10 >= (query.data?.total || 0)}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Следующая страница"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const ticketSchema = z.object({
  type: z.enum(["PROBLEM", "PROPOSAL", "PRAISE"]),
  category_id: z.number().min(1, "Выберите категорию"),
  title: z.string().trim().min(3, "Не менее 3 символов").max(250),
  description: z
    .string()
    .trim()
    .min(10, "Опишите обращение подробнее, минимум 10 символов")
    .max(20000),
  proposed_solution: z.string().max(20000),
  is_shared: z.boolean(),
});
type FormValues = z.infer<typeof ticketSchema>;
export function NewTicket({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  // Что сотрудник выбрал сам: это подсказка уже не перезаписывает.
  const [manual, setManual] = useState({ type: false, category: false });
  const cats = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/categories")).data,
    enabled: open,
  });
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      type: "PROPOSAL",
      category_id: 0,
      title: "",
      description: "",
      proposed_solution: "",
      is_shared: false,
    },
  });
  async function submit(values: FormValues) {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await api.post("/tickets", {
        ...values,
        is_shared: values.type === "PROBLEM" && values.is_shared,
      });
      let failed = 0;
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        try {
          await api.post(`/tickets/${data.id}/attachments`, form);
        } catch {
          failed++;
        }
      }
      toast.success(`Обращение ${data.number} зарегистрировано`);
      if (failed)
        toast.error(
          `${failed} вложений не загружено. Добавьте их в карточке обращения.`,
        );
      qc.invalidateQueries();
      reset();
      setFiles([]);
      setManual({ type: false, category: false });
      onClose();
      navigate(`/tickets/${data.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const category = cats.data?.find(
    (c) => c.id === Number(watch("category_id")),
  );
  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title="Новое обращение"
    >
      <p className="muted modal-description">
        Расскажите, что можно улучшить. Мы направим обращение ответственному.
      </p>
      <form onSubmit={handleSubmit(submit)} className="form-stack">
        <label>
          Заголовок
          <input
            {...register("title")}
            placeholder="Коротко сформулируйте суть"
          />
          {errors.title && (
            <small className="form-error">{errors.title.message}</small>
          )}
        </label>
        <label>
          Описание
          <textarea
            {...register("description")}
            rows={4}
            placeholder="Что произошло или что вы предлагаете изменить?"
          />
          {errors.description && (
            <small className="form-error">{errors.description.message}</small>
          )}
        </label>
        <SmartHint
          title={watch("title")}
          description={watch("description")}
          files={files}
          enabled={open && !busy}
          current={{ type: watch("type"), category_id: Number(watch("category_id")) }}
          manual={manual}
          onApply={(h, fields) => {
            if (fields.type) setValue("type", h.type, { shouldValidate: true });
            if (fields.category && h.category_id)
              setValue("category_id", h.category_id, { shouldValidate: true });
          }}
        />
        <div className="form-grid">
          <label>
            Тип обращения
            <select
              {...register("type", {
                onChange: () => setManual((m) => ({ ...m, type: true })),
              })}
            >
              {Object.entries(types).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Категория
            <select
              {...register("category_id", {
                valueAsNumber: true,
                onChange: () => setManual((m) => ({ ...m, category: true })),
              })}
            >
              <option value="0">Выберите категорию</option>
              {cats.data
                ?.filter((c) => c.is_active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            {errors.category_id && (
              <small className="form-error">{errors.category_id.message}</small>
            )}
          </label>
        </div>
        {category && (
          <p className="routing-note">
            {category.default_assignee_id
              ? "Ответственный будет назначен автоматически."
              : "Обращение поступит администратору для назначения ответственного."}{" "}
            Срок первого ответа: {category.sla_first_response_hours} ч.
          </p>
        )}
        {watch("type") === "PROBLEM" && (
          <>
            <SimilarProblems
              text={`${watch("title")} ${watch("description")}`}
              categoryId={Number(watch("category_id"))}
              enabled={open && !busy}
              onBusyChange={setBusy}
              onJoined={() => {
                reset();
                setFiles([]);
                onClose();
                navigate("/tickets");
              }}
            />
            <label className="shared-problem-toggle">
              <input type="checkbox" {...register("is_shared")} />
              <span>
                <strong>Общая проблема — разрешить присоединение</strong>
                <small>
                  Другие сотрудники увидят заголовок, статус и число участников.
                  Не указывайте личные или закрытые сведения в заголовке.
                </small>
              </span>
            </label>
          </>
        )}
        <label>
          Предполагаемое решение <span className="optional">необязательно</span>
          <textarea
            rows={2}
            {...register("proposed_solution")}
            placeholder="Как, на ваш взгляд, можно решить вопрос?"
          />
        </label>
        <label className="file-drop">
          <Paperclip size={20} />
          <span>
            Добавить материалы
            <small>PDF, PNG, JPG, DOCX, XLSX, TXT · до 10 МБ каждый</small>
          </span>
          <input
            aria-label="Прикрепить файлы"
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.docx,.xlsx,.txt"
            onChange={(e) => {
              const selected = Array.from(e.target.files || []);
              if (selected.some((f) => f.size > 10 * 1024 * 1024)) {
                toast.error("Файл превышает 10 МБ");
                return;
              }
              setFiles(selected);
            }}
          />
        </label>
        {files.length > 0 && (
          <p className="muted">{files.map((f) => f.name).join(", ")}</p>
        )}
        <div className="form-actions">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
          >
            Отмена
          </Button>
          <Button loading={busy} disabled={busy}>
            {busy ? "Отправляем…" : "Отправить обращение"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
