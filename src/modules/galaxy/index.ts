/**
 * Galaxy view helpers, as in OGLight: a summary of the system on screen, a light mark on inactive
 * players and on the player's own planets, debris (metal + crystal + deuterium), a flag on players and a colour on planets
 * (Future's targets, no probe button: AGENTS.md §1.5.1) and a card with the player's points and ranks.
 *
 * COMPLIANCE: everything is read from the system the game drew itself. The only call is the
 * public API card (`playerScores`, reason 'user-view', cached an hour), asked when the player
 * points at a rank badge. No game action, no game request.
 */
import { loadMarks, MARKS_KEY, type Marks } from '../../engines/marks';
import { POSITIONS_KEY, recordSystem, type Positions } from '../../engines/positions';
import { ensureMarksStyle, flagButton, TAG_COLORS, tagButton } from '../marks/picker';
import type { NetworkGuard } from '../../core/guard';
import type { Store } from '../../core/storage';
import { formatUnits } from '../../core/format';
import { debrisTotal, readGalaxy, type GalaxyRow, type GalaxySystem } from '../../data/galaxy';
import { playerScores, SCORE_TYPES, type PlayerScores, type ScoreType } from '../../data/player-api';
import { GALAXY_CSS } from './style';

/** Galaxy targets saved before 2026-11-06, moved into the planet marks (engines/marks). */
export const TARGETS_KEY = 'galaxy.targets';
/** Debris worth a second look (metal + crystal + deuterium). */
const BIG_DEBRIS = 1_000_000;

export interface GalaxyOptions {
  doc: Document;
  store: Store;
  guard: NetworkGuard;
  ownPlanetIds: Set<number>;
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** After the game drew a system and Future read it (the side bar redraws). */
  onSystem?: () => void;
}

/** Position to mark in the next system drawn ("g:s:p"): the one the side bar or the URL asked for. */
let highlight = '';
export function highlightPosition(coords: string): void {
  highlight = coords;
}

export const isGalaxyPage = (doc: Document): boolean => new URL(doc.location?.href ?? 'http://x/').searchParams.get('component') === 'galaxy';

const coordsOf = (s: GalaxySystem, r: GalaxyRow): string => `${s.galaxy}:${s.system}:${r.position}`;

/** Counts for the summary strip. */
export function systemSummary(s: GalaxySystem, ownPlanetIds: Set<number>) {
  const players = new Set<number | string>();
  const inactive = new Set<number | string>();
  const longInactive = new Set<number | string>();
  const vacation = new Set<number | string>();
  let moons = 0;
  let debris = 0;
  let fields = 0;
  for (const r of s.rows) {
    const who = r.playerId ?? r.playerName;
    if (r.moonId) moons++;
    if (r.debris) {
      fields++;
      debris += debrisTotal(r.debris);
    }
    if (!who || (r.planetId && ownPlanetIds.has(r.planetId))) continue;
    players.add(who);
    if (r.statuses.includes('vacation')) vacation.add(who);
    else if (r.statuses.includes('longinactive')) longInactive.add(who);
    if (!r.statuses.includes('vacation') && (r.statuses.includes('inactive') || r.statuses.includes('longinactive'))) inactive.add(who);
  }
  return { players: players.size, inactive: inactive.size, longInactive: longInactive.size, vacation: vacation.size, moons, debris, fields, deep: s.deepDebris ? debrisTotal(s.deepDebris) : 0 };
}

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}

/** True for nodes Future added itself, so its own drawing does not wake the watcher again. */
const isOurs = (n: Node): boolean => n instanceof Element && (/(^|\s)fut-/.test(n.getAttribute('class') ?? '') || !!n.closest('.fut-mk, [class*="fut-g-"]'));

