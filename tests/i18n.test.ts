import { describe, expect, it } from 'vitest';
import it_ from '../src/i18n/it.json';
import en from '../src/i18n/en.json';
import fr from '../src/i18n/fr.json';
import de from '../src/i18n/de.json';
import { detectLocale, translator } from '../src/core/i18n';

describe('i18n', () => {
  it('every language has the same keys as English', () => {
    const keys = Object.keys(en).sort();
    for (const dict of [it_, fr, de]) expect(Object.keys(dict).sort()).toEqual(keys);
  });

  it('follows the UI language, not the server one', () => {
    document.head.innerHTML = '<meta name="ogame-language" content="en"><meta name="ogame-ui-language" content="it">';
    expect(detectLocale(document)).toBe('it');
    document.head.innerHTML = '<meta name="ogame-language" content="de">';
    expect(detectLocale(document)).toBe('de');
  });

  it('fills placeholders', () => {
    expect(translator('it')('data.missing', { count: 3 })).toContain('3 pianeti');
  });
});
