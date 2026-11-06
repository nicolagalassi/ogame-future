/**
 * Spy table: every target spied in the last three days, one row per planet or moon (newest
 * report wins), ranked by loot per hour of flight from the player's nearest body.
 * Idea from OGLight's spy table; the twist is the ranking by MSU per hour and the board that
 * survives deleting the reports.
 *
 * COMPLIANCE: stored data only, no network call (§4). No probe button (§1.5.1): the row links
 * to the galaxy view and to the game's fleet page with the target filled in. That is one
 * normal navigation per click (`cp=` only in a link the player clicks, §4.2); choosing ships
 * and pressing Send stay with the player (§1.1).
 */
import { icon } from '../../core/icons';
import { WINDOW_SHEET } from '../../core/sheet';
import type { Store } from '../../core/storage';
import { formatUnits } from '../../core/format';
import { SHIPS_INFO_KEY, type ShipsInfo } from '../../data/fleet-dispatcher';
import { SPY_BOARD_KEY, targetRows, type Base, type SpyBoard, type TargetRow, type Universe } from '../../engines/raids';
import { shipName, type T } from './index';
import { SPY_TABLE_CSS } from './style';

export const SPY_TABLE_ID = 'fut-spytable';
const VIEW_KEY = 'spy.view';

type SortKey = 'target' | 'age' | 'activity' | 'loot' | 'def' | 'flight' | 'rate';
interface View {
  sort: SortKey;
  desc: boolean;
  /** Cargo ship used for the count and the flight time: 202 small, 203 large. */
  ship: 202 | 203;
  hideDefended: boolean;
  inactiveOnly: boolean;
}
const DEFAULT_VIEW: View = { sort: 'rate', desc: true, ship: 203, hideDefended: false, inactiveOnly: false };

export interface SpyTableOptions {
  doc: Document;
  store: Store;
  bases: Base[];
  now: number;
  locale: string;
  t: T;
}

let keyHandler: ((e: KeyboardEvent) => void) | null = null;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Universe shape from the game's meta tags; 9 galaxies × 499 systems when the page does not say. */
export function universeOf(doc: Document): Universe {
  const meta = (name: string) => doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? '';
  return {
    galaxies: Number(meta('ogame-universe-galaxies')) || 9,
    systems: Number(meta('ogame-universe-systems')) || 499,
    donutGalaxy: meta('ogame-donut-galaxy') !== '0',
    donutSystem: meta('ogame-donut-system') !== '0',
    fleetSpeed: Number(meta('ogame-universe-speed-fleet-war')) || 1,
  };
}

export function closeSpyTable(doc: Document): void {
  doc.getElementById(SPY_TABLE_ID)?.remove();
  if (keyHandler) doc.removeEventListener('keydown', keyHandler, true);
  keyHandler = null;
}

const INACTIVE = ['inactive', 'longinactive'];
const defended = (r: TargetRow) => r.entry.defValue !== 0 || r.entry.fleetValue !== 0;

export function sortRows(rows: TargetRow[], view: View): TargetRow[] {
  const val = (r: TargetRow): number | string => {
    switch (view.sort) {
      case 'target': return r.entry.playerName.toLowerCase();
      case 'age': return r.ageMinutes;
      case 'activity': return r.entry.activity;
      case 'loot': return r.lootMsu;
      case 'def': return Math.max(0, r.entry.defValue) + Math.max(0, r.entry.fleetValue);
      case 'flight': return r.flight ?? Infinity;
      case 'rate': return r.msuPerHour ?? r.lootMsu / 1e9;
    }
  };
  const dir = view.desc ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = val(a), y = val(b);
    return (x < y ? -1 : x > y ? 1 : 0) * dir;
  });
}

const duration = (s: number) => {
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return hh ? `${hh}h ${String(mm).padStart(2, '0')}m` : `${mm}m ${String(ss).padStart(2, '0')}s`;
};

