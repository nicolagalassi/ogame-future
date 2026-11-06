/**
 * Targets side bar, after OGLight's side panel: it stays open on the left while the player moves in
 * the galaxy, and across pages. Lists the flagged players (one tab per flag, plus the ones opened
 * lately) and the coloured planets; a player's sheet shows points and every planet and moon with
 * debris, activity and the age of the last galaxy reading. A click on coordinates (or the M key)
 * shows that system in the galaxy view.
 *
 * Drawn like the planet menu: dense rows, hairline borders, the cyan frame on the current system.
 *
 * COMPLIANCE:
 * - Data: Future's own (marks, positions read from the galaxy the game drew) plus the universe's
 *   public API (playerData, players.xml: reason 'user-view', cached, no cookies, no game activity).
 * - Coordinates load the system with the game's own galaxy loader (`loadContentNew`, the same call
 *   as its arrows) or open the galaxy page: one click or key = one navigation, never a chain.
 * - No probe button (§1.5.1): the activity cells open the game's fleet page on that planet or moon,
 *   where the player picks mission and ships and presses Send, as OGLight's side panel does.
 */
import { icon, type IconName } from '../../core/icons';
import type { NetworkGuard } from '../../core/guard';
import type { Store } from '../../core/storage';
import { formatUnits } from '../../core/format';
import { pageWindow } from '../../data/fleet-dispatcher';
import type { Activity } from '../../data/galaxy';
import { PLAYER_SCORES_KEY, playerScores, type PlayerScores, type ScoreType } from '../../data/player-api';
import { statusNames, universePlayers, type UniversePlayers } from '../../data/universe-players';
import { FLAGS, flagPlayer, loadMarks, MARKS_KEY, planetsInRange, rememberRecent, TAGS, type Flag, type Marks, type Tag } from '../../engines/marks';
import { ageParts, planetsOf, POSITIONS_KEY, type Positions, type Seen } from '../../engines/positions';
import { FLAG_COLORS, FLAG_ICONS, flagButton, MARKS_CSS, TAG_COLORS, tagButton } from './picker';

type T = (key: string, vars?: Record<string, string | number>) => string;

export const SIDE_ID = 'fut-side';
export const SIDE_W = 330;
const VIEW_KEY = 'marks.view';
const HOUR = 3_600_000;

interface View {
  open: boolean;
  tab: 'players' | 'planets';
  flagTab: Flag | 'recent';
  /** Player whose sheet is open. */
  player: number | null;
  from: string;
  to: string;
  tags: Tag[];
  hide: string[];
}

export interface SideOptions {
  doc: Document;
  store: Store;
  guard: NetworkGuard;
  t: T;
  locale: string;
}

let last: SideOptions | null = null;
/** Player sheet data already fetched this page (no second request while redrawing). */
const sheetData = new Map<number, PlayerScores | null>();
let uni: UniversePlayers | null = null;

