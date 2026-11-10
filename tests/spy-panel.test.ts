// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { loadServerDataOnPageLoad, parseServerData, SERVER_DATA_KEY } from '../src/data/server-data';
import { NetworkGuard } from '../src/core/guard';
import { MemoryStore, Store } from '../src/core/storage';
import { converterLink, SIM_KEY, simLink, simPrefill } from '../src/engines/sim-links';
import { columnOrder, mountSpyPanel, moveColumn, SPY_PANEL_ID, SPY_SHARED_KEY, universeOf } from '../src/modules/messages/spy-table';
import { SPY_BOARD_KEY } from '../src/engines/raids';
import { translator } from '../src/core/i18n';

const XML = '<?xml version="1.0"?><serverData><galaxies>7</galaxies><systems>299</systems><donutGalaxy>0</donutGalaxy><donutSystem>1</donutSystem><speedFleetWar>3</speedFleetWar><speedFleetPeaceful>6</speedFleetPeaceful></serverData>';

describe('universe settings', () => {
  it('reads size, donut and speeds from serverData.xml', () => {
    expect(parseServerData(XML, 5)).toEqual({ at: 5, galaxies: 7, systems: 299, donutGalaxy: false, donutSystem: true, speedFleetWar: 3, speedFleetPeaceful: 6 });
    expect(parseServerData('An error has occured!', 5)).toBeNull();
  });

  it('asks the public API on page load without cookies, then keeps it a week', async () => {
    const fetchImpl = vi.fn(async (_u: string, _i?: RequestInit) => new Response(XML));
    const guard = new NetworkGuard(fetchImpl, 'https://s1-it.ogame.gameforge.com');
    const store = new Store(new MemoryStore(), 'x');
    await loadServerDataOnPageLoad({ guard, store, origin: 'https://s1-it.ogame.gameforge.com', now: 1 });
    await loadServerDataOnPageLoad({ guard, store, origin: 'https://s1-it.ogame.gameforge.com', now: 2 });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]![1]?.credentials).toBe('omit');
    expect(universeOf(document, store.get(SERVER_DATA_KEY, null))).toMatchObject({ galaxies: 7, systems: 299, donutGalaxy: false, fleetSpeed: 3 });
  });
});

