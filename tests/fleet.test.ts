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
import { enableOriginAutofill, fillResourcesAfterReserve, fillShipsAfterReserve } from '../src/modules/fleet/index';

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

  it('selects ships minus the reserve and fires the game handlers', () => {
    const doc = fleetPage();
    let keyups = 0;
    doc.getElementById('fleet1')!.addEventListener('keyup', () => keyups++);
    const total = fillShipsAfterReserve(doc, { reserve: reserve({ '203': 1000, '210': 3 }), save: null });
    const inputs = doc.querySelectorAll<HTMLInputElement>('#technologies input');
    expect(total).toBe(4000);
    expect(inputs[0]!.value).toBe('4000');
    expect(inputs[1]!.value).toBe('');
    expect(keyups).toBe(2);
  });

  it('loads resources minus reserve and fuel', () => {
    const doc = fleetPage();
    fillResourcesAfterReserve(doc, { reserve: reserve({}, { metal: 0, crystal: 100, deuterium: 1000 }), save: null });
    const v = (id: string) => (doc.getElementById(id) as HTMLInputElement).value;
    expect([v('metal'), v('crystal'), v('deuterium')]).toEqual(['1000', '400', '4660']);
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
