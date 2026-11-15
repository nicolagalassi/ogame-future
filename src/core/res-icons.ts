/**
 * Resource symbols (24×24, filled with currentColor): the only drawing of metal, crystal,
 * deuterium, food and dark matter. The fleet bar, the planet menu totals and the inbox summaries
 * all use these, so changing one here changes it everywhere. Colours: RES_COLORS (core/sheet).
 */
export const RES_PATHS = {
  // The player's board pieces (DESIGN.md): flat shapes lit from the top left, the same three tones on each
  // (lit face full, side .72, shade .5), so they read at 10px and stay one family.
  // Metal: the board game's resource cube.
  metal: '<path d="M12 2.5 21 7.5 12 12.5 3 7.5z"/><path d="M3 7.5 12 12.5V22L3 17z" opacity=".72"/><path d="M21 7.5 12 12.5V22l9-5z" opacity=".5"/>',
  // Crystal: a cut gem, its table on top.
  crystal: '<path d="M7.2 3h9.6L21 8.4H3z"/><path d="M3 8.4h9V22z" opacity=".72"/><path d="M21 8.4h-9V22z" opacity=".5"/>',
  // Deuterium: a drop, its lit half on the left.
  deuterium: '<path d="M12 1.8c4.6 5.2 8 9.3 8 13.2a8 8 0 0 1-8 7.2z" opacity=".5"/><path d="M12 1.8C7.4 7 4 11.1 4 15a8 8 0 0 0 8 7.2z" opacity=".85"/>',
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

const TOKEN_KEY = { m: 'metal', c: 'crystal', d: 'deuterium' } as const;

/** A resource as a board token (m / c / d): the piece's symbol in an <i class="tok m|c|d">, coloured by CSS. */
export function resToken(doc: Document, key: 'm' | 'c' | 'd', size = 12): HTMLElement {
  const i = doc.createElement('i');
  i.className = `tok ${key}`;
  i.innerHTML = resIconSvg(TOKEN_KEY[key], size);
  return i;
}
