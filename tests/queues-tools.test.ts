import { beforeEach, describe, expect, it } from 'vitest';
import { activeItems, loadQueuesOnPageLoad, parseProductionQueue, QUEUES_KEY } from '../src/data/queues';
import { amortizationPlan, DEFAULT_RATES, inMetal, mineBase } from '../src/engines/roi';
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

  it('draws one dot per running kind in the planet menu', () => {
    const queues = parseProductionQueue(QUEUE_HTML, [1, 2, 3], 0);
    renderPlanetMenu({
      doc: document, entries: readPlanetList(document), snapshot: SNAPSHOT, queues,
      settings: { mode: 'side', showTotals: true }, now: 1_000_000, locale: 'it',
      t: translator('it'), onSync: async () => true,
    });
    const stripes = document.querySelectorAll('#planet-1 a.planetlink .fut-q');
    expect(Array.from(stripes).map((s) => s.className)).toEqual(['fut-q fut-q-building', 'fut-q fut-q-ship']);
    expect(document.querySelector('#planet-1 a.planetlink .fut-queue')?.getAttribute('title')).toContain('Miniera di metallo → 45');
  });
});

describe('amortizations (InfoCompte)', () => {
  it('uses the mine formula with position, temperature and speed', () => {
    expect(mineBase('metal', 10, 8, 0, 1)).toBe(1050);
    expect(mineBase('crystal', 10, 1, 0, 1)).toBe(726);
    expect(mineBase('deuterium', 10, 15, 0, 1)).toBe(373);
    expect(mineBase('metal', 10, 8, 0, 4)).toBe(4201);
    expect(inMetal({ metal: 3, crystal: 2, deuterium: 1 }, DEFAULT_RATES)).toBe(9);
  });

  const plan = (production: { metal: number; crystal: number; deuterium: number }, researches: Record<string, number> = {}) =>
    amortizationPlan({
      snapshot: { ...SNAPSHOT, researches, bodies: [body({ id: 1, type: 'planet', coords: '1:2:8', production, levels: { '1': 30, '2': 26, '3': 20 } })] },
      planets: [{ id: 1, name: 'Casa', coords: '1:2:8', maxTemp: 20 }],
      speed: 1,
      steps: 6,
    });

  const real = () => ({ metal: 30 + mineBase('metal', 30, 8, 20, 1) * 3, crystal: 15 + mineBase('crystal', 26, 8, 20, 1), deuterium: mineBase('deuterium', 20, 8, 20, 1) });

  it('gives a build order: each step is applied before the next one is chosen', () => {
    const steps = plan(real(), { '122': 20, '124': 9 });
    expect(steps.length).toBe(6);
    // From astrophysics 9 the next slot is at 11, then 13.
    expect(steps.filter((s) => s.kind === 'astro').map((s) => [s.from, s.to]).slice(0, 2)).toEqual([[9, 11], [11, 13]]);
    const deut = steps.filter((s) => s.kind === 'mine' && s.mine === 'deuterium');
    for (let i = 1; i < deut.length; i++) expect(deut[i]!.from).toBe(deut[i - 1]!.to);
    for (let i = 1; i < steps.length; i++) expect(steps[i]!.days).toBeGreaterThan(0);
  });

  it('weighs plasma against the mines', () => {
    const steps = plan(real(), { '122': 0, '124': 30 });
    // Plasma 1 costs 2.000 / 4.000 / 4.000: it pays back long before a level 31 metal mine.
    expect(steps[0]).toMatchObject({ kind: 'plasma', from: 0, to: 1 });
    expect(steps[1]).toMatchObject({ kind: 'plasma', from: 1, to: 2 });
  });
});

describe('idle from queues', () => {
  it('uses the production queue when known', () => {
    const queues = parseProductionQueue(QUEUE_HTML, [1, 2, 3], 0);
    const rows = bodyRows(SNAPSHOT, readPlanetList(document), 1_000_000, queues);
    expect(rows.find((r) => r.id === 1)?.idle).toBe(false);
  });
});
