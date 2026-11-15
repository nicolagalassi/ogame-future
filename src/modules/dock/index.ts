import { WINDOW_TOKENS } from '../../core/sheet';
/**
 * Future's dock: a small panel in the free space under the game's left menu, as OGLight does with
 * its own. Two cards that say something before they are opened: the expedition journal (today and
 * the last 7 days) and the targets (how many players per flag).
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
const STYLE_ID = 'fut-dock-style';

export interface DockOptions {
  doc: Document;
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: string;
  /**
   * Expeditions read today and in the last 7 days: how many, and the net value in MSU; `days` are
   * the last 7 days one by one (oldest first, today last) for the small columns.
   */
  journal: { today: { count: number; net: number }; week: { count: number; net: number }; days?: { start: number; count: number; net: number }[] };
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
  font: 12px/1.3 Arial, Helvetica, sans-serif; color: var(--text-2); font-variant-numeric: tabular-nums; text-align: left;
}
#${DOCK_ID} * { box-sizing: border-box; }
#${DOCK_ID} button { margin: 0; font: inherit; color: inherit; cursor: pointer; text-align: left; }
#${DOCK_ID} button:focus-visible { outline: 1px solid var(--accent); outline-offset: -2px; }
#${DOCK_ID} .card { border: 1px solid var(--line); border-radius: 7px; background: var(--raised); overflow: hidden; }
/* Head: what the card is and, on the right, its one number or the arrow that opens it. */
#${DOCK_ID} .head { display: flex; align-items: center; gap: 6px; width: 100%; height: 28px; padding: 0 8px; border: 0; border-bottom: 1px solid var(--line); background: var(--bg); }
#${DOCK_ID} .head b { flex: 1; min-width: 0; color: var(--text); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#${DOCK_ID} .head svg { flex: none; color: var(--accent); }
#${DOCK_ID} .head .n { color: var(--label); font: 12px Consolas, "JetBrains Mono", monospace; }
#${DOCK_ID} .head:hover, #${DOCK_ID} .line:hover { background: var(--line); }
/* Journal: today's net gain large, the last 7 days as small columns (today lit), then the week. */
#${DOCK_ID} .jtoday { display: flex; flex-direction: column; gap: 1px; width: 100%; padding: 7px 8px 6px; border: 0; background: none; }
#${DOCK_ID} .jtoday:hover { background: var(--line); }
#${DOCK_ID} .jtoday .k { color: var(--label); font-size: 11px; }
#${DOCK_ID} .jtoday .v { font: 700 18px/22px Consolas, "JetBrains Mono", monospace; color: var(--text); }
#${DOCK_ID} .jtoday .v.neg { color: #FF8A7A; } #${DOCK_ID} .jtoday .v.none { color: var(--quiet); font-weight: 400; }
#${DOCK_ID} .jtoday .v small { margin-left: 4px; font: 11px Arial, Helvetica, sans-serif; color: var(--label); }
#${DOCK_ID} .jtoday .c { color: var(--label); font-size: 11px; }
#${DOCK_ID} .days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); align-items: end; gap: 3px; height: 30px; margin-top: 6px; }
#${DOCK_ID} .days i { display: block; min-height: 2px; border-radius: 2px 2px 0 0; background: var(--accent-line); }
#${DOCK_ID} .days i.zero { background: var(--line); }
#${DOCK_ID} .days i.today { background: var(--accent); }
/* One line per period. */
#${DOCK_ID} .line { display: grid; grid-template-columns: minmax(0, 1fr) auto 52px; align-items: baseline; gap: 6px; width: 100%; min-height: 24px; padding: 3px 8px; border: 0; background: none; }
#${DOCK_ID} .line + .line { border-top: 1px solid var(--line-soft); }
#${DOCK_ID} .line .k { color: var(--label); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#${DOCK_ID} .line .c { color: var(--label); font: 11px Consolas, "JetBrains Mono", monospace; }
#${DOCK_ID} .line .v { color: var(--text); font: 700 12px Consolas, "JetBrains Mono", monospace; text-align: right; }
#${DOCK_ID} .line .v.pos { color: var(--d); } #${DOCK_ID} .line .v.neg { color: var(--warn); } #${DOCK_ID} .line .v.none { color: var(--quiet); font-weight: 400; }
#${DOCK_ID} .cols { display: grid; grid-template-columns: minmax(0, 1fr) auto 52px; gap: 6px; padding: 3px 8px 0; color: var(--quiet); font-size: 11px; }
#${DOCK_ID} .cols span:last-child { text-align: right; }
/* Targets: one chip per flag in use. */
#${DOCK_ID} .flags { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; padding: 6px; }
#${DOCK_ID} .flag { display: flex; align-items: center; justify-content: center; gap: 4px; height: 26px; padding: 0; border: 1px solid var(--line); border-radius: 5px; background: var(--bg); }
#${DOCK_ID} .flag:hover { border-color: currentColor; }
#${DOCK_ID} .flag i { font: normal 12px Consolas, "JetBrains Mono", monospace; color: var(--text); }
#${DOCK_ID} .hint { margin: 0; padding: 8px; color: var(--label); font-size: 11px; line-height: 1.4; }
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

  // Journal: expeditions read from the inbox, today and over the last 7 days.
  const journal = el(doc, 'section', 'card');
  journal.append(head('chart', t('dock.journal'), t('exp.title'), o.onOpenJournal));
  const signed = (n: number) => `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n))}`;
  const today = o.journal.today;
  const block = button('jtoday', t('dock.journalHint', { n: today.count }), o.onOpenJournal);
  const big = el(doc, 'span', `v${today.count ? (today.net < 0 ? ' neg' : '') : ' none'}`, today.count ? signed(today.net) : '—');
  if (today.count) big.append(el(doc, 'small', '', 'MSU'));
  block.append(el(doc, 'span', 'k', t('dock.today')), big, el(doc, 'span', 'c', t('dock.todayCount', { n: today.count })));
  const days = o.journal.days ?? [];
  if (days.length) {
    const cols = el(doc, 'span', 'days');
    cols.setAttribute('aria-hidden', 'true');
    const top = Math.max(1, ...days.map((d) => d.net));
    days.forEach((d, i) => {
      const bar = el(doc, 'i', d.net > 0 ? (i === days.length - 1 ? 'today' : '') : 'zero');
      bar.style.height = `${Math.max(0, (d.net / top) * 100)}%`;
      bar.title = `${new Date(d.start).toLocaleDateString(o.locale, { weekday: 'short', day: '2-digit', month: '2-digit' })} · ${d.count} · ${d.count ? signed(d.net) : '—'} MSU`;
      cols.append(bar);
    });
    block.append(cols);
  }
  journal.append(block);
  const week = o.journal.week;
  const line = button('line', t('dock.journalHint', { n: week.count }), o.onOpenJournal);
  line.append(el(doc, 'span', 'k', t('dock.week')), el(doc, 'span', 'c', week.count ? String(week.count) : ''), el(doc, 'span', `v ${week.count ? (week.net >= 0 ? 'pos' : 'neg') : 'none'}`, week.count ? signed(week.net) : '—'));
  journal.append(line);

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
