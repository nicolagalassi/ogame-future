/** Line icons for the fleet actions (24×24, drawn with currentColor). */
export const ICONS = {
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  transport:
    '<path d="M2 7h12v9H2z"/><path d="M14 10h4l4 4v2h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  deploy: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  expedition: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  fleetsave: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  all: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  cargo: '<path d="M12 3v11"/><path d="M8 10l4 4 4-4"/><path d="M4 15v5h16v-5"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  last: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>',
  caret: '<path d="M7 10l5 5 5-5"/>',
  reserve: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8 12h8"/>',
  food: '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10"/><path d="M16 3c-1.7 1-2.5 3-2.5 6s1 4 2.5 4v8"/><path d="M4 20L20 4" stroke-width="1.4"/>',
} as const;

export type IconName = keyof typeof ICONS;

export function iconSvg(name: IconName, size = 20): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}
