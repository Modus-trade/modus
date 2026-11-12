import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Send, MessageCircle, Power } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "../lib";
import { Button } from "./ui/button";
interface BotInfo {
  enabled: boolean;
  external_id: number | null;
  health: string;
  checked_at?: string;
  events: {
    event_id: number;
    state: string;
    error?: string;
    created_at: string;
  }[];
}
interface Person {
  external_id: number;
  name: string;
  kind: string;
  active?: boolean;
}
export default function BitrixBotPanel({
  mode,
  people,
}: {
  mode: string;
  people: Person[];
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [person, setPerson] = useState("");
  const [messages, setMessages] = useState<{ text: string; bot: boolean }[]>(
    [],
  );
  const path = "/integrations/bitrix/bot";
  const q = useQuery<BotInfo>({
    queryKey: ["bitrix-bot", mode],
    queryFn: async () => (await api.get(path)).data,
    refetchInterval: 10000,
    enabled: mode !== "off",
  });
  async function toggle() {
    setBusy(true);
    try {
      if (!q.data?.external_id) await api.post(path + "/register");
      else await api.put(path, { enabled: !q.data.enabled });
      await qc.invalidateQueries({ queryKey: ["bitrix-bot"] });
      toast.success("Настройка бота сохранена");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function simulate(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !person) return;
    setBusy(true);
    try {
      const r = await api.post(path + "/mock-message", {
        external_user_id: Number(person),
        text,
      });
      setMessages((v) => [
        ...v,
        { text, bot: false },
        { text: r.data.reply, bot: true },
      ]);
      setText("");
      await qc.invalidateQueries({ queryKey: ["tickets"] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel padded bitrix-bot-panel">
      <div className="integration-section-head">
        <div>
          <div className="bitrix-task-heading">
            <Bot size={25} />
            <h2>Обращение — прямо из чата</h2>
          </div>
          <p className="muted">
            Бот «Модус · Обращения» помогает описать проблему, выбрать категорию
            и найти похожие обращения.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={busy || mode === "off" || q.isPending || q.isError}
          onClick={toggle}
        >
          <Power size={16} />
          {!q.data?.external_id
            ? "Подключить бота"
            : q.data.enabled
              ? "Приостановить"
              : "Включить бота"}
        </Button>
      </div>
      {mode === "off" ? (
        <p>Сначала включите реальный или МОК-режим интеграции.</p>
      ) : q.isError ? (
        <p role="alert">
          Не удалось загрузить состояние бота.{" "}
          <button onClick={() => q.refetch()}>Повторить</button>
        </p>
      ) : (
        <>
          {q.data?.checked_at && <small className="muted">Последняя проверка: {new Date(q.data.checked_at + "Z").toLocaleString("ru-RU")}</small>}
          <div className="bot-flow">
            <span>01 · Описание и файлы</span>
            <span>02 · Категория и похожие</span>
            <span>03 · Подтверждение</span>
          </div>
          <p>
            <span
              className={`exchange-state ${q.data?.enabled ? "sent" : "skipped"}`}
            >
              {q.data?.enabled ? "Включён" : "Выключен"}
            </span>{" "}
            {q.data?.health}
          </p>
          {q.data?.external_id && (
            <p className="muted">
              ID бота: {q.data.external_id}. В Битрикс24 откройте мессенджер,
              найдите «Модус · Обращения» и напишите «начать» в личном чате. Бот
              отвечает, пока сервер Модуса запущен.
            </p>
          )}
          <details>
            <summary>Команды и правила</summary>
            <p className="muted">
              Опишите проблему → подтвердите предложенную категорию словом «да»
              или выберите её ID → напишите «отправить». Для общей проблемы:
              «присоединиться A-номер» → «подтвердить». «Изменить» переписывает
              описание, «отмена» удаляет черновик, «новое» начинает следующее
              обращение. Файлы: до 5, до 10 МБ каждый. Бот работает только в
              личной переписке и только для активных сотрудников,
              синхронизированных с Модусом.
            </p>
          </details>
          {mode === "mock" && q.data?.enabled && (
            <div className="bot-simulator">
              <h3>
                <MessageCircle size={18} /> МОК: проверить диалог
              </h3>
              <p className="muted">
                Отправка ниже создаёт настоящее локальное обращение после
                команды «отправить». В Битрикс ничего не передаётся.
              </p>
              <select
                aria-label="Сотрудник для проверки бота"
                value={person}
                onChange={(e) => {
                  setPerson(e.target.value);
                  setMessages([]);
                }}
              >
                <option value="">Выберите демо-сотрудника</option>
                {people
                  .filter((p) => p.kind === "employee" && p.active)
                  .map((p) => (
                    <option key={p.external_id} value={p.external_id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <div className="bot-messages" aria-live="polite">
                {messages.map((m, i) => (
                  <div
                    className={m.bot ? "bot-message" : "bot-message human"}
                    key={i}
                  >
                    <strong>{m.bot ? "Модус" : "Сотрудник"}</strong>
                    <p>{m.text}</p>
                  </div>
                ))}
              </div>
              <form onSubmit={simulate}>
                <input
                  aria-label="Сообщение боту"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Например: начать"
                  maxLength={20000}
                />
                <Button
                  disabled={busy || !text.trim() || !person}
                  aria-label="Отправить боту"
                >
                  <Send size={16} />
                </Button>
              </form>
            </div>
          )}
          {!!q.data?.events.length && (
            <details>
              <summary>Последние события бота</summary>
              <div className="bot-event-list">
                {q.data.events.map((e) => (
                  <p key={e.event_id}>
                    #{e.event_id} ·{" "}
                    {(
                      {
                        sent: "Ответ отправлен",
                        pending: "Ожидает ответа",
                        error: "Ошибка отправки",
                        uncertain: "Доставка не подтверждена",
                        ignored: "Служебное событие",
                        skipped: "Пропущено",
                      } as Record<string, string>
                    )[e.state] || e.state}
                    {e.error ? ` · ${e.error}` : ""}
                  </p>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}
