import { beforeEach, describe, expect, it } from 'vitest';
import { activeItems, loadQueuesOnPageLoad, parseProductionQueue, QUEUES_KEY } from '../src/data/queues';
import { amortizationPlan, DEFAULT_RATES, inMetal, mineBase } from '../src/engines/roi';
import { readLfLevels } from '../src/data/lf-production';
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

  const rocktal = (levels: Record<string, number>, researches: Record<string, number> = { '122': 30, '124': 9 }) =>
    ({ ...SNAPSHOT, researches, bodies: [body({ id: 1, type: 'planet', coords: '1:2:8', species: 2, production: { metal: 30 + mineBase('metal', 30, 8, 20, 1), crystal: 15 + mineBase('crystal', 26, 8, 20, 1), deuterium: mineBase('deuterium', 20, 8, 20, 1) }, levels: { '1': 30, '2': 26, '3': 20, ...levels } })] });
  const planets = [{ id: 1, name: 'Casa', coords: '1:2:8', maxTemp: 20 }];

  it('counts the lifeform buildings that raise production, and the Rock\'tal discount on mines', () => {
    const first = (lfLocked = {}) => amortizationPlan({ snapshot: rocktal({ '12106': 0 }), planets, speed: 1, steps: 1, lfLocked })[0];
    // Magma forge (12106): +2% metal per level, cheap at level 1, comes first once the buildings page shows it open.
    expect(first({ '1': { b: [] } })).toMatchObject({ kind: 'lfBuilding', id: 12106, from: 0, to: 1, planetId: 1 });
    // Level 0 on a page never opened, or locked by its requirements: not offered.
    expect(first()?.id).not.toBe(12106);
    expect(first({ '1': { b: [12106] } })?.id).not.toBe(12106);
    expect(amortizationPlan({ snapshot: rocktal({ '12106': 3 }), planets, speed: 1, steps: 1 })[0]).toMatchObject({ id: 12106, from: 3 });
    const metal = (d: Record<string, number>) => amortizationPlan({ snapshot: rocktal(d), planets, speed: 1, steps: 40 }).find((s) => s.kind === 'mine' && s.id === 1)!;
    // 12111 level 20 = 10% off the mines.
    expect(metal({ '12111': 20 }).cost.metal).toBe(Math.floor(metal({}).cost.metal * 0.9));
  });

  it('counts active lifeform research for the whole account, strengthened by its boosters', () => {
    // Everything else expensive (astrophysics 30, plasma 30, lifeform buildings 60): the research comes first.
    const plan = (levels: Record<string, number>, lfLevels = {}) =>
      amortizationPlan({ snapshot: rocktal({ '1': 45, '2': 40, '3': 40, '12106': 60, '12109': 60, '12110': 60, ...levels }, { '122': 30, '124': 30 }), planets, speed: 1, steps: 1, lfSlots: { '1': [12205] }, lfLevels })[0]!;
    const plain = plan({ '12205': 10 });
    expect(plain).toMatchObject({ kind: 'lfResearch', id: 12205, from: 10, to: 11, guessed: false });
    expect(plain.gain.metal).toBeCloseTo(0.0008 * mineBase('metal', 45, 8, 20, 1), 3);
    // Rock'tal at level 100 (+10%): the same level gives 10% more.
    expect(plan({ '12205': 10 }, { '2': 0.1 }).gain.metal).toBeCloseTo(plain.gain.metal * 1.1, 3);
  });

  it('leaves out the kinds switched off, as InfoCompte\'s settings', () => {
    const kinds = (exclude: Parameters<typeof amortizationPlan>[0]['exclude']) =>
      new Set(amortizationPlan({ snapshot: rocktal({ '12106': 3 }), planets, speed: 1, steps: 30, exclude }).map((s) => (s.kind === 'mine' ? s.mine : s.kind)));
    expect(kinds([]).has('lfBuilding')).toBe(true);
    const without = kinds(['lfBuilding', 'lfResearch', 'astro']);
    expect([...without].some((k) => k === 'lfBuilding' || k === 'lfResearch' || k === 'astro')).toBe(false);
    expect(without.size).toBeGreaterThan(0);
  });

  it('reads the species bonus on the lifeform settings page', () => {
    history.replaceState(null, '', '/game/index.php?page=ingame&component=lfsettings');
    document.body.innerHTML = `
      <div class="lifeform-item"><span class="lifeform-item-icon lifeform2"></span><div class="lifeform-item-wrapper"><p>…</p><p>Con questa forma di vita hai raggiunto il livello massimo.</p><p>Bonus Tecnologia Forme di vita: 10%</p></div></div>
      <div class="lifeform-item"><span class="lifeform-item-icon lifeform3"></span><div class="lifeform-item-wrapper"><p>…</p><p>Livello 45</p><p>Bonus Tecnologia Forme di vita: 4,5%</p></div></div>`;
    expect(readLfLevels(document)).toEqual({ '2': 0.1, '3': 0.045 });
    history.replaceState(null, '', '/');
    expect(readLfLevels(document)).toBeNull();
  });
});

describe('idle from queues', () => {
  it('uses the production queue when known', () => {
    const queues = parseProductionQueue(QUEUE_HTML, [1, 2, 3], 0);
    const rows = bodyRows(SNAPSHOT, readPlanetList(document), 1_000_000, queues);
    expect(rows.find((r) => r.id === 1)?.idle).toBe(false);
  });
});
