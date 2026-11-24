/**
 * The Merchant's entry in the game's menu turns light blue while today's import/export offer is
 * still to be used, as OGLight does (Nicola).
 *
 * GRAY AREA: requires ToolDev approval before publishing — see AGENTS.md §3. §1.7 protects the Merchant
 * menu item from being hidden, moved, resized, faded or swapped; only its label's text colour changes
 * here (a bright cyan with a soft glow, Nicola: «un po' neon, non esageriamo»), through a class on <body> and Future's own stylesheet (the item itself is never written to).
 * Precedent: OGLight colours it (Nicola, 2026-11-23; recorded in docs/OGLIGHT-RULES.md, not verified in
 * OGLight's source).
 */
import type { ImportExportState } from '../../data/import-export';

export const MERCHANT_CLASS = 'fut-ie-open';
const STYLE_ID = 'fut-merchant-style';
/** The Merchant in the game's left menu (the selector OGame Infinity uses; untested on this server). */
const MERCHANT = '.menubutton[data-ipi-hint="ipiToolbarTrader"]';
const CSS = `body.${MERCHANT_CLASS} #menuTable ${MERCHANT} .textlabel, body.${MERCHANT_CLASS} #leftMenu ${MERCHANT} .textlabel { color: #4FE3FF !important; text-shadow: 0 0 4px rgba(79, 227, 255, 0.65), 0 0 9px rgba(79, 227, 255, 0.35); }`;

export const isTraderPage = (href: string): boolean => /[?&]component=trader/i.test(href);

/** Lights the Merchant's label when the offer is waiting; leaves it as the game draws it otherwise. */
export function markMerchant(doc: Document, state: ImportExportState | null): void {
  if (!doc.getElementById(STYLE_ID)) {
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    doc.head.append(style);
  }
  doc.body.classList.toggle(MERCHANT_CLASS, state?.available === true);
}
