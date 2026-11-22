/** Normalize a wall-clock time in the story without converting time zones. */
export function readStoryDateTime(value: unknown): string | undefined {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 19) : undefined;
  }
  if (typeof value !== "string") return undefined;
  const parts =
    /^(?<day>\d{4}-\d{2}-\d{2})(?:[T ](?<time>\d{2}:\d{2})(?::(?<seconds>\d{2}))?)?$/u.exec(
      value.trim(),
    )?.groups;
  if (!parts) return undefined;
  const normalized = `${parts.day}T${parts.time ?? "00:00"}:${parts.seconds ?? "00"}`;
  const date = new Date(`${normalized}Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19) === normalized
    ? normalized
    : undefined;
}

const weekdayFormat = new Intl.DateTimeFormat("en", { weekday: "long", timeZone: "UTC" });

export function storyWeekday(start: string | undefined): string | undefined {
  return start ? weekdayFormat.format(new Date(`${start}Z`)) : undefined;
}

export function formatStoryRange(
  start: string | undefined,
  finish: string | undefined,
): string | undefined {
  if (!start) return undefined;
  const label = start.replace("T", " ").replace(/:00$/u, "");
  if (!finish) return label;
  const end = finish.startsWith(start.slice(0, 10)) ? finish.slice(11) : finish.replace("T", " ");
  return `${label} – ${end.replace(/:00$/u, "")}`;
}