export function openSpyTable(o: SpyTableOptions): void {
  const { doc, store, t, locale } = o;
  const fmt = (n: number) => formatUnits(n, locale);
  const keepScroll = doc.getElementById(SPY_TABLE_ID)?.shadowRoot?.querySelector('.backdrop')?.scrollTop ?? 0;
  closeSpyTable(doc);
  const view: View = { ...DEFAULT_VIEW, ...store.get<Partial<View>>(VIEW_KEY, {}) };
  const save = (next: Partial<View>) => {
    store.set(VIEW_KEY, { ...view, ...next });
    openSpyTable(o);
  };
  const board = store.get<SpyBoard>(SPY_BOARD_KEY, {});
  const ships = store.get<ShipsInfo>(SHIPS_INFO_KEY, {});
  const info = ships[String(view.ship)];
  const capacity = info?.capacity || (view.ship === 202 ? 5000 : 25000);
  const all = targetRows(board, o.bases, { capacity, speed: info?.speed ?? 0, universe: universeOf(doc), now: o.now });
  const rows = sortRows(all.filter((r) => (!view.hideDefended || !defended(r)) && (!view.inactiveOnly || r.entry.statuses.some((s) => INACTIVE.includes(s)))), view);

  const host = doc.createElement('div');
  host.id = SPY_TABLE_ID;
  host.lang = locale;
  const root = host.attachShadow({ mode: 'open' });
  const style = h('style');
  style.textContent = WINDOW_SHEET + SPY_TABLE_CSS;
  const backdrop = h('div', 'backdrop');
  const panel = h('section', 'panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', t('spy.title'));
  backdrop.append(panel);
  root.append(style, backdrop);
  const close = () => closeSpyTable(doc);
  keyHandler = (e) => { if (e.key === 'Escape') close(); };
  doc.addEventListener('keydown', keyHandler, true);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

  const head = h('header', 'head');
  const titles = h('div', 'titles');
  const total = rows.reduce((s, r) => s + r.lootMsu, 0);
  titles.append(h('h2', '', t('spy.title')), h('span', 'sub', t('spy.sub', { n: rows.length, msu: fmt(total) })));
  const x = h('button', 'close');
  x.type = 'button';
  x.setAttribute('aria-label', t('dash.close'));
  x.append(icon(doc, 'close', 16));
  x.addEventListener('click', close);
  head.append(titles, x);
  panel.append(head);

  // Filters in one row above the table.
  const bar = h('div', 'filters');
  const chip = (text: string, pressed: boolean, onClick: () => void) => {
    const b = h('button', 'chip', text);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(pressed));
    b.addEventListener('click', onClick);
    return b;
  };
  bar.append(
    chip(shipName(203, ships, t), view.ship === 203, () => save({ ship: 203 })),
    chip(shipName(202, ships, t), view.ship === 202, () => save({ ship: 202 })),
    h('span', 'sep'),
    chip(t('spy.hideDefended'), view.hideDefended, () => save({ hideDefended: !view.hideDefended })),
    chip(t('spy.inactiveOnly'), view.inactiveOnly, () => save({ inactiveOnly: !view.inactiveOnly })),
  );
  panel.append(bar);
  if (!info?.speed) panel.append(h('p', 'hint', t('spy.noSpeed')));

  const body = h('div', 'tab-body');
  if (!rows.length) body.append(h('p', 'empty', t(all.length ? 'spy.noneFiltered' : 'spy.none')));
  else {
    const wrap = h('div', 'table-wrap');
    const table = h('table', 'spy');
    const thead = h('thead');
    const hr = h('tr');
    const cols: [SortKey | null, string][] = [
      ['target', 'spy.col.target'], ['age', 'spy.col.age'], ['activity', 'spy.col.activity'], ['loot', 'spy.col.loot'],
      [null, 'spy.col.ships'], ['def', 'spy.col.def'], ['flight', 'spy.col.flight'], ['rate', 'spy.col.rate'], [null, 'spy.col.actions'],
    ];
    for (const [key, label] of cols) {
      const th = h('th', key === 'target' || label === 'spy.col.actions' ? '' : 'num');
      if (key) {
        const b = h('button', 'sort', t(label) + (view.sort === key ? (view.desc ? ' ↓' : ' ↑') : ''));
        b.type = 'button';
        th.setAttribute('aria-sort', view.sort === key ? (view.desc ? 'descending' : 'ascending') : 'none');
        b.addEventListener('click', () => save(view.sort === key ? { desc: !view.desc } : { sort: key, desc: key !== 'target' && key !== 'age' && key !== 'flight' && key !== 'def' }));
        th.append(b);
      } else th.textContent = t(label);
      hr.append(th);
    }
    thead.append(hr);
    table.append(thead);
    const tbody = h('tbody');
    for (const r of rows) {
      const e = r.entry;
      const [g, s, p] = e.coords.split(':');
      const tr = h('tr', defended(r) ? 'defended' : '');
      const who = h('td', 'who');
      who.append(h('strong', '', e.playerName || '?'));
      for (const st of e.statuses.filter((x) => x !== 'active')) who.append(h('span', `st st-${st}`, t(`spy.status.${st}`)));
      const gal = h('a', 'coords', `[${e.coords}]`);
      gal.href = `/game/index.php?page=ingame&component=galaxy&galaxy=${g}&system=${s}`;
      if (e.moon) gal.prepend(icon(doc, 'moon', 10, 'moon'));
      who.append(gal);
      const age = h('td', `num ${r.ageMinutes > 360 ? 'old' : r.ageMinutes > 60 ? 'warm' : 'fresh'}`, r.ageMinutes < 60 ? `${r.ageMinutes}m` : `${Math.floor(r.ageMinutes / 60)}h`);
      age.title = new Date(e.at).toLocaleString(locale);
      const act = h('td', `num ${e.activity === 0 ? 'bad' : e.activity < 60 ? 'warn' : ''}`, e.activity === 0 ? t('msg.spy.active') : e.activity >= 60 ? '>60m' : `${e.activity}m`);
      const loot = h('td', 'num');
      loot.append(h('b', '', fmt(r.lootMsu)), h('span', 'res', `${fmt(e.res.metal * e.loot)} · ${fmt(e.res.crystal * e.loot)} · ${fmt(e.res.deuterium * e.loot)}`));
      loot.title = `${Math.round(e.loot * 100)}% · ${r.lootRes.toLocaleString(locale)}`;
      const def = h('td', 'num', e.defValue < 0 || e.fleetValue < 0 ? '?' : defended(r) ? fmt(Math.max(0, e.defValue) + Math.max(0, e.fleetValue)) : '0');
      def.title = `${t('msg.spy.fleet')} ${e.fleetValue < 0 ? '?' : fmt(e.fleetValue)} · ${t('msg.spy.def')} ${e.defValue < 0 ? '?' : fmt(e.defValue)}`;
      const flight = h('td', 'num');
      if (r.base) {
        const from = h('span', 'res', r.base.name);
        if (r.base.moon) from.prepend(icon(doc, 'moon', 10, 'moon'));
        flight.append(h('span', '', r.flight !== null ? duration(r.flight) : '—'), from);
        flight.title = `${r.base.name} [${r.base.coords}]`;
      } else flight.textContent = '—';
      const rate = h('td', 'num rate', r.msuPerHour !== null ? `${fmt(r.msuPerHour)}/h` : '—');
      const acts = h('td', 'acts');
      if (r.base) {
        const go = h('a', 'act', t('spy.attack'));
        go.href = `/game/index.php?page=ingame&component=fleetdispatch&cp=${r.base.id}&galaxy=${g}&system=${s}&position=${p}&type=${e.moon ? 3 : 1}&mission=1`;
        go.title = t('spy.attackHint', { name: r.base.name });
        acts.append(go);
      }
      const del = h('button', 'act ghost');
      del.append(icon(doc, 'close', 12));
      del.type = 'button';
      del.setAttribute('aria-label', t('spy.remove'));
      del.title = t('spy.remove');
      del.addEventListener('click', () => {
        const b = store.get<SpyBoard>(SPY_BOARD_KEY, {});
        delete b[e.key];
        store.set(SPY_BOARD_KEY, b);
        openSpyTable(o);
      });
      acts.append(del);
      tr.append(who, age, act, loot, h('td', 'num', r.ships ? `${r.ships.toLocaleString(locale)}×` : '0'), def, flight, rate, acts);
      tbody.append(tr);
    }
    table.append(tbody);
    wrap.append(table);
    body.append(wrap);
  }
  body.append(h('p', 'hint', t('spy.hint')));
  panel.append(body);
  doc.body.append(host);
  backdrop.scrollTop = keepScroll;
}
