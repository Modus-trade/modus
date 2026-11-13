import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "../lib";
import { Button } from "./ui/button";
import OneCAnalytics from "./OneCAnalytics";
import "../onec.css";
type Status = {
  mode: string;
  health: string;
  synced_at: string | null;
  configured: boolean;
  counts: Record<string, number>;
  jobs: {
    id: number;
    mode: string;
    operation: string;
    state: string;
    message: string;
    created_at: string;
  }[];
};
const date = (v: string | null) =>
  v
    ? new Date(v.endsWith("Z") ? v : v + "Z").toLocaleString("ru-RU")
    : "Ещё не обновлялся";
export default function OneCPanel() {
  const qc = useQueryClient(),
    [busy, setBusy] = useState(false);
  const q = useQuery<Status>({
    queryKey: ["onec-admin"],
    queryFn: async () => (await api.get("/integrations/onec")).data,
  });
  async function run(path: string, mode?: string) {
    setBusy(true);
    try {
      await api.request({
        url: "/integrations/onec" + path,
        method: mode ? "PUT" : "POST",
        data: mode ? { mode } : undefined,
      });
      toast.success(mode ? "Режим сохранён" : "Готово");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      await qc.invalidateQueries({ queryKey: ["onec-admin"] });
      await qc.invalidateQueries({ queryKey: ["onec-search"] });
    }
  }
  return (
    <div className="onec-section">
      <section className="panel padded">
        <div className="onec-heading">
          <div>
            <span className="eyebrow">ДАННЫЕ ДЛЯ РЕШЕНИЙ</span>
            <h1>
              <Database /> Связь с 1С
            </h1>
            <p className="muted">
              Товары, заказы и контрагенты в контексте обращений.
            </p>
          </div>
          <span className="onec-readonly">
            <ShieldCheck size={18} /> Только чтение
          </span>
        </div>
        {q.isPending && <p>Загрузка…</p>}
        {q.isError && (
          <p role="alert">
            {errorMessage(q.error)}{" "}
            <button onClick={() => q.refetch()}>Повторить</button>
          </p>
        )}
        {q.data && (
          <>
            <div className="onec-controls">
              <label>
                Режим
                <select
                  value={q.data.mode}
                  disabled={busy}
                  onChange={(e) => run("/mode", e.target.value)}
                >
                  <option value="off">Выключено</option>
                  <option value="mock">МОК · демонстрационные данные</option>
                  <option value="real">Реальная база 1С</option>
                </select>
              </label>
              <Button
                variant="outline"
                disabled={busy || q.data.mode === "off"}
                onClick={() => run("/check")}
              >
                Проверить подключение
              </Button>
              <Button
                disabled={busy || q.data.mode === "off"}
                onClick={() => run("/sync")}
              >
                <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
                {busy ? "Выполняется…" : "Обновить каталог"}
              </Button>
            </div>
            <p role="status">{q.data.health}</p>
            <small className="muted">
              Последний импорт: {date(q.data.synced_at)}. Обновление запускается
              вручную.
            </small>
            <div className="onec-stats">
              {[
                ["items", "Товаров и материалов"],
                ["purchase", "Заказов поставщикам"],
                ["sale", "Заказов клиентов"],
              ].map(([k, label]) => (
                <div key={k}>
                  <strong>{q.data!.counts[k] || 0}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            {q.data.mode === "mock" && (
              <p className="onec-notice">
                Демонстрационный каталог. Созданные обращения сохраняются в
                Модусе с пометкой «Демо».
              </p>
            )}
            {!q.data.configured && (
              <details>
                <summary>Как подключить настоящую 1С</summary>
                <p>
                  Администратор 1С публикует OData и выдаёт учётную запись с
                  правами чтения нужных коллекций. Адрес и пароль настраиваются
                  на сервере Модуса. После этого выберите «Реальная база» и
                  проверьте подключение. Состав полей зависит от конфигурации
                  1С.
                </p>
              </details>
            )}
            <details className="onec-log">
              <summary>Журнал обменов · {q.data.jobs.length}</summary>
              {!q.data.jobs.length && <p>Обмены ещё не выполнялись.</p>}
              {q.data.jobs.map((j) => (
                <div key={j.id}>
                  <span
                    className={
                      j.state === "error" ? "onec-error" : "onec-success"
                    }
                  >
                    {j.state === "error" ? "Ошибка" : "Готово"}
                  </span>
                  <span>
                    {j.message}
                    <small>
                      {j.mode === "mock"
                        ? "Демо"
                        : j.mode === "real"
                          ? "1С"
                          : "Выключено"}{" "}
                      · {date(j.created_at)}
                    </small>
                  </span>
                </div>
              ))}
            </details>
          </>
        )}
      </section>
      <OneCAnalytics />
    </div>
  );
}
