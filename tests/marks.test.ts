// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_MARKS, flagPlayer, loadMarks, MARKS_KEY, migrateOld, planetsInRange, rememberRecent, RECENT_MAX, tagPlanet, type Marks } from '../src/engines/marks';
import { flagButton, tagButton } from '../src/modules/marks/picker';
import { closeTargets, openTargets, TARGETS_ID } from '../src/modules/marks/targets-view';
import { parsePlayerData } from '../src/data/player-api';
import { parsePlayersXml, statusNames } from '../src/data/universe-players';
import { MemoryStore, Store } from '../src/core/storage';
import { NetworkGuard } from '../src/core/guard';
import { translator } from '../src/core/i18n';

const t = translator('it');
const info = (player = 'Bob', playerId: number | null = 5, statuses: string[] = []) => ({ planet: 'P', player, playerId, statuses, moon: false });
afterEach(() => { document.body.innerHTML = ''; closeTargets(document); });

describe('marks', () => {
  it('flags players and colours planets, remembering the last choice', () => {
    let m = flagPlayer(EMPTY_MARKS, 5, 'Bob', 'farm', 1);
    m = tagPlanet(m, '1:2:3', 'green', info(), 1);
    expect(m.players['5']).toEqual({ flag: 'farm', name: 'Bob', at: 1 });
    expect([m.lastFlag, m.lastTag]).toEqual(['farm', 'green']);
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

  it('lists coloured planets in a coordinate range with filters', () => {
    let m: Marks = EMPTY_MARKS;
    m = tagPlanet(m, '1:300:4', 'red', info(), 1);
    m = tagPlanet(m, '1:120:8', 'blue', info('V', 6, ['vacation']), 1);
    m = tagPlanet(m, '2:5:1', 'red', info(), 1);
    m = tagPlanet(m, '1:120:2', 'red', info(), 1);
    expect(planetsInRange(m, '1:1', '1:499').map(([c]) => c)).toEqual(['1:120:2', '1:120:8', '1:300:4']);
    expect(planetsInRange(m, '2:10', '1:200', { tags: ['red'] }).map(([c]) => c)).toEqual(['1:300:4', '2:5:1']);
    expect(planetsInRange(m, '1:1', '1:499', { hide: ['vacation'] }).map(([c]) => c)).toEqual(['1:120:2', '1:300:4']);
  });

  it('moves the old galaxy targets and rivals once', () => {
    const moved = migrateOld(EMPTY_MARKS, { targets: [{ coords: '1:2:3', planet: 'A', player: 'Bob', at: 9 }], rivals: [{ id: 7, name: 'Riv', at: 8 }] })!;
    expect(moved.planets['1:2:3']).toMatchObject({ tag: 'red', planet: 'A', player: 'Bob' });
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
    const c = tagButton({ doc: document, store, t }, '1:2:3', info());
    document.body.append(c);
    c.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    expect(loadMarks(store.get(MARKS_KEY, null)).planets['1:2:3']?.tag).toBe('red');
    c.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    expect(loadMarks(store.get(MARKS_KEY, null)).planets['1:2:3']).toBeUndefined();
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

describe('targets window', () => {
  it('lists flagged players and coloured planets, statuses from the public API', async () => {
    const store = new Store(new MemoryStore(), 'x');
    let m = flagPlayer(EMPTY_MARKS, 5, 'Bob', 'watch', 1);
    m = tagPlanet(m, '1:300:4', 'red', info('Bob', 5), 1);
    m = tagPlanet(m, '1:301:4', 'red', info('Al', 6), 1);
    store.set(MARKS_KEY, m);
    const fetchImpl = vi.fn(async (_u: string, _i?: RequestInit) => new Response('<?xml version="1.0"?><players timestamp="1"><player id="5" name="Bob" status=""/><player id="6" name="Al" status="v"/></players>'));
    const guard = new NetworkGuard(fetchImpl, 'http://localhost:3000');
    openTargets({ doc: document, store, guard, t, locale: 'it', here: '1:300:7' });
    const root = () => document.getElementById(TARGETS_ID)!.shadowRoot!;
    expect(root().querySelector('.row .name')?.textContent).toBe('Bob');
    root().querySelectorAll<HTMLButtonElement>('.tab')[1]!.click();
    expect(root().querySelectorAll('.rows .row')).toHaveLength(2);
    // Al is on vacation today: hidden by the default filter once players.xml is read.
    await vi.waitFor(() => expect(root().querySelectorAll('.rows .row')).toHaveLength(1));
    expect(fetchImpl.mock.calls[0]![1]?.credentials).toBe('omit');
    expect(root().querySelector('.coords')?.getAttribute('href')).toContain('component=galaxy&galaxy=1&system=300&position=4');
  });
});
