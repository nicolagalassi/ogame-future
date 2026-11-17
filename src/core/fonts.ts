/**
 * The board's face (DESIGN.md): Barlow Semi Condensed, carried inside the script so every player sees
 * the same figures whatever their system (Bahnschrift on Windows, DIN on Mac, anything on Linux before).
 *
 * COMPLIANCE: no network. The two weights are base64 in the bundle (scripts/build.mjs) and declared as
 * data: URLs; nothing is fetched. Licence: SIL Open Font License 1.1, © 2017 The Barlow Project Authors
 * (src/assets/fonts/OFL.txt).
 *
 * The faces are declared once on the page, not in the windows: Chrome ignores @font-face inside a shadow
 * root, while a family declared on the document is usable in every shadow root of it.
 */
import regular from '../assets/fonts/barlow-semi-condensed-400.woff2';
import semibold from '../assets/fonts/barlow-semi-condensed-600.woff2';

/** The family name the tokens use (`--display` in core/sheet.ts). Our own name, so no page font can shadow it. */
export const DISPLAY_FAMILY = 'Future Barlow';
const STYLE_ID = 'fut-fonts';

/** Each face answers a weight range and every stretch, so `600 condensed` or `700` never fall back or get faked. */
const face = (data: string, weights: string) => `@font-face { font-family: '${DISPLAY_FAMILY}'; font-style: normal; font-weight: ${weights}; font-stretch: 50% 200%; font-display: block; src: url(data:font/woff2;base64,${data}) format('woff2'); }`;

export function installFonts(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `${face(regular, '100 500')}\n${face(semibold, '501 900')}`;
  (doc.head ?? doc.documentElement).append(style);
}
