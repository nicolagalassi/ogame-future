import { describe, expect, it } from 'vitest';
import { placeOnViewport, revealActiveTabs } from '../src/core/viewport';

const vv = (scale: number) => ({ scale, offsetLeft: 10, offsetTop: 200, width: 1000, height: 2000 }) as unknown as VisualViewport;

describe('fitting Future to a phone screen', () => {
  it('a window covers what is on screen at the phone size (a little larger), and is left alone at zoom 1', () => {
    const el = document.createElement('div');
    placeOnViewport(el, vv(0.4), 'cover');
    expect(el.style.left).toBe('10px');
    expect(el.style.top).toBe('200px');
    // 1000 CSS px seen at 0.4 = 400 phone px, drawn 15% larger: laid out at about 348, scaled 2.875×.
    expect(parseFloat(el.style.width)).toBeCloseTo(400 / 1.15, 1);
    expect(el.style.transform).toBe(`scale(${1.15 / 0.4})`);
    placeOnViewport(el, vv(1), 'cover');
    expect(el.style.transform).toBe('');
    expect(el.style.width).toBe('');
  });

  it('the touch bar sits on the bottom edge at the phone size', () => {
    const el = document.createElement('div');
    placeOnViewport(el, vv(0.4), 'bottom');
    expect(el.style.top).toBe('2200px');
    expect(el.style.width).toBe('400px');
    expect(el.style.transform).toBe('scale(2.5) translateY(-100%)');
  });

  it('a strip of tabs too long for the screen scrolls to the one in use', () => {
    const strip = document.createElement('div');
    strip.className = 'tabs';
    strip.innerHTML = '<button>a</button><button aria-pressed="true">b</button>';
    document.body.append(strip);
    const tab = strip.lastElementChild as HTMLElement;
    Object.defineProperty(strip, 'scrollWidth', { value: 600 });
    Object.defineProperty(strip, 'clientWidth', { value: 300 });
    Object.defineProperty(strip, 'offsetWidth', { value: 300 });
    strip.getBoundingClientRect = () => ({ left: 0, right: 300, width: 300 }) as DOMRect;
    tab.getBoundingClientRect = () => ({ left: 450, right: 550, width: 100 }) as DOMRect;
    revealActiveTabs(document);
    expect(strip.scrollLeft).toBe(266);
    strip.remove();
  });
});
