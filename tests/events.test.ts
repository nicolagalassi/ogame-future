import { describe, expect, it } from 'vitest';
import { eventsByBody, loadEventsOnPageLoad, parseEventRows, EVENT_LIST_PATH, EVENTS_KEY, type Events } from '../src/data/events';
import { NetworkGuard } from '../src/core/guard';
import { MemoryStore, Store } from '../src/core/storage';
import { EVENT_LIST_V12 } from './event-list-v12';

const fig = (type: string) => `<figure class="planetIcon ${type}"></figure>`;
const row = (o: { mission: number; side: 'friendly' | 'hostile' | 'neutral'; back?: boolean; at: number; from: string; fromType?: string; to: string; toType?: string; ships?: number; cls?: string }) =>
  `<tr class="${o.cls ?? 'eventFleet'}" data-mission-type="${o.mission}" data-return-flight="${o.back ? 'true' : 'false'}" data-arrival-time="${o.at}">
    <td class="countDown"><span class="${o.side} textBeefy">1m</span></td>
    <td class="originFleet">${fig(o.fromType ?? 'planet')}Casa</td>
    <td class="coordsOrigin"><a>[${o.from}]</a></td>
    <td class="detailsFleet"><span>${o.ships ?? 10}</span></td>
    <td class="destFleet">${fig(o.toType ?? 'planet')}Altro</td>
    <td class="destCoords"><a>[${o.to}]</a></td></tr>`;
const table = (rows: string[]) => `<div id="eventListWrap"><table id="eventContent"><tbody>${rows.join('')}</tbody></table></div>`;

