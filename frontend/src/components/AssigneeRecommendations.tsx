import { useQuery } from "@tanstack/react-query";
import { Check, Sparkles } from "lucide-react";
import { api, type Category, type User } from "../lib";

export function AssigneeRecommendations({ people, categoryId, selected, onSelect, disabled }: {
  people: User[]; categoryId: number; selected: string;
  onSelect: (id: string) => void; disabled: boolean;
}) {
  const categories = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/categories")).data,
  });
  if (categories.isPending) return <p className="recommendation-note">Подбираем исполнителей…</p>;
  if (categories.isError) return <p className="recommendation-note">Рекомендации недоступны. Выберите ответственного из списка выше.</p>;
  const owner = categories.data?.find((c) => c.id === categoryId)?.default_assignee_id;
  const candidates = people.filter((p) => p.is_active && ["ADMIN", "MANAGER"].includes(p.role)).map((person) => {
    // Stable illustrative metrics, deliberately not presented as employee analytics.
    const seed = (person.id * 31 + categoryId * 17) >>> 0;
    const experience = person.id === owner ? 95 : 52 + seed % 36;
    const success = 78 + seed % 20;
    const load = 1 + seed % 8;
    const score = Math.round(experience * .5 + success * .3 + (100 - load * 10) * .2);
    return { person, experience, success, load, score };
  }).sort((a, b) => b.score - a.score || a.person.id - b.person.id).slice(0, 3);
  return <section className="assignee-recommendations" aria-label="Демонстрационный рейтинг исполнителей">
    <div className="recommendation-heading"><Sparkles size={17} /><strong>Кому поручить?</strong><span>ДЕМО</span></div>
    <p className="recommendation-note">Топ кандидатов для этой категории. Баллы, опыт, успешность и нагрузка — примерные данные, а не оценка сотрудников.</p>
    <div className="recommendation-list">
      {candidates.map(({ person, experience, success, load, score }, index) => <button
        type="button" key={person.id} disabled={disabled}
        className={`recommendation-person ${selected === String(person.id) ? "is-selected" : ""}`}
        aria-pressed={selected === String(person.id)}
        onClick={() => onSelect(String(person.id))}
      >
        <span className="recommendation-person-top"><span className="recommendation-rank">{String(index + 1).padStart(2, "0")}</span><span className="recommendation-identity"><strong>{person.full_name}</strong><small>{person.department}</small></span><span className="recommendation-score">{score}<small>/ 100</small></span></span>
        <span className="recommendation-meter" aria-hidden="true"><i style={{ width: `${score}%` }} /></span>
        <span className="recommendation-metrics"><span>Опыт <b>{experience}/100</b></span><span>Успех <b>{success}%</b></span><span>В работе <b>{load}</b></span></span>
        <span className="recommendation-select">{selected === String(person.id) ? <><Check size={14} />Выбран</> : "Выбрать исполнителя"}</span>
      </button>)}
    </div>
    {!candidates.length && <p className="recommendation-note">Нет доступных исполнителей.</p>}
    <details className="recommendation-explanation"><summary>Как считается рейтинг</summary><p>50% — опыт в категории, 30% — успешность решений, 20% — свободная загрузка. Метрики смоделированы для демонстрации; профильному ответственному категории задан повышенный опыт. Балл не является вероятностью успеха.</p></details>
    <p className="recommendation-note">Назначение вступит в силу после нажатия «Сохранить изменения».</p>
  </section>;
}
