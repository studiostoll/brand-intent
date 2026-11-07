/**
 * Parser for .time files: the brand's rhythm. When it started, its seasons and windows, its day
 * (`daily`). Facts, not voice: the identity says what the early morning means, the `.time` says the
 * oven is on at four.
 *
 * Nothing in the file is an occasion: a Saturday bread, a baking class, a mill day are works
 * (`.work`) with a day or a date of their own. A `when:` on a purpose example, a brand photo, a story
 * or a story page names one entry: a window or a season. `isInSeason` says whether it fits a day.
 *
 * Strict, line-based format. Every line must match a known pattern or be blank.
 * Throws on parse errors with file name and line number.
 */

import { parseDateWindowRanges, isInDateWindow, type DateWindowRange } from './dateWindows';
import { parseDays, type Weekday } from './placeParser';

// ── Parsed types ──────────────────────────────────────────────────────────────

/** `HH:MM-HH:MM` or a single `HH:MM`. */
export interface TimeSpan {
  from: string;
  to?: string;
}

/** A season of the brand's year. Runs until the next season starts, wrapping over the year end. */
export interface ParsedSeason {
  name: string;
  /** The season's name as people say it. `{season}` shows it. */
  label: string;
  /** `MM-DD`: the day the season starts. */
  from: string;
}

/** A named moment of the brand's day. */
export interface ParsedDailyMoment {
  name: string;
  /** `HH:MM`. `{daily NAME}` shows it. */
  time: string;
  /** What happens then; a fact for AI writing. */
  label?: string;
}

export interface ParsedTime {
  /** Header comment, if any. */
  description: string;
  /** `YYYY-MM-DD` or `YYYY`: when the brand started. A bare year counts from January 1. */
  founded?: string;
  /** Seasons in file order; none or at least two. */
  seasons: ParsedSeason[];
  /** Named yearly date windows: name → ranges. */
  windows: Record<string, DateWindowRange[]>;
  /** Named moments of the day, in order. */
  daily: ParsedDailyMoment[];
}

/** One `.time` entry a `when:` can name. */
export type TimeEntry =
  | { kind: 'window'; name: string; ranges: DateWindowRange[] }
  | { kind: 'season'; name: string; season: ParsedSeason };

// ── Constants ─────────────────────────────────────────────────────────────────

const NAME = /^[a-z][a-z0-9-]*$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const SEASON_KEYS = new Set(['label', 'from']);

