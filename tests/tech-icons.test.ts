import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { probeTechIcons, techIcons, TECH_ICONS_KEY } from '../src/data/tech-icons';
import type { Store } from '../src/core/storage';

const memStore = (init: Record<string, unknown> = {}): Store => {
  const data: Record<string, unknown> = { ...init };
  return { get: <T>(k: string, d: T) => (k in data ? (data[k] as T) : d), set: (k: string, v: unknown) => void (data[k] = v) } as unknown as Store;
};

// jsdom does not compute backgrounds: the game's sprite rules, by class, as the browser resolves them.
const RULES: [RegExp, string, string, string][] = [
  [/plasmaTechnology/, 'https://cdn/a.jpg', '21% 68%', '100px'],
  [/lifeformTech12109/, 'https://cdn/lf.jpg', '-320px -296px', '40px'],
  [/sprite_medium|lifeformqueue/, 'https://cdn/a.jpg', '0px 0px', '100px'],
];

describe('tech icons from the game stylesheet', () => {
  beforeEach(() => {
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
      const r = RULES.find(([re]) => re.test(el.className));
      return { backgroundImage: r ? `url("${r[1]}")` : 'none', backgroundPosition: r?.[2] ?? '0% 0%', backgroundSize: 'auto', width: r?.[3] ?? '0px' } as CSSStyleDeclaration;
    });
    document.body.innerHTML = '';
  });
  afterEach(() => vi.restoreAllMocks());

  it('reads base and lifeform tiles the page never listed, skipping unknown classes', () => {
    const found = probeTechIcons(document, [122, 12109, 113, 99999]);
    expect(found['122']).toMatchObject({ url: 'https://cdn/a.jpg', pos: '21% 68%', w: 100 });
    expect(found['12109']).toMatchObject({ url: 'https://cdn/lf.jpg', pos: '-320px -296px', w: 40 });
    expect(found['113']).toBeUndefined();
    expect(found['99999']).toBeUndefined();
    expect(document.body.children).toHaveLength(0);
  });

  it('keeps the tiles already seen and stores the new ones', () => {
    const seen = { url: 'https://cdn/big.jpg', pos: '0px -940px', size: 'auto', w: 100 };
    const store = memStore({ [TECH_ICONS_KEY]: { 12109: seen } });
    const all = techIcons(document, store);
    expect(all['12109']).toEqual(seen);
    expect(all['122']?.pos).toBe('21% 68%');
    expect(store.get<Record<string, unknown>>(TECH_ICONS_KEY, {})['122']).toBeTruthy();
  });
});
