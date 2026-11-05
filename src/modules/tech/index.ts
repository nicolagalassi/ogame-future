/**
 * Cost panel on the game's technology pages: when the player opens a building, research, ship
 * or defence, the game's details panel gets a "Pianifica" box with
 * - the cost of any later level (‹ ›), the cumulative cost from the next level to that one,
 * - what is missing against the resources on this planet or moon,
 * - the build time of that level and of the whole range,
 * - "Aggiungi al piano", which stores those levels in the construction plan.
 * Precedent: OGLight's TechManager panel and todolist (MIT, © 2019 Oz).
 *
 * COMPLIANCE: reads the panel the game itself loaded; no request, no game action. The panel
 * is watched with a MutationObserver instead of replacing the game's technologyDetails.
 */
import type { Store } from '../../core/storage';
import { formatUnits } from '../../core/format';
import { levelsOf, readTechDetails, readTechList, type TechDetails } from '../../data/tech-details';
import {
  isLevelled,
  levelCost,
  matchShownLevel,
  missing,
  rangeCost,
  scaleCost,
  scaleDuration,
  techKind,
  type Cost,
} from '../../engines/tech';
import { addToPlan, inPlan, PLAN_KEY, prune, removeFromPlan, type Plan, type PlanItem } from '../../engines/planner';
import { TECH_CSS } from './style';

export type T = (key: string, vars?: Record<string, string | number>) => string;

export interface TechOptions {
  doc: Document;
  store: Store;
  bodyId: number;
  t: T;
  locale: string;
  /** Resources on this body now (the game's resource bar). */
  have: () => { metal: number; crystal: number; deuterium: number } | null;
  /** Called after the plan changes (planet menu badge). */
  onPlanChange?: () => void;
}

const RES = [
  ['metal', 'm'],
  ['crystal', 'c'],
  ['deuterium', 'd'],
  ['energy', 'e'],
] as const;

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function formatDuration(ms: number): string {
  let s = Math.max(1, Math.round(ms / 1000));
  const parts: string[] = [];
  for (const [size, unit] of [
    [604800, 'w'],
    [86400, 'd'],
    [3600, 'h'],
    [60, 'm'],
    [1, 's'],
  ] as const) {
    if (s >= size || (unit === 's' && !parts.length)) {
      parts.push(`${Math.floor(s / size)}${unit}`);
      s %= size;
    }
    if (parts.length === 3) break;
  }
  return parts.join(' ');
}

export const loadPlan = (store: Store): Plan => store.get<Plan>(PLAN_KEY, {});

/** Levelled tech: where the panel starts and the bonus the game applied. */
function startLevel(details: TechDetails, listLevel: number | undefined, built: number | undefined): { level: number; discount: number } {
  const candidates = [details.panelLevel ?? 0, (details.panelLevel ?? 0) + 1, (listLevel ?? 0) + 1, (built ?? 0) + 1];
  const match = matchShownLevel(details.id, candidates, details.shown);
  if (match) return match;
  return { level: (listLevel ?? details.panelLevel ?? 0) + 1, discount: 0 };
}

interface Row {
  key: (typeof RES)[number][0];
  cls: string;
  one: number;
  total: number | null;
  short: number;
}

function costRows(one: Cost, total: Cost | null, gap: Cost | null): Row[] {
  return RES.filter(([key]) => one[key] > 0 || (total?.[key] ?? 0) > 0).map(([key, cls]) => ({
    key,
    cls,
    one: one[key],
    total: total ? total[key] : null,
    short: key === 'energy' ? 0 : (gap?.[key] ?? 0),
  }));
}

