import { describe, expect, it } from 'vitest';
import { flyingTotal, readEventFlights } from '../src/data/flights';

const tip = (ships: [string, number][], cargo: number[]) =>
  `<div class="htmlTooltip"><table class="fleetinfo"><tr><th colspan="3">Navi:</th></tr>${ships
    .map(([n, v]) => `<tr><td colspan="2">${n}:</td><td class="value">${v.toLocaleString('it-IT')}</td></tr>`)
    .join('')}<tr><td colspan="3">&nbsp;</td></tr><tr><th colspan="3">Carico:</th></tr>${['Metallo', 'Cristallo', 'Deuterio', 'Cibo']
    .map((n, i) => `<tr><td colspan="2">${n}:</td><td class="value">${(cargo[i] ?? 0).toLocaleString('it-IT')}</td></tr>`)
    .join('')}</table></div>`;

const row = (o: { id: number; mission: number; back: boolean; at: number; from: string; to: string; own?: boolean; tooltip: string }) =>
  `<tr class="eventFleet" id="eventRow-${o.id}" data-mission-type="${o.mission}" data-return-flight="${o.back}" data-arrival-time="${o.at}">
    <td class="countDown"><span class="${o.own === false ? 'hostile' : 'friendly'}">1m</span></td>
    <td class="coordsOrigin"><a>[${o.from}]</a></td>
    <td class="icon_movement"><span class="tooltip" data-tooltip-title="${o.tooltip.replace(/"/g, '&quot;')}"></span></td>
    <td class="destCoords"><a>[${o.to}]</a></td></tr>`;

describe('fleets in flight', () => {
  it('reads own fleets once each, with their cargo and when it stops travelling', () => {
    const transport = tip([['Cargo grande', 100]], [1_000_000, 500_000, 200_000]);
    document.body.innerHTML = `<table id="eventContent"><tbody>
      ${row({ id: 1, mission: 3, back: false, at: 1000, from: '1:2:3', to: '1:2:4', tooltip: transport })}
      ${row({ id: 2, mission: 3, back: true, at: 2000, from: '1:2:3', to: '1:2:4', tooltip: transport })}
      ${row({ id: 3, mission: 15, back: true, at: 5000, from: '1:2:3', to: '1:2:16', tooltip: tip([['Cargo grande', 50]], [0, 0, 30_000]) })}
      ${row({ id: 4, mission: 1, back: false, at: 900, from: '4:4:4', to: '1:2:3', own: false, tooltip: tip([['Caccia', 9]], [7, 7, 7]) })}
    </tbody></table>`;
    const list = readEventFlights(document, 0)!;
    expect(list).toHaveLength(2);
    expect(list.find((f) => f.key.startsWith('3|'))).toMatchObject({ cargo: { metal: 1_000_000, crystal: 500_000, deuterium: 200_000 }, until: 1_000_000 });
    expect(list.find((f) => f.key.startsWith('15|'))).toMatchObject({ cargo: { metal: 0, crystal: 0, deuterium: 30_000 }, until: 5_000_000 });
    const flights = { readAt: 0, list };
    expect(flyingTotal(flights, 0)).toEqual({ metal: 1_000_000, crystal: 500_000, deuterium: 230_000 });
    // The transport has delivered: only the expedition's cargo is still travelling.
    expect(flyingTotal(flights, 1_500_000)).toEqual({ metal: 0, crystal: 0, deuterium: 30_000 });
  });

  it('nothing to read while the game has not filled the list', () => {
    document.body.innerHTML = '<table id="eventContent"></table>';
    expect(readEventFlights(document, 0)).toBeNull();
    document.body.innerHTML = '';
    expect(readEventFlights(document, 0)).toBeNull();
  });
});
