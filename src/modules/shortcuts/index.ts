import { toneRules, WINDOW_TOKENS } from '../../core/sheet';
import { followViewport } from '../../core/viewport';
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
  /** Keyboard only: not in the touch bar (Nicola: on the phone only the most used fleet actions). */
  keysOnly?: boolean;
  /** Short name printed under the glyph in the touch bar. */
  touchName?: string;
  /** Second, smaller line under the name: which kind, when two keys share it (Accentra trasporto / schiera). */
  touchSub?: string;
  /** Colour of the key in the touch bar, one per kind of fleet action, so it is found at a glance. */
  tone?: 'collect' | 'expedition' | 'fleetsave';
}

export const ACTIONS: ActionDef[] = [
  { id: 'planet.prev', key: 'i', label: 'shortcut.prev', group: 'planet', glyph: { core: 'back' } },
  { id: 'planet.next', key: 'o', label: 'shortcut.next', group: 'planet', glyph: { core: 'next' } },
  { id: 'targets.next', key: 'm', label: 'shortcut.nextTarget', group: 'targets', glyph: { core: 'target' } },
  { id: 'fleet.moon', key: 'l', label: 'fleet.btn.moon', group: 'fleet', glyph: { fleet: 'moon' }, keysOnly: true },
  { id: 'fleet.transport', key: 't', label: 'fleet.btn.transport', group: 'fleet', glyph: { fleet: 'transport' }, keysOnly: true },
  { id: 'fleet.deploy', key: 'd', label: 'fleet.btn.deploy', group: 'fleet', glyph: { fleet: 'deploy' }, keysOnly: true },
  { id: 'fleet.collect', key: 'c', label: 'fleet.btn.collectTransport', group: 'fleet', glyph: { fleet: 'transport' }, touchName: 'fleet.btn.touchCollect', touchSub: 'fleet.btn.touchSubTransport', tone: 'collect' },
  { id: 'fleet.collectDeploy', key: 'v', label: 'fleet.btn.collectDeploy', group: 'fleet', glyph: { fleet: 'deploy' }, touchName: 'fleet.btn.touchDeploy', touchSub: 'fleet.btn.touchSubDeploy', tone: 'collect' },
  { id: 'fleet.expedition', key: 'x', label: 'fleet.btn.expedition', group: 'fleet', glyph: { fleet: 'expedition' }, touchName: 'fleet.btn.expedition', tone: 'expedition' },
  { id: 'fleet.fleetsave', key: 'e', label: 'fleet.btn.fleetsave', group: 'fleet', glyph: { fleet: 'fleetsave' }, touchName: 'fleet.btn.fleetsave', tone: 'fleetsave' },
  { id: 'fleet.skip', key: 'n', label: 'fleet.btn.skip', group: 'fleet', glyph: { fleet: 'skip' }, keysOnly: true },
  { id: 'fleet.last', key: 'p', label: 'fleet.btn.last', group: 'fleet', glyph: { fleet: 'last' }, keysOnly: true },
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

const isField = (n: unknown): boolean => {
  const a = n as HTMLElement | null;
  if (!a || typeof a.tagName !== 'string') return false;
  const tag = a.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || a.isContentEditable;
};

/**
 * Is the player typing? The focused element is looked for inside Shadow DOMs too (the targets bar,
 * Future's windows): from the page, a textarea in a shadow root shows only as its host.
 */
function typing(doc: Document, e?: Event): boolean {
  if (e && isField(e.composedPath?.()[0])) return true;
  let a = doc.activeElement as HTMLElement | null;
  while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement as HTMLElement;
  return isField(a);
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
        if (typing(doc, e) || WINDOWS.some((w) => doc.getElementById(w))) return;
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
/* Window tokens (core/sheet.ts) for every surface this sheet styles. */
#${TOUCH_ID}, .fut-touch-pad { ${WINDOW_TOKENS} }
#${TOUCH_ID} { position: fixed; left: 0; top: 0; z-index: 1000000; box-sizing: border-box; transform-origin: 0 0;
  display: flex; align-items: center; gap: 8px; padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
  background: var(--raised); box-shadow: inset 0 2px 0 var(--line-strong);
  font: 600 13px/1.2 var(--display); color: var(--text-2); }
/* The keys scroll sideways: the faded right edge says there are more. */
#${TOUCH_ID} .keys { flex: 1; display: flex; gap: 2px; min-width: 0; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch;
  -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 22px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 22px), transparent); padding-right: 22px; }
