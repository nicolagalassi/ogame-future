/**
 * Reads the game's technology pages (buildings, research, shipyard, defence, lifeform):
 * the list of techs with their levels, and the details panel the game opens on click.
 * Pure DOM reads: no network call.
 */
import { isoDurationMs, type Cost } from '../engines/tech';

const num = (value: string | null | undefined): number | null => {
  if (value == null) return null;
  const n = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && String(value).trim() !== '' ? n : null;
};

export interface TechListEntry {
  id: number;
  name: string;
  /** Level reached, counting a level already in construction. */
  level: number;
  /** Level built so far, without the one in construction. */
  built: number;
}

export function readTechList(doc: Document): TechListEntry[] {
  return Array.from(doc.querySelectorAll<HTMLElement>('#technologies .technology[data-technology]')).flatMap((el) => {
    const id = Number(el.getAttribute('data-technology'));
    const built = num(el.querySelector('.level')?.getAttribute('data-value'));
    if (!id || built === null) return [];
    const target = num(el.querySelector('.targetlevel')?.getAttribute('data-value'));
    return [{ id, name: el.getAttribute('aria-label') ?? el.getAttribute('title') ?? String(id), built, level: Math.max(built, target ?? 0) }];
  });
}

export function levelsOf(list: TechListEntry[]): Record<number, number> {
  return Object.fromEntries(list.map((e) => [e.id, e.level]));
}

export interface TechDetails {
  root: HTMLElement;
  id: number;
  name: string;
  /** The level number on the panel (`.information .level`). */
  panelLevel: number | null;
  /** Cost the game shows (one level, or one unit for ships and defences). */
  shown: Partial<Cost>;
  /** Build time the game shows, in ms. */
  durationMs: number | null;
  /** Ships and defences: the game's amount field. */
  amountInput: HTMLInputElement | null;
}

/** The value of a cost entry: data-value when present, otherwise the tooltip or text. */
function costValue(root: HTMLElement, cls: string): number | undefined {
  const el = root.querySelector<HTMLElement>(`.costs .${cls}`);
  if (!el) return undefined;
  const v = num(el.getAttribute('data-value')) ?? num(el.getAttribute('data-tooltip-title') ?? el.getAttribute('title')) ?? num(el.textContent);
  return v ?? undefined;
}

export function readTechDetails(doc: Document): TechDetails | null {
  const root = doc.querySelector<HTMLElement>('#technologydetails');
  if (!root) return null;
  const id = Number(root.getAttribute('data-technology-id') ?? root.querySelector('[data-technology-id]')?.getAttribute('data-technology-id'));
  if (!id) return null;
  const shown: Partial<Cost> = {};
  const metal = costValue(root, 'metal');
  const crystal = costValue(root, 'crystal');
  const deuterium = costValue(root, 'deuterium');
  const energy = costValue(root, 'energy');
  if (metal !== undefined) shown.metal = metal;
  if (crystal !== undefined) shown.crystal = crystal;
  if (deuterium !== undefined) shown.deuterium = deuterium;
  if (energy !== undefined) shown.energy = energy;
  const time = root.querySelector<HTMLElement>('.build_duration time, .build_duration [datetime]');
  const durationMs = time ? isoDurationMs(time.getAttribute('datetime') ?? '') : null;
  return {
    root,
    id,
    name: root.querySelector('h3')?.textContent?.trim() ?? String(id),
    panelLevel: num(root.querySelector('.information .level')?.getAttribute('data-value')),
    shown,
    durationMs,
    amountInput: root.querySelector<HTMLInputElement>('#build_amount'),
  };
}
