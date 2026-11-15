/**
 * Planet / moon picker shared by Future's windows: a button showing the chosen body, opening a list
 * with one row per planet and its moon beside it (the fleet bar's destination list). Styles: `.bpick`
 * and `.bmenu` in core/sheet.ts.
 */
import { icon } from './icons';

export interface PickBody {
  id: number;
  name: string;
  coords: string;
  moon: boolean;
}

export interface BodyPickerOptions {
  bodies: PickBody[];
  /** The chosen body, or null when nothing is chosen. */
  current: number | null;
  /** Only these can be picked; the others show, disabled. Default: all. */
  enabled?: Set<number>;
  /** Word for a moon (screen readers, tooltips). */
  moonWord: string;
  /** When given, a first row that clears the choice (onPick(null)), with this text. */
  none?: string;
  /** Accessible name of the button when nothing is chosen. */
  label: string;
  onPick: (id: number | null) => void;
}

export function bodyPicker(doc: Document, o: BodyPickerOptions): HTMLElement {
  const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string) => {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const name = (b: PickBody) => `${b.name}${b.moon ? ` (${o.moonWord})` : ''} [${b.coords}]`;
  const wrap = h('div', 'bpick');
  const button = h('button', 'bpick-btn');
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  const menu = h('div', 'bmenu');
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  let current = o.current;

  const drawButton = () => {
    const b = o.bodies.find((x) => x.id === current);
    button.replaceChildren();
    button.setAttribute('aria-label', b ? name(b) : o.label);
    if (b?.moon) button.append(icon(doc, 'moon', 13));
    if (b) button.append(h('b', '', b.name), h('small', 'mono', b.coords));
    else button.append(h('b', 'none', o.none ?? o.label));
    button.append(icon(doc, 'chevron', 14));
  };
  const set = (open: boolean) => {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };
  const choose = (id: number | null) => {
    current = id;
    drawButton();
    drawMenu();
    set(false);
    button.focus();
    o.onPick(id);
  };
  const cell = (b: PickBody | undefined) => {
    if (!b) return h('span');
    const item = h('button', `${b.moon ? 'moon' : 'planet'}${b.id === current ? ' on' : ''}`);
    item.type = 'button';
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(b.id === current));
    item.setAttribute('aria-label', name(b));
    if (b.moon) {
      item.append(icon(doc, 'moon', 14));
      item.title = name(b);
    } else item.append(h('span', '', b.name), h('small', 'mono', b.coords));
    item.disabled = o.enabled ? !o.enabled.has(b.id) : false;
    item.addEventListener('click', () => choose(b.id));
    return item;
  };
  const drawMenu = () => {
    menu.replaceChildren();
    if (o.none !== undefined) {
      const clear = h('button', `clear${current === null ? ' on' : ''}`, o.none);
      clear.type = 'button';
      clear.setAttribute('role', 'option');
      clear.setAttribute('aria-selected', String(current === null));
      clear.addEventListener('click', () => choose(null));
      menu.append(clear);
    }
    const moons = new Map(o.bodies.filter((b) => b.moon).map((m) => [m.coords, m]));
    for (const p of o.bodies.filter((b) => !b.moon)) menu.append(cell(p), cell(moons.get(p.coords)));
  };

  drawButton();
  drawMenu();
  button.addEventListener('click', () => set(menu.hidden));
  wrap.addEventListener('focusout', (e) => {
    if (!wrap.contains(e.relatedTarget as Node | null)) set(false);
  });
  wrap.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || menu.hidden) return;
    e.stopPropagation();
    set(false);
    button.focus();
  });
  wrap.append(button, menu);
  return wrap;
}
