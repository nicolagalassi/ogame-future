/**
 * Account dashboard ("Plancia account"): a panel over the page, opened from Future's toolbar.
 * Lives in a Shadow DOM so the game's CSS and ours never fight. It shows data already
 * stored; it makes no network call and sends no game action. Planet names link to the
 * game's own planet pages (a normal click = one navigation, AGENTS.md §1).
 */
import type { AccountSnapshot } from '../../data/account-info';
import type { PlanetListEntry } from '../../data/planet-list';
import type { Score } from '../../data/score';
import { formatUnits } from '../../core/format';
import { accountAlerts, bodyRows, msu, summarize, type BodyRow } from '../../engines/account';
import { activeItems, QUEUE_KINDS, type QueueSnapshot } from '../../data/queues';
import { bestUpgrades } from '../../engines/roi';
import { fleetLink, largeCargoCapacity, planCollection } from '../../engines/collect';
import { remaining } from '../planet-menu';
import { DASHBOARD_CSS } from './style';

export interface DashboardOptions {
  doc: Document;
  snapshot: AccountSnapshot | null;
  entries: PlanetListEntry[];
  score: Score | null;
  queues?: QueueSnapshot | null;
  now: number;
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

type SortKey = 'list' | 'name' | 'metal' | 'crystal' | 'deuterium' | 'prod' | 'full' | 'age';

const HOST_ID = 'fut-dashboard';
let sortKey: SortKey = 'list';
let sortDesc = false;
let showMoons = true;
let tab: 'overview' | 'collect' = 'overview';
const collect = { target: 0, metal: true, crystal: true, deuterium: true, capacity: 0 };
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

function hoursText(hours: number | null, t: DashboardOptions['t']): string {
  if (hours === null) return '—';
  if (hours <= 0) return t('dash.full');
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.floor(hours)}h ${String(Math.round((hours % 1) * 60)).padStart(2, '0')}m`;
  const days = Math.floor(hours / 24);
  return days > 99 ? `99${t('dash.daysShort')}+` : `${days}${t('dash.daysShort')}`;
}

function ageClass(minutes: number): string {
  return minutes < 15 ? 'fresh' : minutes <= 30 ? 'warm' : 'old';
}

function ageText(minutes: number): string {
  return minutes < 60 ? `${minutes}m` : minutes < 1440 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 1440)}d`;
}

const minFull = (r: BodyRow): number | null => {
  const list = [r.hoursToFull.metal, r.hoursToFull.crystal, r.hoursToFull.deuterium].filter((x): x is number => x !== null);
  return list.length ? Math.min(...list) : null;
};

function sortRows(rows: BodyRow[]): BodyRow[] {
  if (sortKey === 'list') return rows;
  const value = (r: BodyRow): number | string => {
    switch (sortKey) {
      case 'name': return r.name.toLowerCase();
      case 'metal': case 'crystal': case 'deuterium': return r.amount[sortKey];
      case 'prod': return msu(r.perHour);
      case 'full': return minFull(r) ?? Number.POSITIVE_INFINITY;
      case 'age': return r.ageMinutes;
      default: return 0;
    }
  };
  const sorted = [...rows].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    return x < y ? -1 : x > y ? 1 : 0;
  });
  return sortDesc ? sorted.reverse() : sorted;
}

