// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { loadServerDataOnPageLoad, parseServerData, SERVER_DATA_KEY } from '../src/data/server-data';
import { NetworkGuard } from '../src/core/guard';
import { MemoryStore, Store } from '../src/core/storage';
import { converterLink, ogameToolsSimLink, osimsLink, simPrefill } from '../src/engines/sim-links';
import { mountSpyPanel, SPY_PANEL_ID, universeOf } from '../src/modules/messages/spy-table';
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
    expect(osimsLink('sr-en-808-ab', prefill)).toBe(`https://www.ogameutilities.it/Osims/?SR_KEY=sr-en-808-ab#prefill=${prefill}`);
    expect(ogameToolsSimLink('sr-en-808-ab', 'it', prefill)).toMatch(/^https:\/\/simulator\.ogame-tools\.com\/it\?SR_KEY=sr-en-808-ab#prefill=/);
    expect(converterLink('cr-en-808-cd', 'us')).toBe('https://ogotcha.oplanet.eu/en?CR_KEY=cr-en-808-cd');
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
    expect(panel.querySelectorAll('.fut-sp-acts .custom_btn')).toHaveLength(5);
    mountSpyPanel(o);
    expect(document.querySelectorAll(`#${SPY_PANEL_ID}`)).toHaveLength(1);
    document.querySelector('[data-subtab-id="20"]')!.classList.remove('active');
    mountSpyPanel(o);
    expect(document.getElementById(SPY_PANEL_ID)).toBeNull();
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
