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
import { DELIVERY_KEY, nextBody, type Delivery } from '../../engines/fleet';
import { repeatUrl } from '../fleet/repeat';
import { pendingFor, prunePending, SENT_KEY, type PlanItem, type Shipment } from '../../engines/planner';
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
  /** Current page URL and page change, for "Porta qui le risorse" (a normal navigation). */
  href?: string;
  navigate?: (url: string) => void;
}

/** Items of one tech next to each other become one row ("liv. 46–49"). */
export interface PlanGroup {
  id: number;
  name: string;
  from?: number;
  to?: number;
  amount?: number;
  cost: Cost;
  indexes: number[];
}

export function groupItems(items: PlanItem[]): PlanGroup[] {
  const out: PlanGroup[] = [];
  items.forEach((item, index) => {
    const last = out[out.length - 1];
    if (last && item.level !== undefined && last.id === item.id && last.to !== undefined && item.level === last.to + 1) {
      last.to = item.level;
      last.cost = addCost(last.cost, item.cost);
      last.indexes.push(index);
      return;
    }
    out.push({ id: item.id, name: item.name, from: item.level, to: item.level, amount: item.amount, cost: { ...item.cost }, indexes: [index] });
  });
  return out;
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
  /** When the resources we have for a body were read. */
  const seenAt = (id: number) => (o.current && o.current.id === id ? o.now : (byId.get(id)?.resourcesAt ?? 0));
  const timeOf = (ms: number) => new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
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
    const allSent = o.store.get<Shipment[]>(SENT_KEY, []);
    const sent = prunePending(allSent, plan, seenAt);
    if (sent.length !== allSent.length) o.store.set(SENT_KEY, sent);
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
    const refs = o.entries.map((e) => ({ planetId: e.planetId, moonId: e.moonId }));
    const triple = (cost: Cost, cls = '') => {
      const box = h('span', `triple ${cls}`);
      for (const [key, c] of [
        ['metal', 'm'],
        ['crystal', 'c'],
        ['deuterium', 'd'],
      ] as const) {
        const v = h('span', `num ${c}`, cost[key] ? fmt(cost[key]) : '—');
        v.title = `${t(`tech.res.${key}`)}: ${Math.round(cost[key]).toLocaleString(locale)}`;
        box.append(v);
      }
      return box;
    };
    for (const body of bodies) {
      const items = plan[String(body.id)];
      if (!items?.length) continue;
      const total = planTotal(items);
      const have = haveOf(body.id);
      const pending = pendingFor(sent, body.id, seenAt(body.id));
      const pendingSum = pending.metal + pending.crystal + pending.deuterium;
      // What was sent counts as here: only the rest is missing.
      const gap = have
        ? planMissing(items, { metal: have.metal + pending.metal, crystal: have.crystal + pending.crystal, deuterium: have.deuterium + pending.deuterium })
        : null;
      const short = gap ? gap.metal + gap.crystal + gap.deuterium : 0;
      grand = addCost(grand, total);
      if (gap) grandMissing = addCost(grandMissing, gap);
      const card = h('div', 'card');
      const top = h('div', 'card-head');
      const title = h('div', 'card-title');
      title.append(h('h3', '', body.label), h('span', 'count', t('plan.items', { n: items.length })));
      const acts = h('div', 'card-acts');
      if (gap && short > 0 && o.navigate && o.href) {
        const bring = h('button', 'act', pendingSum > 0 ? t('plan.complete') : t('plan.bring'));
        bring.title = t('plan.bringHint');
        bring.addEventListener('click', () => {
          const here = o.current?.id ?? null;
          const source = here !== null && here !== body.id ? here : nextBody(refs, here ?? body.id, { skip: body.id });
          if (!source) return;
          const delivery: Delivery = { target: body.id, need: { metal: Math.ceil(gap.metal), crystal: Math.ceil(gap.crystal), deuterium: Math.ceil(gap.deuterium) } };
          o.store.set(DELIVERY_KEY, delivery);
          o.navigate!(repeatUrl(o.href!, source, { mode: 'plan', first: source, dest: body.id }));
        });
        acts.append(bring);
      }
      const clear = h('button', 'act ghost', t('plan.clear'));
      clear.addEventListener('click', () => save(clearBody(plan, body.id)));
      acts.append(clear);
      top.append(title, acts);

      const sums = h('div', 'sums');
      const sumBox = (label: string, cost: Cost | null, cls: string) => {
        const b = h('div', `sum ${cls}`);
        b.append(h('span', 'label', label));
        if (cost) b.append(triple(cost, cls === 'warn' ? 'short' : ''));
        return b;
      };
      sums.append(sumBox(t('plan.total'), total, ''));
      if (pendingSum > 0) {
        const box = sumBox(
          pending.arriveAt > o.now ? t('plan.sentArriving', { time: timeOf(pending.arriveAt) }) : t('plan.sentArrived'),
          { ...pending, energy: 0 },
          'sent',
        );
        sums.append(box);
      }
      if (gap) {
        if (short > 0) sums.append(sumBox(pendingSum > 0 ? t('plan.missingAfterSent') : t('plan.missingHere'), gap, 'warn'));
        else sums.append(sumBox(pendingSum > 0 ? t('plan.allSent') : t('plan.ready'), null, 'ok'));
      } else sums.append(sumBox(t('plan.unknownHere'), null, 'muted'));

      const rows = h('div', 'rows');
      for (const g of groupItems(items)) {
        const row = h('div', 'row');
        const name = h('span', 'name');
        const what =
          g.amount !== undefined
            ? `×${g.amount.toLocaleString(locale)}`
            : g.from === g.to
              ? t('plan.level', { level: g.from ?? 0 })
              : t('plan.levels', { from: g.from ?? 0, to: g.to ?? 0 });
        name.append(h('span', '', g.name), h('span', 'lv', what));
        const remove = h('button', 'x', '×');
        remove.title = t('plan.remove');
        remove.addEventListener('click', () => {
          let next = plan;
          for (const i of [...g.indexes].reverse()) next = removeFromPlan(next, body.id, i);
          save(next);
        });
        row.append(name, triple(g.cost), remove);
        rows.append(row);
      }
      card.append(top, sums, rows);
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
