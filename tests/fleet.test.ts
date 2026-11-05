// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  EMPTY_RESERVE,
  copyProfileToAll,
  parseAmount,
  profileFor,
  resolveTarget,
  resourcesAfterReserve,
  shipsAfterReserve,
  type FleetProfile,
} from '../src/engines/fleet';
import { readFuel, readShipSlots, originCoords, isFleetDispatch } from '../src/data/fleet-page';
import { enableOriginAutofill } from '../src/modules/fleet/index';
import { prepareDeploy, prepareExpedition, prepareTransport } from '../src/modules/fleet/actions';
import { armRepeat, decideRepeat, readRepeatParams, repeatUrl } from '../src/modules/fleet/repeat';
import { DEFAULT_SETTINGS, cargoLoad, cargoShipsFor, expeditionFleet, expeditionMax, expeditionTarget, nextBody } from '../src/engines/fleet';
import type { FleetDispatcher } from '../src/data/fleet-dispatcher';

const reserve = (ships: Record<string, number>, res = { metal: 0, crystal: 0, deuterium: 0 }) => ({ ships, resources: res });

describe('fleet engine', () => {
  it('parses amounts with units and separators', () => {
    expect(parseAmount('1.5M')).toBe(1_500_000);
    expect(parseAmount('250k')).toBe(250_000);
    expect(parseAmount('1.000.000')).toBe(1_000_000);
    expect(parseAmount('2,5g')).toBe(2_500_000_000);
    expect(parseAmount(' 12000 ')).toBe(12000);
    expect(parseAmount('abc')).toBe(0);
    expect(parseAmount('')).toBe(0);
  });

  it('subtracts the ship reserve and never goes below zero', () => {
    expect(shipsAfterReserve({ '203': 5000, '210': 10, '202': 3 }, reserve({ '203': 1000, '202': 5 }))).toEqual({ '203': 4000, '210': 10 });
  });

  it('keeps resource reserve and fuel on the planet', () => {
    const r = resourcesAfterReserve({ metal: 100, crystal: 50.7, deuterium: 1000 }, reserve({}, { metal: 30, crystal: 0, deuterium: 500 }), 200);
    expect(r).toEqual({ metal: 70, crystal: 50, deuterium: 300 });
    expect(resourcesAfterReserve({ metal: 0, crystal: 0, deuterium: 10 }, EMPTY_RESERVE, 50).deuterium).toBe(0);
  });

  it('fills empty galaxy/system with the origin', () => {
    const save = { galaxy: null, system: null, position: 16, type: 2 as const, mission: 8, speed: 10 };
    expect(resolveTarget(save, { galaxy: 5, system: 185 })).toEqual({ galaxy: 5, system: 185, position: 16, type: 2 });
    expect(resolveTarget({ ...save, galaxy: 3, system: 7 }, { galaxy: 5, system: 185 })).toMatchObject({ galaxy: 3, system: 7 });
  });

  it('copies one profile to every body as independent copies', () => {
    const p: FleetProfile = { reserve: reserve({ '203': 10 }), save: null };
    const out = copyProfileToAll({ '1': p }, 1, [1, 2, 3]);
    expect(Object.keys(out)).toEqual(['1', '2', '3']);
    out['2']!.reserve.ships['203'] = 99;
    expect(out['3']!.reserve.ships['203']).toBe(10);
    expect(profileFor({}, 7).save).toBeNull();
  });
});

function fleetPage(): Document {
  document.head.innerHTML = '<meta name="ogame-planet-coordinates" content="5:185:8">';
  document.body.innerHTML = `
    <div id="fleetdispatchcomponent">
      <div id="fleet1"><ul id="technologies">
        <li data-technology="203" aria-label="Cargo grande"><span class="amount" data-value="5000"></span><input></li>
        <li data-technology="210" aria-label="Sonda"><span class="amount" data-value="3"></span><input></li>
      </ul></div>
      <div id="fleet2"><input id="galaxy"><input id="system"><input id="position">
        <input id="metal"><input id="crystal"><input id="deuterium"></div>
      <span id="consumption">4.340 (5%)</span>
      <span id="resources_metal" data-raw="1000.9"></span>
      <span id="resources_crystal" data-raw="500"></span>
      <span id="resources_deuterium" data-raw="10000"></span>
    </div>`;
  return document;
}

describe('fleet page', () => {
  it('reads the page', () => {
    const doc = fleetPage();
    expect(isFleetDispatch(doc)).toBe(true);
    expect(originCoords(doc)).toEqual({ galaxy: 5, system: 185, position: 8 });
    expect(readFuel(doc)).toBe(4340);
    expect(readShipSlots(doc).map((s) => [s.id, s.available])).toEqual([['203', 5000], ['210', 3]]);
  });

  it('typing only the position fills galaxy and system from the origin', () => {
    const doc = fleetPage();
    enableOriginAutofill(doc);
    const p = doc.getElementById('position') as HTMLInputElement;
    const g = doc.getElementById('galaxy') as HTMLInputElement;
    g.value = '3';
    p.value = '16';
    p.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    expect(g.value).toBe('3');
    expect((doc.getElementById('system') as HTMLInputElement).value).toBe('185');
  });
});

