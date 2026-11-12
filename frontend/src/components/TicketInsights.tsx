import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Layers, Sparkles, MessageSquareReply, ClipboardCheck } from "lucide-react";
import { api, errorMessage, statuses } from "../lib";

interface SimilarItem {
  id: number;
  number: string;
  title: string;
  status: string;
  category: string;
  resolution: string | null;
  score: number;
}

interface Solution {
  summary: string;
  steps: string[];
  based_on: string[];
  reply_draft: string;
  source: "ai" | "rules";
}

/** Для ответственного: похожие обращения и вариант решения от ИИ. */
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
  const similar = useQuery({
    queryKey: ["similar", ticketId],
    queryFn: async () => (await api.get<{ items: SimilarItem[]; ai_enabled: boolean }>(`/tickets/${ticketId}/similar`)).data,
    staleTime: 60_000,
  });
  const [error, setError] = useState<string | null>(null);
  const solve = useMutation({
    mutationFn: async () => (await api.post<Solution>(`/tickets/${ticketId}/solve`)).data,
    onMutate: () => setError(null),
    onError: (e) => setError(errorMessage(e)),
  });
  const items = similar.data?.items ?? [];
  const s = solve.data;

  return (
    <section className="panel padded insights">
      <h3>
        <Layers size={16} /> Похожие обращения
      </h3>
      {similar.isLoading ? (
        <p className="muted">Ищем похожие…</p>
      ) : items.length ? (
        <ul className="insights-similar">
          {items.map((i) => (
            <li key={i.id}>
              <Link to={`/tickets/${i.id}`}>
                <span className="insights-number">{i.number}</span>
                <span className="insights-title">{i.title}</span>
                <span className={`badge status-${i.status}`}>{statuses[i.status]}</span>
              </Link>
              {i.resolution ? <p className="insights-resolution">{i.resolution}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Похожих обращений не нашлось.</p>
      )}

      {!final && (
        <>
          <button type="button" className="insights-solve" disabled={solve.isPending} onClick={() => solve.mutate()}>
            <Sparkles size={15} />
            {solve.isPending ? "ИИ думает… до 20 секунд" : s ? "Предложить ещё раз" : "Предложить решение"}
          </button>
          {error ? <p className="muted insights-note">{error}</p> : null}
          {s ? (
            <div className="insights-answer">
              <p>{s.summary}</p>
              <ol>
                {s.steps.map((step, n) => (
                  <li key={n}>{step}</li>
                ))}
              </ol>
              {s.based_on.length ? <small>С опорой на {s.based_on.join(", ")}</small> : null}
              <small className="smart-hint-source">
                {s.source === "ai" ? "Предложено ИИ — проверьте перед отправкой" : "ИИ недоступен — показаны решения похожих"}
              </small>
              <div className="insights-actions">
                {s.reply_draft ? (
                  <button type="button" onClick={() => onUseReply(s.reply_draft)}>
                    <MessageSquareReply size={14} /> В ответ автору
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onUseResult([s.summary, ...s.steps.map((x, n) => `${n + 1}. ${x}`)].join("\n"))}
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
