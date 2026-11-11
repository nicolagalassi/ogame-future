// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  EMPTY_RESERVE,
  activeProfile,
  copySections,
  sameSection,
  sectionEmpty,
  settingsFrom,
  parseAmount,
  profileFor,
  resolveTarget,
  resourcesAfterReserve,
  shipsAfterReserve,
  type FleetProfile,
} from '../src/engines/fleet';
import { readFuel, readShipSlots, originCoords, isFleetDispatch } from '../src/data/fleet-page';
import { enableOriginAutofill } from '../src/modules/fleet/index';
import { prepareDelivery, prepareDeploy, prepareExpedition, prepareSend, prepareTransport } from '../src/modules/fleet/actions';
import { applyFood } from '../src/modules/fleet/index';
import { MemoryStore, Store } from '../src/core/storage';
import { hookSend, nextInRound, readRepeatParams, repeatUrl } from '../src/modules/fleet/repeat';
import { DEFAULT_SETTINGS, cargoLoad, cargoShipsFor, expeditionFleet, expeditionMax, expeditionTarget, nextBody, cargoCount, parseCoords, pickedLoad, resolveSend } from '../src/engines/fleet';
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

  it('copies only the chosen rules onto the chosen bodies, as independent copies', () => {
    const save = { galaxy: null, system: null, position: 16, type: 2 as const, mission: 8, speed: 10 };
    const src: FleetProfile = { reserve: reserve({ '203': 10 }, { metal: 5, crystal: 0, deuterium: 0 }), gate: { '214': 1 }, save };
    const other: FleetProfile = { reserve: reserve({ '202': 3 }, { metal: 9, crystal: 9, deuterium: 9 }), gate: {}, save: null };
    const out = copySections({ '1': src, '2': other, '3': other }, 1, [2], ['ships', 'fleetsave']);
    expect(out['2']!.reserve).toEqual(reserve({ '203': 10 }, { metal: 9, crystal: 9, deuterium: 9 }));
    expect(out['2']!.save).toEqual(save);
    expect(out['2']!.gate).toEqual({});
    expect(out['3']).toBe(other);
    out['2']!.reserve.ships['203'] = 99;
    expect(src.reserve.ships['203']).toBe(10);
    expect(profileFor({}, 7).save).toBeNull();
  });

  it('tells where else the same rule is set', () => {
    const a: FleetProfile = { reserve: reserve({ '203': 10, '202': 0 }), save: null };
    const b: FleetProfile = { reserve: reserve({ '203': 10 }, { metal: 1, crystal: 0, deuterium: 0 }), save: null };
    const profiles = { '1': a, '2': b, '3': { reserve: reserve({}), save: null } };
    expect(sameSection(profiles, 1, [1, 2, 3], 'ships')).toEqual([2]);
    expect(sameSection(profiles, 1, [1, 2, 3], 'resources')).toEqual([3]);
    expect(sectionEmpty(profileFor(profiles, 3), 'ships')).toBe(true);
    expect(sectionEmpty(profileFor(profiles, 1), 'fleetsave')).toBe(true);
  });

  it('keeps old saves working: the gate keeps the ships rule until it has its own', () => {
    expect(profileFor({ '1': { reserve: reserve({ '203': 4 }), save: null } }, 1).gate).toEqual({ '203': 4 });
    expect(profileFor({ '1': { reserve: reserve({ '203': 4 }), gate: {}, save: null } }, 1).gate).toEqual({});
    expect(settingsFrom({ reserveOn: false } as never)).toMatchObject({ shipsOn: false, resourcesOn: false, gateOn: true });
    expect(settingsFrom({ reserveOn: false, shipsOn: true } as never).shipsOn).toBe(true);
  });

  it('switches ships and resources apart; the fleetsave ignores the switches', () => {
    const p = profileFor({ '1': { reserve: reserve({ '203': 4 }, { metal: 7, crystal: 0, deuterium: 0 }), saveReserve: reserve({ '202': 1 }), save: null } }, 1);
    const onlyRes = activeProfile(p, { shipsOn: false, resourcesOn: true, gateOn: false });
    expect(onlyRes.reserve).toEqual(reserve({}, { metal: 7, crystal: 0, deuterium: 0 }));
    expect(onlyRes.gate).toEqual({});
    expect(onlyRes.saveReserve).toEqual(reserve({ '202': 1 }));
    expect(activeProfile(p, { shipsOn: true, resourcesOn: false, gateOn: true }).reserve).toEqual(reserve({ '203': 4 }));
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

  it('expeditions ignore the reserve', () => {
    const fd = fakeDispatcher();
    prepareExpedition(fd, fleetPage(), { reserve: { ships: { '203': 100 }, resources: reserve.resources }, save: null }, { ...DEFAULT_SETTINGS, expeditionValue: '100k' }, { economySpeed: 1 });
    expect(fd.selected[203]).toBe(50);
  });

  it('brings only what the plan still needs, within the reserve', () => {
    const fd = fakeDispatcher();
    const r = prepareDelivery(fd, fleetPage(), profile, DEFAULT_SETTINGS, { galaxy: 1, system: 2, position: 3, type: 1 }, { metal: 30_000, crystal: 0, deuterium: 100_000 });
    // Deuterium: 20,000 here − 5,000 reserve − 1,000 fuel = 14,000.
    expect(fd.cargoDeuterium).toBe(14_000);
    expect(fd.cargoMetal).toBe(30_000);
    expect(fd.cargoCrystal).toBe(0);
    expect(fd.mission).toBe(3);
    expect(r.ok).toBe(true);
    expect(fd.selected).toEqual({ 203: 23 });
  });

  it('ignore food hides it from the game and gives it back', () => {
    const store = new Store(new MemoryStore(), 'x');
    const fd = fakeDispatcher() as FleetDispatcher & { foodOnPlanet?: number; cargoFood?: number };
    fd.foodOnPlanet = 900;
    fd.cargoFood = 100;
    store.set('fleet.settings', { ignoreFood: true });
    applyFood(store, fd);
    expect(fd.foodOnPlanet).toBe(0);
    expect(fd.cargoFood).toBe(0);
    store.set('fleet.settings', { ignoreFood: false });
    applyFood(store, fd);
    expect(fd.foodOnPlanet).toBe(900);
  });

  it('prepares an expedition even when every slot is busy', () => {
    const fd = fakeDispatcher({ expeditionCount: 5 });
    expect(prepareExpedition(fd, fleetPage(), profile, DEFAULT_SETTINGS, { economySpeed: 1 }).ok).toBe(true);
  });
});

