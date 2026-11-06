/**
 * Targets window, after OGLight's pinned players and tagged planets: the players the user flagged
 * (one tab per flag, plus the ones opened lately), a player's sheet with points and every planet and
 * moon, and the tagged planets inside a coordinate range.
 *
 * COMPLIANCE: Future's own data plus the universe's public API (player sheet: playerData; statuses:
 * players.xml), read only when the player opens them (reason 'user-view', cached, no cookies).
 * Coordinates link to the galaxy view, where the game's own probe button is (§1.5.1): no probe here.
 * Other links are the game's own pages (one click = one navigation).
 */
import { icon } from '../../core/icons';
import { WINDOW_SHEET } from '../../core/sheet';
import type { NetworkGuard } from '../../core/guard';
import type { Store } from '../../core/storage';
import { formatUnits } from '../../core/format';
import { playerScores, SCORE_TYPES, type PlayerScores, type ScoreType } from '../../data/player-api';
import { statusNames, universePlayers, type UniversePlayers } from '../../data/universe-players';
import { FLAGS, flagPlayer, loadMarks, MARKS_KEY, planetsInRange, rememberRecent, TAGS, type Flag, type Marks, type Tag } from '../../engines/marks';
import { FLAG_COLORS, FLAG_ICONS, flagButton, MARKS_CSS, TAG_COLORS, tagButton } from './picker';

type T = (key: string, vars?: Record<string, string | number>) => string;

export const TARGETS_ID = 'fut-targets';
const VIEW_KEY = 'marks.view';

interface View {
  tab: 'players' | 'planets';
  flagTab: Flag | 'recent';
  from: string;
  to: string;
  tags: Tag[];
  hide: string[];
}

export interface TargetsOptions {
  doc: Document;
  store: Store;
  guard: NetworkGuard;
  t: T;
  locale: string;
  /** The player's planet on screen, "g:s:p", for the default range. */
  here: string;
}

let keyHandler: ((e: KeyboardEvent) => void) | null = null;
/** Player whose sheet is open, if any. */
let sheetId: number | null = null;

