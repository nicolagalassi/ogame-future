/**
 * Highscore page (players): under each score the points made since midnight (green up, red
 * down), on the total points the days needed to catch those ahead at the player's pace, and the
 * player flag of Future's targets (modules/marks).
 *
 * COMPLIANCE: reads the page the player opened, Future's stored data and the public highscore
 * (data/highscore-api: 'user-view', at most once an hour per category, no cookies). The flag only
 * edits Future's own list.
 */
import type { Store } from '../../core/storage';
import { formatUnits } from '../../core/format';
import { daysToCatch, readHighscore } from '../../data/highscore';
import { API_TYPES, dailyBase, type DailyBase } from '../../data/highscore-api';
import type { NetworkGuard } from '../../core/guard';
import { SCORE_KEY, type Score } from '../../data/score';
import { changeOver, dayKey, HISTORY_KEY, type History } from '../../engines/history';
import { ensureMarksStyle, flagButton } from '../marks/picker';

type T = (key: string, vars?: Record<string, string | number>) => string;

export interface HighscoreOptions {
  doc: Document;
  store: Store;
  locale: string;
  t: T;
  guard?: NetworkGuard;
  now?: () => number;
}

/** The day's base for the category on screen, once loaded (null = none yet / not available). */
let daily: { type: number; base: DailyBase | null } | null = null;

export const isHighscorePage = (doc: Document) => new URL(doc.location?.href ?? 'http://x/').searchParams.get('component') === 'highscore';

const CSS = `
#ranks .fut-hs-gap { display: block; font-size: 10px; line-height: 1.3; }
#ranks .fut-hs-gap.up { color: #7BC47F; } #ranks .fut-hs-gap.down { color: #D86A6A; } #ranks .fut-hs-gap.flat { color: #6A7682; }
.fut-hs-note { margin: 4px 0 6px; color: #848484; font: 11px Verdana, Arial, sans-serif; }
#ranks .fut-hs-eta { display: block; font-size: 10px; color: #6F9FC8; }
#ranks .highscoreNameHolder .fut-mk-flag { margin-left: 4px; }`;

export function decorateHighscore(o: HighscoreOptions): void {
  const { doc, store, t, locale } = o;
  const hs = readHighscore(doc);
  if (!hs) return;
  const fmt = (n: number) => formatUnits(n, locale);
  const total = hs.category === 'points';
  // My score in this category: my own row when on the page, else (total points only) the stored one.
  const mine = hs.rows.find((r) => r.mine)?.score ?? (total ? store.get<Score | null>(SCORE_KEY, null)?.points : undefined);
  const myPace = total ? changeOver(store.get<History>(HISTORY_KEY, []), 7)?.perDay ?? 0 : 0;
  const now = o.now?.() ?? Date.now();
  const type = API_TYPES[hs.category];
  const loaded = daily && daily.type === type ? daily.base : null;
  // Only a base taken today counts (the file may still be yesterday's just after midnight).
  const today = loaded && loaded.day === dayKey(now) ? loaded : null;
  const since = today ? new Date(today.base.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '';
  const table = doc.getElementById('ranks');
  let note = doc.querySelector<HTMLElement>('.fut-hs-note');
  if (type !== undefined && table) {
    if (!note) {
      note = doc.createElement('p');
      note.className = 'fut-hs-note';
    }
    note.textContent = today ? t('hs.note', { time: since }) : t('hs.noteWaiting');
    if (note.nextElementSibling !== table) table.before(note);
  } else note?.remove();
  if (type !== undefined && o.guard && (!daily || daily.type !== type)) {
    daily = { type, base: null };
    void dailyBase({ guard: o.guard, store, origin: doc.location.origin, type, now })
      .then((b) => { if (daily?.type === type) daily = { type, base: b }; })
      .catch(() => {})
      .finally(() => decorateHighscore(o));
  }

  for (const r of hs.rows) {
    r.row.querySelectorAll('.fut-hs-gap, .fut-hs-eta').forEach((n) => n.remove());
    const scoreCell = r.row.querySelector('td.score');
    // Points made since midnight: score on the page now − score at the day's base.
    const base = today?.base.scores[String(r.playerId)];
    if (scoreCell && base !== undefined) {
      const made = r.score - base;
      const g = doc.createElement('span');
      g.className = `fut-hs-gap ${made > 0 ? 'up' : made < 0 ? 'down' : 'flat'}`;
      g.textContent = made > 0 ? `+${fmt(made)}` : made < 0 ? `−${fmt(-made)}` : '0';
      g.title = t('hs.today', { n: made.toLocaleString(locale), time: since });
      scoreCell.append(g);
    }
    if (scoreCell && mine !== undefined && !r.mine && total && myPace > 0 && r.score > mine) {
      const days = daysToCatch(r.score - mine, myPace);
      const e = doc.createElement('span');
      e.className = 'fut-hs-eta';
      e.textContent = days === null ? t('hs.never') : days < 1 ? t('hs.passToday') : t('hs.days', { n: Math.ceil(days).toLocaleString(locale) });
      e.title = t('hs.etaMine', { mine: fmt(myPace) });
      scoreCell.append(e);
    }
    const nameHolder = r.row.querySelector('.highscoreNameHolder');
    if (nameHolder && !r.mine && !nameHolder.querySelector('.fut-mk-flag')) nameHolder.append(flagButton({ doc, store, t }, r.playerId, r.name));
  }
}

/** The game swaps the table on category and page changes without reloading: redraw each time. */
export function watchHighscore(o: HighscoreOptions): void {
  ensureMarksStyle(o.doc);
  if (!o.doc.getElementById('fut-hs-style')) {
    const style = o.doc.createElement('style');
    style.id = 'fut-hs-style';
    style.textContent = CSS;
    o.doc.head.append(style);
  }
  decorateHighscore(o);
  const box = o.doc.getElementById('stat_list_content') ?? o.doc.body;
  let queued = false;
  new MutationObserver((list) => {
    // Our own nodes do not count: only a table the game drew anew.
    if (queued || list.every((m) => [...m.addedNodes].every((n) => n instanceof Element && (/^fut-(hs|mk)/.test(n.getAttribute('class') ?? '') || !!n.closest('.fut-mk'))))) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      decorateHighscore(o);
    }, 50);
  }).observe(box, { childList: true, subtree: true });
}
