/**
 * Guided tours (coach marks): the page dims, one Future control stays lit with a yellow ring, and a bubble
 * beside it says what it does and how. «1 fai questo, 2 fai quest'altro» (Nicola, 2026-11-27).
 *
 * COMPLIANCE (AGENTS.md §1.1, §1.5, §1.7):
 * - A tour only explains. «Avanti» moves the bubble and nothing else: it never presses a game or Future
 *   button, never prepares or sends a fleet, never changes page. The lit control is covered by a shield that
 *   swallows taps, so a mistaken tap on a phone cannot prepare a fleet either.
 * - It never starts by itself: the dimming veil covers the whole page (Shop, Merchant and the ad bar
 *   included, like Future's windows), so it opens only from the player's click (the invite's «Mostrami», a
 *   «?» button, the Guide section in the settings). The invite shown on a first visit is a small card that
 *   dims nothing and blocks nothing (modules/guide).
 * - No timer, no network: positions follow the player's own scroll, zoom and resize.
 */
import { WINDOW_TOKENS } from './sheet';
import { icon } from './icons';
import { placeOnViewport, ZOOMED_OUT } from './viewport';

export interface TourStep {
  /** The control to light, looked up when the step shows (pages and windows redraw). No `at` = a card in
   *  the middle of the screen (welcome, last word). A step whose control is not on screen is skipped. */
  at?: (doc: Document) => Element | null | undefined;
  title: string;
  /** Paragraphs split on "\n". */
  text: string;
}

export interface TourLabels {
  next: string;
  back: string;
  done: string;
  close: string;
  /** "{n} di {total}" */
  count: (n: number, total: number) => string;
}

export const TOUR_ID = 'fut-tour';
/** Above the windows (1000001), their menus (1000002) and the touch bar (1000000). */
const Z = 1000010;
/** Room left around the lit control, CSS px. */
const PAD = 6;
const GAP = 14;

/** A guide's card and buttons, shared with the first-visit invite (modules/guide). */
export const CARD_CSS = `
:host { all: initial; ${WINDOW_TOKENS} }
* { box-sizing: border-box; }
.card {
  position: fixed; padding: 14px 16px 12px; border-radius: 6px; background: var(--raised);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
  font: 13px/1.45 var(--body); color: var(--text-2); text-align: left;
  -webkit-text-size-adjust: 100%; text-size-adjust: 100%; -moz-text-size-adjust: none;
  animation: fut-card-in 180ms var(--ease-out);
}
/* Phone, page zoomed out: a strip along the screen edge, at the phone's own size (core/viewport). */
.card.docked { max-width: none; border-radius: 0; transform-origin: 0 0; animation: none; }
@keyframes fut-card-in { from { opacity: 0; transform: translateY(4px); } }
h3 { margin: 0; font: 600 16px/1.25 var(--display); color: var(--text); }
p { margin: 6px 0 0; }
.acts { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: 12px; }
.b { height: 30px; padding: 0 14px; border: 0; border-radius: 4px; font: 600 13px var(--display); cursor: pointer; transition: transform 140ms var(--ease-out); }
.ghost { background: none; box-shadow: inset 0 0 0 1px var(--line-strong); color: var(--text-2); }
.ghost:hover { box-shadow: inset 0 0 0 1px var(--line-hover); color: var(--text); }
.quiet { margin-right: auto; padding: 0 4px; background: none; color: var(--muted); font-weight: 400; }
.quiet:hover { color: var(--text); }
.primary { background: var(--accent); color: var(--on-accent); }
.primary:hover { background: var(--accent-hi); }
.b:active { transform: scale(0.97); }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (pointer: coarse) { .b { height: 40px; padding: 0 16px; } }
@media (prefers-reduced-motion: reduce) { .card { animation: none; } .b:active { transform: none; } }
`;

