/**
 * Spy table, inside the inbox's Espionage tab above the reports. Every target spied in the last
 * three days, one compact row per planet or moon (newest report wins), with what matters for a raid:
 * the resources you can carry away, the fleet and the defence; the columns can be sorted and moved,
 * and each row opens the next three raids with the cargo ships each one needs. Idea and layout from
 * OGLight's spy table; the board survives deleting the reports. Reports shared by the alliance count too, unless turned off
 * in the settings.
 *
 * COMPLIANCE: stored data only, no network call (§4). No probe button (§1.5.1): the name opens the
 * game's own report window, Attack opens the game's fleet page of the selected planet or moon with the
 * target filled in (the raid links add the cargo ships) (one normal navigation, no `cp=`, §4.2; Send stays with
 * the player, §1.1), Simulate opens the picked simulator with the report's API key.
 */
import { icon } from '../../core/icons';
import type { Store } from '../../core/storage';
import { formatUnits } from '../../core/format';
import { SHIPS_INFO_KEY, type ShipsInfo } from '../../data/fleet-dispatcher';
import { SERVER_DATA_KEY, type ServerData } from '../../data/server-data';
import type { LfBonuses } from '../../data/bonuses';
import { raidWaves, SPY_BOARD_KEY, targetRows, type Base, type SpyBoard, type TargetRow, type Universe } from '../../engines/raids';
import { SIM_KEY, SIM_TOOLS, simLink, simPrefill, simTool } from '../../engines/sim-links';
import { shipIcon, shipName, type T } from './index';
import { ensureMarksStyle, flagButton } from '../marks/picker';

export const SPY_PANEL_ID = 'fut-spypanel';
const VIEW_KEY = 'spy.view';
/** Settings: show the reports the alliance shared (default yes). */
export const SPY_SHARED_KEY = 'spy.shared';

/** Columns the player can sort and move; the row number and the actions stay at the ends. */
export type ColKey = 'age' | 'act' | 'coords' | 'target' | 'loot' | 'fleet' | 'def';
export const COLS: ColKey[] = ['age', 'act', 'coords', 'target', 'loot', 'fleet', 'def'];
const WIDTH: Record<ColKey, string> = { age: '36px', act: '28px', coords: '74px', target: 'minmax(0, 1fr)', loot: '58px', fleet: '50px', def: '50px' };
const RIGHT: ColKey[] = ['loot', 'fleet', 'def'];

export interface View {
  sort: ColKey;
  desc: boolean;
  cols: ColKey[];
  hideDefended: boolean;
  inactiveOnly: boolean;
  open: boolean;
}
const DEFAULT_VIEW: View = { sort: 'loot', desc: true, cols: COLS, hideDefended: false, inactiveOnly: false, open: true };

/** Rows whose raid details are open (this page only). */
const expanded = new Set<string>();

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

/** "1:476:11" → a number that sorts by galaxy, system, position. */
const coordsRank = (c: string) => c.split(':').reduce((n, x) => n * 1000 + Number(x), 0);

