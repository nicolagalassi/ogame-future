import { RES_COLORS, WINDOW_TOKENS } from '../../core/sheet';
/**
 * Future's dock: a small panel in the free space under the game's left menu, as OGLight does with
 * its own. Two cards that say something before they are opened: the expedition journal (today and
 * yesterday, by resource) and the targets (how many players per flag).
 *
 * COMPLIANCE: page only. It is appended after the game's menu, which is neither moved, resized
 * nor covered (AGENTS.md §1.7: Merchant, Recruit Officers and Shop stay where they are). No
 * request is made here; a click opens Future's own journal window or targets side bar.
 */
import { icon, type IconName } from '../../core/icons';
import { formatUnits } from '../../core/format';
import { FLAGS, type Flag, type Marks } from '../../engines/marks';
import { FLAG_COLORS, markIcon } from '../marks/picker';

export const DOCK_ID = 'fut-dock';

export interface DayGain {
  count: number;
  net: number;
  res: { metal: number; crystal: number; deuterium: number };
}
const STYLE_ID = 'fut-dock-style';

export interface DockOptions {
  doc: Document;
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: string;
  /** Expeditions read today and yesterday: how many, the net value in MSU and, for today, per resource. */
  journal: { today: DayGain; yesterday: DayGain };
  marks: Marks;
  onOpenJournal: () => void;
  /** Opens or closes the targets side bar; with a view, opens it there. */
  onOpenTargets: (view?: { flagTab?: Flag }) => void;
}

const CSS = `
/* Window tokens (core/sheet.ts) for every surface this sheet styles. */
#${DOCK_ID} { ${WINDOW_TOKENS} }
#${DOCK_ID} {
  box-sizing: border-box; clear: both; display: flex; flex-direction: column; gap: 6px; width: 150px; margin: 10px 0 0 13px;
  font: 12px/1.3 var(--body); color: var(--text-2); font-variant-numeric: tabular-nums; text-align: left;
}
#${DOCK_ID} * { box-sizing: border-box; }
#${DOCK_ID} button { margin: 0; font: inherit; color: inherit; cursor: pointer; text-align: left; }
#${DOCK_ID} button:focus-visible { outline: 1px solid var(--accent); outline-offset: -2px; }
#${DOCK_ID} .card { border: 0; border-radius: 6px; background: var(--raised); overflow: hidden; }
/* Head: on the board's band, like a window's; what the card is and, on the right, its one number. */
#${DOCK_ID} .head { display: flex; align-items: center; gap: 6px; width: 100%; height: 28px; padding: 0 8px; border: 0; background: var(--band); }
#${DOCK_ID} .head b { flex: 1; min-width: 0; color: var(--text); font: 600 condensed 14px var(--display); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#${DOCK_ID} .head svg { flex: none; color: var(--on-band); }
#${DOCK_ID} .head .n { color: var(--on-band); font: condensed 13px var(--display); }
/* Hover only where there is a pointer (a tap would leave it stuck on a phone); pressing shows on touch too. */
@media (hover: hover) and (pointer: fine) {
  #${DOCK_ID} .head:hover { background: var(--band-2); }
  #${DOCK_ID} .jday:hover { background: var(--hover); }
  #${DOCK_ID} .flag:hover { background: var(--hover); box-shadow: inset 0 0 0 1px currentColor; }
}
#${DOCK_ID} .head:active { background: var(--band-2); }
#${DOCK_ID} .jday:active, #${DOCK_ID} .flag:active { background: var(--hover); }
#${DOCK_ID} .flag { transition: transform 120ms cubic-bezier(0.23, 1, 0.32, 1); }
#${DOCK_ID} .flag:active { transform: scale(0.97); }
@media (prefers-reduced-motion: reduce) { #${DOCK_ID} .flag:active { transform: none; } }
/* Journal: today's net gain on one line, split by resource under it, then yesterday to compare. */
#${DOCK_ID} .jday { display: flex; flex-direction: column; gap: 3px; width: 100%; padding: 6px 8px; border: 0; background: none; }
#${DOCK_ID} .jday + .jday { padding-top: 0; }
#${DOCK_ID} .jday .row { display: flex; align-items: baseline; gap: 6px; }
#${DOCK_ID} .jday .k { flex: 1; min-width: 0; color: var(--label); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#${DOCK_ID} .jday .v { font: 600 condensed 14px var(--display); color: var(--text-2); }
#${DOCK_ID} .jday.today .v { font-size: 18px; line-height: 20px; color: var(--text); }
#${DOCK_ID} .jday .v.neg { color: var(--bad); } #${DOCK_ID} .jday .v.none { color: var(--quiet); font-weight: 400; }
#${DOCK_ID} .res { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3px; font: condensed 12px var(--display); color: var(--text-2); }
#${DOCK_ID} .res span { white-space: nowrap; overflow: hidden; }
#${DOCK_ID} .res b { margin-right: 2px; font-weight: 600; }
/* Targets: one chip per flag in use. */
#${DOCK_ID} .flags { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; padding: 6px; }
#${DOCK_ID} .flag { display: flex; align-items: center; justify-content: center; gap: 4px; height: 26px; padding: 0; border: 0; border-radius: 4px; background: var(--surface); }
#${DOCK_ID} .flag i { font: normal condensed 13px var(--display); color: var(--text); }
#${DOCK_ID} .hint { margin: 0; padding: 8px; color: var(--label); font-size: 12px; line-height: 1.4; }
`;

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

