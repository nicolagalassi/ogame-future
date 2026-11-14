/**
 * Construction plan window, one line per technology: "Miniera di metallo × 13 pianeti" with the
 * sum, opening onto one row per planet. On top: the plan's cost, what the whole account holds and
 * what the account still misses (that is what the plan is for). Each number is shown once; red
 * where that planet lacks it. The game's picture next to each name.
 * Shadow DOM, like the dashboard. Data already stored only: no network, no game action.
 */
import { icon } from '../../core/icons';
import { WINDOW_SHEET } from '../../core/sheet';
import type { Store } from '../../core/storage';
import type { AccountSnapshot } from '../../data/account-info';
import type { PlanetListEntry } from '../../data/planet-list';
import { formatUnits } from '../../core/format';
import { estimateResources } from '../../engines/resources';
import { accountGap, clearBody, groupByTech, PLAN_KEY, planMissing, removeFromPlan, type Plan, type TechGroup, type TechRow } from '../../engines/planner';
import { techIconEl, techIcons } from '../../data/tech-icons';
import type { Cost } from '../../engines/tech';
import { PLANNER_CSS } from './style';
import { DELIVERY_KEY, nextBody, type Delivery } from '../../engines/fleet';
import { repeatUrl } from '../fleet/repeat';
import { dropQueued, lessReserved, pendingFor, planStatus, prunePending, QUEUED_KEY, reservedFor, SENT_KEY, withQueued, type PlanItem, type PlanState, type Queued, type Shipment } from '../../engines/planner';

type Res = { metal: number; crystal: number; deuterium: number };
const RES = [['metal', 'm'], ['crystal', 'c'], ['deuterium', 'd']] as const;
/** Technologies opened onto their planets (others: open when on 3 planets or fewer). */
const toggled = new Set<number>();
/** The plan by planet (what to carry where) or by technology (what it costs over the account). */
let view: 'body' | 'tech' = 'body';
/** Rows picked in the planet view: body id → indexes in its list. Emptied when the plan changes. */
const picked = new Map<number, Set<number>>();
/** Planets opened onto their rows in the planet view (only those with more than one thing planned). */
const opened = new Set<number>();
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
  /** The body whose badge opened the plan: shown first, highlighted, its send button focused. */
  focus?: number;
  /** Current page URL and page change, for "Porta qui le risorse" (a normal navigation). */
  href?: string;
  navigate?: (url: string) => void;
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

/**
 * What the whole account holds: every body's resources (the one on screen read from the page, the
 * others estimated from the last sync) plus what is on its way to a planned body. Null without a sync.
 */
export function accountResources(bodies: { id: number }[], haveOf: (id: number) => Res | null, inFlight: Res): Res | null {
  if (!bodies.length) return null;
  const sum = { ...inFlight };
  for (const b of bodies) {
    const r = haveOf(b.id);
    if (!r) continue;
    sum.metal += r.metal;
    sum.crystal += r.crystal;
    sum.deuterium += r.deuterium;
  }
  return sum;
}

