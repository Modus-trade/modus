import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib";
type Item = { Ref_Key: string; Description: string; Code: string; Артикул: string };
export default function OneCItemPicker({value,onChange}:{value:string;onChange:(id:string)=>void}) {
  const [search,setSearch]=useState("");
  const query=useQuery<{value:Item[]}>({queryKey:["onec-items"],queryFn:async()=>(await api.get("/integrations/onec/items")).data});
  const items=query.data?.value || [];
  const selected=items.find(i=>i.Ref_Key===value);
  const visible=items.filter(i=>[i.Description,i.Code,i.Артикул].join(" ").toLowerCase().includes(search.toLowerCase()));
  return <fieldset style={{border:"1px solid #dce5ee",borderRadius:16,padding:18,margin:"16px 0"}}>
    <legend>Позиция 1С · Демо</legend>
    <p className="muted">Необязательно. Укажите товар или материал, с которым связана проблема. Используется демонстрационный каталог.</p>
    <label>Поиск по названию, коду или артикулу<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Например, кабель" /></label>
    <label>Товар или материал<select value={value} onChange={e=>onChange(e.target.value)} disabled={query.isPending || query.isError}>
      <option value="">Без привязки к позиции</option>
      {selected && !visible.includes(selected) && <option value={selected.Ref_Key}>{selected.Description} · {selected.Code}</option>}
      {visible.map(i=><option key={i.Ref_Key} value={i.Ref_Key}>{i.Description} · {i.Code}</option>)}
    </select></label>
    {query.isPending && <small>Загружаем каталог…</small>}
    {query.isError && <p role="alert">Каталог недоступен. Можно отправить обращение без привязки.</p>}
    {!query.isPending && !query.isError && visible.length===0 && <small>Позиции не найдены</small>}
  </fieldset>;
}
