/**
 * Galaxy view helpers, as in OGLight: a summary of the system on screen, a light mark on inactive
 * players and on the player's own planets, debris in MSU, a hand-made target list (coordinates
 * only, no probe button: AGENTS.md §1.4) and a card with the player's points and ranks.
 *
 * COMPLIANCE: everything is read from the system the game drew itself. The only call is the
 * public API card (`playerScores`, reason 'user-view', cached an hour), asked when the player
 * points at a rank badge. No game action, no game request.
 */
import type { NetworkGuard } from '../../core/guard';
import type { Store } from '../../core/storage';
import { formatUnits } from '../../core/format';
import { icon } from '../../core/icons';
import { debrisMsu, readGalaxy, type GalaxyRow, type GalaxySystem } from '../../data/galaxy';
import { playerScores, SCORE_TYPES, type PlayerScores, type ScoreType } from '../../data/player-api';
import { GALAXY_CSS } from './style';

export const TARGETS_KEY = 'galaxy.targets';
/** Debris worth a second look, in MSU. */
const BIG_DEBRIS = 1_000_000;

export interface Target {
  coords: string;
  planet: string;
  player: string;
  at: number;
}

export interface GalaxyOptions {
  doc: Document;
  store: Store;
  guard: NetworkGuard;
  ownPlanetIds: Set<number>;
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

export const isGalaxyPage = (doc: Document): boolean => new URL(doc.location?.href ?? 'http://x/').searchParams.get('component') === 'galaxy';

const coordsOf = (s: GalaxySystem, r: GalaxyRow): string => `${s.galaxy}:${s.system}:${r.position}`;

/** Adds or removes a target; returns the new list (newest first). */
export function toggleTarget(list: Target[], target: Target): Target[] {
  return list.some((x) => x.coords === target.coords) ? list.filter((x) => x.coords !== target.coords) : [target, ...list];
}

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
      debris += debrisMsu(r.debris);
    }
    if (!who || (r.planetId && ownPlanetIds.has(r.planetId))) continue;
    players.add(who);
    if (r.statuses.includes('vacation')) vacation.add(who);
    else if (r.statuses.includes('longinactive')) longInactive.add(who);
    if (!r.statuses.includes('vacation') && (r.statuses.includes('inactive') || r.statuses.includes('longinactive'))) inactive.add(who);
  }
  return { players: players.size, inactive: inactive.size, longInactive: longInactive.size, vacation: vacation.size, moons, debris, fields, deep: s.deepDebris ? debrisMsu(s.deepDebris) : 0 };
}

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}

/** True for nodes Future added itself, so its own drawing does not wake the watcher again. */
const isOurs = (n: Node): boolean => n instanceof Element && /(^|\s)fut-g-/.test(n.className);

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
  let listOpen = false;
  let queued = false;
  const run = () => {
    queued = false;
    const content = doc.getElementById('galaxyContent');
    if (content) decorate(o, content, () => listOpen, (v) => (listOpen = v));
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

function decorate(o: GalaxyOptions, content: Element, isOpen: () => boolean, setOpen: (v: boolean) => void): void {
  const { doc, store, t, locale } = o;
  const s = readGalaxy(doc);
  if (!s) return;
  const targets = store.get<Target[]>(TARGETS_KEY, []);
  const redraw = () => decorate(o, content, isOpen, setOpen);

  for (const r of s.rows) {
    const coords = coordsOf(s, r);
    const own = r.planetId !== null && o.ownPlanetIds.has(r.planetId);
    const inactive = !r.statuses.includes('vacation') && (r.statuses.includes('inactive') || r.statuses.includes('longinactive'));
    const isTarget = targets.some((x) => x.coords === coords);
    r.row.classList.toggle('fut-g-own', own);
    r.row.classList.toggle('fut-g-inactive', inactive && !own);
    r.row.classList.toggle('fut-g-target', isTarget);

    // Target mark on occupied positions that are not the player's own.
    const nameCell = r.row.querySelector('.cellPlanetName');
    let mark = nameCell?.querySelector<HTMLButtonElement>('.fut-g-mark') ?? null;
    if (nameCell && r.planetId && !own) {
      if (!mark) {
        mark = el(doc, 'button', 'fut-g-mark');
        mark.type = 'button';
        mark.append(icon(doc, 'target', 14));
        nameCell.append(mark);
      }
      mark.classList.toggle('on', isTarget);
      mark.setAttribute('aria-pressed', String(isTarget));
      const label = t(isTarget ? 'galaxy.targetRemove' : 'galaxy.targetAdd');
      mark.title = label;
      mark.setAttribute('aria-label', `${label}: ${r.planetName} [${coords}]`);
      mark.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        store.set(TARGETS_KEY, toggleTarget(store.get<Target[]>(TARGETS_KEY, []), { coords, planet: r.planetName, player: r.playerName, at: Date.now() }));
        redraw();
      };
    } else mark?.remove();

    // Rank badge: hovering or focusing it opens the scores card.
    const playerCell = r.row.querySelector('.cellPlayerName');
    if (playerCell && r.playerId && r.rank && !playerCell.querySelector('.fut-g-rank')) {
      const badge = el(doc, 'button', 'fut-g-rank', `#${r.rank.toLocaleString(locale)}`);
      badge.type = 'button';
      badge.setAttribute('aria-label', t('galaxy.rankTitle', { name: r.playerName }));
      const id = r.playerId;
      const show = () => void openCard(o, badge, id, r.playerName);
      badge.addEventListener('mouseenter', show);
      badge.addEventListener('focus', show);
      badge.addEventListener('mouseleave', () => closeCard(doc));
      badge.addEventListener('blur', () => closeCard(doc));
      playerCell.querySelector('.playerName')?.after(badge);
    }

    // Debris value under the game's icon.
    const debrisCell = r.row.querySelector('.cellDebris');
    if (debrisCell && r.debris && !debrisCell.querySelector('.fut-g-dval')) {
      const msu = debrisMsu(r.debris);
      debrisCell.append(el(doc, 'span', `fut-g-dval${msu >= BIG_DEBRIS ? ' big' : ''}`, formatUnits(msu, locale)));
    }
  }

  renderBar(o, content, s, targets, isOpen, setOpen, redraw);
}