describe('repeat', () => {
  const list = [
    { planetId: 1, moonId: 11 },
    { planetId: 2, moonId: 12 },
  ];
  it('round-trips the URL state', () => {
    const url = repeatUrl('https://s1-it.ogame.gameforge.com/game/index.php?page=ingame&component=overview', 2, { mode: 'collect', first: 1, dest: 12 });
    expect(url).toContain('cp=2');
    expect(readRepeatParams(url)).toEqual({ mode: 'collect', first: 1, dest: 12 });
    expect(readRepeatParams('https://x.test/game/index.php?page=ingame')).toBeNull();
  });

  it('goes round the bodies and stops at the first one', () => {
    expect(nextInRound({ mode: 'expedition', first: 1, dest: null }, 1, list)).toBe(2);
    expect(nextInRound({ mode: 'expedition', first: 1, dest: null }, 2, list)).toBeNull();
    expect(nextInRound({ mode: 'collect', first: 11, dest: 12 }, 11, list)).toBeNull();
    expect(nextInRound({ mode: 'moon', first: 2, dest: null }, 2, list)).toBe(1);
  });

  it('hooks the game send and takes over only on success', () => {
    const calls: string[] = [];
    let reply = '{"success":true}';
    (window as unknown as { $: unknown }).$ = {
      post(url: string, _p: unknown, cb: (r: string) => void) {
        calls.push('post ' + url);
        cb(reply);
      },
    };
    const fd = fakeDispatcher() as unknown as FleetDispatcher & { submitFleet2: () => void; sendFleetUrl: string };
    fd.sendFleetUrl = 'send';
    fd.submitFleet2 = () => (window as unknown as { $: { post: (u: string, p: unknown, cb: (r: string) => void) => void } }).$.post('send', {}, () => calls.push('game callback'));
    let takeOver = true;
    hookSend(fd, () => takeOver);
    fd.submitFleet2();
    expect(calls).toEqual(['post send']);
    takeOver = false;
    fd.submitFleet2();
    reply = '{"success":false}';
    takeOver = true;
    fd.submitFleet2();
    expect(calls).toEqual(['post send', 'post send', 'game callback', 'post send', 'game callback']);
  });
});

