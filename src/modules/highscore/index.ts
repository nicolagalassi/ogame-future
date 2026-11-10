/**
 * Highscore page (players): on the total points, under each score the difference from PTRE's last
 * snapshot (green up, red down) with its age in the column header, as OGLight shows it; the days
 * needed to catch those ahead at the player's pace; the player flag of Future's targets.
 *
 * COMPLIANCE: reads the page the player opened, Future's stored data and PTRE's ranking
 * (data/ptre: 'user-view', at most every 6 hours, no cookies). The flag only edits Future's own list.
 */
import type { Store } from '../../core/storage';
import { formatUnits } from '../../core/format';
import { daysToCatch, readHighscore } from '../../data/highscore';
import { ptreRanks, type PtreRanks } from '../../data/ptre';
import type { NetworkGuard } from '../../core/guard';
import { SCORE_KEY, type Score } from '../../data/score';
import { changeOver, HISTORY_KEY, type History } from '../../engines/history';
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

/** PTRE's snapshot for this page (per store): missing = not asked yet, null = asked, nothing usable. */
const ptreSeen = new WeakMap<Store, PtreRanks | null>();

export const isHighscorePage = (doc: Document) => new URL(doc.location?.href ?? 'http://x/').searchParams.get('component') === 'highscore';

const CSS = `
#ranks .fut-hs-gap { display: block; font-size: 11px; line-height: 1.35; font-variant-numeric: tabular-nums; }
#ranks .fut-hs-gap.up { color: #7BC47F; } #ranks .fut-hs-gap.down { color: #E57B70; } #ranks .fut-hs-gap.flat { color: #8592A1; }
#ranks .fut-hs-age { margin-left: 4px; color: #8592A1; font-weight: 400; }
#ranks .fut-hs-eta { display: block; font-size: 11px; color: #6F9FC8; }
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
  // The old note above the table (points since midnight) is gone.
  doc.querySelector('.fut-hs-note')?.remove();
  if (total && !ptreSeen.has(store) && o.guard) {
    ptreSeen.set(store, null);
    void ptreRanks({ guard: o.guard, store, host: doc.location.host, now })
      .then((r) => { ptreSeen.set(store, r); })
      .catch(() => {})
      .finally(() => decorateHighscore(o));
  }
  const snap = total ? (ptreSeen.get(store) ?? null) : null;
  const since = snap ? new Date(snap.at).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  // Column header: how old PTRE's snapshot is, as OGLight writes it: "(Δ 15h)".
  const head = doc.querySelector('#ranks thead .score, #ranks tr:first-child > .score');
  head?.querySelector('.fut-hs-age')?.remove();
  if (head && snap) {
    const age = doc.createElement('span');
    age.className = 'fut-hs-age';
    age.textContent = `(Δ ${Math.max(0, Math.floor((now - snap.at) / 3_600_000))}h)`;
    age.title = t('hs.ptreAge', { time: since });
    head.append(age);
  }

  for (const r of hs.rows) {
    r.row.querySelectorAll('.fut-hs-gap, .fut-hs-eta').forEach((n) => n.remove());
    const scoreCell = r.row.querySelector('td.score');
    // Points since PTRE's snapshot: score on the page now − score at the snapshot.
    const base = snap?.scores[String(r.playerId)];
    if (scoreCell && base !== undefined) {
      const made = r.score - base;
      const g = doc.createElement('span');
      g.className = `fut-hs-gap ${made > 0 ? 'up' : made < 0 ? 'down' : 'flat'}`;
      g.textContent = made > 0 ? `+${fmt(made)}` : made < 0 ? `−${fmt(-made)}` : '0';
      g.title = t('hs.sincePtre', { n: made.toLocaleString(locale), time: since });
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
