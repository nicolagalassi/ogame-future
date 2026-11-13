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

/* ------------------------------------------------------------------ */
/* Resources already sent to a planned body                            */
/* ------------------------------------------------------------------ */

export const SENT_KEY = 'plan.sent';

type Res = { metal: number; crystal: number; deuterium: number };

/** One transport (or deployment) with resources towards a body that has a plan. */
export interface Shipment {
  target: number;
  cargo: Res;
  sentAt: number;
  arriveAt: number;
}

/**
 * Resources on their way, or arrived but not yet in the numbers we have for that body:
 * a shipment counts until the body's resources were read after it landed.
 */
export function pendingFor(list: Shipment[], target: number, seenAt: number): Res & { arriveAt: number } {
  const out = { metal: 0, crystal: 0, deuterium: 0, arriveAt: 0 };
  for (const s of list) {
    if (s.target !== target || s.arriveAt <= seenAt) continue;
    out.metal += s.cargo.metal;
    out.crystal += s.cargo.crystal;
    out.deuterium += s.cargo.deuterium;
    out.arriveAt = Math.max(out.arriveAt, s.arriveAt);
  }
  return out;
}

export type PlanState = 'ready' | 'arriving' | 'arrived' | 'missing' | 'unknown';

/**
 * Where a body's plan stands: its resources are there (`ready`), will be once what was sent lands
 * (`arriving`), have landed but the body was not read since (`arrived`), still lack something
 * (`missing`, even with part on the way), or the body's stock is not known (`unknown`).
 */
export function planStatus(items: PlanItem[], have: Res | null, pending: Res & { arriveAt: number }, now: number): { state: PlanState; lack: Cost | null } {
  if (!have) return { state: 'unknown', lack: null };
  const total = planTotal(items);
  const now0 = missing(total, have);
  if (!now0.metal && !now0.crystal && !now0.deuterium) return { state: 'ready', lack: null };
  const lack = missing(total, { metal: have.metal + pending.metal, crystal: have.crystal + pending.crystal, deuterium: have.deuterium + pending.deuterium });
  if (lack.metal || lack.crystal || lack.deuterium) return { state: 'missing', lack };
  return { state: pending.arriveAt > now ? 'arriving' : 'arrived', lack: null };
}

