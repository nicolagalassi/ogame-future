/**
 * Spy table, inside the inbox's Espionage tab above the reports. Every target spied in the last
 * three days, one row per planet or moon (newest report wins), with what matters for a raid:
 * the resources you can carry away, the fleet and the defence. Idea from OGLight's spy table; the
 * board survives deleting the reports. Reports shared by the alliance count too, unless turned off
 * in the settings.
 *
 * COMPLIANCE: stored data only, no network call (§4). No probe button (§1.5.1): the name opens the
 * game's own report window, Attack opens the game's fleet page with the target and the cargo ships
 * filled in (one normal navigation, `cp=` only in a link the player clicks, §4.2; Send stays with
 * the player, §1.1), Simulate opens the picked simulator with the report's API key.
 */
import { icon } from '../../core/icons';
import type { Store } from '../../core/storage';
import { formatUnits } from '../../core/format';
import { SHIPS_INFO_KEY, type ShipsInfo } from '../../data/fleet-dispatcher';
import { SERVER_DATA_KEY, type ServerData } from '../../data/server-data';
import type { LfBonuses } from '../../data/bonuses';
import { SPY_BOARD_KEY, targetRows, type Base, type SpyBoard, type TargetRow, type Universe } from '../../engines/raids';
import { SIM_KEY, SIM_TOOLS, simLink, simPrefill, simTool } from '../../engines/sim-links';
import { shipIcon, shipName, type T } from './index';
import { ensureMarksStyle, flagButton } from '../marks/picker';

export const SPY_PANEL_ID = 'fut-spypanel';
const VIEW_KEY = 'spy.view';
/** Settings: show the reports the alliance shared (default yes). */
export const SPY_SHARED_KEY = 'spy.shared';

type SortKey = 'target' | 'age' | 'loot' | 'fleet' | 'def';
const SORT_KEYS: SortKey[] = ['target', 'age', 'loot', 'fleet', 'def'];
export interface View {
  sort: SortKey;
  desc: boolean;
  /** Cargo ship used for the count on the attack: 202 small, 203 large. */
  ship: 202 | 203;
  hideDefended: boolean;
  inactiveOnly: boolean;
  open: boolean;
}
const DEFAULT_VIEW: View = { sort: 'loot', desc: true, ship: 203, hideDefended: false, inactiveOnly: false, open: true };

/** What the table needs from the rest of Future (built once per page in main). */
export interface SpyContext {
  bases: Base[];
  /** Combat research levels and character class, for the simulators' attacker side. */
  researches: Record<string, number>;
  classId: number;
  /** Server id for the simulators ("s808-en") and the player's interface language. */
  server: string;
  lang: string;
  /** Alliance class id and lifeform bonuses, for the simulators (as OGLight fills them). */
  allianceClass?: number;
  lf?: LfBonuses | null;
}

export interface SpyPanelOptions {
  doc: Document;
  store: Store;
  locale: string;
  t: T;
  spy: SpyContext;
  now?: () => number;
}

/** Universe shape from the public API (cached), else from the page's meta tags. */
export function universeOf(doc: Document, data: ServerData | null): Universe {
  const meta = (name: string) => doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? '';
  return {
    galaxies: data?.galaxies || 9,
    systems: data?.systems || 499,
    donutGalaxy: data ? data.donutGalaxy : meta('ogame-donut-galaxy') !== '0',
    donutSystem: data ? data.donutSystem : meta('ogame-donut-system') !== '0',
    fleetSpeed: data?.speedFleetWar || Number(meta('ogame-universe-speed-fleet-war')) || 1,
  };
}

const INACTIVE = ['inactive', 'longinactive'];
const defended = (r: TargetRow) => r.entry.defValue !== 0 || r.entry.fleetValue !== 0;

export function sortRows(rows: TargetRow[], view: Pick<View, 'sort' | 'desc'>): TargetRow[] {
  const val = (r: TargetRow): number | string => {
    switch (view.sort) {
      case 'target': return r.entry.playerName.toLowerCase();
      case 'age': return r.ageMinutes;
      case 'loot': return r.lootRes;
      case 'fleet': return r.entry.fleetValue;
      case 'def': return r.entry.defValue;
    }
  };
  const dir = view.desc ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = val(a), y = val(b);
    return (x < y ? -1 : x > y ? 1 : 0) * dir;
  });
}

