import { beforeEach, describe, expect, it } from 'vitest';
import { debrisMsu, readGalaxy } from '../src/data/galaxy';
import { parsePlayerData, playerScores } from '../src/data/player-api';
import { NetworkGuard } from '../src/core/guard';
import { MemoryStore, Store } from '../src/core/storage';
import { systemSummary } from '../src/modules/galaxy';

// Shape of the game's #galaxyContent (OGame 13), with made-up players.
const row = (pos: number, inner: string, cls = '') => `<div class="galaxyRow ctContentRow ${cls}" id="galaxyRow${pos}"><div class="galaxyCell cellPosition">${pos}</div>${inner}</div>`;
const player = (id: number, name: string, status: string, rank: number, abbr = '') =>
  `<div class="galaxyCell cellPlayerName"><span class="playerName tooltipRel status_abbr_${status}" rel="player${id}">${name}
    <div id="player${id}" style="display:none" class="htmlTooltip"><h1><span class="playerName">${name}</span></h1>
    <ul class="ListLinks"><li class="rank">Posizione: <a href="#">${rank.toLocaleString('it')}</a></li></ul></div></span>${abbr}</div>`;
const planet = (id: number, name: string, moon = 0) =>
  `<div class="galaxyCell cellPlanet"><div class="microplanet" data-planet-id="${id}"></div></div><div class="galaxyCell cellPlanetName"><span>${name}</span></div>` +
  `<div class="galaxyCell cellMoon">${moon ? `<div class="micromoon" data-moon-id="${moon}"></div>` : ''}</div>`;
const debris = (m: number, c: number) =>
  `<div class="galaxyCell cellDebris"><a><div class="microdebris"><div class="htmlTooltip"><ul class="ListLinks"><li class="debris-content">Metallo: ${m.toLocaleString('it')}</li><li class="debris-content">Cristallo: ${c.toLocaleString('it')}</li><li class="debris-content">Deuterio: 0</li></ul></div></div></a></div>`;
const noDebris = '<div class="galaxyCell cellDebris"></div>';
const ally = (tag: string) => `<div class="galaxyCell cellAlliance"><span class="tooltipRel" rel="alliance1">${tag} <div class="htmlTooltip">${tag}</div></span></div>`;

beforeEach(() => {
  document.body.innerHTML = `
    <input id="galaxy_input" value="1"><input id="system_input" value="300">
    <div id="galaxyContent">
      <div class="galaxyRow ctGalaxyHead"><div class="galaxyCell cellDebris">CD</div></div>
      ${row(3, '<div class="galaxyCell cellPlanetName"></div>', 'empty_filter')}
      ${row(4, planet(41, 'H3', 42) + debris(50_000, 13_800) + player(7, 'Vega', 'vacation', 551, '<pre>(<span class="status_abbr_vacation">v</span>,<span class="status_abbr_inactive">i</span>)</pre>') + ally('DTM'))}
      ${row(5, planet(51, 'Kepler') + noDebris + player(8, 'Kublai', 'inactive', 567, '<pre>(<span class="status_abbr_inactive">i</span>)</pre>'))}
      ${row(6, planet(61, 'Rigel') + noDebris + player(9, 'Orion', 'longinactive', 1_173))}
      ${row(7, planet(71, 'Home', 72) + noDebris + '<div class="galaxyCell cellPlayerName"><span class="playerName">Me</span></div>')}
      <div class="expeditionDebrisSlotBox" id="galaxyRow16"><div id="expeditionDebrisSlotDebrisContainer"></div></div>
    </div>`;
});

describe('galaxy view', () => {
  it('reads the system the game drew', () => {
    const s = readGalaxy(document)!;
    expect([s.galaxy, s.system]).toEqual([1, 300]);
    expect(s.rows.map((r) => r.position)).toEqual([3, 4, 5, 6, 7]);
    const r4 = s.rows[1]!;
    expect(r4).toMatchObject({ planetId: 41, planetName: 'H3', moonId: 42, playerId: 7, playerName: 'Vega', rank: 551, alliance: 'DTM', debris: { metal: 50_000, crystal: 13_800, deuterium: 0 } });
    expect(r4.statuses).toEqual(['vacation', 'inactive']);
    expect(s.rows[3]!.rank).toBe(1173);
    expect(debrisMsu(r4.debris!)).toBe(70_700);
    expect(s.deepDebris).toBeNull();
  });

  it('sums the system: vacation does not count as inactive, own planets are left out', () => {
    const sum = systemSummary(readGalaxy(document)!, new Set([71]));
    expect(sum).toMatchObject({ players: 3, inactive: 2, longInactive: 1, vacation: 1, moons: 2, fields: 1, debris: 70_700, deep: 0 });
  });

  it('reads deep-space debris (position 16) as the game appends it', () => {
    // Markup from the game's galaxy JS (13.1): #expeditionDebris with getDebrisTooltip() inside,
    // the same .debris-content items as a planet row plus a pathfinder count that must not be read.
    document.getElementById('expeditionDebrisSlotDebrisContainer')!.innerHTML = `
      <div id="expeditionDebris" class="name float_left tooltipRel" rel="debris16"><div><img width="30" height="30"></div>
        <div class="htmlTooltip galaxyTooltip" id="debris16"><h1>Detriti <span>[1:300:16]</span></h1><div class="splitLine"></div>
          <ul class="ListLinks"><li class="debris-content">Metallo: 1.200.000</li><li class="debris-content">Cristallo: 400.000</li>
          <li class="debris-content">Deuterio: 10.000</li><li class="debris-recyclers">Pathfinder necessari: 34</li></ul></div></div>`;
    const s = readGalaxy(document)!;
    expect(s.deepDebris).toEqual({ metal: 1_200_000, crystal: 400_000, deuterium: 10_000 });
    expect(systemSummary(s, new Set()).deep).toBe(1_830_000);
  });

});

const XML = `<?xml version="1.0" encoding="UTF-8"?><playerData id="110977" name="Dalinar" timestamp="1793799377" serverId="en808"><positions>
<position type="0" score="872758779.018">1255</position><position type="1" score="220454251.689">1329</position><position type="2" score="193508884.282">1100</position>
<position type="3" score="2763755.25" ships="10697">1557</position><position type="8" score="457712531.797">969</position></positions><planets></planets></playerData>`;

describe('public player data', () => {
  it('parses points, ranks and ships', () => {
    const p = parsePlayerData(XML, 5)!;
    expect(p).toMatchObject({ id: 110977, name: 'Dalinar', at: 5, ships: 10697 });
    expect(p.scores.total).toEqual({ points: 872_758_779, rank: 1255 });
    expect(p.scores.lifeform).toEqual({ points: 457_712_531, rank: 969 });
    expect(parsePlayerData('<html>error</html>', 0)).toBeNull();
  });

  it('asks the API once an hour per player', async () => {
    let calls = 0;
    const guard = new NetworkGuard(async () => {
      calls++;
      return new Response(XML);
    }, 'https://s1-it.ogame.gameforge.com');
    guard.closePageLoadWindow();
    const store = new Store(new MemoryStore(), 'x');
    const origin = 'https://s1-it.ogame.gameforge.com';
    await playerScores(guard, store, origin, 110977, 0);
    await playerScores(guard, store, origin, 110977, 30 * 60 * 1000);
    expect(calls).toBe(1);
    await playerScores(guard, store, origin, 110977, 61 * 60 * 1000);
    expect(calls).toBe(2);
    expect(guard.log.every((e) => e.reason === 'user-view' && e.allowed)).toBe(true);
  });
});
