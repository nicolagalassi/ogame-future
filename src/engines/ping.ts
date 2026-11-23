/**
 * The game's "ping", as OGLight shows it: how long the server took to answer the page the player
 * just opened, read from the browser's own timing of that page load (no request is made for it).
 * A slow answer means a send pressed now also reaches the server late.
 */
export interface PageTiming {
  /** From the request leaving to the first byte of the answer, ms: the server's lag. */
  server: number;
  /** From the click to the page fully loaded, ms (0 while it is still loading). */
  total: number;
}

type NavEntry = { requestStart: number; responseStart: number; loadEventEnd: number; startTime: number };

/** The timing of this page's own load, or null when the browser does not give it. */
export function pageTiming(perf: { getEntriesByType?: (type: string) => unknown[] } | undefined): PageTiming | null {
  const nav = perf?.getEntriesByType?.('navigation')?.[0] as NavEntry | undefined;
  if (!nav || !(nav.responseStart > 0) || !(nav.requestStart > 0)) return null;
  const server = Math.max(0, Math.round(nav.responseStart - nav.requestStart));
  const total = nav.loadEventEnd > 0 ? Math.max(0, Math.round(nav.loadEventEnd - nav.startTime)) : 0;
  return { server, total };
}

/** Green under 400 ms, amber under 1 s, red from 1 s up. */
export function pingLevel(ms: number): 'fresh' | 'warm' | 'old' {
  return ms < 400 ? 'fresh' : ms < 1000 ? 'warm' : 'old';
}
