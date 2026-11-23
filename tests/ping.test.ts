import { describe, expect, it } from 'vitest';
import { pageTiming, pingLevel } from '../src/engines/ping';
import { drawPing, PING_ID } from '../src/modules/ping';
import { translator } from '../src/core/i18n';

const perf = (e: Partial<{ requestStart: number; responseStart: number; loadEventEnd: number; startTime: number }> | null) => ({
  getEntriesByType: (type: string) => (type === 'navigation' && e ? [{ requestStart: 0, responseStart: 0, loadEventEnd: 0, startTime: 0, ...e }] : []),
});

describe('game ping', () => {
  it('server time from request to first byte, full load once it is over', () => {
    expect(pageTiming(perf({ requestStart: 120, responseStart: 302.6, loadEventEnd: 1540, startTime: 0 }))).toEqual({ server: 183, total: 1540 });
    expect(pageTiming(perf({ requestStart: 120, responseStart: 300 }))).toEqual({ server: 180, total: 0 });
    expect(pageTiming(perf(null))).toBeNull();
    expect(pageTiming(perf({ requestStart: 0, responseStart: 0 }))).toBeNull();
    expect(pageTiming(undefined)).toBeNull();
    expect([pingLevel(150), pingLevel(400), pingLevel(999), pingLevel(1000)]).toEqual(['fresh', 'warm', 'warm', 'old']);
  });

  it('next to the game clock, else in the footer; once', () => {
    const t = translator('it');
    document.body.innerHTML = '<ul id="bar"><li class="OGameClock">20.11.2026 <span>16:03:10</span></li></ul>';
    drawPing(document, t, { server: 1250, total: 2400 }, 'it');
    drawPing(document, t, { server: 183, total: 1540 }, 'it');
    const el = document.getElementById(PING_ID)!;
    expect(document.querySelectorAll(`#${PING_ID}`)).toHaveLength(1);
    expect(el.parentElement!.className).toBe('OGameClock');
    expect(el.textContent).toBe('Ping 183 ms');
    expect(el.title).toContain('1,5 s');
    document.body.innerHTML = '<div id="siteFooter"><div class="content"><div class="fright"><a>Forum</a></div></div></div>';
    drawPing(document, t, { server: 90, total: 0 }, 'it');
    expect(document.querySelector('#siteFooter .fright')!.textContent).toBe('Forum|Ping 90 ms');
    document.body.innerHTML = '';
    expect(drawPing(document, t, { server: 90, total: 0 }, 'it')).toBeNull();
    expect(drawPing(document, t, null, 'it')).toBeNull();
  });
});