function renderBar(o: GalaxyOptions, content: Element, s: GalaxySystem, targets: Target[], isOpen: () => boolean, setOpen: (v: boolean) => void, redraw: () => void): void {
  const { doc, store, t, locale } = o;
  const sum = systemSummary(s, o.ownPlanetIds);
  const bar = el(doc, 'div', 'fut-g-bar');
  bar.id = 'fut-galaxy-bar';
  const part = (cls: string, text: string) => bar.append(el(doc, 'span', cls, text));
  const coords = el(doc, 'b', '', `${s.galaxy}:${s.system}`);
  bar.append(coords);
  part('', t('galaxy.players', { count: sum.players }));
  part('fut-g-inact', t('galaxy.inactive', { count: sum.inactive }) + (sum.longInactive ? ` (${t('galaxy.longInactive', { count: sum.longInactive })})` : ''));
  part('fut-g-vac', t('galaxy.vacation', { count: sum.vacation }));
  part('fut-g-muted', t('galaxy.moons', { count: sum.moons }));
  part(sum.debris >= BIG_DEBRIS ? 'fut-g-deb' : 'fut-g-muted', sum.fields ? t('galaxy.debris', { msu: formatUnits(sum.debris, locale), count: sum.fields }) : t('galaxy.noDebris'));
  if (sum.deep) part(sum.deep >= BIG_DEBRIS ? 'fut-g-deb' : 'fut-g-muted', t('galaxy.deep', { msu: formatUnits(sum.deep, locale) }));

  const toggle = el(doc, 'button', 'fut-g-tgtbtn');
  toggle.type = 'button';
  toggle.append(icon(doc, 'target', 13), doc.createTextNode(t('galaxy.targets', { count: targets.length })));
  toggle.setAttribute('aria-expanded', String(isOpen()));
  const list = el(doc, 'div', 'fut-g-list');
  list.id = 'fut-galaxy-targets';
  toggle.setAttribute('aria-controls', list.id);
  list.hidden = !isOpen();
  toggle.addEventListener('click', () => {
    setOpen(!isOpen());
    redraw();
  });
  bar.append(toggle, list);
  if (!targets.length) list.append(el(doc, 'div', 'fut-g-empty', t('galaxy.noTargets')));
  for (const x of targets) {
    const [g, sys, pos] = x.coords.split(':');
    const item = el(doc, 'div', 'fut-g-item');
    const link = el(doc, 'a', '', `[${x.coords}]`);
    // A normal page change to the galaxy view of that system, as typing it in the game's own fields.
    link.href = `index.php?page=ingame&component=galaxy&galaxy=${g}&system=${sys}&position=${pos}`;
    const del = el(doc, 'button', 'fut-g-x');
    del.type = 'button';
    del.setAttribute('aria-label', `${t('galaxy.targetRemove')}: [${x.coords}]`);
    del.append(icon(doc, 'close', 12));
    del.addEventListener('click', () => {
      store.set(TARGETS_KEY, store.get<Target[]>(TARGETS_KEY, []).filter((y) => y.coords !== x.coords));
      redraw();
    });
    item.append(link, el(doc, 'span', '', [x.planet, x.player].filter(Boolean).join(' · ')), del);
    list.append(item);
  }
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
