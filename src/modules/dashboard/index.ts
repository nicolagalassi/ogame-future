/**
 * Dashboard: a window over the page, opened from Future's toolbar, with one tab per area
 * (summary, mines, facilities, lifeforms, ships, defences, scrap calculator).
 * Lives in a Shadow DOM so the game's CSS and ours never fight. It shows data already
 * stored; it makes no network call and sends no game action. Planet names link to the
 * game's own planet pages (a normal click = one navigation, AGENTS.md §1). The scrap tab
 * only calculates: selling stays on the game's own merchant page.
 */
import { icon } from '../../core/icons';
import { WINDOW_SHEET } from '../../core/sheet';
import type { AccountSnapshot, OwnBody } from '../../data/account-info';
import { maxTemperatureOf, type PlanetListEntry } from '../../data/planet-list';
import type { Store } from '../../core/storage';
import type { Score } from '../../data/score';
import { formatUnits } from '../../core/format';
import { accountAlerts, bodyRows, msu, summarize } from '../../engines/account';
import { activeItems, QUEUE_KINDS, queueLabel, type QueueItem, type QueueSnapshot } from '../../data/queues';
import { remaining } from '../planet-menu';
import { amortizationPlan, DEFAULT_RATES, INVEST_KINDS, lfBuildingsMissing, lfSlotsMissing, type AmortStep, type InvestKind, type Rates } from '../../engines/roi';
import type { LfLevels } from '../../data/lf-production';
import { changeOver, type History, type HistoryDay } from '../../engines/history';
import type { Reminder } from '../../engines/reminders';
import { rawCost } from '../../engines/tech';
import {
  DEFENCES, MINES, MOON_FACILITIES, PLANET_FACILITIES, RESEARCH, SHIPS, SPECIES, speciesOf, techName, type TechNames,
} from '../../data/tech-names';
import { activeLfBuildings, activeLfResearch, type ActiveTech, type LfLocked, type LfSlots } from '../../data/lf-slots';
import { shipIcon } from '../messages';
import { SHIP_ICONS } from '../../data/ship-icons';
import { techIconEl, type TechIcon } from '../../data/tech-icons';
import { DASHBOARD_CSS } from './style';

