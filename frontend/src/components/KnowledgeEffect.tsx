import { useQuery } from "@tanstack/react-query";
import { api } from "../lib";
import type { KnowledgeMetrics } from "../knowledge";
import { Failure, Loading } from "./common";
import "../knowledge.css";

export default function KnowledgeEffect() {
  const query = useQuery<KnowledgeMetrics>({
    queryKey: ["knowledge-metrics"],
    queryFn: async ({ signal }) =>
      (await api.get("/knowledge/metrics", { signal })).data,
    refetchInterval: 60000,
  });
  return (
    <section className="panel padded knowledge-effect">
      <h3>Помощь до отправки обращения</h3>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <Failure retry={() => query.refetch()} />
      ) : (
        <>
          <p className="muted">
            {query.data.scope === "company"
              ? "По компании"
              : "По вашему подразделению"}{" "}
            · попытки с просмотром инструкции за {query.data.days} дней
          </p>
          <div className="knowledge-effect-value">
            <strong>{query.data.resolved_attempts}</strong>
            <span>
              из {query.data.viewed_attempts} подтверждены как решённые по
              инструкции
            </span>
          </div>
          <div className="knowledge-effect-details">
            <span>
              Создали обращение <b>{query.data.submitted_attempts}</b>
            </span>
            <span>
              Присоединились к проблеме <b>{query.data.joined_attempts}</b>
            </span>
            <span>
              Исход пока неизвестен <b>{query.data.pending_attempts}</b>
            </span>
          </div>
          <p className="muted">
            Учитывается ответ «Решил вопрос по инструкции» в форме нового
            обращения. Повторные просмотры в одной попытке считаются один раз.
            Отправка обращения или присоединение к проблеме в этой попытке
            меняет её результат.
          </p>
        </>
      )}
    </section>
  );
}