const CSS = `${CARD_CSS}
/* The page dimmed and softly blurred around the lit control (Nicola: «hover blurrato»). */
.veil { position: fixed; z-index: ${Z}; background: rgba(4, 6, 10, 0.66); -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px); }
.shield { position: fixed; z-index: ${Z}; }
/* The lit control: a pawn-yellow ring printed around it, nothing over it. */
.ring { position: fixed; z-index: ${Z + 1}; border-radius: 6px; box-shadow: 0 0 0 2px var(--accent); pointer-events: none; }
/* From one control to the next: moving on screen, so it eases in and out. */
.veil, .shield, .ring { --move: 220ms cubic-bezier(0.65, 0, 0.35, 1); transition: left var(--move), top var(--move), width var(--move), height var(--move); }
.card { z-index: ${Z + 2}; width: 340px; max-width: calc(100vw - 24px); }
.card.docked.at-bottom { padding-bottom: calc(12px + env(safe-area-inset-bottom)); }
/* The arrow points at the lit control: yellow as its ring. */
.arrow { position: absolute; width: 12px; height: 12px; background: var(--accent); transform: rotate(45deg); }
.card[data-side="below"] .arrow { top: -6px; }
.card[data-side="above"] .arrow { bottom: -6px; }
.card[data-side="right"] .arrow { left: -6px; }
.card[data-side="left"] .arrow { right: -6px; }
.card.docked .arrow, .card[data-side="center"] .arrow { display: none; }
.top { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; min-height: 20px; }
/* Progress as a track of cells, as on the board: done cells filled, the pawn on the current one. */
.track { display: flex; gap: 2px; flex: 1; }
.track i { flex: 1; max-width: 22px; height: 6px; background: var(--line-strong); }
.track i.done { background: var(--faint); }
.track i.on { background: var(--accent); }
.count { font: 600 12px var(--display); color: var(--label); font-variant-numeric: tabular-nums; white-space: nowrap; }
.x { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; margin: -4px -6px -4px auto; padding: 0;
  border: 0; border-radius: 4px; background: none; color: var(--muted); cursor: pointer; }
.x:hover { color: var(--text); background: var(--band-2); }
@media (pointer: coarse) { .x { width: 40px; height: 40px; } }
@media (prefers-reduced-motion: reduce) { .veil, .shield, .ring { transition: none; } }
`;

const el = <K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
};

/** On the page and drawn (not display: none, not hidden). */
function shown(node: Element | null | undefined): node is Element {
  if (!node || !node.isConnected || node.closest('[hidden]')) return false;
  // checkVisibility: Chrome 105+, Firefox 106+; elsewhere (jsdom) a connected element counts.
  return typeof node.checkVisibility === 'function' ? node.checkVisibility() : true;
}

let ending: (() => void) | null = null;

/** Whether a tour is on screen now. */
export const tourOpen = (doc: Document): boolean => !!doc.getElementById(TOUR_ID);

/** Ends the tour on screen, if any (as «×»). */
export function endTour(): void {
  ending?.();
}

/** The steps of `steps` that can show on this page now. */
export const liveSteps = (doc: Document, steps: TourStep[]): TourStep[] => steps.filter((s) => !s.at || shown(s.at(doc)));

