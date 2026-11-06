/**
 * Spy table, inside the inbox's Espionage tab above the reports, drawn like the game's own list.
 * Every target spied in the last three days, one row per planet or moon (newest report wins),
 * ranked by loot per hour of flight from the player's nearest body. Idea from OGLight's spy
 * table; the twist is the ranking by MSU per hour and a board that survives deleting the reports.
 *
 * COMPLIANCE: stored data only, no network call (§4). No probe button (§1.5.1): rows link to the
 * galaxy view, to the game's fleet page with the target filled in (one normal navigation, `cp=`
 * only in a link the player clicks, §4.2; ships and Send stay with the player, §1.1) and to battle
 * simulators with the report's API key (opened by the player, see engines/sim-links).
 */
import { icon } from '../../core/icons';
import type { Store } from '../../core/storage';
import { formatUnits } from '../../core/format';
import { SHIPS_INFO_KEY, type ShipsInfo } from '../../data/fleet-dispatcher';
import { SERVER_DATA_KEY, type ServerData } from '../../data/server-data';
import { SPY_BOARD_KEY, targetRows, type Base, type SpyBoard, type TargetRow, type Universe } from '../../engines/raids';
import { gameSimLink, ogameToolsSimLink, osimsLink, simPrefill } from '../../engines/sim-links';
import { shipName, type T } from './index';

export const SPY_PANEL_ID = 'fut-spypanel';
const VIEW_KEY = 'spy.view';

type SortKey = 'target' | 'age' | 'loot' | 'def' | 'flight' | 'rate';
export interface View {
  sort: SortKey;
  desc: boolean;
  /** Cargo ship used for the count and the flight time: 202 small, 203 large. */
  ship: 202 | 203;
  hideDefended: boolean;
  inactiveOnly: boolean;
  open: boolean;
}
const DEFAULT_VIEW: View = { sort: 'rate', desc: true, ship: 203, hideDefended: false, inactiveOnly: false, open: true };

/** What the table needs from the rest of Future (built once per page in main). */
export interface SpyContext {
  bases: Base[];
  /** Combat research levels and character class, for the simulators' attacker side. */
  researches: Record<string, number>;
  classId: number;
  /** Server id for the simulators ("s808-en") and the player's interface language. */
  server: string;
  lang: string;
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

const isSpyTab = (doc: Document) => !!doc.querySelector('[data-subtab-id="20"].active, [data-subtab-id="20"][aria-selected="true"]');

/**
 * Draws the panel above the reports when the Espionage tab is open, removes it elsewhere.
 * Idempotent: called after every change the game makes to the inbox, it redraws only when the
 * board or the view changed.
 */
export function mountSpyPanel(o: SpyPanelOptions): void {
  const { doc } = o;
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
  const sig = JSON.stringify([Object.values(board).map((e) => e.id), view, Math.floor((o.now?.() ?? Date.now()) / 60_000)]);
  if (old && old.dataset.sig === sig && old.nextElementSibling === anchor) return;
  const panel = renderPanel(o, board, view);
  panel.dataset.sig = sig;
  if (old) old.replaceWith(panel);
  anchor!.before(panel);
}

function renderPanel(o: SpyPanelOptions, board: SpyBoard, view: View): HTMLElement {
  const { doc, store, t, locale, spy } = o;
  const now = o.now?.() ?? Date.now();
  const fmt = (n: number) => formatUnits(n, locale);
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
  /** A button in the game's own style (its <gradient-button> element). */
  const gameButton = (child: Node, title: string, onClick: () => void, cls = '') => {
    const wrap = el('gradient-button' as 'span', cls);
    wrap.setAttribute('sq20', '');
    const b = el('button', 'custom_btn');
    b.type = 'button';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.append(child);
    b.addEventListener('click', (e) => {
      e.preventDefault();
      onClick();
    });
    wrap.append(b);
    return wrap;
  };
  const gameIcon = (name: string) => {
    const img = el('img');
    img.src = `/cdn/img/icons/basic/${name}.png`;
    img.alt = '';
    img.width = img.height = 16;
    return img;
  };

  const ships = store.get<ShipsInfo>(SHIPS_INFO_KEY, {});
  const info = ships[String(view.ship)];
  const capacity = info?.capacity || (view.ship === 202 ? 5000 : 25000);
  const universe = universeOf(doc, store.get<ServerData | null>(SERVER_DATA_KEY, null));
  const all = targetRows(board, spy.bases, { capacity, speed: info?.speed ?? 0, universe, now });
  const rows = sortRows(all.filter((r) => (!view.hideDefended || !defended(r)) && (!view.inactiveOnly || r.entry.statuses.some((s) => INACTIVE.includes(s)))), view);

  const panel = el('div', 'fut-sp');
  panel.id = SPY_PANEL_ID;

  // Head: title with totals (opens/closes), then the filters in one row.
  const head = el('div', 'fut-sp-head');
  const toggle = el('button', 'fut-sp-title');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', String(view.open));
  toggle.append(el('b', '', t('spy.title')), el('span', '', t('spy.sub', { n: rows.length, msu: fmt(rows.reduce((s, r) => s + r.lootMsu, 0)) })));
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
    head.append(
      chip(shipName(203, ships, t), view.ship === 203, { ship: 203 }),
      chip(shipName(202, ships, t), view.ship === 202, { ship: 202 }),
      chip(t('spy.hideDefended'), view.hideDefended, { hideDefended: !view.hideDefended }),
      chip(t('spy.inactiveOnly'), view.inactiveOnly, { inactiveOnly: !view.inactiveOnly }),
    );
  }
  panel.append(head);
  if (!view.open) return panel;

