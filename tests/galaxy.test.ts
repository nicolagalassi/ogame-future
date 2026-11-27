import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    expect(sum).toMatchObject({ players: 3, inactive: 2, longInactive: 1, vacation: 1, moons: 2, fields: 1, debris: 63_800, deep: 0 });
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
    expect(systemSummary(s, new Set()).deep).toBe(1_610_000);
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

describe('rank badge in the galaxy', () => {
  it('links to the highscore on the page with the player, the row searched by the game', async () => {
    const { watchGalaxy } = await import('../src/modules/galaxy');
    const { translator } = await import('../src/core/i18n');
    const store = new Store(new MemoryStore(), 'g');
    const guard = new NetworkGuard((async () => new Response('')) as never, 'https://s1-it.ogame.gameforge.com');
    watchGalaxy({ doc: document, store, guard, ownPlanetIds: new Set([71]), locale: 'it', t: translator('it') });
    const badge = document.querySelector<HTMLAnchorElement>('#galaxyRow6 .fut-g-rank')!;
    expect(badge.tagName).toBe('A');
    expect(badge.textContent).toMatch(/^#1\.?173$/);
    expect(badge.getAttribute('href')).toBe('/game/index.php?page=ingame&component=highscore&category=1&site=12&searchRelId=9');
    expect(badge.getAttribute('aria-label')).toContain('apri la classifica');
  });
});

describe('PTRE while playing, in the galaxy', () => {
  it('one call per table the game draws, only with the switch on', async () => {
    const { watchGalaxy } = await import('../src/modules/galaxy');
    const { translator } = await import('../src/core/i18n');
    const store = new Store(new MemoryStore(), 'gp');
    store.set('ptre.teamKey', 'TM-AAAA-BBBB-CCCC-DDDD');
    store.set('ptre.auto', true);
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{"code":1}'));
    const guard = new NetworkGuard(fetchImpl as never, 'https://s1-it.ogame.gameforge.com');
    guard.closePageLoadWindow();
    const ptre = { guard, store, host: 's1-it.ogame.gameforge.com', lang: 'it', version: '1' };
    watchGalaxy({ doc: document, store, guard, ownPlanetIds: new Set([71]), locale: 'it', t: translator('it'), ptre });
    const ptreCalls = () => fetchImpl.mock.calls.filter(([u]) => String(u).includes('ptre.chez.gg'));
    await vi.waitFor(() => expect(ptreCalls()).toHaveLength(1));
    const [url, init] = ptreCalls()[0]!;
    expect(String(url)).toContain('api_galaxy_import_infos.php');
    // The player's own planet (row 7) carries no player id in the game's table: never sent.
    expect(Object.keys(JSON.parse(String(init!.body)))).toEqual(['1:300:4', '1:300:5', '1:300:6']);
    // The game touches the same table (a tooltip): nothing more goes.
    document.querySelector('#galaxyRow4')!.append(document.createElement('span'));
    await new Promise((r) => setTimeout(r, 80));
    expect(ptreCalls()).toHaveLength(1);
    // Only the coordinate fields change (the player typing), the rows are the old system's: nothing goes,
    // so these planets never leave under another system's coordinates.
    (document.getElementById('system_input') as HTMLInputElement).value = '301';
    document.querySelector('#galaxyRow5')!.append(document.createElement('span'));
    await new Promise((r) => setTimeout(r, 80));
    expect(ptreCalls()).toHaveLength(1);
    // The game refills the same rows with the next system: it goes, once.
    document.querySelector('#galaxyRow5 [data-planet-id]')!.replaceWith(Object.assign(document.createElement('div'), { className: 'microplanet' }));
    document.querySelector('#galaxyRow5 .microplanet')!.setAttribute('data-planet-id', '991');
    await vi.waitFor(() => expect(ptreCalls()).toHaveLength(2));
    expect(Object.keys(JSON.parse(String(ptreCalls()[1]![1]!.body)))).toEqual(['1:301:4', '1:301:5', '1:301:6']);
  });
});

describe('military split into fleet and defences', () => {
  it('defences = economy + research + military + lifeform − total, fleet = the rest (real numbers)', async () => {
    const { splitMilitary } = await import('../src/engines/military');
    const p = parsePlayerData(XML, 5)!;
    const s = splitMilitary(p.scores)!;
    // 220,454,251 + 193,508,884 + 2,763,755 + 457,712,531 − 872,758,779 = 1,680,642 in defences.
    expect(s.defence).toBe(1_680_642);
    expect(s.fleet).toBe(2_763_755 - 1_680_642);
    // Without lifeforms (an older universe), with rounding past the edges, or a score missing.
    const sc = (total: number, economy: number, research: number, military: number) => ({ total: { points: total }, economy: { points: economy }, research: { points: research }, military: { points: military } });
    expect(splitMilitary(sc(1000, 600, 300, 150))).toEqual({ fleet: 100, defence: 50 });
    expect(splitMilitary(sc(1000, 500, 300, 150))).toEqual({ fleet: 150, defence: 0 });
    expect(splitMilitary(sc(1000, 900, 300, 150))).toEqual({ fleet: 0, defence: 150 });
    expect(splitMilitary({ total: { points: 1 } })).toBeNull();
  });

  it('the galaxy card shows Flotta and Difese under Militare', async () => {
    const { watchGalaxy } = await import('../src/modules/galaxy');
    const { translator } = await import('../src/core/i18n');
    const guard = new NetworkGuard((async () => new Response(XML.replace('id="110977"', 'id="9"'))) as never, document.location.origin);
    guard.closePageLoadWindow();
    watchGalaxy({ doc: document, store: new Store(new MemoryStore(), 'card'), guard, ownPlanetIds: new Set([71]), locale: 'it', t: translator('it') });
    document.querySelector('#galaxyRow6 .fut-g-rank')!.dispatchEvent(new MouseEvent('mouseenter'));
    await new Promise((r) => setTimeout(r, 20));
    const rows = [...document.querySelectorAll('#fut-galaxy-card tr')].map((r) => [r.className, r.querySelector('td')!.textContent]);
    expect(rows).toEqual([['', 'Generale'], ['', 'Economia'], ['', 'Ricerca'], ['', 'Militare'], ['sub', 'Flotta'], ['sub', 'Difese'], ['', 'Forme di vita']]);
  });
});
