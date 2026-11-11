/**
 * Mark picker shared by every page: a flag next to a player. Click opens the choice, shift+click
 * repeats the last one used (as OGLight). Every picker for the same player on the page is repainted together.
 *
 * COMPLIANCE: edits Future's own stored list only; no network call, no game action.
 */
import { icon } from '../../core/icons';
import type { Store } from '../../core/storage';
import { FLAGS, flagPlayer, loadMarks, MARKS_KEY, type Flag, type Marks } from '../../engines/marks';

type T = (key: string, vars?: Record<string, string | number>) => string;

export const FLAG_COLORS: Record<Flag, string> = { watch: '#4FD1E8', target: '#FF7A7A', farm: '#7BC47F', danger: '#F5B547', friend: '#7FB8FF', trade: '#B58CDB' };

/**
 * The marks drawn solid (24×24, filled with currentColor), a second tone where it helps, instead of
 * thin outlines: they read on their own at 12–16px, with no box around them. `none` is the empty pennant.
 */
const MARK_PATHS: Record<Flag | 'none', string> = {
  watch: '<path fill-rule="evenodd" d="M12 4.5C6 4.5 2 12 2 12s4 7.5 10 7.5S22 12 22 12s-4-7.5-10-7.5zm0 3.4a4.1 4.1 0 1 1 0 8.2 4.1 4.1 0 0 1 0-8.2z"/><circle cx="12" cy="12" r="2.1"/>',
  target: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 3.3a6.7 6.7 0 1 0 0 13.4 6.7 6.7 0 0 0 0-13.4z"/><circle cx="12" cy="12" r="6.7" opacity=".3"/><circle cx="12" cy="12" r="3.3"/>',
  farm: '<path d="M12 2.6 1.8 10.6l1.3 1.6L12 5.3l8.9 6.9 1.3-1.6z" opacity=".6"/><path fill-rule="evenodd" d="M12 6.9l7.4 5.8V21H4.6v-8.3zM10 21v-5.4h4V21z"/>',
  danger: '<path fill-rule="evenodd" d="M10.3 3.4a2 2 0 0 1 3.4 0l8.6 15.1a2 2 0 0 1-1.7 3H3.4a2 2 0 0 1-1.7-3zM10.8 8.6h2.4l-.35 6.4h-1.7zM12 16.4a1.45 1.45 0 1 0 0 2.9 1.45 1.45 0 0 0 0-2.9z"/>',
  friend: '<circle cx="12" cy="7.4" r="4.6"/><path d="M2.8 21.6c.5-5.1 4.2-8.2 9.2-8.2s8.7 3.1 9.2 8.2z" opacity=".75"/>',
  trade: '<path d="M2.5 6.2h12.3V2.6L21.5 8l-6.7 5.4V9.8H2.5z"/><path d="M21.5 17.8H9.2v3.6L2.5 16l6.7-5.4v3.6h12.3z" opacity=".6"/>',
  none: '<rect x="4.2" y="2" width="2.2" height="20" rx="1.1"/><path d="M6.4 3.2h13.4l-3.3 4.9 3.3 4.9H6.4z" opacity=".6"/>',
};

/** A mark's icon, the same everywhere (the flag button, its menu, the targets list, the dock). */
export function markIcon(doc: Document, flag: Flag | 'none', size = 14): SVGSVGElement {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'fut-ico fut-mk-ico');
  svg.innerHTML = MARK_PATHS[flag];
  return svg;
}

const POP_ID = 'fut-mk-pop';

export const MARKS_CSS = `
.fut-mk { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; margin: 0 2px; padding: 0;
  border: 0; border-radius: 4px; background: none; color: #6B7F94; cursor: pointer; vertical-align: middle; }
.fut-mk .fut-mk-ico { filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.7)); transition: transform 120ms ease-out; }
.fut-mk:hover, .fut-mk:focus-visible { color: #C9D4E2; outline: none; }
.fut-mk:hover .fut-mk-ico, .fut-mk:focus-visible .fut-mk-ico { transform: scale(1.15); }
.fut-mk:focus-visible { box-shadow: 0 0 0 1px #617C8D; }
.fut-mk.on { background: none; }
#fut-mk-pop { position: fixed; z-index: 1000003; display: flex; gap: 3px; padding: 5px; border: 1px solid #2E4356; border-radius: 8px;
  background: #111B2A; box-shadow: 0 8px 22px rgba(0,0,0,0.55); font: 11px Verdana, Arial, sans-serif; }
#fut-mk-pop button { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; padding: 0; border: 1px solid #1F2C40;
  border-radius: 6px; background: #0A111C; color: #8A9BB0; cursor: pointer; }
#fut-mk-pop button:hover, #fut-mk-pop button:focus-visible { border-color: currentColor; outline: none; }
#fut-mk-pop button[aria-pressed="true"] { background: #12283A; border-color: currentColor; }`;