/** Shows `steps` one at a time (those not on the page skipped); `onEnd(true)` once the last is closed. */
export function startTour(doc: Document, steps: TourStep[], labels: TourLabels, onEnd?: (finished: boolean) => void): void {
  endTour();
  const live = liveSteps(doc, steps);
  if (!live.length) {
    onEnd?.(false);
    return;
  }
  const win = doc.defaultView;
  const host = el(doc, 'div');
  host.id = TOUR_ID;
  const root = host.attachShadow({ mode: 'open' });
  const style = el(doc, 'style');
  style.textContent = CSS;
  const [v0, v1, v2, v3] = [0, 1, 2, 3].map(() => el(doc, 'div', 'veil')) as [HTMLDivElement, HTMLDivElement, HTMLDivElement, HTMLDivElement];
  const veils = [v0, v1, v2, v3];
  const shield = el(doc, 'div', 'shield');
  const ring = el(doc, 'div', 'ring');
  const card = el(doc, 'div', 'card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-labelledby', 'fut-tour-title');
  root.append(style, ...veils, shield, ring, card);
  doc.body.append(host);

  let i = 0;
  let target: Element | null = null;
  let frame = 0;

  const place = () => {
    frame = 0;
    if (!host.isConnected) return;
    const vw = doc.documentElement.clientWidth || win?.innerWidth || 1024;
    const vh = win?.innerHeight || 768;
    const vv = win?.visualViewport;
    const zoomed = !!vv && vv.scale < ZOOMED_OUT;
    // The page redrew the control (the planet menu after an event landed): the same step's new one.
    if (target && !target.isConnected) target = live[i]?.at?.(doc) ?? null;
    const r = target?.getBoundingClientRect();
    const box = (v: HTMLElement, l: number, t: number, w: number, h: number) =>
      Object.assign(v.style, { left: `${l}px`, top: `${t}px`, width: `${Math.max(0, w)}px`, height: `${Math.max(0, h)}px` });
    if (!r) {
      // No control: the whole page dimmed, the card in the middle of what is on screen.
      box(v0, 0, 0, vw, vh);
      for (const v of [v1, v2, v3]) box(v, 0, 0, 0, 0);
      ring.style.display = shield.style.display = 'none';
    } else {
      const x = r.left - PAD;
      const y = r.top - PAD;
      const w = r.width + PAD * 2;
      const h = r.height + PAD * 2;
      // Four panels around the lit rectangle: the page is dimmed everywhere else.
      box(v0, 0, 0, vw, y);
      box(v1, 0, y + h, vw, vh - y - h);
      box(v2, 0, y, x, h);
      box(v3, x + w, y, vw - x - w, h);
      ring.style.display = shield.style.display = '';
      box(ring, x, y, w, h);
      box(shield, x, y, w, h);
    }
    card.removeAttribute('style');
    // Phone page zoomed out: the bubble is a strip at the phone's own size, on the edge away from the control.
    if (zoomed && vv) {
      const low = !!r && r.top + r.height / 2 > vv.offsetTop + vv.height / 2;
      card.className = `card docked ${low ? 'at-top' : 'at-bottom'}`;
      card.dataset.side = 'docked';
      placeOnViewport(card, vv, low ? 'top' : 'bottom');
      return;
    }
    card.className = 'card';
    const cw = Math.min(340, vw - 24);
    card.style.width = `${cw}px`;
    const ch = card.offsetHeight || 180;
    const arrow = card.querySelector<HTMLElement>('.arrow');
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
    if (!r) {
      card.dataset.side = 'center';
      Object.assign(card.style, { left: `${(vw - cw) / 2}px`, top: `${Math.max(12, (vh - ch) / 2)}px` });
      return;
    }
    const room = { below: vh - (r.bottom + PAD), above: r.top - PAD, right: vw - (r.right + PAD), left: r.left - PAD };
    const side =
      room.below >= ch + GAP ? 'below' : room.above >= ch + GAP ? 'above' : room.right >= cw + GAP ? 'right' : room.left >= cw + GAP ? 'left' : room.below >= room.above ? 'below' : 'above';
    card.dataset.side = side;
    let left: number;
    let top: number;
    if (side === 'below' || side === 'above') {
      left = clamp(r.left + r.width / 2 - cw / 2, 12, vw - cw - 12);
      top = clamp(side === 'below' ? r.bottom + PAD + GAP : r.top - PAD - GAP - ch, 8, vh - ch - 8);
      if (arrow) arrow.style.left = `${clamp(r.left + r.width / 2 - left - 6, 12, cw - 24)}px`;
    } else {
      top = clamp(r.top + r.height / 2 - ch / 2, 12, vh - ch - 12);
      left = side === 'right' ? r.right + PAD + GAP : r.left - PAD - GAP - cw;
      if (arrow) arrow.style.top = `${clamp(r.top + r.height / 2 - top - 6, 12, ch - 24)}px`;
    }
    Object.assign(card.style, { left: `${left}px`, top: `${top}px` });
  };
  const replace = () => {
    if (frame) return;
    if (win?.requestAnimationFrame) frame = win.requestAnimationFrame(place);
    else place();
  };

  const finish = (done: boolean) => {
    ending = null;
    host.remove();
    win?.removeEventListener('keydown', onKey, true);
    win?.removeEventListener('scroll', replace, true);
    win?.removeEventListener('resize', replace);
    win?.visualViewport?.removeEventListener('resize', replace);
    win?.visualViewport?.removeEventListener('scroll', replace);
    onEnd?.(done);
  };
  ending = () => finish(false);

  const button = (cls: string, text: string, onClick: () => void) => {
    const b = el(doc, 'button', cls, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  };

  const show = (n: number) => {
    i = n;
    const step = live[i]!;
    target = step.at?.(doc) ?? null;
    if (target && !shown(target)) target = null;
    // Bring the control into sight first, so the ring and the bubble land on it.
    if (target) {
      const r = target.getBoundingClientRect();
      const vv = win?.visualViewport;
      const topEdge = vv ? vv.offsetTop : 0;
      const bottomEdge = vv ? vv.offsetTop + vv.height : win?.innerHeight ?? 768;
      if (r.top < topEdge || r.bottom > bottomEdge) target.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    }
    const last = i === live.length - 1;
    const top = el(doc, 'div', 'top');
    if (live.length > 1) {
      const track = el(doc, 'span', 'track');
      track.setAttribute('aria-hidden', 'true');
      live.forEach((_, k) => track.append(el(doc, 'i', k < i ? 'done' : k === i ? 'on' : '')));
      top.append(track, el(doc, 'span', 'count', labels.count(i + 1, live.length)));
    }
    const x = button('x', '', () => finish(false));
    x.setAttribute('aria-label', labels.close);
    x.title = labels.close;
    x.append(icon(doc, 'close', 16));
    top.append(x);
    const title = el(doc, 'h3', '', step.title);
    title.id = 'fut-tour-title';
    // A single bubble (a zone's «?»): the title sits on the close button's line, no empty row above it.
    if (live.length === 1) top.prepend(title);
    const acts = el(doc, 'div', 'acts');
    if (i > 0) acts.append(button('b ghost', labels.back, () => show(i - 1)));
    const next = button('b primary', last ? labels.done : labels.next, () => (last ? finish(true) : show(i + 1)));
    acts.append(next);
    card.replaceChildren(el(doc, 'i', 'arrow'), top, ...(live.length === 1 ? [] : [title]), ...step.text.split('\n').map((p) => el(doc, 'p', '', p)), acts);
    place();
    // A second pass once the page has scrolled and the card has its real height.
    replace();
    next.focus({ preventScroll: true });
  };

  // The tour's own keys, caught on the window before the windows below hear them (their Esc would close them
  // under the tour). The game's and Future's shortcuts stay quiet while it is open (shortcuts: WINDOWS).
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') finish(false);
    else if (e.key === 'ArrowRight') {
      if (i < live.length - 1) show(i + 1);
    } else if (e.key === 'ArrowLeft') {
      if (i > 0) show(i - 1);
    } else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  win?.addEventListener('keydown', onKey, true);
  win?.addEventListener('scroll', replace, true);
  win?.addEventListener('resize', replace);
  win?.visualViewport?.addEventListener('resize', replace);
  win?.visualViewport?.addEventListener('scroll', replace);
  show(0);
}

/** The «?» of a window head or a zone: same look as the window's close button when `cls` is 'close'. */
export function helpButton(doc: Document, label: string, onClick: () => void, cls = 'close help'): HTMLButtonElement {
  const b = el(doc, 'button', cls);
  b.type = 'button';
  b.title = label;
  b.setAttribute('aria-label', label);
  b.append(icon(doc, 'help', 16));
  b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  return b;
}
