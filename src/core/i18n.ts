import it from '../i18n/it.json';
import en from '../i18n/en.json';
import fr from '../i18n/fr.json';
import de from '../i18n/de.json';

export type Locale = 'it' | 'en' | 'fr' | 'de';
type Dictionary = Record<string, string>;

const dictionaries: Record<Locale, Dictionary> = { it, en, fr, de };

/** Picks the game's language from the page, falling back to English. */
export function detectLocale(doc: Document): Locale {
  const lang = doc.querySelector('meta[name="ogame-language"]')?.getAttribute('content') ?? doc.documentElement.lang;
  const short = (lang ?? '').slice(0, 2).toLowerCase();
  return short in dictionaries ? (short as Locale) : 'en';
}

/** Returns a translator; missing keys fall back to English, then to the key itself. */
export function translator(locale: Locale) {
  const dict = dictionaries[locale];
  return (key: string, vars: Record<string, string | number> = {}): string => {
    const text = dict[key] ?? dictionaries.en[key] ?? key;
    return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
  };
}
