/**
 * Construction plan window: every planet and moon with what the player planned on it, the
 * total cost and what is still missing against the resources Future estimates there.
 * Shadow DOM, like the dashboard. Data already stored only: no network, no game action.
 */
import type { Store } from '../../core/storage';
import type { AccountSnapshot } from '../../data/account-info';
import type { PlanetListEntry } from '../../data/planet-list';
import { formatUnits } from '../../core/format';
import { estimateResources } from '../../engines/resources';
import { clearBody, PLAN_KEY, planMissing, planTotal, removeFromPlan, type Plan } from '../../engines/planner';
import { addCost, ZERO_COST, type Cost } from '../../engines/tech';
import { PLANNER_CSS } from './style';
import type { T } from './index';

export const PLANNER_ID = 'fut-planner';

export interface PlannerOptions {
  doc: Document;
  store: Store;
  entries: PlanetListEntry[];
  snapshot: AccountSnapshot | null;
  /** Resources read from the page for the body on screen (fresher than the snapshot). */
  current: { id: number; resources: { metal: number; crystal: number; deuterium: number } } | null;
  now: number;
  locale: string;
  t: T;
  onChange?: () => void;
}

let keyHandler: ((e: KeyboardEvent) => void) | null = null;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function closePlanner(doc: Document): void {
  doc.getElementById(PLANNER_ID)?.remove();
  if (keyHandler) doc.removeEventListener('keydown', keyHandler, true);
  keyHandler = null;
}

export function openPlanner(o: PlannerOptions): void {
  const { doc, t, locale } = o;
  closePlanner(doc);
  const host = doc.createElement('div');
  host.id = PLANNER_ID;
  const root = host.attachShadow({ mode: 'open' });
  const style = h('style');
  style.textContent = PLANNER_CSS;
  const backdrop = h('div', 'backdrop');
  const panel = h('div', 'panel');
  backdrop.append(panel);
  root.append(style, backdrop);
  doc.body.append(host);

  const fmt = (n: number) => formatUnits(n, locale);
  const byId = new Map((o.snapshot?.bodies ?? []).map((b) => [b.id, b]));
  const haveOf = (id: number) => {
    if (o.current && o.current.id === id) return o.current.resources;
    const body = byId.get(id);
    return body ? estimateResources(body, o.now) : null;
  };
  const costCells = (row: HTMLElement, cost: Cost, cls = '') => {
    for (const [key, c] of [
      ['metal', 'm'],
      ['crystal', 'c'],
      ['deuterium', 'd'],
    ] as const) {
      const cell = h('span', `num ${c} ${cls}`, cost[key] ? fmt(cost[key]) : '—');
      cell.title = Math.round(cost[key]).toLocaleString(locale);
      row.append(cell);
    }
  };

  const draw = () => {
    const plan = o.store.get<Plan>(PLAN_KEY, {});
    const save = (next: Plan) => {
      o.store.set(PLAN_KEY, next);
      o.onChange?.();
      draw();
    };
    const head = h('div', 'head');
    const titles = h('div', 'titles');
    titles.append(h('h2', '', t('plan.title')), h('span', 'sub', t('plan.sub')));
    const close = h('button', 'close', '×');
    close.title = t('fleet.close');
    close.addEventListener('click', () => closePlanner(doc));
    head.append(titles, close);

    const bodies: { id: number; label: string }[] = [];
    for (const e of o.entries) {
      if (e.planetId) bodies.push({ id: e.planetId, label: `${e.name} [${e.coords}]` });
      if (e.moonId) bodies.push({ id: e.moonId, label: `${t('plan.moonOf', { name: e.name })} [${e.coords}]` });
    }
    // Bodies no longer in the list (abandoned planets) are still shown, so nothing is lost.
    for (const key of Object.keys(plan)) if (!bodies.some((b) => String(b.id) === key)) bodies.push({ id: Number(key), label: `#${key}` });

    let grand: Cost = { ...ZERO_COST };
    let grandMissing: Cost = { ...ZERO_COST };
    const cards: HTMLElement[] = [];
    for (const body of bodies) {
      const items = plan[String(body.id)];
      if (!items?.length) continue;
      const total = planTotal(items);
      const have = haveOf(body.id);
      const gap = have ? planMissing(items, have) : null;
      grand = addCost(grand, total);
      if (gap) grandMissing = addCost(grandMissing, gap);
      const card = h('div', 'card');
      const top = h('div', 'card-head');
      const clear = h('button', 'link', t('plan.clear'));
      clear.addEventListener('click', () => save(clearBody(plan, body.id)));
      top.append(h('h3', '', body.label), clear);
      const table = h('div', 'rows');
      const header = h('div', 'row hdr');
      header.append(h('span', '', t('plan.colItem')), h('span', 'num', t('tech.res.metal')), h('span', 'num', t('tech.res.crystal')), h('span', 'num', t('tech.res.deuterium')), h('span'));
      table.append(header);
      items.forEach((item, index) => {
        const row = h('div', 'row');
        const what = item.level !== undefined ? t('plan.level', { level: item.level }) : `×${(item.amount ?? 0).toLocaleString(locale)}`;
        const name = h('span', 'name');
        name.append(h('span', '', item.name), h('span', 'lv', what));
        row.append(name);
        costCells(row, item.cost);
        const remove = h('button', 'x', '×');
        remove.title = t('plan.remove');
        remove.addEventListener('click', () => save(removeFromPlan(plan, body.id, index)));
        row.append(remove);
        table.append(row);
      });
      const sum = h('div', 'row sum');
      sum.append(h('span', '', t('plan.total')));
      costCells(sum, total);
      sum.append(h('span'));
      table.append(sum);
      if (gap) {
        const miss = h('div', 'row miss');
        miss.append(h('span', '', t('plan.missingHere')));
        if (gap.metal + gap.crystal + gap.deuterium > 0) costCells(miss, gap, 'short');
        else {
          const ok = h('span', 'ok', t('plan.ready'));
          ok.style.gridColumn = 'span 3';
          miss.append(ok);
        }
        miss.append(h('span'));
        table.append(miss);
      }
      card.append(top, table);
      cards.push(card);
    }

    const summary = h('div', 'summary');
    if (!cards.length) summary.append(h('p', 'empty', t('plan.empty')));
    else {
      const tile = (label: string, cost: Cost, cls: string) => {
        const box = h('div', `kpi ${cls}`);
        box.append(h('span', 'label', label));
        const line = h('div', 'kpi-line');
        for (const [key, c] of [
          ['metal', 'm'],
          ['crystal', 'c'],
          ['deuterium', 'd'],
        ] as const) {
          const v = h('span', `num ${c}`, fmt(cost[key]));
          v.title = Math.round(cost[key]).toLocaleString(locale);
          line.append(v);
        }
        box.append(line);
        return box;
      };
      summary.append(tile(t('plan.grandTotal'), grand, ''), tile(t('plan.grandMissing'), grandMissing, 'warn'));
    }
    panel.replaceChildren(head, summary, ...cards);
  };

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closePlanner(doc);
  });
  keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closePlanner(doc);
  };
  doc.addEventListener('keydown', keyHandler, true);
  draw();
}