/** `MM-DD` with a real month and day. */
export function isMonthDay(value: string): boolean {
  const m = /^(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const month = Number(m[1]), day = Number(m[2]);
  return month >= 1 && month <= 12 && day >= 1 && day <= DAYS_IN_MONTH[month - 1];
}

/** A real calendar date written YYYY-MM-DD. */
export function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

/** `YYYY-MM-DD` or `YYYY`, as `founded:` and a person's `since:` take it. */
export function isDateOrYear(value: string): boolean {
  return /^\d{4}$/.test(value) || isDate(value);
}

/** `HH:MM-HH:MM` or `HH:MM` → a span, or null. */
export function parseTimeSpan(value: string): TimeSpan | null {
  const m = /^(\d{2}:\d{2})(?:-(\d{2}:\d{2}))?$/.exec(value);
  if (!m || !TIME.test(m[1]) || (m[2] && !TIME.test(m[2]))) return null;
  return m[2] ? { from: m[1], to: m[2] } : { from: m[1] };
}

/** `sat`, `thu-fri`, `mon, wed` → the weekdays, Monday first, each once. */
export function parseDayList(value: string): Weekday[] | null {
  const out: Weekday[] = [];
  for (const part of value.split(',').map(p => p.trim())) {
    const days = parseDays(part);
    if (!days) return null;
    for (const d of days) if (!out.includes(d)) out.push(d);
  }
  const order: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  return out.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

// ── Main parser ───────────────────────────────────────────────────────────────

type Block =
  | { kind: 'season'; name: string; line: number; props: Record<string, { value: string; line: number }> }
  | { kind: 'windows'; line: number }
  | { kind: 'daily'; line: number };

export function parseTimeFile(content: string, fileName: string): ParsedTime {
  let description = '';
  let founded: { value: string; line: number } | undefined;
  const blocks: Block[] = [];
  const windowsRaw: Array<{ name: string; value: string; line: number }> = [];
  const dailyRaw: Array<{ name: string; value: string; line: number }> = [];
  let block: Block | null = null;
  /** Every name in the file, with the line it was declared on: names are unique across the file. */
  const names = new Map<string, number>();
  const declare = (name: string, lineNum: number, what: string) => {
    if (!NAME.test(name)) throw new Error(`${fileName}:${lineNum}: ${what} name must be lowercase kebab-case, got "${name}"`);
    const prev = names.get(name);
    if (prev !== undefined) throw new Error(`${fileName}:${lineNum}: "${name}" is already declared on line ${prev} (names are unique across the file)`);
    names.set(name, lineNum);
  };

  content.split('\n').forEach((rawLine, i) => {
    const lineNum = i + 1;
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();
    if (line === '') return;
    if (line.startsWith('#')) {
      if (indent === 0) description = description ? `${description} ${line.slice(1).trim()}` : line.slice(1).trim();
      return;
    }

    if (indent === 0) {
      block = null;
      const header = /^(season|weekly|date)\s+(\S+)\s*$/.exec(line);
      if (header && header[1] !== 'season') {
        // Occasions left the .time in v0.44: each is a work with its own day or date
        const key = header[1] === 'weekly' ? 'days:' : 'on:';
        throw new Error(`${fileName}:${lineNum}: ${header[1]} "${header[2]}" is not part of the .time: an event is a work. Write works/${header[2]}.work with ${key}, and name it with work: instead of when:`);
      }
      if (header) {
        declare(header[2], lineNum, 'season');
        const named: Block = { kind: 'season', name: header[2], line: lineNum, props: {} };
        block = named;
        blocks.push(named);
        return;
      }
      if (line === 'windows' || line === 'daily') {
        if (blocks.some(b => b.kind === line)) throw new Error(`${fileName}:${lineNum}: duplicate ${line} block`);
        const plain: Block = { kind: line, line: lineNum };
        block = plain;
        blocks.push(plain);
        return;
      }
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: expected "founded: DATE", a "season NAME" block, "windows" or "daily", got "${line}"`);
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim().replace(/\s+#.*$/, '');
      if (key !== 'founded') throw new Error(`${fileName}:${lineNum}: unknown key "${key}" (expected founded, or a season, windows or daily block)`);
      if (founded) throw new Error(`${fileName}:${lineNum}: duplicate "founded"`);
      if (!isDateOrYear(value)) throw new Error(`${fileName}:${lineNum}: founded must be a date YYYY-MM-DD or a year YYYY, got "${value}"`);
      founded = { value, line: lineNum };
      return;
    }

    if (!block || indent !== 2) throw new Error(`${fileName}:${lineNum}: unexpected indent (entries use 2 spaces under their block)`);
    const entry = line.replace(/\s+#.*$/, '');
    const colonIdx = entry.indexOf(':');
    if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: expected "key: value", got "${line}"`);
    const key = entry.slice(0, colonIdx).trim();
    const value = entry.slice(colonIdx + 1).trim();
    if (block.kind === 'windows') {
      declare(key, lineNum, 'window');
      windowsRaw.push({ name: key, value, line: lineNum });
      return;
    }
    if (block.kind === 'daily') {
      declare(key, lineNum, 'daily');
      dailyRaw.push({ name: key, value, line: lineNum });
      return;
    }
    if (!SEASON_KEYS.has(key)) throw new Error(`${fileName}:${lineNum}: unknown key "${key}" in season "${block.name}" (expected ${[...SEASON_KEYS].join(', ')})`);
    if (block.props[key]) throw new Error(`${fileName}:${lineNum}: duplicate "${key}" in season "${block.name}"`);
    if (!value) throw new Error(`${fileName}:${lineNum}: empty ${key}`);
    block.props[key] = { value, line: lineNum };
  });

  const seasons: ParsedSeason[] = [];
  for (const b of blocks) {
    if (b.kind !== 'season') continue;
    const at = (key?: string) => `${fileName}:${key && b.props[key] ? b.props[key].line : b.line}`;
    const need = (key: string) => {
      if (!b.props[key]) throw new Error(`${at()}: season "${b.name}" needs ${key}:`);
      return b.props[key].value;
    };
    const from = need('from');
    if (!isMonthDay(from)) throw new Error(`${at('from')}: season "${b.name}" from must be "MM-DD" (e.g. 03-01), got "${from}"`);
    const twin = seasons.find(s => s.from === from);
    if (twin) throw new Error(`${at('from')}: seasons "${twin.name}" and "${b.name}" both start on ${from}`);
    seasons.push({ name: b.name, label: need('label'), from });
  }
  if (seasons.length === 1) throw new Error(`${fileName}: one season is no season (declare at least two, or none)`);

  const windows: Record<string, DateWindowRange[]> = {};
  for (const w of windowsRaw) {
    try { windows[w.name] = parseDateWindowRanges(w.value); }
    catch (e) { throw new Error(`${fileName}:${w.line}: window "${w.name}": ${(e as Error).message}`); }
  }

  const daily: ParsedDailyMoment[] = [];
  for (const d of dailyRaw) {
    const m = /^(\d{2}:\d{2})(?:\s+(.+))?$/.exec(d.value);
    if (!m || !TIME.test(m[1])) throw new Error(`${fileName}:${d.line}: daily "${d.name}" must be "HH:MM" followed by an optional label, got "${d.value}"`);
    const prev = daily[daily.length - 1];
    if (prev && m[1] < prev.time) throw new Error(`${fileName}:${d.line}: daily "${d.name}" at ${m[1]} comes before "${prev.name}" at ${prev.time} (moments are in order of the day)`);
    daily.push({ name: d.name, time: m[1], ...(m[2] ? { label: m[2].trim() } : {}) });
  }

  return {
    description,
    ...(founded ? { founded: founded.value } : {}),
    seasons,
    windows,
    daily,
  };
}

// ── Lookups ───────────────────────────────────────────────────────────────────

/** The entry a `when:` names, or undefined. A daily moment is not a `when:` target. */
export function timeEntry(time: ParsedTime, name: string): TimeEntry | undefined {
  if (time.windows[name]) return { kind: 'window', name, ranges: time.windows[name] };
  const season = time.seasons.find(s => s.name === name);
  if (season) return { kind: 'season', name, season };
  return undefined;
}

/** Every name a `when:` may use, in file order by kind: windows, then seasons. */
export function timeEntryNames(time: ParsedTime): string[] {
  return [...Object.keys(time.windows), ...time.seasons.map(s => s.name)];
}

/** `MM-DD` of a local calendar day. */
function monthDay(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** The season a day falls in: the latest season start on or before the day, else the latest in the
 *  year (the season that wraps over the year end). Undefined without seasons. */
export function seasonForDate(time: Pick<ParsedTime, 'seasons'>, date: Date): ParsedSeason | undefined {
  const today = monthDay(date);
  let best: ParsedSeason | undefined;
  let latest: ParsedSeason | undefined;
  for (const s of time.seasons) {
    if (s.from <= today && (!best || s.from > best.from)) best = s;
    if (!latest || s.from > latest.from) latest = s;
  }
  return best ?? latest;
}

/** Local midnight of a `YYYY-MM-DD`. */
export function localDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Days from `a` to `b`, local calendar. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() - new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) / 86_400_000);
}

/** Whether a `when:` entry is in season on a day: inside a window or season. An unknown name is never in season. */
export function isInSeason(time: ParsedTime, name: string, date: Date): boolean {
  const entry = timeEntry(time, name);
  if (!entry) return false;
  switch (entry.kind) {
    case 'window': return isInDateWindow(entry.ranges, date);
    case 'season': return seasonForDate(time, date)?.name === name;
  }
}

/** Whole years from a `YYYY-MM-DD` or `YYYY` (January 1) to a day; negative before it. */
export function yearsSince(dateOrYear: string, date: Date): number {
  const start = dateOrYear.length === 4 ? new Date(Number(dateOrYear), 0, 1) : localDate(dateOrYear);
  let years = date.getFullYear() - start.getFullYear();
  if (date.getMonth() < start.getMonth() || (date.getMonth() === start.getMonth() && date.getDate() < start.getDate())) years--;
  return years;
}
