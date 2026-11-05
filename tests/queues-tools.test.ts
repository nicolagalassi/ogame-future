import { beforeEach, describe, expect, it } from 'vitest';
import { activeItems, loadQueuesOnPageLoad, parseProductionQueue, QUEUES_KEY } from '../src/data/queues';
import { bestUpgrades, mineCost, mineGainRatio } from '../src/engines/roi';
import { bodyRows } from '../src/engines/account';
import { readPlanetList } from '../src/data/planet-list';
import { renderPlanetMenu } from '../src/modules/planet-menu';
import { translator } from '../src/core/i18n';
import { MemoryStore, Store } from '../src/core/storage';
import { NetworkGuard } from '../src/core/guard';
import { body, PLANET_LIST_HTML, SNAPSHOT } from './fixtures';

const QUEUE_HTML = `
<div class="productionDetails"><span class="productionName">Miniera di metallo <span class="productionLevel">45</span></span>
  <time class="building1" data-end="2000"></time></div>
<div class="productionDetails"><span class="productionName">Laser leggero</span><time class="ship1" data-end="1500"></time></div>
<div class="productionDetails"><span class="productionName">Hangar del deuterio <span class="productionLevel">12</span></span>
  <time class="building2" data-end="900"></time></div>`;

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = PLANET_LIST_HTML;
});

describe('production queue', () => {
  it('parses each body and kind with name, level and end', () => {
    const q = parseProductionQueue(QUEUE_HTML, [1, 2, 3], 0);
    expect(q.bodies['1']).toEqual([
      { kind: 'building', name: 'Miniera di metallo', level: 45, end: 2_000_000 },
      { kind: 'ship', name: 'Laser leggero', level: 0, end: 1_500_000 },
    ]);
    expect(q.bodies['3']).toEqual([]);
    expect(activeItems(q.bodies['2'], 1_000_000)).toEqual([]); // already finished
  });

  it('reads at page load but not again within a minute, and never sends cp', async () => {
    const calls: string[] = [];
    const guard = new NetworkGuard(async (url) => {
      calls.push(String(url));
      return new Response(QUEUE_HTML);
    }, 'https://s1-it.ogame.gameforge.com');
    const store = new Store(new MemoryStore(), 'ns');
    await loadQueuesOnPageLoad({ guard, store, ids: [1], now: () => 0 });
    await loadQueuesOnPageLoad({ guard, store, ids: [1], now: () => 30_000 });
    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toContain('cp=');
    expect(store.get(QUEUES_KEY, null)).not.toBeNull();
  });

  it('draws one stripe per running kind in the planet menu', () => {
    const queues = parseProductionQueue(QUEUE_HTML, [1, 2, 3], 0);
    renderPlanetMenu({
      doc: document, entries: readPlanetList(document), snapshot: SNAPSHOT, queues,
      settings: { mode: 'side', showTotals: true, markIdle: false }, now: 1_000_000, locale: 'it',
      t: translator('it'), onSettingsChange: () => {}, onSync: async () => {},
    });
    const stripes = document.querySelectorAll('#planet-1 a.planetlink .fut-q');
    expect(Array.from(stripes).map((s) => s.className)).toEqual(['fut-q fut-q-building', 'fut-q fut-q-ship']);
    expect(document.querySelector('#planet-1 a.planetlink .fut-queue')?.getAttribute('title')).toContain('Miniera di metallo → 45');
  });
});

describe('mine advisor', () => {
  it('uses the OGame cost and production formulas', () => {
    expect(mineCost('metal', 0)).toEqual({ metal: 60, crystal: 15, deuterium: 0 });
    expect(mineCost('crystal', 1)).toEqual({ metal: 76, crystal: 38, deuterium: 0 });
    expect(mineGainRatio(10)).toBeCloseTo(0.21, 5);
  });

  it('ranks upgrades by days to pay back', () => {
    const snap = { ...SNAPSHOT, bodies: [body({ id: 1, type: 'planet', production: { metal: 100_000, crystal: 1, deuterium: 1 }, levels: { '1': 30, '2': 30, '3': 30 } })] };
    const [first] = bestUpgrades(snap, readPlanetList(document));
    expect(first?.mine).toBe('metal');
    expect(first?.days).toBeGreaterThan(0);
  });
});

describe('idle from queues', () => {
  it('uses the production queue when known', () => {
    const queues = parseProductionQueue(QUEUE_HTML, [1, 2, 3], 0);
    const rows = bodyRows(SNAPSHOT, readPlanetList(document), 1_000_000, queues);
    expect(rows.find((r) => r.id === 1)?.idle).toBe(false);
  });
});