describe('simulator and converter links', () => {
  it('puts the report key and the attacker research in the links', () => {
    const prefill = simPrefill('s808-en', { coords: '1:473:7', researches: { 109: 20, 110: 18, 115: 21 }, classId: 2 }, '1:476:11');
    const data = JSON.parse(atob(prefill));
    expect(data.settings.server).toBe('s808-en');
    expect(data[0][0].planet).toEqual({ galaxy: '1', system: '473', position: '7' });
    expect(data[0][0].research[109].level).toBe(22);
    expect(data[0][0].research[115].level).toBe(21);
    expect(data[1][0].planet.position).toBe('11');
    // Same shape as OGLight: tool, language, report key, prefill.
    expect(simLink('osims', 'sr-en-808-ab', 'it', prefill)).toBe(`https://www.ogameutilities.it/Osims/it?SR_KEY=sr-en-808-ab#prefill=${prefill}`);
    expect(simLink('ogametools', 'sr-en-808-ab', 'us', prefill)).toMatch(/^https:\/\/simulator\.ogame-tools\.com\/en\?SR_KEY=sr-en-808-ab#prefill=/);
    expect(converterLink('cr-en-808-cd', 'us')).toBe('https://ogotcha.oplanet.eu/en?CR_KEY=cr-en-808-cd');
  });
});

describe('simulator prefill, as OGLight fills it', () => {
  it('adds the General lifeform boost, the Warriors level, the class booster and the ship bonuses', () => {
    const ship = { weapon: 0.1, shield: 0.2, armor: 0.3, cargo: 0.4, speed: 0.05, fuel: -0.08 };
    const data = JSON.parse(atob(simPrefill('s269-it', { coords: '1:2:3', researches: { 109: 20 }, classId: 2, allianceClass: 1, lf: { ships: { 207: ship }, classBooster: { 2: 0.52 } } }, '4:5:6')));
    const me = data[0][0];
    // 20 + 2 (General) + 1 (52% booster: one more per 50%) + 1 (Warriors).
    expect(me.research[109].level).toBe(24);
    expect(me.allianceClass).toBe(1);
    expect(me.lifeformBonuses.CharacterClassBooster).toEqual({ 2: 0.52 });
    expect(me.lifeformBonuses.BaseStatsBooster[207]).toEqual({ weapon: 0.1, shield: 0.2, armor: 0.3, cargo: 0.4, speed: 0.05 });
    expect(me.lifeformBonuses.ShipFuelConsumption).toBe(0.08);
  });
});

describe('spy panel in the inbox', () => {
  it('sits above the reports on the Espionage tab only', () => {
    document.body.innerHTML = '<div data-subtab-id="20" class="active"></div><div id="messages"><div class="messagesHolder"></div></div>';
    const store = new Store(new MemoryStore(), 'x');
    store.set(SPY_BOARD_KEY, { '1:476:11': { key: '1:476:11', id: '9', at: 1000, coords: '1:476:11', moon: false, playerId: 5, playerName: 'Bob', statuses: ['inactive'], activity: 60, res: { metal: 1e6, crystal: 0, deuterium: 0 }, loot: 0.5, fleetValue: 0, defValue: 0, apiKey: 'sr-en-808-ab' } });
    const o = { doc: document, store, t: translator('it'), locale: 'it', now: () => 61_000, spy: { bases: [{ id: 1, name: 'Home', coords: '1:473:7', moon: false }], researches: {}, classId: 0, server: 's808-en', lang: 'it' } };
    mountSpyPanel(o);
    const panel = document.getElementById(SPY_PANEL_ID)!;
    expect(panel.nextElementSibling?.className).toBe('messagesHolder');
    expect(panel.querySelectorAll('.fut-sp-list .fut-sp-row')).toHaveLength(1);
    // Columns as OGLight: number, age, activity, coords, name, loot, fleet, defence, actions.
    expect(Array.from(panel.querySelectorAll('.fut-sp-cols .fut-sp-h')).map((h) => h.textContent)).toEqual(['#', 'Età', 'Att.', 'Coord.', 'Nome', 'Bottino', 'Flotta', 'Difesa', '']);
    // Loot is the resources you can carry away (1M × 50%).
    expect(panel.querySelector('.fut-sp-list .fut-sp-row .fut-sp-loot')?.textContent).toBe('500k');
    expect(panel.querySelector('.fut-sp-foot .fut-sp-r')?.textContent).toBe('500k');
    // The name opens the full report in the game's own window.
    const name = panel.querySelector<HTMLAnchorElement>('a.fut-sp-name')!;
    expect(name.classList.contains('overlay')).toBe(true);
    expect(name.href).toContain('component=messagedetails&messageId=9');
    // Icons: next raids, attack, one Simulate (the picked tool), remove.
    const acts = panel.querySelector('.fut-sp-list .fut-sp-acts')!;
    expect(Array.from(acts.querySelectorAll('button')).map((b) => b.classList[1])).toEqual(['fut-sp-more', 'fut-sp-attack', 'fut-sp-sim', 'fut-sp-del']);
    // The day's 6 raids: 50% of what is left each time; every ship count opens Fleet with those ships.
    acts.querySelector<HTMLButtonElement>('.fut-sp-more')!.click();
    expect(Array.from(document.querySelectorAll('.fut-sp-wgrid b')).map((x) => x.textContent)).toEqual(['500k', '250k', '125k', '62,5k', '31,3k', '15,6k']);
    const counts = Array.from(document.querySelectorAll<HTMLAnchorElement>('.fut-sp-wgrid a.cnt'));
    expect(counts.map((a) => a.textContent)).toEqual(['20', '10', '5', '3', '2', '1', '100', '50', '25', '13', '7', '4']);
    expect(counts[1]!.getAttribute('href')).toBe('/game/index.php?page=ingame&component=fleetdispatch&galaxy=1&system=476&position=11&type=1&mission=1&am203=10');
    expect(counts[6]!.getAttribute('href')).toContain('&am202=100');
    // Columns move: the name goes first.
    store.set('spy.view', { cols: ['target', 'age', 'act', 'coords', 'loot', 'fleet', 'def'] });
    mountSpyPanel(o);
    expect(document.querySelector('.fut-sp-cols .fut-sp-c:nth-child(2) .fut-sp-h')?.textContent).toBe('Nome');
    expect(acts.querySelector('.fut-sp-sim')?.getAttribute('title')).toContain('Osims');
    store.set(SIM_KEY, 'ogametools');
    mountSpyPanel(o);
    expect(document.querySelector('.fut-sp-sim')?.getAttribute('title')).toContain('OGame Simulator');
    mountSpyPanel(o);
    expect(document.querySelectorAll(`#${SPY_PANEL_ID}`)).toHaveLength(1);
    document.querySelector('[data-subtab-id="20"]')!.classList.remove('active');
    mountSpyPanel(o);
    expect(document.getElementById(SPY_PANEL_ID)).toBeNull();
  });
});

describe('spy table columns', () => {
  it('moves columns and rejects a broken saved order', () => {
    expect(moveColumn(['age', 'act', 'coords', 'target', 'loot', 'fleet', 'def'], 'def', 'age')).toEqual(['def', 'age', 'act', 'coords', 'target', 'loot', 'fleet']);
    expect(moveColumn(['age', 'act', 'coords', 'target', 'loot', 'fleet', 'def'], 'age', 'act')).toEqual(['act', 'age', 'coords', 'target', 'loot', 'fleet', 'def']);
    expect(columnOrder(['age', 'age'])).toHaveLength(7);
  });
});

describe('reports shared by the alliance', () => {
  it('are marked and can be left out of the table', () => {
    document.body.innerHTML = '<div data-subtab-id="20" class="active"></div><div id="messages"><div class="messagesHolder"></div></div>';
    const store = new Store(new MemoryStore(), 'x');
    const entry = { at: 1000, moon: false, playerId: 5, statuses: [], activity: 60, res: { metal: 1e6, crystal: 0, deuterium: 0 }, loot: 0.5, fleetValue: 0, defValue: 0 };
    store.set(SPY_BOARD_KEY, {
      '1:1:1': { ...entry, key: '1:1:1', id: '1', coords: '1:1:1', playerName: 'Mine' },
      '2:2:2': { ...entry, key: '2:2:2', id: '2', coords: '2:2:2', playerName: 'Ally', shared: true },
    });
    const o = { doc: document, store, t: translator('it'), locale: 'it', now: () => 61_000, spy: { bases: [], researches: {}, classId: 0, server: 's269-it', lang: 'it' } };
    mountSpyPanel(o);
    expect(document.querySelectorAll('.fut-sp-list .fut-sp-row')).toHaveLength(2);
    expect(document.querySelectorAll('.st-shared')).toHaveLength(1);
    // Removing a target keeps the keyboard in the table, on the next remove button.
    document.querySelector<HTMLButtonElement>('.fut-sp-list .fut-sp-del')!.click();
    expect(document.querySelectorAll('.fut-sp-list .fut-sp-row')).toHaveLength(1);
    expect(document.activeElement?.classList.contains('fut-sp-del')).toBe(true);
    store.set(SPY_BOARD_KEY, { '1:1:1': { ...entry, key: '1:1:1', id: '1', coords: '1:1:1', playerName: 'Mine' }, '2:2:2': { ...entry, key: '2:2:2', id: '2', coords: '2:2:2', playerName: 'Ally', shared: true } });
    store.set(SPY_SHARED_KEY, false);
    mountSpyPanel(o);
    expect(Array.from(document.querySelectorAll('.fut-sp-name')).map((n) => n.textContent)).toEqual(['Mine']);
  });
});

describe('combat report summary', () => {
  it('links the converter with the report key', async () => {
    const { summaryFor } = await import('../src/modules/messages');
    const box = summaryFor(document, { kind: 'combat', id: '1', at: 0, coords: '1:2:3', attacker: true, winner: 'won', loot: { metal: 0, crystal: 0, deuterium: 0 }, lost: {}, debris: { metal: 0, crystal: 0, deuterium: 0 }, apiKey: 'cr-en-808-cd' }, { locale: 'it', t: translator('it'), ships: {} })!;
    const a = box.querySelector<HTMLAnchorElement>('a.fut-msg-link')!;
    expect(a.href).toBe('https://ogotcha.oplanet.eu/it?CR_KEY=cr-en-808-cd');
    expect(a.target).toBe('_blank');
    expect(a.textContent).toBe('Convertitore');
  });
});
