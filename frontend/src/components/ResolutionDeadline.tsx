import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { CalendarClock } from "lucide-react";
import { api, errorMessage, type Ticket, type User } from "../lib";
import {
  deadlineDate,
  deadlineLocalInput,
  formatDeadline,
  parseDeadlineInput,
} from "../deadline";
import { Button } from "./ui/button";
import DateTimePicker from "./DateTimePicker";
import "./ResolutionDeadline.css";

export default function ResolutionDeadline({
  ticket,
  user,
}: {
  ticket: Ticket;
  user: User;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [original, setOriginal] = useState({
    input: "",
    date: null as string | null,
    version: 0,
  });
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const active = [
    "NEW",
    "IN_REVIEW",
    "IN_PROGRESS",
    "AWAITING_CLARIFICATION",
  ].includes(ticket.status);
  const overdue =
    active &&
    !!ticket.resolution_due_at &&
    deadlineDate(ticket.resolution_due_at).getTime() <= clock;
  const needsReason = !!original.date && value !== original.input;

  function startEditing() {
    const input = deadlineLocalInput(ticket.resolution_due_at);
    setOriginal({
      input,
      date: ticket.resolution_due_at ?? null,
      version: ticket.resolution_due_version ?? 0,
    });
    setValue(input);
    setReason("");
    setError("");
    setConflict(false);
    setEditing(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const selected = value ? parseDeadlineInput(value) : null;
    if (
      value !== original.input &&
      value &&
      (!selected || selected.getTime() <= Date.now())
    ) {
      setError("Выберите корректную дату и время в будущем.");
      return;
    }
    if (needsReason && !reason.trim()) {
      setError("Укажите причину изменения срока.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.patch(`/tickets/${ticket.id}/resolution-deadline`, {
        resolution_due_at:
          value === original.input
            ? original.date
            : (selected?.toISOString() ?? null),
        expected_version: original.version,
        reason: reason.trim(),
      });
      setEditing(false);
      await queryClient.invalidateQueries();
    } catch (failure) {
      setError(errorMessage(failure));
      if (axios.isAxiosError(failure) && failure.response?.status === 409) {
        setConflict(true);
        await queryClient.invalidateQueries({
          queryKey: ["ticket", String(ticket.id)],
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="panel padded resolution-deadline"
      aria-labelledby={`deadline-${ticket.id}`}
    >
      <h3 id={`deadline-${ticket.id}`}>
        <CalendarClock size={18} aria-hidden="true" />
        Срок решения
      </h3>
      <p
        className={
          overdue
            ? "resolution-deadline-date is-overdue"
            : "resolution-deadline-date"
        }
      >
        {ticket.resolution_due_at
          ? formatDeadline(ticket.resolution_due_at)
          : "Не назначен"}
      </p>
      {overdue && (
        <span className="badge status-REJECTED">Решение просрочено</span>
      )}
      {(user.role !== "EMPLOYEE" || ticket.assignee_id === user.id) &&
        active &&
        (editing ? (
          <form className="form-stack" onSubmit={save}>
            <div className="form-stack deadline-date-field">
              <label htmlFor={`deadline-input-${ticket.id}`}>
                Плановая дата и время
              </label>
              <DateTimePicker
                id={`deadline-input-${ticket.id}`}
                value={value}
                onChange={setValue}
                disabled={busy}
                describedBy={`deadline-zone-${ticket.id}`}
              />
            </div>
            <small id={`deadline-zone-${ticket.id}`} className="muted">
              Время вашего устройства ·{" "}
              {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </small>
            {original.date && (
              <label>
                Причина изменения
                {needsReason && <span className="required"> *</span>}
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  required={needsReason}
                  maxLength={2000}
                  rows={3}
                  disabled={busy}
                  placeholder="Почему меняется срок решения"
                />
              </label>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {conflict && (
              <Button
                type="button"
                variant="outline"
                onClick={startEditing}
                disabled={busy}
              >
                Загрузить актуальный срок
              </Button>
            )}
            <div className="resolution-deadline-actions">
              <Button loading={busy} disabled={busy || conflict}>
                Сохранить срок
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(false)}
                disabled={busy}
              >
                Отмена
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="full"
            onClick={startEditing}
          >
            {ticket.resolution_due_at ? "Изменить срок" : "Назначить срок"}
          </Button>
        ))}
    </section>
  );
}