const CSS = `
:host { --panel-w: 760px; }
.sub-tabs { display: flex; flex-wrap: wrap; gap: 4px; margin: 10px 0; }
.chip { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 9px; border-radius: 7px; border: 1px solid var(--line); background: var(--bg); color: var(--text-2); font: 12px Arial, sans-serif; cursor: pointer; }
.chip:hover, .chip:focus-visible { border-color: var(--accent); color: var(--text); outline: none; }
.chip[aria-pressed="true"] { border-color: currentColor; background: var(--accent-soft); color: var(--text); }
.chip .n { color: var(--muted); font-family: var(--mono); font-size: 11px; }
.rows { display: flex; flex-direction: column; gap: 1px; background: var(--line-soft); border: 1px solid var(--line-soft); border-radius: 8px; overflow: hidden; }
.row { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--surface); }
.row .idx { width: 22px; color: var(--faint); font: 11px var(--mono); text-align: right; }
.row .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row button.name { all: unset; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; color: var(--text); font-weight: 700; }
.row button.name:hover, .row button.name:focus-visible { color: var(--accent); text-decoration: underline; }
.row .who { color: var(--muted); font-size: 12px; }
.coords { color: var(--accent); font: 12px var(--mono); text-decoration: none; }
.coords:hover, .coords:focus-visible { color: var(--text); text-decoration: underline; }
.moon-ico { color: var(--muted); vertical-align: -1px; margin-right: 3px; }
.group { margin-top: 6px; }
.st-inactive { color: #9BE36D !important; } .st-longinactive { color: #8A9BB0 !important; } .st-vacation { color: #7FDBFF !important; } .st-banned { color: #FF7A7A !important; text-decoration: line-through; }
.range { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 10px 0; color: var(--muted); font-size: 12px; }
.range input { width: 70px; height: 26px; padding: 0 6px; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--text); font: 12px var(--mono); }
.range input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.dot { width: 10px; height: 10px; border-radius: 50%; }
.sheet-head { display: flex; align-items: center; gap: 8px; margin: 6px 0 10px; }
.sheet-head h3 { margin: 0; font-size: 16px; color: var(--text); }
.links { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.links a { display: inline-flex; align-items: center; height: 26px; padding: 0 9px; border-radius: 7px; border: 1px solid var(--line); color: var(--text-2); text-decoration: none; font-size: 12px; }
.links a:hover, .links a:focus-visible { border-color: var(--accent); color: var(--text); }
.scores { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; margin-bottom: 12px; background: var(--line-soft); border-radius: 8px; overflow: hidden; }
.scores div { padding: 6px 10px; background: var(--surface); }
.scores span { display: block; color: var(--muted); font-size: 11px; }
.scores b { color: var(--text); font-family: var(--mono); }
.scores i { color: var(--muted); font: normal 11px var(--mono); margin-left: 4px; }
.back { all: unset; display: inline-flex; align-items: center; gap: 4px; color: var(--muted); cursor: pointer; font-size: 12px; }
.back:hover, .back:focus-visible { color: var(--text); }
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

export function closeTargets(doc: Document): void {
  doc.getElementById(TARGETS_ID)?.remove();
  if (keyHandler) doc.removeEventListener('keydown', keyHandler, true);
  keyHandler = null;
  sheetId = null;
}

export function openTargets(o: TargetsOptions): void {
  const { doc, store, t, locale } = o;
  const keepScroll = doc.getElementById(TARGETS_ID)?.shadowRoot?.querySelector('.backdrop')?.scrollTop ?? 0;
  doc.getElementById(TARGETS_ID)?.remove();
  const [hg] = o.here.split(':');
  const view: View = { tab: 'players', flagTab: 'watch', from: `${hg ?? 1}:1`, to: `${hg ?? 1}:499`, tags: [...TAGS], hide: ['vacation', 'banned'], ...store.get<Partial<View>>(VIEW_KEY, {}) };
  const save = (next: Partial<View>) => {
    store.set(VIEW_KEY, { ...view, ...next });
    openTargets(o);
  };
  const marks = loadMarks(store.get<Partial<Marks> | null>(MARKS_KEY, null));
  const redraw = () => openTargets(o);
  const picker = { doc, store, t, onChange: redraw };

  const host = doc.createElement('div');
  host.id = TARGETS_ID;
  host.lang = locale;
  const root = host.attachShadow({ mode: 'open' });
  const style = h(doc, 'style');
  style.textContent = WINDOW_SHEET + CSS;
  const backdrop = h(doc, 'div', 'backdrop');
  const panel = h(doc, 'section', 'panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', t('marks.title'));
  backdrop.append(panel);
  root.append(style, backdrop);
  if (!keyHandler) {
    keyHandler = (e) => { if (e.key === 'Escape' && !doc.getElementById('fut-mk-pop')) closeTargets(doc); };
    doc.addEventListener('keydown', keyHandler, true);
  }
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeTargets(doc); });

  const head = h(doc, 'header', 'head');
  const titles = h(doc, 'div', 'titles');
  titles.append(h(doc, 'h2', '', t('marks.title')), h(doc, 'span', 'sub', t('marks.sub', { players: Object.keys(marks.players).length, planets: Object.keys(marks.planets).length })));
  const x = h(doc, 'button', 'close');
  x.type = 'button';
  x.setAttribute('aria-label', t('dash.close'));
  x.append(icon(doc, 'close', 16));
  x.addEventListener('click', () => closeTargets(doc));
  head.append(titles, x);
  panel.append(head);

  const tabs = h(doc, 'nav', 'tabs');
  for (const id of ['players', 'planets'] as const) {
    const b = h(doc, 'button', 'tab', t(`marks.tab.${id}`));
    b.type = 'button';
    b.setAttribute('aria-pressed', String(view.tab === id));
    b.addEventListener('click', () => { sheetId = null; save({ tab: id }); });
    tabs.append(b);
  }
  panel.append(tabs);

  const body = h(doc, 'div', 'tab-body');
  if (view.tab === 'players' && sheetId !== null) playerSheet(o, body, sheetId, marks, picker);
  else if (view.tab === 'players') playersTab(o, body, view, marks, picker, save);
  else planetsTab(o, body, view, marks, picker, save);
  panel.append(body);

  doc.body.append(host);
  backdrop.scrollTop = keepScroll;
}

type Picker = { doc: Document; store: Store; t: T; onChange: () => void };

function playersTab(o: TargetsOptions, body: HTMLElement, view: View, marks: Marks, picker: Picker, save: (v: Partial<View>) => void): void {
  const { doc, t } = o;
  const sub = h(doc, 'div', 'sub-tabs');
  const counts = Object.values(marks.players).reduce<Record<string, number>>((c, p) => ((c[p.flag] = (c[p.flag] ?? 0) + 1), c), {});
  for (const f of [...FLAGS, 'recent'] as const) {
    const b = h(doc, 'button', 'chip');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(view.flagTab === f));
    if (f !== 'recent') b.style.color = FLAG_COLORS[f];
    b.append(icon(doc, f === 'recent' ? 'eye' : FLAG_ICONS[f], 12), h(doc, 'span', '', t(f === 'recent' ? 'marks.recent' : `mark.flag.${f}`)), h(doc, 'span', 'n', String(f === 'recent' ? marks.recent.length : counts[f] ?? 0)));
    b.addEventListener('click', () => save({ flagTab: f }));
    sub.append(b);
  }
  body.append(sub);
  const list = view.flagTab === 'recent'
    ? marks.recent
    : Object.entries(marks.players).filter(([, p]) => p.flag === view.flagTab).map(([id, p]) => ({ id: Number(id), name: p.name })).sort((a, b) => a.name.localeCompare(b.name));
  if (!list.length) {
    body.append(h(doc, 'p', 'empty', t(view.flagTab === 'recent' ? 'marks.noRecent' : 'marks.noPlayers')));
    return;
  }
  const rows = h(doc, 'div', 'rows');
  list.forEach((p, i) => {
    const row = h(doc, 'div', 'row');
    const name = h(doc, 'button', 'name', p.name || `#${p.id}`);
    name.type = 'button';
    name.title = t('marks.openSheet');
    name.addEventListener('click', () => { sheetId = p.id; openTargets(o); });
    row.append(h(doc, 'span', 'idx', String(i + 1)), name, flagButton(picker, p.id, p.name));
    rows.append(row);
  });
  body.append(rows);
  body.append(h(doc, 'p', 'hint', t('marks.playersHint')));
}

