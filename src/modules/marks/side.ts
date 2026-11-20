import { WINDOW_TOKENS } from '../../core/sheet';
/**
 * Targets side bar, after OGLight's side panel: it stays open on the left while the player moves in
 * the galaxy, and across pages. Lists the flagged players (one tab per flag, plus the ones opened
 * lately), by rank with their status; a player's sheet shows points and every planet and moon with
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
import { splitMilitary } from '../../engines/military';
import { highscoreHref } from '../../core/game-links';
import { ostatsUrl } from '../footer-links';
import { icon, type IconName } from '../../core/icons';
import type { NetworkGuard } from '../../core/guard';
import type { Store } from '../../core/storage';
import { formatUnits } from '../../core/format';
import { pageWindow } from '../../data/fleet-dispatcher';
import type { Activity } from '../../data/galaxy';
import { PLAYER_SCORES_KEY, playerScores, type PlayerScores, type ScoreType } from '../../data/player-api';
import { statusNames, universePlayers, type UniversePlayers } from '../../data/universe-players';
import { UNIVERSE_RANKS_KEY, universeRanks, type UniverseRanks } from '../../data/universe-ranks';
import { FLAGS, flagPlayer, loadMarks, MARKS_KEY, notePlayer, rememberRecent, type Flag, type Marks } from '../../engines/marks';
import { ageParts, planetsOf, POSITIONS_KEY, type Positions, type Seen } from '../../engines/positions';
import { FLAG_COLORS, flagButton, markIcon, MARKS_CSS } from './picker';

type T = (key: string, vars?: Record<string, string | number>) => string;

export const SIDE_ID = 'fut-side';
export const SIDE_W = 390;
const VIEW_KEY = 'marks.view';
/** Debris from which a field is worth a second look (set in the settings, galaxy section). */
export const BIG_DEBRIS_KEY = 'galaxy.bigDebris';
export const BIG_DEBRIS = 1_000_000;
const HOUR = 3_600_000;

