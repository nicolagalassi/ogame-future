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

/**
 * A whole number with the thousands always grouped, also under 10,000 (Italian leaves 5000 as is):
 * 5.000, 100.000, 700.000.000 (5,000 in English).
 */
export function groupInt(value: number, locale = 'it'): string {
  const n = Math.round(value);
  try {
    return new Intl.NumberFormat(locale, { useGrouping: 'always', maximumFractionDigits: 0 } as unknown as Intl.NumberFormatOptions).format(n);
  } catch {
    return n.toLocaleString(locale);
  }
}

/**
 * Number fields: the thousands are grouped while typing (the caret stays after the same digit).
 * Text with a unit ("2m", "500k") is left as typed and grouped when the field is left. Whatever
 * reads the field parses separators away (engines/fleet parseAmount).
 */
export function groupWhileTyping(input: HTMLInputElement, locale = 'it'): void {
  if (input.dataset.futGroup) return;
  input.dataset.futGroup = '1';
  const digitsOnly = (s: string) => /^[\d.,'\s  ]*$/.test(s);
  input.addEventListener('input', () => {
    const raw = input.value;
    if (!digitsOnly(raw)) return;
    const digits = raw.replace(/\D/g, '');
    if (!digits) return;
    const caret = input.selectionStart ?? raw.length;
    const before = raw.slice(0, caret).replace(/\D/g, '').length;
    const out = groupInt(Number(digits), locale);
    if (out === raw) return;
    input.value = out;
    let pos = 0;
    for (let seen = 0; pos < out.length && seen < before; pos++) if (/\d/.test(out[pos]!)) seen++;
    try {
      input.setSelectionRange(pos, pos);
    } catch {
      /* not focused: nothing to keep */
    }
  });
  input.addEventListener('blur', () => {
    const raw = input.value.trim().toLowerCase().replace(/\s/g, '');
    const m = raw.match(/^([\d.,]+)([kmg])$/);
    if (!m) return;
    const unit = m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : 1e9;
    const n = Math.floor(Number(m[1]!.replace(',', '.')) * unit);
    if (Number.isFinite(n) && n > 0) input.value = groupInt(n, locale);
  });
}
