/**
 * Small drawn icons shared by every Future surface (one stroke, one weight), instead of
 * text glyphs such as × ✓ ☾ whose look depends on the font.
 */
const PATHS = {
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
  eye: '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  warn: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  farm: '<path d="M4 20.5V10l8-5.5 8 5.5v10.5z"/><path d="M9.5 20.5v-6h5v6"/>',
  user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/>',
  swap: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
  flag: '<path d="M5.5 21V4M5.5 4.5h11l-2.5 4 2.5 4h-11"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  back: '<path d="M19 12H5.5M11 5.5L4.5 12l6.5 6.5"/>',
  pen: '<path d="M4 20l1-4.5L16 4.5l3.5 3.5L8.5 19z"/><path d="M13.5 7l3.5 3.5"/>',
  chart: '<path d="M4 20.5h16"/><path d="M7 17v-5M12 17V6.5M17 17v-8"/>',
  planet: '<circle cx="12" cy="12" r="6"/><path d="M3 15.5c2.5 1.6 15.5-3.5 18-7"/>',
  fleet: '<path d="M3.5 12h11l5-4.5v9l-5-4.5"/><path d="M6.5 8.5L9 12l-2.5 3.5"/>',
  chevron: '<path d="M6 9.5l6 6 6-6"/>',
  next: '<path d="M4.5 12h14M13 5.5l6.5 6.5-6.5 6.5"/>',
  sword: '<path d="M19.5 4.5L9 15M19.5 4.5V9M19.5 4.5H15"/><path d="M6.5 12.5l5 5M8 16l-3.5 3.5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  more: '<path d="M5.5 12h.01M12 12h.01M18.5 12h.01" stroke-width="3.2"/>',
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