interface View {
  open: boolean;
  flagTab: Flag | 'recent';
  /** Player whose sheet is open. */
  player: number | null;
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
/** Test helper: forget the statuses read in this page. */
export function resetSideCache(): void {
  uni = null;
  ranksLoading = false;
}
/** One read of the ranks at a time (the list redraws often). */
let ranksLoading = false;
/** Which status colours a name, most telling first. */
const STATUS_ORDER = ['banned', 'vacation', 'longinactive', 'inactive', 'outlaw', 'admin'];

const SCORE_LOOK: [ScoreType, IconName, string][] = [
  ['total', 'star', '#F5B547'], ['economy', 'swap', '#7FB8FF'], ['research', 'eye', '#4FE0B0'],
  ['lifeform', 'user', '#E58CDB'], ['military', 'fleet', '#FF7A7A'],
];

const CSS = `
/* Window tokens (core/sheet.ts) for every surface this sheet styles. */
:host { ${WINDOW_TOKENS} }
:host { all: initial; }
* { box-sizing: border-box; }
/* As wide as the room left of the game's page allows, between 300 and ${SIDE_W}px (--w, set from the page). */
.side {
  container-type: inline-size;
  position: fixed; left: 0; top: 0; bottom: 0; z-index: 1000000; width: var(--w, ${SIDE_W}px); max-width: 100vw; display: flex; flex-direction: column; gap: 6px;
  padding: 8px; background: var(--raised); border-right: 0; box-shadow: 6px 0 24px rgba(0,0,0,0.45);
  font: 12px/1.3 var(--body); color: var(--text-2); font-variant-numeric: tabular-nums; overflow: hidden;
}
button, input, textarea { font: inherit; color: inherit; }
button:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.mono, .coords, .num { font-family: var(--display); font-stretch: condensed; }

/* Head: back, who or what, close, on the board's band (as the windows). */
.head { display: flex; align-items: center; gap: 4px; min-height: 40px; margin: -8px -8px 0; padding: 0 4px; background: var(--band); }
.title { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 6px; font: 600 condensed 17px var(--display); color: var(--text); white-space: nowrap; overflow: hidden; }
.title .name { overflow: hidden; text-overflow: ellipsis; }
.title a { color: var(--on-band); font-weight: 400; font-size: 13px; text-decoration: none; }
.title a:hover { color: var(--accent-hi); }
.ib { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; padding: 0; border: 0; border-radius: 4px; background: none; color: var(--on-band); cursor: pointer; flex: none; text-decoration: none; }
.ib:hover { background: var(--band-2); color: var(--text); }

/* Tabs and filters. */
.chips { display: flex; flex-wrap: wrap; gap: 3px; }
.chip { display: inline-flex; align-items: center; justify-content: center; gap: 4px; flex: 1 0 auto; min-width: 30px; height: 28px; padding: 0 6px; border-radius: 4px; border: 0; background: var(--surface); color: var(--text-2); cursor: pointer; }
.chip:hover { background: var(--hover); }
.chip[aria-pressed="true"] { background: var(--hover); color: var(--text); box-shadow: inset 0 2px 0 currentColor; }
.chip .n { font: 600 condensed 13px var(--display); color: var(--text); }

/* Scores: what the number is, the number, the rank. Three per line. */
.scores { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 2px; flex: none; }
.score { grid-column: span 2; }
/* Fleet and defences, worked out from the military score: half a row each, under the six scores. */
.score.half { grid-column: span 3; }
.score { display: flex; flex-direction: column; gap: 1px; min-width: 0; padding: 6px 8px 7px; background: var(--surface); }
.score .k { display: flex; align-items: center; gap: 5px; color: var(--label); font-size: 12px; white-space: nowrap; overflow: hidden; }
.score b { font: 600 condensed 17px/19px var(--display); color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.score i { font: normal condensed 12px var(--display); color: var(--label); }
/* The game's own pages about this player. */
.actions { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 2px; flex: none; }
.actions a { display: flex; align-items: center; justify-content: center; gap: 6px; height: 30px; padding: 0 4px; border-radius: 4px; background: var(--surface); color: var(--text-2); text-decoration: none; white-space: nowrap; overflow: hidden; }
.actions a:hover { background: var(--hover); color: var(--text); }
/* The player's note. */
.note { display: flex; align-items: flex-start; gap: 6px; padding: 6px 8px; border-radius: 4px; background: var(--surface); flex: none; }
.note svg { flex: none; margin-top: 3px; color: var(--warn); }
.note textarea { flex: 1; min-width: 0; min-height: 20px; max-height: 120px; padding: 2px 0; border: 0; background: none; color: var(--text); resize: vertical; line-height: 1.4; field-sizing: content; }
.note textarea::placeholder { color: var(--quiet); }
.note textarea:focus { outline: none; }
.note:focus-within { box-shadow: inset 0 0 0 1px var(--accent); }
.note.off { color: var(--label); }


/* Lists: printed on the board, a hairline between rows, the pawn's top edge on the system on screen. */
.scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-color: var(--line-strong) var(--bg); scrollbar-width: thin; }
.pl, .ps { border-radius: 4px; background: var(--surface); overflow: hidden; }
.cols, .row { display: grid; align-items: center; gap: 6px; min-height: 28px; padding: 0 6px; }
.cols { min-height: 24px; color: var(--on-band); font-size: 11px; background: var(--band); }
.row + .row { border-top: 1px solid var(--line-soft); }
.row.gap { border-top-color: var(--line-strong); }
.row:hover { background: var(--hover); }
.row.active { background: var(--hover); box-shadow: inset 0 2px 0 var(--accent); }
.pl .cols, .pl .row { grid-template-columns: 18px 84px minmax(0, 1fr) 46px 40px 40px 34px; }
.ps .row { grid-template-columns: 18px minmax(0, 1fr) auto 30px auto; min-height: 30px; }
.idx { color: var(--quiet); font: condensed 12px var(--display); text-align: right; }
.coords { all: unset; display: inline-flex; align-items: center; gap: 3px; padding: 2px 3px; border-radius: 3px; color: var(--text); font: 600 condensed 14px var(--display); cursor: pointer; white-space: nowrap; }
.coords:hover { background: var(--band-2); color: var(--accent-hi); }
.row.active .coords { color: var(--accent); }
.coords.new::after { content: ''; width: 5px; height: 5px; border-radius: 50%; background: var(--accent); }
.where { display: inline-flex; align-items: center; gap: 2px; min-width: 0; }
.home { flex: none; color: var(--warn); }
.pn { min-width: 0; color: var(--label); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cell-r { text-align: right; font: condensed 13px var(--display); color: var(--quiet); white-space: nowrap; overflow: hidden; }
.cols .cell-r { font: inherit; color: inherit; }
.cell-r.has { color: var(--text-2); }
.cell-r.big { color: var(--warn); font-weight: 700; }
.txt { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text); }
.txt .who { color: var(--label); }
.who2 { display: flex; flex-direction: column; min-width: 0; padding: 3px 0; }
.pname { all: unset; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text); font-weight: 700; cursor: pointer; }
.pname:hover, .pname:focus-visible { color: var(--accent); }
.pnote { color: var(--label); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rank { color: var(--label); font: condensed 12px var(--display); }
.pline { display: flex; align-items: baseline; gap: 5px; min-width: 0; }
.pline .pname { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pst { flex: none; font: condensed 12px var(--display); color: var(--label); }
.act { display: inline-flex; align-items: center; justify-content: flex-end; gap: 2px; height: 22px; padding: 0 2px; border-radius: 3px; font: 600 condensed 13px var(--display); text-decoration: none; color: var(--quiet); }
.act svg { color: var(--quiet); flex: none; }
a.act:hover { background: var(--hover); }
.act.on { color: var(--old); } .act.mid { color: var(--warm); } .act.off { color: var(--fresh); } .act.unknown { color: var(--quiet); font-weight: 400; }
.age { text-align: right; font: condensed 13px var(--display); }
.age.fresh { color: var(--fresh); } .age.warm { color: var(--warm); } .age.old { color: var(--old); } .age.none { color: var(--quiet); }
.st-inactive { color: var(--fresh) !important; } .st-longinactive { color: var(--label) !important; } .st-vacation { color: var(--accent-hi) !important; } .st-banned { color: var(--bad) !important; text-decoration: line-through; }
.foot { display: flex; justify-content: space-between; gap: 6px; margin: 6px 0 0; color: var(--label); font-size: 11px; flex: none; }
kbd { padding: 0 4px; border: 0; border-radius: 3px; background: var(--surface); color: var(--text-2); font: 600 condensed 12px var(--display); }
.empty { margin: 4px 0; padding: 14px 10px; border-radius: 4px; background: var(--surface); color: var(--label); text-align: center; line-height: 1.4; }
.err { color: var(--old); }
.fut-mk { margin: 0; }
/* Narrow screens: the planet's name and the row number give their room to the numbers. */
@container (max-width: 350px) {
  .pl .cols, .pl .row { grid-template-columns: 84px minmax(0, 1fr) 40px 40px 34px; }
  .pl .idx, .pl .pn { display: none; }
  .pl .cols > :first-child, .pl .cols > :nth-child(3) { display: none; }
  .scores { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .score.half { grid-column: span 2; }
  .actions a span { display: none; }
}
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
  // Older saves may carry the planets tab's fields: only these three are read.
  const saved = o.store.get<Partial<View>>(VIEW_KEY, {});
  return { open: saved.open ?? false, flagTab: saved.flagTab ?? 'watch', player: saved.player ?? null };
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

/** The game's empire page is a table as wide as the screen: the side bar would only cover it. */
const isEmpire = (doc: Document): boolean => /[?&]component=empire\b/.test(doc.location?.href ?? '');

/**
 * As wide as the room left of the game's content, so the bar covers the menu at most and never the
 * page being played; never under 300px (the rows need it) nor over SIDE_W.
 */
function fitWidth(doc: Document): void {
  const host = doc.getElementById(SIDE_ID);
  if (!host) return;
  const content = doc.getElementById('middle') ?? doc.getElementById('contentWrapper') ?? doc.getElementById('pageContent');
  const room = content ? Math.floor(content.getBoundingClientRect().left) : SIDE_W;
  host.style.setProperty('--w', `${Math.max(300, Math.min(SIDE_W, room))}px`);
}
const fitted = new WeakSet<Document>();

/** The "Bersagli" button: opens the side bar, or closes it when open. */
export function toggleSide(o: SideOptions): void {
  if (isSideOpen(o.doc)) closeSide(o.doc, o.store);
  else openSide(o, { open: true });
}

/** Opens the side bar again on a new page when the player left it open (no request if cached). */
export function restoreSide(o: SideOptions): void {
  if (readView(o).open && !isEmpire(o.doc)) openSide(o, {});
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
  if (isEmpire(doc)) return;
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
    playersList(o, side, scroll, view, marks, picker, go, positions);
  }
  side.append(scroll);
  const foot = h(doc, 'div', 'foot');
  const key = h(doc, 'span', '');
  key.append(h(doc, 'kbd', '', 'M'), doc.createTextNode(` ${t('marks.keyNext')}`));
  foot.append(key, h(doc, 'span', '', t('marks.footData')));
  side.append(foot);

  root.replaceChildren(style, side);
  scroll.scrollTop = keepScroll;
  // The width is a custom property on the host: the shadow tree inherits it.
  fitWidth(doc);
  if (!fitted.has(doc) && doc.defaultView) {
    fitted.add(doc);
    doc.defaultView.addEventListener('resize', () => fitWidth(doc));
  }
}

function iconButton(doc: Document, name: IconName, label: string): HTMLButtonElement {
  const b = h(doc, 'button', 'ib');
  b.type = 'button';
  b.title = label;
  b.setAttribute('aria-label', label);
  b.append(icon(doc, name, 16));
  return b;
}

type Picker = { doc: Document; store: Store; t: T; onChange: () => void };

function playersList(o: SideOptions, side: HTMLElement, scroll: HTMLElement, view: View, marks: Marks, picker: Picker, go: (v: Partial<View>) => void, positions: Positions): void {
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
    b.append(f === 'recent' ? icon(doc, 'eye', 12) : markIcon(doc, f, 13), h(doc, 'span', 'n', String(f === 'recent' ? marks.recent.length : counts[f] ?? 0)));
    b.addEventListener('click', () => go({ flagTab: f }));
    chips.append(b);
  }
  side.append(chips);
  // Ranks for the whole universe in one public file (cached an hour), statuses from players.xml
  // (cached a day): the list is current without opening each player. Cards already read fill gaps.
  const ranks = o.store.get<UniverseRanks | null>(UNIVERSE_RANKS_KEY, null);
  if ((!ranks || Date.now() - ranks.at > 3_600_000) && !ranksLoading) {
    ranksLoading = true;
    void universeRanks({ guard: o.guard, store: o.store, origin: doc.location.origin })
      .catch(() => null)
      .then((r) => {
        ranksLoading = false;
        if (r && r.at !== ranks?.at) refreshSide();
      });
  }
  if (!uni) void universePlayers({ guard: o.guard, store: o.store, origin: doc.location.origin }).catch(() => null).then((u) => { if (u) { uni = u; refreshSide(); } });
  const cache = o.store.get<Record<string, PlayerScores>>(PLAYER_SCORES_KEY, {});
  const rankOf = (id: number) => ranks?.ranks[String(id)]?.[0] ?? cache[String(id)]?.scores.total?.rank ?? null;
  const byRank = (a: { id: number; name: string }, b: { id: number; name: string }) =>
    (rankOf(a.id) ?? Infinity) - (rankOf(b.id) ?? Infinity) || a.name.localeCompare(b.name);
  // Flag lists by rank; the recent ones stay in the order they were opened.
  const list = view.flagTab === 'recent'
    ? marks.recent
    : Object.entries(marks.players).filter(([, p]) => p.flag === view.flagTab).map(([id, p]) => ({ id: Number(id), name: p.name })).sort(byRank);
  if (!list.length) {
    scroll.append(h(doc, 'p', 'empty', t(view.flagTab === 'recent' ? 'marks.noRecent' : 'marks.noPlayers')));
    return;
  }
  // When each player was last looked at in the galaxy: the newest reading among their positions.
  const checked = new Map<number, number>();
  for (const seen of Object.values(positions)) if (seen.player && seen.at > (checked.get(seen.player) ?? 0)) checked.set(seen.player, seen.at);
  const now = Date.now();
  const wrap = h(doc, 'div', 'ps');
  list.forEach((p, i) => {
    const row = h(doc, 'div', 'row');
    const name = h(doc, 'button', 'pname', p.name || `#${p.id}`);
    name.type = 'button';
    name.title = t('marks.openSheet');
    name.addEventListener('click', () => go({ player: p.id }));
    const rank = rankOf(p.id);
    const who = h(doc, 'span', 'who2');
    // Status as in the galaxy: the name in the status colour, the API's letters after it.
    const letters = uni?.players[String(p.id)]?.[1] ?? '';
    const names = statusNames(letters);
    const top = STATUS_ORDER.find((st) => names.includes(st));
    const line1 = h(doc, 'span', 'pline');
    if (top) name.classList.add(`st-${top}`);
    line1.append(name);
    if (letters) {
      const tag = h(doc, 'span', `pst${top ? ` st-${top}` : ''}`, `(${letters})`);
      tag.title = names.map((st) => t(`marks.st.${st}`)).join(', ');
      line1.append(tag);
    }
    who.append(line1);
    const note = marks.players[String(p.id)]?.note;
    if (note) {
      const line = h(doc, 'span', 'pnote', note);
      line.title = note;
      who.append(line);
    }
    const at = checked.get(p.id);
    const age = ageCell(doc, t, at ? ({ at } as Seen) : null, now, locale);
    age.title = at ? t('marks.lastCheck', { time: new Date(at).toLocaleString(locale) }) : t('marks.neverChecked');
    row.append(h(doc, 'span', 'idx', String(i + 1)), who, h(doc, 'span', 'rank', rank ? `#${rank.toLocaleString(locale)}` : ''), age, flagButton(picker, p.id, p.name));
    wrap.append(row);
  });
  scroll.append(wrap);
}