#${TOUCH_ID} .keys::-webkit-scrollbar { display: none; }
#${TOUCH_ID} .sep { flex: none; width: 2px; align-self: stretch; margin: 0 6px; background: var(--line-strong); }
#${TOUCH_ID} button { flex: none; position: relative; display: inline-flex; align-items: center; justify-content: center;
  width: 46px; height: 46px; padding: 0; border: 0; border-radius: 4px; background: var(--surface); color: var(--text-2);
  font: inherit; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
#${TOUCH_ID} button:active { background: var(--hover); color: var(--text); }
#${TOUCH_ID} button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
/* The key in the corner, as on the fleet bar; fingers do not need it. */
#${TOUCH_ID} button .k { position: absolute; top: 3px; right: 4px; color: var(--quiet); font-size: 11px; line-height: 11px; }
#${TOUCH_ID} button:has(.k) .fut-tb-glyph { margin: 6px 6px 0 0; }
@media (pointer: coarse) { #${TOUCH_ID} button .k { display: none; } #${TOUCH_ID} button:has(.k) .fut-tb-glyph { margin: 0; } }
/* Named fleet keys: glyph over its name, wider, so each one reads and takes a thumb. */
#${TOUCH_ID} button.named { flex-direction: column; gap: 3px; width: auto; min-width: 56px; padding: 0 5px; color: var(--text); }
#${TOUCH_ID} button.named .tn { font: 600 11px/1 var(--display); white-space: nowrap; }
#${TOUCH_ID} button.named:has(.ts) { gap: 2px; }
#${TOUCH_ID} button.named:has(.ts) .fut-tb-glyph svg { width: 17px; height: 17px; }
#${TOUCH_ID} button.named .ts { color: var(--text-2); font: 500 10px/1 var(--display); white-space: nowrap; }
/* One colour per kind of fleet action (core/sheet MISSION_TONES): glyph and a bottom line in the colour,
   the key faintly tinted. */
${toneRules((k) => `#${TOUCH_ID} button[data-tone="${k}"]`)}
#${TOUCH_ID} button[data-tone] { background: color-mix(in srgb, var(--tone) 14%, var(--surface)); box-shadow: inset 0 -2px 0 var(--tone); }
#${TOUCH_ID} button[data-tone] .fut-tb-glyph { color: var(--tone); }
#${TOUCH_ID} button[data-tone]:active { background: color-mix(in srgb, var(--tone) 26%, var(--surface)); }
@media (pointer: coarse) { #${TOUCH_ID} button.named:has(.k) .fut-tb-glyph { margin: 0; } }
#${TOUCH_ID}[data-page="fleet2"] button.fleet, #${TOUCH_ID}[data-page="fleet2"] .sep.fleet { display: none; }
/* Future's settings: the same key shape, kept apart at the right end. */
#${TOUCH_ID} .gear { margin-left: auto; box-shadow: inset 0 0 0 1px var(--line-strong); }
/* The one primary action: pawn yellow. Not ready: struck through in quiet grey on an outline, as every disabled button. */
#${TOUCH_ID} .send { width: auto; min-width: 88px; padding: 0 12px; gap: 6px; background: var(--accent); color: var(--on-accent); font-size: 14px; }
#${TOUCH_ID} .send:active { background: var(--accent-hi); color: var(--on-accent); }
#${TOUCH_ID} .send[aria-disabled="true"] { background: transparent; box-shadow: inset 0 0 0 1px var(--line-strong); color: var(--quiet); text-decoration: line-through; }
.fut-touch-pad { height: 72px; }
/* A message carried by the bar, standing on top of its keys (it scales and moves with the bar). */
#${TOUCH_ID} .note { position: absolute; left: 8px; right: 8px; bottom: calc(100% + 6px); display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: 6px; background: var(--raised); box-shadow: inset 0 0 0 1px var(--accent-line), 0 8px 24px rgba(0, 0, 0, 0.6); color: var(--text); font: 600 14px/1.3 var(--display); }
#${TOUCH_ID} .note .q { flex: 1 1 200px; }
#${TOUCH_ID} .note .q b, #${TOUCH_ID} .note .q .l { display: block; }
#${TOUCH_ID} .note .q .l { font-weight: 400; color: var(--text-2); }
#${TOUCH_ID} .note button { width: auto; height: 38px; padding: 0 16px; }
#${TOUCH_ID} .note button.yes { background: var(--accent); color: var(--on-accent); }
`;

/**
 * A short message the touch bar carries just above its keys (the fleetsave speed question): it moves and
 * scales with the bar, so on a zoomed phone page it stays on screen instead of drifting with the page.
 */
const notes = new WeakMap<Document, HTMLElement>();
/** Shows `node` on the touch bar (null takes it away); false when there is no touch bar on this page. */
export function setTouchNote(doc: Document, node: HTMLElement | null): boolean {
  doc.getElementById(TOUCH_ID)?.querySelector(':scope > .note')?.remove();
  if (!node) {
    notes.delete(doc);
    return !!doc.getElementById(TOUCH_ID);
  }
  const bar = doc.getElementById(TOUCH_ID);
  if (!bar) return false;
  node.classList.add('note');
  notes.set(doc, node);
  bar.append(node);
  return true;
}

/** Opens Future's settings from the touch bar (set by main.ts); none = no gear. */
let openSettingsFromBar: (() => void) | null = null;
/** The gear at the right end of the touch bar: Future's settings from any page, a thumb away (Nicola). */
export function setTouchSettings(doc: Document, open: (() => void) | null): void {
  openSettingsFromBar = open;
  if (current?.doc === doc) scheduleTouchBar();
}

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
    if (!run || def.keysOnly) continue;
    // Fleet page on a phone: the four fleet actions need the room; the planet arrows stay keyboard keys there.
    // Galaxy view: its own four arrows move through systems and galaxies; the planet arrows, drawn the same,
    // would be mistaken for them and push the last one off the bar.
    if (def.group === 'planet' && (doc.getElementById('fleetdispatchcomponent') || runs.has('galaxy.left'))) continue;
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
    b.append(glyph(doc, def, 22));
    // The fleet actions carry their name under the glyph: clear at a glance on a phone.
    if (def.touchName) {
      b.classList.add('named');
      const n = doc.createElement('span');
      n.className = 'tn';
      n.textContent = t(def.touchName);
      b.append(n);
      if (def.touchSub) {
        const sub = doc.createElement('span');
        sub.className = 'ts';
        sub.textContent = t(def.touchSub);
        b.append(sub);
      }
    }
    if (def.tone) b.dataset.tone = def.tone;
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
  } else if (openSettingsFromBar) {
    // Everywhere but the fleet page, where the keys fill the bar and the page has its own Impostazioni.
    const open = openSettingsFromBar;
    const gear = doc.createElement('button');
    gear.type = 'button';
    gear.className = 'gear';
    gear.title = t('toolbar.settings');
    gear.setAttribute('aria-label', t('toolbar.settings'));
    gear.setAttribute('aria-haspopup', 'dialog');
    gear.append(glyph(doc, { glyph: { fleet: 'settings' } }, 22));
    gear.addEventListener('click', (e) => {
      e.preventDefault();
      open();
    });
    bar.append(gear);
  }
  if (!keys.childElementCount && !fleet) return;
  const note = notes.get(doc);
  if (note) bar.append(note);
  doc.body.append(bar);
  const pad = doc.createElement('div');
  pad.className = 'fut-touch-pad';
  doc.body.append(pad);
  // At the bottom of what is on screen, readable while the page is zoomed (core/viewport, as OGLight does).
  followViewport(doc, bar, 'bottom');
}