function playerSheet(o: TargetsOptions, body: HTMLElement, id: number, marks: Marks, picker: Picker): void {
  const { doc, store, t, locale } = o;
  const back = h(doc, 'button', 'back', `← ${t('marks.back')}`);
  back.type = 'button';
  back.addEventListener('click', () => { sheetId = null; openTargets(o); });
  body.append(back);
  const known = marks.players[String(id)]?.name || marks.recent.find((r) => r.id === id)?.name || '';
  const head = h(doc, 'div', 'sheet-head');
  const title = h(doc, 'h3', '', known || `#${id}`);
  head.append(title, flagButton(picker, id, known));
  body.append(head);
  const links = h(doc, 'div', 'links');
  const link = (text: string, href: string) => {
    const a = h(doc, 'a', '', text);
    a.href = href;
    links.append(a);
  };
  link(t('marks.write'), `/game/index.php?page=ingame&component=chat&playerId=${id}`);
  link(t('marks.profile'), `/game/index.php?page=ingame&component=playerprofile&profileId=${id}`);
  body.append(links);
  const holder = h(doc, 'div', '');
  holder.append(h(doc, 'p', 'empty', t('galaxy.loading')));
  body.append(holder);

  void playerScores(o.guard, store, doc.location.origin, id, Date.now())
    .catch(() => null)
    .then((data: PlayerScores | null) => {
      if (sheetId !== id || !holder.isConnected) return;
      holder.replaceChildren();
      if (!data) {
        holder.append(h(doc, 'p', 'empty', t('galaxy.apiError')));
        return;
      }
      title.textContent = data.name || known;
      // Remember the name, and the player among the ones opened lately.
      let m = rememberRecent(loadMarks(store.get<Partial<Marks> | null>(MARKS_KEY, null)), id, data.name || known);
      if (m.players[String(id)] && !m.players[String(id)]!.name) m = flagPlayer(m, id, data.name, m.players[String(id)]!.flag, Date.now());
      store.set(MARKS_KEY, m);
      const rank = data.scores.total?.rank;
      if (rank) link(`${t('marks.rank')} #${rank.toLocaleString(locale)}`, `/game/index.php?page=ingame&component=highscore&site=${Math.max(1, Math.ceil(rank / 100))}&category=1&searchRelId=${id}`);
      const scores = h(doc, 'div', 'scores');
      for (const key of Object.keys(SCORE_TYPES) as ScoreType[]) {
        const v = data.scores[key];
        if (!v) continue;
        const cell = h(doc, 'div', '');
        const b = h(doc, 'b', '', formatUnits(v.points, locale));
        b.append(h(doc, 'i', '', `#${v.rank.toLocaleString(locale)}`));
        cell.append(h(doc, 'span', '', t(`galaxy.score.${key}`)), b);
        scores.append(cell);
      }
      if (data.ships) {
        const cell = h(doc, 'div', '');
        cell.append(h(doc, 'span', '', t('marks.ships')), h(doc, 'b', '', data.ships.toLocaleString(locale)));
        scores.append(cell);
      }
      holder.append(scores);
      const planets = [...(data.planets ?? [])].sort((a, b) => {
        const v = (c: string) => c.split(':').reduce((s, n) => s * 1000 + Number(n), 0);
        return v(a.coords) - v(b.coords);
      });
      holder.append(h(doc, 'h4', '', t('marks.planets', { n: planets.length, moons: planets.filter((p) => p.moon).length })));
      // Grouped by system, as OGLight does: planets close to each other read as one block.
      let lastSystem = '';
      let rows = h(doc, 'div', 'rows');
      planets.forEach((p, i) => {
        const system = p.coords.split(':').slice(0, 2).join(':');
        if (system !== lastSystem && i > 0) {
          holder.append(rows);
          rows = h(doc, 'div', 'rows group');
        }
        lastSystem = system;
        const row = h(doc, 'div', 'row');
        const a = h(doc, 'a', 'coords', `[${p.coords}]`);
        a.href = galaxyHref(p.coords);
        const name = h(doc, 'span', 'name', p.name);
        if (p.moon) {
          const moon = h(doc, 'span', 'who');
          moon.append(icon(doc, 'moon', 10, 'moon-ico'), doc.createTextNode(p.moon.name));
          name.append(doc.createTextNode(' '), moon);
        }
        row.append(h(doc, 'span', 'idx', String(i + 1)), a, name, tagButton(picker, p.coords, { planet: p.name, player: data.name, playerId: id, statuses: [], moon: !!p.moon }));
        rows.append(row);
      });
      holder.append(rows);
      holder.append(h(doc, 'p', 'hint', t('galaxy.apiAge', { time: new Date(data.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })));
    });
}

function planetsTab(o: TargetsOptions, body: HTMLElement, view: View, marks: Marks, picker: Picker, save: (v: Partial<View>) => void): void {
  const { doc, t } = o;
  const range = h(doc, 'div', 'range');
  const input = (value: string, label: string) => {
    const i = h(doc, 'input');
    i.value = value;
    i.inputMode = 'numeric';
    i.setAttribute('aria-label', label);
    return i;
  };
  const from = input(view.from, t('marks.from'));
  const to = input(view.to, t('marks.to'));
  const apply = () => {
    const ok = (v: string) => /^\d{1,2}:\d{1,3}$/.test(v.trim());
    if (ok(from.value) && ok(to.value)) save({ from: from.value.trim(), to: to.value.trim() });
  };
  for (const i of [from, to]) i.addEventListener('change', apply);
  range.append(h(doc, 'span', '', t('marks.from')), from, h(doc, 'span', '', t('marks.to')), to);
  body.append(range);

  const chips = h(doc, 'div', 'sub-tabs');
  for (const tag of TAGS) {
    const b = h(doc, 'button', 'chip');
    b.type = 'button';
    const on = view.tags.includes(tag);
    b.setAttribute('aria-pressed', String(on));
    const dot = h(doc, 'span', 'dot');
    dot.style.background = TAG_COLORS[tag];
    b.append(dot, h(doc, 'span', '', t(`mark.tag.${tag}`)));
    b.addEventListener('click', () => save({ tags: on ? view.tags.filter((x) => x !== tag) : [...view.tags, tag] }));
    chips.append(b);
  }
  for (const st of ['vacation', 'banned', 'inactive'] as const) {
    const b = h(doc, 'button', 'chip');
    b.type = 'button';
    const on = view.hide.includes(st);
    b.setAttribute('aria-pressed', String(on));
    b.textContent = t(`marks.hide.${st}`);
    b.addEventListener('click', () => save({ hide: on ? view.hide.filter((x) => x !== st) : [...view.hide, st] }));
    chips.append(b);
  }
  body.append(chips);

  const holder = h(doc, 'div', '');
  body.append(holder);
  // Today's statuses from the public API, else the ones the galaxy view showed when tagged.
  const draw = (uni: UniversePlayers | null) => {
    holder.replaceChildren();
    const statusOf = (playerId: number | null, saved: string[]) => {
      const row = playerId ? uni?.players[String(playerId)] : undefined;
      return row ? statusNames(row[1]) : saved;
    };
    const withStatus: Marks = { ...marks, planets: Object.fromEntries(Object.entries(marks.planets).map(([c, p]) => [c, { ...p, statuses: statusOf(p.playerId, p.statuses) }])) };
    const hide = view.hide.flatMap((s) => (s === 'inactive' ? ['inactive', 'longinactive'] : [s]));
    const list = planetsInRange(withStatus, view.from, view.to, { tags: view.tags, hide });
    if (!list.length) {
      holder.append(h(doc, 'p', 'empty', t(Object.keys(marks.planets).length ? 'marks.noneInRange' : 'marks.noPlanets')));
      return;
    }
    const rows = h(doc, 'div', 'rows');
    list.forEach(([coords, p], i) => {
      const row = h(doc, 'div', 'row');
      const a = h(doc, 'a', 'coords', `[${coords}]`);
      a.href = galaxyHref(coords);
      const name = h(doc, 'span', 'name', p.planet || '?');
      const who = h(doc, 'span', `who${p.statuses[0] ? ` st-${p.statuses[0]}` : ''}`, p.player ? ` · ${p.player}` : '');
      name.append(who);
      if (p.moon) name.prepend(icon(doc, 'moon', 10, 'moon-ico'));
      row.append(h(doc, 'span', 'idx', String(i + 1)), a, name);
      if (p.playerId) row.append(flagButton(picker, p.playerId, p.player));
      row.append(tagButton(picker, coords, p));
      rows.append(row);
    });
    holder.append(rows, h(doc, 'p', 'hint', t('marks.planetsHint', { n: list.length })));
  };
  draw(null);
  void universePlayers({ guard: o.guard, store: o.store, origin: doc.location.origin }).catch(() => null).then((uni) => { if (uni && holder.isConnected) draw(uni); });
}
