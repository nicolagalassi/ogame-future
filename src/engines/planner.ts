/**
 * The construction plan ("pianificazione"): what the player wants to build next on each
 * planet or moon, with its cost. Pure functions over the stored plan: no DOM, no network.
 * Stored locally only (AGENTS.md §1.9).
 */
import { addCost, missing, ZERO_COST, type Cost } from './tech';

export const PLAN_KEY = 'planner';

export interface PlanItem {
  /** Technology id. */
  id: number;
  /** Level to reach (buildings, research). */
  level?: number;
  /** How many (ships, defences). */
  amount?: number;
  name: string;
  cost: Cost;
  added: number;
}

/** Plan per body id. */
export type Plan = Record<string, PlanItem[]>;

/** Research is the same on every planet: it is done wherever it was planned. */
export const isResearch = (id: number): boolean => (id > 100 && id < 200) || Math.floor((id % 1000) / 100) === 2;

/** Adds items to a body's plan. A level already planned is replaced, not doubled. */
export function addToPlan(plan: Plan, bodyId: number, items: PlanItem[]): Plan {
  const key = String(bodyId);
  const list = [...(plan[key] ?? [])];
  for (const item of items) {
    const same = item.level !== undefined ? list.findIndex((x) => x.id === item.id && x.level === item.level) : -1;
    if (same >= 0) list[same] = item;
    else list.push(item);
  }
  list.sort((a, b) => a.added - b.added || a.id - b.id || (a.level ?? 0) - (b.level ?? 0));
  return { ...plan, [key]: list };
}

export function removeFromPlan(plan: Plan, bodyId: number, index: number): Plan {
  const key = String(bodyId);
  const list = (plan[key] ?? []).filter((_, i) => i !== index);
  const next = { ...plan };
  if (list.length) next[key] = list;
  else delete next[key];
  return next;
}

export function clearBody(plan: Plan, bodyId: number): Plan {
  const next = { ...plan };
  delete next[String(bodyId)];
  return next;
}

/**
 * Drops the levels already reached. `levels` = levels seen on the current page (a level in
 * construction counts as reached: its resources are already spent). Research is pruned on
 * every body, buildings only on the body the page belongs to.
 */
export function prune(plan: Plan, bodyId: number, levels: Record<number, number>): { plan: Plan; changed: boolean } {
  let changed = false;
  const next: Plan = {};
  for (const [key, list] of Object.entries(plan)) {
    const kept = list.filter((item) => {
      if (item.level === undefined) return true;
      const here = key === String(bodyId) || isResearch(item.id);
      const reached = levels[item.id];
      if (here && reached !== undefined && reached >= item.level) {
        changed = true;
        return false;
      }
      return true;
    });
    if (kept.length) next[key] = kept;
  }
  return { plan: changed ? next : plan, changed };
}

export function planTotal(items: PlanItem[]): Cost {
  return items.reduce((sum, item) => addCost(sum, item.cost), { ...ZERO_COST });
}

export function planCount(plan: Plan): number {
  return Object.values(plan).reduce((n, list) => n + list.length, 0);
}

export function planMissing(items: PlanItem[], have: { metal: number; crystal: number; deuterium: number }): Cost {
  return missing(planTotal(items), have);
}

/** True if this level (or any of them) is already in the body's plan. */
export function inPlan(plan: Plan, bodyId: number, id: number, level?: number): boolean {
  return (plan[String(bodyId)] ?? []).some((x) => x.id === id && (level === undefined || x.level === level));
}
