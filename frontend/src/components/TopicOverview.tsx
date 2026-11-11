import { useState } from "react";
import { ArrowDownWideNarrow, ChevronDown, Layers3, Search, X } from "lucide-react";

const percent = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
const number = new Intl.NumberFormat("ru-RU");

export default function TopicOverview({ categories }: { categories: Record<string, number> }) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("count");
  const ranked = Object.entries(categories).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"));
  const total = ranked.reduce((sum, [, count]) => sum + count, 0);
  const max = ranked[0]?.[1] || 1;
  const leaders = ranked.filter(([, count]) => count === max);
  const filtered = ranked.filter(([name]) => name.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru")));
  if (sort === "name") filtered.sort((a, b) => a[0].localeCompare(b[0], "ru"));
  const visible = expanded || query.trim() ? filtered : filtered.slice(0, 6);
  const topThreeShare = total ? ranked.slice(0, 3).reduce((sum, [, count]) => sum + count, 0) / total * 100 : 0;

  return (
    <section className="panel topic-overview" aria-labelledby="topics-title">
      <div className="topic-heading">
        <div>
          <span className="topic-eyebrow"><Layers3 size={14} /> АНАЛИТИКА ПО ТЕМАМ</span>
          <h3 id="topics-title">Что волнует команду</h3>
          <p>Самые частые темы — первыми. Количество и доля видны сразу.</p>
        </div>
        <span className="topic-total"><strong>{number.format(total)}</strong> обращений</span>
      </div>

      {total > 0 ? (
        <div className="topic-layout">
          <aside className="topic-insight">
            <span className="topic-insight-label">В ФОКУСЕ КОМАНДЫ</span>
            <div className="topic-insight-value">{percent.format(topThreeShare)}<span>%</span></div>
            <p>обращений приходятся на три самые частые темы</p>
            <div className="topic-insight-divider" />
            <span className="topic-insight-label">{leaders.length > 1 ? "САМЫЕ ЧАСТЫЕ ТЕМЫ" : "САМАЯ ЧАСТАЯ ТЕМА"}</span>
            <strong className="topic-leader">{leaders[0]?.[0]}</strong>
            {leaders.length > 1 && <span className="topic-tie">Ещё {leaders.length - 1} с таким же количеством</span>}
            <div className="topic-insight-foot"><span>{ranked.length} тем</span><span>Все обращения</span></div>
          </aside>

          <div className="topic-ranking">
            <div className="topic-controls">
              <div className="topic-search">
                <Search size={16} aria-hidden="true" />
                <input aria-label="Найти тему обращения" placeholder="Найти тему" value={query} onChange={e => setQuery(e.target.value)} />
                {query && <button type="button" aria-label="Очистить поиск тем" onClick={() => setQuery("")}><X size={14} /></button>}
              </div>
              <label className="topic-sort"><ArrowDownWideNarrow size={16} aria-hidden="true" /><select aria-label="Сортировка тем" value={sort} onChange={e => setSort(e.target.value)}><option value="count">По количеству</option><option value="name">По алфавиту</option></select></label>
            </div>
            <div className="topic-columns" aria-hidden="true"><span>Тема обращения</span><span>Кол-во / доля</span></div>
            <ol id="topic-ranking-list" className="topic-list" aria-label="Темы обращений">
              {visible.map(([name, count]) => (
                <li className={`topic-row ${count === max ? "topic-row-leading" : ""}`} key={name}>
                  <span className="topic-rank" aria-hidden="true">{String(ranked.findIndex(([key]) => key === name) + 1).padStart(2, "0")}</span>
                  <div className="topic-row-main"><span className="topic-name">{name}</span><div className="topic-track" aria-hidden="true"><span style={{ width: `${count / max * 100}%` }} /></div></div>
                  <div className="topic-row-value"><strong>{number.format(count)}</strong><span>{percent.format(count / total * 100)}%</span></div>
                </li>
              ))}
            </ol>
            {visible.length === 0 && <div className="topic-no-results">Темы не найдены. Попробуйте другое название.</div>}
            <div className="topic-footer">
              <span role="status">Показано {visible.length} из {filtered.length} тем</span>
              {!query.trim() && filtered.length > 6 && <button type="button" aria-expanded={expanded} aria-controls="topic-ranking-list" onClick={() => setExpanded(!expanded)}>{expanded ? "Свернуть список" : `Все темы · ${filtered.length}`}<ChevronDown size={16} className={expanded ? "topic-chevron-up" : ""} /></button>}
            </div>
          </div>
        </div>
      ) : <div className="topic-no-results"><Layers3 size={28} /><strong>Темы появятся вместе с обращениями</strong><span>Здесь будет видно, какие вопросы команда поднимает чаще всего.</span></div>}
    </section>
  );
}
