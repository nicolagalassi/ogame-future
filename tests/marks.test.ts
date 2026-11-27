// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_MARKS, flagPlayer, loadMarks, MARKS_KEY, migrateOld, rememberRecent, RECENT_MAX, renamePlayers } from '../src/engines/marks';
import { flagButton } from '../src/modules/marks/picker';
import { closeSide, isSideOpen, nextInSide, openSide, resetSideCache, restoreSide, SIDE_ID, toggleSide } from '../src/modules/marks/side';
import { POSITIONS_KEY } from '../src/engines/positions';
import { parsePlayerData } from '../src/data/player-api';
import { parsePlayersXml, statusNames } from '../src/data/universe-players';
import { parseHighscoreXml, UNIVERSE_RANKS_KEY } from '../src/data/universe-ranks';
import { MemoryStore, Store } from '../src/core/storage';
import { NetworkGuard } from '../src/core/guard';
import { translator } from '../src/core/i18n';

const t = translator('it');
afterEach(() => { document.body.innerHTML = ''; });

describe('marks', () => {
  it('flags players, remembering the last choice; old coloured planets are not loaded', () => {
    let m = flagPlayer(EMPTY_MARKS, 5, 'Bob', 'farm', 1);
    expect(m.players['5']).toEqual({ flag: 'farm', name: 'Bob', at: 1 });
    expect(m.lastFlag).toBe('farm');
    expect(Object.keys(loadMarks({ players: {}, planets: { '1:2:3': {} } } as never))).toEqual(['players', 'recent', 'lastFlag']);
    m = flagPlayer(m, 5, 'Bob', null, 2);
    expect(m.players['5']).toBeUndefined();
    expect(m.lastFlag).toBe('farm');
  });

  it('keeps the recent players, newest first and capped', () => {
    let m = EMPTY_MARKS;
    for (let i = 1; i <= RECENT_MAX + 3; i++) m = rememberRecent(m, i, `p${i}`);
    m = rememberRecent(m, 10, 'p10');
    expect(m.recent).toHaveLength(RECENT_MAX);
    expect(m.recent[0]).toEqual({ id: 10, name: 'p10' });
  });

  it('takes the names the galaxy shows now, for flagged and recent players', () => {
    let m = flagPlayer(EMPTY_MARKS, 7, 'OldName', 'target', 1);
    m = rememberRecent(m, 7, 'OldName');
    m = rememberRecent(m, 8, 'Same');
    const next = renamePlayers(m, [[7, 'NewName'], [8, 'Same'], [9, 'Unmarked'], [0, ''], [7, '']])!;
    expect(next.players['7']).toMatchObject({ flag: 'target', name: 'NewName', at: 1 });
    expect(next.recent).toEqual([{ id: 8, name: 'Same' }, { id: 7, name: 'NewName' }]);
    expect(next.players['9']).toBeUndefined();
    // Nothing changed: no write.
    expect(renamePlayers(next, [[7, 'NewName'], [8, 'Same']])).toBeNull();
  });

  it('moves the old rivals once (the old galaxy targets are dropped)', () => {
    const moved = migrateOld(EMPTY_MARKS, { targets: [{ coords: '1:2:3', planet: 'A', player: 'Bob', at: 9 }], rivals: [{ id: 7, name: 'Riv', at: 8 }] })!;
    expect(moved.players['7']).toMatchObject({ flag: 'watch', name: 'Riv' });
    expect(migrateOld(EMPTY_MARKS, { targets: [], rivals: [] })).toBeNull();
  });
});

describe('mark pickers', () => {
  it('opens the choice on click, repeats the last one on shift+click and repaints every copy', () => {
    const store = new Store(new MemoryStore(), 'x');
    const a = flagButton({ doc: document, store, t }, 5, 'Bob');
    const b = flagButton({ doc: document, store, t }, 5, 'Bob');
    document.body.append(a, b);
    a.click();
    const pop = document.getElementById('fut-mk-pop')!;
    expect(pop.querySelectorAll('button')).toHaveLength(7);
    pop.querySelectorAll<HTMLButtonElement>('button')[2]!.click(); // farm
    expect(document.getElementById('fut-mk-pop')).toBeNull();
    expect(loadMarks(store.get(MARKS_KEY, null)).players['5']?.flag).toBe('farm');
    expect(b.classList.contains('on')).toBe(true);
    // Shift+click repeats the last flag (farm), again clears it.
    const c = flagButton({ doc: document, store, t }, 6, 'Al');
    document.body.append(c);
    c.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    expect(loadMarks(store.get(MARKS_KEY, null)).players['6']?.flag).toBe('farm');
    c.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    expect(loadMarks(store.get(MARKS_KEY, null)).players['6']).toBeUndefined();
  });
});

