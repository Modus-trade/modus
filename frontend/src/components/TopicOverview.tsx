import "./TopicOverview.css";
import { useState } from "react";
import { ChevronDown, Layers3, Search, X } from "lucide-react";

const percent = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
const number = new Intl.NumberFormat("ru-RU");

export default function TopicOverview({
  categories,
}: {
  categories: Record<string, number>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("count");
  const ranked = Object.entries(categories)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"));
  const total = ranked.reduce((sum, [, count]) => sum + count, 0);
  const max = ranked[0]?.[1] || 1;
  const leaders = ranked.filter(([, count]) => count === max);
  const filtered = ranked.filter(([name]) =>
    name.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru")),
  );
  if (sort === "name") filtered.sort((a, b) => a[0].localeCompare(b[0], "ru"));
  const visible = expanded || query.trim() ? filtered : filtered.slice(0, 6);
  const topThreeShare = total
    ? (ranked.slice(0, 3).reduce((sum, [, count]) => sum + count, 0) / total) *
      100
    : 0;
  const topThemeDescription = [
    "",
    "обращений по самой частой теме",
    "обращений по двум самым частым темам",
    "обращений по трём самым частым темам",
  ][Math.min(ranked.length, 3)];

  return (
    <section className="panel topic-overview" aria-labelledby="topics-title">
      <div className="topic-heading">
        <div>
          <h3 id="topics-title">Что волнует команду</h3>
          <p>Распределение обращений по категориям</p>
        </div>
        <span className="topic-total">
          Всего обращений <strong>{number.format(total)}</strong>
        </span>
      </div>

      {total > 0 ? (
        <div className="topic-layout">
          <aside className="topic-insight">
            <div className="topic-insight-primary">
              <span className="topic-insight-label">В фокусе команды</span>
              <div className="topic-insight-value">
                {percent.format(topThreeShare)}
                <span>%</span>
              </div>
              <p>{topThemeDescription}</p>
            </div>
            <div className="topic-insight-secondary">
              <span className="topic-insight-label">
                {leaders.length > 1 ? "Самые частые темы" : "Самая частая тема"}
              </span>
              {leaders.slice(0, 2).map(([name]) => (
                <strong className="topic-leader" key={name}>
                  {name}
                </strong>
              ))}
              {leaders.length > 2 && (
                <span className="topic-tie">
                  Ещё {leaders.length - 2} с таким же количеством
                </span>
              )}
            </div>
            <div className="topic-insight-foot">
              <span>Тем с обращениями</span>
              <strong>{number.format(ranked.length)}</strong>
            </div>
          </aside>

          <div className="topic-ranking">
            <div className="topic-controls">
              <div className="topic-search">
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Найти тему обращения"
                  placeholder="Найти тему…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Очистить поиск тем"
                    onClick={() => setQuery("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <select
                className="topic-sort"
                aria-label="Сортировка тем"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="count">По количеству</option>
                <option value="name">По алфавиту</option>
              </select>
            </div>
            <div className="topic-columns" aria-hidden="true">
              <span>Тема обращения</span>
              <span>Кол-во</span>
              <span>Доля</span>
            </div>
            <ol
              id="topic-ranking-list"
              className="topic-list"
              aria-label="Темы обращений"
            >
              {visible.map(([name, count]) => (
                <li
                  className={`topic-row ${count === max ? "topic-row-leading" : ""}`}
                  key={name}
                >
                  <div className="topic-row-main">
                    <span className="topic-name">{name}</span>
                    <div className="topic-track" aria-hidden="true">
                      <span style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                  </div>
                  <div className="topic-row-value">
                    <strong
                      aria-label={`Количество обращений: ${number.format(count)}`}
                    >
                      {number.format(count)}
                    </strong>
                    <span
                      aria-label={`Доля обращений: ${percent.format((count / total) * 100)}%`}
                    >
                      {percent.format((count / total) * 100)}%
                    </span>
                  </div>
                </li>
              ))}
            </ol>
            {visible.length === 0 && (
              <div className="topic-no-results">
                Темы не найдены. Попробуйте другое название.
              </div>
            )}
            <div className="topic-footer">
              <span role="status">
                Показано {visible.length} из {filtered.length}
              </span>
              {!query.trim() && filtered.length > 6 && (
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls="topic-ranking-list"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded
                    ? "Свернуть список"
                    : `Все темы · ${filtered.length}`}
                  <ChevronDown
                    size={16}
                    className={expanded ? "topic-chevron-up" : ""}
                  />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="topic-no-results">
          <Layers3 size={28} />
          <strong>Темы появятся вместе с обращениями</strong>
          <span>
            Здесь будет видно, какие вопросы команда поднимает чаще всего.
          </span>
        </div>
      )}
    </section>
  );
}
