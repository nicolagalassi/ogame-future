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

/** One line of the cost table: a label, a value per resource, and a time. */
interface Line {
  label: string;
  title?: string;
  cost: Cost;
  /** Negative numbers in red (what is missing). */
  short?: boolean;
  ms?: number | null;
  cls?: string;
}

/**
 * The cost table, one resource per column, so it fits the game's description strip
 * (654 × 95 px) under the details panel.
 */
function costTable(o: TechOptions, lines: Line[], have: boolean, ms: boolean): HTMLElement {
  const { doc, t, locale } = o;
  const keys = RES.filter(([key]) => lines.some((l) => !l.short && l.cost[key] > 0));
  const grid = el(doc, 'div', 'fut-tp-grid');
  grid.style.gridTemplateColumns = `auto repeat(${keys.length + (ms ? 1 : 0)}, minmax(0, 1fr))`;
  grid.append(el(doc, 'span', 'fut-tp-h'));
  for (const [key, cls] of keys) grid.append(el(doc, 'span', `fut-tp-h fut-${cls}`, t(`tech.res.${key}`)));
  if (ms) grid.append(el(doc, 'span', 'fut-tp-h', t('tech.time')));
  for (const line of lines) {
    const label = el(doc, 'span', `fut-tp-k ${line.cls ?? ''}`, line.label);
    if (line.title) label.title = line.title;
    grid.append(label);
    for (const [key] of keys) {
      if (line.short) {
        const gap = line.cost[key];
        if (key === 'energy') grid.append(el(doc, 'span', 'fut-tp-v'));
        else if (gap > 0) {
          const c = el(doc, 'span', 'fut-tp-v fut-tp-short', formatUnits(-gap, locale));
          c.title = Math.round(-gap).toLocaleString(locale);
          grid.append(c);
        } else grid.append(el(doc, 'span', 'fut-tp-v fut-tp-ok', have ? '✓' : '—'));
        continue;
      }
      const v = line.cost[key];
      const c = el(doc, 'span', `fut-tp-v ${line.cls ?? ''}`, v ? formatUnits(v, locale) : '—');
      c.title = Math.round(v).toLocaleString(locale);
      grid.append(c);
    }
    if (ms) grid.append(el(doc, 'span', `fut-tp-v ${line.cls ?? ''}`, line.ms ? formatDuration(line.ms) : ''));
  }
  return grid;
}

function button(doc: Document, cls: string, text: string, title: string, onClick: () => void): HTMLButtonElement {
  const b = el(doc, 'button', cls, text);
  b.type = 'button';
  b.title = title;
  b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  return b;
}

