/** Line icons for the fleet actions (24×24, drawn with currentColor). */
export const ICONS = {
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  transport: '<path d="M2.5 8l6-3 6 3v8l-6 3-6-3z"/><path d="M2.5 8l6 3 6-3M8.5 11v8"/><path d="M17 12h5M19.5 9.5L22 12l-2.5 2.5"/>',
  deploy: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14M8.5 11h7"/><path d="M4.5 14c0 4 3.3 7 7.5 7s7.5-3 7.5-7"/>',
  expedition: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  fleetsave: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  invert: '<path d="M7 4v15M3.5 15.5L7 19l3.5-3.5"/><path d="M17 20V5M13.5 8.5L17 5l3.5 3.5"/>',
  cargo: '<path d="M12 3v11"/><path d="M8 10l4 4 4-4"/><path d="M4 15v5h16v-5"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  settings: '<circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  last: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>',
  rules: '<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.5"/><circle cx="8" cy="17" r="2.5"/>',
  caret: '<path d="M7 10l5 5 5-5"/>',
  reserve: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8 12h8"/>',
  ships: '<path d="M12 2c2.5 2 4 5 4 9v6l-4 3-4-3v-6c0-4 1.5-7 4-9z"/><path d="M8 13l-3 3v4l3-2M16 13l3 3v4l-3-2"/><circle cx="12" cy="9" r="1.5"/>',
  resources: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  gate: '<ellipse cx="12" cy="12" rx="5" ry="9"/><path d="M2 12h6M16 12h6M19 9l3 3-3 3"/>',
  food: '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10"/><path d="M16 3c-1.7 1-2.5 3-2.5 6s1 4 2.5 4v8"/><path d="M4 20L20 4" stroke-width="1.4"/>',
} as const;

export type IconName = keyof typeof ICONS;

export function iconSvg(name: IconName, size = 20): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}