export function renderTechPanel(o: TechOptions, details: TechDetails): HTMLElement | null {
  const { doc, t, locale } = o;
  const kind = techKind(details.id);
  if (!kind) return null;
  details.root.querySelector('.fut-tp')?.remove();
  const list = readTechList(doc);
  const entry = list.find((e) => e.id === details.id);
  const box = el(doc, 'div', 'fut-tp');
  const fmt = (n: number) => formatUnits(n, locale);
  const exact = (n: number) => Math.round(n).toLocaleString(locale);

  if (isLevelled(details.id)) {
    const start = startLevel(details, entry?.level, entry?.built);
    let to = start.level;
    const draw = () => {
      const one = levelCost(details.id, to, start.discount);
      const total = rangeCost(details.id, start.level, to, start.discount);
      const have = o.have();
      const gap = have ? missing(total, have) : null;
      const plan = loadPlan(o.store);
      let planned = true;
      for (let l = start.level; l <= to; l++) planned &&= inPlan(plan, o.bodyId, details.id, l);

      const head = el(doc, 'div', 'fut-tp-head');
      const prev = el(doc, 'button', 'fut-tp-step', '‹');
      prev.type = 'button';
      prev.title = t('tech.prev');
      prev.disabled = to <= start.level;
      prev.addEventListener('click', () => {
        to = Math.max(start.level, to - 1);
        draw();
      });
      const next = el(doc, 'button', 'fut-tp-step', '›');
      next.type = 'button';
      next.title = t('tech.next');
      next.addEventListener('click', () => {
        to += 1;
        draw();
      });
      const range = el(doc, 'span', 'fut-tp-range');
      range.append(
        el(doc, 'span', 'fut-tp-lv', t('tech.level', { level: to })),
        el(doc, 'span', 'fut-tp-from', to > start.level ? t('tech.range', { from: start.level - 1, to }) : t('tech.fromNow', { from: start.level - 1 })),
      );
      if (to > start.level) {
        const reset = el(doc, 'button', 'fut-tp-reset', '×');
        reset.type = 'button';
        reset.title = t('tech.reset');
        reset.addEventListener('click', () => {
          to = start.level;
          draw();
        });
        range.append(reset);
      }
      head.append(prev, range, next);

      const grid = el(doc, 'div', 'fut-tp-grid');
      grid.append(
        el(doc, 'span', 'fut-tp-h'),
        el(doc, 'span', 'fut-tp-h', t('tech.colLevel', { level: to })),
        el(doc, 'span', 'fut-tp-h', t('tech.colTotal')),
        el(doc, 'span', 'fut-tp-h', t('tech.colMissing')),
      );
      for (const row of costRows(one, total, gap)) {
        const cell = (value: number, cls: string) => {
          const c = el(doc, 'span', `fut-tp-v ${cls}`, fmt(value));
          c.title = exact(value);
          return c;
        };
        grid.append(
          el(doc, 'span', `fut-tp-k fut-${row.cls}`, t(`tech.res.${row.key}`)),
          cell(row.one, ''),
          cell(row.total ?? row.one, 'fut-tp-sum'),
          row.key === 'energy'
            ? el(doc, 'span', 'fut-tp-v fut-tp-na', '')
            : row.short > 0
              ? cell(-row.short, 'fut-tp-short')
              : el(doc, 'span', 'fut-tp-v fut-tp-ok', have ? '✓' : '—'),
        );
      }
      if (details.durationMs) {
        const shownLevel = start.level;
        const lvMs = scaleDuration(details.id, shownLevel, details.durationMs, to);
        let sumMs = 0;
        for (let l = start.level; l <= to; l++) sumMs += scaleDuration(details.id, shownLevel, details.durationMs, l);
        grid.append(
          el(doc, 'span', 'fut-tp-k', t('tech.time')),
          el(doc, 'span', 'fut-tp-v', formatDuration(lvMs)),
          el(doc, 'span', 'fut-tp-v fut-tp-sum', formatDuration(sumMs)),
          el(doc, 'span', 'fut-tp-v fut-tp-na', ''),
        );
      }

      const actions = el(doc, 'div', 'fut-tp-actions');
      const add = el(doc, 'button', planned ? 'fut-tp-add on' : 'fut-tp-add');
      add.type = 'button';
      add.textContent = planned
        ? t('tech.inPlan')
        : to > start.level
          ? t('tech.addRange', { from: start.level, to })
          : t('tech.addOne', { level: to });
      add.title = planned ? t('tech.removeHint') : t('tech.addHint');
      add.addEventListener('click', () => {
        let current = loadPlan(o.store);
        if (planned) {
          // Removes the levels of this range from this body's plan.
          for (let l = to; l >= start.level; l--) {
            const idx = (current[String(o.bodyId)] ?? []).findIndex((x) => x.id === details.id && x.level === l);
            if (idx >= 0) current = removeFromPlan(current, o.bodyId, idx);
          }
        } else {
          const now = Date.now();
          const items: PlanItem[] = [];
          for (let l = start.level; l <= to; l++) {
            items.push({ id: details.id, level: l, name: details.name, cost: levelCost(details.id, l, start.discount), added: now });
          }
          current = addToPlan(current, o.bodyId, items);
        }
        o.store.set(PLAN_KEY, current);
        o.onPlanChange?.();
        draw();
      });
      actions.append(add);
      if (start.discount > 0.0005) actions.append(el(doc, 'span', 'fut-tp-note', t('tech.discount', { pct: (start.discount * 100).toFixed(1) })));
      box.replaceChildren(head, grid, actions);
    };
    draw();
  } else {
    // Ships and defences: cost of the amount typed in the game's own field.
    const unit = matchShownLevel(details.id, [1], details.shown);
    const discount = unit?.discount ?? 0;
    const amountOf = () => Math.max(1, Math.floor(Number(details.amountInput?.value) || 1));
    const draw = () => {
      const n = amountOf();
      const one = levelCost(details.id, 1, discount);
      const total = scaleCost(one, n);
      const have = o.have();
      const gap = have ? missing(total, have) : null;
      const head = el(doc, 'div', 'fut-tp-head');
      head.append(el(doc, 'span', 'fut-tp-range', t('tech.amount', { n: n.toLocaleString(locale) })));
      const grid = el(doc, 'div', 'fut-tp-grid');
      grid.append(
        el(doc, 'span', 'fut-tp-h'),
        el(doc, 'span', 'fut-tp-h', t('tech.colOne')),
        el(doc, 'span', 'fut-tp-h', t('tech.colTotal')),
        el(doc, 'span', 'fut-tp-h', t('tech.colMissing')),
      );
      for (const row of costRows(one, total, gap)) {
        const cell = (value: number, cls: string) => {
          const c = el(doc, 'span', `fut-tp-v ${cls}`, fmt(value));
          c.title = exact(value);
          return c;
        };
        grid.append(
          el(doc, 'span', `fut-tp-k fut-${row.cls}`, t(`tech.res.${row.key}`)),
          cell(row.one, ''),
          cell(row.total ?? row.one, 'fut-tp-sum'),
          row.short > 0 ? cell(-row.short, 'fut-tp-short') : el(doc, 'span', 'fut-tp-v fut-tp-ok', have ? '✓' : '—'),
        );
      }
      if (details.durationMs) {
        grid.append(
          el(doc, 'span', 'fut-tp-k', t('tech.time')),
          el(doc, 'span', 'fut-tp-v', formatDuration(details.durationMs)),
          el(doc, 'span', 'fut-tp-v fut-tp-sum', formatDuration(details.durationMs * n)),
          el(doc, 'span', 'fut-tp-v fut-tp-na', ''),
        );
      }
      const actions = el(doc, 'div', 'fut-tp-actions');
      const add = el(doc, 'button', 'fut-tp-add', t('tech.addUnits', { n: n.toLocaleString(locale) }));
      add.type = 'button';
      add.title = t('tech.addHint');
      add.addEventListener('click', () => {
        const item: PlanItem = { id: details.id, amount: n, name: details.name, cost: total, added: Date.now() };
        o.store.set(PLAN_KEY, addToPlan(loadPlan(o.store), o.bodyId, [item]));
        o.onPlanChange?.();
        add.classList.add('on');
        add.textContent = t('tech.added');
      });
      actions.append(add);
      box.replaceChildren(head, grid, actions);
    };
    draw();
    const input = details.amountInput;
    if (input) {
      for (const type of ['input', 'change', 'keyup']) input.addEventListener(type, () => setTimeout(draw, 0));
      // The game's "max" button writes the field without an input event.
      input.parentElement?.querySelector('.maximum')?.addEventListener('click', () => setTimeout(draw, 0));
    }
  }

  const costs = details.root.querySelector('.costs');
  if (costs?.parentElement) costs.after(box);
  else details.root.append(box);
  return box;
}

function injectStyle(doc: Document): void {
  if (doc.getElementById('fut-tp-style')) return;
  const style = el(doc, 'style');
  style.id = 'fut-tp-style';
  style.textContent = TECH_CSS;
  doc.head.append(style);
}

/**
 * On a technology page: drops the plan's levels already reached, then adds the panel every
 * time the game opens a details panel.
 */
export function watchTechPages(o: TechOptions): void {
  const { doc } = o;
  if (!doc.querySelector('#technologies')) return;
  const levels = levelsOf(readTechList(doc));
  const pruned = prune(loadPlan(o.store), o.bodyId, levels);
  if (pruned.changed) {
    o.store.set(PLAN_KEY, pruned.plan);
    o.onPlanChange?.();
  }
  injectStyle(doc);
  let lastRoot: Element | null = null;
  const check = () => {
    const details = readTechDetails(doc);
    if (!details) return;
    if (details.root === lastRoot && details.root.querySelector('.fut-tp')) return;
    lastRoot = details.root;
    renderTechPanel(o, details);
  };
  const target = doc.getElementById('technologydetails_wrapper') ?? doc.body;
  new MutationObserver(() => check()).observe(target, { childList: true, subtree: true });
  check();
}
