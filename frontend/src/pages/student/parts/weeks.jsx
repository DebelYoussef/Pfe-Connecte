// ISO-8601 week helpers ("2026-W46" = Monday 9 to Sunday 15 November 2026).

export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function weekNumber(week) {
  return Number(String(week).split("-W")[1]);
}

// Monday of an ISO week, as a local date.
export function weekStart(week) {
  const [year, number] = String(week).split("-W").map(Number);
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  return new Date(year, 0, 4 - jan4Day + 1 + (number - 1) * 7);
}

export function weekEnd(week) {
  const start = weekStart(week);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
}

const monthShort = (date) => date.toLocaleDateString("fr-FR", { month: "short" });

// "9 – 15 nov. 2026", "28 sept. – 4 oct. 2026", "29 déc. 2025 – 4 janv. 2026"
export function formatWeekRange(week) {
  const start = weekStart(week);
  const end = weekEnd(week);
  if (start.getFullYear() !== end.getFullYear())
    return `${start.getDate()} ${monthShort(start)} ${start.getFullYear()} – ${end.getDate()} ${monthShort(end)} ${end.getFullYear()}`;
  if (start.getMonth() !== end.getMonth())
    return `${start.getDate()} ${monthShort(start)} – ${end.getDate()} ${monthShort(end)} ${end.getFullYear()}`;
  return `${start.getDate()} – ${end.getDate()} ${monthShort(end)} ${end.getFullYear()}`;
}

// Every ISO week from the one containing `from` to the one containing `to`, newest first.
export function weeksBetween(from, to) {
  const first = isoWeek(from);
  const last = isoWeek(to);
  const weeks = [];
  let cursor = weekStart(last);
  while (weeks.length < 104) {
    const week = isoWeek(cursor);
    weeks.push(week);
    if (week === first || cursor < from) break;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 7);
  }
  return weeks;
}