export function ensureMarksStyle(doc: Document): void {
  if (doc.getElementById('fut-mk-style')) return;
  const style = doc.createElement('style');
  style.id = 'fut-mk-style';
  style.textContent = MARKS_CSS;
  doc.head.append(style);
}

const readMarks = (store: Store) => loadMarks(store.get<Partial<Marks> | null>(MARKS_KEY, null));

function closePop(doc: Document): void {
  doc.getElementById(POP_ID)?.remove();
}

/** A small choice box under the button; Escape or a click elsewhere closes it. */
function openPop(doc: Document, anchor: HTMLElement, items: HTMLButtonElement[]): void {
  closePop(doc);
  const pop = doc.createElement('div');
  pop.id = POP_ID;
  pop.setAttribute('role', 'menu');
  pop.append(...items);
  doc.body.append(pop);
  const box = anchor.getBoundingClientRect();
  const view = doc.defaultView;
  pop.style.left = `${Math.max(6, Math.min(box.left - 4, (view?.innerWidth ?? 1200) - pop.offsetWidth - 6))}px`;
  pop.style.top = `${box.bottom + 4 + pop.offsetHeight > (view?.innerHeight ?? 800) ? box.top - 4 - pop.offsetHeight : box.bottom + 4}px`;
  items.find((b) => b.getAttribute('aria-pressed') === 'true')?.focus() ?? items[0]?.focus();
  const away = (e: Event) => {
    if (e instanceof KeyboardEvent ? e.key === 'Escape' : !pop.contains(e.target as Node)) {
      closePop(doc);
      doc.removeEventListener('mousedown', away, true);
      doc.removeEventListener('keydown', away, true);
      if (e instanceof KeyboardEvent) anchor.focus();
    }
  };
  doc.addEventListener('mousedown', away, true);
  doc.addEventListener('keydown', away, true);
}

/** Every flag button of this player in the page (and in Future's windows) shows the new state. */
function paintFlag(b: HTMLButtonElement, flag: Flag | undefined, t: T, name: string): void {
  b.replaceChildren(markIcon(b.ownerDocument, flag ?? 'none', 15));
  b.classList.toggle('on', !!flag);
  b.style.color = flag ? FLAG_COLORS[flag] : '';
  b.title = flag ? `${t(`mark.flag.${flag}`)} · ${t('mark.change')}` : t('mark.flagAdd');
  b.setAttribute('aria-label', `${b.title}: ${name}`);
}

const all = (root: Document | ShadowRoot, sel: string) => [...root.querySelectorAll<HTMLButtonElement>(sel)];
/** Pickers live in the page and in Future's shadow windows. */
function everyRoot(doc: Document): (Document | ShadowRoot)[] {
  return [doc, ...[...doc.querySelectorAll<HTMLElement>('[id^="fut-"]')].map((h) => h.shadowRoot).filter((r): r is ShadowRoot => !!r)];
}

export interface PickerOptions {
  doc: Document;
  store: Store;
  t: T;
  /** Called after a change (e.g. to redraw a list). */
  onChange?: () => void;
}

export function flagButton(o: PickerOptions, id: number, name: string): HTMLButtonElement {
  const { doc, store, t } = o;
  const b = doc.createElement('button');
  b.type = 'button';
  b.className = 'fut-mk fut-mk-flag';
  b.dataset.futFlag = String(id);
  b.setAttribute('aria-haspopup', 'menu');
  paintFlag(b, readMarks(store).players[String(id)]?.flag, t, name);
  const set = (flag: Flag | null) => {
    const next = flagPlayer(readMarks(store), id, name, flag, Date.now());
    store.set(MARKS_KEY, next);
    for (const root of everyRoot(doc)) for (const x of all(root, `[data-fut-flag="${id}"]`)) paintFlag(x, flag ?? undefined, t, name);
    o.onChange?.();
  };
  b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const m = readMarks(store);
    const current = m.players[String(id)]?.flag;
    if (e.shiftKey) return set(current === m.lastFlag ? null : m.lastFlag);
    const items = [...FLAGS, null].map((flag) => {
      const it = doc.createElement('button');
      it.type = 'button';
      it.setAttribute('role', 'menuitemradio');
      it.setAttribute('aria-pressed', String((current ?? null) === flag));
      it.title = flag ? t(`mark.flag.${flag}`) : t('mark.none');
      it.setAttribute('aria-label', it.title);
      it.append(flag ? markIcon(doc, flag, 15) : icon(doc, 'close', 13));
      if (flag) it.style.color = FLAG_COLORS[flag];
      it.addEventListener('click', () => {
        closePop(doc);
        set(flag);
        b.focus();
      });
      return it;
    });
    openPop(doc, b, items);
  });
  return b;
}