export interface DashboardOptions {
  doc: Document;
  snapshot: AccountSnapshot | null;
  entries: PlanetListEntry[];
  score: Score | null;
  /** One entry per day (engines/history). */
  history?: History;
  /** A reminder bell for one queue item (modules/reminders); none = no bells. */
  bell?: (r: Reminder) => HTMLElement;
  queues?: QueueSnapshot | null;
  /** Technology names learned from the game's pages (player's language). */
  names?: TechNames;
  /** Lifeform research slots seen on the game's page, per planet (see data/lf-slots). */
  lfSlots?: LfSlots;
  /** Species technology bonus from its level, seen on the lifeform settings page. */
  lfLevels?: LfLevels | null;
  /** Lifeform technologies locked by their requirements, per planet (lifeform pages seen). */
  lfLocked?: LfLocked;
  /** Levels seen on the game's technology pages since the last sync, per planet (data/seen-levels). */
  seenLevels?: Record<string, Record<string, number>>;
  /** The game's technology pictures seen so far (data/tech-icons); a missing one falls back to the name. */
  icons?: Record<string, TechIcon>;
  /** Where the trade rates of the build order are kept; none = the default 3 : 2 : 1 for this session. */
  store?: Store;
  now: number;
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

export const TABS = ['summary', 'investments', 'history', 'mines', 'facilities', 'lifeforms', 'ships', 'defence', 'scrap'] as const;
export type Tab = (typeof TABS)[number];

const HOST_ID = 'fut-dashboard';
let tab: Tab = 'summary';
let scrapBody: number | null = null;
let scrapRate = 35;
/** Ships and defences: planets and moons on separate pages. */
let unitScope: 'planet' | 'moon' = 'planet';
let keyHandler: ((e: KeyboardEvent) => void) | null = null;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function isDashboardOpen(doc: Document): boolean {
  return doc.getElementById(HOST_ID) !== null;
}

export function closeDashboard(doc: Document): void {
  doc.getElementById(HOST_ID)?.remove();
  if (keyHandler) doc.removeEventListener('keydown', keyHandler);
  keyHandler = null;
}

/** Bodies in the planet-list order, planet then its moon. */
function orderedBodies(snapshot: AccountSnapshot | null, entries: PlanetListEntry[]): OwnBody[] {
  if (!snapshot) return [];
  const byId = new Map(snapshot.bodies.map((b) => [b.id, b]));
  const list: OwnBody[] = [];
  for (const e of entries) {
    for (const id of [e.planetId, e.moonId]) {
      const b = id ? byId.get(id) : undefined;
      // accountInfo can leave names empty: the game's planet list always has the planet's name.
      if (b) list.push(b.name ? b : { ...b, name: e.name });
    }
  }
  // Bodies the planet list does not show (should not happen) go last.
  const listed = new Set(list.map((b) => b.id));
  for (const b of snapshot.bodies) if (!listed.has(b.id)) list.push(b);
  return list;
}

const level = (b: OwnBody, id: number): number => b.levels[String(id)] ?? 0;
/** The mine each ROI key stands for. */
/** Unit counts: exact up to a million, then short. */
let numLocale = 'it';
const count = (n: number): string => (n < 1e6 ? n.toLocaleString(numLocale) : formatUnits(n, numLocale));

/** Value of a set of units (ships or defences): their cost, the three resources summed 1:1:1. */
export function unitsValue(b: OwnBody, ids: readonly number[]): { value: number; count: number } {
  let total = 0;
  let count = 0;
  for (const id of ids) {
    const n = level(b, id);
    if (!n) continue;
    const c = rawCost(id, 1);
    total += n * (c.metal + c.crystal + c.deuterium);
    count += n;
  }
  return { value: total, count };
}

/** Fleet of all bodies without solar satellites and crawlers, as resources 1:1:1. */
const COMBAT = SHIPS.filter((id) => id !== 212 && id !== 217);
export function fleetValueOf(bodies: readonly OwnBody[]): { value: number; count: number } {
  let out = { value: 0, count: 0 };
  for (const b of bodies) {
    const f = unitsValue(b, COMBAT);
    out = { value: out.value + f.value, count: out.count + f.count };
  }
  return out;
}

/** The figures the account history keeps for one day, from the stored snapshot. */
export function dayFigures(snapshot: AccountSnapshot | null): { prodDay: number; fleet: number } {
  if (!snapshot) return { prodDay: 0, fleet: 0 };
  const prod = snapshot.bodies.reduce((s, b) => s + msu(b.production), 0) * 24;
  return { prodDay: Math.round(prod), fleet: Math.round(fleetValueOf(snapshot.bodies).value) };
}

/** Resources the scrap merchant gives back for `amounts`, at `rate` percent. */
export function scrapReturn(amounts: Record<number, number>, rate: number): { metal: number; crystal: number; deuterium: number } {
  const out = { metal: 0, crystal: 0, deuterium: 0 };
  const k = Math.min(75, Math.max(0, rate)) / 100;
  for (const [id, n] of Object.entries(amounts)) {
    if (!n) continue;
    const c = rawCost(Number(id), 1);
    out.metal += Math.floor(c.metal * n * k);
    out.crystal += Math.floor(c.crystal * n * k);
    out.deuterium += Math.floor(c.deuterium * n * k);
  }
  return out;
}

export function openDashboard(o: DashboardOptions): void {
  const { doc, t, locale } = o;
  numLocale = locale;
  const keepScroll = doc.getElementById(HOST_ID)?.shadowRoot?.querySelector('.backdrop')?.scrollTop ?? 0;
  closeDashboard(doc);
  const host = doc.createElement('div');
  host.id = HOST_ID;
  host.lang = locale; // column headers hyphenate in the player's language
  const root = host.attachShadow({ mode: 'open' });
  const style = h('style');
  style.textContent = WINDOW_SHEET + DASHBOARD_CSS;
  root.append(style);

  const backdrop = h('div', 'backdrop');
  const panel = h('section', 'panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', t('dash.title'));
  backdrop.append(panel);
  root.append(backdrop);

  const close = () => closeDashboard(doc);
  keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  doc.addEventListener('keydown', keyHandler);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  const redraw = () => openDashboard(o);

  // Header
  const header = h('header', 'head');
  const titles = h('div', 'titles');
  titles.append(h('h2', '', t('dash.title')));
  const universe = doc.querySelector('meta[name="ogame-universe-name"]')?.getAttribute('content') ?? '';
  const player = doc.querySelector('meta[name="ogame-player-name"]')?.getAttribute('content') ?? '';
  const sub = [player, universe, o.snapshot ? t('toolbar.lastSync', { time: new Date(o.snapshot.fetchedAt).toLocaleString(locale) }) : t('dash.noData')]
    .filter(Boolean)
    .join(' · ');
  titles.append(h('span', 'sub', sub));
  const x = h('button', 'close');
  x.append(icon(doc, 'close', 16));
  x.type = 'button';
  x.setAttribute('aria-label', t('dash.close'));
  x.addEventListener('click', close);
  header.append(titles, x);
  panel.append(header);

  // Tabs
  const tabs = h('nav', 'tabs');
  tabs.setAttribute('role', 'tablist');
  for (const id of TABS) {
    const b = h('button', 'tab', t(`dash.tab.${id}`));
    b.type = 'button';
    b.dataset.tab = id;
    b.setAttribute('aria-pressed', String(id === tab));
    b.addEventListener('click', () => {
      tab = id;
      redraw();
    });
    tabs.append(b);
  }
  panel.append(tabs);

  const ctx: Ctx = {
    o,
    bodies: orderedBodies(o.snapshot, o.entries),
    fmt: (v: number) => formatUnits(v, locale),
    name: (id: number) => techName(id, locale, o.names ?? {}, t),
    redraw,
    pic: (id: number, px: number) => {
      const name = techName(id, locale, o.names ?? {}, t);
      if (SHIP_ICONS[id]) {
        const img = shipIcon(doc, id, name, 'pic');
        img.style.width = img.style.height = `${px}px`;
        return img;
      }
      const known = o.icons?.[String(id)];
      if (!known) return null;
      const tile = techIconEl(doc, known, px, 'pic');
      tile.title = name;
      tile.setAttribute('role', 'img');
      tile.setAttribute('aria-label', name);
      return tile;
    },
  };
  const body = h('div', 'tab-body');
  if (!o.snapshot) body.append(h('p', 'empty', t('dash.noData')));
  else if (tab === 'summary') summaryTab(body, ctx);
  else if (tab === 'investments') investmentsTab(body, ctx);
  else if (tab === 'history') historyTab(body, ctx);
  else if (tab === 'mines') minesTab(body, ctx);
  else if (tab === 'facilities') facilitiesTab(body, ctx);
  else if (tab === 'lifeforms') lifeformsTab(body, ctx);
  else if (tab === 'ships') unitsTab(body, ctx, SHIPS, true);
  else if (tab === 'defence') unitsTab(body, ctx, DEFENCES, false);
  else scrapTab(body, ctx);
  panel.append(body);

  doc.body.append(host);
  backdrop.scrollTop = keepScroll;
}

interface Ctx {
  o: DashboardOptions;
  bodies: OwnBody[];
  fmt: (v: number) => string;
  name: (id: number) => string;
  redraw: () => void;
  /** The game's picture of a technology, or null when it was never seen. */
  pic: (id: number, px: number) => HTMLElement | null;
}

function section(parent: HTMLElement, title: string, hint?: string): HTMLElement {
  const s = h('div', 'card');
  const head = h('h3', '', title);
  // Explanations stay one hover away instead of filling the page.
  if (hint) head.title = hint;
  s.append(head);
  parent.append(s);
  return s;
}

function bodyLink(doc: Document, b: OwnBody): HTMLElement {
  const cell = h('td', 'name');
  const link = h('a', '', b.name);
  if (b.type === 'moon') link.prepend(icon(doc, 'moon', 11, 'moon-ico'));
  link.href = `${doc.location?.origin ?? ''}/game/index.php?page=ingame&component=overview&cp=${b.id}`;
  cell.append(link, h('span', 'coords', `[${b.coords}]`));
  return cell;
}

function levelCell(v: number, max: number, fmt?: (v: number) => string): HTMLTableCellElement {
  const cell = h('td', `num mono${v === 0 ? ' zero' : v === max && max > 0 ? ' top' : ''}`, v === 0 ? '·' : fmt ? fmt(v) : String(v));
  return cell;
}

/** A table with one row per body and one column per technology. */
function bodyMatrix(
  ctx: Ctx,
  bodies: OwnBody[],
  ids: readonly number[],
  opts: { units?: boolean; extra?: { label: string; cls?: string; value: (b: OwnBody) => string }[]; foot?: 'avg' | 'sum' } = {},
): HTMLElement {
  const { doc, t } = ctx.o;
  const wrap = h('div', 'table-wrap');
  const table = h('table', 'matrix');
  const hr = h('tr');
  hr.append(h('th', 'name', t('dash.colBody')));
  for (const id of ids) {
    const th = h('th', 'num col');
    th.append(ctx.pic(id, 30) ?? h('span', 'col-name', ctx.name(id)));
    th.title = ctx.name(id);
    hr.append(th);
  }
  for (const e of opts.extra ?? []) hr.append(h('th', 'num', e.label));
  const thead = h('thead');
  thead.append(hr);
  table.append(thead);
  // Blue = the account's best level, only when some body is behind it.
  const max = new Map(ids.map((id) => {
    const values = bodies.map((b) => level(b, id));
    const top = Math.max(0, ...values);
    return [id, values.every((v) => v === top) ? -1 : top];
  }));
  const tbody = h('tbody');
  for (const b of bodies) {
    const tr = h('tr', b.type);
    tr.append(bodyLink(doc, b));
    for (const id of ids) tr.append(levelCell(level(b, id), opts.units ? -1 : max.get(id)!, opts.units ? count : undefined));
    for (const e of opts.extra ?? []) tr.append(h('td', `num mono ${e.cls ?? ''}`, e.value(b)));
    tbody.append(tr);
  }
  table.append(tbody);
  if (opts.foot && bodies.length) {
    const fr = h('tr');
    fr.append(h('td', 'name', t(opts.foot === 'sum' ? 'dash.total' : 'dash.average')));
    for (const id of ids) {
      const values = bodies.map((b) => level(b, id));
      const total = values.reduce((a, v) => a + v, 0);
      fr.append(h('td', 'num mono', opts.foot === 'sum' ? (total ? count(total) : '·') : (total / values.length).toLocaleString(ctx.o.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })));
    }
    for (let i = 0; i < (opts.extra ?? []).length; i++) fr.append(h('td'));
    const tfoot = h('tfoot');
    tfoot.append(fr);
    table.append(tfoot);
  }
  wrap.append(table);
  return wrap;
}

