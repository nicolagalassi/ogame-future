/**
 * Phones show the game's desktop page zoomed out (about 0.4): anything of Future fixed on the page would
 * be drawn at that size too, too small to read or touch. These helpers keep an element over what is on
 * screen (the visual viewport) at the phone's own size, as OGLight does: laid out at the screen's width in
 * CSS pixels, then scaled back up by 1/zoom. They follow the player's own pinch and scroll only (no timer).
 */

/** How the element sits: along the bottom edge (the touch bar), or over the whole screen (a window). */
export type ViewportFit = 'bottom' | 'cover';

/** Below this zoom a window is fitted to the screen; at 1 (computers, a page zoomed in) it is left alone. */
const ZOOMED_OUT = 0.95;
/** A fitted window is drawn this much larger than the phone's own CSS pixels: its 11–13px text, sized for a
 *  computer screen, reads at 13–15px on a phone (Nicola: everything readable without squinting). */
const PHONE_TEXT = 1.15;

export function placeOnViewport(el: HTMLElement, vv: VisualViewport, fit: ViewportFit): void {
  const s = vv.scale || 1;
  if (fit === 'bottom') {
    Object.assign(el.style, { left: `${vv.offsetLeft}px`, top: `${vv.offsetTop + vv.height}px`, width: `${vv.width * s}px`, transform: `scale(${1 / s}) translateY(-100%)` });
    return;
  }
  if (s >= ZOOMED_OUT) {
    for (const p of ['left', 'top', 'width', 'height', 'transform', 'transformOrigin', 'inset'] as const) el.style[p] = '';
    return;
  }
  Object.assign(el.style, {
    inset: 'auto',
    left: `${vv.offsetLeft}px`,
    top: `${vv.offsetTop}px`,
    width: `${(vv.width * s) / PHONE_TEXT}px`,
    height: `${(vv.height * s) / PHONE_TEXT}px`,
    transformOrigin: '0 0',
    transform: `scale(${PHONE_TEXT / s})`,
  });
}

/**
 * Places `el` (position: fixed) now and again on every zoom or scroll of the visual viewport, until it
 * leaves the page. Without a visual viewport (old browsers, tests) a bottom bar is simply pinned to the
 * bottom and a window keeps its own CSS.
 */
export function followViewport(doc: Document, el: HTMLElement, fit: ViewportFit): void {
  const vv = doc.defaultView?.visualViewport;
  if (!vv) {
    if (fit === 'bottom') Object.assign(el.style, { top: 'auto', bottom: '0', width: '100%' });
    return;
  }
  const place = () => {
    if (!el.isConnected) {
      vv.removeEventListener('resize', place);
      vv.removeEventListener('scroll', place);
      return;
    }
    placeOnViewport(el, vv, fit);
  };
  placeOnViewport(el, vv, fit);
  vv.addEventListener('resize', place);
  vv.addEventListener('scroll', place);
}

/**
 * Tab strips that scroll sideways (a window on a phone): brings the tab in use into sight, without moving
 * the window up or down. Call once the window is on the page.
 */
export function revealActiveTabs(root: ParentNode): void {
  for (const strip of root.querySelectorAll<HTMLElement>('.tabs')) {
    if (strip.scrollWidth <= strip.clientWidth) continue;
    const tab = strip.querySelector<HTMLElement>('[aria-pressed="true"], [aria-selected="true"]');
    if (!tab) continue;
    const s = strip.getBoundingClientRect();
    const r = tab.getBoundingClientRect();
    // The strip may be drawn scaled (core/viewport): rectangles are on screen, scrollLeft is in CSS pixels.
    const k = strip.offsetWidth ? s.width / strip.offsetWidth : 1;
    if (r.left < s.left) strip.scrollLeft -= (s.left - r.left) / k + 16;
    else if (r.right > s.right) strip.scrollLeft += (r.right - s.right) / k + 16;
  }
}
