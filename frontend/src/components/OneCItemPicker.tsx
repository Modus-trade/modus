import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, errorMessage } from "../lib";
import "../onec.css";
export type OneCSelection = {
  item: string;
  document: string;
  kind: "purchase" | "sale";
  scope: string;
};
export const emptyOneC: OneCSelection = {
  item: "",
  document: "",
  kind: "purchase",
  scope: "",
};
type Row = {
  Ref_Key: string;
  Description: string;
  Code?: string;
  Артикул?: string;
  Number?: string;
  Date?: string;
  partner?: { Description: string };
};
type Result = { mode: string; scope: string; total: number; value: Row[] };
function Search({
  kind,
  value,
  onChange,
}: {
  kind: string;
  value: string;
  onChange: (id: string, scope: string) => void;
}) {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQ(text), 250);
    return () => clearTimeout(timer);
  }, [text]);
  const query = useQuery<Result>({
    queryKey: ["onec-search", kind, q],
    queryFn: async () =>
      (
        await api.get(
          "/integrations/onec/" + (kind === "items" ? "items" : "documents"),
          { params: { q, kind: kind === "items" ? undefined : kind } },
        )
      ).data,
    retry: false,
  });
  const [selected, setSelected] = useState<Row | null>(null);
  const rows = query.data?.value || [];
  const options =
    selected &&
    value === selected.Ref_Key &&
    !rows.some((r) => r.Ref_Key === value)
      ? [selected, ...rows]
      : rows;
  const label = (r: Row) =>
    kind === "items"
      ? `${r.Description} · ${r.Code}`
      : `${r.Number} · ${r.Date?.slice(0, 10)} · ${r.partner?.Description || "Контрагент не указан"}`;
  return (
    <div className="onec-search">
      <label>
        {kind === "items"
          ? "Поиск товара или материала"
          : "Поиск заказа по номеру или контрагенту"}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            kind === "items"
              ? "Название, код, артикул"
              : "Номер заказа или название компании"
          }
        />
      </label>
      <label>
        {kind === "items" ? "Позиция номенклатуры" : "Документ"}
        <select
          value={value}
          onChange={(e) => {
            setSelected(rows.find((r) => r.Ref_Key === e.target.value) || null);
            onChange(e.target.value, query.data?.scope || "");
          }}
          disabled={query.isPending || query.isError}
        >
          <option value="">Не связывать</option>
          {options.map((r) => (
            <option key={r.Ref_Key} value={r.Ref_Key}>
              {label(r)}
            </option>
          ))}
        </select>
      </label>
      {value && (
        <button
          type="button"
          className="text-link"
          onClick={() => onChange("", query.data?.scope || "")}
        >
          Убрать привязку
        </button>
      )}
      {query.isPending && <small>Загружаем каталог…</small>}
      {query.isError && (
        <p role="alert">
          {errorMessage(query.error)}. Можно продолжить без привязки.
        </p>
      )}
      {query.data && (
        <small>
          {query.data.mode === "mock"
            ? "Демонстрационные данные"
            : query.data.mode === "off"
              ? "Обмен 1С выключен"
              : "Данные из 1С"}{" "}
          · Найдено: {query.data.total}
          {query.data.total > 100
            ? ". Уточните поиск, показаны первые 100"
            : ""}
        </small>
      )}
    </div>
  );
}
export default function OneCItemPicker({
  value,
  onChange,
}: {
  value: OneCSelection;
  onChange: (value: OneCSelection) => void;
}) {
  function choose(key: "item" | "document", id: string, scope: string) {
    onChange({
      ...value,
      ...(value.scope && value.scope !== scope
        ? { item: "", document: "" }
        : {}),
      [key]: id,
      scope,
    });
  }
  return (
    <fieldset className="onec-picker">
      <legend>Связать с 1С · необязательно</legend>
      <p className="muted">
        Укажите конкретный материал или заказ, чтобы ответственному было проще
        разобраться.
      </p>
      <Search
        kind="items"
        value={value.item}
        onChange={(id, scope) => choose("item", id, scope)}
      />
      <details>
        <summary>Привязать документ</summary>
        <label>
          Тип документа
          <select
            value={value.kind}
            onChange={(e) =>
              onChange({
                ...value,
                kind: e.target.value as OneCSelection["kind"],
                document: "",
              })
            }
          >
            <option value="purchase">Заказ поставщику</option>
            <option value="sale">Заказ клиента</option>
          </select>
        </label>
        <Search
          key={value.kind}
          kind={value.kind}
          value={value.document}
          onChange={(id, scope) => choose("document", id, scope)}
        />
        <p className="muted">
          Обращения с документами 1С доступны автору и сотрудникам, которые
          занимаются их обработкой. Снимок документа сохраняется на момент
          отправки.
        </p>
      </details>
    </fieldset>
  );
}
