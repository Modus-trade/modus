import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Layers, Check } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "../lib";
import { Badge } from "./common";

interface ProblemSummary {
  id: number;
  number: string;
  title: string;
  status: string;
  affected_count: number;
  joined: boolean;
}

export function SimilarProblems({
  text,
  categoryId,
  enabled,
  onJoined,
  onBusyChange,
}: {
  text: string;
  categoryId: number;
  enabled: boolean;
  onJoined: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [debounced, setDebounced] = useState("");
  const [joining, setJoining] = useState<number | null>(null);
  const qc = useQueryClient();
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text.trim()), 450);
    return () => clearTimeout(timer);
  }, [text]);
  const ready = enabled && debounced.length >= 8 && debounced === text.trim();
  const query = useQuery<{ items: ProblemSummary[] }>({
    queryKey: ["similar-problems", debounced, categoryId],
    queryFn: async ({ signal }) =>
      (
        await api.post(
          "/problems/similar",
          { text: debounced, category_id: categoryId || null },
          { signal },
        )
      ).data,
    enabled: ready,
  });
  async function join(id: number) {
    setJoining(id);
    onBusyChange(true);
    try {
      await api.post(`/problems/${id}/join`);
      await qc.invalidateQueries();
      toast.success(
        "Вы присоединились к проблеме. Новое обращение не создано.",
      );
      onJoined();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setJoining(null);
      onBusyChange(false);
    }
  }
  if (!enabled || text.trim().length < 8) return null;
  return (
    <section
      className="similar-problems"
      aria-label="Похожие проблемы"
      aria-live="polite"
    >
      <div className="similar-heading">
        <Layers size={18} />
        <strong>Возможно, вы не одни</strong>
      </div>
      <p>
        Присоединитесь к общей проблеме — руководитель увидит её масштаб. Текст
        формы и файлы при присоединении не отправляются.
      </p>
      {!ready || query.isPending ? (
        <p className="similar-feedback">Ищем похожие проблемы…</p>
      ) : query.isError ? (
        <p className="similar-feedback">
          Не удалось проверить совпадения. Вы можете создать обращение или{" "}
          <button
            type="button"
            className="text-link"
            onClick={() => query.refetch()}
          >
            повторить поиск
          </button>
          .
        </p>
      ) : query.data?.items.length ? (
        <div className="similar-list">
          {query.data.items.map((item) => (
            <article key={item.id} className="similar-item">
              <span className="eyebrow">{item.number}</span>
              <h4>{item.title}</h4>
              <div className="similar-item-footer">
                <Badge status={item.status} />
                <span className="affected-count">
                  <Users size={14} />
                  Столкнулись: {item.affected_count}
                </span>
              </div>
              <button
                type="button"
                className="button button-outline full"
                disabled={joining !== null}
                onClick={() => join(item.id)}
              >
                {item.joined ? (
                  <>
                    <Check size={15} />
                    Уже участвуете · к списку
                  </>
                ) : joining === item.id ? (
                  "Присоединяем…"
                ) : (
                  "Я тоже столкнулся · присоединиться"
                )}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="similar-feedback">
          Похожих общих проблем не найдено. Создайте новое обращение ниже.
        </p>
      )}
      <small>
        Совпадения ищутся по словам заголовка. Вы сами решаете, одна ли это
        проблема.
      </small>
    </section>
  );
}

export function JoinedProblems() {
  const [page, setPage] = useState(1);
  const query = useQuery<{ items: ProblemSummary[]; total: number }>({
    queryKey: ["joined-problems", page],
    queryFn: async () =>
      (await api.get("/problems/joined", { params: { page } })).data,
  });
  if (query.isPending) return null;
  if (query.isError)
    return (
      <p className="similar-feedback">
        Не удалось загрузить проблемы с вашим участием.{" "}
        <button className="text-link" onClick={() => query.refetch()}>
          Повторить
        </button>
      </p>
    );
  if (!query.data.total) return null;
  return (
    <section id="joined-problems" className="panel joined-problems">
      <div className="similar-heading">
        <Users size={19} />
        <h3>
          Я тоже столкнулся <span>{query.data.total}</span>
        </h3>
      </div>
      <p>
        Статусы общих проблем, к которым вы присоединились. Переписка и
        материалы доступны автору и ответственным по обычным правилам.
      </p>
      <div className="joined-problem-list">
        {query.data.items.map((item) => (
          <article key={item.id}>
            <span className="ticket-number">{item.number}</span>
            <strong>{item.title}</strong>
            <Badge status={item.status} />
            <span className="affected-count">
              <Users size={14} />
              {item.affected_count}
            </span>
          </article>
        ))}
      </div>
      {query.data.total > 20 && (
        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Назад
          </button>
          <span>
            {page} / {Math.ceil(query.data.total / 20)}
          </span>
          <button
            disabled={page * 20 >= query.data.total}
            onClick={() => setPage(page + 1)}
          >
            Далее
          </button>
        </div>
      )}
    </section>
  );
}
