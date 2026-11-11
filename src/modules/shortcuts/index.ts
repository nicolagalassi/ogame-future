/**
 * Shortcuts, as in OGLight: one key or one tap = one action of the player (switch planet, prepare a
 * fleet, the game's own Avanti / Invia, move in the galaxy). The keys can be changed in the
 * settings; on touch screens the same actions sit in a bar at the bottom of the screen.
 *
 * COMPLIANCE (AGENTS.md §1.1, §1.5): every key or tap does one thing the player could do with one
 * click on the page: a prepared fleet is never sent by a key of ours; "Avanti / Invia" presses the
 * game's own button (OGLight's bar does the same with Enter); the galaxy arrows press the game's own
 * arrows. Nothing runs on a timer. Keys are ignored while typing, with Ctrl/Alt/Meta held, on
 * auto-repeat and while one of our windows is open.
 */
import { icon, type IconName } from '../../core/icons';
import type { Store } from '../../core/storage';
import { iconSvg, type IconName as FleetIcon } from '../fleet/icons';

/** Every action Future offers on a key, with its default key. `fixed` keys belong to the game. */
export interface ActionDef {
  id: string;
  key: string | null;
  /** i18n key of what it does. */
  label: string;
  group: 'planet' | 'targets' | 'fleet' | 'galaxy';
  glyph: { core: IconName; turn?: number } | { fleet: FleetIcon };
  fixed?: boolean;
  /** Shown only in the touch bar (the game already reads the key itself). */
  touchOnly?: boolean;
}

export const ACTIONS: ActionDef[] = [
  { id: 'planet.prev', key: 'i', label: 'shortcut.prev', group: 'planet', glyph: { core: 'back' } },
  { id: 'planet.next', key: 'o', label: 'shortcut.next', group: 'planet', glyph: { core: 'next' } },
  { id: 'targets.next', key: 'm', label: 'shortcut.nextTarget', group: 'targets', glyph: { core: 'target' } },
  { id: 'fleet.moon', key: 'l', label: 'fleet.btn.moon', group: 'fleet', glyph: { fleet: 'moon' } },
  { id: 'fleet.transport', key: 't', label: 'fleet.btn.transport', group: 'fleet', glyph: { fleet: 'transport' } },
  { id: 'fleet.deploy', key: 'd', label: 'fleet.btn.deploy', group: 'fleet', glyph: { fleet: 'deploy' } },
  { id: 'fleet.collect', key: 'c', label: 'fleet.btn.collectTransport', group: 'fleet', glyph: { fleet: 'collect' } },
  { id: 'fleet.collectDeploy', key: 'v', label: 'fleet.btn.collectDeploy', group: 'fleet', glyph: { fleet: 'collect' } },
  { id: 'fleet.expedition', key: 'x', label: 'fleet.btn.expedition', group: 'fleet', glyph: { fleet: 'expedition' } },
  { id: 'fleet.fleetsave', key: 'e', label: 'fleet.btn.fleetsave', group: 'fleet', glyph: { fleet: 'fleetsave' } },
  { id: 'fleet.last', key: 'p', label: 'fleet.btn.last', group: 'fleet', glyph: { fleet: 'last' } },
  { id: 'galaxy.left', key: 'ArrowLeft', label: 'shortcut.galaxyLeft', group: 'galaxy', glyph: { core: 'back' }, fixed: true, touchOnly: true },
  { id: 'galaxy.right', key: 'ArrowRight', label: 'shortcut.galaxyRight', group: 'galaxy', glyph: { core: 'next' }, fixed: true, touchOnly: true },
  { id: 'galaxy.down', key: 'ArrowDown', label: 'shortcut.galaxyDown', group: 'galaxy', glyph: { core: 'chevron' }, fixed: true, touchOnly: true },
  { id: 'galaxy.up', key: 'ArrowUp', label: 'shortcut.galaxyUp', group: 'galaxy', glyph: { core: 'chevron', turn: 180 }, fixed: true, touchOnly: true },
];