describe('fleet engine, round 2', () => {
  const stock = [
    { id: 203, available: 10, capacity: 1000 },
    { id: 202, available: 100, capacity: 100 },
  ];
  it('uses the main cargo ship, then the second one', () => {
    expect(cargoShipsFor(5_000, stock, 203, 202)).toEqual({ 203: 5 });
    expect(cargoShipsFor(12_050, stock, 203, 202)).toEqual({ 203: 10, 202: 21 });
    expect(cargoShipsFor(12_050, stock, 203, 0)).toEqual({ 203: 10 });
    expect(cargoShipsFor(0, stock, 203, 202)).toEqual({});
  });

  it('loads deuterium, crystal, metal within reserve, fuel and room', () => {
    const reserve = { ships: {}, resources: { metal: 0, crystal: 0, deuterium: 100 } };
    expect(cargoLoad({ metal: 500, crystal: 300, deuterium: 400 }, reserve, 50, 600)).toEqual({ metal: 50, crystal: 300, deuterium: 250 });
  });

  it('computes the expedition limit like OGLight', () => {
    expect(expeditionMax({ characterClass: 3, economySpeed: 8, classBooster: 0.5 })).toEqual({ base: 1250, max: 180_000_000 });
    expect(expeditionMax({ topScore: 3_000_000, characterClass: 1, economySpeed: 8, classBooster: 0 }).max).toBe(3_600_000);
    expect(expeditionTarget(1000, '')).toBe(1000);
    expect(expeditionTarget(1000, '50%')).toBe(500);
    expect(expeditionTarget(1000, '2k')).toBe(2000);
  });

  it('picks the best expedition ship and the extras', () => {
    const s = [
      { id: 219, available: 2, capacity: 10_000 },
      { id: 203, available: 500, capacity: 1_000 },
      { id: 210, available: 5, capacity: 0 },
      { id: 218, available: 1, capacity: 10_000 },
    ];
    expect(expeditionFleet(s, { ship: 0, target: 100_000, base: 10, extras: true })).toEqual({ 203: 100, 218: 1, 210: 1, 219: 1 });
    expect(expeditionFleet(s, { ship: 219, target: 10_000, base: 10, extras: false })).toEqual({ 219: 2 });
  });

  it('finds the next body for the repeat', () => {
    const list = [
      { planetId: 1, moonId: 11 },
      { planetId: 2, moonId: null },
      { planetId: 3, moonId: 13 },
    ];
    expect(nextBody(list, 1)).toBe(2);
    expect(nextBody(list, 3)).toBe(1);
    expect(nextBody(list, 11)).toBe(13);
    expect(nextBody(list, 1, { onlyWithMoon: true })).toBe(3);
    expect(nextBody(list, 1, { skip: 2 })).toBe(3);
  });
});

function fakeDispatcher(over: Partial<FleetDispatcher> = {}): FleetDispatcher & { selected: Record<number, number> } {
  const selected: Record<number, number> = {};
  const fd: FleetDispatcher & { selected: Record<number, number> } = {
    selected,
    currentPage: 'fleet1',
    currentPlanet: { galaxy: 5, system: 185, position: 8, type: 1 },
    targetPlanet: { galaxy: 5, system: 185, position: 8, type: 1 },
    shipsOnPlanet: [
      { id: 203, number: 100 },
      { id: 202, number: 50 },
      { id: 210, number: 3 },
    ],
    shipsToSend: [],
    mission: 0,
    speedPercent: 10,
    expeditionTime: 0,
    cargoMetal: 0,
    cargoCrystal: 0,
    cargoDeuterium: 0,
    metalOnPlanet: 150_000,
    crystalOnPlanet: 50_000,
    deuteriumOnPlanet: 20_000,
    fleetCount: 3,
    maxFleetCount: 10,
    expeditionCount: 1,
    maxExpeditionCount: 5,
    fleetHelper: { shipsData: { 203: { cargoCapacity: 2_000 }, 202: { cargoCapacity: 500 }, 210: { cargoCapacity: 0 } } },
    apiDataJson: { characterClassId: 3, bonuses: { characterClassBooster: { 3: 0 } } },
    resetShips() {
      for (const k of Object.keys(selected)) delete selected[Number(k)];
    },
    resetCargo() {
      fd.cargoMetal = fd.cargoCrystal = fd.cargoDeuterium = 0;
    },
    selectShip(id: number, n: number) {
      selected[id] = n;
    },
    getCargoCapacity(): number {
      return Object.entries(selected).reduce((a: number, [id, n]) => a + n * (fd.fleetHelper.shipsData?.[id]?.cargoCapacity ?? 0), 0);
    },
    getConsumption() {
      return 1000;
    },
    refresh() {},
    focusSubmitFleet1() {},
    ...over,
  };
  return fd;
}

