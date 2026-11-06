import { describe, expect, it } from 'vitest';
import type { OwnBody } from '../src/data/account-info';
import { activeLfBuildings, activeLfResearch, readLfSlots, rememberLfSlots, type LfSlots } from '../src/data/lf-slots';

const body = (levels: Record<string, number>, species = 3): OwnBody => ({
  id: 7, type: 'planet', name: 'P', coords: '1:1:1', siblingId: null,
  production: { metal: 0, crystal: 0, deuterium: 0 }, resources: { metal: 0, crystal: 0, deuterium: 0 },
  storage: { metal: 0, crystal: 0, deuterium: 0 }, resourcesAt: 0, species, levels,
});

describe('lifeform slots', () => {
  it('buildings follow the planet species only', () => {
    const b = activeLfBuildings(body({ 11101: 41, 13101: 72 }));
    expect(b).toHaveLength(12);
    expect(b[0]).toEqual({ id: 13101, level: 72, guessed: false });
  });

  it('research mixes species: the seen page wins, else the highest level is guessed', () => {
    // Slot 1: Mechas 9, Kaelesh 16 (game shows 14201); slot 2: Humans 10, Mechas 21.
    const p = body({ 11201: 6, 13201: 9, 14201: 16, 11202: 10, 13202: 21 });
    expect(activeLfResearch(p).map((a) => a.id)).toEqual([14201, 13202]);
    const seen = activeLfResearch(p, [13201, 11202]);
    expect(seen).toEqual([
      { id: 13201, level: 9, guessed: false },
      { id: 11202, level: 10, guessed: false },
    ]);
  });

  it('reads the ids only on the lifeform research page and stores changes', () => {
    history.replaceState(null, '', '/game/index.php?page=ingame&component=lfresearch');
    const list = [14201, 13202, 12105].map((id) => ({ id, name: '', level: 1, built: 1 }));
    expect(readLfSlots(document, list)).toEqual([14201, 13202]);
    history.replaceState(null, '', '/game/index.php?page=ingame&component=overview');
    expect(readLfSlots(document, list)).toBeNull();
    const slots: LfSlots = {};
    expect(rememberLfSlots(slots, 7, [14201])).toBe(true);
    expect(rememberLfSlots(slots, 7, [14201])).toBe(false);
  });
});
