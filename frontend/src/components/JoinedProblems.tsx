import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { api } from "../lib";
import { Badge } from "./common";

interface ProblemSummary {
  id: number;
  number: string;
  title: string;
  status: string;
  affected_count: number;
  joined: boolean;
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
        Общие проблемы, к которым вы присоединились: откройте, чтобы увидеть стадию и результат.
      </p>
      <div className="joined-problem-list">
        {query.data.items.map((item) => (
          <Link key={item.id} to={`/tickets/${item.id}`} className="joined-problem">
            <span className="ticket-number">{item.number}</span>
            <strong>{item.title}</strong>
            <Badge status={item.status} />
            <span className="affected-count">
              <Users size={14} />
              {item.affected_count}
            </span>
          </Link>
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
