import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readCurrentResources, readPlanetList } from '../src/data/planet-list';
import { renderPlanetMenu } from '../src/modules/planet-menu';
import { translator } from '../src/core/i18n';
import { PLANET_LIST_HTML, SNAPSHOT } from './fixtures';

const t = translator('it');
const draw = (mode: 'stacked' | 'compact', onModeChange = vi.fn()) =>
  renderPlanetMenu({ doc: document, entries: readPlanetList(document), snapshot: SNAPSHOT, mode, now: 0, locale: 'it', t, onModeChange });

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = PLANET_LIST_HTML;
});

describe('readPlanetList', () => {
  it('reads ids, coords, names and the current body', () => {
    const [a, b] = readPlanetList(document);
    expect(a).toMatchObject({ planetId: 1, moonId: 2, coords: '5:185:2', name: 'Yolen', current: 'planet' });
    expect(b).toMatchObject({ planetId: 3, moonId: null, current: null });
  });

  it('reads the resource bar from data-raw', () => {
    document.body.insertAdjacentHTML('beforeend',
      '<span id="resources_metal" data-raw="12"></span><span id="resources_crystal" data-raw="3"></span><span id="resources_deuterium" data-raw="0"></span>');
    expect(readCurrentResources(document)).toEqual({ metal: 12, crystal: 3, deuterium: 0 });
  });
});

describe('renderPlanetMenu', () => {
  it('adds planet and moon rows on the game links themselves', () => {
    draw('stacked');
    const planetLink = document.querySelector('#planet-1 a.planetlink')!;
    const moonLink = document.querySelector('#planet-1 a.moonlink')!;
    expect(planetLink.querySelector('.fut-name .planet-name')?.textContent).toBe('Yolen');
    expect(planetLink.querySelectorAll('.fut-res span')).toHaveLength(3);
    expect(moonLink.querySelector('.fut-moon-label')?.textContent).toBe('Luna');
    expect(moonLink.getAttribute('href')).toContain('cp=2');
    expect(document.querySelector('#planet-1 .fut-m')?.textContent).toBe('38,3M');
    expect(document.querySelector('#planet-1 .fut-m')?.classList.contains('fut-full')).toBe(true);
  });

  it('marks bodies missing from the snapshot instead of printing NaN', () => {
    draw('stacked');
    const cells = document.querySelectorAll('#planet-3 .fut-res span');
    expect(Array.from(cells).every((c) => c.textContent === '—')).toBe(true);
    expect(document.body.textContent).not.toMatch(/NaN|undefined/);
  });

  it('can be redrawn without duplicating anything', () => {
    draw('stacked');
    draw('compact');
    expect(document.querySelectorAll('.fut-menu-bar')).toHaveLength(1);
    expect(document.querySelectorAll('#planet-1 .fut-res')).toHaveLength(2); // planet + moon
    expect(document.querySelectorAll('.fut-name')).toHaveLength(2);
    expect(document.getElementById('planetList')?.classList.contains('fut-mode-compact')).toBe(true);
  });

  it('the mode buttons only call back, with no navigation', () => {
    const onModeChange = vi.fn();
    draw('stacked', onModeChange);
    const [, compact] = Array.from(document.querySelectorAll<HTMLButtonElement>('.fut-menu-bar button'));
    compact!.click();
    expect(onModeChange).toHaveBeenCalledWith('compact');
  });
});