describe('event list per body', () => {
  const own = new Set(['1:2:3|p', '1:2:3|m', '1:5:7|p']);

  it('marks the bodies an enemy attacks or spies, with the first arrival, and ignores returns and debris', () => {
    const box = document.createElement('div');
    box.innerHTML = table([
      row({ mission: 1, side: 'hostile', at: 500, from: '9:9:9', to: '1:2:3', toType: 'moon' }),
      row({ mission: 6, side: 'hostile', at: 300, from: '9:9:9', to: '1:2:3' }),
      row({ mission: 6, side: 'hostile', at: 200, from: '9:9:9', to: '1:2:3' }),
      row({ mission: 1, side: 'hostile', at: 400, from: '9:9:9', to: '1:2:3', toType: 'tf' }),
      // Someone else's planet in the same list (an ACS defend): not the player's.
      row({ mission: 1, side: 'hostile', at: 400, from: '9:9:9', to: '4:4:4' }),
      row({ mission: 2, side: 'hostile', at: 700, from: '9:9:9', to: '1:5:7', cls: 'allianceAttack' }),
      row({ mission: 2, side: 'hostile', at: 700, from: '9:9:8', to: '1:5:7', cls: 'partnerInfo eventFleet' }),
    ]);
    const list = parseEventRows(box, 0);
    expect(list).toHaveLength(6);
    expect(list[0]).toMatchObject({ mission: 1, side: 'hostile', back: false, arrival: 500_000, to: { coords: '1:2:3', type: 'moon' } });
    const by = eventsByBody(list, 0, own);
    expect(by.get('1:2:3|m')).toMatchObject({ attack: 500_000, spy: null });
    expect(by.get('1:2:3|p')).toMatchObject({ attack: null, spy: 200_000 });
    expect(by.get('1:5:7|p')).toMatchObject({ attack: 700_000 });
    expect(by.has('4:4:4|p')).toBe(false);
    // Landed already: nothing left to show.
    expect(eventsByBody(list, 800_000, own).size).toBe(0);
  });

  it('counts own fleets once: going out, coming back, and a delivery arriving at another own body', () => {
    const box = document.createElement('div');
    box.innerHTML = table([
      // Two expeditions from the planet: one still going (both rows), one on its way back.
      row({ mission: 15, side: 'friendly', at: 100, from: '1:2:3', to: '1:2:16', ships: 50 }),
      row({ mission: 15, side: 'friendly', back: true, at: 900, from: '1:2:3', to: '1:2:16', ships: 50 }),
      row({ mission: 15, side: 'friendly', back: true, at: 400, from: '1:2:3', to: '1:2:16', ships: 50 }),
      // Transport planet → own moon, and its return.
      row({ mission: 3, side: 'friendly', at: 150, from: '1:2:3', to: '1:2:3', toType: 'moon', ships: 20 }),
      row({ mission: 3, side: 'friendly', back: true, at: 300, from: '1:2:3', to: '1:2:3', toType: 'moon', ships: 20 }),
      // Another player's transport to the planet: neutral, not the player's own.
      row({ mission: 3, side: 'neutral', at: 150, from: '8:8:8', to: '1:2:3' }),
    ]);
    const by = eventsByBody(parseEventRows(box, 0), 0, own);
    const p = by.get('1:2:3|p')!.own;
    expect(p).toContainEqual({ mission: 15, way: 'out', count: 1, first: 100_000 });
    expect(p).toContainEqual({ mission: 15, way: 'back', count: 1, first: 400_000 });
    expect(p).toContainEqual({ mission: 3, way: 'out', count: 1, first: 150_000 });
    expect(p).toHaveLength(3);
    expect(by.get('1:2:3|m')!.own).toEqual([{ mission: 3, way: 'in', count: 1, first: 150_000 }]);
    // After the transport delivered: it is on its way back to the planet.
    const later = eventsByBody(parseEventRows(box, 0), 200_000, own);
    expect(later.get('1:2:3|p')!.own).toContainEqual({ mission: 3, way: 'back', count: 1, first: 300_000 });
    expect(later.has('1:2:3|m')).toBe(false);
  });

  it('reads the page table when the game shows it, else once at load through the guard, not again within 10 s', async () => {
    const calls: string[] = [];
    const guard = new NetworkGuard(async (url) => {
      calls.push(url);
      return new Response(table([row({ mission: 1, side: 'hostile', at: 999, from: '9:9:9', to: '1:2:3' })]));
    }, 'https://s1-it.ogame.gameforge.com');
    const store = new Store(new MemoryStore(), 'ev');
    const doc = document.implementation.createHTMLDocument();
    let now = 1_000;
    const deps = { guard, store, doc, offset: 0, now: () => now };
    const first = await loadEventsOnPageLoad(deps);
    expect(calls).toEqual([EVENT_LIST_PATH]);
    expect(first.list).toHaveLength(1);
    now += 5_000;
    await loadEventsOnPageLoad(deps);
    expect(calls).toHaveLength(1);
    // The game's own table on the page: read from it, no call.
    doc.body.innerHTML = table([row({ mission: 6, side: 'hostile', at: 999, from: '9:9:9', to: '1:2:3' })]);
    now += 60_000;
    const fromPage = await loadEventsOnPageLoad(deps);
    expect(calls).toHaveLength(1);
    expect(fromPage.list[0]!.mission).toBe(6);
    expect(store.get<Events | null>(EVENTS_KEY, null)!.list[0]!.mission).toBe(6);
    // After the page has loaded, no background call passes.
    doc.body.innerHTML = '';
    guard.closePageLoadWindow();
    now += 60_000;
    await expect(loadEventsOnPageLoad(deps)).rejects.toThrow(/page has finished loading/);
  });
});

describe('the real event table (OGame v12)', () => {
  it('reads every row of a saved page: 14 expeditions from moons count once each, going out', () => {
    const box = document.createElement('div');
    box.innerHTML = EVENT_LIST_V12;
    const list = parseEventRows(box, 0);
    expect(list).toHaveLength(28);
    expect(list[0]).toEqual({ mission: 15, side: 'own', back: false, arrival: 1782732081000, from: { coords: '1:234:8', type: 'moon' }, to: { coords: '1:234:16', type: 'planet' }, ships: 8691 });
    const by = eventsByBody(list, 0, new Set(['1:234:8|m', '5:185:7|m']));
    expect(by.get('1:234:8|m')!.own).toEqual([{ mission: 15, way: 'out', count: 1, first: 1782732081000 }]);
    expect(by.get('5:185:7|m')!.own).toHaveLength(1);
    // Not the player's body in this test: not listed.
    expect(by.size).toBe(2);
  });
});
