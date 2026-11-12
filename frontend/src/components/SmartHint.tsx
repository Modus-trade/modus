import { useEffect, useRef, useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { api, types } from "../lib";

export interface Suggestion {
  type: "PROBLEM" | "PROPOSAL" | "PRAISE";
  category_id: number | null;
  category: string | null;
  assignee_name: string | null;
  sla_hours: number | null;
  confidence: number;
  reason: string;
  source: "ai" | "rules";
}

const IMAGE = /\.(jpe?g|png)$/i;

/** Первое фото (до 4 МБ) — в base64 без префикса, чтобы ИИ учёл и картинку. */
async function firstImage(files: File[]) {
  const file = files.find((f) => IMAGE.test(f.name) && f.size <= 4 * 1024 * 1024);
  if (!file) return null;
  return new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/**
 * Подсказка типа и категории по тексту обращения.
 * Пока сотрудник сам не выбрал тип или категорию, они подставляются автоматически;
 * после ручного выбора подсказка только предлагает «Применить».
 */
export function SmartHint({
  title,
  description,
  files,
  enabled,
  current,
  manual,
  onApply,
}: {
  title: string;
  description: string;
  files: File[];
  enabled: boolean;
  current: { type: string; category_id: number };
  manual: { type: boolean; category: boolean };
  onApply: (s: Suggestion, fields: { type: boolean; category: boolean }) => void;
}) {
  const [hint, setHint] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const manualRef = useRef(manual);
  manualRef.current = manual;
  const applyRef = useRef(onApply);
  applyRef.current = onApply;
  const imageKey = files.map((f) => f.name + f.size).join("|");

  useEffect(() => {
    const id = ++seq.current;
    if (!enabled || title.trim().length + description.trim().length < 20) {
      setHint(null);
      setLoading(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.post<Suggestion>("/assist/suggest", {
          title,
          description,
          image_base64: await firstImage(files),
        });
        if (id !== seq.current) return;
        setHint(data);
        // Автоматически заполняем только то, что сотрудник ещё не выбрал сам.
        applyRef.current(data, {
          type: !manualRef.current.type,
          category: !manualRef.current.category && !!data.category_id,
        });
      } catch {
        // Подсказка необязательна: без неё форма работает как обычно.
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, imageKey, enabled]);

  if (!hint && !loading)
    return (
      <div className="smart-hint is-idle">
        <Sparkles size={17} className="smart-hint-icon" />
        <div className="smart-hint-body">
          <span>Напишите заголовок и описание — ИИ сам подберёт тип и категорию и покажет, кто ответит.</span>
        </div>
      </div>
    );
  const differs =
    hint &&
    ((hint.category_id && hint.category_id !== current.category_id) || hint.type !== current.type);

  return (
    <div className={`smart-hint ${loading ? "is-loading" : ""}`} aria-live="polite">
      <Sparkles size={17} className="smart-hint-icon" />
      {hint ? (
        <div className="smart-hint-body">
          <strong>
            {types[hint.type]}
            {hint.category ? ` · ${hint.category}` : ""}
          </strong>
          <span>
            {hint.assignee_name ? `Получит ${hint.assignee_name}` : "Ответственного назначит администратор"}
            {hint.sla_hours ? `, ответ до ${hint.sla_hours} ч` : ""}
          </span>
          {hint.reason ? <small>«{hint.reason}»</small> : null}
          {!hint.category_id ? <small>Категорию не удалось определить — выберите ниже</small> : null}
          <small className="smart-hint-source">
            {hint.source === "ai" ? "Подобрано ИИ" : "Подобрано автоматически по словам"} · можно поменять ниже
          </small>
        </div>
      ) : (
        <div className="smart-hint-body">
          <span>Подбираем тип и категорию…</span>
        </div>
      )}
      {hint && differs ? (
        <button
          type="button"
          className="smart-hint-apply"
          onClick={() => onApply(hint, { type: true, category: !!hint.category_id })}
        >
          <Wand2 size={14} /> Применить
        </button>
      ) : null}
    </div>
  );
}
