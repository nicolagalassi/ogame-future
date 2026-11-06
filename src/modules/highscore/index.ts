/**
 * Highscore page (players): under each score the gap to the player, on the total points the days
 * needed to catch those ahead at the current pace, and a star to follow someone as a rival.
 *
 * COMPLIANCE: reads the page the player opened and Future's stored data (score, history, rivals);
 * no network call (§4). The star only edits Future's own list.
 */
import { icon } from '../../core/icons';
import type { Store } from '../../core/storage';
import { formatUnits } from '../../core/format';
import { daysToCatch, readHighscore } from '../../data/highscore';
import { SCORE_KEY, type Score } from '../../data/score';
import { changeOver, HISTORY_KEY, type History } from '../../engines/history';
import { pointsPerDay, RIVAL_POINTS_KEY, RIVALS_KEY, toggleRival, type Rival, type RivalPoints } from '../../engines/rivals';

type T = (key: string, vars?: Record<string, string | number>) => string;

export interface HighscoreOptions {
  doc: Document;
  store: Store;
  locale: string;
  t: T;
}

export const isHighscorePage = (doc: Document) => new URL(doc.location?.href ?? 'http://x/').searchParams.get('component') === 'highscore';

const CSS = `
#ranks .fut-hs-gap { display: block; font-size: 10px; line-height: 1.3; }
#ranks .fut-hs-gap.ahead { color: #E3BB28; } #ranks .fut-hs-gap.behind { color: #7BC47F; }
#ranks .fut-hs-eta { display: block; font-size: 10px; color: #6F9FC8; }
#ranks .fut-hs-star { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; margin-left: 4px; padding: 0;
  border: 1px solid #2E4356; border-radius: 3px; background: #111A21; color: #848484; cursor: pointer; vertical-align: middle; }
#ranks .fut-hs-star:hover, #ranks .fut-hs-star:focus-visible { border-color: #617C8D; color: #F1F1F1; }
#ranks .fut-hs-star.on { border-color: #E3BB28; color: #E3BB28; }
#ranks tr.fut-hs-rival td { box-shadow: inset 0 1px 0 #3A3220, inset 0 -1px 0 #3A3220; }
#ranks tr.fut-hs-rival .playername { color: #E3BB28; }`;

export function decorateHighscore(o: HighscoreOptions): void {
  const { doc, store, t, locale } = o;
  const hs = readHighscore(doc);
  if (!hs) return;
  const fmt = (n: number) => formatUnits(n, locale);
  const rivals = store.get<Rival[]>(RIVALS_KEY, []);
  const rivalIds = new Set(rivals.map((r) => r.id));
  const book = store.get<RivalPoints>(RIVAL_POINTS_KEY, {});
  const total = hs.category === 'points';
  // My score in this category: my own row when on the page, else (total points only) the stored one.
  const mine = hs.rows.find((r) => r.mine)?.score ?? (total ? store.get<Score | null>(SCORE_KEY, null)?.points : undefined);
  const myPace = total ? changeOver(store.get<History>(HISTORY_KEY, []), 7)?.perDay ?? 0 : 0;

  for (const r of hs.rows) {
    r.row.querySelectorAll('.fut-hs-gap, .fut-hs-eta, .fut-hs-star').forEach((n) => n.remove());
    r.row.classList.toggle('fut-hs-rival', rivalIds.has(r.playerId));
    const scoreCell = r.row.querySelector('td.score');
    if (scoreCell && mine !== undefined && !r.mine) {
      const gap = r.score - mine;
      const g = doc.createElement('span');
      g.className = `fut-hs-gap ${gap > 0 ? 'ahead' : 'behind'}`;
      g.textContent = gap > 0 ? `+${fmt(gap)}` : `−${fmt(-gap)}`;
      g.title = t(gap > 0 ? 'hs.ahead' : 'hs.behind', { n: Math.abs(gap).toLocaleString(locale) });
      scoreCell.append(g);
      if (total && gap > 0 && myPace > 0) {
        const theirs = rivalIds.has(r.playerId) ? pointsPerDay(book, r.playerId, 7) ?? 0 : 0;
        const days = daysToCatch(gap, myPace, theirs);
        const e = doc.createElement('span');
        e.className = 'fut-hs-eta';
        e.textContent = days === null ? t('hs.never') : days < 1 ? t('hs.today') : t('hs.days', { n: Math.ceil(days).toLocaleString(locale) });
        e.title = t(theirs ? 'hs.etaBoth' : 'hs.etaMine', { mine: fmt(myPace), theirs: fmt(theirs) });
        scoreCell.append(e);
      }
    }
    const nameHolder = r.row.querySelector('.highscoreNameHolder');
    if (nameHolder && !r.mine) {
      const on = rivalIds.has(r.playerId);
      const star = doc.createElement('button');
      star.type = 'button';
      star.className = `fut-hs-star${on ? ' on' : ''}`;
      star.setAttribute('aria-pressed', String(on));
      star.title = t(on ? 'galaxy.rivalRemove' : 'galaxy.rivalAdd');
      star.setAttribute('aria-label', `${star.title}: ${r.name}`);
      star.append(icon(doc, 'star', 11));
      star.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        store.set(RIVALS_KEY, toggleRival(store.get<Rival[]>(RIVALS_KEY, []), { id: r.playerId, name: r.name, at: Date.now() }));
        decorateHighscore(o);
      });
      nameHolder.append(star);
    }
  }
}

/** The game swaps the table on category and page changes without reloading: redraw each time. */
export function watchHighscore(o: HighscoreOptions): void {
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
    if (queued || list.every((m) => [...m.addedNodes].every((n) => n instanceof Element && n.className?.toString().startsWith('fut-hs')))) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      decorateHighscore(o);
    }, 50);
  }).observe(box, { childList: true, subtree: true });
}
