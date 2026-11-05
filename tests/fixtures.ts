import type { AccountSnapshot, OwnBody } from '../src/data/account-info';

/** Simplified copy of the game's #planetList markup (two planets, one moon). */
export const PLANET_LIST_HTML = `
<div id="planetList">
  <div class="smallplanet hightlightPlanet" id="planet-1">
    <a class="planetlink" href="https://s1-it.ogame.gameforge.com/game/index.php?page=ingame&component=overview&cp=1">
      <img class="planetPic" src="p1.png"><span class="planet-name">Yolen</span><span class="planet-koords">[5:185:2]</span>
    </a>
    <a class="moonlink" href="https://s1-it.ogame.gameforge.com/game/index.php?page=ingame&component=overview&cp=2"><img class="icon-moon" src="m.png"></a>
  </div>
  <div class="smallplanet" id="planet-3">
    <a class="planetlink" href="https://s1-it.ogame.gameforge.com/game/index.php?page=ingame&component=overview&cp=3">
      <img class="planetPic" src="p3.png"><span class="planet-name">Mythos</span><span class="planet-koords">[5:356:8]</span>
    </a>
  </div>
</div>`;

export function body(partial: Partial<OwnBody> & Pick<OwnBody, 'id' | 'type'>): OwnBody {
  return {
    name: '', coords: '0:0:0', siblingId: null,
    production: { metal: 0, crystal: 0, deuterium: 0 },
    resources: { metal: 0, crystal: 0, deuterium: 0 },
    storage: { metal: 0, crystal: 0, deuterium: 0 },
    resourcesAt: 0, levels: {},
    ...partial,
  };
}

export const SNAPSHOT: AccountSnapshot = {
  fetchedAt: 0,
  researches: {},
  bodies: [
    body({ id: 1, type: 'planet', production: { metal: 10, crystal: 5, deuterium: 1 },
      resources: { metal: 38_300_000, crystal: 1000, deuterium: 0 },
      storage: { metal: 40_000_000, crystal: 0, deuterium: 0 } }),
    body({ id: 2, type: 'moon', resources: { metal: 292_600_000, crystal: 38_100_000, deuterium: 300_900_000 } }),
  ],
};