/** The player's keys: action id → key, or null for "no key". Missing ids keep the default. */
export const KEYMAP_KEY = 'keys.map';
/** Touch bar: 'auto' on touch screens, 'on' always, 'off' never. */
export const TOUCH_KEY = 'keys.touch';
export type TouchMode = 'auto' | 'on' | 'off';

export type Keymap = Record<string, string | null>;

/** The key of each action, the player's choice over the default. */
export function keymap(store: Pick<Store, 'get'>): Map<string, string | null> {
  const saved = store.get<Keymap>(KEYMAP_KEY, {});
  return new Map(ACTIONS.map((a) => [a.id, a.fixed ? a.key : a.id in saved ? (saved[a.id] ?? null) : a.key]));
}

/** A key a shortcut may use: one letter or digit (the rest belongs to the game or the browser). */
export function usableKey(key: string): boolean {
  return /^[a-z0-9]$/i.test(key);
}

/**
 * Sets `id` to `key`. Another action on the same key loses it (returned, so the settings can say
 * so); null clears the key; the default comes back by giving the default key.
 */
export function assignKey(store: Store, id: string, key: string | null): string | null {
  const k = key?.toLowerCase() ?? null;
  const map = keymap(store);
  const saved = { ...store.get<Keymap>(KEYMAP_KEY, {}) };
  let taken: string | null = null;
  if (k) {
    for (const [other, ok] of map) if (other !== id && ok === k && !ACTIONS.find((a) => a.id === other)?.fixed) {
      saved[other] = null;
      taken = other;
    }
  }
  saved[id] = k;
  store.set(KEYMAP_KEY, saved);
  return taken;
}

export function resetKeys(store: Store): void {
  store.set(KEYMAP_KEY, {});
}

/* ------------------------------------------------------------------ */
/* Page registry                                                       */
/* ------------------------------------------------------------------ */

/** What this page can do now, per action id. */
const runs = new Map<string, () => void>();
let installed: Document | null = null;
let current: { doc: Document; store: Store; t: (k: string) => string } | null = null;

function typing(doc: Document): boolean {
  const a = doc.activeElement as HTMLElement | null;
  if (!a) return false;
  const tag = a.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || a.isContentEditable;
}

const WINDOWS = ['fut-fleet-modal', 'fut-dashboard', 'fut-planner', 'fut-journal', 'fut-settings-window'];

/** Makes `run` the action `id` on this page: on its key and in the touch bar. */
export function registerActions(doc: Document, store: Store, t: (k: string) => string, list: Record<string, () => void>): void {
  for (const [id, run] of Object.entries(list)) runs.set(id, run);
  current = { doc, store, t };
  if (installed !== doc) {
    installed = doc;
    doc.addEventListener(
      'keydown',
      (e) => {
        if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || !current) return;
        if (typing(doc) || WINDOWS.some((w) => doc.getElementById(w))) return;
        const k = e.key.toLowerCase();
        for (const [id, key] of keymap(current.store)) {
          const def = ACTIONS.find((a) => a.id === id)!;
          if (def.touchOnly || key !== k) continue;
          const run = runs.get(id);
          if (!run) continue;
          e.preventDefault();
          e.stopPropagation();
          run();
          return;
        }
      },
      true,
    );
  }
  scheduleTouchBar();
}

/** Test helper. */
export function resetShortcuts(): void {
  runs.clear();
  installed = null;
  current = null;
}

/** Same page on another planet or moon: the URL the game's planet list would open (cp). */
export function switchBodyUrl(href: string, cp: number): string {
  const u = new URL(href);
  for (const k of [...u.searchParams.keys()]) if (k.startsWith('fut')) u.searchParams.delete(k);
  u.searchParams.set('cp', String(cp));
  return u.toString();
}