function summaryTab(parent: HTMLElement, ctx: Ctx): void {
  const { o, fmt } = ctx;
  const { t } = o;
  const rows = bodyRows(o.snapshot, o.entries, o.now, o.queues ?? null);
  const sum = summarize(rows);
  const alerts = accountAlerts(rows, o.snapshot, o.entries);

  const kpis = h('div', 'kpis');
  const kpi = (label: string, value: string, note: string, cls = '') => {
    const box = h('div', `kpi ${cls}`);
    box.append(h('span', 'label', label), h('span', 'value', value), h('span', 'note', note));
    kpis.append(box);
  };
  if (o.score) {
    const rank = o.score.rank !== null ? t('dash.rank', { rank: o.score.rank, of: o.score.of ?? '?' }) : '';
    kpi(t('dash.points'), o.score.points.toLocaleString(o.locale), rank);
  } else kpi(t('dash.points'), '—', t('dash.pointsHint'));
  kpi(t('dash.stock'), fmt(msu(sum.stock)), `${fmt(sum.stock.metal)} · ${fmt(sum.stock.crystal)} · ${fmt(sum.stock.deuterium)}`, 'accent');
  kpi(t('dash.prodDayK'), `+${fmt(msu(sum.perHour) * 24)}`, t('dash.prodHourNote', { value: fmt(msu(sum.perHour)) }), 'accent');
  const fleet = fleetValueOf(ctx.bodies);
  let def = { value: 0, count: 0 };
  for (const b of ctx.bodies) {
    const d = unitsValue(b, DEFENCES.filter((id) => id < 500));
    def = { value: def.value + d.value, count: def.count + d.count };
  }
  kpi(t('dash.fleetValue'), fmt(fleet.value), t('dash.unitsNote', { n: fmt(fleet.count) }));
  kpi(t('dash.defValue'), fmt(def.value), t('dash.unitsNote', { n: fmt(def.count) }));
  const running = new Map<string, number>();
  let busy = 0;
  for (const r of rows) {
    const items = activeItems(o.queues?.bodies[String(r.id)], o.now);
    if (items.length) busy++;
    for (const k of new Set(items.map((i) => i.kind))) running.set(k, (running.get(k) ?? 0) + 1);
  }
  const breakdown = QUEUE_KINDS.filter((k) => running.has(k)).map((k) => `${running.get(k)} ${t(`queue.${k}`).toLowerCase()}`).join(' · ');
  kpi(t('dash.queues'), o.queues ? String(busy) : '—', o.queues ? breakdown || t('dash.queuesNone') : t('dash.queuesUnknown'), 'accent');
  parent.append(kpis);

  const cols = h('div', 'cols');
  const prod = h('div', 'card');
  prod.append(h('h3', '', t('dash.production')));
  const maxRate = Math.max(1, sum.perHour.metal, sum.perHour.crystal * 1.5, sum.perHour.deuterium * 3);
  const bar = (label: string, perHour: number, weight: number, cls: string) => {
    const line = h('div', `prod ${cls}`);
    const top = h('div', 'prod-top');
    top.append(h('span', '', label), h('span', 'mono', `+${fmt(perHour * 24)}/${t('dash.dayShort')}`));
    const track = h('div', 'track');
    const fill = h('div', 'fill');
    fill.style.width = `${Math.round(((perHour * weight) / maxRate) * 100)}%`;
    track.append(fill);
    line.append(top, track);
    prod.append(line);
  };
  bar(t('res.metal'), sum.perHour.metal, 1, 'm');
  bar(t('res.crystal'), sum.perHour.crystal, 1.5, 'c');
  bar(t('res.deuterium'), sum.perHour.deuterium, 3, 'd');
  // Lifeforms in use: how many planets per species.
  const bySpecies = new Map<number, number>();
  for (const b of ctx.bodies) if (b.type === 'planet' && b.species) bySpecies.set(b.species, (bySpecies.get(b.species) ?? 0) + 1);
  if (bySpecies.size) {
    const lf = h('p', 'hint');
    lf.textContent = SPECIES.filter((s) => bySpecies.has(s)).map((s) => `${t(`lf.${s}`)} ${bySpecies.get(s)}`).join(' · ');
    prod.append(h('h4', '', t('dash.tab.lifeforms')), lf);
  }

  const movesCard = buildOrderCard(ctx);

  const checks = h('div', 'card');
  checks.append(h('h3', '', t('dash.checks')));
  if (!alerts.length) checks.append(h('p', 'ok', t('dash.allGood')));
  for (const a of alerts) {
    const item = h('div', `alert ${a.level}`);
    item.append(h('span', 'dot'));
    const text = h('div', '');
    text.append(h('strong', '', t(a.key, { count: a.count })));
    text.append(h('span', '', a.names.slice(0, 6).join(', ') + (a.names.length > 6 ? ` +${a.names.length - 6}` : '')));
    item.append(text);
    checks.append(item);
  }
  cols.append(prod, movesCard, checks);
  parent.append(cols);

  // Running queues, soonest first, each with a reminder bell.
  const inQueue: { body: OwnBody; item: QueueItem }[] = [];
  for (const b of ctx.bodies) for (const item of activeItems(o.queues?.bodies[String(b.id)], o.now)) inQueue.push({ body: b, item });
  if (inQueue.length) {
    inQueue.sort((a, b) => a.item.end - b.item.end);
    const qs = section(parent, t('dash.queuesTitle'), o.bell ? t('dash.queuesHint') : undefined);
    const wrap = h('div', 'table-wrap');
    const table = h('table', 'queues');
    const tbody = h('tbody');
    for (const { body: b, item } of inQueue) {
      const tr = h('tr', b.type === 'moon' ? 'moon' : '');
      const name = h('td', 'name');
      name.append(bodyLink(o.doc, b));
      const what = queueLabel(item, o.locale);
      const end = h('td', 'num', remaining(item.end, o.now));
      end.title = new Date(item.end).toLocaleString(o.locale);
      const bell = h('td', 'acts');
      if (o.bell) bell.append(o.bell({ id: `q:${b.id}:${item.kind}:${item.name}:${item.level}:${Math.round(item.end / 60_000)}`, label: `${b.name}: ${what}`, at: item.end }));
      tr.append(name, h('td', 'kind', t(`queue.${item.kind}`)), h('td', '', what), end, bell);
      tbody.append(tr);
    }
    table.append(tbody);
    wrap.append(table);
    qs.append(wrap);
  }

  // Research: account-wide, one compact list.
  const research = section(parent, t('dash.research'));
  const grid = h('div', 'levels');
  for (const id of RESEARCH) {
    const v = o.snapshot?.researches[String(id)] ?? 0;
    const item = h('div', `lv${v ? '' : ' zero'}`);
    item.title = ctx.name(id);
    item.append(ctx.pic(id, 40) ?? h('span', 'lv-name', ctx.name(id)), h('b', 'mono', String(v)));
    grid.append(item);
  }
  research.append(grid);
}