const isSpyTab = (doc: Document) => !!doc.querySelector('[data-subtab-id="20"].active, [data-subtab-id="20"][aria-selected="true"]');

/**
 * Draws the panel above the reports when the Espionage tab is open, removes it elsewhere.
 * Idempotent: called after every change the game makes to the inbox, it redraws only when the
 * board or the view changed.
 */
export function mountSpyPanel(o: SpyPanelOptions): void {
  const { doc } = o;
  ensureMarksStyle(doc);
  const holder = doc.querySelector('#messages .messagesHolder');
  // Above the game's own column headers (sort row), which belong to the reports below.
  const sortRow = doc.querySelector('#messages #filteredHeadersRow');
  const anchor = sortRow && sortRow.parentElement === holder?.parentElement ? sortRow : holder;
  const old = doc.getElementById(SPY_PANEL_ID);
  if (!holder || !isSpyTab(doc)) {
    old?.remove();
    return;
  }
  const board = o.store.get<SpyBoard>(SPY_BOARD_KEY, {});
  const view: View = { ...DEFAULT_VIEW, ...o.store.get<Partial<View>>(VIEW_KEY, {}) };
  // A sort saved before 2026-11-10 (MSU per hour, flight) falls back to the loot.
  if (!SORT_KEYS.includes(view.sort)) view.sort = 'loot';
  const prefs = [o.store.get<boolean>(SPY_SHARED_KEY, true), o.store.get<string>(SIM_KEY, 'osims')];
  const sig = JSON.stringify([Object.values(board).map((e) => e.id), view, prefs, Math.floor((o.now?.() ?? Date.now()) / 60_000)]);
  if (old && old.dataset.sig === sig && old.nextElementSibling === anchor) return;
  const panel = renderPanel(o, board, view);
  panel.dataset.sig = sig;
  if (old) old.remove();
  anchor!.before(panel);
}

