/**
 * When the player last had each planet or moon on screen (any game page with that body active).
 * The age badges of the planet menu count from here, as OGLight's timers do: a sync or the
 * accountInfo read at login refreshes the numbers of every body at once, but does not count as
 * having looked at a body. Read from the page the player opened: no network call.
 */
export const VISITED_KEY = 'bodies.visitedAt';

export type Visits = Record<string, number>;

/** `visits` with `bodyId` seen at `now` (a new object; older times never overwrite newer ones). */
export function markVisited(visits: Visits, bodyId: number, now: number): Visits {
  const key = String(bodyId);
  return (visits[key] ?? 0) >= now ? visits : { ...visits, [key]: now };
}