const SVG = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(doc: Document, tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = doc.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** One measure over the days: a 2px line, min/max on the axis, crosshair and tooltip on hover. */
function lineChart(doc: Document, days: HistoryDay[], value: (d: HistoryDay) => number, fmt: (v: number) => string, label: string, locale: string): HTMLElement {
  const W = 520, H = 140, L = 56, R = 8, T = 10, B = 22;
  const pts = days.filter((d) => value(d) > 0);
  const box = h('figure', 'chart');
  box.append(h('figcaption', '', label));
  if (pts.length < 2) {
    box.append(h('p', 'hint', '—'));
    return box;
  }
  const t0 = pts[0]!.at, t1 = pts.at(-1)!.at;
  const vs = pts.map(value);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (hi === lo) { lo *= 0.99; hi *= 1.01; }
  const x = (at: number) => L + ((at - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const chart = svg(doc, 'svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${label}: ${fmt(vs[0]!)} → ${fmt(vs.at(-1)!)}` });
  for (const v of [lo, hi]) {
    chart.append(svg(doc, 'line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }));
    const tx = svg(doc, 'text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'axis' });
    tx.textContent = fmt(v);
    chart.append(tx);
  }
  const date = (at: number) => new Date(at).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  for (const [at, anchor] of [[t0, 'start'], [t1, 'end']] as const) {
    const tx = svg(doc, 'text', { x: x(at), y: H - 6, 'text-anchor': anchor, class: 'axis' });
    tx.textContent = date(at);
    chart.append(tx);
  }
  chart.append(svg(doc, 'polyline', { points: pts.map((d) => `${x(d.at).toFixed(1)},${y(value(d)).toFixed(1)}`).join(' '), class: 'line' }));
  const cross = svg(doc, 'line', { y1: T, y2: H - B, class: 'cross', visibility: 'hidden' });
  const dot = svg(doc, 'circle', { r: 4, class: 'dot', visibility: 'hidden' });
  const hit = svg(doc, 'rect', { x: L, y: 0, width: W - L - R, height: H, fill: 'transparent' });
  chart.append(cross, dot, hit);
  const tip = h('div', 'tip');
  tip.hidden = true;
  hit.addEventListener('mousemove', (e) => {
    const r = chart.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const d = pts.reduce((a, b) => (Math.abs(x(b.at) - px) < Math.abs(x(a.at) - px) ? b : a));
    for (const n of [cross, dot]) n.setAttribute('visibility', 'visible');
    cross.setAttribute('x1', String(x(d.at)));
    cross.setAttribute('x2', String(x(d.at)));
    dot.setAttribute('cx', String(x(d.at)));
    dot.setAttribute('cy', String(y(value(d))));
    tip.hidden = false;
    tip.textContent = `${date(d.at)} · ${fmt(value(d))}`;
    tip.style.left = `${(x(d.at) / W) * 100}%`;
  });
  hit.addEventListener('mouseleave', () => {
    for (const n of [cross, dot]) n.setAttribute('visibility', 'hidden');
    tip.hidden = true;
  });
  const plot = h('div', 'plot');
  plot.append(chart, tip);
  box.append(plot);
  return box;
}

function historyTab(parent: HTMLElement, ctx: Ctx): void {
  const { o, fmt } = ctx;
  const { t, locale } = o;
  const days = o.history ?? [];
  if (days.length < 2) {
    parent.append(h('p', 'empty', t('dash.historyEmpty')));
    return;
  }
  const signed = (v: number, f: (n: number) => string) => (v > 0 ? `+${f(v)}` : v < 0 ? `−${f(-v)}` : '0');
  const kpis = h('div', 'kpis');
  for (const span of [1, 7, 30]) {
    const c = changeOver(days, span);
    const box = h('div', 'kpi');
    box.append(h('span', 'label', t('dash.historySpan', { n: span })));
    box.append(h('span', `value ${c && c.points < 0 ? 'neg' : ''}`, c ? signed(c.points, (n) => n.toLocaleString(locale)) : '—'));
    const rank = c?.rank ? t(c.rank > 0 ? 'dash.historyUp' : 'dash.historyDown', { n: Math.abs(c.rank) }) : '';
    box.append(h('span', 'note', c ? [t('dash.historyPerDay', { v: fmt(c.perDay) }), rank, c.days !== span ? t('dash.historyReal', { n: c.days }) : ''].filter(Boolean).join(' · ') : t('dash.historyFew')));
    kpis.append(box);
  }
  parent.append(kpis);

  const charts = h('div', 'cols charts');
  charts.append(
    lineChart(o.doc, days, (d) => d.points, (v) => formatUnits(v, locale), t('dash.points'), locale),
    lineChart(o.doc, days, (d) => d.prodDay, (v) => formatUnits(v, locale), t('dash.historyProd'), locale),
  );
  parent.append(charts);

  // The same numbers as a table: newest day first.
  const s = section(parent, t('dash.historyDays'));
  const wrap = h('div', 'table-wrap');
  const table = h('table', 'history');
  const head = h('tr');
  for (const k of ['dash.historyDay', 'dash.points', 'dash.historyDelta', 'dash.historyRank', 'dash.historyProd', 'dash.fleetValue']) head.append(h('th', '', t(k)));
  const thead = h('thead');
  thead.append(head);
  table.append(thead);
  const tbody = h('tbody');
  [...days].reverse().slice(0, 60).forEach((d, i, list) => {
    const prev = list[i + 1];
    const tr = h('tr');
    const delta = prev ? d.points - prev.points : 0;
    const rankMove = prev && d.rank !== null && prev.rank !== null ? prev.rank - d.rank : 0;
    tr.append(
      h('td', '', new Date(d.at).toLocaleDateString(locale)),
      h('td', 'mono', d.points.toLocaleString(locale)),
      h('td', `mono ${delta < 0 ? 'neg' : delta > 0 ? 'pos' : ''}`, prev ? signed(delta, (n) => n.toLocaleString(locale)) : ''),
      h('td', 'mono', d.rank === null ? '—' : `${d.rank.toLocaleString(locale)}${rankMove ? ` (${rankMove > 0 ? '↑' : '↓'}${Math.abs(rankMove)})` : ''}`),
      h('td', 'mono', d.prodDay ? `+${fmt(d.prodDay)}` : '—'),
      h('td', 'mono', d.fleet ? fmt(d.fleet) : '—'),
    );
    tbody.append(tr);
  });
  table.append(tbody);
  wrap.append(table);
  s.append(wrap);
}

const RATES_KEY = 'dash.rates';
let sessionRates: Rates = DEFAULT_RATES;
const loadRates = (o: DashboardOptions): Rates => o.store?.get<Rates>(RATES_KEY, DEFAULT_RATES) ?? sessionRates;
const EXCLUDE_KEY = 'dash.investExclude';
let sessionExclude: InvestKind[] = [];
const loadExclude = (o: DashboardOptions): InvestKind[] => o.store?.get<InvestKind[]>(EXCLUDE_KEY, []) ?? sessionExclude;

/** InfoCompte's amortizations: mines, plasma and a new colony, best payback first, each step applied before the next. */
function buildOrder(ctx: Ctx, steps: number): AmortStep[] {
  const { o } = ctx;
  const speed = Number(o.doc.querySelector('meta[name="ogame-universe-speed"]')?.getAttribute('content')) || 1;
  const planets = o.entries
    .filter((e) => e.planetId)
    .map((e) => ({ id: e.planetId!, name: e.name, coords: e.coords, maxTemp: maxTemperatureOf(e.planetLink) }));
  return amortizationPlan({ snapshot: o.snapshot, planets, speed, rates: loadRates(o), steps, lfSlots: o.lfSlots, lfLevels: o.lfLevels ?? undefined, lfLocked: o.lfLocked, exclude: loadExclude(o) });
}

/**
 * What the lifeform part still needs, as InfoCompte asks: links to the game pages that carry it.
 * A click is a normal navigation (with cp=, so the planet changes, as the player chose); Future
 * reads the page when it loads.
 */
function missingData(ctx: Ctx): HTMLElement | null {
  const { o } = ctx;
  const { t } = o;
  const slots = lfSlotsMissing(o.snapshot, o.lfSlots);
  const buildings = lfBuildingsMissing(o.snapshot, o.lfLocked);
  const firstPlanet = ctx.bodies.find((b) => b.type === 'planet');
  if (!slots.length && !buildings.length && (o.lfLevels || !firstPlanet)) return null;
  const box = h('div', 'needs');
  const base = 'index.php?page=ingame&component=';
  const link = (text: string, href: string) => {
    const a = h('a', 'chip', text);
    a.setAttribute('href', href);
    return a;
  };
  if (!o.lfLevels && firstPlanet) {
    const p = h('p', '');
    p.append(h('span', '', `${t('dash.needLevels')} `), link(t('dash.openLfSettings'), `${base}lfsettings&cp=${firstPlanet.id}`));
    box.append(p);
  }
  const list = (ids: number[], key: string, component: string) => {
    if (!ids.length) return;
    const p = h('p', '');
    p.append(h('span', '', `${t(key, { count: ids.length })} `));
    for (const id of ids) {
      const name = o.entries.find((e) => e.planetId === id)?.name || ctx.bodies.find((x) => x.id === id)?.name || String(id);
      p.append(link(name, `${base}${component}&cp=${id}`));
    }
    box.append(p);
  };
  list(buildings, 'dash.needBuildings', 'lfbuildings');
  list(slots, 'dash.needSlots', 'lfresearch');
  return box;
}

/**
 * Consecutive steps of the same technology, as one: the same level on different planets, or
 * successive levels on the same planet (or on the account, as plasma).
 */
interface StepGroup {
  first: AmortStep;
  steps: AmortStep[];
}

export function groupSteps(steps: AmortStep[]): StepGroup[] {
  const out: StepGroup[] = [];
  for (const s of steps) {
    const g = out[out.length - 1];
    const prev = g?.steps[g.steps.length - 1];
    const sameTech = !!g && g.first.id === s.id && s.kind !== 'astro';
    const isChain = !!g && g.steps.length > 1 && prev!.from !== g.first.from;
    const isSpread = !!g && g.steps.length > 1 && !isChain;
    const chain = sameTech && !isSpread && prev!.planetId === s.planetId && prev!.to === s.from;
    const spread = sameTech && !isChain && !!s.planetId && !!g.first.planetId && g.first.from === s.from && g.first.to === s.to;
    if (chain || spread) g!.steps.push(s);
    else out.push({ first: s, steps: [s] });
  }
  return out;
}

/** Done since the last sync: the level is in construction (production queue) or seen on the game's page. */
function stepDone(ctx: Ctx, s: AmortStep): boolean {
  const { o } = ctx;
  if (!s.planetId) return false;
  if ((o.seenLevels?.[String(s.planetId)]?.[String(s.id)] ?? 0) >= s.to) return true;
  const name = ctx.name(s.id);
  return activeItems(o.queues?.bodies[String(s.planetId)], o.now).some((q) => q.name === name && q.level >= s.to);
}

/** The game page where a step is built, on its planet. */
function stepPage(s: AmortStep): string {
  const component = s.kind === 'mine' ? 'supplies' : s.kind === 'lfBuilding' ? 'lfbuildings' : s.kind === 'lfResearch' ? 'lfresearch' : 'research';
  return `index.php?page=ingame&component=${component}${s.planetId ? `&cp=${s.planetId}` : ''}`;
}

function daysText(ctx: Ctx, d: number): string {
  const { t, locale } = ctx.o;
  return d < 1 ? `<1 ${t('dash.daysShort')}` : `${d.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${t('dash.daysShort')}`;
}

function groupLine(ctx: Ctx, g: StepGroup, i: number, numbered: boolean): HTMLElement {
  const { t } = ctx.o;
  const m = g.first;
  const line = h('div', 'move');
  if (numbered) line.append(h('span', 'n', String(i + 1)));
  const pic = ctx.pic(m.id, 28);
  if (pic) line.append(pic);
  else if (!numbered) line.append(h('span', 'n', String(i + 1)));
  const text = h('div', 'move-text');
  const what = m.kind === 'mine' ? t(`mine.${m.mine}`) : ctx.name(m.id);
  const to = g.steps[g.steps.length - 1]!.to;
  text.append(h('strong', '', `${what} ${m.from} → ${to}${m.kind === 'astro' ? ` · ${t('dash.newColony')}` : ''}`));
  const total = g.steps.reduce((sum, s) => ({ metal: sum.metal + s.cost.metal, crystal: sum.crystal + s.cost.crystal, deuterium: sum.deuterium + s.cost.deuterium }), { metal: 0, crystal: 0, deuterium: 0 });
  const cost = [`${ctx.fmt(total.metal)} M`, `${ctx.fmt(total.crystal)} C`, ...(total.deuterium ? [`${ctx.fmt(total.deuterium)} D`] : [])].join(' · ');
  if (m.planetId) {
    // One chip per planet (its last level in the group), linking to the page where it is built; done ones are struck through.
    const chips = h('div', 'pls');
    const perPlanet = [...new Map(g.steps.map((s) => [s.planetId, s])).values()];
    let done = 0;
    for (const s of perPlanet) {
      const a = h('a', 'pl', s.name || `[${s.coords}]`);
      a.setAttribute('href', stepPage(s));
      const guessed = g.steps.some((x) => x.planetId === s.planetId && x.guessed);
      a.title = `${s.name} [${s.coords}] · ${daysText(ctx, s.days)}${guessed ? ` · ${t('dash.lfGuessedHint')}` : ''}`;
      if (guessed) a.classList.add('guess');
      if (stepDone(ctx, s)) {
        a.classList.add('done');
        a.setAttribute('aria-label', `${a.title} · ${t('dash.stepDone')}`);
        done++;
      }
      chips.append(a);
    }
    if (done === perPlanet.length) line.classList.add('done');
    const sub = h('span', '', perPlanet.length > 1 ? `${t('dash.planetsCount', { count: perPlanet.length })} · ${cost}` : cost);
    if (done) sub.append(h('em', 'ok', ` · ${t('dash.doneCount', { done, count: perPlanet.length })}`));
    text.append(chips, sub);
  } else {
    text.append(h('span', '', `${t('dash.account')} · ${cost}`));
  }
  const days = g.steps.map((s) => s.days);
  const lo = Math.min(...days), hi = Math.max(...days);
  line.append(text, h('span', 'roi mono', hi - lo >= 0.05 ? `${daysText(ctx, lo)}–${daysText(ctx, hi)}`.replace(` ${t('dash.daysShort')}–`, '–') : daysText(ctx, lo)));
  return line;
}

/** Summary card: the first 5 investments; the title opens their own tab. */
function buildOrderCard(ctx: Ctx): HTMLElement {
  const { o } = ctx;
  const { t, doc } = o;
  const s = h('div', 'card');
  const head = h('h3', '');
  const go = h('button', 'head-toggle');
  go.type = 'button';
  go.title = t('dash.movesOpen');
  go.append(h('span', '', t('dash.moves')), icon(doc, 'next', 14));
  go.addEventListener('click', () => {
    tab = 'investments';
    ctx.redraw();
  });
  head.append(go);
  s.append(head);
  const groups = groupSteps(buildOrder(ctx, 15)).slice(0, 5);
  if (!groups.length) s.append(h('p', 'hint', t('dash.movesNone')));
  groups.forEach((g, i) => s.append(groupLine(ctx, g, i, false)));
  return s;
}

/** The investments tab: trade rates, the pages still to open, the build order grouped by step. */
function investmentsTab(parent: HTMLElement, ctx: Ctx): void {
  const { o } = ctx;
  const { t } = o;
  const s = section(parent, t('dash.moves'), t('dash.movesHint'));
  const bar = h('div', 'scrap-bar');
  const rates = loadRates(o);
  const label = h('label', 'field-label', t('dash.rates'));
  (['metal', 'crystal', 'deuterium'] as const).forEach((k, i) => {
    const input = h('input', 'field rate');
    input.type = 'number';
    input.min = '0.1';
    input.step = '0.1';
    input.value = String(rates[k]);
    input.setAttribute('aria-label', `${t('dash.rates')}: ${t(`res.${k}`)}`);
    input.addEventListener('change', () => {
      const v = Number(input.value);
      if (!(v > 0)) return;
      const next = { ...loadRates(o), [k]: v };
      if (o.store) o.store.set(RATES_KEY, next);
      else sessionRates = next;
      ctx.redraw();
    });
    if (i) label.append(h('span', '', ':'));
    label.append(input);
  });
  bar.append(label);
  // What the list offers, as InfoCompte's settings: a switched-off kind is never proposed.
  const kinds = h('div', 'seg');
  kinds.setAttribute('role', 'group');
  kinds.setAttribute('aria-label', t('dash.investKinds'));
  const excluded = loadExclude(o);
  for (const k of INVEST_KINDS) {
    const b = h('button', '', t(`dash.invest.${k}`));
    b.type = 'button';
    b.setAttribute('aria-pressed', String(!excluded.includes(k)));
    b.addEventListener('click', () => {
      const now = loadExclude(o);
      const next = now.includes(k) ? now.filter((x) => x !== k) : [...now, k];
      if (o.store) o.store.set(EXCLUDE_KEY, next);
      else sessionExclude = next;
      ctx.redraw();
    });
    kinds.append(b);
  }
  bar.append(kinds);
  s.append(bar);
  const missing = missingData(ctx);
  if (missing) s.append(missing);
  const groups = groupSteps(buildOrder(ctx, 60));
  if (!groups.length) s.append(h('p', 'hint', t('dash.movesNone')));
  groups.forEach((g, i) => s.append(groupLine(ctx, g, i, true)));
}

function minesTab(parent: HTMLElement, ctx: Ctx): void {
  const { t } = ctx.o;
  const planets = ctx.bodies.filter((b) => b.type === 'planet');
  const s = section(parent, t('dash.tab.mines'), t('dash.minesHint'));
  s.append(
    bodyMatrix(ctx, planets, MINES, {
      foot: 'avg',
      extra: [
        { label: `${t('res.metal')}/${t('dash.dayShort')}`, cls: 'm', value: (b) => ctx.fmt(b.production.metal * 24) },
        { label: `${t('res.crystal')}/${t('dash.dayShort')}`, cls: 'c', value: (b) => ctx.fmt(b.production.crystal * 24) },
        { label: `${t('res.deuterium')}/${t('dash.dayShort')}`, cls: 'd', value: (b) => ctx.fmt(b.production.deuterium * 24) },
      ],
    }),
  );
}

function facilitiesTab(parent: HTMLElement, ctx: Ctx): void {
  const { t } = ctx.o;
  const planets = ctx.bodies.filter((b) => b.type === 'planet');
  const moons = ctx.bodies.filter((b) => b.type === 'moon');
  section(parent, t('dash.planets')).append(bodyMatrix(ctx, planets, PLANET_FACILITIES, { foot: 'avg' }));
  if (moons.length) section(parent, t('dash.moons')).append(bodyMatrix(ctx, moons, MOON_FACILITIES, { foot: 'avg' }));
}

function lifeformsTab(parent: HTMLElement, ctx: Ctx): void {
  const { o, name } = ctx;
  const { t, doc } = o;
  const planets = ctx.bodies.filter((b) => b.type === 'planet');
  // Lifeforms mix: each planet has its own species (buildings) and its own research per slot.
  const active = new Map(planets.map((p) => [p.id, { b: activeLfBuildings(p), r: activeLfResearch(p, o.lfSlots?.[String(p.id)]) }]));

  // Rows = technologies active on at least one planet, columns = planets.
  const table = (title: string, pick: (p: OwnBody) => ActiveTech[]) => {
    const s = section(parent, title, t('dash.lfHint'));
    const ids = [...new Set(planets.flatMap((p) => pick(p).filter((a) => a.level > 0).map((a) => a.id)))].sort(
      (a, b) => a % 100 - b % 100 || a - b,
    );
    if (!ids.length) {
      s.append(h('p', 'hint', t('dash.lfNone')));
      return;
    }
    const wrap = h('div', 'table-wrap');
    const tab = h('table', 'matrix lf');
    // Fixed layout: every planet column as wide as the others, whatever the length of its name.
    tab.style.setProperty('--cols', String(planets.length));
    const cols = h('colgroup');
    cols.append(h('col', 'name-col'), ...planets.map(() => h('col')));
    tab.append(cols);
    const hr = h('tr');
    hr.append(h('th', 'name', ''));
    for (const p of planets) {
      const th = h('th', 'num col');
      const a = h('a', 'col-name', p.name);
      a.href = `${doc.location?.origin ?? ''}/game/index.php?page=ingame&component=lfresearch&cp=${p.id}`;
      th.append(a);
      th.title = `${p.name} [${p.coords}]${p.species ? ` · ${t(`lf.${p.species}`)}` : ''}`;
      hr.append(th);
    }
    const thead = h('thead');
    thead.append(hr);
    tab.append(thead);
    const tbody = h('tbody');
    for (const id of ids) {
      const tr = h('tr');
      const sp = speciesOf(id);
      const cell = h('td', 'name tech');
      const label = h('span', 'tech-label');
      // A picture never seen keeps its square, so the names stay in one column.
      label.append(ctx.pic(id, 26) ?? techIconEl(doc, undefined, 26, 'pic'));
      label.append(h('span', '', name(id)));
      if (sp) label.append(h('small', '', t(`lf.${sp}`)));
      cell.append(label);
      tr.append(cell);
      const on = planets.map((p) => pick(p).find((a) => a.id === id));
      const values = on.flatMap((a) => (a ? [a.level] : []));
      const max = values.length > 1 && values.some((v) => v !== Math.max(...values)) ? Math.max(...values) : -1;
      on.forEach((a) => {
        const cell = levelCell(a?.level ?? 0, max);
        if (a?.guessed) {
          cell.classList.add('guess');
          cell.title = t('dash.lfGuess');
        }
        tr.append(cell);
      });
      tbody.append(tr);
    }
    tab.append(tbody);
    wrap.append(tab);
    s.append(wrap);
  };
  table(t('dash.lfBuildings'), (p) => active.get(p.id)!.b);
  table(t('dash.lfResearch'), (p) => active.get(p.id)!.r);
}

/** Ships or defences of the planets, or of the moons: one page each, switched on top. */
function unitsTab(parent: HTMLElement, ctx: Ctx, ids: readonly number[], ships: boolean): void {
  const { t } = ctx.o;
  const title = t(ships ? 'dash.tab.ships' : 'dash.tab.defence');
  const s = h('div', 'card');
  parent.append(s);
  const head = h('div', 'table-head');
  head.append(h('h3', '', title));
  const of = (type: 'planet' | 'moon') => ctx.bodies.filter((b) => b.type === type && ids.some((id) => level(b, id) > 0));
  const value = (list: OwnBody[]) => list.reduce((sum, b) => sum + unitsValue(b, ids).value, 0);
  const seg = h('div', 'seg');
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', title);
  for (const type of ['planet', 'moon'] as const) {
    const list = of(type);
    const b = h('button', '');
    b.type = 'button';
    b.dataset.scope = type;
    b.setAttribute('aria-pressed', String(unitScope === type));
    b.append(icon(ctx.o.doc, type, 14, 'seg-ico'), h('span', '', t(type === 'planet' ? 'dash.planets' : 'dash.moons')), h('i', 'mono', list.length ? ctx.fmt(value(list)) : '—'));
    b.addEventListener('click', () => {
      unitScope = type;
      ctx.redraw();
    });
    seg.append(b);
  }
  head.append(seg);
  s.append(head);
  const bodies = of(unitScope);
  // Only the units someone here owns: an empty column is noise.
  const shown = ids.filter((id) => bodies.some((b) => level(b, id) > 0));
  if (!shown.length) {
    s.append(h('p', 'hint', t('dash.unitsNone')));
    return;
  }
  s.append(bodyMatrix(ctx, bodies, shown, { units: true, foot: 'sum', extra: [{ label: t('dash.valueMsu'), value: (b) => ctx.fmt(unitsValue(b, shown).value) }] }));
}

/**
 * Picks one planet or moon, as the destination list of the fleet bar does: one row per position,
 * the planet on the left and its moon on the right; bodies outside `ids` are shown but off.
 */
function bodyPicker(ctx: Ctx, ids: Set<number>, current: OwnBody, onPick: (id: number) => void): HTMLElement {
  const { doc, t } = ctx.o;
  const wrap = h('div', 'bpick');
  const label = (b: OwnBody) => `${b.name}${b.type === 'moon' ? ` (${t('dash.moon')})` : ''} [${b.coords}]`;
  const button = h('button', 'bpick-btn');
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', label(current));
  if (current.type === 'moon') button.append(icon(doc, 'moon', 13));
  button.append(h('b', '', current.name), h('small', 'mono', current.coords), icon(doc, 'chevron', 14));
  const menu = h('div', 'bmenu');
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  const cell = (b: OwnBody | undefined, moon: boolean) => {
    if (!b) return h('span');
    const item = h('button', `${moon ? 'moon' : 'planet'}${b.id === current.id ? ' on' : ''}`);
    item.type = 'button';
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(b.id === current.id));
    item.setAttribute('aria-label', label(b));
    if (moon) {
      item.append(icon(doc, 'moon', 14));
      item.title = label(b);
    } else item.append(h('span', '', b.name), h('small', 'mono', b.coords));
    item.disabled = !ids.has(b.id);
    item.addEventListener('click', () => onPick(b.id));
    return item;
  };
  const planets = ctx.bodies.filter((b) => b.type === 'planet');
  const moons = new Map(ctx.bodies.filter((b) => b.type === 'moon').map((m) => [m.coords, m]));
  for (const p of planets) menu.append(cell(p, false), cell(moons.get(p.coords), true));
  const set = (open: boolean) => {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };
  button.addEventListener('click', () => set(menu.hidden));
  wrap.addEventListener('focusout', (e) => {
    if (!wrap.contains(e.relatedTarget as Node | null)) set(false);
  });
  wrap.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || menu.hidden) return;
    e.stopPropagation();
    set(false);
    button.focus();
  });
  wrap.append(button, menu);
  return wrap;
}

function scrapTab(parent: HTMLElement, ctx: Ctx): void {
  const { t } = ctx.o;
  const units = [...SHIPS, ...DEFENCES.filter((id) => id < 500)];
  const owners = ctx.bodies.filter((b) => units.some((id) => level(b, id) > 0));
  const s = section(parent, t('dash.tab.scrap'), t('dash.scrapHint'));
  if (!owners.length) {
    s.append(h('p', 'hint', t('dash.unitsNone')));
    return;
  }
  if (!owners.some((b) => b.id === scrapBody)) scrapBody = owners[0]!.id;
  const body = owners.find((b) => b.id === scrapBody)!;

  const bar = h('div', 'scrap-bar');
  const pick = bodyPicker(ctx, new Set(owners.map((b) => b.id)), body, (id) => {
    scrapBody = id;
    ctx.redraw();
  });
  const rateLabel = h('label', 'field-label', t('dash.scrapRate'));
  const rate = h('input', 'field rate');
  rate.type = 'number';
  rate.min = '35';
  rate.max = '75';
  rate.step = '1';
  rate.value = String(scrapRate);
  rateLabel.append(rate, h('span', '', '%'));
  const all = h('button', 'chip', t('dash.scrapAll'));
  all.type = 'button';
  const none = h('button', 'chip', t('dash.scrapNone'));
  none.type = 'button';
  bar.append(pick, rateLabel, all, none);
  s.append(bar);

  const wrap = h('div', 'table-wrap');
  const table = h('table', 'scrap');
  const hr = h('tr');
  for (const [label, cls] of [[t('dash.unit'), ''], [t('dash.owned'), 'num'], [t('dash.toScrap'), 'num'], [t('res.metal'), 'num'], [t('res.crystal'), 'num'], [t('res.deuterium'), 'num']] as const) hr.append(h('th', cls, label));
  const thead = h('thead');
  thead.append(hr);
  table.append(thead);
  const tbody = h('tbody');
  const inputs = new Map<number, HTMLInputElement>();
  const outs = new Map<number, HTMLElement[]>();
  const picks = new Map<number, HTMLButtonElement>();
  for (const id of units) {
    const owned = level(body, id);
    if (!owned) continue;
    const tr = h('tr');
    const nameCell = h('td', 'unit');
    // The picture and the name are one button: all of this unit, or none again.
    const label = h('button', 'unit-label');
    label.type = 'button';
    label.title = t('dash.scrapPick');
    const p = ctx.pic(id, 28);
    if (p) label.append(p);
    label.append(h('span', '', ctx.name(id)));
    picks.set(id, label);
    nameCell.append(label);
    tr.append(nameCell, h('td', 'num mono', count(owned)));
    const qty = h('input', 'field qty');
    qty.type = 'number';
    qty.min = '0';
    qty.max = String(owned);
    qty.value = '0';
    qty.setAttribute('aria-label', ctx.name(id));
    inputs.set(id, qty);
    const qCell = h('td', 'num');
    qCell.append(qty);
    tr.append(qCell);
    const cells = [h('td', 'num mono m'), h('td', 'num mono c'), h('td', 'num mono d')];
    outs.set(id, cells);
    tr.append(...cells);
    tbody.append(tr);
  }
  table.append(tbody);
  const fr = h('tr');
  const totalCells = [h('td', 'num mono m'), h('td', 'num mono c'), h('td', 'num mono d')];
  const msuCell = h('span', 'mono msu');
  const totalName = h('td', 'name', `${t('dash.total')} `);
  totalName.append(msuCell);
  fr.append(totalName, h('td'), h('td'), ...totalCells);
  const tfoot = h('tfoot');
  tfoot.append(fr);
  table.append(tfoot);
  wrap.append(table);
  s.append(wrap);

  const update = () => {
    scrapRate = Math.min(75, Math.max(35, Number(rate.value) || 35));
    const amounts: Record<number, number> = {};
    for (const [id, input] of inputs) {
      const n = Math.min(level(body, id), Math.max(0, Math.floor(Number(input.value) || 0)));
      amounts[id] = n;
      picks.get(id)!.setAttribute('aria-pressed', String(n === level(body, id)));
      const r = scrapReturn({ [id]: n }, scrapRate);
      const [m, c, d] = outs.get(id)!;
      m!.textContent = n ? ctx.fmt(r.metal) : '·';
      c!.textContent = n ? ctx.fmt(r.crystal) : '·';
      d!.textContent = n ? ctx.fmt(r.deuterium) : '·';
    }
    const total = scrapReturn(amounts, scrapRate);
    totalCells[0]!.textContent = ctx.fmt(total.metal);
    totalCells[1]!.textContent = ctx.fmt(total.crystal);
    totalCells[2]!.textContent = ctx.fmt(total.deuterium);
    msuCell.textContent = `${ctx.fmt(msu(total))} MSU`;
  };
  for (const input of inputs.values()) input.addEventListener('input', update);
  for (const [id, label] of picks) {
    label.addEventListener('click', () => {
      const input = inputs.get(id)!;
      input.value = Number(input.value) === level(body, id) ? '0' : String(level(body, id));
      update();
    });
  }
  rate.addEventListener('input', update);
  all.addEventListener('click', () => {
    for (const [id, input] of inputs) input.value = String(level(body, id));
    update();
  });
  none.addEventListener('click', () => {
    for (const input of inputs.values()) input.value = '0';
    update();
  });
  update();
}