export function renderTechPanel(o: TechOptions, details: TechDetails): HTMLElement | null {
  const { doc, t, locale } = o;
  const kind = techKind(details.id);
  if (!kind) return null;
  details.root.querySelector('.fut-tp')?.remove();
  const list = readTechList(doc);
  const entry = list.find((e) => e.id === details.id);
  const box = el(doc, 'div', 'fut-tp');
  const side = () => el(doc, 'div', 'fut-tp-side');

  if (isLevelled(details.id)) {
    const start = startLevel(details, entry?.level, entry?.built);
    let to = start.level;
    const draw = () => {
      const one = levelCost(details.id, to, start.discount);
      const total = rangeCost(details.id, start.level, to, start.discount);
      const have = o.have();
      const gap = have ? missing(total, have) : missing(total, { metal: 0, crystal: 0, deuterium: 0 });
      const plan = loadPlan(o.store);
      let planned = true;
      for (let l = start.level; l <= to; l++) planned &&= inPlan(plan, o.bodyId, details.id, l);
      const ms = (l: number) => (details.durationMs ? scaleDuration(details.id, start.level, details.durationMs, l) : null);
      let sumMs = 0;
      for (let l = start.level; l <= to; l++) sumMs += ms(l) ?? 0;

      const left = side();
      const stepper = el(doc, 'div', 'fut-tp-head');
      const prev = button(doc, 'fut-tp-step', '‹', t('tech.prev'), () => {
        to = Math.max(start.level, to - 1);
        draw();
      });
      prev.disabled = to <= start.level;
      const next = button(doc, 'fut-tp-step', '›', t('tech.next'), () => {
        to += 1;
        draw();
      });
      stepper.append(prev, el(doc, 'span', 'fut-tp-lv', t('tech.level', { level: to })), next);
      if (to > start.level) {
        stepper.append(
          button(doc, 'fut-tp-reset', '×', t('tech.reset'), () => {
            to = start.level;
            draw();
          }),
        );
      }
      const from = el(doc, 'span', 'fut-tp-from', t('tech.fromNow', { from: start.level - 1 }));
      const add = button(
        doc,
        planned ? 'fut-tp-add on' : 'fut-tp-add',
        planned ? t('tech.inPlan') : to > start.level ? t('tech.addRange', { from: start.level, to }) : t('tech.addOne', { level: to }),
        planned ? t('tech.removeHint') : t('tech.addHint'),
        () => {
          let current = loadPlan(o.store);
          if (planned) {
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
        },
      );
      left.append(stepper, from, add);
      if (start.discount > 0.0005) {
        from.textContent += ` · ${t('tech.discountShort', { pct: (start.discount * 100).toFixed(1) })}`;
        from.title = t('tech.discount', { pct: (start.discount * 100).toFixed(1) });
      }

      const lines: Line[] = [{ label: t('tech.colLevel', { level: to }), cost: one, ms: ms(to) }];
      if (to > start.level) {
        lines.push({ label: t('tech.rangeShort', { from: start.level, to }), title: t('tech.rangeHint', { from: start.level, to }), cost: total, ms: sumMs, cls: 'fut-tp-sum' });
      }
      lines.push({ label: t('tech.colMissing'), cost: gap, short: true });
      box.replaceChildren(left, costTable(o, lines, have !== null, details.durationMs !== null));
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
      const gap = missing(total, have ?? { metal: 0, crystal: 0, deuterium: 0 });
      const left = side();
      const add = button(doc, 'fut-tp-add', t('tech.addUnits', { n: n.toLocaleString(locale) }), t('tech.addHint'), () => {
        const item: PlanItem = { id: details.id, amount: n, name: details.name, cost: total, added: Date.now() };
        o.store.set(PLAN_KEY, addToPlan(loadPlan(o.store), o.bodyId, [item]));
        o.onPlanChange?.();
        add.classList.add('on');
        add.textContent = t('tech.added');
      });
      left.append(el(doc, 'span', 'fut-tp-lv', t('tech.amount', { n: n.toLocaleString(locale) })), add);
      const lines: Line[] = [
        { label: t('tech.colOne'), cost: one, ms: details.durationMs },
        { label: `×${n.toLocaleString(locale)}`, cost: total, ms: details.durationMs ? details.durationMs * n : null, cls: 'fut-tp-sum' },
        { label: t('tech.colMissing'), cost: gap, short: true },
      ];
      box.replaceChildren(left, costTable(o, lines, have !== null, details.durationMs !== null));
    };
    draw();
    const input = details.amountInput;
    if (input) {
      for (const type of ['input', 'change', 'keyup']) input.addEventListener(type, () => setTimeout(draw, 0));
      // The game's "max" button writes the field without an input event.
      input.parentElement?.querySelector('.maximum')?.addEventListener('click', () => setTimeout(draw, 0));
    }
  }

  // The game's description strip (full width, under image and costs) has room for the
  // panel; its flavour text stays one click away behind the game's own "?" button.
  const strip = details.root.querySelector(':scope > .description');
  if (strip) {
    details.root.classList.add('fut-tp-on');
    strip.prepend(box);
  } else {
    const costs = details.root.querySelector('.costs');
    if (costs?.parentElement) costs.after(box);
    else details.root.append(box);
  }
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
