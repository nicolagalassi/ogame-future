/**
 * Starting over in this universe: Future's settings back to their defaults, or its statistics emptied.
 * Only the universe and player in use; targets, notes, positions, plans and what is read from the game
 * stay. The same split as a carry-over (engines/carry-over): what is a choice, what is a statistic.
 *
 * COMPLIANCE (AGENTS.md §1.9): local data only, no network.
 */
import { CARRY_COPY, MARKS_VIEW } from './carry-over';
import { JOURNAL_KEY } from './expeditions';
import { PROFILES_KEY, SETTINGS_KEY } from './fleet';
import { HISTORY_KEY } from './history';
import { ARCHIVE_KEY, MULT_KEY } from './orion';

export type ResetKind = 'settings' | 'stats';

/** Every choice made in Future's windows, the planets' and moons' rules and PTRE's team key included. */
export const RESET_SETTINGS = [...CARRY_COPY, MARKS_VIEW, SETTINGS_KEY, PROFILES_KEY, 'ptre.teamKey'];
/** The expedition and raid journal, the account's history and Orion's statistics. */
export const RESET_STATS = [JOURNAL_KEY, HISTORY_KEY, ARCHIVE_KEY, MULT_KEY];

/** The stored keys (`held`, full names) that a reset of `namespace` forgets. */
export function resetKeys(held: string[], namespace: string, kind: ResetKind): string[] {
  const names = new Set((kind === 'settings' ? RESET_SETTINGS : RESET_STATS).map((k) => `${namespace}:${k}`));
  return held.filter((k) => names.has(k));
}
