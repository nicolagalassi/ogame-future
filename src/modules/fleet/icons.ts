/**
 * Icons of the fleet bar (24×24, filled with currentColor). Solid shapes with a second tone
 * (opacity) for depth, instead of thin neon lines: they read at 16–22px on the dark tiles.
 * A path that needs a line says so itself (fill="none" stroke="currentColor").
 */
const LINE = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';

export const ICONS = {
  moon: '<path d="M14.6 2.6A9.6 9.6 0 1 0 21.4 16 8 8 0 0 1 14.6 2.6z"/>',
  planet: `<circle cx="12" cy="12" r="6.2"/><ellipse cx="12" cy="12" rx="10.4" ry="3.1" transform="rotate(-22 12 12)" ${LINE} stroke-width="1.7" opacity=".7"/>`,
  // A crate on its way: three faces in three tones, a solid arrow.
  transport: '<path d="M1.8 8.1 8.8 4.8l7 3.3-7 3.3z" opacity=".5"/><path d="M1.8 9.6l6.3 3V20l-6.3-3z"/><path d="M9.5 12.6l6.3-3V17l-6.3 3z" opacity=".75"/><path d="M17 12.4h2.9V9.6l3.7 4-3.7 4v-2.8H17z"/>',
  // Ships settling on a world: half a planet, an arrow coming down onto it.
  deploy: '<path d="M2.5 21.5a9.5 6 0 0 1 19 0z" opacity=".6"/><path d="M10 2.5h4v6.2h3.6L12 14.6 6.4 8.7H10z"/>',
  // Many bodies into one: the collection of the expeditions on the main moon.
  collect: '<circle cx="17.5" cy="12" r="4.8"/><circle cx="4.5" cy="4.8" r="2.4" opacity=".55"/><circle cx="3.6" cy="12" r="2.4" opacity=".55"/><circle cx="4.5" cy="19.2" r="2.4" opacity=".55"/><path d="M6.8 6.9l4.9 3.1-.9 1.4-4.9-3.1zM6.8 17.1l4.9-3.1-.9-1.4-4.9 3.1zM6.4 11.2h4.9v1.6H6.4z" opacity=".85"/>',
  expedition: '<circle cx="12" cy="12" r="10" opacity=".3"/><path d="M17.2 6.8l-3.4 7-3.6-3.6z"/><path d="M6.8 17.2l3.4-7 3.6 3.6z" opacity=".7"/>',
  fleetsave: '<path fill-rule="evenodd" d="M12 2l8.2 3.1v6.4c0 5-3.5 9.1-8.2 10.5-4.7-1.4-8.2-5.5-8.2-10.5V5.1zm-1.4 13.7l5.9-5.9-1.5-1.5-4.4 4.4-2-2-1.5 1.5z"/>',
  invert: '<path d="M7 2.8 2.4 8H6v13h2V8h3.6zM17 21.2l4.6-5.2H18V3h-2v13h-3.6z"/>',
  cargo: '<path d="M2.8 13h5l1.6 2.6h5.2l1.6-2.6h5v8.2H2.8z"/><path d="M10.4 2.6h3.2v5.2h3L12 12.6 7.4 7.8h3z" opacity=".75"/>',
  repeat: `<path d="M4 11.5V9.8A3.6 3.6 0 0 1 7.6 6.2H16" ${LINE} stroke-width="2.4"/><path d="M15.2 2.4 21 6.2l-5.8 3.8z"/><path d="M20 12.5v1.7a3.6 3.6 0 0 1-3.6 3.6H8" ${LINE} stroke-width="2.4"/><path d="M8.8 14 3 17.8l5.8 3.8z"/>`,
  settings: '<path fill-rule="evenodd" d="M12 4.6a7.4 7.4 0 1 1 0 14.8 7.4 7.4 0 0 1 0-14.8zm0 4.3a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2z"/>' +
    [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<rect x="10.4" y="1.4" width="3.2" height="4.2" rx=".8" transform="rotate(${a} 12 12)"/>`).join(''),
  last: '<path fill-rule="evenodd" d="M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19zM11 6.5v6.4l4.4 2.6.9-1.5-3.5-2V6.5z"/>',
  rules: '<rect x="3" y="6" width="18" height="2.4" rx="1.2" opacity=".5"/><circle cx="15.5" cy="7.2" r="3.2"/><rect x="3" y="15.6" width="18" height="2.4" rx="1.2" opacity=".5"/><circle cx="8.5" cy="16.8" r="3.2"/>',
  caret: '<path d="M6.5 9.5h11L12 15.6z"/>',
  reserve: '<path fill-rule="evenodd" d="M12 2l8.2 3.1v6.4c0 5-3.5 9.1-8.2 10.5-4.7-1.4-8.2-5.5-8.2-10.5V5.1zM8 11v2h8v-2z"/>',
  ships: '<path fill-rule="evenodd" d="M12 1.8c2.9 2.3 4.3 5.6 4.3 9.8v5.6L12 20.3l-4.3-3.1v-5.6c0-4.2 1.4-7.5 4.3-9.8zm0 5.5a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8z"/><path d="M7.3 12.4 3.6 16v4.6l3.7-2.5zM16.7 12.4l3.7 3.6v4.6l-3.7-2.5z" opacity=".6"/>',
  // A gem: a lighter crown over a solid point.
  resources: '<path d="M7 3.4h10l4.6 5.6H2.4z" opacity=".55"/><path d="M2.4 9h19.2L12 21.2z"/>',
  gate: '<path fill-rule="evenodd" d="M8.6 2.5c3.3 0 6 4.3 6 9.5s-2.7 9.5-6 9.5-6-4.3-6-9.5 2.7-9.5 6-9.5zm0 3.6c-1.5 0-2.8 2.6-2.8 5.9s1.3 5.9 2.8 5.9 2.8-2.6 2.8-5.9-1.3-5.9-2.8-5.9z"/><path d="M15.8 10.6h2.8V7.8l4 4.2-4 4.2v-2.8h-2.8z" opacity=".8"/>',
  food: '<path d="M4.6 2.6H6v5.1h1.1V2.6h1.5v5.1h1.1V2.6h1.4V9a3 3 0 0 1-2.3 2.9v9.5H6.9v-9.5A3 3 0 0 1 4.6 9z" opacity=".75"/><path d="M17.8 2.6c-2 .8-3 3.2-3 6.5 0 2 .8 3.4 2 3.8v8.5H19V2.6z" opacity=".75"/><path d="M3.2 19.4 19.4 3.2l1.4 1.4L4.6 20.8z"/>',
} as const;

export type IconName = keyof typeof ICONS;

export function iconSvg(name: IconName, size = 20): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true">${ICONS[name]}</svg>`;
}
