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
import { addToPlan, inPlan, PLAN_KEY, prune, removeFromPlan, startBuild, type Plan, type PlanItem } from '../../engines/planner';
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

const msu = (c: Cost): number => c.metal + c.crystal * 1.5 + c.deuterium * 3;

function button(doc: Document, cls: string, html: string, title: string, onClick: () => void): HTMLButtonElement {
  const b = el(doc, 'button', cls);
  b.type = 'button';
  b.innerHTML = html;
  b.title = title;
  b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  return b;
}

const ICON = {
  prev: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  reset: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plan: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h1M4 12h1M4 18h1"/></svg>',
  time: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  energy: '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
  start: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/></svg>',
};

interface View {
  /** Column heads after the resource column. */
  heads: string[];
  /** Values per column, per row key. */
  cols: { cost: Cost; cls?: string; short?: boolean }[];
}

/** The cost grid: one row per resource (+ MSU), one column per view (level, range, missing). */
function grid(o: TechOptions, view: View, have: boolean): HTMLElement {
  const { doc, t, locale } = o;
  const g = el(doc, 'div', 'fut-tp-grid');
  g.style.gridTemplateColumns = `auto repeat(${view.cols.length}, minmax(0, 1fr))`;
  g.append(el(doc, 'span', 'fut-tp-h'));
  for (const h of view.heads) g.append(el(doc, 'span', 'fut-tp-h', h));
  const rows = RES.filter(([key]) => view.cols.some((c) => !c.short && c.cost[key] > 0));
  const cell = (value: number, cls: string) => {
    const c = el(doc, 'span', `fut-tp-v ${cls}`, value ? formatUnits(value, locale) : '—');
    c.title = Math.round(value).toLocaleString(locale);
    return c;
  };
  for (const [key, cls] of rows) {
    g.append(el(doc, 'span', `fut-tp-k fut-${cls}`, t(`tech.res.${key}`)));
    for (const col of view.cols) {
      if (!col.short) g.append(cell(col.cost[key], col.cls ?? ''));
      else if (key === 'energy') g.append(el(doc, 'span', 'fut-tp-v'));
      else if (col.cost[key] > 0) g.append(cell(-col.cost[key], 'fut-tp-short'));
      else g.append(el(doc, 'span', 'fut-tp-v fut-tp-ok', have ? '✓' : '—'));
    }
  }
  g.append(el(doc, 'span', 'fut-tp-k fut-tp-msu', 'MSU'));
  for (const col of view.cols) {
    const v = msu(col.cost);
    if (col.short) g.append(v > 0 ? cell(-v, 'fut-tp-short fut-tp-msu') : el(doc, 'span', 'fut-tp-v fut-tp-ok fut-tp-msu', have ? '✓' : '—'));
    else g.append(cell(v, `${col.cls ?? ''} fut-tp-msu`));
  }
  return g;
}

function chip(doc: Document, icon: string, text: string, title: string, cls = ''): HTMLElement {
  const c = el(doc, 'span', `fut-tp-chip ${cls}`.trim());
  c.innerHTML = icon;
  c.append(el(doc, 'span', '', text));
  c.title = title;
  return c;
}

/**
 * The game's own extra lines, kept as small chips. Buildings, research and lifeform pages
 * carry different ones (energy, possible start, population, lab levels…): every line of
 * the game's list becomes a chip, except the build time, which the panel computes.
 */