describe('public API readers', () => {
  it('reads planets and moons from playerData.xml', () => {
    const xml = '<?xml version="1.0"?><playerData id="9" name="Kal" timestamp="1"><positions></positions><planets><planet id="11" name="A" coords="1:52:9"><moon id="12" name="M" size="8831"/></planet><planet id="13" name="B" coords="3:149:10"/></planets></playerData>';
    expect(parsePlayerData(xml, 0)?.planets).toEqual([{ id: 11, name: 'A', coords: '1:52:9', moon: { id: 12, name: 'M', size: 8831 } }, { id: 13, name: 'B', coords: '3:149:10', moon: null }]);
  });

  it('reads names and statuses from players.xml', () => {
    const u = parsePlayersXml('<?xml version="1.0"?><players timestamp="1"><player id="5" name="Bob" status="vI"/><player id="6" name="Al"/></players>', 3)!;
    expect(u.players).toEqual({ 5: ['Bob', 'vI'], 6: ['Al', ''] });
    expect(statusNames('vI')).toEqual(['vacation', 'longinactive']);
  });
});

describe('targets side bar', () => {
  it('lists the flagged players by rank, with their status, ranks for all from one public file', async () => {
    expect(parseHighscoreXml('<?xml version="1.0"?><highscore category="1" type="0" timestamp="1"><player position="2" id="7" score="900"/><player position="18" id="5" score="20"/></highscore>', 4)).toEqual({ at: 4, ranks: { 7: [2, 900], 5: [18, 20] } });
    const store = new Store(new MemoryStore(), 'rk');
    let m = flagPlayer(EMPTY_MARKS, 5, 'Abubu', 'danger', 1);
    m = flagPlayer(m, 7, 'Zed', 'danger', 1);
    m = flagPlayer(m, 8, 'Mid', 'danger', 1);
    store.set(MARKS_KEY, m);
    store.set(UNIVERSE_RANKS_KEY, { at: Date.now(), ranks: { 5: [18, 0], 7: [2, 0], 8: [9, 0] } });
    // Zed's planets were read in the galaxy 3 and 2 hours ago: the newest counts. The others never.
    store.set(POSITIONS_KEY, {
      '1:1:1': { player: 7, name: 'a', moon: false, debris: 0, act: [null, null], at: Date.now() - 3 * 3_600_000 },
      '1:1:2': { player: 7, name: 'b', moon: false, debris: 0, act: [null, null], at: Date.now() - 2 * 3_600_000 - 60_000 },
    });
    const fetchImpl = vi.fn(async (_u: string, _i?: RequestInit) => new Response('<?xml version="1.0"?><players timestamp="1"><player id="7" name="Zed" status="vi"/><player id="5" name="Bob" status=""/><player id="6" name="Al" status="v"/></players>'));
    const guard = new NetworkGuard(fetchImpl, 'http://localhost:3000');
    openSide({ doc: document, store, guard, t, locale: 'it' }, { flagTab: 'danger', player: null });
    const root = () => document.getElementById(SIDE_ID)!.shadowRoot!;
    expect([...root().querySelectorAll('.ps .pname')].map((n) => n.textContent)).toEqual(['Zed', 'Mid', 'Abubu']);
    expect([...root().querySelectorAll('.ps .rank')].map((n) => n.textContent)).toEqual(['#2', '#9', '#18']);
    expect([...root().querySelectorAll('.ps .age')].map((n) => n.textContent)).toEqual(['2h', '—', '—']);
    // The ranks file is fresh: only players.xml is asked; then Zed shows on vacation.
    await vi.waitFor(() => expect(root().querySelector('.ps .pst')?.textContent).toBe('(vi)'));
    expect(root().querySelector('.ps .pname')!.classList.contains('st-vacation')).toBe(true);
    expect(fetchImpl.mock.calls.every((c) => !String(c[0]).includes('highscore'))).toBe(true);
    resetSideCache();
  });

  it('lists flagged players, no planets tab, and stays open across pages', async () => {
    const store = new Store(new MemoryStore(), 'x');
    store.set(MARKS_KEY, flagPlayer(EMPTY_MARKS, 5, 'Bob', 'watch', 1));
    const fetchImpl = vi.fn(async (_u: string, _i?: RequestInit) => new Response('<?xml version="1.0"?><players timestamp="1"><player id="5" name="Bob" status=""/><player id="6" name="Al" status="v"/></players>'));
    const guard = new NetworkGuard(fetchImpl, 'http://localhost:3000');
    const o = { doc: document, store, guard, t, locale: 'it'};
    toggleSide(o);
    const root = () => document.getElementById(SIDE_ID)!.shadowRoot!;
    expect(root().querySelector('.row .pname')?.textContent).toBe('Bob');
    expect(root().querySelector('.seg, .tg')).toBeNull();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    expect(fetchImpl.mock.calls[0]![1]?.credentials).toBe('omit');
    // Left open: it comes back on the next page; the button closes it.
    document.body.innerHTML = '';
    restoreSide(o);
    expect(isSideOpen(document)).toBe(true);
    toggleSide(o);
    expect(isSideOpen(document)).toBe(false);
    restoreSide(o);
    expect(isSideOpen(document)).toBe(false);
  });

  it('player sheet: API planets plus the ones seen in the galaxy, M walks them', async () => {
    const store = new Store(new MemoryStore(), 'y');
    store.set(POSITIONS_KEY, { '2:10:8': { player: 5, name: 'New', moon: false, debris: 2_000_000, act: ['*', null], at: Date.now() } });
    const xml = '<?xml version="1.0"?><playerData id="5" name="Bob" timestamp="1"><positions><position type="0" score="1000">12</position></positions><planets><planet id="1" name="Home" coords="1:300:4"/></planets></playerData>';
    const guard = new NetworkGuard(vi.fn(async () => new Response(xml)), 'http://localhost:3000');
    // The galaxy page shows 1:300: its row is the current one, M goes to the next.
    document.body.innerHTML = '<input id="galaxy_input" value="1"><input id="system_input" value="300"><div id="galaxyContent"></div>';
    const assign = vi.fn();
    Object.defineProperty(window, 'loadContentNew', { value: assign, configurable: true });
    openSide({ doc: document, store, guard, t, locale: 'it'}, { player: 5 });
    const root = () => document.getElementById(SIDE_ID)!.shadowRoot!;
    await vi.waitFor(() => expect(root().querySelectorAll('.pl .row')).toHaveLength(2));
    const rows = [...root().querySelectorAll('.pl .row')];
    expect(rows[0]!.classList.contains('active')).toBe(true);
    expect(rows[1]!.querySelector('.coords.new')).not.toBeNull();
    expect(rows[1]!.querySelector('.act.on')?.textContent).toBe('*');
    expect(rows[1]!.querySelector<HTMLAnchorElement>('a.act')?.getAttribute('href')).toContain('component=fleetdispatch&galaxy=2&system=10&position=8&type=1');
    expect(nextInSide(document)).toBe(true);
    expect(assign).toHaveBeenCalledWith(2, 10);
    closeSide(document, store);
  });
});

