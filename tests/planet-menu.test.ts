import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readCurrentResources, readPlanetList } from '../src/data/planet-list';
import { dataAge, renderPlanetMenu } from '../src/modules/planet-menu';
import { translator } from '../src/core/i18n';
import { PLANET_LIST_HTML, SNAPSHOT } from './fixtures';

const t = translator('it');
const draw = (mode: 'side' | 'compact', onSettingsChange = vi.fn(), onSync = vi.fn(async () => {})) =>
  renderPlanetMenu({
    doc: document, entries: readPlanetList(document), snapshot: SNAPSHOT, settings: { mode, showTotals: true },
    now: 0, locale: 'it', t, onSettingsChange, onSync,
  });

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
    draw('side');
    const planetLink = document.querySelector('#planet-1 a.planetlink')!;
    const moonLink = document.querySelector('#planet-1 a.moonlink')!;
    expect(planetLink.querySelector('.fut-name .planet-name')?.textContent).toBe('Yolen');
    expect(planetLink.querySelectorAll('.fut-res .fut-cell')).toHaveLength(3);
    expect(moonLink.querySelectorAll('.fut-res .fut-cell')).toHaveLength(3);
    expect(moonLink.getAttribute('href')).toContain('cp=2');
    expect(document.querySelector('#planet-1 .fut-m')?.textContent).toBe('38,3M');
    expect(document.querySelector('#planet-1 .fut-m')?.classList.contains('fut-full')).toBe(true);
  });

  it('marks bodies missing from the snapshot instead of printing NaN', () => {
    draw('side');
    const cells = document.querySelectorAll('#planet-3 .fut-res span');
    expect(Array.from(cells).every((c) => c.textContent === '—')).toBe(true);
    expect(document.body.textContent).not.toMatch(/NaN|undefined/);
  });

  it('shows the build queue: game icon kept, amber dot on idle planets', () => {
    draw('side');
    expect(document.querySelector('#planet-1 .fut-idle')).not.toBeNull();
    expect(document.querySelector('#planet-3 .fut-idle')).toBeNull();
    expect(document.querySelector('#planet-3 a.constructionIcon')).not.toBeNull();
    expect(document.getElementById('planet-3')?.classList.contains('fut-building')).toBe(true);
  });

  it('paints storage fill behind planet numbers only, never on moons', () => {
    draw('side');
    const cell = document.querySelector<HTMLElement>('#planet-1 a.planetlink .fut-m')!;
    expect(cell.style.getPropertyValue('--fut-fill')).toMatch(/%$/);
    expect(document.querySelectorAll('#planet-1 a.moonlink .fut-has-fill')).toHaveLength(0);
  });

  it('keeps columns aligned on planets without a moon', () => {
    draw('side');
    expect(document.querySelector('#planet-3 .fut-nomoon')).not.toBeNull();
    expect(document.querySelector('#planet-1 .fut-nomoon')).toBeNull();
  });

  it('falls back to the 1x skin when the image fails, then to a plain sphere', () => {
    draw('side');
    const img = document.querySelector<HTMLImageElement>('#planet-1 img.planetPic')!;
    img.dataset.defaultSrc = 'fallback.png';
    img.dispatchEvent(new Event('error'));
    expect(img.getAttribute('src')).toBe('fallback.png');
    img.dispatchEvent(new Event('error'));
    expect(img.classList.contains('fut-noskin')).toBe(true);
  });

  it('can be redrawn without duplicating anything', () => {
    draw('side');
    draw('compact');
    expect(document.querySelectorAll('.fut-toolbar')).toHaveLength(1);
    expect(document.querySelectorAll('.fut-settings')).toHaveLength(1);
    expect(document.querySelectorAll('.fut-nomoon')).toHaveLength(1);
    expect(document.querySelectorAll('#planet-1 .fut-res')).toHaveLength(2); // planet + moon
    expect(document.querySelectorAll('.fut-name')).toHaveLength(2);
    expect(document.querySelectorAll('.fut-idle')).toHaveLength(1);
    expect(document.getElementById('planetList')?.classList.contains('fut-mode-compact')).toBe(true);
  });

  it('the toolbar view switch only calls back, with no navigation', () => {
    const onSettingsChange = vi.fn();
    draw('side', onSettingsChange);
    document.querySelector<HTMLButtonElement>('.fut-toolbar .fut-tool-compact')!.click();
    expect(onSettingsChange).toHaveBeenCalledWith({ mode: 'compact', showTotals: true });
  });

  it('sync runs only from the button click', () => {
    const onSync = vi.fn(async () => {});
    draw('side', vi.fn(), onSync);
    expect(onSync).not.toHaveBeenCalled();
    document.querySelector<HTMLButtonElement>('.fut-toolbar .fut-tool-sync')!.click();
    expect(onSync).toHaveBeenCalledTimes(1);
  });

  it('settings panel opens from the gear and can hide the totals', () => {
    const onSettingsChange = vi.fn();
    draw('side', onSettingsChange);
    const panel = document.querySelector('.fut-settings')!;
    expect(panel.hasAttribute('hidden')).toBe(true);
    document.querySelector<HTMLButtonElement>('.fut-tool-settings')!.click();
    expect(panel.hasAttribute('hidden')).toBe(false);
    const off = Array.from(panel.querySelectorAll<HTMLButtonElement>('.fut-chip')).find((b) => b.textContent === 'No')!;
    off.click();
    expect(onSettingsChange).toHaveBeenCalledWith({ mode: 'side', showTotals: false });
    document.querySelector<HTMLButtonElement>('.fut-tool-settings')!.click(); // close again for later tests
  });
});

describe('width and banner', () => {
  it('widens the column and shifts the banner only in side-by-side mode', () => {
    document.body.innerHTML = `<div id="planetbarcomponent">${PLANET_LIST_HTML}</div><div id="bannerskyscrapercomponent"></div>`;
    draw('side');
    expect(document.getElementById('planetbarcomponent')?.classList.contains('fut-wide')).toBe(true);
    expect(document.body.classList.contains('fut-banner-shift')).toBe(true);
    draw('compact');
    expect(document.getElementById('planetbarcomponent')?.classList.contains('fut-wide')).toBe(false);
    expect(document.body.classList.contains('fut-banner-shift')).toBe(false);
  });
});

describe('data age badge', () => {
  it('counts minutes, then hours and days, with OGLight colour steps', () => {
    expect(dataAge(0, 5 * 60_000)).toEqual({ text: '5', cls: 'fut-age-fresh' });
    expect(dataAge(0, 20 * 60_000)).toEqual({ text: '20', cls: 'fut-age-warm' });
    expect(dataAge(0, 45 * 60_000)).toEqual({ text: '45', cls: 'fut-age-old' });
    expect(dataAge(0, 3 * 3_600_000)).toEqual({ text: '3h', cls: 'fut-age-old' });
    expect(dataAge(0, 2 * 86_400_000)).toEqual({ text: '2d', cls: 'fut-age-old' });
  });
});