  if (!info?.speed) panel.append(el('p', 'fut-sp-note', t('spy.noSpeed')));
  if (!rows.length) {
    panel.append(el('p', 'fut-sp-note', t(all.length ? 'spy.noneFiltered' : 'spy.none')));
    return panel;
  }

  // Column headers, sortable, like the game's own header row.
  const cols = el('div', 'fut-sp-row fut-sp-cols');
  const headers: [SortKey | null, string][] = [['target', 'spy.col.target'], ['age', 'spy.col.age'], ['loot', 'spy.col.loot'], [null, 'spy.col.ships'], ['def', 'spy.col.def'], ['rate', 'spy.col.rate'], [null, 'spy.col.actions']];
  for (const [key, label] of headers) {
    const c = el(key ? 'button' : 'span', `fut-sp-h${view.sort === key ? ' sortBy' : ''}`, t(label));
    if (key) {
      (c as HTMLButtonElement).type = 'button';
      c.setAttribute('aria-sort', view.sort === key ? (view.desc ? 'descending' : 'ascending') : 'none');
      c.addEventListener('click', () => redraw(view.sort === key ? { desc: !view.desc } : { sort: key, desc: key === 'loot' || key === 'rate' }));
    }
    cols.append(c);
  }
  panel.append(cols);

  const list = el('div', 'fut-sp-list');
  for (const r of rows) {
    const e = r.entry;
    const [g, s, p] = e.coords.split(':');
    const row = el('div', `fut-sp-row${defended(r) ? ' defended' : ''}`);

    const who = el('div', 'fut-sp-who');
    const name = el('span', 'fut-sp-name', e.playerName || '?');
    who.append(name);
    for (const st of e.statuses.filter((x) => x !== 'active')) who.append(el('span', `fut-sp-st st-${st}`, t(`spy.status.${st}`)));
    const gal = el('a', 'fut-sp-coords', `[${e.coords}]`);
    gal.href = `/game/index.php?page=ingame&component=galaxy&galaxy=${g}&system=${s}`;
    if (e.moon) gal.prepend(icon(doc, 'moon', 10, 'fut-sp-moon'));
    who.append(gal);

    const age = el('div', 'fut-sp-num');
    age.append(
      el('span', r.ageMinutes > 360 ? 'old' : r.ageMinutes > 60 ? 'warm' : 'fresh', r.ageMinutes < 60 ? `${r.ageMinutes}m` : `${Math.floor(r.ageMinutes / 60)}h`),
      el('small', e.activity === 0 ? 'bad' : e.activity < 60 ? 'warm' : '', e.activity === 0 ? t('msg.spy.active') : e.activity >= 60 ? '>60m' : `${e.activity}m`),
    );
    age.title = new Date(e.at).toLocaleString(locale);

    const loot = el('div', 'fut-sp-num');
    loot.append(el('b', '', fmt(r.lootMsu)), el('small', '', `${fmt(e.res.metal * e.loot)} · ${fmt(e.res.crystal * e.loot)} · ${fmt(e.res.deuterium * e.loot)}`));
    loot.title = `${Math.round(e.loot * 100)}% · ${r.lootRes.toLocaleString(locale)}`;

    const cargo = el('div', 'fut-sp-num', r.ships ? `${r.ships.toLocaleString(locale)}×` : '0');
    cargo.title = shipName(view.ship, ships, t);
    const def = el('div', `fut-sp-num${defended(r) ? ' warm' : ''}`, e.defValue < 0 || e.fleetValue < 0 ? '?' : defended(r) ? fmt(Math.max(0, e.defValue) + Math.max(0, e.fleetValue)) : '0');
    def.title = `${t('msg.spy.fleet')} ${e.fleetValue < 0 ? '?' : fmt(e.fleetValue)} · ${t('msg.spy.def')} ${e.defValue < 0 ? '?' : fmt(e.defValue)}`;

    const rate = el('div', 'fut-sp-num');
    rate.append(el('b', 'rate', r.msuPerHour !== null ? `${fmt(r.msuPerHour)}/h` : '—'), el('small', '', r.flight !== null ? duration(r.flight) : '—'));
    if (r.base) rate.title = t('spy.from', { name: r.base.name, coords: r.base.coords });

    const acts = el('div', 'fut-sp-acts');
    if (r.base) {
      const base = r.base;
      acts.append(gameButton(gameIcon('attack'), t('spy.attackHint', { name: base.name }), () => {
        doc.location.assign(`/game/index.php?page=ingame&component=fleetdispatch&cp=${base.id}&galaxy=${g}&system=${s}&position=${p}&type=${e.moon ? 3 : 1}&mission=1`);
      }));
    }
    if (e.apiKey) {
      const key = e.apiKey;
      const open = (url: string) => doc.defaultView?.open(url, '_blank', 'noopener');
      const prefill = () => simPrefill(spy.server, r.base ? { coords: r.base.coords, researches: spy.researches, classId: spy.classId } : null, e.coords);
      acts.append(
        gameButton(gameIcon('speed'), t('spy.simGame'), () => open(gameSimLink(key))),
        gameButton(el('span', 'fut-sp-tool', 'OS'), t('spy.simOsims'), () => open(osimsLink(key, prefill()))),
        gameButton(el('span', 'fut-sp-tool', 'OT'), t('spy.simOgameTools'), () => open(ogameToolsSimLink(key, spy.lang, prefill()))),
      );
    }
    acts.append(gameButton(icon(doc, 'close', 12), t('spy.remove'), () => {
      const b = store.get<SpyBoard>(SPY_BOARD_KEY, {});
      delete b[e.key];
      store.set(SPY_BOARD_KEY, b);
      mountSpyPanel(o);
    }, 'fut-sp-del'));

    row.append(who, age, loot, cargo, def, rate, acts);
    list.append(row);
  }
  panel.append(list, el('p', 'fut-sp-note', t('spy.hint')));
  return panel;
}