/** Readable name of a key: "T", "←". */
export function keyLabel(key: string | null): string {
  if (!key) return '';
  return { arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓', enter: '↵' }[key.toLowerCase()] ?? key.toUpperCase();
}

export function glyph(doc: Document, def: Pick<ActionDef, 'glyph'>, size = 18): Element {
  if ('fleet' in def.glyph) {
    const span = doc.createElement('span');
    span.className = 'fut-tb-glyph';
    span.innerHTML = iconSvg(def.glyph.fleet, size);
    return span;
  }
  const svg = icon(doc, def.glyph.core, size, 'fut-tb-glyph');
  if (def.glyph.turn) svg.style.transform = `rotate(${def.glyph.turn}deg)`;
  return svg;
}

/* ------------------------------------------------------------------ */
/* Touch bar                                                           */
/* ------------------------------------------------------------------ */

export const TOUCH_ID = 'fut-touchbar';
/** The game's own "next" button on each fleet page (#continueToFleet2 / #sendFleet). */
const SEND = { fleet1: '#continueToFleet2', fleet2: '#sendFleet' } as const;

export function touchWanted(doc: Document, store: Pick<Store, 'get'>): boolean {
  const mode = store.get<TouchMode>(TOUCH_KEY, 'auto');
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return !!doc.defaultView?.matchMedia?.('(pointer: coarse)').matches;
}

const TOUCH_CSS = `
#${TOUCH_ID} { position: fixed; left: 0; top: 0; z-index: 1000000; box-sizing: border-box; transform-origin: 0 0;
  display: flex; align-items: center; gap: 6px; padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
  background: rgba(8, 13, 20, 0.94); border-top: 1px solid #1F2C40; box-shadow: 0 -6px 18px rgba(0, 0, 0, 0.45);
  font: 11px/1.2 Verdana, Arial, sans-serif; color: #C9D4E2; }
#${TOUCH_ID} .keys { flex: 1; display: flex; gap: 6px; min-width: 0; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
#${TOUCH_ID} .keys::-webkit-scrollbar { display: none; }
#${TOUCH_ID} .sep { flex: none; width: 1px; align-self: stretch; margin: 4px 2px; background: #1F2C40; }
#${TOUCH_ID} button { flex: none; position: relative; display: inline-flex; align-items: center; justify-content: center;
  width: 48px; height: 48px; padding: 0; border: 1px solid #24344B; border-radius: 6px; background: #0D1522; color: #4FD1E8;
  font: inherit; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
#${TOUCH_ID} button:active { background: #12283A; border-color: #4FD1E8; transform: translateY(1px); }
#${TOUCH_ID} button:focus-visible { outline: 2px solid #4FD1E8; outline-offset: 1px; }
/* The key in the corner, as on the fleet bar; fingers do not need it. */
#${TOUCH_ID} button .k { position: absolute; top: 3px; right: 4px; color: #8592A1; font-size: 11px; line-height: 11px; }
#${TOUCH_ID} button:has(.k) .fut-tb-glyph { margin: 6px 6px 0 0; }
@media (pointer: coarse) { #${TOUCH_ID} button .k { display: none; } #${TOUCH_ID} button:has(.k) .fut-tb-glyph { margin: 0; } }
#${TOUCH_ID} button.planet { color: #C9D2DC; }
#${TOUCH_ID} button.galaxy { color: #7BC47F; }
#${TOUCH_ID}[data-page="fleet2"] button.fleet, #${TOUCH_ID}[data-page="fleet2"] .sep.fleet { display: none; }
#${TOUCH_ID} .send { width: auto; min-width: 104px; padding: 0 16px; gap: 8px; border-color: #2B8A5E; background: #12352A; color: #E6F7EE; font-weight: 700; font-size: 13px; }
#${TOUCH_ID} .send:active { background: #1A4A3A; border-color: #4FE0B0; }
@media (prefers-reduced-motion: reduce) { #${TOUCH_ID} button:active { transform: none; } }
#${TOUCH_ID} .send[aria-disabled="true"] { opacity: 0.45; }
.fut-touch-pad { height: 72px; }
`;

let queued = false;
function scheduleTouchBar(): void {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    if (current) mountTouchBar(current.doc, current.store, current.t);
  });
}

