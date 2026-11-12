import { useState, type KeyboardEvent } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  X,
} from "lucide-react";
import { calendarDays, localDateKey, parseDeadlineInput } from "../deadline";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
import "./DateTimePicker.css";

const months = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];
const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const dayLabel = (date: Date) =>
  date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function DateTimePicker({
  id,
  value,
  onChange,
  disabled,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState("");
  const [month, setMonth] = useState(() => new Date());
  const [hours, setHours] = useState("18");
  const [minutes, setMinutes] = useState("00");
  const current = parseDeadlineInput(value);
  const today = new Date();
  const todayKey = localDateKey(today);
  const days = calendarDays(month.getFullYear(), month.getMonth());
  const years = [
    ...new Set([
      ...Array.from({ length: 11 }, (_, index) => today.getFullYear() + index),
      month.getFullYear() - 1,
      month.getFullYear(),
      month.getFullYear() + 1,
    ]),
  ]
    .filter((year) => year >= today.getFullYear())
    .sort((left, right) => left - right);
  const validTime =
    /^\d{1,2}$/.test(hours) &&
    /^\d{1,2}$/.test(minutes) &&
    Number(hours) < 24 &&
    Number(minutes) < 60;
  const selectedValue = validTime
    ? `${day}T${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`
    : "";
  const selected = parseDeadlineInput(selectedValue);
  const future = !!selected && selected.getTime() > Date.now();
  const focusDay = days.some((date) => localDateKey(date) === day)
    ? day
    : localDateKey(
        days.find(
          (date) =>
            localDateKey(date) >= todayKey &&
            date.getMonth() === month.getMonth(),
        ) ?? days[0],
      );
  const previousMonthAvailable =
    month.getFullYear() * 12 + month.getMonth() >
    today.getFullYear() * 12 + today.getMonth();

  function start() {
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    const initial =
      current && current.getTime() > Date.now() ? current : nextHour;
    setDay(localDateKey(initial));
    setMonth(new Date(initial.getFullYear(), initial.getMonth(), 1, 12));
    setHours(String(initial.getHours()).padStart(2, "0"));
    setMinutes(String(initial.getMinutes()).padStart(2, "0"));
    setOpen(true);
  }

  function choose(date: Date) {
    setDay(localDateKey(date));
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12));
  }

  function moveDay(event: KeyboardEvent<HTMLButtonElement>, date: Date) {
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -((date.getDay() + 6) % 7),
      End: 6 - ((date.getDay() + 6) % 7),
    };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    const next = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + offsets[event.key],
      12,
    );
    if (localDateKey(next) < todayKey) return;
    choose(next);
    requestAnimationFrame(() =>
      document.getElementById(`${id}-${localDateKey(next)}`)?.focus(),
    );
  }

  function moveTime(
    event: KeyboardEvent<HTMLInputElement>,
    currentValue: string,
    maximum: number,
    update: (value: string) => void,
  ) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const step = event.key === "ArrowUp" ? 1 : -1;
    update(
      String((Number(currentValue || 0) + step + maximum) % maximum).padStart(
        2,
        "0",
      ),
    );
  }

  return (
    <>
      <div className="date-time-field">
        <button
          id={id}
          type="button"
          className={`date-time-trigger${current ? " has-value" : ""}`}
          disabled={disabled}
          onClick={start}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-describedby={describedBy}
        >
          <CalendarDays size={19} aria-hidden="true" />
          <span>
            {current ? (
              <>
                <strong>{dayLabel(current)}</strong>
                <small>
                  В {String(current.getHours()).padStart(2, "0")}:
                  {String(current.getMinutes()).padStart(2, "0")}
                </small>
              </>
            ) : (
              <span>Выбрать дату и время</span>
            )}
          </span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        {value && (
          <button
            type="button"
            className="date-time-clear"
            disabled={disabled}
            onClick={() => onChange("")}
            aria-label="Убрать дату и время"
            title="Убрать дату и время"
          >
            <X size={15} />
          </button>
        )}
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Дата и время решения"
        className="date-time-dialog"
      >
        <div className="date-time-layout">
          <div className="date-time-date-pane">
            <div
              className="date-time-shortcuts"
              role="group"
              aria-label="Быстрый выбор даты"
            >
              {[
                { label: "Сегодня", offset: 0 },
                { label: "Завтра", offset: 1 },
                { label: "Через неделю", offset: 7 },
              ].map(({ label, offset }) => {
                const date = new Date(
                  today.getFullYear(),
                  today.getMonth(),
                  today.getDate() + offset,
                  12,
                );
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={day === localDateKey(date)}
                    onClick={() => choose(date)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="date-time-calendar-head">
              <Button
                type="button"
                variant="ghost"
                aria-label="Предыдущий месяц"
                disabled={!previousMonthAvailable}
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() - 1, 1, 12),
                  )
                }
              >
                <ChevronLeft size={19} />
              </Button>
              <div className="date-time-month-selects">
                <select
                  aria-label="Месяц"
                  value={month.getMonth()}
                  onChange={(event) =>
                    setMonth(
                      new Date(
                        month.getFullYear(),
                        Number(event.target.value),
                        1,
                        12,
                      ),
                    )
                  }
                >
                  {months.map((name, index) => (
                    <option
                      key={name}
                      value={index}
                      disabled={
                        month.getFullYear() === today.getFullYear() &&
                        index < today.getMonth()
                      }
                    >
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Год"
                  value={month.getFullYear()}
                  onChange={(event) => {
                    const year = Number(event.target.value);
                    const nextMonth =
                      year === today.getFullYear()
                        ? Math.max(today.getMonth(), month.getMonth())
                        : month.getMonth();
                    setMonth(new Date(year, nextMonth, 1, 12));
                  }}
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="ghost"
                aria-label="Следующий месяц"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() + 1, 1, 12),
                  )
                }
              >
                <ChevronRight size={19} />
              </Button>
            </div>
            <div
              className="date-time-calendar"
              role="group"
              aria-label="Календарь"
            >
              {weekdays.map((name) => (
                <span
                  className="date-time-weekday"
                  key={name}
                  aria-hidden="true"
                >
                  {name}
                </span>
              ))}
              {days.map((date) => {
                const key = localDateKey(date);
                return (
                  <button
                    id={`${id}-${key}`}
                    type="button"
                    key={key}
                    className={[
                      date.getMonth() !== month.getMonth()
                        ? "is-other-month"
                        : "",
                      key === todayKey ? "is-today" : "",
                      key === day ? "is-selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-label={date.toLocaleDateString("ru-RU", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    aria-pressed={key === day}
                    aria-current={key === todayKey ? "date" : undefined}
                    disabled={key < todayKey}
                    tabIndex={key === focusDay ? 0 : -1}
                    onClick={() => choose(date)}
                    onKeyDown={(event) => moveDay(event, date)}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="date-time-time-pane">
            <div className="date-time-clock">
              <div className="date-time-clock-label">
                <Clock3 size={18} />
                <span>Время</span>
              </div>
              <div className="date-time-segments">
                <label>
                  <input
                    aria-label="Часы"
                    inputMode="numeric"
                    value={hours}
                    maxLength={2}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) =>
                      setHours(
                        event.target.value.replace(/\D/g, "").slice(0, 2),
                      )
                    }
                    onBlur={() => setHours(hours.padStart(2, "0"))}
                    onKeyDown={(event) => moveTime(event, hours, 24, setHours)}
                  />
                  <span>часы</span>
                </label>
                <span aria-hidden="true">:</span>
                <label>
                  <input
                    aria-label="Минуты"
                    inputMode="numeric"
                    value={minutes}
                    maxLength={2}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) =>
                      setMinutes(
                        event.target.value.replace(/\D/g, "").slice(0, 2),
                      )
                    }
                    onBlur={() => setMinutes(minutes.padStart(2, "0"))}
                    onKeyDown={(event) =>
                      moveTime(event, minutes, 60, setMinutes)
                    }
                  />
                  <span>минуты</span>
                </label>
              </div>
            </div>
            <div
              className="date-time-time-shortcuts"
              role="group"
              aria-label="Быстрый выбор времени"
            >
              {["09:00", "12:00", "18:00"].map((time) => (
                <button
                  type="button"
                  key={time}
                  aria-pressed={
                    `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}` ===
                    time
                  }
                  onClick={() => {
                    const [hour, minute] = time.split(":");
                    setHours(hour);
                    setMinutes(minute);
                  }}
                >
                  {time}
                </button>
              ))}
            </div>
            <div className="date-time-summary" role="status">
              {selected ? (
                <>
                  <strong>
                    {dayLabel(selected)} · {hours.padStart(2, "0")}:
                    {minutes.padStart(2, "0")}
                  </strong>
                  <small>
                    Время устройства ·{" "}
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </small>
                </>
              ) : (
                <span>Введите часы от 00 до 23 и минуты от 00 до 59.</span>
              )}
              {selected && !future && (
                <span className="form-error">
                  Выберите дату и время в будущем.
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="date-time-actions">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button
            type="button"
            disabled={!future}
            onClick={() => {
              onChange(selectedValue);
              setOpen(false);
            }}
          >
            Выбрать
          </Button>
        </div>
      </Modal>
    </>
  );
}
