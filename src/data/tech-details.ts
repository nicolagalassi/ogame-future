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
  /** Population the level shown needs (some lifeform buildings), and whether the planet has it, as the game says. */
  population: { value: number; enough: boolean } | null;
  /** Build time the game shows, in ms. */
  durationMs: number | null;
  /** Ships and defences: the game's amount field. */
  amountInput: HTMLInputElement | null;
  /** Extra energy the level shown needs, as the game says (mines, some lifeform buildings). */
  energyNeed: number | null;
  /** Solar satellite: energy the satellites give now, how many there are, one more gives. */
  energyProduction: { total: number; count: number; next: number | null } | null;
}

/** The value of a cost entry: data-value when present, otherwise the tooltip or text. */
function costValue(root: HTMLElement, cls: string): number | undefined {
  const el = root.querySelector<HTMLElement>(`.costs .${cls}`);
  if (!el) return undefined;
  const v = num(el.getAttribute('data-value')) ?? num(el.getAttribute('data-tooltip-title') ?? el.getAttribute('title')) ?? num(el.textContent);
  return v ?? undefined;
}

function readEnergyProduction(root: HTMLElement): TechDetails['energyProduction'] {
  const value = root.querySelector<HTMLElement>('.information li.energy_production .value');
  const total = num(value?.getAttribute('data-value'));
  if (!value || total === null) return null;
  return {
    total,
    count: num(root.querySelector('.information .amount')?.getAttribute('data-value')) ?? 0,
    next: num(value.querySelector('.bonus')?.getAttribute('data-value')),
  };
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
  const popEl = root.querySelector<HTMLElement>('.costs .population');
  const pop = costValue(root, 'population');
  const population = popEl && pop !== undefined ? { value: pop, enough: !popEl.classList.contains('insufficient') } : null;
  const time = root.querySelector<HTMLElement>('.build_duration time, .build_duration [datetime]');
  const durationMs = time ? isoDurationMs(time.getAttribute('datetime') ?? '') : null;
  return {
    root,
    id,
    name: root.querySelector('h3')?.textContent?.trim() ?? String(id),
    panelLevel: num(root.querySelector('.information .level')?.getAttribute('data-value')),
    shown,
    population,
    durationMs,
    amountInput: root.querySelector<HTMLInputElement>('#build_amount'),
    energyNeed: num(root.querySelector('.information li.additional_energy_consumption .value')?.getAttribute('data-value')),
    energyProduction: readEnergyProduction(root),
  };
}
