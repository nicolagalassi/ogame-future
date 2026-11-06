/**
 * Account history: one entry per day, built from figures Future already has (the points the
 * overview page shows, the stored snapshot). Pure functions: no DOM, no network.
 */
export interface HistoryDay {
  /** Local calendar day, "YYYY-MM-DD". */
  day: string;
  at: number;
  points: number;
  rank: number | null;
  /** Production per day in MSU (0 = unknown). */
  prodDay: number;
  /** Fleet value in MSU (0 = unknown). */
  fleet: number;
}

export type History = HistoryDay[];

export const HISTORY_KEY = 'account.history';
/** Two years of days. */
export const HISTORY_MAX = 730;

export const dayKey = (at: number): string => {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Adds today's figures. A later reading on the same day replaces the earlier one. Days stay sorted. */
export function recordDay(history: History, entry: Omit<HistoryDay, 'day'>): History {
  const day = dayKey(entry.at);
  const prev = history.find((d) => d.day === day);
  // Keep a known figure when the new reading lacks it (e.g. no snapshot yet on this page).
  const next: HistoryDay = { ...entry, day, prodDay: entry.prodDay || prev?.prodDay || 0, fleet: entry.fleet || prev?.fleet || 0 };
  const out = history.filter((d) => d.day !== day).concat(next).sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  return out.slice(-HISTORY_MAX);
}

export interface HistoryChange {
  days: number;
  points: number;
  /** Positive = climbed (smaller rank number). */
  rank: number | null;
  /** Points per day over the span. */
  perDay: number;
}

/** Change between the newest day and the newest day at least `days` before it (or the oldest). */
export function changeOver(history: History, days: number): HistoryChange | null {
  const last = history.at(-1);
  if (!last || history.length < 2) return null;
  const limit = last.at - days * 86_400_000;
  const base = [...history].reverse().find((d) => d.at <= limit + 3_600_000) ?? history[0]!;
  if (base === last) return null;
  const span = Math.max(1, Math.round((last.at - base.at) / 86_400_000));
  return {
    days: span,
    points: last.points - base.points,
    rank: last.rank !== null && base.rank !== null ? base.rank - last.rank : null,
    perDay: (last.points - base.points) / span,
  };
}
