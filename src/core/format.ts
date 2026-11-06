/** Short numbers for tight spaces: 415.9k, 38.3M, 9.5G, with the locale's decimal mark. */
export function formatUnits(value: number, locale = 'it'): string {
  const abs = Math.abs(value);
  const units: [number, string][] = [
    [1e12, 'T'],
    [1e9, 'G'],
    [1e6, 'M'],
    [1e3, 'k'],
  ];
  for (const [size, suffix] of units) {
    // From 999.5 of the unit below, that unit would print "1000": show "1,0" of this one instead.
    if (abs >= size * 0.9995) {
      const n = value / size;
      const digits = Math.abs(n) >= 100 ? 0 : 1;
      return `${n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}${suffix}`;
    }
  }
  return Math.round(value).toLocaleString(locale);
}
