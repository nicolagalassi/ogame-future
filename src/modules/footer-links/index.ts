/**
 * Quick links in the game's footer, next to «Impostazioni del server | Discord | Forum | Regole»,
 * as OGLight adds its own there: today ostats.eu (asked by Nicola). Each opens in a new tab.
 *
 * COMPLIANCE: links are only appended at the end of the footer's link row; nothing of the game's
 * footer is hidden, moved, resized or replaced (AGENTS.md §1.7), and OGLight does the same (project
 * exception, docs/OGLIGHT-RULES.md). No request is made: the player's click opens the site.
 */
export const OSTATS = 'https://ostats.eu/';

/** The universe's code on ostats.eu, from the game's host: "s269-it.ogame.gameforge.com" → "s269-it"; null elsewhere. */
export function ostatsUniverse(host: string): string | null {
  const m = /^(s\d+-[a-z]{2,3})\.ogame\.gameforge\.com$/i.exec(host);
  return m ? m[1]!.toLowerCase() : null;
}

/** A player's page on ostats.eu (the game's player id), or the universe's page when no id, or the home page. */
export function ostatsUrl(host: string, playerId?: number): string {
  const uni = ostatsUniverse(host);
  if (!uni) return OSTATS;
  return `${OSTATS}universes/${uni}${playerId ? `/player/${playerId}` : ''}`;
}

/** Future's footer links for this universe. */
export const footerLinks = (host: string): { label: string; href: string }[] => [{ label: 'ostats.eu', href: ostatsUrl(host) }];

/** Appends Future's links to the footer's right-hand row, once; returns how many it added. */
export function addFooterLinks(doc: Document, links = footerLinks(doc.location?.host ?? '')): number {
  const row = doc.querySelector<HTMLElement>('#siteFooter .content .fright');
  if (!row || row.querySelector('.fut-footlink')) return 0;
  for (const l of links) {
    // The game separates its links with "|": the same, so the row reads as one.
    row.append(doc.createTextNode('|'));
    const a = doc.createElement('a');
    a.className = 'fut-footlink';
    a.href = l.href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = l.label;
    row.append(a);
  }
  return links.length;
}