function renderPanel(o: SpyPanelOptions, board: SpyBoard, view: View): HTMLElement {
  const { doc, store, t, locale, spy } = o;
  const now = o.now?.() ?? Date.now();
  const fmt = (n: number) => formatUnits(n, locale);
  const exact = (n: number) => Math.round(n).toLocaleString(locale);
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string) => {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const redraw = (next: Partial<View> = {}) => {
    store.set(VIEW_KEY, { ...view, ...next });
    mountSpyPanel(o);
  };
  const button = (cls: string, text: string, title: string, onClick: () => void) => {
    const b = el('button', cls, text);
    b.type = 'button';
    b.title = title;
    b.addEventListener('click', (ev) => {
      ev.preventDefault();
      onClick();
    });
    return b;
  };

  const ships = store.get<ShipsInfo>(SHIPS_INFO_KEY, {});
  const info = ships[String(view.ship)];
  const capacity = info?.capacity || (view.ship === 202 ? 5000 : 25000);
  const universe = universeOf(doc, store.get<ServerData | null>(SERVER_DATA_KEY, null));
  const showShared = store.get<boolean>(SPY_SHARED_KEY, true);
  const tool = simTool(store.get<string>(SIM_KEY, 'osims'));
  const all = targetRows(board, spy.bases, { capacity, speed: info?.speed ?? 0, universe, now }).filter((r) => showShared || !r.entry.shared);
  const rows = sortRows(all.filter((r) => (!view.hideDefended || !defended(r)) && (!view.inactiveOnly || r.entry.statuses.some((s) => INACTIVE.includes(s)))), view);

  const panel = el('div', 'fut-sp');
  panel.id = SPY_PANEL_ID;

  // Head: title with totals (opens/closes), then the filters on their own row.
  const head = el('div', 'fut-sp-head');
  const toggle = el('button', 'fut-sp-title');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', String(view.open));
  toggle.append(icon(doc, 'chevron', 12, 'fut-sp-chev'), el('b', '', t('spy.title')), el('span', '', t('spy.sub', { n: rows.length, loot: fmt(rows.reduce((s, r) => s + r.lootRes, 0)) })));
  toggle.addEventListener('click', () => redraw({ open: !view.open }));
  head.append(toggle);
  if (view.open) {
    const chip = (text: string, pressed: boolean, next: Partial<View>) => {
      const b = el('button', 'fut-sp-chip', text);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(pressed));
      b.addEventListener('click', () => redraw(next));
      return b;
    };
    // The cargo ship is one choice of two: a segmented pair. The filters are toggles.
    const cargo = el('span', 'fut-sp-group');
    cargo.setAttribute('role', 'group');
    cargo.setAttribute('aria-label', t('spy.cargoShip'));
    cargo.append(chip(shipName(203, ships, t), view.ship === 203, { ship: 203 }), chip(shipName(202, ships, t), view.ship === 202, { ship: 202 }));
    head.append(
      cargo,
      chip(t('spy.hideDefended'), view.hideDefended, { hideDefended: !view.hideDefended }),
      chip(t('spy.inactiveOnly'), view.inactiveOnly, { inactiveOnly: !view.inactiveOnly }),
    );
  }
  panel.append(head);
  if (!view.open) return panel;

  if (!rows.length) {
    panel.append(el('p', 'fut-sp-note', t(all.length ? 'spy.noneFiltered' : 'spy.none')));
    return panel;
  }

  // A table for assistive tech: header row with sortable column headers, then one row per target.
  const table = el('div', 'fut-sp-table');
  table.setAttribute('role', 'table');
  table.setAttribute('aria-label', t('spy.title'));
  const cols = el('div', 'fut-sp-row fut-sp-cols');
  cols.setAttribute('role', 'row');
  const headers: [SortKey | null, string][] = [['target', 'spy.col.target'], ['age', 'spy.col.age'], ['loot', 'spy.col.loot'], ['fleet', 'spy.col.fleet'], ['def', 'spy.col.def'], [null, 'spy.col.actions']];
  for (const [key, label] of headers) {
    const cell = el('div');
    cell.setAttribute('role', 'columnheader');
    const c = el(key ? 'button' : 'span', `fut-sp-h${view.sort === key ? ' sortBy' : ''}`, t(label));
    if (key && view.sort === key) c.append(icon(doc, 'chevron', 10, 'fut-sp-sort'));
    if (key) {
      (c as HTMLButtonElement).type = 'button';
      cell.setAttribute('aria-sort', view.sort === key ? (view.desc ? 'descending' : 'ascending') : 'none');
      c.addEventListener('click', () => redraw(view.sort === key ? { desc: !view.desc } : { sort: key, desc: key !== 'target' && key !== 'age' }));
    } else c.setAttribute('aria-label', t('spy.col.actionsName'));
    cell.append(c);
    cols.append(cell);
  }
  table.append(cols);

  const list = el('div', 'fut-sp-list');
  list.setAttribute('role', 'rowgroup');
  for (const r of rows) {
    const e = r.entry;
    const [g, s, p] = e.coords.split(':');
    const row = el('div', `fut-sp-row${defended(r) ? ' defended' : ''}`);
    row.setAttribute('role', 'row');

    // Who: the name opens the full report in the game's own window; coordinates go to the galaxy.
    const who = el('div', 'fut-sp-who');
    const top = el('div', 'fut-sp-line');
    const name = el('a', 'fut-sp-name overlay', e.playerName || '?');
    name.href = `${doc.location.origin}/game/index.php?page=ajax&component=messagedetails&messageId=${encodeURIComponent(e.id)}`;
    name.dataset.overlayTitle = t('spy.report');
    name.title = t('spy.reportHint', { name: e.playerName || '?' });
    top.append(name, flagButton({ doc, store, t }, e.playerId, e.playerName));
    if (e.shared) {
      const ally = el('span', 'fut-sp-st st-shared', t('spy.shared'));
      ally.title = t('spy.sharedHint');
      top.append(ally);
    }
    for (const st of e.statuses.filter((x) => x !== 'active')) top.append(el('span', `fut-sp-st st-${st}`, t(`spy.status.${st}`)));
    const gal = el('a', 'fut-sp-coords', `[${e.coords}]`);
    gal.href = `/game/index.php?page=ingame&component=galaxy&galaxy=${g}&system=${s}`;
    if (e.moon) gal.prepend(icon(doc, 'moon', 10, 'fut-sp-moon'));
    const bottom = el('div', 'fut-sp-line');
    bottom.append(gal);
    who.append(top, bottom);

    const age = el('div', 'fut-sp-num');
    age.append(
      el('b', r.ageMinutes > 360 ? 'old' : r.ageMinutes > 60 ? 'warm' : 'fresh', r.ageMinutes < 60 ? `${r.ageMinutes}m` : `${Math.floor(r.ageMinutes / 60)}h`),
      el('small', e.activity === 0 ? 'bad' : e.activity < 60 ? 'warm' : '', e.activity === 0 ? t('msg.spy.active') : e.activity >= 60 ? '>60m' : `${e.activity}m`),
    );
    age.title = new Date(e.at).toLocaleString(locale);

    // Loot: the resources you can carry away (not MSU), and under it the cargo ships it takes.
    const loot = el('div', 'fut-sp-num');
    const need = el('small', '', r.ships.toLocaleString(locale));
    need.prepend(shipIcon(doc, view.ship, shipName(view.ship, ships, t), 'fut-msg-icon'));
    loot.append(el('b', '', fmt(r.lootRes)), need);
    loot.title = t('spy.lootHint', {
      pct: Math.round(e.loot * 100),
      m: fmt(e.res.metal * e.loot), c: fmt(e.res.crystal * e.loot), d: fmt(e.res.deuterium * e.loot),
      n: r.ships.toLocaleString(locale), ship: shipName(view.ship, ships, t),
    });

    const value = (v: number, label: string) => {
      const cell = el('div', 'fut-sp-num');
      cell.append(el('b', v < 0 ? 'warm' : v > 0 ? 'warm' : 'zero', v < 0 ? '?' : v > 0 ? fmt(v) : '0'));
      cell.title = `${label}: ${v < 0 ? t('spy.hidden') : exact(v)}`;
      return cell;
    };

    // Actions: attack (the main one), simulate, remove.
    const acts = el('div', 'fut-sp-acts');
    if (r.base) {
      const base = r.base;
      const am = r.ships > 0 ? `&am${view.ship}=${r.ships}` : '';
      acts.append(button('fut-sp-attack', t('spy.attack'), t('spy.attackHint', { name: base.name, n: r.ships.toLocaleString(locale), ship: shipName(view.ship, ships, t) }), () => {
        doc.location.assign(`/game/index.php?page=ingame&component=fleetdispatch&cp=${base.id}&galaxy=${g}&system=${s}&position=${p}&type=${e.moon ? 3 : 1}&mission=1${am}`);
      }));
    }
    if (e.apiKey) {
      const key = e.apiKey;
      acts.append(button('fut-sp-sim', t('spy.simulate'), t('spy.simulateHint', { tool: SIM_TOOLS[tool].name }), () => {
        const prefill = simPrefill(spy.server, r.base ? { coords: r.base.coords, researches: spy.researches, classId: spy.classId, allianceClass: spy.allianceClass, lf: spy.lf ?? undefined } : null, e.coords);
        doc.defaultView?.open(simLink(tool, key, spy.lang, prefill), '_blank', 'noopener');
      }));
    }
    const del = button('fut-sp-del', '', t('spy.remove'), () => {
      const b = store.get<SpyBoard>(SPY_BOARD_KEY, {});
      delete b[e.key];
      store.set(SPY_BOARD_KEY, b);
      mountSpyPanel(o);
    });
    del.setAttribute('aria-label', t('spy.remove'));
    del.append(icon(doc, 'close', 11));
    acts.append(del);

    const cells = [who, age, loot, value(e.fleetValue, t('msg.spy.fleet')), value(e.defValue, t('msg.spy.def')), acts];
    for (const c of cells) c.setAttribute('role', 'cell');
    row.append(...cells);
    list.append(row);
  }
  table.append(list);
  panel.append(table, el('p', 'fut-sp-note', t('spy.hint')));
  return panel;
}
