export function deadlineDate(value: string): Date {
  return new Date(/[zZ]$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`);
}

export function formatDeadline(value: string): string {
  return deadlineDate(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function deadlineLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = deadlineDate(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
