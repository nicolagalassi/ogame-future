/**
 * Small drawn icons shared by every Future surface (one stroke, one weight), instead of
 * text glyphs such as × ✓ ☾ whose look depends on the font.
 */
const PATHS = {
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function icon(doc: Document, name: IconName, size = 14, cls = 'fut-ico'): SVGSVGElement {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', cls);
  svg.innerHTML = PATHS[name];
  return svg;
}

/** Shared rules for Future's own windows (Shadow DOM): focus, scrollbars, selection, numbers. */
export const BASE_SHEET = `
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #4FD1E8; outline-offset: 1px; }
.backdrop, .scroll, .table-wrap { scrollbar-color: #2A3B55 #0A111C; scrollbar-width: thin; }
::selection { background: #2B6F7D; color: #fff; }
.num, td, .value, .kpi-line { font-variant-numeric: tabular-nums; }
.close { display: inline-flex; align-items: center; justify-content: center; }
`;
