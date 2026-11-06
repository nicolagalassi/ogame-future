/**
 * Mark pickers shared by every page: a flag next to a player, a colour next to a planet.
 * Click opens the choice, shift+click repeats the last one used (as OGLight). Every picker for the
 * same player or planet on the page is repainted together.
 *
 * COMPLIANCE: edits Future's own stored list only; no network call, no game action.
 */
import { icon, type IconName } from '../../core/icons';
import type { Store } from '../../core/storage';
import { FLAGS, flagPlayer, loadMarks, MARKS_KEY, TAGS, tagPlanet, type Flag, type Marks, type PlanetMark, type Tag } from '../../engines/marks';

type T = (key: string, vars?: Record<string, string | number>) => string;

export const FLAG_ICONS: Record<Flag, IconName> = { watch: 'eye', target: 'target', farm: 'farm', danger: 'warn', friend: 'user', trade: 'swap' };
export const FLAG_COLORS: Record<Flag, string> = { watch: '#4FD1E8', target: '#FF7A7A', farm: '#7BC47F', danger: '#F5B547', friend: '#7FB8FF', trade: '#B58CDB' };
export const TAG_COLORS: Record<Tag, string> = { red: '#E5484D', orange: '#F08A3C', yellow: '#E3C52B', green: '#46B35E', blue: '#3E8EDE', violet: '#9A6BD8' };

const POP_ID = 'fut-mk-pop';

export const MARKS_CSS = `
.fut-mk { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; margin: 0 2px; padding: 0;
  border: 1px solid #2E4356; border-radius: 4px; background: #0D1522; color: #4A5B72; cursor: pointer; vertical-align: middle; }
.fut-mk:hover, .fut-mk:focus-visible { border-color: #617C8D; color: #C9D4E2; outline: none; }
.fut-mk.on { border-color: currentColor; background: #0D1522; }
.fut-mk-dot { width: 9px; height: 9px; border-radius: 50%; border: 1px solid #4A5B72; }
.fut-mk.on .fut-mk-dot { border-color: transparent; }
#fut-mk-pop { position: fixed; z-index: 1000003; display: flex; gap: 3px; padding: 5px; border: 1px solid #2E4356; border-radius: 8px;
  background: #111B2A; box-shadow: 0 8px 22px rgba(0,0,0,0.55); font: 11px Verdana, Arial, sans-serif; }
#fut-mk-pop button { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; padding: 0; border: 1px solid #1F2C40;
  border-radius: 6px; background: #0A111C; color: #8A9BB0; cursor: pointer; }
#fut-mk-pop button:hover, #fut-mk-pop button:focus-visible { border-color: currentColor; outline: none; }
#fut-mk-pop button[aria-pressed="true"] { background: #12283A; border-color: currentColor; }
#fut-mk-pop .fut-mk-dot { width: 12px; height: 12px; }`;

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
  b.replaceChildren(icon(b.ownerDocument, flag ? FLAG_ICONS[flag] : 'flag', 11));
  b.classList.toggle('on', !!flag);
  b.style.color = flag ? FLAG_COLORS[flag] : '';
  b.title = flag ? `${t(`mark.flag.${flag}`)} · ${t('mark.change')}` : t('mark.flagAdd');
  b.setAttribute('aria-label', `${b.title}: ${name}`);
}

function paintTag(b: HTMLButtonElement, tag: Tag | undefined, t: T, coords: string): void {
  const dot = b.ownerDocument.createElement('span');
  dot.className = 'fut-mk-dot';
  if (tag) dot.style.background = TAG_COLORS[tag];
  b.replaceChildren(dot);
  b.classList.toggle('on', !!tag);
  b.title = tag ? `${t(`mark.tag.${tag}`)} · ${t('mark.change')}` : t('mark.tagAdd');
  b.setAttribute('aria-label', `${b.title}: [${coords}]`);
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
      it.append(icon(doc, flag ? FLAG_ICONS[flag] : 'close', 13));
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

export function tagButton(o: PickerOptions, coords: string, info: Omit<PlanetMark, 'tag' | 'at'>): HTMLButtonElement {
  const { doc, store, t } = o;
  const b = doc.createElement('button');
  b.type = 'button';
  b.className = 'fut-mk fut-mk-tag';
  b.dataset.futTag = coords;
  b.setAttribute('aria-haspopup', 'menu');
  paintTag(b, readMarks(store).planets[coords]?.tag, t, coords);
  const set = (tag: Tag | null) => {
    store.set(MARKS_KEY, tagPlanet(readMarks(store), coords, tag, info, Date.now()));
    for (const root of everyRoot(doc)) for (const x of all(root, `[data-fut-tag="${coords}"]`)) paintTag(x, tag ?? undefined, t, coords);
    o.onChange?.();
  };
  b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const m = readMarks(store);
    const current = m.planets[coords]?.tag;
    if (e.shiftKey) return set(current === m.lastTag ? null : m.lastTag);
    const items = [...TAGS, null].map((tag) => {
      const it = doc.createElement('button');
      it.type = 'button';
      it.setAttribute('role', 'menuitemradio');
      it.setAttribute('aria-pressed', String((current ?? null) === tag));
      it.title = tag ? t(`mark.tag.${tag}`) : t('mark.none');
      it.setAttribute('aria-label', it.title);
      if (tag) {
        const dot = doc.createElement('span');
        dot.className = 'fut-mk-dot';
        dot.style.background = TAG_COLORS[tag];
        dot.style.borderColor = 'transparent';
        it.append(dot);
      } else it.append(icon(doc, 'close', 13));
      it.addEventListener('click', () => {
        closePop(doc);
        set(tag);
        b.focus();
      });
      return it;
    });
    openPop(doc, b, items);
  });
  return b;
}