describe('player sheet scores', () => {
  it('fleet and defences under the six scores, worked out from the military one', async () => {
    resetSideCache();
    const store = new Store(new MemoryStore(), 'split');
    const xml = '<?xml version="1.0"?><playerData id="6" name="Ars" timestamp="1"><positions>'
      + '<position type="0" score="1000000">47</position><position type="1" score="600000">56</position><position type="2" score="300000">59</position>'
      + '<position type="3" score="150000" ships="40">30</position><position type="8" score="0">40</position></positions><planets></planets></playerData>';
    const guard = new NetworkGuard(vi.fn(async () => new Response(xml)), 'http://localhost:3000');
    document.body.innerHTML = '';
    openSide({ doc: document, store, guard, t, locale: 'it' }, { player: 6 });
    const root = () => document.getElementById(SIDE_ID)!.shadowRoot!;
    await vi.waitFor(() => expect(root().querySelectorAll('.scores .score.half')).toHaveLength(2));
    const half = [...root().querySelectorAll('.scores .score.half')].map((c) => [c.querySelector('.k')!.textContent, c.querySelector('b')!.textContent]);
    // 600k + 300k + 150k + 0 − 1M = 50k in defences, 100k fleet.
    expect(half).toEqual([['Flotta', '100k'], ['Difese', '50,0k']]);
    closeSide(document, store);
  });
});

