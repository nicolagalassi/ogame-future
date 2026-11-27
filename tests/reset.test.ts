import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../src/core/storage';
import { resetKeys } from '../src/engines/reset';

const HERE = 'future:s200-it.ogame.gameforge.com:300400';
const OTHER = 'future:s150-it.ogame.gameforge.com:100200';

describe('starting over in this universe', () => {
  const kv = new MemoryStore();
  for (const ns of [HERE, OTHER])
    for (const key of ['keys.map', 'fleet.settings', 'fleet.profiles', 'marks.view', 'exp.journal', 'account.history', 'orion.archive', 'orion.mult', 'marks', 'planner', 'positions', 'account.snapshot'])
      kv.set(`${ns}:${key}`, 1);
  kv.set('future:tour.seen', {});

  it('settings: every choice of this universe, with the bodies rules; nothing else', () => {
    expect(resetKeys(kv.keys(), HERE, 'settings').map((k) => k.slice(HERE.length + 1)).sort()).toEqual(['fleet.profiles', 'fleet.settings', 'keys.map', 'marks.view']);
  });

  it('statistics: journal, history and Orion of this universe; targets, plans and other universes stay', () => {
    const gone = resetKeys(kv.keys(), HERE, 'stats');
    expect(gone.map((k) => k.slice(HERE.length + 1)).sort()).toEqual(['account.history', 'exp.journal', 'orion.archive', 'orion.mult']);
    for (const k of gone) kv.delete(k);
    expect(kv.get(`${HERE}:exp.journal`, 'default')).toBe('default');
    expect(kv.get(`${OTHER}:exp.journal`, 0)).toBe(1);
    expect(kv.get(`${HERE}:marks`, 0)).toBe(1);
  });
});