/** Drops shipments already counted in the body's resources, or towards bodies with no plan. */
export function prunePending(list: Shipment[], plan: Plan, seenAtOf: (target: number) => number): Shipment[] {
  return list.filter((s) => (plan[String(s.target)]?.length ?? 0) > 0 && s.arriveAt > seenAtOf(s.target));
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Drops planned levels already started, from the game's construction queues (any page).
 * Queue entries carry the name and level, not the id: names are compared loosely.
 */
export function pruneByQueues(plan: Plan, queues: Record<string, { name: string; level: number }[]>): { plan: Plan; changed: boolean } {
  let changed = false;
  const started: { body: string; name: string; level: number }[] = [];
  for (const [body, items] of Object.entries(queues)) for (const q of items) if (q.level > 0 && q.name) started.push({ body, name: norm(q.name), level: q.level });
  const next: Plan = {};
  for (const [key, list] of Object.entries(plan)) {
    const kept = list.filter((item) => {
      if (item.level === undefined) return true;
      const hit = started.some((s) => (s.body === key || isResearch(item.id)) && s.name === norm(item.name) && s.level >= item.level!);
      if (hit) changed = true;
      return !hit;
    });
    if (kept.length) next[key] = kept;
  }
  return { plan: changed ? next : plan, changed };
}

/** The player started building: the planned level (or units) leaves the plan. */
export function startBuild(plan: Plan, bodyId: number, id: number, o: { level?: number; amount?: number }): { plan: Plan; changed: boolean; removed: PlanItem[] } {
  const key = String(bodyId);
  let changed = false;
  const removed: PlanItem[] = [];
  const next: Plan = {};
  for (const [k, list] of Object.entries(plan)) {
    let left = o.amount ?? 0;
    const kept: PlanItem[] = [];
    for (const item of list) {
      if (item.id !== id || (k !== key && !isResearch(id))) {
        kept.push(item);
        continue;
      }
      if (item.level !== undefined && o.level !== undefined && item.level <= o.level) {
        changed = true;
        if (item.level === o.level) removed.push(item);
        continue;
      }
      if (item.amount !== undefined && left > 0 && k === key) {
        changed = true;
        if (item.amount <= left) {
          left -= item.amount;
          continue;
        }
        const keep = item.amount - left;
        const share = keep / item.amount;
        kept.push({ ...item, amount: keep, cost: { metal: Math.round(item.cost.metal * share), crystal: Math.round(item.cost.crystal * share), deuterium: Math.round(item.cost.deuterium * share), energy: item.cost.energy } });
        left = 0;
        continue;
      }
      kept.push(item);
    }
    if (kept.length) next[k] = kept;
  }
  return { plan: changed ? next : plan, changed, removed };
}

/* ------------------------------------------------------------------ */
/* The plan seen by technology, against the whole account               */
/* ------------------------------------------------------------------ */

/** One body's share of a technology in the plan (consecutive levels together: "46–48"). */
export interface TechRow {
  bodyId: number;
  from?: number;
  to?: number;
  amount?: number;
  cost: Cost;
  /** Indexes in the body's list, for removal. */
  indexes: number[];
  /** What this body still lacks for these items, its earlier items counted first. */
  short: Cost | null;
}

/** A technology over every body where it is planned ("Miniera di metallo × 13 pianeti"). */
export interface TechGroup {
  id: number;
  name: string;
  cost: Cost;
  rows: TechRow[];
  added: number;
}

/**
 * The plan grouped by technology, in the order it was planned. `haveOf` gives what a body holds
 * (resources on the way included), or null when unknown.
 */
export function groupByTech(plan: Plan, haveOf: (bodyId: number) => Res | null): TechGroup[] {
  const groups = new Map<number, TechGroup>();
  for (const [key, items] of Object.entries(plan)) {
    const bodyId = Number(key);
    const have = haveOf(bodyId);
    let spent: Cost = { ...ZERO_COST };
    let before = have ? missing(spent, have) : null;
    items.forEach((item, index) => {
      // What this item adds to the body's shortfall, the earlier ones taken first.
      spent = addCost(spent, item.cost);
      const after = have ? missing(spent, have) : null;
      const short = after && before ? { metal: after.metal - before.metal, crystal: after.crystal - before.crystal, deuterium: after.deuterium - before.deuterium, energy: 0 } : null;
      before = after;
      let g = groups.get(item.id);
      if (!g) groups.set(item.id, (g = { id: item.id, name: item.name, cost: { ...ZERO_COST }, rows: [], added: item.added }));
      g.cost = addCost(g.cost, item.cost);
      g.added = Math.min(g.added, item.added);
      const last = g.rows[g.rows.length - 1];
      if (last && last.bodyId === bodyId && item.level !== undefined && last.to !== undefined && item.level === last.to + 1) {
        last.to = item.level;
        last.cost = addCost(last.cost, item.cost);
        last.indexes.push(index);
        last.short = last.short && short ? addCost(last.short, short) : null;
      } else g.rows.push({ bodyId, from: item.level, to: item.level, amount: item.amount, cost: { ...item.cost }, indexes: [index], short });
    });
  }
  return [...groups.values()].sort((a, b) => a.added - b.added || a.id - b.id);
}

/** Total cost, what the account holds and what is missing over the whole account. */
export function accountGap(plan: Plan, account: Res | null): { total: Cost; missing: Cost | null } {
  const total = Object.values(plan).reduce((sum, items) => addCost(sum, planTotal(items)), { ...ZERO_COST });
  return { total, missing: account ? missing(total, account) : null };
}

/* ------------------------------------------------------------------ */
/* Builds queued in the game but not started yet                       */
/* ------------------------------------------------------------------ */

/**
 * With a build already running, "Sviluppa" puts the next level in the game's queue: the game takes
 * its resources only when it starts. Until then those resources sit on the body but are already
 * spoken for, so the plan (and the transports it prepares) must not count them as free.
 * Stored locally only (AGENTS.md §1.9); read from what the player's own pages show, no network.
 */
export const QUEUED_KEY = 'plan.queued';

export type QueueKind = 'building' | 'research' | 'lfbuilding' | 'lfresearch';

export interface QueuedItem extends PlanItem {
  level: number;
  kind: QueueKind;
  /** When the player queued it. */
  queuedAt: number;
}

/** Queued levels per body id. */
export type Queued = Record<string, QueuedItem[]>;

/** The game queue a levelled technology goes into (ships and defences: null, they are paid when ordered). */
export function queueKindOf(id: number): QueueKind | null {
  if (id < 100) return 'building';
  if (id < 200) return 'research';
  if (id < 1000) return null;
  return Math.floor((id % 1000) / 100) === 1 ? 'lfbuilding' : 'lfresearch';
}

/** Resources held back on a body for its queued levels. */
export function reservedFor(queued: Queued, bodyId: number): Res {
  const out = { metal: 0, crystal: 0, deuterium: 0 };
  for (const q of queued[String(bodyId)] ?? []) {
    out.metal += q.cost.metal;
    out.crystal += q.cost.crystal;
    out.deuterium += q.cost.deuterium;
  }
  return out;
}

/** What is free on a body once its queued levels are set aside (may go below 0: then it lacks that much). */
export function lessReserved(have: Res, hold: Res): Res {
  return { metal: have.metal - hold.metal, crystal: have.crystal - hold.crystal, deuterium: have.deuterium - hold.deuterium };
}

/** Highest level of a technology already queued on a body (0 when none). */
export function queuedLevel(queued: Queued, bodyId: number, id: number): number {
  const list = isResearch(id) ? Object.values(queued).flat() : (queued[String(bodyId)] ?? []);
  return list.reduce((top, q) => (q.id === id ? Math.max(top, q.level) : top), 0);
}

/** Adds a queued level (the same level again replaces it). */
export function holdQueued(queued: Queued, bodyId: number, item: QueuedItem): Queued {
  const key = String(bodyId);
  const list = (queued[key] ?? []).filter((q) => !(q.id === item.id && q.level === item.level));
  return { ...queued, [key]: [...list, item].sort((a, b) => a.queuedAt - b.queuedAt) };
}

export function dropQueued(queued: Queued, bodyId: number, index: number): Queued {
  const key = String(bodyId);
  const list = (queued[key] ?? []).filter((_, i) => i !== index);
  const next = { ...queued };
  if (list.length) next[key] = list;
  else delete next[key];
  return next;
}

/** The game's running builds (productionqueue), as stored by `data/queues`. */
export interface RunningQueues {
  at: number;
  bodies: Record<string, { kind: string; name: string; level: number; end: number }[]>;
}

/**
 * Lets go of queued levels whose resources the game has taken, or that are gone:
 * - the game's queues, read after the level was queued, run that level (or a higher one): started;
 * - nothing of its kind runs there any more: it was built, or the player cancelled it
 *   (a queued level only waits while something of its kind is running);
 * - the levels seen on a technology page (`built`, not the target) reach it: built.
 * Research runs once for the whole account: its queue is looked up on every body.
 */
export function releaseQueued(queued: Queued, o: { queues?: RunningQueues | null; built?: { bodyId: number; levels: Record<number, number> } }): { queued: Queued; changed: boolean } {
  let changed = false;
  const next: Queued = {};
  const running = (key: string, kind: QueueKind, at: number) => {
    const lists = kind === 'research' ? Object.values(o.queues?.bodies ?? {}) : [o.queues?.bodies[key] ?? []];
    return lists.flat().filter((r) => r.kind === kind && r.end > at);
  };
  for (const [key, list] of Object.entries(queued)) {
    const kept = list.filter((q) => {
      const built = o.built && (o.built.bodyId === Number(key) || isResearch(q.id)) ? o.built.levels[q.id] : undefined;
      if (built !== undefined && built >= q.level) return (changed = true), false;
      const snap = o.queues;
      if (!snap || snap.at <= q.queuedAt) return true;
      const now = running(key, q.kind, snap.at);
      if (!now.length || now.some((r) => norm(r.name) === norm(q.name) && r.level >= q.level)) return (changed = true), false;
      return true;
    });
    if (kept.length) next[key] = kept;
  }
  return { queued: changed ? next : queued, changed };
}

/** Plan and queue together, for totals over the account (queued resources are still on the bodies). */
export function withQueued(plan: Plan, queued: Queued): Plan {
  const out: Plan = { ...plan };
  for (const [key, list] of Object.entries(queued)) if (list.length) out[key] = [...(out[key] ?? []), ...list];
  return out;
}