describe('fleetsave reserve', () => {
  it('fleetsave keeps reserve 2, not reserve 1', async () => {
    const { prepareFleetsave } = await import('../src/modules/fleet/actions');
    const fd = fakeDispatcher();
    const save = { galaxy: null, system: null, position: 16, type: 1 as const, mission: 6, speed: 100 };
    prepareFleetsave(fd, fleetPage(), { reserve: { ships: { '203': 50 }, resources: { metal: 0, crystal: 0, deuterium: 0 } }, saveReserve: { ships: { '202': 10 }, resources: { metal: 0, crystal: 0, deuterium: 0 } }, save }, save);
    expect(fd.selected).toEqual({ 203: 100, 202: 40, 210: 3 });
    const fd2 = fakeDispatcher();
    prepareFleetsave(fd2, fleetPage(), { reserve: { ships: { '203': 50 }, resources: { metal: 0, crystal: 0, deuterium: 0 } }, save }, save);
    expect(fd2.selected).toEqual({ 203: 100, 202: 50, 210: 3 });
  });
});

describe('shortcuts, last fleet and jump gate', () => {
  it('runs a key once, not while typing nor with modifiers', async () => {
    const { registerActions, resetShortcuts, switchBodyUrl } = await import('../src/modules/shortcuts');
    resetShortcuts();
    let n = 0;
    document.body.innerHTML = '<input id="f">';
    registerActions(document, new Store(new MemoryStore(), 'k'), (k) => k, { 'planet.next': () => n++ });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'o' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'O', ctrlKey: true }));
    (document.getElementById('f') as HTMLInputElement).focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'o' }));
    expect(n).toBe(1);
    expect(switchBodyUrl('https://s1.test/game/index.php?page=ingame&component=fleetdispatch&cp=1&futmode=moon', 2)).toBe(
      'https://s1.test/game/index.php?page=ingame&component=fleetdispatch&cp=2',
    );
    expect(nextBody([{ planetId: 1, moonId: null }, { planetId: 2, moonId: null }, { planetId: 3, moonId: null }], 1, { backwards: true })).toBe(3);
  });

  it('lets the player change keys: a taken key moves, fixed keys stay, the default comes back', async () => {
    const { assignKey, keymap, resetKeys, registerActions, resetShortcuts } = await import('../src/modules/shortcuts');
    resetShortcuts();
    const store = new Store(new MemoryStore(), 'keys');
    expect(keymap(store).get('fleet.transport')).toBe('t');
    // T goes to Expedition: Transport loses it.
    expect(assignKey(store, 'fleet.expedition', 'T')).toBe('fleet.transport');
    expect(keymap(store).get('fleet.expedition')).toBe('t');
    expect(keymap(store).get('fleet.transport')).toBeNull();
    expect(keymap(store).get('galaxy.up')).toBe('ArrowUp');
    let ran = '';
    document.body.innerHTML = '';
    registerActions(document, store, (k) => k, { 'fleet.expedition': () => (ran = 'x'), 'fleet.transport': () => (ran = 't') });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 't' }));
    expect(ran).toBe('x');
    resetKeys(store);
    expect(keymap(store).get('fleet.transport')).toBe('t');
  });

  it('touch bar: this page\'s actions and the game\'s own Avanti / Invia', async () => {
    const { registerActions, resetShortcuts, TOUCH_KEY, TOUCH_ID } = await import('../src/modules/shortcuts');
    resetShortcuts();
    const store = new Store(new MemoryStore(), 'touch');
    document.body.innerHTML = '<div id="fleetdispatchcomponent"><div id="fleet1"><a id="continueToFleet2" class="on"></a></div><div id="fleet2" style="display:none"><a id="sendFleet"></a></div></div>';
    let pressed = '';
    document.getElementById('continueToFleet2')!.addEventListener('click', () => (pressed = 'avanti'));
    document.getElementById('sendFleet')!.addEventListener('click', () => (pressed = 'invia'));
    store.set(TOUCH_KEY, 'off');
    registerActions(document, store, (k) => k, { 'planet.next': () => {} });
    await Promise.resolve();
    expect(document.getElementById(TOUCH_ID)).toBeNull();
    store.set(TOUCH_KEY, 'on');
    registerActions(document, store, (k) => k, { 'fleet.last': () => (pressed = 'all') });
    await Promise.resolve();
    const bar = document.getElementById(TOUCH_ID)!;
    expect([...bar.querySelectorAll('.keys button')].map((b) => b.getAttribute('aria-label'))).toEqual(['shortcut.next', 'fleet.btn.last']);
    (bar.querySelector('.keys button:last-child') as HTMLButtonElement).click();
    expect(pressed).toBe('all');
    const send = bar.querySelector<HTMLButtonElement>('.send')!;
    expect(send.textContent).toBe('touch.next');
    send.click();
    expect(pressed).toBe('avanti');
    document.getElementById('fleet1')!.style.display = 'none';
    send.click();
    expect(pressed).toBe('invia');
  });

  it('repeats the last fleet within the reserve', async () => {
    const { prepareLast, snapshotFleet } = await import('../src/modules/fleet/actions');
    const fd = fakeDispatcher();
    prepareLast(fd, fleetPage(), { reserve: { ships: { '203': 90 }, resources: { metal: 0, crystal: 0, deuterium: 0 } }, save: null }, {
      ships: { '203': 20, '202': 5 },
      target: { galaxy: 1, system: 2, position: 3, type: 1 },
      mission: 3,
      speed: 50,
    });
    expect(fd.selected).toEqual({ 203: 10, 202: 5 });
    expect(fd.mission).toBe(3);
    fd.shipsToSend = [{ id: 203, number: 10 }];
    expect(snapshotFleet(fd)).toMatchObject({ ships: { '203': 10 }, mission: 3, speed: 50 });
  });

  it('keeps the gate rule in the jump gate dialog', async () => {
    const { applyJumpgateReserve } = await import('../src/modules/fleet/jumpgate');
    document.body.innerHTML = `<div id="jumpgate"><form id="jumpgateForm"><table>
      <tr><td><a></a><span class="quantity"></span></td></tr><tr class="ship_input_row"><td><input id="ship_203" rel="100" value="100"></td></tr>
      <tr class="tdInactive"><td></td></tr><tr class="ship_input_row"><td><input id="ship_202" rel="0"></td></tr>
    </table><a id="sendall"></a></form></div>`;
    const store = new Map<string, unknown>([['fleet.profiles', { '7': { reserve: { ships: { '203': 30 }, resources: { metal: 0, crystal: 0, deuterium: 0 } }, save: null } }]]);
    const s = { get: <T,>(k: string, d: T) => (store.has(k) ? (store.get(k) as T) : d), set: (k: string, v: unknown) => void store.set(k, v) };
    expect(applyJumpgateReserve(document, s as never, 7, (k) => k)).toBe(30);
    expect(applyJumpgateReserve(document, s as never, 7, (k) => k)).toBe(30);
    const input = document.getElementById('ship_203') as HTMLInputElement;
    expect(input.getAttribute('rel')).toBe('70');
    expect(input.value).toBe('70');
    expect(document.getElementById('sendall')!.getAttribute('onclick')).toBe('setMaxIntInput("#jumpgateForm", {"203":70})');
    // The switch in the dialog turns the gate rule off and gives the ships back.
    (document.querySelector('.fut-jgbar button') as HTMLButtonElement).click();
    expect(input.getAttribute('rel')).toBe('100');
    expect((store.get('fleet.settings') as { gateOn: boolean }).gateOn).toBe(false);
    // The pen opens the rule on the ship rows: a new number is saved and applied at once.
    (document.querySelector('.fut-jgbar button') as HTMLButtonElement).click();
    document.querySelectorAll<HTMLButtonElement>('.fut-jgbar button')[1]!.click();
    const field = document.querySelector<HTMLInputElement>('.fut-jgkeep input')!;
    expect(field.value).toBe('30');
    field.value = '45';
    field.dispatchEvent(new Event('change'));
    expect((store.get('fleet.profiles') as Record<string, { gate: Record<string, number> }>)['7']!.gate).toEqual({ '203': 45 });
    expect(input.getAttribute('rel')).toBe('55');
    document.querySelectorAll<HTMLButtonElement>('.fut-jgbar button')[1]!.click();
    expect(document.querySelector('.fut-jgkeep input')).toBeNull();
  });
});