const SCORE_LOOK: [ScoreType, IconName, string][] = [
  ['total', 'star', '#F5B547'], ['economy', 'swap', '#7FB8FF'], ['research', 'eye', '#4FE0B0'],
  ['lifeform', 'user', '#E58CDB'], ['military', 'fleet', '#FF7A7A'],
];

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.side {
  position: fixed; left: 0; top: 0; bottom: 0; z-index: 1000000; width: ${SIDE_W}px; display: flex; flex-direction: column; gap: 6px;
  padding: 8px; background: #0B121D; border-right: 1px solid #1F2C40; box-shadow: 6px 0 24px rgba(0,0,0,0.45);
  font: 11px Arial, Helvetica, sans-serif; color: #C9D4E2; overflow: hidden;
}
button { font: inherit; color: inherit; }
button:focus-visible, a:focus-visible, input:focus-visible { outline: 1px solid #4FD1E8; outline-offset: -1px; }
.mono, .coords, .num { font-family: Consolas, "JetBrains Mono", monospace; font-variant-numeric: tabular-nums; }

/* Head: back, title, close: the planet menu's toolbar look. */
.head { display: flex; align-items: center; gap: 4px; min-height: 30px; padding: 0 2px 0 4px; border: 1px solid #1F2C40; border-radius: 6px; background: #111B2A; }
.title { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 4px; font: 700 12px Arial, sans-serif; color: #E6EDF5; white-space: nowrap; overflow: hidden; }
.title .name { overflow: hidden; text-overflow: ellipsis; }
.title a { color: #8A9BB0; font-weight: 400; text-decoration: none; }
.title a:hover { color: #4FD1E8; }
.ib { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 5px; background: none; color: #8A9BB0; cursor: pointer; flex: none; text-decoration: none; }
.ib:hover { background: #16243A; color: #E6EDF5; }

/* Tabs and filters: the settings chips of the planet menu. */
.chips { display: flex; flex-wrap: wrap; gap: 3px; }
.chip { display: inline-flex; align-items: center; justify-content: center; gap: 4px; flex: 1 0 auto; min-width: 30px; height: 24px; padding: 0 6px; border-radius: 5px; border: 1px solid #1F2C40; background: #0A111C; color: #B4C2D3; cursor: pointer; }
.chip:hover { border-color: #2C5A73; }
.chip[aria-pressed="true"] { border-color: currentColor; background: #12283A; color: #E6EDF5; font-weight: 700; }
.chip .n { font: 10px Consolas, monospace; color: #8A9BB0; }
.seg { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #1F2C40; border-radius: 6px; overflow: hidden; }
.seg button { height: 24px; border: 0; background: #0B121D; color: #8A9BB0; cursor: pointer; }
.seg button + button { border-left: 1px solid #1F2C40; }
.seg button[aria-pressed="true"] { background: #12283A; color: #E6EDF5; font-weight: 700; box-shadow: inset 0 -2px 0 #4FD1E8; }

/* Scores: the toolbar cells, two per line. */
.scores { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; }
.score { display: flex; align-items: center; gap: 6px; height: 26px; padding: 0 8px; border: 1px solid #1F2C40; border-radius: 6px; background: #111B2A; min-width: 0; }
.score b { flex: 1; text-align: right; font: 700 12px Consolas, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.score i { font: normal 10px Consolas, monospace; color: #8A9BB0; }
.actions { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; border: 1px solid #1F2C40; border-radius: 6px; background: #0B121D; overflow: hidden; }
.actions a, .actions button { display: flex; align-items: center; justify-content: center; height: 26px; border: 0; background: none; color: #8A9BB0; text-decoration: none; cursor: pointer; }
.actions > * + * { border-left: 1px solid #1F2C40 !important; }
.actions a:hover, .actions button:hover { background: #111D2D; color: #E6EDF5; }

.range { display: flex; align-items: center; gap: 4px; color: #8A9BB0; }
.range input { width: 64px; height: 22px; padding: 0 5px; border: 1px solid #1F2C40; border-radius: 5px; background: #0A111C; color: #E6EDF5; font: 11px Consolas, monospace; }

/* Rows: the planet menu's .fut-row, one line each. */
.scroll { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; padding-right: 2px; scrollbar-color: #2A3B55 #0B121D; scrollbar-width: thin; }
.cols, .row { display: grid; align-items: center; gap: 4px; min-height: 26px; padding: 0 4px; }
.cols { min-height: 18px; color: #4A5B72; font-size: 10px; }
.row { border: 1px solid #1F2C40; border-radius: 6px; background: #111B2A; }
.row.gap { margin-top: 4px; }
.row.active { border-color: #4FD1E8; background: rgba(79,209,232,0.14); box-shadow: inset 3px 0 0 #4FD1E8; }
.pl .cols, .pl .row { grid-template-columns: 18px 64px 1fr 34px 34px 40px; }
.tg .cols, .tg .row { grid-template-columns: 18px 64px 1fr 34px 40px 20px; }
.ps .row { grid-template-columns: 18px 1fr auto auto; }
.idx { color: #4A5B72; font: 10px Consolas, monospace; text-align: right; }
.coords { all: unset; display: inline-flex; align-items: center; gap: 3px; padding: 2px 4px; border-radius: 4px; color: #C9D4E2; font: 11px Consolas, monospace; cursor: pointer; }
.coords:hover { background: #1D3350; color: #E6EDF5; }
.row.active .coords { color: #8BE4F2; }
.coords.new::after { content: ''; width: 5px; height: 5px; border-radius: 50%; background: #4FD1E8; }
.cell-r { text-align: right; font: 11px Consolas, monospace; color: #8A9BB0; white-space: nowrap; overflow: hidden; }
.cell-r.has { color: #C9D4E2; }
.cell-r.big { color: #F5B547; font-weight: 700; }
.txt { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #E6EDF5; }
.txt .who { color: #8A9BB0; }
.pname { all: unset; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #E6EDF5; font-weight: 700; cursor: pointer; }
.pname:hover, .pname:focus-visible { color: #4FD1E8; }
.rank { color: #8A9BB0; font: 10px Consolas, monospace; }
.act { display: inline-flex; align-items: center; justify-content: flex-end; gap: 2px; height: 20px; padding: 0 3px; border-radius: 4px; font: 700 11px Consolas, monospace; text-decoration: none; color: #4A5B72; }
.act svg { color: #617C8D; flex: none; }
a.act:hover { background: #1D3350; }
.act.on { color: #EF7676; } .act.mid { color: #E3BB28; } .act.off { color: #38C56E; } .act.unknown { color: #617C8D; font-weight: 400; }
.age { text-align: right; font: 10px Consolas, monospace; }
.age.fresh { color: #38C56E; } .age.warm { color: #E3BB28; } .age.old { color: #EF7676; } .age.none { color: #4A5B72; }
.st-inactive { color: #9BE36D !important; } .st-longinactive { color: #8A9BB0 !important; } .st-vacation { color: #7FDBFF !important; } .st-banned { color: #FF7A7A !important; text-decoration: line-through; }
.foot { display: flex; justify-content: space-between; gap: 6px; color: #617C8D; font-size: 10px; }
kbd { padding: 0 4px; border: 1px solid #2E4356; border-radius: 3px; background: #0D1522; color: #C9D4E2; font: 10px Consolas, monospace; }
.empty { margin: 4px 0; padding: 14px 10px; border: 1px dashed #1F2C40; border-radius: 6px; color: #8A9BB0; text-align: center; line-height: 1.4; }
.err { color: #EF7676; }
.fut-mk { margin: 0; }
` + MARKS_CSS;

function h<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

const galaxyHref = (coords: string) => {
  const [g, s, p] = coords.split(':');
  return `/game/index.php?page=ingame&component=galaxy&galaxy=${g}&system=${s}&position=${p}`;
};
const fleetHref = (coords: string, type: 1 | 3) => {
  const [g, s, p] = coords.split(':');
  return `/game/index.php?page=ingame&component=fleetdispatch&galaxy=${g}&system=${s}&position=${p}&type=${type}`;
};

const readView = (o: SideOptions): View => {
  return { open: false, tab: 'players', flagTab: 'watch', player: null, from: '', to: '', tags: [...TAGS], hide: ['vacation', 'banned'], ...o.store.get<Partial<View>>(VIEW_KEY, {}) };
};
const readMarks = (store: Store) => loadMarks(store.get<Partial<Marks> | null>(MARKS_KEY, null));

/** The system the galaxy view shows, "g:s", or null on other pages. */
function shownSystem(doc: Document): string | null {
  const g = (doc.getElementById('galaxy_input') as HTMLInputElement | null)?.value;
  const s = (doc.getElementById('system_input') as HTMLInputElement | null)?.value;
  return doc.getElementById('galaxyContent') && g && s ? `${Number(g)}:${Number(s)}` : null;
}

/** Called with the coordinates the side bar is about to show (the galaxy marks that position). */
let onGo: ((coords: string) => void) | null = null;
export function onSideNavigate(fn: (coords: string) => void): void {
  onGo = fn;
}

/** Shows a system in the galaxy: the game's own loader on the galaxy page, else the galaxy page. */
export function showInGalaxy(doc: Document, coords: string): void {
  const [g, s] = coords.split(':').map(Number);
  const win = pageWindow() as Window & { loadContentNew?: (g: number, s: number) => void; galaxy?: number; system?: number };
  if (shownSystem(doc) && typeof win.loadContentNew === 'function' && g && s) {
    onGo?.(coords);
    const gi = doc.getElementById('galaxy_input') as HTMLInputElement | null;
    const si = doc.getElementById('system_input') as HTMLInputElement | null;
    if (gi) gi.value = String(g);
    if (si) si.value = String(s);
    win.galaxy = g;
    win.system = s;
    win.loadContentNew(g, s);
  } else doc.location.assign(galaxyHref(coords));
}

export function isSideOpen(doc: Document): boolean {
  return !!doc.getElementById(SIDE_ID);
}

export function closeSide(doc: Document, store: Store): void {
  doc.getElementById(SIDE_ID)?.remove();
  store.set(VIEW_KEY, { ...store.get<Partial<View>>(VIEW_KEY, {}), open: false });
}

/** The "Bersagli" button: opens the side bar, or closes it when open. */
export function toggleSide(o: SideOptions): void {
  if (isSideOpen(o.doc)) closeSide(o.doc, o.store);
  else openSide(o, { open: true });
}

/** Opens the side bar again on a new page when the player left it open (no request if cached). */
export function restoreSide(o: SideOptions): void {
  if (readView(o).open) openSide(o, {});
}

/** Redraws the open side bar (after the galaxy showed another system). */
export function refreshSide(): void {
  if (last && isSideOpen(last.doc)) openSide(last, {});
}

/** M: the next coordinates of the open list after the system on screen, round the end. */
export function nextInSide(doc: Document): boolean {
  const root = doc.getElementById(SIDE_ID)?.shadowRoot;
  const all = [...(root?.querySelectorAll<HTMLElement>('[data-coords]') ?? [])];
  if (!all.length) return false;
  let at = -1;
  all.forEach((e, i) => { if (e.closest('.row')?.classList.contains('active')) at = i; });
  const target = all[(at + 1) % all.length]!;
  showInGalaxy(doc, target.dataset.coords!);
  return true;
}

export function openSide(o: SideOptions, change: Partial<View>): void {
  last = o;
  const { doc, store, t, locale } = o;
  const view = { ...readView(o), ...change, open: true };
  store.set(VIEW_KEY, view);
  const keepScroll = doc.getElementById(SIDE_ID)?.shadowRoot?.querySelector('.scroll')?.scrollTop ?? 0;
  const marks = readMarks(store);
  const positions = store.get<Positions>(POSITIONS_KEY, {});
  const go = (next: Partial<View>) => openSide(o, next);
  const picker = { doc, store, t, onChange: () => openSide(o, {}) };
  const here = shownSystem(doc);

  let host = doc.getElementById(SIDE_ID);
  if (!host) {
    host = h(doc, 'div');
    host.id = SIDE_ID;
    host.lang = locale;
    host.attachShadow({ mode: 'open' });
    doc.body.append(host);
  }
  const root = host.shadowRoot!;
  const style = h(doc, 'style');
  style.textContent = CSS;
  const side = h(doc, 'aside', 'side');
  side.setAttribute('aria-label', t('marks.title'));

  const head = h(doc, 'header', 'head');
  const title = h(doc, 'div', 'title');
  if (view.player !== null) {
    const back = iconButton(doc, 'back', t('marks.back'));
    back.addEventListener('click', () => go({ player: null }));
    head.append(back);
  } else head.append(h(doc, 'span', 'ib'));
  head.append(title);
  const x = iconButton(doc, 'close', t('dash.close'));
  x.addEventListener('click', () => closeSide(doc, store));
  head.append(x);
  side.append(head);

  const scroll = h(doc, 'div', 'scroll');
  if (view.player !== null) playerSheet(o, side, scroll, title, view.player, marks, positions, picker, here);
  else {
    title.append(h(doc, 'span', 'name', t('marks.title')));
    const seg = h(doc, 'div', 'seg');
    for (const id of ['players', 'planets'] as const) {
      const b = h(doc, 'button', '', t(`marks.tab.${id}`));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(view.tab === id));
      b.addEventListener('click', () => go({ tab: id }));
      seg.append(b);
    }
    side.append(seg);
    if (view.tab === 'players') playersList(o, side, scroll, view, marks, picker, go);
    else taggedList(o, side, scroll, view, marks, positions, picker, go, here);
  }
  side.append(scroll);
  const foot = h(doc, 'div', 'foot');
  const key = h(doc, 'span', '');
  key.append(h(doc, 'kbd', '', 'M'), doc.createTextNode(` ${t('marks.keyNext')}`));
  foot.append(key, h(doc, 'span', '', t('marks.footData')));
  side.append(foot);

  root.replaceChildren(style, side);
  scroll.scrollTop = keepScroll;
}

function iconButton(doc: Document, name: IconName, label: string): HTMLButtonElement {
  const b = h(doc, 'button', 'ib');
  b.type = 'button';
  b.title = label;
  b.setAttribute('aria-label', label);
  b.append(icon(doc, name, 14));
  return b;
}

type Picker = { doc: Document; store: Store; t: T; onChange: () => void };

function playersList(o: SideOptions, side: HTMLElement, scroll: HTMLElement, view: View, marks: Marks, picker: Picker, go: (v: Partial<View>) => void): void {
  const { doc, t, locale } = o;
  const chips = h(doc, 'div', 'chips');
  const counts = Object.values(marks.players).reduce<Record<string, number>>((c, p) => ((c[p.flag] = (c[p.flag] ?? 0) + 1), c), {});
  for (const f of [...FLAGS, 'recent'] as const) {
    const b = h(doc, 'button', 'chip');
    b.type = 'button';
    b.title = t(f === 'recent' ? 'marks.recent' : `mark.flag.${f}`);
    b.setAttribute('aria-label', b.title);
    b.setAttribute('aria-pressed', String(view.flagTab === f));
    if (f !== 'recent') b.style.color = FLAG_COLORS[f];
    b.append(icon(doc, f === 'recent' ? 'eye' : FLAG_ICONS[f], 12), h(doc, 'span', 'n', String(f === 'recent' ? marks.recent.length : counts[f] ?? 0)));
    b.addEventListener('click', () => go({ flagTab: f }));
    chips.append(b);
  }
  side.append(chips);
  const list = view.flagTab === 'recent'
    ? marks.recent
    : Object.entries(marks.players).filter(([, p]) => p.flag === view.flagTab).map(([id, p]) => ({ id: Number(id), name: p.name })).sort((a, b) => a.name.localeCompare(b.name));
  if (!list.length) {
    scroll.append(h(doc, 'p', 'empty', t(view.flagTab === 'recent' ? 'marks.noRecent' : 'marks.noPlayers')));
    return;
  }
  // Ranks from the cards already read (no request for the list).
  const cache = o.store.get<Record<string, PlayerScores>>(PLAYER_SCORES_KEY, {});
  const wrap = h(doc, 'div', 'ps');
  list.forEach((p, i) => {
    const row = h(doc, 'div', 'row');
    const name = h(doc, 'button', 'pname', p.name || `#${p.id}`);
    name.type = 'button';
    name.title = t('marks.openSheet');
    name.addEventListener('click', () => go({ player: p.id }));
    const rank = cache[String(p.id)]?.scores.total?.rank;
    row.append(h(doc, 'span', 'idx', String(i + 1)), name, h(doc, 'span', 'rank', rank ? `#${rank.toLocaleString(locale)}` : ''), flagButton(picker, p.id, p.name));
    wrap.append(row);
  });
  scroll.append(wrap);
}

function activityCell(doc: Document, t: T, coords: string, type: 1 | 3, value: Activity, seen: Seen | null, now: number): HTMLElement {
  const a = h(doc, 'a', 'act');
  a.href = fleetHref(coords, type);
  a.title = t(type === 1 ? 'marks.fleetPlanet' : 'marks.fleetMoon', { coords });
  a.append(icon(doc, type === 1 ? 'planet' : 'moon', 10));
  if (!seen || now - seen.at > HOUR) {
    // Never read, or read over an hour ago: the game's activity no longer says anything.
    a.classList.add('unknown');
    a.append(doc.createTextNode('?'));
  } else {
    a.classList.add(value === '*' ? 'on' : value === null ? 'off' : 'mid');
    a.append(doc.createTextNode(value === null ? '60' : String(value)));
  }
  return a;
}

function ageCell(doc: Document, t: T, seen: Seen | null, now: number, locale: string): HTMLElement {
  if (!seen) return h(doc, 'span', 'age none', '—');
  const ms = now - seen.at;
  const { n, unit } = ageParts(ms);
  const el = h(doc, 'span', `age ${ms < HOUR ? 'fresh' : ms < 3 * 86_400_000 ? 'warm' : 'old'}`, t('marks.ago', { n, u: t(`marks.unit.${unit}`) }));
  el.title = new Date(seen.at).toLocaleString(locale);
  return el;
}

function coordsButton(doc: Document, t: T, coords: string, fresh = false): HTMLButtonElement {
  const b = h(doc, 'button', `coords${fresh ? ' new' : ''}`, coords);
  b.type = 'button';
  b.dataset.coords = coords;
  b.title = fresh ? t('marks.seenOnly') : t('marks.showSystem');
  b.addEventListener('click', () => showInGalaxy(doc, coords));
  return b;
}

function playerSheet(o: SideOptions, side: HTMLElement, scroll: HTMLElement, title: HTMLElement, id: number, marks: Marks, positions: Positions, picker: Picker, here: string | null): void {
  const { doc, store, t, locale } = o;
  const known = marks.players[String(id)]?.name || marks.recent.find((r) => r.id === id)?.name || '';
  const data = sheetData.get(id);
  const name = data?.name || known || `#${id}`;
  title.append(h(doc, 'span', 'name', name));
  const rank = data?.scores.total?.rank;
  if (rank) {
    const a = h(doc, 'a', 'mono', `#${rank.toLocaleString(locale)}`);
    a.href = `/game/index.php?page=ingame&component=highscore&site=${Math.max(1, Math.ceil(rank / 100))}&category=1&searchRelId=${id}`;
    a.title = t('marks.rank');
    title.append(a);
  }
  title.append(flagButton(picker, id, name));

  if (!sheetData.has(id)) {
    scroll.append(h(doc, 'p', 'empty', t('galaxy.loading')));
    void playerScores(o.guard, store, doc.location.origin, id, Date.now())
      .catch(() => null)
      .then((fresh) => {
        sheetData.set(id, fresh);
        if (fresh) {
          let m = rememberRecent(readMarks(store), id, fresh.name || known);
          const flagged = m.players[String(id)];
          if (flagged && !flagged.name) m = flagPlayer(m, id, fresh.name, flagged.flag, Date.now());
          store.set(MARKS_KEY, m);
        }
        refreshSide();
      });
    return;
  }

  const scores = h(doc, 'div', 'scores');
  for (const [key, ico, color] of SCORE_LOOK) {
    const v = data?.scores[key];
    const cell = h(doc, 'div', 'score');
    cell.title = t(`galaxy.score.${key}`);
    const ic = icon(doc, ico, 12);
    ic.style.color = color;
    const b = h(doc, 'b', '', v ? formatUnits(v.points, locale) : '—');
    b.style.color = color;
    cell.append(ic, b);
    if (v) cell.append(h(doc, 'i', '', `#${v.rank.toLocaleString(locale)}`));
    scores.append(cell);
  }
  const ships = h(doc, 'div', 'score');
  ships.title = t('marks.ships');
  ships.append(icon(doc, 'fleet', 12), h(doc, 'b', '', data?.ships ? data.ships.toLocaleString(locale) : '—'));
  scores.append(ships);
  side.append(scores);

  const actions = h(doc, 'div', 'actions');
  const link = (ico: IconName, label: string, href: string) => {
    const a = h(doc, 'a');
    a.href = href;
    a.title = label;
    a.setAttribute('aria-label', label);
    a.append(icon(doc, ico, 13));
    actions.append(a);
  };
  link('pen', t('marks.write'), `/game/index.php?page=ingame&component=chat&playerId=${id}`);
  link('user', t('marks.profile'), `/game/index.php?page=ingame&component=playerprofile&profileId=${id}`);
  link('chart', t('marks.rank'), `/game/index.php?page=ingame&component=highscore&category=1&searchRelId=${id}${rank ? `&site=${Math.max(1, Math.ceil(rank / 100))}` : ''}`);
  side.append(actions);

  if (!data) {
    scroll.append(h(doc, 'p', 'empty err', t('galaxy.apiError')));
    return;
  }
  const lines = planetsOf(id, data, positions);
  const now = Date.now();
  const wrap = h(doc, 'div', 'pl');
  const cols = h(doc, 'div', 'cols');
  cols.append(h(doc, 'span', ''), h(doc, 'span', '', t('marks.col.coords')), h(doc, 'span', 'cell-r', t('marks.col.debris')), h(doc, 'span', 'cell-r', t('marks.col.planet')), h(doc, 'span', 'cell-r', t('marks.col.moon')), h(doc, 'span', 'cell-r', t('marks.col.seen')));
  wrap.append(cols);
  let lastSystem = '';
  lines.forEach((p, i) => {
    const system = p.coords.split(':').slice(0, 2).join(':');
    const row = h(doc, 'div', `row${i > 0 && system !== lastSystem ? ' gap' : ''}${system === here ? ' active' : ''}`);
    lastSystem = system;
    row.title = p.name;
    const debris = p.seen?.debris ?? 0;
    row.append(
      h(doc, 'span', 'idx', String(i + 1)),
      coordsButton(doc, t, p.coords, p.fresh),
      h(doc, 'span', `cell-r${debris ? ' has' : ''}${debris >= 1_000_000 ? ' big' : ''}`, p.seen ? formatUnits(debris, locale) : '—'),
      activityCell(doc, t, p.coords, 1, p.seen?.act[0] ?? null, p.seen, now),
      p.moon ? activityCell(doc, t, p.coords, 3, p.seen?.act[1] ?? null, p.seen, now) : h(doc, 'span', ''),
      ageCell(doc, t, p.seen, now, locale),
    );
    wrap.append(row);
  });
  scroll.append(wrap);
  scroll.append(h(doc, 'p', 'foot', t('marks.planets', { n: lines.length, moons: lines.filter((l) => l.moon).length }) + ' · ' + t('galaxy.apiAge', { time: new Date(data.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })));
}

function taggedList(o: SideOptions, side: HTMLElement, scroll: HTMLElement, view: View, marks: Marks, positions: Positions, picker: Picker, go: (v: Partial<View>) => void, here: string | null): void {
  const { doc, t, locale } = o;
  const range = h(doc, 'div', 'range');
  const input = (value: string, label: string, placeholder: string) => {
    const i = h(doc, 'input');
    i.value = value;
    i.placeholder = placeholder;
    i.inputMode = 'numeric';
    i.setAttribute('aria-label', label);
    return i;
  };
  const from = input(view.from, t('marks.from'), '1:1');
  const to = input(view.to, t('marks.to'), '9:499');
  const apply = () => {
    // Empty = no bound.
    const ok = (v: string) => !v.trim() || /^\d{1,2}:\d{1,3}$/.test(v.trim());
    if (ok(from.value) && ok(to.value)) go({ from: from.value.trim(), to: to.value.trim() });
  };
  for (const i of [from, to]) i.addEventListener('change', apply);
  range.append(h(doc, 'span', '', t('marks.from')), from, h(doc, 'span', '', t('marks.to')), to);
  side.append(range);

  const chips = h(doc, 'div', 'chips');
  for (const tag of TAGS) {
    const b = h(doc, 'button', 'chip');
    b.type = 'button';
    const on = view.tags.includes(tag);
    b.title = t(`mark.tag.${tag}`);
    b.setAttribute('aria-label', b.title);
    b.setAttribute('aria-pressed', String(on));
    b.style.color = TAG_COLORS[tag];
    const dot = h(doc, 'span', 'fut-mk-dot');
    dot.style.background = TAG_COLORS[tag];
    dot.style.borderColor = 'transparent';
    b.append(dot);
    b.addEventListener('click', () => go({ tags: on ? view.tags.filter((x) => x !== tag) : [...view.tags, tag] }));
    chips.append(b);
  }
  side.append(chips);
  const hides = h(doc, 'div', 'chips');
  for (const st of ['vacation', 'banned', 'inactive'] as const) {
    const b = h(doc, 'button', 'chip', t(`marks.hide.${st}`));
    b.type = 'button';
    const on = view.hide.includes(st);
    b.setAttribute('aria-pressed', String(on));
    b.addEventListener('click', () => go({ hide: on ? view.hide.filter((x) => x !== st) : [...view.hide, st] }));
    hides.append(b);
  }
  side.append(hides);

  // Today's statuses from the public API (read once, cached a day), else the ones the galaxy showed.
  const statusOf = (playerId: number | null, saved: string[]) => {
    const row = playerId ? uni?.players[String(playerId)] : undefined;
    return row ? statusNames(row[1]) : saved;
  };
  const withStatus: Marks = { ...marks, planets: Object.fromEntries(Object.entries(marks.planets).map(([c, p]) => [c, { ...p, statuses: statusOf(p.playerId, p.statuses) }])) };
  const hide = view.hide.flatMap((s) => (s === 'inactive' ? ['inactive', 'longinactive'] : [s]));
  const list = planetsInRange(withStatus, view.from || '1:0', view.to || '99:999', { tags: view.tags, hide });
  if (!uni) void universePlayers({ guard: o.guard, store: o.store, origin: doc.location.origin }).catch(() => null).then((u) => { if (u) { uni = u; refreshSide(); } });
  if (!list.length) {
    scroll.append(h(doc, 'p', 'empty', t(Object.keys(marks.planets).length ? 'marks.noneInRange' : 'marks.noPlanets')));
    return;
  }
  const now = Date.now();
  const wrap = h(doc, 'div', 'tg');
  const cols = h(doc, 'div', 'cols');
  cols.append(h(doc, 'span', ''), h(doc, 'span', '', t('marks.col.coords')), h(doc, 'span', '', t('marks.col.who')), h(doc, 'span', 'cell-r', t('marks.col.planet')), h(doc, 'span', 'cell-r', t('marks.col.seen')), h(doc, 'span', ''));
  wrap.append(cols);
  list.forEach(([coords, p], i) => {
    const system = coords.split(':').slice(0, 2).join(':');
    const seenRaw = positions[coords];
    const seen = seenRaw && (!p.playerId || seenRaw.player === p.playerId) ? seenRaw : null;
    const row = h(doc, 'div', `row${system === here ? ' active' : ''}`);
    const txt = h(doc, 'span', 'txt', p.planet || '?');
    txt.append(h(doc, 'span', `who${p.statuses[0] ? ` st-${p.statuses[0]}` : ''}`, p.player ? ` · ${p.player}` : ''));
    txt.title = `${p.planet} · ${p.player}`;
    row.append(h(doc, 'span', 'idx', String(i + 1)), coordsButton(doc, t, coords), txt, activityCell(doc, t, coords, 1, seen?.act[0] ?? null, seen, now), ageCell(doc, t, seen, now, locale), tagButton(picker, coords, p));
    wrap.append(row);
  });
  scroll.append(wrap);
  scroll.append(h(doc, 'p', 'foot', t('marks.planetsHint', { n: list.length })));
}
