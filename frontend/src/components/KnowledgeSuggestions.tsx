import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CheckCheck, ThumbsDown } from "lucide-react";
import { api, datetime, errorMessage } from "../lib";
import type { KnowledgeArticle } from "../knowledge";
import { Button } from "./ui/button";
import "../knowledge.css";

export default function KnowledgeSuggestions({
  text,
  categoryId,
  enabled,
  attemptId,
  onViewed,
}: {
  text: string;
  categoryId: number;
  enabled: boolean;
  attemptId: string;
  onViewed: () => void;
}) {
  const qc = useQueryClient();
  const [debounced, setDebounced] = useState("");
  const [article, setArticle] = useState<KnowledgeArticle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const ready = enabled && text.trim().length >= 8 && debounced === text.trim();
  const query = useQuery<{ items: KnowledgeArticle[] }>({
    queryKey: ["knowledge-suggestions", debounced, categoryId],
    queryFn: async ({ signal }) =>
      (
        await api.post(
          "/knowledge/suggest",
          {
            text: debounced,
            category_id: categoryId || null,
          },
          { signal },
        )
      ).data,
    enabled: ready,
    retry: false,
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text.trim()), 500);
    return () => clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    const clear = () => {
      request.current?.abort();
      setArticle(null);
      setBusy(false);
      setError("");
    };
    window.addEventListener("knowledge-changed", clear);
    return () => window.removeEventListener("knowledge-changed", clear);
  }, []);

  useEffect(() => {
    request.current?.abort();
    setArticle(null);
    setError("");
    setBusy(false);
    return () => request.current?.abort();
  }, [attemptId, enabled]);

  async function openArticle(item: KnowledgeArticle) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setArticle(null);
    try {
      const { data } = await api.post<KnowledgeArticle>(
        `/knowledge/${item.id}/view`,
        {
          attempt_id: attemptId,
          expected_version: item.version,
        },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setArticle(data);
      onViewed();
    } catch (failure) {
      if (controller.signal.aborted) return;
      setError(errorMessage(failure));
      void query.refetch();
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  async function feedback(helped: boolean) {
    if (!article || busy) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post<{ helped: boolean }>(
        `/knowledge/${article.id}/feedback`,
        {
          attempt_id: attemptId,
          expected_version: article.version,
          helped,
        },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setArticle((current) =>
        current ? { ...current, helped: data.helped } : null,
      );
      void qc.invalidateQueries({ queryKey: ["knowledge-metrics"] });
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(errorMessage(failure));
        if (
          axios.isAxiosError(failure) &&
          [404, 409].includes(failure.response?.status ?? 0)
        ) {
          setArticle(null);
          void query.refetch();
        }
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  if (!enabled || text.trim().length < 8) return null;
  const items = ready ? (query.data?.items ?? []) : [];
  return (
    <section
      className="knowledge-suggestions"
      aria-label="Готовые решения"
      aria-busy={busy}
    >
      <h3>
        <BookOpen size={19} aria-hidden="true" /> Возможно, решение уже есть
      </h3>
      <p className="muted">
        Проверьте, подходит ли инструкция к вашему случаю.
      </p>
      {!ready || query.isPending ? (
        <p className="muted" role="status">
          Ищем проверенные инструкции…
        </p>
      ) : query.isError ? (
        <p className="form-error" role="alert">
          Поиск решений временно недоступен. Продолжайте заполнять обращение или{" "}
          <button
            type="button"
            className="text-link"
            onClick={() => query.refetch()}
          >
            повторите поиск
          </button>
          .
        </p>
      ) : items.length ? (
        <div className="knowledge-matches">
          {items.map((item) => (
            <button
              type="button"
              key={item.id}
              disabled={busy}
              className="knowledge-match"
              onClick={() => openArticle(item)}
              aria-expanded={article?.id === item.id}
            >
              <strong>{item.title}</strong>
              <span>{item.summary}</span>
              <small>{item.category_name} · Читать инструкцию</small>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted" role="status">
          Подходящих опубликованных инструкций пока нет.
        </p>
      )}
      {article && (
        <article className="knowledge-reader">
          <h4>{article.title}</h4>
          <p className="knowledge-body">{article.body}</p>
          <small className="muted">
            Обновлено {datetime(article.updated_at)} · {article.audience}
          </small>
          <div
            className="knowledge-feedback"
            role="group"
            aria-label="Помогла ли инструкция"
          >
            <Button
              type="button"
              variant={article.helped === true ? "default" : "outline"}
              disabled={busy}
              aria-pressed={article.helped === true}
              onClick={() => feedback(true)}
            >
              <CheckCheck size={16} /> Решил вопрос по инструкции
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              aria-pressed={article.helped === false}
              onClick={() => feedback(false)}
            >
              <ThumbsDown size={15} /> Не помогло
            </Button>
          </div>
          {article.helped === true && (
            <p className="knowledge-success" role="status">
              Вы подтвердили, что инструкция помогла. Текст формы сохранён — при
              необходимости можно отправить обращение.
            </p>
          )}
          {article.helped === false && (
            <p className="muted" role="status">
              Продолжите описание и отправьте обращение ответственному.
            </p>
          )}
        </article>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
