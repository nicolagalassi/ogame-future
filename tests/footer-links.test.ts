import { describe, expect, it } from 'vitest';
import { addFooterLinks, ostatsUniverse, ostatsUrl } from '../src/modules/footer-links';

describe('footer quick links', () => {
  it('adds ostats.eu at the end of the footer row, once, opening in a new tab', () => {
    document.body.innerHTML = '<div id="siteFooter"><div class="content"><div class="fleft textLeft"><span>13.1.1</span></div><div class="fright textRight"><a href="#">Impostazioni del server</a>|<a href="#">Discord</a></div></div></div>';
    expect(addFooterLinks(document, [{ label: 'ostats.eu', href: 'https://ostats.eu/' }])).toBe(1);
    expect(addFooterLinks(document)).toBe(0);
    const row = document.querySelector('#siteFooter .fright')!;
    expect(row.textContent).toBe('Impostazioni del server|Discord|ostats.eu');
    const a = row.querySelector<HTMLAnchorElement>('a.fut-footlink')!;
    expect(a.href).toBe('https://ostats.eu/');
    expect(a.target).toBe('_blank');
    expect(a.rel).toContain('noopener');
  });

  it('does nothing without the game footer', () => {
    document.body.innerHTML = '';
    expect(addFooterLinks(document)).toBe(0);
  });
});

describe('ostats.eu addresses', () => {
  it('universe and player pages from the game host; home page elsewhere', () => {
    expect(ostatsUniverse('s269-it.ogame.gameforge.com')).toBe('s269-it');
    expect(ostatsUniverse('lobby.ogame.gameforge.com')).toBeNull();
    expect(ostatsUrl('s269-it.ogame.gameforge.com')).toBe('https://ostats.eu/universes/s269-it');
    expect(ostatsUrl('s269-it.ogame.gameforge.com', 100247)).toBe('https://ostats.eu/universes/s269-it/player/100247');
    expect(ostatsUrl('localhost', 5)).toBe('https://ostats.eu/');
  });
});
