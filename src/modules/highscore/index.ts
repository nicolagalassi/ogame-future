/**
 * Highscore page (players): on the total points, under each score the difference from PTRE's last
 * snapshot (green up, red down) with its age in the column header, as OGLight shows it; a cleaner
 * table in OGLight's manner (compact rows for everyone, small pictures, hairlines, quieter row
 * colours, honour points kept but quiet); the player flag of Future's targets beside the game's
 * "i" button; a button back to the top.
 *
 * COMPLIANCE: reads the page the player opened, Future's stored data and PTRE's ranking
 * (data/ptre: 'user-view', at most every 6 hours, no cookies). The flag only edits Future's own list.
 */
import type { Store } from '../../core/storage';
import { formatUnits } from '../../core/format';
import { readHighscore } from '../../data/highscore';
import { ptreRanks, type PtreRanks } from '../../data/ptre';
import type { NetworkGuard } from '../../core/guard';
import { icon } from '../../core/icons';
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
#ranks { --fut-up: #7BC47F; --fut-down: #E57B70; --fut-mute: #8592A1; --fut-line: #3A4A5C; --fut-btn: #0F1822; --fut-txt: #C9D6E3; --fut-hi: #FFFFFF; --fut-link: #6F9FC8; }
#fut-hs-top { --fut-line: #3A4A5C; --fut-btn: #0F1822; --fut-txt: #C9D6E3; --fut-hi: #FFFFFF; --fut-link: #6F9FC8; }
#ranks .fut-hs-gap { display: block; font-size: 11px; line-height: 1.2; font-variant-numeric: tabular-nums; }
#ranks .fut-hs-gap.up { color: var(--fut-up); } #ranks .fut-hs-gap.down { color: var(--fut-down); }
#ranks .fut-hs-age { margin-left: 4px; color: var(--fut-mute); font-weight: 400; }
/* A cleaner table, as OGLight's: no cell borders, one hairline between rows, the game's row colours
   (own, alliance) kept but quieter, every row compact with a small picture. */
#ranks tbody tr > td { border: 0 !important; border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important; box-shadow: inset 0 0 0 9999px rgba(6, 10, 16, 0.45); padding-top: 2px !important; padding-bottom: 2px !important; line-height: 1.25; vertical-align: middle; }
#ranks tbody tr.myrank > td { box-shadow: inset 0 0 0 9999px rgba(6, 10, 16, 0.15); }
#ranks tbody tr:hover > td { box-shadow: inset 0 0 0 9999px rgba(6, 10, 16, 0.25); }
#ranks .highscoreNameFieldWrapper { height: 34px !important; align-items: center; }
#ranks .highscoreNameFieldWrapper profile-picture { zoom: .6; }
#ranks .highscoreNameAndTitleHolder { width: calc(100% - 30px) !important; justify-content: center; }
#ranks tr:not(.fut-hs-top) .highscoreNameAndTitleHolder { flex-direction: row !important; align-items: center; gap: 6px; }
/* Name and honour points on one line; the top three keep their title under it, smaller. */
#ranks .highscoreNameHolder { display: flex !important; align-items: baseline; gap: 6px; min-width: 0; }
#ranks .honorScore { line-height: 1; font-size: 10px; opacity: 0.75; }
#ranks tr.fut-hs-top .highscoreNameFieldWrapper { height: 40px !important; }
#ranks tr.fut-hs-top .highscoreNameAndTitleHolder > :not(.highscoreNameHolder) { font-size: 11px !important; line-height: 1.2; }
/* The flag of Future's targets, in the column of the game's "i", before it. */
#ranks .fut-hs-act { white-space: nowrap; }
#ranks .fut-hs-act .fut-mk-flag { margin: 0 4px 0 0; vertical-align: middle; }
#fut-hs-top { position: fixed; right: 18px; bottom: 44px; z-index: 1000; display: none; width: 34px; height: 34px; padding: 0; align-items: center; justify-content: center; cursor: pointer; border: 1px solid var(--fut-line); border-radius: 6px; background: var(--fut-btn); color: var(--fut-txt); }
#fut-hs-top.on { display: flex; } #fut-hs-top:hover, #fut-hs-top:focus-visible { border-color: var(--fut-link); color: var(--fut-hi); }
#fut-hs-top svg { transform: rotate(180deg); }`;

export function decorateHighscore(o: HighscoreOptions): void {
  const { doc, store, t, locale } = o;
  const hs = readHighscore(doc);
  if (!hs) return;
  const fmt = (n: number) => formatUnits(n, locale);
  const total = hs.category === 'points';
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
    r.row.querySelectorAll('.fut-hs-gap').forEach((n) => n.remove());
    r.row.classList.toggle('fut-hs-top', r.rank <= 3);
    const scoreCell = r.row.querySelector('td.score');
    // Points since PTRE's snapshot: score on the page now − score at the snapshot.
    const base = snap?.scores[String(r.playerId)];
    // Nothing under the score when the player has not moved: only who moved stands out.
    if (scoreCell && base !== undefined && r.score !== base) {
      const made = r.score - base;
      const g = doc.createElement('span');
      g.className = `fut-hs-gap ${made > 0 ? 'up' : 'down'}`;
      g.textContent = made > 0 ? `+${fmt(made)}` : `−${fmt(-made)}`;
      g.title = t('hs.sincePtre', { n: made.toLocaleString(locale), time: since });
      scoreCell.append(g);
    }
    // The flag sits in the cell of the game's "i" (the one after the name), as OGLight's pin;
    // without that cell, after the name.
    const nameCell = r.row.querySelector('td.name');
    const next = nameCell?.nextElementSibling;
    const actCell = next && !next.classList.contains('score') ? next : null;
    const home = actCell ?? r.row.querySelector('.highscoreNameHolder');
    if (home && !r.mine && !r.row.querySelector('.fut-mk-flag')) {
      const flag = flagButton({ doc, store, t }, r.playerId, r.name);
      if (actCell) {
        actCell.classList.add('fut-hs-act');
        actCell.prepend(flag);
      } else home.append(flag);
    }
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
  addTopButton(o);
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

/** Button back to the top of the page, shown once the table has been scrolled. */
function addTopButton(o: HighscoreOptions): void {
  const { doc, t } = o;
  if (doc.getElementById('fut-hs-top')) return;
  const b = doc.createElement('button');
  b.id = 'fut-hs-top';
  b.type = 'button';
  b.title = t('hs.top');
  b.setAttribute('aria-label', t('hs.top'));
  b.append(icon(doc, 'chevron', 18));
  b.addEventListener('click', () => doc.defaultView?.scrollTo({ top: 0, behavior: 'smooth' }));
  doc.body.append(b);
  const sync = () => b.classList.toggle('on', (doc.defaultView?.scrollY ?? 0) > 400);
  doc.defaultView?.addEventListener('scroll', sync, { passive: true });
  sync();
}