describe('whole numbers in the game form', () => {
  it('never loads fractions, also from estimated stocks', async () => {
    const { deliveryLoad, cargoLoad } = await import('../src/engines/fleet');
    const none = { ships: {}, resources: { metal: 0, crystal: 0, deuterium: 0 } };
    const d = deliveryLoad({ metal: 5e6, crystal: 5e6, deuterium: 5e6 }, none, 0, 1e9, { metal: 2821979.574679, crystal: 10.5, deuterium: 0.2 });
    expect([d.metal, d.crystal, d.deuterium].every(Number.isInteger)).toBe(true);
    expect(d.metal).toBe(2821980);
    const c = cargoLoad({ metal: 10.7, crystal: 3.2, deuterium: 9.9 }, none, 0, 100);
    expect([c.metal, c.crystal, c.deuterium].every(Number.isInteger)).toBe(true);
  });
});

describe('rules window', () => {
  it('shows where each rule stands and copies only the chosen rules onto the chosen bodies', async () => {
    const { renderFleetTools } = await import('../src/modules/fleet/index');
    const doc = fleetPage();
    const store = new Store(new MemoryStore(), 'x');
    const same = { reserve: reserve({ '203': 10 }), save: null };
    store.set('fleet.profiles', { '1': same, '2': same, '3': { reserve: reserve({}), save: null } });
    store.set('fleet.settings', { resourcesOn: false });
    const bodies = [
      { planetId: 1, moonId: 11, name: 'Casa', coords: '5:185:8' },
      { planetId: 2, moonId: null, name: 'Colonia', coords: '5:186:8' },
      { planetId: 3, moonId: null, name: 'Terza', coords: '5:187:8' },
    ];
    renderFleetTools({ doc, store, bodyId: 1, bodies, t: (k, v) => (v ? `${k}:${Object.values(v).join('|')}` : k), locale: 'it', href: 'https://x/game/index.php?page=ingame&component=fleetdispatch' });
    (doc.querySelector('.fut-frules-open') as HTMLButtonElement).click();
    const root = doc.getElementById('fut-fleet-modal')!.shadowRoot!;
    const badges = [...root.querySelectorAll('.fut-fbadge')].map((b) => b.textContent);
    expect(badges[0]).toBe('fleet.rule.on · fleet.rule.alsoOn:Colonia');
    expect(badges[1]).toBe('fleet.rule.empty');
    // Copy the ships rule onto Terza only.
    const copy = root.querySelector('.fut-fcopy')!;
    const checks = [...copy.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
    const labels = [...copy.querySelectorAll('.fut-fcheck')].map((l) => l.textContent);
    checks.forEach((c, i) => (c.checked = labels[i] === 'fleet.rule.ships' || labels[i]!.startsWith('Terza')));
    (copy.querySelector('.fut-factions:last-child button') as HTMLButtonElement).click();
    const profiles = store.get<Record<string, FleetProfile>>('fleet.profiles', {});
    expect(profiles['3']!.reserve.ships).toEqual({ '203': 10 });
    expect(profiles['11']).toBeUndefined();
    expect(root.querySelector('.fut-fbadge')!.textContent).toBe('fleet.rule.on · fleet.rule.alsoOn:Colonia, Terza');
  });
});

describe('plain Trasporto / Schiera', () => {
  it('reads coordinates and loads what was picked, within fuel and room, without reserves', () => {
    expect(parseCoords('1:234:5')).toEqual([1, 234, 5]);
    expect(parseCoords('[4:12:16]')).toEqual([4, 12, 16]);
    expect(parseCoords('4 12 6')).toEqual([4, 12, 6]);
    expect(parseCoords('4:12')).toBeNull();
    const here = { metal: 100, crystal: 50, deuterium: 30 };
    // Empty = none; a number is capped by what is here (deuterium keeps the fuel) and by the room.
    expect(pickedLoad(here, { metal: null, crystal: null, deuterium: null }, 10, 1_000)).toEqual({ metal: 0, crystal: 0, deuterium: 0 });
    expect(pickedLoad(here, { metal: 40, crystal: null, deuterium: 99 }, 10, 1_000)).toEqual({ metal: 40, crystal: 0, deuterium: 20 });
    expect(pickedLoad(here, { metal: 100, crystal: 50, deuterium: 30 }, 10, 60)).toEqual({ metal: 0, crystal: 40, deuterium: 20 });
  });

  it('transport: as many CP or CL as the picked resources need, no reserve', () => {
    const target = { galaxy: 1, system: 2, position: 3, type: 1 };
    const pick = { metal: 100_000, crystal: 50_000, deuterium: null };
    const fd = fakeDispatcher();
    const r = prepareSend(fd, fleetPage(), DEFAULT_SETTINGS, target, pick, 'transport', 203);
    expect(fd.selected).toEqual({ 203: 75 });
    expect(fd.mission).toBe(3);
    expect([fd.cargoMetal, fd.cargoCrystal, fd.cargoDeuterium]).toEqual([100_000, 50_000, 0]);
    expect(r).toMatchObject({ ok: true, ships: 75, cargo: 150_000, missing: 0 });
    // Not enough small cargo: all 50, and how many are missing.
    const small = fakeDispatcher();
    expect(prepareSend(small, fleetPage(), DEFAULT_SETTINGS, target, pick, 'transport', 202)).toMatchObject({ ok: true, ships: 50, cargo: 25_000, missing: 250 });
    const none = prepareSend(fakeDispatcher(), fleetPage(), DEFAULT_SETTINGS, target, { metal: null, crystal: null, deuterium: null }, 'transport', 203);
    expect(none).toMatchObject({ ok: false, reason: 'fleet.err.nothingPicked' });
    expect(cargoCount(10_000, 3_000, 2_000, 100)).toBe(4);
    expect(cargoCount(10_000, 0, 2_000, 3)).toBe(3);
    expect(cargoCount(1_000, 0, 2_000, 100, 7)).toBe(7);
  });

  it('deploy: the ships picked by hand stay, the cargo for the resources is added', () => {
    const target = { galaxy: 1, system: 2, position: 3, type: 3 };
    const fd = fakeDispatcher({ shipsToSend: [{ id: 210, number: 3 }] });
    prepareSend(fd, fleetPage(), DEFAULT_SETTINGS, target, { metal: 0, crystal: 0, deuterium: 5_000 }, 'deploy', 203);
    expect(fd.selected).toEqual({ 210: 3, 203: 3 });
    expect(fd.mission).toBe(4);
    expect(fd.targetPlanet.type).toBe(3);
    expect(fd.cargoDeuterium).toBe(5_000);
    expect(resolveSend({ galaxy: null, system: null, position: 16, type: 1 }, { galaxy: 4, system: 9 })).toEqual({ galaxy: 4, system: 9, position: 16, type: 1 });
  });

  it('T stays on and opens its panel; destination in three fields, resources kept', async () => {
    const { renderFleetTools, readMissionLink } = await import('../src/modules/fleet/index');
    const doc = fleetPage();
    const store = new Store(new MemoryStore(), 'send');
    const bodies = [
      { planetId: 1, moonId: 11, name: 'Casa', coords: '5:185:8' },
      { planetId: 2, moonId: 12, name: 'Colonia', coords: '5:186:8' },
    ];
    const o = { doc, store, bodyId: 1, bodies, t: (k: string) => k, locale: 'it', href: 'https://x/game/index.php?page=ingame&component=fleetdispatch' };
    renderFleetTools(o);
    expect(doc.querySelector('.fut-fsend')).toBeNull();
    const tTile = () => doc.querySelector<HTMLButtonElement>('.fut-fact[aria-label="fleet.btn.transport"]')!;
    tTile().click();
    expect(tTile().getAttribute('aria-pressed')).toBe('true');
    expect(doc.querySelector('.fut-fsend')).not.toBeNull();
    const field = (c: string) => doc.querySelector<HTMLInputElement>(`.fut-fsend .fut-fin.${c}`)!;
    field('g').value = '4:12:6';
    field('g').dispatchEvent(new Event('input'));
    expect([field('g').value, field('s').value, field('p').value]).toEqual(['4', '12', '6']);
    doc.querySelectorAll<HTMLButtonElement>('.fut-ftype')[1]!.click();
    const metal = doc.querySelector<HTMLInputElement>('.fut-fresin.metal input')!;
    metal.value = '2m';
    metal.dispatchEvent(new Event('input'));
    const saved = () => store.get<typeof DEFAULT_SETTINGS>('fleet.settings', DEFAULT_SETTINGS);
    expect(saved().sendTarget).toEqual({ galaxy: 4, system: 12, position: 6, type: 3 });
    expect(saved().sendPick).toEqual({ metal: 2_000_000, crystal: null, deuterium: null });
    // Only the position: galaxy and system stay empty (= this body's).
    field('g').value = '';
    field('s').value = '';
    field('p').value = '16';
    field('p').dispatchEvent(new Event('input'));
    expect(saved().sendTarget).toEqual({ galaxy: null, system: null, position: 16, type: 3 });
    // Picking an own body writes its coordinates and type.
    doc.querySelector<HTMLButtonElement>('.fut-fpick')!.click();
    [...doc.querySelectorAll<HTMLButtonElement>('.fut-fmenu .fut-fbtn')].find((b) => b.getAttribute('aria-label')?.startsWith('Colonia ('))!.click();
    expect(saved().sendTarget).toEqual({ galaxy: 5, system: 186, position: 8, type: 3 });
    expect(doc.querySelectorAll('.fut-fcl').length).toBe(2);
    // Pressed again: off, panel gone, what was typed is kept.
    tTile().click();
    expect(doc.querySelector('.fut-fsend')).toBeNull();
    expect(saved().sendTarget).toEqual({ galaxy: 5, system: 186, position: 8, type: 3 });
    // Collection: one secondary tile opening its two sends.
    doc.querySelector<HTMLButtonElement>('.fut-fsecond .fut-fact.more')!.click();
    expect(readMissionLink('https://x/game/index.php?page=ingame&component=fleetdispatch&galaxy=4&system=234&position=9&type=3&mission=3')).toEqual({
      mode: 'transport',
      target: { galaxy: 4, system: 234, position: 9, type: 3 },
    });
    expect(readMissionLink('https://x/game/index.php?page=ingame&component=fleetdispatch&galaxy=4&system=234&position=9&mission=1')).toBeNull();
    const menu = doc.querySelector('.fut-fcollect')!;
    expect([...menu.querySelectorAll('.fut-fmain b')].map((b) => b.textContent)).toEqual(['fleet.collect.transport', 'fleet.collect.deploy']);
  });
});

describe('fleet page opened from the galaxy', () => {
  it('turns on Trasporto with the target; the symbol fills all of a resource, Svuota clears', async () => {
    const { renderFleetTools } = await import('../src/modules/fleet/index');
    const doc = fleetPage();
    delete doc.documentElement.dataset.futMissionLink;
    const store = new Store(new MemoryStore(), 'gal');
    (window as unknown as { fleetDispatcher: unknown }).fleetDispatcher = fakeDispatcher();
    const href = 'https://x/game/index.php?page=ingame&component=fleetdispatch&galaxy=4&system=234&position=9&type=3&mission=3';
    const bodies = [{ planetId: 1, moonId: null, name: 'Casa', coords: '5:185:8' }];
    renderFleetTools({ doc, store, bodyId: 1, bodies, t: (k: string) => k, locale: 'en', href });
    const field = (c: string) => doc.querySelector<HTMLInputElement>(`.fut-fsend .fut-fin.${c}`)!.value;
    expect([field('g'), field('s'), field('p')]).toEqual(['4', '234', '9']);
    expect(doc.querySelector('.fut-fact[aria-label="fleet.btn.transport"]')!.getAttribute('aria-pressed')).toBe('true');
    doc.querySelector<HTMLButtonElement>('.fut-fresin.crystal .sym')!.click();
    expect(doc.querySelector<HTMLInputElement>('.fut-fresin.crystal input')!.value).toBe('50,000');
    expect(store.get<typeof DEFAULT_SETTINGS>('fleet.settings', DEFAULT_SETTINGS).sendPick).toEqual({ metal: null, crystal: 50_000, deuterium: null });
    doc.querySelector<HTMLButtonElement>('.fut-fclear')!.click();
    expect(store.get<typeof DEFAULT_SETTINGS>('fleet.settings', DEFAULT_SETTINGS).sendPick).toEqual({ metal: null, crystal: null, deuterium: null });
    // A redraw (e.g. after a switch) does not apply the link again over the player's edits.
    store.set('fleet.settings', { ...store.get('fleet.settings', {}), sendTarget: { galaxy: 1, system: 1, position: 1, type: 1 } });
    renderFleetTools({ doc, store, bodyId: 1, bodies, t: (k: string) => k, locale: 'en', href });
    expect(field('p')).toBe('1');
    delete (window as unknown as { fleetDispatcher?: unknown }).fleetDispatcher;
  });
});