function activityCell(doc: Document, t: T, coords: string, type: 1 | 3, value: Activity, seen: Seen | null, now: number): HTMLElement {
  const a = h(doc, 'a', 'act');
  a.href = fleetHref(coords, type);
  a.title = t(type === 1 ? 'marks.fleetPlanet' : 'marks.fleetMoon', { coords });
  a.append(icon(doc, type === 1 ? 'planet' : 'moon', 12));
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
    a.href = highscoreHref(id, rank);
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
  const score = (ico: IconName, color: string, label: string, value: string, rankText: string, cls = '') => {
    const cell = h(doc, 'div', `score${cls ? ` ${cls}` : ''}`);
    const k = h(doc, 'span', 'k');
    const ic = icon(doc, ico, 12);
    ic.style.color = color;
    k.append(ic, doc.createTextNode(label));
    const b = h(doc, 'b', '', value);
    // The category's colour on its icon only: the figures are printed in the board's ink.
    cell.append(k, b, h(doc, 'i', '', rankText));
    scores.append(cell);
    return cell;
  };
  for (const [key, ico, color] of SCORE_LOOK) {
    const v = data?.scores[key];
    score(ico, color, t(`galaxy.score.${key}`), v ? formatUnits(v.points, locale) : '—', v ? `#${v.rank.toLocaleString(locale)}` : '');
  }
  score('fleet', '#C9D4E2', t('marks.ships'), data?.ships ? data.ships.toLocaleString(locale) : '—', '');
  // Military split into fleet and defences, from the other scores (engines/military): an estimate, no rank.
  const split = data ? splitMilitary(data.scores) : null;
  if (split) {
    for (const [key, ico, value] of [['fleet', 'fleet', split.fleet], ['defence', 'shield', split.defence]] as const) {
      score(ico, '#FF7A7A', t(`galaxy.score.${key}`), formatUnits(value, locale), t('marks.estimate'), 'half').title = t('galaxy.splitHint');
    }
  }
  side.append(scores);

  const actions = h(doc, 'div', 'actions');
  const link = (ico: IconName, label: string, href: string, newTab = false) => {
    const a = h(doc, 'a');
    a.href = href;
    a.title = label;
    if (newTab) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    a.append(icon(doc, ico, 13), h(doc, 'span', '', label));
    actions.append(a);
  };
  link('pen', t('marks.writeShort'), `/game/index.php?page=ingame&component=chat&playerId=${id}`);
  link('user', t('marks.profile'), `/game/index.php?page=ingame&component=playerprofile&profileId=${id}`);
  link('chart', t('marks.rank'), highscoreHref(id, rank));
  // The player's page on ostats.eu (asked by Nicola), in a new tab: a plain link, no request of ours.
  link('eye', 'ostats', ostatsUrl(doc.location?.host ?? '', id), true);
  side.append(actions);

  // A note of the player's own on this one: kept with the flag, so it needs one.
  const flagged = marks.players[String(id)];
  const noteBox = h(doc, 'label', `note${flagged ? '' : ' off'}`);
  noteBox.append(icon(doc, 'note', 13));
  if (flagged) {
    const area = h(doc, 'textarea');
    area.rows = 1;
    area.maxLength = 500;
    area.placeholder = t('marks.notePlaceholder');
    area.setAttribute('aria-label', t('marks.note'));
    area.value = flagged.note ?? '';
    // Typing here must not reach the game's keys nor Future's shortcuts.
    for (const ev of ['keydown', 'keyup', 'keypress'] as const) area.addEventListener(ev, (e) => e.stopPropagation());
    area.addEventListener('change', () => store.set(MARKS_KEY, notePlayer(readMarks(store), id, area.value)));
    noteBox.append(area);
  } else noteBox.append(h(doc, 'span', '', t('marks.noteNeedsFlag')));
  side.append(noteBox);

  if (!data) {
    scroll.append(h(doc, 'p', 'empty err', t('galaxy.apiError')));
    return;
  }
  const lines = planetsOf(id, data, positions);
  // The home planet is the first one the player ever had: the lowest id in the API's list.
  const first = (data.planets ?? []).reduce<{ id: number; coords: string } | null>((lo, p) => (p.id > 0 && (!lo || p.id < lo.id) ? p : lo), null);
  const big = store.get<number>(BIG_DEBRIS_KEY, BIG_DEBRIS);
  const now = Date.now();
  const wrap = h(doc, 'div', 'pl');
  const cols = h(doc, 'div', 'cols');
  cols.append(h(doc, 'span', ''), h(doc, 'span', '', t('marks.col.coords')), h(doc, 'span', '', t('marks.col.name')), h(doc, 'span', 'cell-r', t('marks.col.debris')), h(doc, 'span', 'cell-r', t('marks.col.planet')), h(doc, 'span', 'cell-r', t('marks.col.moon')), h(doc, 'span', 'cell-r', t('marks.col.seen')));
  wrap.append(cols);
  let lastSystem = '';
  lines.forEach((p, i) => {
    const system = p.coords.split(':').slice(0, 2).join(':');
    const isHome = first?.coords === p.coords;
    const row = h(doc, 'div', `row${i > 0 && system !== lastSystem ? ' gap' : ''}${system === here ? ' active' : ''}${isHome ? ' is-home' : ''}`);
    lastSystem = system;
    const debris = p.seen?.debris ?? 0;
    const where = h(doc, 'span', 'where');
    where.append(coordsButton(doc, t, p.coords, p.fresh));
    if (isHome) {
      const mark = icon(doc, 'home', 12, 'home');
      mark.setAttribute('role', 'img');
      mark.setAttribute('aria-label', t('marks.home'));
      const tip = doc.createElementNS('http://www.w3.org/2000/svg', 'title');
      tip.textContent = t('marks.home');
      mark.append(tip);
      where.append(mark);
    }
    const pn = h(doc, 'span', 'pn', p.name);
    pn.title = isHome ? `${p.name} · ${t('marks.home')}` : p.name;
    row.append(
      h(doc, 'span', 'idx', String(i + 1)),
      where,
      pn,
      h(doc, 'span', `cell-r${debris ? ' has' : ''}${debris >= big ? ' big' : ''}`, p.seen ? formatUnits(debris, locale) : '—'),
      activityCell(doc, t, p.coords, 1, p.seen?.act[0] ?? null, p.seen, now),
      p.moon ? activityCell(doc, t, p.coords, 3, p.seen?.act[1] ?? null, p.seen, now) : h(doc, 'span', ''),
      ageCell(doc, t, p.seen, now, locale),
    );
    wrap.append(row);
  });
  scroll.append(wrap);
  scroll.append(h(doc, 'p', 'foot', t('marks.planets', { n: lines.length, moons: lines.filter((l) => l.moon).length }) + ' · ' + t('galaxy.apiAge', { time: new Date(data.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })));
}
