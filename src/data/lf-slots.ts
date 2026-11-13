/**
 * Lifeform technologies actually active on each planet.
 *
 * Buildings follow the planet's own species (`selectedSpeciesId`). Research does not: each
 * of the 18 slots can hold the technology of any species the player has discovered, so
 * lifeforms mix. accountInfo keeps the levels of every technology ever researched in a slot
 * (swapping keeps the old levels), so it cannot tell which one is in use. The game's
 * lifeform research page lists exactly the active one per slot: Future remembers it for
 * each planet the player opens it on. Until then the slot shows a guess (highest level).
 * Pure DOM reads and arithmetic: no network call.
 */
import type { OwnBody } from './account-info';
import { lfBuildings, SPECIES, speciesOf, type Species } from './tech-names';
import type { TechListEntry } from './tech-details';

export const LF_SLOTS_KEY = 'lf.slots';
/** Planet id → active lifeform research ids, as last seen on the game's research page. */
export type LfSlots = Record<string, number[]>;

const isLfResearch = (id: number): boolean => speciesOf(id) !== null && Math.floor((id % 1000) / 100) === 2;
const slotOf = (id: number): number => id % 100;

/** On the lifeform research page: the ids it shows (one per slot), else null. */
export function readLfSlots(doc: Document, list: TechListEntry[]): number[] | null {
  const component = new URL(doc.location?.href ?? 'http://x/').searchParams.get('component');
  if (component !== 'lfresearch') return null;
  const ids = list.map((e) => e.id).filter(isLfResearch);
  return ids.length ? ids.sort((a, b) => slotOf(a) - slotOf(b)) : null;
}

/** Stores the slots seen for `bodyId`; returns true when something changed. */
export function rememberLfSlots(slots: LfSlots, bodyId: number, ids: number[]): boolean {
  const key = String(bodyId);
  if (slots[key]?.join() === ids.join()) return false;
  slots[key] = ids;
  return true;
}

export interface ActiveTech {
  id: number;
  level: number;
  /** True when the page was never seen on this planet and the id is a guess. */
  guessed: boolean;
}

const lvl = (b: OwnBody, id: number): number => b.levels[String(id)] ?? 0;

/** The 12 buildings of the planet's species (none without a species). */
export function activeLfBuildings(body: OwnBody): ActiveTech[] {
  const s = body.species as Species;
  if (!SPECIES.includes(s)) return [];
  return lfBuildings(s).map((id) => ({ id, level: lvl(body, id), guessed: false }));
}

/** One entry per research slot in use (1–18), from the page seen or, failing that, a guess. */
export function activeLfResearch(body: OwnBody, seen?: number[]): ActiveTech[] {
  const out: ActiveTech[] = [];
  for (let slot = 1; slot <= 18; slot++) {
    const known = seen?.find((id) => slotOf(id) === slot);
    if (known) {
      out.push({ id: known, level: lvl(body, known), guessed: false });
      continue;
    }
    // Guess: the highest level in the slot; on a tie, the planet's own species if it is one of them.
    let best: ActiveTech | null = null;
    for (const s of SPECIES) {
      const id = 10000 + s * 1000 + 200 + slot;
      const level = lvl(body, id);
      if (level <= 0) continue;
      if (!best || level > best.level || (level === best.level && s === body.species)) best = { id, level, guessed: true };
    }
    if (best) out.push(best);
  }
  return out;
}

export const LF_LOCKED_KEY = 'lf.locked';
/** Planet id → lifeform buildings (`b`) and research (`r`) whose requirements are not met, as last seen on the game's pages. */
export type LfLocked = Record<string, { b?: number[]; r?: number[] }>;

/**
 * On the lifeform buildings or research page: the technologies the game shows as locked
 * (requirements not met, `data-status="off"`), else null. A page seen with nothing locked gives [].
 */
export function readLfLocked(doc: Document): { part: 'b' | 'r'; ids: number[] } | null {
  const component = new URL(doc.location?.href ?? 'http://x/').searchParams.get('component');
  const part = component === 'lfbuildings' ? 'b' : component === 'lfresearch' ? 'r' : null;
  const items = Array.from(doc.querySelectorAll<HTMLElement>('#technologies .technology[data-technology]'));
  if (!part || !items.length) return null;
  return { part, ids: items.filter((e) => e.dataset.status === 'off').map((e) => Number(e.dataset.technology)).filter((id) => id > 0) };
}