describe('PTRE on the player sheet', () => {
  it('asks PTRE only on a click, shows activity and the best report, a new frame asks again', async () => {
    resetSideCache();
    const store = new Store(new MemoryStore(), 'ptre');
    store.set('ptre.teamKey', 'TM-AAAA-BBBB-CCCC-DDDD');
    const xml = '<?xml version="1.0"?><playerData id="8" name="Zed" timestamp="1"><positions></positions><planets></planets></playerData>';
    const answer = {
      code: 1, message: 'ok',
      activity_array: { succes: 1, max_acti_per_slot: 4, activity_array: JSON.stringify([['00h', 0], ['01h', 4], ['02h', 'x']]), check_array: JSON.stringify([['00h', 100], ['01h', 50], ['02h', 0]]) },
      top_sr_timestamp: 1_790_000_000, top_sr_fleet_points: 12_300_000, top_sr_link: 'https://ptre.chez.gg/?iid=1', fleet_json: [{ ship_type: 202, count: 1500 }],
    };
    const fetchImpl = vi.fn(async (url: string) => new Response(url.includes('ptre.chez.gg') ? JSON.stringify(answer) : xml));
    const guard = new NetworkGuard(fetchImpl, 'http://localhost:3000');
    document.body.innerHTML = '';
    const ptre = { guard, store, host: 's269-it.ogame.gameforge.com', lang: 'it', version: '1' };
    openSide({ doc: document, store, guard, t, locale: 'it', ptre }, { player: 8 });
    const root = () => document.getElementById(SIDE_ID)!.shadowRoot!;
    const button = () => [...root().querySelectorAll<HTMLButtonElement>('.actions button')].find((b) => b.textContent === 'PTRE')!;
    await vi.waitFor(() => expect(button()).toBeDefined());
    const ptreCalls = () => fetchImpl.mock.calls.filter(([u]) => u.includes('ptre.chez.gg')).map(([u]) => new URL(u));
    expect(ptreCalls()).toHaveLength(0);
    button().click();
    await vi.waitFor(() => expect(root().querySelectorAll('.ptre .bar')).toHaveLength(2));
    expect(Object.fromEntries(ptreCalls()[0]!.searchParams)).toMatchObject({ player_id: '8', pseudo: 'Zed', input_frame: 'week', tool: 'future' });
    const bars = [...root().querySelectorAll<HTMLElement>('.ptre .bar')];
    expect(bars.map((b) => b.className)).toEqual(['bar', 'bar hot']);
    expect(bars[1]!.title).toBe('01h: 4 attività, controllato al 50%');
    expect(root().querySelector('.ptre .best b')!.textContent).toBe('Flotta 12,3M punti');
    expect(root().querySelector('.ptre .ships')!.textContent).toContain('1,5k');
    expect([...root().querySelectorAll<HTMLAnchorElement>('.ptre .links a')].map((a) => a.href)).toEqual(['https://ptre.chez.gg/?iid=1', 'https://ptre.chez.gg/?country=it&univers=269&player_id=8']);
    // A redraw does not ask again; another frame does.
    openSide({ doc: document, store, guard, t, locale: 'it', ptre }, { player: 8 });
    expect(ptreCalls()).toHaveLength(1);
    [...root().querySelectorAll<HTMLButtonElement>('.ptre .chip')].find((c) => c.textContent === '24h')!.click();
    await vi.waitFor(() => expect(ptreCalls()).toHaveLength(2));
    expect(ptreCalls()[1]!.searchParams.get('input_frame')).toBe('last24h');
    // Without a team key there is no PTRE button.
    store.delete('ptre.teamKey');
    openSide({ doc: document, store, guard, t, locale: 'it', ptre }, { player: 8 });
    expect(button()).toBeUndefined();
    closeSide(document, store);
  });
});