export function openDashboard(o: DashboardOptions): void {
  const { doc, t, locale } = o;
  closeDashboard(doc);
  const host = doc.createElement('div');
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: 'open' });
  const style = h('style');
  style.textContent = DASHBOARD_CSS;
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

  const fmt = (v: number) => formatUnits(v, locale);
  const rows = bodyRows(o.snapshot, o.entries, o.now, o.queues ?? null);
  const sum = summarize(rows);
  const alerts = accountAlerts(rows, o.snapshot, o.entries);

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
  const x = h('button', 'close', '×');
  x.type = 'button';
  x.setAttribute('aria-label', t('dash.close'));
  x.addEventListener('click', close);
  const tabs = h('nav', 'tabs');
  for (const key of ['overview', 'collect'] as const) {
    const b = h('button', 'tab', t(`dash.tab.${key}`));
    b.type = 'button';
    b.setAttribute('aria-pressed', String(tab === key));
    b.addEventListener('click', () => {
      tab = key;
      openDashboard(o);
    });
    tabs.append(b);
  }
  header.append(titles, tabs, x);
  panel.append(header);
  doc.body.append(host);

  if (tab === 'collect') {
    renderCollect(o, panel, rows);
    return;
  }

  // KPIs
  const kpis = h('div', 'kpis');
  const kpi = (label: string, value: string, note: string, cls = '') => {
    const box = h('div', `kpi ${cls}`);
    box.append(h('span', 'label', label), h('span', 'value', value), h('span', 'note', note));
    kpis.append(box);
  };
  if (o.score) {
    const rank = o.score.rank !== null ? t('dash.rank', { rank: o.score.rank, of: o.score.of ?? '?' }) : '';
    kpi(t('dash.points'), o.score.points.toLocaleString(locale), rank);
  } else {
    kpi(t('dash.points'), '—', t('dash.pointsHint'));
  }
  kpi(t('dash.stock'), fmt(msu(sum.stock)), t('dash.stockNote'), 'accent');
  kpi(t('dash.prodHour'), `+${fmt(msu(sum.perHour))}`, t('dash.prodDay', { value: fmt(msu(sum.perHour) * 24) }), 'accent');
  kpi(t('dash.bodies'), `${sum.planets} / ${sum.moons}`, t('dash.bodiesNote'));
  // Running queues: how many bodies have each kind in progress.
  const running = new Map<string, number>();
  let busyBodies = 0;
  for (const r of rows) {
    const items = activeItems(o.queues?.bodies[String(r.id)], o.now);
    if (items.length) busyBodies++;
    for (const k of new Set(items.map((i) => i.kind))) running.set(k, (running.get(k) ?? 0) + 1);
  }
  const breakdown = QUEUE_KINDS.filter((k) => running.has(k)).map((k) => `${running.get(k)} ${t(`queue.${k}`).toLowerCase()}`).join(' · ');
  kpi(t('dash.queues'), o.queues ? String(busyBodies) : '—', o.queues ? breakdown || t('dash.queuesNone') : t('dash.queuesUnknown'), 'accent');
  panel.append(kpis);

  // Two columns: production + alerts
  const cols = h('div', 'cols');
  const prod = h('div', 'card');
  prod.append(h('h3', '', t('dash.production')));
  const maxRate = Math.max(1, sum.perHour.metal, sum.perHour.crystal * 1.5, sum.perHour.deuterium * 3);
  const bar = (label: string, perHour: number, weight: number, cls: string) => {
    const line = h('div', `prod ${cls}`);
    const top = h('div', 'prod-top');
    top.append(h('span', '', label), h('span', 'mono', `+${fmt(perHour)}/h · +${fmt(perHour * 24)}/${t('dash.dayShort')}`));
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
  prod.append(h('p', 'hint', t('dash.msuHint')));

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
  const movesCard = h('div', 'card');
  movesCard.append(h('h3', '', t('dash.moves')));
  const moves = bestUpgrades(o.snapshot, o.entries, 5);
  if (!moves.length) movesCard.append(h('p', 'hint', t('dash.movesNone')));
  moves.forEach((m, i) => {
    const line = h('div', 'move');
    line.append(h('span', 'n', String(i + 1)));
    const text = h('div', 'move-text');
    text.append(h('strong', '', `${t(`mine.${m.mine}`)} ${m.from} → ${m.from + 1}`));
    text.append(h('span', '', `${m.name} [${m.coords}] · ${fmt(m.cost.metal)} M · ${fmt(m.cost.crystal)} C`));
    line.append(text, h('span', 'roi mono', m.days < 1 ? `<1 ${t('dash.daysShort')}` : `${m.days.toFixed(1)} ${t('dash.daysShort')}`));
    movesCard.append(line);
  });
  movesCard.append(h('p', 'hint', t('dash.movesHint')));
  cols.append(prod, movesCard, checks);
  panel.append(cols);

  // Table
  const tableCard = h('div', 'card');
  const tableHead = h('div', 'table-head');
  tableHead.append(h('h3', '', t('dash.bodiesTable')));
  const moonsToggle = h('button', 'chip', t(showMoons ? 'dash.hideMoons' : 'dash.showMoons'));
  moonsToggle.type = 'button';
  moonsToggle.addEventListener('click', () => {
    showMoons = !showMoons;
    openDashboard(o);
  });
  tableHead.append(moonsToggle);
  tableCard.append(tableHead);

  const wrap = h('div', 'table-wrap');
  const table = h('table');
  const thead = h('thead');
  const hr = h('tr');
  const th = (label: string, key: SortKey | null, cls = '') => {
    const cell = h('th', cls);
    if (key) {
      const b = h('button', 'sort', label + (sortKey === key ? (sortDesc ? ' ▾' : ' ▴') : ''));
      b.type = 'button';
      b.addEventListener('click', () => {
        if (sortKey === key) sortDesc = !sortDesc;
        else {
          sortKey = key;
          sortDesc = key !== 'name';
        }
        openDashboard(o);
      });
      cell.append(b);
    } else cell.textContent = label;
    hr.append(cell);
  };
  th(t('dash.colBody'), 'name');
  th(t('dash.colMines'), null, 'num');
  th(t('res.metal'), 'metal', 'num');
  th(t('res.crystal'), 'crystal', 'num');
  th(t('res.deuterium'), 'deuterium', 'num');
  th(t('dash.colProd'), 'prod', 'num');
  th(t('dash.colFull'), 'full', 'num');
  th(t('dash.colQueue'), null);
  th(t('dash.colAge'), 'age', 'num');
  thead.append(hr);
  table.append(thead);

  const tbody = h('tbody');
  const origin = doc.location?.origin ?? '';
  for (const r of sortRows(rows.filter((row) => showMoons || row.type === 'planet'))) {
    const tr = h('tr', r.type);
    const nameCell = h('td', 'name');
    const link = h('a', '', r.type === 'moon' ? `☾ ${r.name}` : r.name);
    link.href = `${origin}/game/index.php?page=ingame&component=overview&cp=${r.id}`;
    nameCell.append(link, h('span', 'coords', `[${r.coords}]`));
    tr.append(nameCell);
    tr.append(h('td', 'num mono', r.type === 'planet' ? `${r.mines.metal}·${r.mines.crystal}·${r.mines.deuterium}` : ''));
    for (const k of ['metal', 'crystal', 'deuterium'] as const) {
      const full = r.fill !== null && r.fill[k] >= 0.9;
      const cell = h('td', `num mono ${k[0]}${full ? ' full' : ''}`, fmt(r.amount[k]));
      if (r.fill) cell.title = `${Math.round(r.fill[k] * 100)}%`;
      tr.append(cell);
    }
    tr.append(h('td', 'num mono', r.type === 'planet' ? `+${fmt(msu(r.perHour) * 24)}` : ''));
    const mf = minFull(r);
    tr.append(h('td', `num mono${mf !== null && mf <= 6 ? ' warnText' : ''}`, r.type === 'planet' ? hoursText(mf, t) : ''));
    const qCell = h('td', 'queue');
    for (const item of activeItems(o.queues?.bodies[String(r.id)], o.now)) {
      const q = h('span', `q q-${item.kind}`, `${item.name}${item.level ? ` ${item.level}` : ''}`);
      q.title = `${t(`queue.${item.kind}`)} · ${remaining(item.end, o.now)}`;
      qCell.append(q);
    }
    tr.append(qCell);
    tr.append(h('td', `num mono age ${ageClass(r.ageMinutes)}`, ageText(r.ageMinutes)));
    tbody.append(tr);
  }
  table.append(tbody);

  const tfoot = h('tfoot');
  const fr = h('tr');
  fr.append(h('td', 'name', t('dash.total')), h('td'));
  fr.append(h('td', 'num mono m', fmt(sum.stock.metal)), h('td', 'num mono c', fmt(sum.stock.crystal)), h('td', 'num mono d', fmt(sum.stock.deuterium)));
  fr.append(h('td', 'num mono', `+${fmt(msu(sum.perHour) * 24)}`), h('td'), h('td'), h('td'));
  tfoot.append(fr);
  table.append(tfoot);

  wrap.append(table);
  tableCard.append(wrap);
  tableCard.append(h('p', 'hint', t('dash.tableHint')));
  panel.append(tableCard);
}