/** The bar at the bottom of the screen, with this page's actions and the game's Avanti / Invia. */
export function mountTouchBar(doc: Document, store: Store, t: (k: string) => string): void {
  doc.getElementById(TOUCH_ID)?.remove();
  doc.querySelector('.fut-touch-pad')?.remove();
  if (!touchWanted(doc, store) || !doc.body) return;
  if (!doc.getElementById(`${TOUCH_ID}-style`)) {
    const style = doc.createElement('style');
    style.id = `${TOUCH_ID}-style`;
    style.textContent = TOUCH_CSS;
    doc.head.append(style);
  }
  const bar = doc.createElement('div');
  bar.id = TOUCH_ID;
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', t('touch.bar'));
  const keys = doc.createElement('div');
  keys.className = 'keys';
  const map = keymap(store);
  let group = '';
  for (const def of ACTIONS) {
    const run = runs.get(def.id);
    if (!run) continue;
    if (group && group !== def.group) {
      const sep = doc.createElement('span');
      sep.className = `sep ${def.group}`;
      keys.append(sep);
    }
    group = def.group;
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = def.group;
    const key = keyLabel(map.get(def.id) ?? null);
    b.title = key && !def.touchOnly ? `${t(def.label)} [${key}]` : t(def.label);
    b.setAttribute('aria-label', t(def.label));
    b.append(glyph(doc, def, 24));
    if (key && !def.touchOnly) {
      const k = doc.createElement('span');
      k.className = 'k';
      k.setAttribute('aria-hidden', 'true');
      k.textContent = key;
      b.append(k);
    }
    b.addEventListener('click', (e) => {
      e.preventDefault();
      run();
    });
    keys.append(b);
  }
  bar.append(keys);

  // Fleet page: the game's own Avanti (page 1) or Invia (page 2), one tap = one press of it.
  const fleet = doc.getElementById('fleetdispatchcomponent');
  if (fleet) {
    const send = doc.createElement('button');
    send.type = 'button';
    send.className = 'send';
    const label = doc.createElement('span');
    send.append(label, icon(doc, 'next', 16));
    // The game hides #fleet1 when it shows page 2.
    const page = (): keyof typeof SEND => (doc.getElementById('fleet1')?.style.display === 'none' ? 'fleet2' : 'fleet1');
    const sync = () => {
      const p = page();
      // Page 2: the fleet buttons prepare page 1 only, so they step aside.
      bar.dataset.page = p;
      label.textContent = t(p === 'fleet2' ? 'touch.send' : 'touch.next');
      const target = doc.querySelector<HTMLElement>(SEND[p]);
      send.setAttribute('aria-disabled', String(!target || target.classList.contains('off') || (target as HTMLButtonElement).disabled === true));
    };
    sync();
    send.addEventListener('click', (e) => {
      e.preventDefault();
      doc.querySelector<HTMLElement>(SEND[page()])?.click();
    });
    // The game swaps page 1 and page 2 without a reload, and lights the button when the form is ready.
    new MutationObserver(sync).observe(fleet, { attributes: true, subtree: true, attributeFilter: ['style', 'class', 'disabled'] });
    bar.append(send);
  }
  if (!keys.childElementCount && !fleet) return;
  doc.body.append(bar);
  const pad = doc.createElement('div');
  pad.className = 'fut-touch-pad';
  doc.body.append(pad);
  followViewport(doc, bar);
}

/**
 * Keeps the bar at the bottom of what is on screen and at a readable size while the page is
 * zoomed (the game's desktop page on a phone), as OGLight does with the visual viewport.
 */
function followViewport(doc: Document, bar: HTMLElement): void {
  const vv = doc.defaultView?.visualViewport;
  if (!vv) {
    Object.assign(bar.style, { top: 'auto', bottom: '0', width: '100%' });
    return;
  }
  const place = () => {
    const b = doc.getElementById(TOUCH_ID);
    if (!b) return;
    const s = vv.scale || 1;
    Object.assign(b.style, { left: `${vv.offsetLeft}px`, top: `${vv.offsetTop + vv.height}px`, width: `${vv.width * s}px`, transform: `scale(${1 / s}) translateY(-100%)` });
  };
  place();
  // Moved by the player's own zoom and scroll only: no timer.
  if (!followers.has(doc)) {
    followers.add(doc);
    vv.addEventListener('resize', place);
    vv.addEventListener('scroll', place);
  }
}
const followers = new WeakSet<Document>();