describe('fleet actions on the game dispatcher', () => {
  const reserve = { ships: { '203': 10 }, resources: { metal: 0, crystal: 0, deuterium: 5_000 } };
  const profile = { reserve, save: null };

  it('empties a planet to a target with main + second ship, keeping reserves', () => {
    const doc = fleetPage();
    const fd = fakeDispatcher();
    const r = prepareTransport(fd, doc, profile, DEFAULT_SETTINGS, { galaxy: 5, system: 185, position: 8, type: 3 });
    // 215,000 to move (deut minus 5,000 reserve): 90 large (180k) + 50 small (25k) = 205k room
    expect(fd.selected).toEqual({ 203: 90, 202: 50 });
    expect(fd.mission).toBe(3);
    expect(fd.targetPlanet.type).toBe(3);
    expect(fd.speedPercent).toBe(10);
    expect(fd.cargoDeuterium).toBe(14_000);
    expect(fd.cargoCrystal).toBe(50_000);
    expect(fd.cargoMetal).toBe(141_000);
    expect(r).toMatchObject({ ok: true, ships: 140, cargo: 205_000 });
  });

  it('deploys every ship minus the reserve', () => {
    const fd = fakeDispatcher();
    prepareDeploy(fd, fleetPage(), profile, { ...DEFAULT_SETTINGS, transportSpeed: 50 }, { galaxy: 1, system: 2, position: 3, type: 3 });
    expect(fd.selected).toEqual({ 203: 90, 202: 50, 210: 3 });
    expect(fd.mission).toBe(4);
    expect(fd.speedPercent).toBe(5);
    expect((document.getElementById('galaxy') as HTMLInputElement).value).toBe('1');
  });

  it('prepares an expedition to position 16', () => {
    const fd = fakeDispatcher();
    const r = prepareExpedition(fd, fleetPage(), { reserve: { ships: {}, resources: reserve.resources }, save: null }, { ...DEFAULT_SETTINGS, expeditionValue: '100k' }, { economySpeed: 1 });
    expect(r.target).toBe(100_000);
    expect(fd.selected).toEqual({ 203: 50, 210: 1 });
    expect(fd.targetPlanet).toMatchObject({ galaxy: 5, system: 185, position: 16 });
    expect(fd.mission).toBe(15);
    expect(fd.expeditionTime).toBe(1);
  });

  it('refuses an expedition without free slots', () => {
    const fd = fakeDispatcher({ expeditionCount: 5 });
    expect(prepareExpedition(fd, fleetPage(), profile, DEFAULT_SETTINGS, { economySpeed: 1 }).reason).toBe('fleet.err.noExpSlots');
  });
});

describe('repeat', () => {
  const list = [
    { planetId: 1, moonId: 11 },
    { planetId: 2, moonId: 12 },
  ];
  it('round-trips the URL state', () => {
    const url = repeatUrl('https://s1-it.ogame.gameforge.com/game/index.php?page=ingame&component=overview', 2, { mode: 'transport', first: 1, dest: 12 });
    expect(url).toContain('cp=2');
    expect(readRepeatParams(url)).toEqual({ mode: 'transport', first: 1, dest: 12 });
    expect(readRepeatParams('https://x.test/game/index.php?page=ingame')).toBeNull();
  });

  it('moves on only after a successful send from the same body', () => {
    armRepeat({ mode: 'expedition', first: 1, dest: null }, 1, 3, 1000);
    expect(decideRepeat({ bodyId: 1, fleetCount: 3, list, now: 2000 }).kind).toBe('none');
    armRepeat({ mode: 'expedition', first: 1, dest: null }, 1, 3, 1000);
    expect(decideRepeat({ bodyId: 1, fleetCount: 4, list, now: 2000 })).toEqual({ kind: 'next', cp: 2, state: { mode: 'expedition', first: 1, dest: null } });
    armRepeat({ mode: 'expedition', first: 1, dest: null }, 2, 4, 1000);
    expect(decideRepeat({ bodyId: 2, fleetCount: 5, list, now: 2000 }).kind).toBe('done');
    armRepeat({ mode: 'expedition', first: 1, dest: null }, 1, 3, 1000);
    expect(decideRepeat({ bodyId: 1, fleetCount: 4, list, now: 120_000 }).kind).toBe('none');
  });
});