export function watchGalaxy(o: GalaxyOptions): void {
  const { doc } = o;
  // The game may replace #galaxyContent itself when it loads a system: watch the stable component around it.
  const component = doc.getElementById('galaxycomponent') ?? doc.getElementById('galaxyContent')?.parentElement;
  if (!component || !doc.defaultView) return;
  if (!doc.getElementById('fut-galaxy-css')) {
    const style = el(doc, 'style');
    style.id = 'fut-galaxy-css';
    style.textContent = GALAXY_CSS;
    doc.head.append(style);
  }
  ensureMarksStyle(doc);
  highlight = (() => {
    const q = new URL(doc.location.href).searchParams;
    return q.get('galaxy') && q.get('system') && q.get('position') ? `${q.get('galaxy')}:${q.get('system')}:${q.get('position')}` : '';
  })();
  let queued = false;
  const run = () => {
    queued = false;
    const content = doc.getElementById('galaxyContent');
    if (!content) return;
    remember(o);
    decorate(o, content);
    o.onSystem?.();
  };
  // Event-driven, not polling: the game redraws the table each time the player moves to another system.
  new doc.defaultView.MutationObserver((records) => {
    const theirs = records.some((r) => ![...r.addedNodes, ...r.removedNodes].every(isOurs));
    if (!theirs || queued) return;
    queued = true;
    setTimeout(run, 30);
  }).observe(component, { childList: true, subtree: true });
  run();
}

/**
 * Keeps the system the game drew in Future's position memory, for the players and planets the
 * player marked or opened lately (engines/positions). Only when the game redrew it.
 */
function remember(o: GalaxyOptions): void {
  const s = readGalaxy(o.doc);
  if (!s) return;
  const marks = loadMarks(o.store.get<Partial<Marks> | null>(MARKS_KEY, null));
  const recent = new Set(marks.recent.map((r) => r.id));
  const keep = (id: number, coords: string) => !!marks.players[String(id)] || recent.has(id) || !!marks.planets[coords];
  const rows = s.rows.filter((r) => !(r.planetId && o.ownPlanetIds.has(r.planetId))).map((r) => ({ ...r, debris: r.debris ? debrisTotal(r.debris) : 0 }));
  const next = recordSystem(o.store.get<Positions>(POSITIONS_KEY, {}), s.galaxy, s.system, rows, keep, Date.now());
  if (next) o.store.set(POSITIONS_KEY, next);
}

function decorate(o: GalaxyOptions, content: Element): void {
  const { doc, store, t, locale } = o;
  const s = readGalaxy(doc);
  if (!s) return;
  const marks = loadMarks(store.get<Partial<Marks> | null>(MARKS_KEY, null));
  const redraw = () => decorate(o, content);
  const picker = { doc, store, t, onChange: redraw };

  for (const r of s.rows) {
    const coords = coordsOf(s, r);
    const own = r.planetId !== null && o.ownPlanetIds.has(r.planetId);
    const inactive = !r.statuses.includes('vacation') && (r.statuses.includes('inactive') || r.statuses.includes('longinactive'));
    const tag = marks.planets[coords]?.tag;
    r.row.classList.toggle('fut-g-own', own);
    r.row.classList.toggle('fut-g-inactive', inactive && !own);
    r.row.classList.toggle('fut-g-tagged', !!tag);
    r.row.classList.toggle('fut-g-hl', coords === highlight);
    const rowStyle = (r.row as HTMLElement).style;
    if (tag) rowStyle.setProperty('--fut-tag', TAG_COLORS[tag]);
    else rowStyle.removeProperty('--fut-tag');

    // Planet colour on occupied positions that are not the player's own (replaces the old target mark).
    const nameCell = r.row.querySelector('.cellPlanetName');
    if (nameCell && r.planetId && !own && !nameCell.querySelector('.fut-mk-tag'))
      nameCell.append(tagButton(picker, coords, { planet: r.planetName, player: r.playerName, playerId: r.playerId, statuses: r.statuses, moon: !!r.moonId }));
    else if (nameCell && (own || !r.planetId)) nameCell.querySelector('.fut-mk-tag')?.remove();

    // Rank badge (hover: scores card) and the player's flag.
    const playerCell = r.row.querySelector('.cellPlayerName');
    if (playerCell && r.playerId && r.rank && !playerCell.querySelector('.fut-g-rank')) {
      const id = r.playerId;
      const badge = el(doc, 'button', 'fut-g-rank', `#${r.rank.toLocaleString(locale)}`);
      badge.type = 'button';
      badge.setAttribute('aria-label', t('galaxy.rankTitle', { name: r.playerName }));
      const show = () => void openCard(o, badge, id, r.playerName);
      badge.addEventListener('mouseenter', show);
      badge.addEventListener('focus', show);
      badge.addEventListener('mouseleave', () => closeCard(doc));
      badge.addEventListener('blur', () => closeCard(doc));
      playerCell.querySelector('.playerName')?.after(badge);
      if (!own) badge.after(flagButton(picker, id, r.playerName));
    }

    // Debris value under the game's icon.
    const debrisCell = r.row.querySelector('.cellDebris');
    if (debrisCell && r.debris && !debrisCell.querySelector('.fut-g-dval')) {
      const total = debrisTotal(r.debris);
      debrisCell.append(el(doc, 'span', `fut-g-dval${total >= BIG_DEBRIS ? ' big' : ''}`, formatUnits(total, locale)));
    }
  }

  renderBar(o, content, s);
}

