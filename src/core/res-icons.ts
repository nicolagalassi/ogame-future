/**
 * Resource symbols (24×24, filled with currentColor): the only drawing of metal, crystal,
 * deuterium, food and dark matter. The fleet bar, the planet menu totals and the inbox summaries
 * all use these, so changing one here changes it everywhere. Colours: RES_COLORS (core/sheet).
 */
export const RES_PATHS = {
  // Metal: three ingots stacked, the top one in front.
  metal: '<path d="M1.8 21 3.6 15.6h7.3L12.7 21z" opacity=".7"/><path d="M11.3 21l1.8-5.4h7.3l1.8 5.4z" opacity=".7"/><path d="M6.5 14 8.3 8.6h7.4L17.5 14z"/><path d="M8.3 8.6h7.4l-.6 1.6H8.9z" opacity=".55"/>',
  // Crystal: a tall cut gem, the left facets darker.
  crystal: '<path d="M12 1.8 18.6 9 12 22.2 5.4 9z"/><path d="M12 1.8 5.4 9 12 22.2 9.6 9z" opacity=".55"/><path d="M5.4 9h13.2" fill="none" stroke="currentColor" stroke-width="1" opacity=".35"/>',
  // Deuterium: a drop, a lighter bubble inside.
  deuterium: '<path fill-rule="evenodd" d="M12 2c4 4.8 6.8 8.7 6.8 12.4a6.8 6.8 0 0 1-13.6 0C5.2 10.7 8 6.8 12 2zm-2.3 11.2a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4z"/>',
  // Food: a leaf, its vein in the second tone.
  food: '<path fill-rule="evenodd" d="M20.5 3.5C11 3.5 4.5 8.6 4.5 15.6c0 1.5.4 2.8 1 3.9l-2 2 1.4 1.4 2-2c1.1.6 2.4 1 3.9 1 7 0 9.7-8.4 9.7-18.4zM7.3 18.5l8.1-9.4.9.8-8.1 9.4z"/>',
  // Dark matter: a dark core inside a faint halo.
  darkMatter: '<circle cx="12" cy="12" r="10" opacity=".3"/><circle cx="12" cy="12" r="5.6"/>',
} as const;

export type ResKey = keyof typeof RES_PATHS;

/** The symbol as an inline SVG string, coloured by the surrounding text colour. */
export function resIconSvg(key: ResKey, size = 14): string {
  return `<svg class="fut-res-ico" viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true">${RES_PATHS[key]}</svg>`;
}
