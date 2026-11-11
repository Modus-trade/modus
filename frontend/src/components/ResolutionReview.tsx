import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { CheckCheck, RotateCcw } from "lucide-react";
import { api, datetime, errorMessage, type Ticket, type User } from "../lib";
import { Button } from "./ui/button";
import "./ResolutionReview.css";

export default function ResolutionReview({
  ticket,
  user,
}: {
  ticket: Ticket;
  user: User;
}) {
  const queryClient = useQueryClient();
  const explanationId = useId();
  const version = ticket.resolution_review_version ?? 0;
  const [viewedVersion, setViewedVersion] = useState(version);
  const [returning, setReturning] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [busy, setBusy] = useState<"confirm" | "rework" | null>(null);
  const [error, setError] = useState("");
  const isAuthor = ticket.author_id === user.id;
  const changed = viewedVersion !== version;
  const review = ticket.resolution_reviews?.find(
    (item) => item.version === version,
  );

  async function submit(decision: "confirm" | "rework") {
    if (busy || changed) return;
    if (decision === "rework" && !explanation.trim()) {
      setError("Поясните, что осталось нерешённым и что нужно доработать.");
      return;
    }
    setBusy(decision);
    setError("");
    try {
      await api.post(`/tickets/${ticket.id}/resolution-review`, {
        decision,
        expected_version: viewedVersion,
        explanation: decision === "rework" ? explanation.trim() : "",
      });
      setReturning(false);
      setExplanation("");
      await queryClient.invalidateQueries();
    } catch (failure) {
      setError(errorMessage(failure));
      if (axios.isAxiosError(failure) && failure.response?.status === 409) {
        await queryClient.invalidateQueries({
          queryKey: ["ticket", String(ticket.id)],
        });
      }
    } finally {
      setBusy(null);
    }
  }

  if (ticket.status === "CLOSED" && ticket.resolution_confirmed_at) {
    return (
      <section
        className="panel padded resolution-review is-confirmed"
        aria-label="Результат подтверждён"
        role="status"
      >
        <h3>
          <CheckCheck size={20} aria-hidden="true" />
          Решение подтверждено автором
        </h3>
        <p>Обращение закрыто {datetime(ticket.resolution_confirmed_at)}.</p>
      </section>
    );
  }

  if (ticket.status !== "IMPLEMENTED") {
    if (
      !review ||
      review.decision !== "rework" ||
      ["REJECTED", "CLOSED"].includes(ticket.status)
    )
      return null;
    return (
      <section
        className="panel padded resolution-review is-returned"
        aria-label="Возврат на доработку"
      >
        <h3>
          <RotateCcw size={19} aria-hidden="true" />
          Автор вернул результат на доработку
        </h3>
        <p className="resolution-review-explanation">{review.explanation}</p>
        <p className="muted">
          {ticket.resolution_due_at
            ? "Срок решения сохранён. Изменение срока оформляется отдельно с указанием причины."
            : "Срок решения пока не назначен."}
        </p>
      </section>
    );
  }

  return (
    <section
      className="panel padded resolution-review"
      aria-labelledby={`review-${ticket.id}`}
    >
      <h3 id={`review-${ticket.id}`}>
        <CheckCheck size={20} aria-hidden="true" />
        Проверка результата
      </h3>
      <p>
        {isAuthor
          ? "Проверьте опубликованный результат. Подтверждение закроет обращение."
          : "Результат опубликован. Ожидается подтверждение автора обращения."}
      </p>
      {isAuthor && (
        <>
          {changed && (
            <div className="resolution-review-update" role="alert">
              <p>
                Результат обновлён. Ознакомьтесь с новой версией в карточке
                перед проверкой.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={!!busy}
                onClick={() => {
                  setViewedVersion(version);
                  setError("");
                }}
              >
                Проверить новую версию
              </Button>
            </div>
          )}
          {!ticket.resolution?.trim() && (
            <p className="muted">
              Описание результата ещё не заполнено. Вы можете вернуть обращение
              на доработку.
            </p>
          )}
          <div className="resolution-review-actions">
            <Button
              type="button"
              loading={busy === "confirm"}
              disabled={!!busy || changed || !ticket.resolution?.trim()}
              onClick={() => submit("confirm")}
            >
              <CheckCheck size={17} />
              Решено
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!!busy || changed}
              onClick={() => {
                setReturning(true);
                setError("");
              }}
            >
              <RotateCcw size={16} />
              Нужна доработка
            </Button>
          </div>
          {returning && (
            <form
              className="form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                void submit("rework");
              }}
            >
              <label htmlFor={explanationId}>
                Что нужно доработать <span className="required">*</span>
              </label>
              <textarea
                id={explanationId}
                value={explanation}
                onChange={(event) => setExplanation(event.target.value)}
                required
                maxLength={10000}
                rows={4}
                autoFocus
                disabled={!!busy || changed}
                placeholder="Опишите, что осталось нерешённым"
              />
              <div className="resolution-review-actions">
                <Button
                  loading={busy === "rework"}
                  disabled={!!busy || changed || !explanation.trim()}
                >
                  Вернуть в работу
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!!busy}
                  onClick={() => setReturning(false)}
                >
                  Отмена
                </Button>
              </div>
            </form>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