function renderBar(o: GalaxyOptions, content: Element, s: GalaxySystem): void {
  const { doc, t, locale } = o;
  const sum = systemSummary(s, o.ownPlanetIds);
  const bar = el(doc, 'div', 'fut-g-bar');
  bar.id = 'fut-galaxy-bar';
  const part = (cls: string, text: string) => bar.append(el(doc, 'span', cls, text));
  bar.append(el(doc, 'b', '', `${s.galaxy}:${s.system}`));
  part('', t('galaxy.players', { count: sum.players }));
  part('fut-g-inact', t('galaxy.inactive', { count: sum.inactive }) + (sum.longInactive ? ` (${t('galaxy.longInactive', { count: sum.longInactive })})` : ''));
  part('fut-g-vac', t('galaxy.vacation', { count: sum.vacation }));
  part('fut-g-muted', t('galaxy.moons', { count: sum.moons }));
  part(sum.debris >= BIG_DEBRIS ? 'fut-g-deb' : 'fut-g-muted', sum.fields ? t('galaxy.debris', { msu: formatUnits(sum.debris, locale), count: sum.fields }) : t('galaxy.noDebris'));
  if (sum.deep) part(sum.deep >= BIG_DEBRIS ? 'fut-g-deb' : 'fut-g-muted', t('galaxy.deep', { msu: formatUnits(sum.deep, locale) }));
  doc.getElementById(bar.id)?.remove();
  content.before(bar);
}

const CARD_ID = 'fut-galaxy-card';
let cardFor = 0;

function closeCard(doc: Document): void {
  cardFor = 0;
  doc.getElementById(CARD_ID)?.remove();
}

async function openCard(o: GalaxyOptions, anchor: Element, id: number, name: string): Promise<void> {
  const { doc, t, locale } = o;
  closeCard(doc);
  cardFor = id;
  const card = el(doc, 'div', 'fut-g-card');
  card.id = CARD_ID;
  card.setAttribute('role', 'tooltip');
  card.append(el(doc, 'h4', '', t('galaxy.rankTitle', { name })));
  const note = el(doc, 'p', '', t('galaxy.loading'));
  card.append(note);
  doc.body.append(card);
  // Under the badge, inside the window; above it when there is no room below.
  const place = () => {
    const box = anchor.getBoundingClientRect();
    const view = doc.defaultView;
    const h = card.offsetHeight;
    const below = box.bottom + 6 + h <= (view?.innerHeight ?? 800);
    card.style.left = `${Math.max(8, Math.min(box.left, (view?.innerWidth ?? 1200) - card.offsetWidth - 8))}px`;
    card.style.top = `${below ? box.bottom + 6 : Math.max(8, box.top - 6 - h)}px`;
  };
  place();
  let data: PlayerScores | null = null;
  try {
    data = await playerScores(o.guard, o.store, doc.location.origin, id, Date.now());
  } catch {
    data = null;
  }
  if (cardFor !== id || !card.isConnected) return; // the pointer moved on
  if (!data) {
    note.textContent = t('galaxy.apiError');
    note.className = 'err';
    return;
  }
  const table = el(doc, 'table');
  for (const key of Object.keys(SCORE_TYPES) as ScoreType[]) {
    const v = data.scores[key];
    if (!v) continue;
    const tr = el(doc, 'tr');
    tr.append(el(doc, 'td', '', t(`galaxy.score.${key}`)), el(doc, 'td', '', formatUnits(v.points, locale)), el(doc, 'td', 'r', `#${v.rank.toLocaleString(locale)}`));
    table.append(tr);
  }
  note.before(table);
  const parts = [t('galaxy.apiAge', { time: new Date(data.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })];
  if (data.ships) parts.unshift(t('galaxy.ships', { count: data.ships.toLocaleString(locale) }));
  note.textContent = parts.join(' · ');
  place();
}
