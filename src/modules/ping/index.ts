/**
 * The ping next to the game's clock at the top of the page (in the footer when there is no clock),
 * as OGLight shows it: how long the server took to answer this page, coloured by how slow it is.
 *
 * COMPLIANCE: read once, from the browser's timing of the page the player opened; no request,
 * no timer that comes back (AGENTS.md §1.3, §4). It changes only when the player opens another page.
 */
import { pageTiming, pingLevel, type PageTiming } from '../../engines/ping';

export const PING_ID = 'fut-ping';
type T = (key: string, vars?: Record<string, string | number>) => string;

const COLORS = { fresh: '#38C56E', warm: '#E3BB28', old: '#EF7676' } as const;

export function drawPing(doc: Document, t: T, timing: PageTiming | null, locale: string): HTMLElement | null {
  doc.getElementById(PING_ID)?.remove();
  if (!timing) return null;
  const el = doc.createElement('span');
  el.id = PING_ID;
  el.textContent = t('ping.label', { ms: timing.server.toLocaleString(locale) });
  el.style.cssText = `margin-left: 8px; font: 700 11px Verdana, Arial, sans-serif; color: ${COLORS[pingLevel(timing.server)]}; white-space: nowrap; cursor: help;`;
  el.title = timing.total
    ? t('ping.hint', { ms: timing.server.toLocaleString(locale), s: (timing.total / 1000).toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 }) })
    : t('ping.hintShort', { ms: timing.server.toLocaleString(locale) });
  const clock = doc.querySelector('.OGameClock');
  if (clock) clock.append(el);
  else {
    const row = doc.querySelector('#siteFooter .content .fright');
    if (!row) return null;
    row.append(doc.createTextNode('|'), el);
  }
  return el;
}

/** Shows the ping once the page has loaded (so the full load time is known too). */
export function showPing(doc: Document, t: T, locale: string): void {
  const win = doc.defaultView;
  const draw = () => drawPing(doc, t, pageTiming(win?.performance as never), locale);
  if (doc.readyState === 'complete') draw();
  // One reading after the load event (the full time is set only then); never repeated.
  else win?.addEventListener('load', () => win.setTimeout(draw, 0), { once: true });
}