/** "Raccolta risorse": ships needed to bring resources to one body. Calculation only. */
function renderCollect(o: DashboardOptions, panel: HTMLElement, rows: BodyRow[]): void {
  const { doc, t, locale } = o;
  const fmt = (v: number) => formatUnits(v, locale);
  const classId = Number(doc.querySelector('meta[name="ogame-player-characterclass-id"]')?.getAttribute('content')) || null;
  if (!collect.capacity) collect.capacity = largeCargoCapacity(o.snapshot, classId);
  if (!rows.some((r) => r.id === collect.target)) {
    const here = Number(doc.querySelector('meta[name="ogame-planet-id"]')?.getAttribute('content'));
    collect.target = rows.some((r) => r.id === here) ? here : (rows[0]?.id ?? 0);
  }
  const target = rows.find((r) => r.id === collect.target);

  const card = h('div', 'card');
  card.append(h('h3', '', t('collect.title')));
  const form = h('div', 'form');

  const targetLabel = h('label', 'field');
  targetLabel.append(h('span', '', t('collect.target')));
  const select = h('select');
  for (const r of rows) {
    const opt = h('option', '', `${r.type === 'moon' ? '☾ ' : ''}${r.name} [${r.coords}]`);
    opt.value = String(r.id);
    opt.selected = r.id === collect.target;
    select.append(opt);
  }
  select.addEventListener('change', () => {
    collect.target = Number(select.value);
    openDashboard(o);
  });
  targetLabel.append(select);
  form.append(targetLabel);

  const picks = h('div', 'field');
  picks.append(h('span', '', t('collect.resources')));
  const pickRow = h('div', 'picks');
  for (const k of ['metal', 'crystal', 'deuterium'] as const) {
    const lab = h('label', `pick ${k[0]}`);
    const box = h('input');
    box.type = 'checkbox';
    box.checked = collect[k];
    box.addEventListener('change', () => {
      collect[k] = box.checked;
      openDashboard(o);
    });
    lab.append(box, doc.createTextNode(` ${t(`res.${k}`)}`));
    pickRow.append(lab);
  }
  picks.append(pickRow);
  form.append(picks);

  const capLabel = h('label', 'field');
  capLabel.append(h('span', '', t('collect.capacity')));
  const cap = h('input');
  cap.type = 'number';
  cap.min = '1';
  cap.value = String(collect.capacity);
  cap.addEventListener('change', () => {
    collect.capacity = Math.max(1, Math.floor(Number(cap.value) || 0));
    openDashboard(o);
  });
  capLabel.append(cap);
  form.append(capLabel);
  card.append(form);

  const plan = planCollection(rows, o.snapshot, collect.target, collect, collect.capacity);
  const wrap = h('div', 'table-wrap');
  const table = h('table');
  const head = h('tr');
  for (const [label, cls] of [
    [t('dash.colBody'), ''], [t('res.metal'), 'num'], [t('res.crystal'), 'num'], [t('res.deuterium'), 'num'],
    [t('collect.ships'), 'num'], [t('collect.available'), 'num'], ['', ''],
  ] as const) head.append(h('th', cls, label));
  const thead = h('thead');
  thead.append(head);
  table.append(thead);
  const tbody = h('tbody');
  const origin = doc.location?.origin ?? '';
  for (const r of plan.rows) {
    const tr = h('tr', r.type);
    const name = h('td', 'name');
    name.append(h('span', 'strong', `${r.type === 'moon' ? '☾ ' : ''}${r.name}`), h('span', 'coords', `[${r.coords}]`));
    tr.append(name);
    tr.append(h('td', 'num mono m', fmt(r.send.metal)), h('td', 'num mono c', fmt(r.send.crystal)), h('td', 'num mono d', fmt(r.send.deuterium)));
    tr.append(h('td', 'num mono', r.ships.toLocaleString(locale)));
    tr.append(h('td', `num mono${r.available < r.ships ? ' short' : ''}`, r.available.toLocaleString(locale)));
    const act = h('td', 'num');
    if (target) {
      const a = h('a', 'go', t('collect.open'));
      a.href = fleetLink(origin, r.id, { coords: target.coords, type: target.type }, Math.min(r.ships, r.available) || r.ships);
      a.title = t('collect.openHint');
      act.append(a);
    }
    tr.append(act);
    tbody.append(tr);
  }
  table.append(tbody);
  const foot = h('tfoot');
  const fr = h('tr');
  fr.append(h('td', 'name', t('dash.total')));
  fr.append(h('td', 'num mono m', fmt(plan.send.metal)), h('td', 'num mono c', fmt(plan.send.crystal)), h('td', 'num mono d', fmt(plan.send.deuterium)));
  fr.append(h('td', 'num mono', plan.ships.toLocaleString(locale)), h('td'), h('td'));
  foot.append(fr);
  table.append(foot);
  wrap.append(table);
  card.append(wrap);
  card.append(h('p', 'hint', t('collect.hint')));
  panel.append(card);
}