export function renderDock(o: DockOptions): void {
  const { doc, t } = o;
  doc.getElementById(DOCK_ID)?.remove();
  // Under the game's menu; on a layout without it, under the planet list.
  const menu = doc.getElementById('links');
  const home = menu ?? doc.getElementById('myPlanets');
  if (!home) return;
  if (!doc.getElementById(STYLE_ID)) {
    const style = el(doc, 'style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    doc.head.append(style);
  }
  const dock = el(doc, 'div');
  dock.id = DOCK_ID;
  const fmt = (n: number) => formatUnits(n, o.locale);
  const button = (cls: string, title: string, onClick: () => void) => {
    const b = el(doc, 'button', cls);
    b.type = 'button';
    b.title = title;
    b.addEventListener('click', (e) => {
      e.preventDefault();
      onClick();
    });
    return b;
  };
  const head = (glyph: IconName, name: string, title: string, onClick: () => void, count = '') => {
    const b = button('head', title, onClick);
    b.append(icon(doc, glyph, 14), el(doc, 'b', '', name));
    if (count) b.append(el(doc, 'span', 'n', count));
    return b;
  };

  // Journal: expeditions read from the inbox; today's net gain (in MSU and per resource), yesterday's to compare.
  const { today, yesterday } = o.journal;
  const journal = el(doc, 'section', 'card');
  journal.append(head('chart', t('dock.journal'), t('exp.title'), o.onOpenJournal, today.count ? String(today.count) : ''));
  const signed = (n: number) => `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n))}`;
  const day = (cls: string, label: string, d: DayGain) => {
    const b = button(`jday ${cls}`, t('dock.journalHint', { n: d.count }), o.onOpenJournal);
    const row = el(doc, 'span', 'row');
    row.append(el(doc, 'span', 'k', label), el(doc, 'span', `v${d.count ? (d.net < 0 ? ' neg' : '') : ' none'}`, d.count ? signed(d.net) : '—'));
    b.append(row);
    return b;
  };
  const todayBlock = day('today', t('dock.today'), today);
  if (today.count) {
    const res = el(doc, 'span', 'res');
    for (const k of ['metal', 'crystal', 'deuterium'] as const) {
      const cell = el(doc, 'span');
      cell.title = `${t(`res.${k}`)}: ${signed(today.res[k])}`;
      const letter = el(doc, 'b', '', t(`res.short.${k}`));
      letter.style.color = RES_COLORS[k];
      // A loss keeps the same minus sign as the totals.
      cell.append(letter, today.res[k] < 0 ? signed(today.res[k]) : fmt(today.res[k]));
      res.append(cell);
    }
    todayBlock.append(res);
  }
  journal.append(todayBlock, day('yesterday', t('exp.period.yesterday'), yesterday));

  // Targets: flagged players per flag; each opens the side bar on its own list.
  const players = Object.values(o.marks.players);
  const targets = el(doc, 'section', 'card');
  targets.append(head('target', t('bar.targets'), t('bar.targetsHint'), () => o.onOpenTargets(), String(players.length || '')));
  if (!players.length) targets.append(el(doc, 'p', 'hint', t('dock.targetsEmpty')));
  const flags = el(doc, 'div', 'flags');
  for (const f of FLAGS) {
    const n = players.filter((p) => p.flag === f).length;
    if (!n) continue;
    const b = button('flag', `${t(`mark.flag.${f}`)}: ${n}`, () => o.onOpenTargets({ flagTab: f }));
    b.style.color = FLAG_COLORS[f];
    b.setAttribute('aria-label', `${t(`mark.flag.${f}`)}: ${n}`);
    b.append(markIcon(doc, f, 13), el(doc, 'i', '', String(n)));
    flags.append(b);
  }
  if (flags.childElementCount) targets.append(flags);

  dock.append(journal, targets);
  if (menu) menu.append(dock);
  else home.append(dock);
}