export function sortRows(rows: TargetRow[], view: Pick<View, 'sort' | 'desc'>): TargetRow[] {
  const val = (r: TargetRow): number | string => {
    switch (view.sort) {
      case 'target': return r.entry.playerName.toLowerCase();
      case 'age': return r.ageMinutes;
      // Active now first, then by minutes; no activity (60+) last.
      case 'act': return r.entry.activity;
      case 'coords': return coordsRank(r.entry.coords) * 2 + (r.entry.moon ? 1 : 0);
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

/** The saved column order when it still names every column once, else the default one. */
export function columnOrder(saved: unknown): ColKey[] {
  return Array.isArray(saved) && saved.length === COLS.length && COLS.every((c) => saved.includes(c)) ? (saved as ColKey[]) : COLS;
}

/** `cols` with `key` moved to where `to` is. */
export function moveColumn(cols: ColKey[], key: ColKey, to: ColKey): ColKey[] {
  if (key === to) return cols;
  const rest = cols.filter((c) => c !== key);
  const at = rest.indexOf(to) + (cols.indexOf(key) < cols.indexOf(to) ? 1 : 0);
  return [...rest.slice(0, at), key, ...rest.slice(at)];
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
  if (!COLS.includes(view.sort)) view.sort = 'loot';
  view.cols = columnOrder(view.cols);
  const prefs = [o.store.get<boolean>(SPY_SHARED_KEY, true), o.store.get<string>(SIM_KEY, 'osims'), [...expanded]];
  const sig = JSON.stringify([Object.values(board).map((e) => e.id), view, prefs, Math.floor((o.now?.() ?? Date.now()) / 60_000)]);
  if (old && old.dataset.sig === sig && old.nextElementSibling === anchor) return;
  // Keep the keyboard where it was across the redraw.
  const focus = (doc.activeElement as HTMLElement | null)?.closest(`#${SPY_PANEL_ID}`) ? (doc.activeElement as HTMLElement).dataset.focus : undefined;
  const panel = renderPanel(o, board, view);
  panel.dataset.sig = sig;
  if (old) old.remove();
  anchor!.before(panel);
  if (focus) panel.querySelector<HTMLElement>(`[data-focus="${focus}"]`)?.focus();
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
  const iconButton = (cls: string, name: Parameters<typeof icon>[1], label: string, onClick: () => void) => {
    const b = el('button', `fut-sp-ib ${cls}`);
    b.type = 'button';
    b.title = label;
    b.setAttribute('aria-label', label);
    b.append(icon(doc, name, 14));
    b.addEventListener('click', (ev) => {
      ev.preventDefault();
      onClick();
    });
    return b;
  };

  const ships = store.get<ShipsInfo>(SHIPS_INFO_KEY, {});
  const cap = (id: 202 | 203) => ships[String(id)]?.capacity || (id === 202 ? 5000 : 25000);
  const universe = universeOf(doc, store.get<ServerData | null>(SERVER_DATA_KEY, null));
  const showShared = store.get<boolean>(SPY_SHARED_KEY, true);
  const tool = simTool(store.get<string>(SIM_KEY, 'osims'));
  const all = targetRows(board, spy.bases, { capacity: cap(203), speed: ships['203']?.speed ?? 0, universe, now }).filter((r) => showShared || !r.entry.shared);
  const rows = sortRows(all.filter((r) => (!view.hideDefended || !defended(r)) && (!view.inactiveOnly || r.entry.statuses.some((s) => INACTIVE.includes(s)))), view);
  // A base's name from Future's data, else from the game's planet list.
  // Attacks leave from the planet or moon the player has selected (no cp=, the game's own choice).
  const meta = (name: string) => doc.querySelector(`meta[name="ogame-planet-${name}"]`)?.getAttribute('content') ?? '';
  const here: Base | null = Number(meta('id')) > 0 ? { id: Number(meta('id')), name: meta('name'), coords: meta('coordinates'), moon: meta('type') === 'moon' } : null;
  const baseName = (b: Base) => b.name || doc.querySelector(`#planet-${b.id} .planet-name, #planet-${b.id} .moon-name`)?.textContent?.trim() || '';
  const grid = `22px ${view.cols.map((c) => WIDTH[c]).join(' ')} 104px`;

  const panel = el('div', 'fut-sp');
  panel.id = SPY_PANEL_ID;

  // Head on one line: title with totals (opens/closes), the two filters on the right.
  const head = el('div', 'fut-sp-head');
  const toggle = el('button', 'fut-sp-title');
  toggle.type = 'button';
  toggle.dataset.focus = 'title';
  toggle.setAttribute('aria-expanded', String(view.open));
  toggle.append(icon(doc, 'chevron', 12, 'fut-sp-chev'), el('b', '', t('spy.title')), el('span', '', t('spy.sub', { n: rows.length, loot: fmt(rows.reduce((s, r) => s + r.lootRes, 0)) })));
  toggle.addEventListener('click', () => redraw({ open: !view.open }));
  head.append(toggle);
  if (view.open) {
    const chip = (id: string, text: string, pressed: boolean, next: Partial<View>) => {
      const b = el('button', 'fut-sp-chip', text);
      b.type = 'button';
      b.dataset.focus = id;
      b.setAttribute('aria-pressed', String(pressed));
      b.addEventListener('click', () => redraw(next));
      return b;
    };
    head.append(
      chip('def', t('spy.hideDefended'), view.hideDefended, { hideDefended: !view.hideDefended }),
      chip('ina', t('spy.inactiveOnly'), view.inactiveOnly, { inactiveOnly: !view.inactiveOnly }),
    );
  }
  panel.append(head);
  if (!view.open) return panel;

  if (!rows.length) {
    panel.append(el('p', 'fut-sp-note', t(all.length ? 'spy.noneFiltered' : 'spy.none')));
    return panel;
  }

  // A table for assistive tech: header row with sortable, movable column headers, then the targets.
  const table = el('div', 'fut-sp-table');
  table.setAttribute('role', 'table');
  table.setAttribute('aria-label', t('spy.title'));
  const line = (cls: string) => {
    const r = el('div', `fut-sp-row ${cls}`.trim());
    r.setAttribute('role', 'row');
    r.style.gridTemplateColumns = grid;
    return r;
  };
  const cols = line('fut-sp-cols');
  const fixedHead = (text: string, label: string) => {
    const c = el('div', 'fut-sp-c');
    c.setAttribute('role', 'columnheader');
    const s = el('span', 'fut-sp-h', text);
    s.setAttribute('aria-label', label);
    c.append(s);
    return c;
  };
  cols.append(fixedHead('#', t('spy.col.n')));
  for (const key of view.cols) {
    const cell = el('div', `fut-sp-c${RIGHT.includes(key) ? ' fut-sp-r' : ''}`);
    cell.setAttribute('role', 'columnheader');
    cell.setAttribute('aria-sort', view.sort === key ? (view.desc ? 'descending' : 'ascending') : 'none');
    const b = el('button', `fut-sp-h${view.sort === key ? ' sortBy' : ''}`, t(`spy.col.${key}`));
    b.type = 'button';
    b.dataset.focus = `col-${key}`;
    b.title = t('spy.colHint');
    if (view.sort === key) b.append(icon(doc, 'chevron', 10, 'fut-sp-sort'));
    b.addEventListener('click', () => redraw(view.sort === key ? { desc: !view.desc } : { sort: key, desc: !['target', 'age', 'act', 'coords'].includes(key) }));
    // Move with Alt + arrows, or drag the header onto another one.
    b.addEventListener('keydown', (ev) => {
      if (!ev.altKey || (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight')) return;
      ev.preventDefault();
      const i = view.cols.indexOf(key) + (ev.key === 'ArrowLeft' ? -1 : 1);
      if (i >= 0 && i < view.cols.length) redraw({ cols: moveColumn(view.cols, key, view.cols[i]!) });
    });
    cell.draggable = true;
    cell.addEventListener('dragstart', (ev) => {
      ev.dataTransfer?.setData('text/x-fut-col', key);
      cell.classList.add('drag');
    });
    cell.addEventListener('dragend', () => cell.classList.remove('drag'));
    cell.addEventListener('dragover', (ev) => {
      if (!ev.dataTransfer?.types.includes('text/x-fut-col')) return;
      ev.preventDefault();
      cell.classList.add('over');
    });
    cell.addEventListener('dragleave', () => cell.classList.remove('over'));
    cell.addEventListener('drop', (ev) => {
      ev.preventDefault();
      const from = ev.dataTransfer?.getData('text/x-fut-col') as ColKey | undefined;
      if (from && COLS.includes(from)) redraw({ cols: moveColumn(view.cols, from, key) });
    });
    cell.append(b);
    cols.append(cell);
  }
  cols.append(fixedHead('', t('spy.col.actionsName')));
  table.append(cols);

  const list = el('div', 'fut-sp-list');
  list.setAttribute('role', 'rowgroup');
  rows.forEach((r, index) => {
    const e = r.entry;
    const [g, s, p] = e.coords.split(':');
    const row = line(defended(r) ? 'defended' : '');
    const open = expanded.has(e.key);
    const from = here ?? r.base;
    // The game's Fleet page towards this target, attack mission; `n` ships of `id` only from the raid links.
    const attackUrl = (n: number, id: number) =>
      `/game/index.php?page=ingame&component=fleetdispatch&galaxy=${g}&system=${s}&position=${p}&type=${e.moon ? 3 : 1}&mission=1${n > 0 ? `&am${id}=${n}` : ''}`;

    const cellOf: Record<ColKey, () => HTMLElement> = {
      age: () => {
        const c = el('div', `fut-sp-c ${r.ageMinutes > 360 ? 'old' : r.ageMinutes > 60 ? 'warm' : 'fresh'}`, r.ageMinutes < 60 ? `${r.ageMinutes}m` : r.ageMinutes < 2880 ? `${Math.floor(r.ageMinutes / 60)}h` : `${Math.floor(r.ageMinutes / 1440)}g`);
        c.title = new Date(e.at).toLocaleString(locale);
        return c;
      },
      act: () => {
        // As OGLight: "*" active now, minutes when recent, a dash when nothing in the last hour.
        const c = el('div', `fut-sp-c ${e.activity === 0 ? 'bad' : e.activity < 60 ? 'warm' : 'zero'}`, e.activity === 0 ? '*' : e.activity < 60 ? String(e.activity) : '–');
        c.title = e.activity === 0 ? t('msg.spy.active') : e.activity < 60 ? t('msg.spy.activity', { n: e.activity }) : t('msg.spy.inactive');
        return c;
      },
      coords: () => {
        const c = el('div', 'fut-sp-c');
        const gal = el('a', 'fut-sp-coords', e.coords);
        gal.href = `/game/index.php?page=ingame&component=galaxy&galaxy=${g}&system=${s}`;
        gal.title = t(e.moon ? 'spy.moon' : 'spy.planet');
        gal.prepend(icon(doc, e.moon ? 'moon' : 'planet', 11, 'fut-sp-kind'));
        c.append(gal);
        return c;
      },
      target: () => {
        // The name opens the full report in the game's own window.
        const c = el('div', 'fut-sp-c fut-sp-who');
        const name = el('a', 'fut-sp-name overlay', e.playerName || '?');
        name.href = `${doc.location.origin}/game/index.php?page=ajax&component=messagedetails&messageId=${encodeURIComponent(e.id)}`;
        name.dataset.overlayTitle = t('spy.report');
        name.title = t('spy.reportHint', { name: e.playerName || '?' });
        c.append(name);
        for (const st of e.statuses.filter((x) => x !== 'active')) c.append(el('span', `fut-sp-st st-${st}`, t(`spy.status.${st}`)));
        if (e.shared) {
          const ally = el('span', 'fut-sp-st st-shared', t('spy.shared'));
          ally.title = t('spy.sharedHint');
          c.append(ally);
        }
        c.append(flagButton({ doc, store, t }, e.playerId, e.playerName));
        return c;
      },
      loot: () => {
        const c = el('div', 'fut-sp-c fut-sp-r fut-sp-loot', fmt(r.lootRes));
        c.title = t('spy.lootHint', {
          pct: Math.round(e.loot * 100),
          m: fmt(e.res.metal * e.loot), c: fmt(e.res.crystal * e.loot), d: fmt(e.res.deuterium * e.loot),
          large: Math.ceil(r.lootRes / cap(203)).toLocaleString(locale), small: Math.ceil(r.lootRes / cap(202)).toLocaleString(locale),
        });
        return c;
      },
      fleet: () => value(e.fleetValue, t('msg.spy.fleet')),
      def: () => value(e.defValue, t('msg.spy.def')),
    };
    const value = (v: number, label: string) => {
      const c = el('div', `fut-sp-c fut-sp-r ${v !== 0 ? 'warm' : 'zero'}`, v < 0 ? '?' : v > 0 ? fmt(v) : '0');
      c.title = `${label}: ${v < 0 ? t('spy.hidden') : exact(v)}`;
      return c;
    };

    // Actions as icons: raid details, attack, simulate, remove.
    const acts = el('div', 'fut-sp-c fut-sp-acts');
    const more = iconButton('fut-sp-more', 'more', t('spy.waves'), () => {
      if (open) expanded.delete(e.key);
      else expanded.add(e.key);
      mountSpyPanel(o);
    });
    more.dataset.focus = `more-${e.key}`;
    more.setAttribute('aria-expanded', String(open));
    more.setAttribute('aria-controls', `fut-sp-w-${index}`);
    acts.append(more);
    if (from) {
      const base = from;
      acts.append(iconButton('fut-sp-attack', 'sword', t('spy.attackHint', { name: baseName(base) }), () => {
        doc.location.assign(attackUrl(0, 203));
      }));
    }
    if (e.apiKey) {
      const key = e.apiKey;
      acts.append(iconButton('fut-sp-sim', 'play', t('spy.simulateHint', { tool: SIM_TOOLS[tool].name }), () => {
        const prefill = simPrefill(spy.server, from ? { coords: from.coords, researches: spy.researches, classId: spy.classId, allianceClass: spy.allianceClass, lf: spy.lf ?? undefined } : null, e.coords);
        doc.defaultView?.open(simLink(tool, key, spy.lang, prefill), '_blank', 'noopener');
      }));
    }
    acts.append(iconButton('fut-sp-del', 'trash', t('spy.remove'), () => {
      const b = store.get<SpyBoard>(SPY_BOARD_KEY, {});
      delete b[e.key];
      store.set(SPY_BOARD_KEY, b);
      expanded.delete(e.key);
      // Keep the keyboard in the table: the next target's remove button, else the previous, else the title.
      const near = rows[index + 1] ?? rows[index - 1];
      mountSpyPanel(o);
      const panel = doc.getElementById(SPY_PANEL_ID);
      (panel?.querySelector<HTMLElement>(near ? `[data-focus="del-${near.entry.key}"]` : '[data-focus="title"]') ?? panel?.querySelector<HTMLElement>('[data-focus="title"]'))?.focus();
    }));
    acts.lastElementChild!.setAttribute('data-focus', `del-${e.key}`);

    const n = el('div', 'fut-sp-c fut-sp-n', String(index + 1));
    const cells = [n, ...view.cols.map((c) => cellOf[c]()), acts];
    for (const c of cells) c.setAttribute('role', 'cell');
    row.append(...cells);
    list.append(row);

    // Raid details: the six raids a day allows on one target (bashing limit) if nothing changes in
    // between, each with the cargo ships it takes; every count opens the Fleet page with those ships.
    if (open) {
      // A row with one cell spanning every column, for screen readers.
      const det = el('div', 'fut-sp-waves');
      det.id = `fut-sp-w-${index}`;
      det.setAttribute('role', 'row');
      const cell = el('div');
      cell.setAttribute('role', 'cell');
      cell.setAttribute('aria-colspan', String(view.cols.length + 2));
      const waves = raidWaves(e.res.metal + e.res.crystal + e.res.deuterium, e.loot, 6);
      const wgrid = el('div', 'fut-sp-wgrid');
      wgrid.append(el('span', 'k'), ...waves.map((_, i) => el('span', 'h', t('spy.wave', { n: i + 1 }))));
      wgrid.append(el('span', 'k', t('spy.col.loot')), ...waves.map((w) => el('b', '', fmt(w))));
      for (const id of [203, 202] as const) {
        const label = el('span', 'k');
        label.append(shipIcon(doc, id, shipName(id, ships, t), 'fut-msg-icon'), shipName(id, ships, t));
        wgrid.append(label);
        for (const [i, w] of waves.entries()) {
          const n = Math.ceil(w / cap(id));
          if (!from || n === 0) {
            wgrid.append(el('span', 'cnt', n.toLocaleString(locale)));
            continue;
          }
          const a = el('a', 'cnt', n.toLocaleString(locale));
          a.href = attackUrl(n, id);
          a.title = t('spy.waveHint', { n: i + 1, count: n.toLocaleString(locale), ship: shipName(id, ships, t), name: baseName(from) });
          wgrid.append(a);
        }
      }
      const res = el('div', 'fut-sp-wres');
      res.append(el('span', 'k', t('spy.onPlanet')), el('span', '', `M ${fmt(e.res.metal)}`), el('span', '', `C ${fmt(e.res.crystal)}`), el('span', '', `D ${fmt(e.res.deuterium)}`));
      if (from) res.append(el('span', 'from', t('spy.from', { name: baseName(from), coords: from.coords })));
      cell.append(wgrid, res);
      det.append(cell);
      list.append(det);
    }
  });
  table.append(list);

  // Total of the loot under its column.
  const foot = line('fut-sp-foot');
  foot.append(el('div', 'fut-sp-c'));
  for (const key of view.cols) foot.append(el('div', `fut-sp-c${RIGHT.includes(key) ? ' fut-sp-r' : ''}`, key === 'loot' ? fmt(rows.reduce((s, r) => s + r.lootRes, 0)) : key === 'target' ? t('spy.total') : ''));
  foot.append(el('div', 'fut-sp-c'));
  table.append(foot);
  panel.append(table, el('p', 'fut-sp-note', t('spy.hint')));
  return panel;
}
