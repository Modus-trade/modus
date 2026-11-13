import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BookOpen, Sparkles, MessageSquareReply, ClipboardCheck } from "lucide-react";
import { api, errorMessage } from "../lib";

interface Solution {
  summary: string;
  steps: string[];
  based_on: string[];
  reply_draft: string;
  source: "ai" | "knowledge";
  articles?: { id: number; title: string }[];
}

/** Для ответственного: вариант решения текущего обращения. */
export function TicketInsights({
  ticketId,
  final,
  onUseReply,
  onUseResult,
}: {
  ticketId: number;
  final: boolean;
  onUseReply: (text: string) => void;
  onUseResult: (text: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const solve = useMutation({
    mutationFn: async () =>
      (await api.post<Solution>(`/tickets/${ticketId}/solve`)).data,
    onMutate: () => setError(null),
    onError: (e) => setError(errorMessage(e)),
  });
  const s = solve.data;
  if (final) return null;

  return (
    <section className="panel padded insights">
      {!final && (
        <>
          <h3>
            <Sparkles size={16} /> Помощь ИИ
          </h3>
          <p className="muted insights-lead">
            Суть, шаги решения и черновик ответа автору. Если ИИ недоступен — подходящие проверенные инструкции.
          </p>
          <button
            type="button"
            className="insights-solve"
            disabled={solve.isPending}
            onClick={() => solve.mutate()}
          >
            <Sparkles size={15} />
            {solve.isPending
              ? "ИИ думает… до 20 секунд"
              : s
                ? "Предложить ещё раз"
                : "Предложить решение"}
          </button>
          {error ? <p className="muted insights-note">{error}</p> : null}
          {s ? (
            <div className="insights-answer">
              <p>{s.summary}</p>
              {s.source === "knowledge" && s.articles?.length ? (
                <ul className="insights-articles">
                  {s.articles.map((a) => (
                    <li key={a.id}>
                      <Link to={`/knowledge?article=${a.id}`}>
                        <BookOpen size={14} /> {a.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <ol>
                  {s.steps.map((step, n) => (
                    <li key={n}>{step}</li>
                  ))}
                </ol>
              )}
              {s.based_on.length ? (
                <small>С опорой на {s.based_on.join(", ")}</small>
              ) : null}
              <small className="smart-hint-source">
                {s.source === "ai" ? "Предложено ИИ. Проверьте перед отправкой." : "Инструкции проверены и опубликованы в «Инструкциях и ответах»."}
              </small>
              <div className="insights-actions">
                {s.reply_draft ? (
                  <button
                    type="button"
                    onClick={() => onUseReply(s.reply_draft)}
                  >
                    <MessageSquareReply size={14} /> В ответ автору
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    onUseResult(
                      [
                        s.summary,
                        ...s.steps.map((x, n) => `${n + 1}. ${x}`),
                      ].join("\n"),
                    )
                  }
                >
                  <ClipboardCheck size={14} /> В результат
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
