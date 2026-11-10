/**
 * Future's dock: a small panel in the free space under the game's left menu, as OGLight does with
 * its own. Two cards that say something before they are opened: the expedition journal (today and
 * the last 7 days) and the targets (how many players per flag, how many coloured planets).
 *
 * COMPLIANCE: page only. It is appended after the game's menu, which is neither moved, resized
 * nor covered (AGENTS.md §1.7: Merchant, Recruit Officers and Shop stay where they are). No
 * request is made here; a click opens Future's own journal window or targets side bar.
 */
import { icon, type IconName } from '../../core/icons';
import { formatUnits } from '../../core/format';
import { FLAGS, TAGS, type Flag, type Marks, type Tag } from '../../engines/marks';
import { FLAG_COLORS, FLAG_ICONS, TAG_COLORS } from '../marks/picker';

export const DOCK_ID = 'fut-dock';
const STYLE_ID = 'fut-dock-style';

export interface DockOptions {
  doc: Document;
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: string;
  /** Expeditions read today and in the last 7 days: how many, and the net value in MSU. */
  journal: { today: { count: number; net: number }; week: { count: number; net: number } };
  marks: Marks;
  onOpenJournal: () => void;
  /** Opens or closes the targets side bar; with a view, opens it there. */
  onOpenTargets: (view?: { tab: 'players' | 'planets'; flagTab?: Flag }) => void;
}

const CSS = `
#${DOCK_ID} {
  box-sizing: border-box; clear: both; display: flex; flex-direction: column; gap: 6px; width: 150px; margin: 10px 0 0 13px;
  font: 12px/1.3 Arial, Helvetica, sans-serif; color: #C9D4E2; font-variant-numeric: tabular-nums; text-align: left;
}
#${DOCK_ID} * { box-sizing: border-box; }
#${DOCK_ID} button { margin: 0; font: inherit; color: inherit; cursor: pointer; text-align: left; }
#${DOCK_ID} button:focus-visible { outline: 1px solid #4FD1E8; outline-offset: -2px; }
#${DOCK_ID} .card { border: 1px solid #1F2C40; border-radius: 7px; background: #111B2A; overflow: hidden; }
/* Head: what the card is and, on the right, its one number or the arrow that opens it. */
#${DOCK_ID} .head { display: flex; align-items: center; gap: 6px; width: 100%; height: 28px; padding: 0 8px; border: 0; border-bottom: 1px solid #1F2C40; background: #0B121D; }
#${DOCK_ID} .head b { flex: 1; min-width: 0; color: #E6EDF5; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#${DOCK_ID} .head svg { flex: none; color: #4FD1E8; }
#${DOCK_ID} .head .n { color: #9AA9BC; font: 12px Consolas, "JetBrains Mono", monospace; }
#${DOCK_ID} .head:hover, #${DOCK_ID} .line:hover { background: #16243A; }
/* Journal: one line per period. */
#${DOCK_ID} .line { display: grid; grid-template-columns: minmax(0, 1fr) auto 52px; align-items: baseline; gap: 6px; width: 100%; min-height: 24px; padding: 3px 8px; border: 0; background: none; }
#${DOCK_ID} .line + .line { border-top: 1px solid #16202F; }
#${DOCK_ID} .line .k { color: #9AA9BC; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#${DOCK_ID} .line .c { color: #9AA9BC; font: 11px Consolas, "JetBrains Mono", monospace; }
#${DOCK_ID} .line .v { color: #E6EDF5; font: 700 12px Consolas, "JetBrains Mono", monospace; text-align: right; }
#${DOCK_ID} .line .v.pos { color: #4FE0B0; } #${DOCK_ID} .line .v.neg { color: #F5B547; } #${DOCK_ID} .line .v.none { color: #617C8D; font-weight: 400; }
#${DOCK_ID} .cols { display: grid; grid-template-columns: minmax(0, 1fr) auto 52px; gap: 6px; padding: 3px 8px 0; color: #617C8D; font-size: 11px; }
#${DOCK_ID} .cols span:last-child { text-align: right; }
/* Targets: one chip per flag in use, then the coloured planets. */
#${DOCK_ID} .flags { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; padding: 6px; }
#${DOCK_ID} .flag { display: flex; align-items: center; justify-content: center; gap: 4px; height: 26px; padding: 0; border: 1px solid #1F2C40; border-radius: 5px; background: #0A111C; }
#${DOCK_ID} .flag:hover { border-color: currentColor; }
#${DOCK_ID} .flag i { font: normal 12px Consolas, "JetBrains Mono", monospace; color: #E6EDF5; }
#${DOCK_ID} .tags { display: inline-flex; gap: 2px; }
#${DOCK_ID} .tags i { width: 6px; height: 6px; border-radius: 50%; }
#${DOCK_ID} .hint { margin: 0; padding: 8px; color: #9AA9BC; font-size: 11px; line-height: 1.4; }
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
  const cols = el(doc, 'div', 'cols');
  cols.append(el(doc, 'span'), el(doc, 'span', '', t('dock.count')), el(doc, 'span', '', 'MSU'));
  journal.append(cols);
  for (const [key, s] of [['dock.today', o.journal.today], ['dock.week', o.journal.week]] as const) {
    const line = button('line', t('dock.journalHint', { n: s.count }), o.onOpenJournal);
    const net = s.count ? `${s.net >= 0 ? '+' : '−'}${fmt(Math.abs(s.net))}` : '—';
    line.append(el(doc, 'span', 'k', t(key)), el(doc, 'span', 'c', s.count ? String(s.count) : ''), el(doc, 'span', `v ${s.count ? (s.net >= 0 ? 'pos' : 'neg') : 'none'}`, net));
    journal.append(line);
  }

  // Targets: flagged players per flag, coloured planets; each opens the side bar on its own list.
  const players = Object.values(o.marks.players);
  const planets = Object.values(o.marks.planets);
  const targets = el(doc, 'section', 'card');
  targets.append(head('target', t('bar.targets'), t('bar.targetsHint'), () => o.onOpenTargets(), String(players.length + planets.length || '')));
  if (!players.length && !planets.length) targets.append(el(doc, 'p', 'hint', t('dock.targetsEmpty')));
  const flags = el(doc, 'div', 'flags');
  for (const f of FLAGS) {
    const n = players.filter((p) => p.flag === f).length;
    if (!n) continue;
    const b = button('flag', `${t(`mark.flag.${f}`)}: ${n}`, () => o.onOpenTargets({ tab: 'players', flagTab: f }));
    b.style.color = FLAG_COLORS[f];
    b.setAttribute('aria-label', `${t(`mark.flag.${f}`)}: ${n}`);
    b.append(icon(doc, FLAG_ICONS[f], 13), el(doc, 'i', '', String(n)));
    flags.append(b);
  }
  if (flags.childElementCount) targets.append(flags);
  if (planets.length) {
    const line = button('line', t('dock.planetsHint'), () => o.onOpenTargets({ tab: 'planets' }));
    const dots = el(doc, 'span', 'tags');
    for (const tag of TAGS) {
      if (!planets.some((p) => p.tag === (tag as Tag))) continue;
      const dot = el(doc, 'i');
      dot.style.background = TAG_COLORS[tag];
      dots.append(dot);
    }
    line.append(el(doc, 'span', 'k', t('marks.tab.planets')), dots, el(doc, 'span', 'v', String(planets.length)));
    targets.append(line);
  }

  dock.append(journal, targets);
  if (menu) menu.append(dock);
  else home.append(dock);
}
