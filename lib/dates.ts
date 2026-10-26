/**
 * Работа с учебными датами ("YYYY-MM-DD") без сдвигов часовых поясов.
 *
 * `new Date("2026-01-15")` — это полночь UTC, из-за чего в зонах западнее UTC
 * дата показывалась предыдущим днём, а дедлайн уезжал на сутки. Здесь дата
 * трактуется как локальная (полдень), а сравнение — по концу локального дня.
 */

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseYmd(value: string): Date {
  const trimmed = (value || "").trim();
  const match = YMD_RE.exec(trimmed);

  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    // Полдень защищает от переходов на летнее/зимнее время.
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Некорректная дата");
  }
  return parsed;
}

export function formatYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Конец локального дня — момент, после которого сдача запрещена. */
export function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export function isOverdue(targetDate: Date, now = new Date()): boolean {
  return endOfDay(targetDate).getTime() < now.getTime();
}
