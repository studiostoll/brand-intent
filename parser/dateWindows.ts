// Date windows — named yearly date ranges (`windows` block in .brand).
// Samples (`@name`) and brand photos (`when:`) that only fit part of the year reference them.

/** One yearly range, inclusive, as `MM-DD`. `from` after `to` wraps over the year end. */
export interface DateWindowRange {
  from: string;
  to: string;
}

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Parse `MM-DD..MM-DD[, MM-DD..MM-DD …]`. Throws a message without file/line prefix. */
export function parseDateWindowRanges(value: string): DateWindowRange[] {
  const parts = value.split(',').map(p => p.trim());
  if (parts.length === 0 || parts.some(p => !p)) throw new Error(`expected "MM-DD..MM-DD", got "${value}"`);
  return parts.map(part => {
    const m = part.match(/^(\d{2}-\d{2})\.\.(\d{2}-\d{2})$/);
    if (!m) throw new Error(`expected "MM-DD..MM-DD", got "${part}"`);
    for (const md of [m[1], m[2]]) {
      const [month, day] = md.split('-').map(Number);
      if (month < 1 || month > 12 || day < 1 || day > DAYS_IN_MONTH[month - 1]) throw new Error(`invalid date "${md}"`);
    }
    return { from: m[1], to: m[2] };
  });
}

/** True when `date` (local calendar day) falls in any of the ranges. */
export function isInDateWindow(ranges: DateWindowRange[], date: Date): boolean {
  const key = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return ranges.some(({ from, to }) => (from <= to ? key >= from && key <= to : key >= from || key <= to));
}

/** Trailing window marker on a sample line: `Raps blüht im Mai  @rapsbluete`. */
export const SAMPLE_WINDOW_MARKER = /\s+@([a-z][a-z0-9-]*)\s*$/;
