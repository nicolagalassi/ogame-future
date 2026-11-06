/**
 * Manual reminders: the player picks one event (a construction ending, a fleet arriving) and
 * Future shows a message on the page when it is due. Pure functions: no DOM, no network.
 * Times are on the server clock, like the game's own end and arrival times.
 */
export interface Reminder {
  /** Stable per event, e.g. "q:33870616:building:Metal Mine:31" or "f:123456". */
  id: string;
  label: string;
  /** Due time, ms since epoch, server clock. */
  at: number;
  fired?: boolean;
}

export const REMINDERS_KEY = 'reminders';
const KEEP_AFTER = 24 * 3_600_000;
export const REMINDERS_MAX = 50;

export const hasReminder = (list: Reminder[], id: string) => list.some((r) => r.id === id);

/** Adds or removes a reminder (sorted by due time). */
export function toggleReminder(list: Reminder[], r: Reminder): Reminder[] {
  if (hasReminder(list, r.id)) return list.filter((x) => x.id !== r.id);
  return [...list, r].sort((a, b) => a.at - b.at).slice(0, REMINDERS_MAX);
}

/** Due and not shown yet. */
export const dueReminders = (list: Reminder[], now: number) => list.filter((r) => !r.fired && r.at <= now);

/** The next one still to come, or null. */
export function nextReminder(list: Reminder[], now: number): Reminder | null {
  return list.filter((r) => !r.fired && r.at > now).sort((a, b) => a.at - b.at)[0] ?? null;
}

/** Marks reminders as shown and forgets those shown more than a day ago. */
export function markFired(list: Reminder[], ids: string[], now: number): Reminder[] {
  return list.map((r) => (ids.includes(r.id) ? { ...r, fired: true } : r)).filter((r) => !r.fired || now - r.at < KEEP_AFTER);
}