export function openPlanner(o: PlannerOptions): void {
  const { doc, t, locale } = o;
  closePlanner(doc);
  const host = doc.createElement('div');
  host.id = PLANNER_ID;
  const root = host.attachShadow({ mode: 'open' });
  const style = h('style');
  style.textContent = WINDOW_SHEET + PLANNER_CSS;
  const backdrop = h('div', 'backdrop');
  const panel = h('div', 'panel');
  backdrop.append(panel);
  root.append(style, backdrop);
  doc.body.append(host);

  const fmt = (n: number) => formatUnits(n, locale);
  const byId = new Map((o.snapshot?.bodies ?? []).map((b) => [b.id, b]));
  const stock = (id: number): Res | null => {
    if (o.current && o.current.id === id) return o.current.resources;
    const body = byId.get(id);
    return body ? estimateResources(body, o.now) : null;
  };
  /** When the resources we have for a body were read. */
  const seenAt = (id: number) => (o.current && o.current.id === id ? o.now : (byId.get(id)?.resourcesAt ?? 0));
  const timeOf = (ms: number) => new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const icons = techIcons(doc, o.store);
  let confirmClear = false;
  /** The focused body is scrolled to and its button focused once, on opening. */
  let focusPending = o.focus !== undefined;
  if (o.focus !== undefined) {
    view = 'body';
    opened.add(o.focus);
  }

  const labels = new Map<number, string>();
  for (const e of o.entries) {
    if (e.planetId) labels.set(e.planetId, `${e.name} [${e.coords}]`);
    if (e.moonId) labels.set(e.moonId, `${t('plan.moonOf', { name: e.name })} [${e.coords}]`);
  }
  const labelOf = (id: number) => labels.get(id) ?? `#${id}`;
  /** Planets in the game's own order (planet list), unknown ones last. */
  const order = new Map([...labels.keys()].map((id, i) => [id, i]));
  const byList = (a: TechRow, b: TechRow) => (order.get(a.bodyId) ?? 1e9) - (order.get(b.bodyId) ?? 1e9);
  const refs = o.entries.map((e) => ({ planetId: e.planetId, moonId: e.moonId }));

  /** Three numbers; red (with the amount in the tooltip) where `short` says this planet lacks it. */
  const triple = (cost: Cost, short?: Cost | null) => {
    const out: HTMLElement[] = [];
    for (const [key, c] of RES) {
      const lack = short ? short[key] : 0;
      const v = h('span', `num ${c}${lack > 0 ? ' short' : ''}`, cost[key] ? fmt(cost[key]) : '—');
      v.title = `${t(`tech.res.${key}`)}: ${Math.round(cost[key]).toLocaleString(locale)}${lack > 0 ? ` · ${t('plan.lacksHere', { n: fmt(lack) })}` : ''}`;
      out.push(v);
    }
    return out;
  };
  const what = (r: { from?: number; to?: number; amount?: number }) =>
    r.amount !== undefined ? `×${r.amount.toLocaleString(locale)}` : r.from === r.to ? t('plan.level', { level: r.from ?? 0 }) : t('plan.levels', { from: r.from ?? 0, to: r.to ?? 0 });

  const draw = () => {
    const plan = o.store.get<Plan>(PLAN_KEY, {});
    const allSent = o.store.get<Shipment[]>(SENT_KEY, []);
    const sent = prunePending(allSent, plan, seenAt);
    if (sent.length !== allSent.length) o.store.set(SENT_KEY, sent);
    const save = (next: Plan) => {
      // Indexes shift when rows leave: a pick made before would point at another row.
      picked.clear();
      o.store.set(PLAN_KEY, next);
      o.onChange?.();
      draw();
    };
    const queued = o.store.get<Queued>(QUEUED_KEY, {});
    const pendingOf = (id: number) => pendingFor(sent, id, seenAt(id));
    /** What a body holds that is free: levels queued in the game keep theirs until they start. */
    const freeOf = (id: number): Res | null => {
      const r = stock(id);
      return r ? lessReserved(r, reservedFor(queued, id)) : null;
    };
    // What a body holds, what was sent to it counted as there.
    const haveOf = (id: number): Res | null => {
      const r = freeOf(id);
      if (!r) return null;
      const p = pendingOf(id);
      return { metal: r.metal + p.metal, crystal: r.crystal + p.crystal, deuterium: r.deuterium + p.deuterium };
    };
    const inFlight = Object.keys(plan).reduce<Res>((s, k) => {
      const p = pendingOf(Number(k));
      return { metal: s.metal + p.metal, crystal: s.crystal + p.crystal, deuterium: s.deuterium + p.deuterium };
    }, { metal: 0, crystal: 0, deuterium: 0 });
    const account = accountResources(o.snapshot?.bodies ?? [], stock, inFlight);
    // Queued levels: their resources are still counted in the account, so their cost is too.
    const { total, missing } = accountGap(withQueued(plan, queued), account);
    const groups = groupByTech(plan, haveOf);

    const head = h('div', 'head');
    const titles = h('div', 'titles');
    titles.append(h('h2', '', t('plan.title')), h('span', 'sub', t('plan.sub')));
    head.append(titles);
    if (groups.length) {
      const clear = h('button', `act ghost${confirmClear ? ' danger' : ''}`, confirmClear ? t('plan.clearConfirm') : t('plan.clearAll'));
      clear.type = 'button';
      clear.addEventListener('click', () => {
        if (!confirmClear) {
          confirmClear = true;
          return draw();
        }
        confirmClear = false;
        save({});
      });
      head.append(clear);
    }
    const close = h('button', 'close');
    close.type = 'button';
    close.append(icon(doc, 'close', 16));
    close.title = t('fleet.close');
    close.addEventListener('click', () => closePlanner(doc));
    head.append(close);

    if (!groups.length) {
      panel.replaceChildren(head, h('p', 'empty', t('plan.empty')));
      return;
    }

    // Plan, account, what the account misses.
    const kpis = h('div', 'kpis');
    const kpi = (label: string, cost: Cost | Res | null, cls: string, note?: string) => {
      const box = h('div', `kpi ${cls}`);
      box.append(h('span', 'label', label));
      const line = h('div', 'kpi-line');
      if (cost) for (const [key, c] of RES) {
        const v = h('span', `num ${c}`, fmt(cost[key]));
        v.title = Math.round(cost[key]).toLocaleString(locale);
        line.append(v);
      } else line.append(h('span', 'num', '?'));
      box.append(line);
      if (note) box.append(h('span', 'note', note));
      return box;
    };
    const covered = missing && missing.metal + missing.crystal + missing.deuterium === 0;
    kpis.append(
      kpi(t('plan.grandTotal'), total, ''),
      kpi(t('plan.account'), account, '', account ? t('plan.accountNote') : t('plan.accountUnknown')),
      covered ? kpi(t('plan.accountCovered'), null, 'ok') : kpi(t('plan.accountMissing'), missing, 'warn'),
    );
    if (covered) kpis.lastElementChild!.querySelector('.kpi-line')!.replaceChildren(h('span', 'num okv', '✓'));

    const seg = h('div', 'seg');
    seg.setAttribute('role', 'group');
    for (const v of ['body', 'tech'] as const) {
      const b = h('button', '', t(v === 'body' ? 'plan.byBody' : 'plan.byTech'));
      b.type = 'button';
      b.dataset.view = v;
      b.setAttribute('aria-pressed', String(view === v));
      b.addEventListener('click', () => {
        view = v;
        draw();
      });
      seg.append(b);
    }
    const list = h('div', 'groups');
    if (view === 'tech') for (const g of groups) list.append(groupTile(g, plan, haveOf, pendingOf, save));
    else {
      // Grouped by where each body stands, so what still needs a transport comes first; the body
      // whose badge opened the window leads its group, and its group leads the list.
      const ids = Object.keys(plan).map(Number).sort((a, b) => (a === o.focus ? -1 : b === o.focus ? 1 : 0) || (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9));
      const stateOf = (id: number): PlanState => planStatus(plan[String(id)] ?? [], freeOf(id), pendingOf(id), o.now).state;
      const sections: { key: string; states: PlanState[]; numbers: 'gap' | 'cost' }[] = [
        { key: 'missing', states: ['missing'], numbers: 'gap' },
        { key: 'arriving', states: ['arriving', 'arrived'], numbers: 'cost' },
        { key: 'unknown', states: ['unknown'], numbers: 'cost' },
        { key: 'ready', states: ['ready'], numbers: 'cost' },
      ];
      const states = new Map(ids.map((id) => [id, stateOf(id)]));
      const focusState = o.focus !== undefined ? states.get(o.focus) : undefined;
      if (focusState) sections.sort((a, b) => Number(b.states.includes(focusState)) - Number(a.states.includes(focusState)));
      for (const sec of sections) {
        const here = ids.filter((id) => sec.states.includes(states.get(id)!));
        if (!here.length) continue;
        const bar = h('div', `sec sec-${sec.key}`);
        bar.append(h('span', 'sec-name', `${t(`plan.sec.${sec.key}`)} · ${here.length}`), h('span', 'sec-col', t(sec.numbers === 'gap' ? 'plan.colMissing' : 'plan.colCost')));
        list.append(bar);
        for (const id of here) list.append(bodyTile(id, plan, haveOf, pendingOf, save, sec.numbers, queued));
      }
    }
    panel.replaceChildren(head, kpis, seg, list);
    if (focusPending) {
      focusPending = false;
      const tile = list.querySelector<HTMLElement>(`.group.body[data-body="${o.focus}"]`);
      tile?.scrollIntoView?.({ block: 'nearest' });
      // The send button takes the focus: Enter prepares the transport.
      (tile?.querySelector<HTMLElement>('.bring-all') ?? tile)?.focus?.();
    }
  };

  /** Opens the fleet page on a source body with a transport of `need` towards `target` prepared (the player sends it). */
  const bringTo = (target: number, need: Res) => {
    const here = o.current?.id ?? null;
    const source = here !== null && here !== target ? here : nextBody(refs, here ?? target, { skip: target });
    if (!source || !o.navigate || !o.href) return;
    const delivery: Delivery = { target, need: { metal: Math.ceil(need.metal), crystal: Math.ceil(need.crystal), deuterium: Math.ceil(need.deuterium) } };
    o.store.set(DELIVERY_KEY, delivery);
    o.navigate(repeatUrl(o.href, source, { mode: 'plan', first: source, dest: target }));
  };
  const sentMark = (p: Res & { arriveAt: number }) => {
    const mark = h('span', 'sent');
    mark.append(icon(doc, 'fleet', 12));
    mark.title = `${p.arriveAt > o.now ? t('plan.sentArriving', { time: timeOf(p.arriveAt) }) : t('plan.sentArrived')}: ${fmt(p.metal)} · ${fmt(p.crystal)} · ${fmt(p.deuterium)}`;
    return mark;
  };

  /**
   * One planet or moon: what its plan costs and one button that carries there everything it lacks.
   * A click on its rows picks them: the button then carries only what those rows need.
   */
  const bodyTile = (bodyId: number, plan: Plan, haveOf: (id: number) => Res | null, pendingOf: (id: number) => Res & { arriveAt: number }, save: (p: Plan) => void, numbers: 'gap' | 'cost', queued: Queued) => {
    const items = plan[String(bodyId)] ?? [];
    const waiting = queued[String(bodyId)] ?? [];
    const have = haveOf(bodyId);
    const chosen = picked.get(bodyId) ?? new Set<number>();
    // Consecutive levels of one technology read as one row ("liv. 46–48").
    const rows: { id: number; name: string; from?: number; to?: number; amount?: number; cost: Cost; indexes: number[] }[] = [];
    items.forEach((item, index) => {
      const last = rows[rows.length - 1];
      if (last && last.id === item.id && item.level !== undefined && last.to !== undefined && item.level === last.to + 1) {
        last.to = item.level;
        last.cost = { metal: last.cost.metal + item.cost.metal, crystal: last.cost.crystal + item.cost.crystal, deuterium: last.cost.deuterium + item.cost.deuterium, energy: last.cost.energy };
        last.indexes.push(index);
      } else rows.push({ id: item.id, name: item.name, from: item.level, to: item.level, amount: item.amount, cost: { ...item.cost }, indexes: [index] });
    });
    const scope = chosen.size ? items.filter((_, i) => chosen.has(i)) : items;
    const total = items.reduce<Cost>((sum, i) => ({ metal: sum.metal + i.cost.metal, crystal: sum.crystal + i.cost.crystal, deuterium: sum.deuterium + i.cost.deuterium, energy: 0 }), { metal: 0, crystal: 0, deuterium: 0, energy: 0 });
    const gapAll = have ? planMissing(items, have) : null;
    const gap = have ? planMissing(scope, have) : null;
    const short = gap ? gap.metal + gap.crystal + gap.deuterium : 0;

    const toggle = (r: { indexes: number[] }, on: boolean) => {
      const next = new Set(chosen);
      for (const i of r.indexes) on ? next.delete(i) : next.add(i);
      if (next.size) picked.set(bodyId, next);
      else picked.delete(bodyId);
      draw();
    };
    const isOn = (r: { indexes: number[] }) => r.indexes.every((i) => chosen.has(i));
    /** "46", "46–48", "×100": the level or amount, as short as it gets. */
    const brief = (r: { from?: number; to?: number; amount?: number }) =>
      r.amount !== undefined ? `×${fmt(r.amount)}` : r.from === r.to ? String(r.from ?? 0) : `${r.from ?? 0}–${r.to ?? 0}`;

    // One line per planet: who, what (a picture and a level per planned thing), what it costs, the button.
    const tile = h('div', `group body${bodyId === o.focus ? ' focus' : ''}`);
    tile.dataset.body = String(bodyId);
    tile.tabIndex = -1;
    const top = h('div', 'ghead');
    const name = h('div', 'gname');
    const label = h('span', 'gtitle');
    if (byId.get(bodyId)?.type === 'moon') label.append(icon(doc, 'moon', 11));
    label.append(labelOf(bodyId));
    name.append(label);
    const chips = h('div', 'pchips');
    for (const r of rows) {
      const on = isOn(r);
      const chip = h('button', 'pchip');
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(on));
      chip.title = `${r.name} · ${what(r)} · ${fmt(r.cost.metal)} / ${fmt(r.cost.crystal)} / ${fmt(r.cost.deuterium)} — ${t('plan.pickHint')}`;
      chip.setAttribute('aria-label', `${r.name} ${what(r)}`);
      chip.append(techIconEl(doc, icons[String(r.id)], 20), h('span', '', brief(r)));
      chip.addEventListener('click', () => toggle(r, on));
      chips.append(chip);
    }
    // Levels queued in the game: not in the plan any more, but their resources are held back here.
    for (const q of waiting) chips.append(queuedChip(q));
    const many = rows.length + waiting.length > 1;
    const open = many && opened.has(bodyId);
    if (many) {
      const caret = h('button', 'ib');
      caret.type = 'button';
      caret.setAttribute('aria-expanded', String(open));
      caret.title = t(open ? 'plan.collapse' : 'plan.expand');
      caret.setAttribute('aria-label', caret.title);
      const mark = icon(doc, 'chevron', 13);
      if (open) mark.style.transform = 'rotate(180deg)';
      caret.append(mark);
      caret.addEventListener('click', () => {
        if (open) opened.delete(bodyId);
        else opened.add(bodyId);
        draw();
      });
      chips.append(caret);
    }
    // "To supply": what is missing, the amount the button carries. Otherwise: what it costs.
    if (numbers === 'gap' && gapAll) top.append(name, chips, ...triple(gapAll, gapAll));
    else top.append(name, chips, ...triple(total, gapAll));
    const acts = h('div', 'acts');
    const p = pendingOf(bodyId);
    const onWay = p.metal + p.crystal + p.deuterium > 0;
    if (onWay) acts.append(sentMark(p));
    if (gap && short > 0 && o.navigate && o.href) {
      const bring = h('button', 'bring-all');
      bring.type = 'button';
      bring.append(icon(doc, 'swap', 13), h('span', '', chosen.size ? t('plan.bringSome', { n: chosen.size }) : onWay ? t('plan.complete') : t('plan.bringAll')));
      bring.title = `${fmt(gap.metal)} · ${fmt(gap.crystal)} · ${fmt(gap.deuterium)} — ${t('plan.bringHint')}`;
      bring.addEventListener('click', () => bringTo(bodyId, gap));
      acts.append(bring);
    } else if (gap) {
      const ok = h('span', 'okmark');
      ok.append(icon(doc, 'check', 12));
      ok.title = t('plan.readyHere');
      acts.append(ok);
    }
    const remove = h('button', 'x');
    remove.type = 'button';
    remove.append(icon(doc, 'close', 13));
    remove.title = t('plan.removeBody');
    remove.setAttribute('aria-label', `${remove.title}: ${labelOf(bodyId)}`);
    remove.addEventListener('click', () => save(clearBody(plan, bodyId)));
    acts.append(remove);
    top.append(acts);
    tile.append(top);

    // More than one thing planned here: the arrow opens them one per line, each with its own cost.
    if (open) {
      const list = h('div', 'grows');
      for (const r of rows) {
        const on = isOn(r);
        const row = h('div', `grow pick${on ? ' on' : ''}`);
        const pick = h('button', 'gbody');
        pick.type = 'button';
        pick.title = t('plan.pickHint');
        pick.setAttribute('aria-pressed', String(on));
        pick.append(techIconEl(doc, icons[String(r.id)], 20), h('span', '', r.name), h('span', 'lv', what(r)));
        pick.addEventListener('click', () => toggle(r, on));
        row.append(pick, h('span'), ...triple(r.cost));
        const a = h('div', 'acts');
        const x = h('button', 'x');
        x.type = 'button';
        x.append(icon(doc, 'close', 13));
        x.title = t('plan.remove');
        x.setAttribute('aria-label', `${t('plan.remove')}: ${r.name}`);
        x.addEventListener('click', () => {
          let next = plan;
          for (const i of [...r.indexes].reverse()) next = removeFromPlan(next, bodyId, i);
          save(next);
        });
        a.append(x);
        row.append(a);
        list.append(row);
      }
      waiting.forEach((q, index) => {
        const row = h('div', 'grow queued');
        const label = h('span', 'gbody');
        label.append(techIconEl(doc, icons[String(q.id)], 20), h('span', '', q.name), h('span', 'lv', what({ from: q.level, to: q.level })), h('span', 'qtag', t('plan.queued')));
        label.title = t('plan.queuedHint');
        row.append(label, h('span'), ...triple(q.cost));
        const a = h('div', 'acts');
        const x = h('button', 'x');
        x.type = 'button';
        x.append(icon(doc, 'close', 13));
        x.title = t('plan.unhold');
        x.setAttribute('aria-label', `${t('plan.unhold')}: ${q.name}`);
        x.addEventListener('click', () => {
          o.store.set(QUEUED_KEY, dropQueued(o.store.get<Queued>(QUEUED_KEY, {}), bodyId, index));
          o.onChange?.();
          draw();
        });
        a.append(x);
        row.append(a);
        list.append(row);
      });
      tile.append(list);
    }
    return tile;
  };

  /** A level waiting in the game's queue: dashed, not pickable, its cost in the tooltip. */
  const queuedChip = (q: PlanItem & { level: number }) => {
    const chip = h('span', 'pchip qchip');
    chip.title = `${q.name} · ${t('plan.level', { level: q.level })} · ${t('plan.queued')} — ${t('plan.queuedHint')} (${fmt(q.cost.metal)} / ${fmt(q.cost.crystal)} / ${fmt(q.cost.deuterium)})`;
    chip.append(techIconEl(doc, icons[String(q.id)], 20), h('span', '', String(q.level)));
    return chip;
  };

  const groupTile = (g: TechGroup, plan: Plan, haveOf: (id: number) => Res | null, pendingOf: (id: number) => Res & { arriveAt: number }, save: (p: Plan) => void) => {
    const tile = h('div', 'group');
    const one = g.rows.length === 1 ? g.rows[0]! : null;
    const open = one ? false : toggled.has(g.id) ? g.rows.length > 3 : g.rows.length <= 3;
    const top = h('div', 'ghead');
    const name = h('div', 'gname');
    const titleLine = h('span', 'gtitle', g.name);
    const meta = h('span', 'gmeta', one ? `${labelOf(one.bodyId)} · ${what(one)}` : t('plan.onBodies', { n: g.rows.length }) + ' · ' + levelsSummary(g.rows));
    name.append(titleLine, meta);
    top.append(techIconEl(doc, icons[String(g.id)], 28), name, ...triple(g.cost, one?.short));
    const acts = h('div', 'acts');
    if (one) acts.append(...rowActions(one, plan, haveOf, pendingOf, save));
    else {
      const caret = h('button', 'ib');
      caret.type = 'button';
      caret.setAttribute('aria-expanded', String(open));
      caret.title = t(open ? 'plan.collapse' : 'plan.expand');
      caret.textContent = open ? '▴' : '▾';
      const flip = () => {
        if (toggled.has(g.id)) toggled.delete(g.id);
        else toggled.add(g.id);
        draw();
      };
      caret.addEventListener('click', flip);
      top.classList.add('clickable');
      name.addEventListener('click', flip);
      const remove = h('button', 'x');
      remove.type = 'button';
      remove.append(icon(doc, 'close', 13));
      remove.title = t('plan.removeAll', { n: g.rows.length });
      remove.addEventListener('click', () => {
        let next = plan;
        for (const r of g.rows) for (const i of [...r.indexes].reverse()) next = removeFromPlan(next, r.bodyId, i);
        save(next);
      });
      acts.append(caret, remove);
    }
    top.append(acts);
    tile.append(top);
    if (open) {
      const rows = h('div', 'grows');
      for (const r of [...g.rows].sort(byList)) {
        const row = h('div', 'grow');
        const label = h('span', 'gbody');
        label.append(h('span', '', labelOf(r.bodyId)), h('span', 'lv', what(r)));
        row.append(label, ...triple(r.cost, r.short));
        const a = h('div', 'acts');
        a.append(...rowActions(r, plan, haveOf, pendingOf, save));
        row.append(a);
        rows.append(row);
      }
      tile.append(rows);
    }
    return tile;
  };

  const levelsSummary = (rows: TechRow[]) => {
    const levels = rows.flatMap((r) => (r.from !== undefined ? [r.from, r.to ?? r.from] : []));
    if (!levels.length) return `×${rows.reduce((n, r) => n + (r.amount ?? 0), 0).toLocaleString(locale)}`;
    const lo = Math.min(...levels);
    const hi = Math.max(...levels);
    return lo === hi ? t('plan.level', { level: lo }) : t('plan.levels', { from: lo, to: hi });
  };

  /** Sent marker, "bring the resources here" and remove, for one body's row. */
  const rowActions = (r: TechRow, plan: Plan, haveOf: (id: number) => Res | null, pendingOf: (id: number) => Res & { arriveAt: number }, save: (p: Plan) => void) => {
    const out: HTMLElement[] = [];
    const items: PlanItem[] = plan[String(r.bodyId)] ?? [];
    const have = haveOf(r.bodyId);
    const gap = have ? planMissing(items, have) : null;
    const short = gap ? gap.metal + gap.crystal + gap.deuterium : 0;
    const p = pendingOf(r.bodyId);
    if (p.metal + p.crystal + p.deuterium > 0) out.push(sentMark(p));
    if (gap && short > 0 && o.navigate && o.href) {
      const bring = h('button', 'ib bring');
      bring.type = 'button';
      bring.append(icon(doc, 'swap', 13));
      bring.title = `${p.metal + p.crystal + p.deuterium > 0 ? t('plan.complete') : t('plan.bring')} · ${labelOf(r.bodyId)} · ${t('plan.bringHint')}`;
      bring.setAttribute('aria-label', bring.title);
      bring.addEventListener('click', () => bringTo(r.bodyId, gap));
      out.push(bring);
    } else if (gap && short === 0) {
      const ok = h('span', 'okmark');
      ok.append(icon(doc, 'check', 12));
      ok.title = t('plan.readyHere');
      out.push(ok);
    }
    const remove = h('button', 'x');
    remove.type = 'button';
    remove.append(icon(doc, 'close', 13));
    remove.title = t('plan.remove');
    remove.addEventListener('click', () => {
      let next = plan;
      for (const i of [...r.indexes].reverse()) next = removeFromPlan(next, r.bodyId, i);
      save(next);
    });
    out.push(remove);
    return out;
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