function gameChips(doc: Document, details: TechDetails): HTMLElement[] {
  const out: HTMLElement[] = [];
  const icons: Record<string, string> = {
    additional_energy_consumption: ICON.energy,
    energy_consumption: ICON.energy,
    possible_build_start: ICON.start,
  };
  for (const li of Array.from(details.root.querySelectorAll<HTMLElement>('.content .information > ul > li'))) {
    if (li.classList.contains('build_duration')) continue;
    const value = li.querySelector<HTMLElement>('.value');
    const text = (value?.textContent ?? li.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const label = li.querySelector('strong')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const why = value?.getAttribute('data-tooltip-title') ?? value?.getAttribute('title') ?? '';
    const cls = Array.from(li.classList).find((c) => icons[c]) ?? '';
    const shown = cls.includes('energy') ? `-${text}` : value ? text : text.replace(label, '').trim();
    out.push(chip(doc, icons[cls] ?? '', shown, [label, why].filter(Boolean).join(' '), cls.includes('energy') ? 'fut-tp-energy' : cls ? 'fut-tp-start' : ''));
  }
  return out;
}

export function renderTechPanel(o: TechOptions, details: TechDetails): HTMLElement | null {
  const { doc, t, locale } = o;
  const kind = techKind(details.id);
  if (!kind) return null;
  details.root.querySelectorAll('.fut-tp, .fut-tp-tools').forEach((n) => n.remove());
  const list = readTechList(doc);
  const entry = list.find((e) => e.id === details.id);
  const box = el(doc, 'div', 'fut-tp');
  const tools = el(doc, 'div', 'fut-tp-tools');
  const levelLabel = details.root.querySelector<HTMLElement>('.information .level');
  const levelText = levelLabel?.textContent ?? '';
  const chips = gameChips(doc, details);

  if (isLevelled(details.id)) {
    const start = startLevel(details, entry?.level, entry?.built);
    let to = start.level;
    const draw = () => {
      const one = levelCost(details.id, to, start.discount);
      const total = rangeCost(details.id, start.level, to, start.discount);
      const have = o.have();
      const gap = missing(total, have ?? { metal: 0, crystal: 0, deuterium: 0 });
      const plan = loadPlan(o.store);
      let planned = true;
      for (let l = start.level; l <= to; l++) planned &&= inPlan(plan, o.bodyId, details.id, l);
      const ms = (l: number) => (details.durationMs ? scaleDuration(details.id, start.level, details.durationMs, l) : 0);
      let sumMs = 0;
      for (let l = start.level; l <= to; l++) sumMs += ms(l);

      const prev = button(doc, 'fut-tp-btn', ICON.prev, t('tech.prev'), () => {
        to = Math.max(start.level, to - 1);
        draw();
      });
      prev.disabled = to <= start.level;
      const reset = button(doc, 'fut-tp-btn', ICON.reset, t('tech.reset'), () => {
        to = start.level;
        draw();
      });
      reset.disabled = to <= start.level;
      const next = button(doc, 'fut-tp-btn', ICON.next, t('tech.next'), () => {
        to += 1;
        draw();
      });
      const add = button(doc, planned ? 'fut-tp-btn fut-tp-plan on' : 'fut-tp-btn fut-tp-plan', ICON.plan, '', () => {
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
      });
      add.title = planned
        ? `${t('tech.inPlan')} · ${t('tech.removeHint')}`
        : to > start.level
          ? t('tech.addRange', { from: start.level, to })
          : t('tech.addOne', { level: to });
      tools.replaceChildren(prev, reset, next, add);

      // The game's "Livello 45" becomes the range, as OGLight does.
      if (levelLabel) levelLabel.textContent = `${start.level - 1} → ${to}`;
      const view: View = {
        heads: [t('tech.colLevel', { level: to }), t('tech.rangeShort', { from: start.level - 1, to }), t('tech.colMissing')],
        cols: [{ cost: one }, { cost: total, cls: 'fut-tp-sum' }, { cost: gap, short: true }],
      };
      const row = el(doc, 'div', 'fut-tp-chips');
      if (details.durationMs) {
        row.append(
          chip(
            doc,
            ICON.time,
            to > start.level ? `${formatDuration(ms(to))} · Σ ${formatDuration(sumMs)}` : formatDuration(ms(to)),
            to > start.level ? t('tech.timeHint', { level: to, from: start.level, to }) : t('tech.time'),
          ),
        );
      }
      row.append(...chips);
      if (start.discount > 0.0005) row.append(chip(doc, '', t('tech.discountShort', { pct: (start.discount * 100).toFixed(1) }), t('tech.discount', { pct: (start.discount * 100).toFixed(1) }), 'fut-tp-disc'));
      box.replaceChildren(grid(o, view, have !== null), row);
    };
    draw();
  } else {
    // Ships and defences: our own amount, free from what can be paid now (the game's field
    // stops at what the resources allow, the plan does not).
    const unit = matchShownLevel(details.id, [1], details.shown);
    const discount = unit?.discount ?? 0;
    const amount = el(doc, 'input', 'fut-tp-amount');
    amount.type = 'text';
    amount.inputMode = 'numeric';
    amount.value = String(Math.max(1, Math.floor(Number(details.amountInput?.value) || 1)));
    amount.title = t('tech.amountHint');
    // Keys typed here are ours: the game must not catch them (shortcuts, Enter = build).
    for (const type of ['keydown', 'keyup', 'keypress']) amount.addEventListener(type, (e) => e.stopPropagation());
    const amountOf = () => Math.max(1, Math.floor(Number(amount.value.replace(/\D/g, '')) || 1));
    let added = false;
    const draw = () => {
      const n = amountOf();
      const one = levelCost(details.id, 1, discount);
      const total = scaleCost(one, n);
      const have = o.have();
      const gap = missing(total, have ?? { metal: 0, crystal: 0, deuterium: 0 });
      const add = button(doc, added ? 'fut-tp-btn fut-tp-plan on' : 'fut-tp-btn fut-tp-plan', ICON.plan, t('tech.addUnits', { n: n.toLocaleString(locale) }), () => {
        const item: PlanItem = { id: details.id, amount: n, name: details.name, cost: total, added: Date.now() };
        o.store.set(PLAN_KEY, addToPlan(loadPlan(o.store), o.bodyId, [item]));
        o.onPlanChange?.();
        added = true;
        draw();
      });
      if (added) add.title = t('tech.added');
      tools.replaceChildren(amount, add);
      const view: View = {
        heads: [t('tech.colOne'), `×${n.toLocaleString(locale)}`, t('tech.colMissing')],
        cols: [{ cost: one }, { cost: total, cls: 'fut-tp-sum' }, { cost: gap, short: true }],
      };
      const row = el(doc, 'div', 'fut-tp-chips');
      if (details.durationMs) row.append(chip(doc, ICON.time, `${formatDuration(details.durationMs)} · Σ ${formatDuration(details.durationMs * n)}`, t('tech.time')));
      row.append(...chips);
      box.replaceChildren(grid(o, view, have !== null), row);
    };
    amount.addEventListener('input', () => {
      added = false;
      // Redraw only the panel: the field keeps its focus.
      const keep = amount.selectionStart;
      draw();
      amount.focus();
      if (keep !== null) amount.setSelectionRange(keep, keep);
    });
    draw();
    // The game's own field (and its max button) still drives ours.
    const input = details.amountInput;
    const follow = () =>
      setTimeout(() => {
        amount.value = String(Math.max(1, Math.floor(Number(input?.value) || 1)));
        draw();
      }, 0);
    if (input) {
      for (const type of ['input', 'change', 'keyup']) input.addEventListener(type, follow);
      input.parentElement?.querySelector('.maximum')?.addEventListener('click', follow);
    }
  }

  // Like OGLight: tools over the picture, the grid where the game lists costs and details.
  details.root.classList.add('fut-tp-on');
  const sprite = details.root.querySelector('.sprite, .sprite_large');
  (sprite ?? details.root).append(tools);
  const content = details.root.querySelector('.content') ?? details.root;
  content.append(box);
  if (levelLabel && !levelLabel.dataset.futText) levelLabel.dataset.futText = levelText.trim();
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
  // "Sviluppa" (in the panel or on the list), also with dark matter: the started level, or
  // the units ordered, leave the plan at once. The page reload after it prunes again.
  doc.addEventListener(
    'click',
    (e) => {
      const b = (e.target as Element | null)?.closest?.<HTMLButtonElement>('#technologydetails .build-it_wrap button, #technologies button.upgrade[data-technology]');
      if (!b || b.disabled) return;
      const id = Number(b.getAttribute('data-technology') ?? readTechDetails(doc)?.id);
      if (!id) return;
      const entry = readTechList(doc).find((x) => x.id === id);
      const amountInput = doc.querySelector<HTMLInputElement>('#technologydetails #build_amount');
      const change = isLevelled(id)
        ? startBuild(loadPlan(o.store), o.bodyId, id, { level: (entry?.level ?? 0) + 1 })
        : startBuild(loadPlan(o.store), o.bodyId, id, { amount: Math.max(1, Math.floor(Number(amountInput?.value) || 1)) });
      if (change.changed) {
        o.store.set(PLAN_KEY, change.plan);
        o.onPlanChange?.();
      }
    },
    true,
  );
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
