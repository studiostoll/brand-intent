/**
 * Parser for .time files: the brand's time. When it started, its seasons and windows,
 * its week (`weekly NAME`), its dates (`date NAME`) and its day (`daily`). Facts, not voice:
 * the identity says what the early morning means, the `.time` says the oven is on at four.
 *
 * A `when:` on a purpose example, a brand photo, a story or a story page names one entry:
 * a window, a season, a weekly or a date. `isInSeason` says whether it fits a day.
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

/** Something that happens on fixed weekdays. */
export interface ParsedWeekly {
  name: string;
  /** What it is, as a post would say it. `{occasion}` shows it. */
  label: string;
  /** Weekdays, Monday first. */
  days: Weekday[];
  /** When on those days. `{occasion-time}` shows it. */
  time?: TimeSpan;
  /** The place it happens at. */
  place?: string;
  /** Facts for AI writing. */
  context?: string;
}

/** A yearly or one-off date. */
export interface ParsedDate {
  name: string;
  label: string;
  /** `MM-DD` start and end for a yearly date, `YYYY-MM-DD` for a one-off; a single day has `to` = `from`. */
  on: { from: string; to: string; yearly: boolean };
  time?: TimeSpan;
  /** Days before `on` during which the date is in season. Default 14. */
  lead: number;
  place?: string;
  context?: string;
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
  weekly: ParsedWeekly[];
  dates: ParsedDate[];
  /** Named moments of the day, in order. */
  daily: ParsedDailyMoment[];
}

/** One `.time` entry a `when:` can name. */
export type TimeEntry =
  | { kind: 'window'; name: string; ranges: DateWindowRange[] }
  | { kind: 'season'; name: string; season: ParsedSeason }
  | { kind: 'weekly'; name: string; weekly: ParsedWeekly }
  | { kind: 'date'; name: string; date: ParsedDate };

// ── Constants ─────────────────────────────────────────────────────────────────

const NAME = /^[a-z][a-z0-9-]*$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const DEFAULT_LEAD = 14;

const SEASON_KEYS = new Set(['label', 'from']);
const WEEKLY_KEYS = new Set(['label', 'days', 'time', 'place', 'context']);
const DATE_KEYS = new Set(['label', 'on', 'time', 'lead', 'place', 'context']);

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
function parseTimeSpan(value: string): TimeSpan | null {
  const m = /^(\d{2}:\d{2})(?:-(\d{2}:\d{2}))?$/.exec(value);
  if (!m || !TIME.test(m[1]) || (m[2] && !TIME.test(m[2]))) return null;
  return m[2] ? { from: m[1], to: m[2] } : { from: m[1] };
}

/** `sat`, `thu-fri`, `mon, wed` → the weekdays, Monday first, each once. */
function parseDayList(value: string): Weekday[] | null {
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
  | { kind: 'season' | 'weekly' | 'date'; name: string; line: number; props: Record<string, { value: string; line: number }> }
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
      if (header) {
        const kind = header[1] as 'season' | 'weekly' | 'date';
        declare(header[2], lineNum, kind);
        const named: Block = { kind, name: header[2], line: lineNum, props: {} };
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
      if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: expected "founded: DATE", a "season NAME", "weekly NAME" or "date NAME" block, "windows" or "daily", got "${line}"`);
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim().replace(/\s+#.*$/, '');
      if (key !== 'founded') throw new Error(`${fileName}:${lineNum}: unknown key "${key}" (expected founded, or a season, weekly, date, windows or daily block)`);
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
    const keys = block.kind === 'season' ? SEASON_KEYS : block.kind === 'weekly' ? WEEKLY_KEYS : DATE_KEYS;
    if (!keys.has(key)) throw new Error(`${fileName}:${lineNum}: unknown key "${key}" in ${block.kind} "${block.name}" (expected ${[...keys].join(', ')})`);
    if (block.props[key]) throw new Error(`${fileName}:${lineNum}: duplicate "${key}" in ${block.kind} "${block.name}"`);
    if (!value) throw new Error(`${fileName}:${lineNum}: empty ${key}`);
    block.props[key] = { value, line: lineNum };
  });

  const at = (b: Block, key?: string) => `${fileName}:${key && 'props' in b && b.props[key] ? b.props[key].line : b.line}`;
  const need = (b: Extract<Block, { props: unknown }>, key: string) => {
    if (!b.props[key]) throw new Error(`${at(b)}: ${b.kind} "${b.name}" needs ${key}:`);
    return b.props[key].value;
  };
  const optional = (b: Extract<Block, { props: unknown }>, key: string) => b.props[key]?.value;
  const timeOf = (b: Extract<Block, { props: unknown }>): TimeSpan | undefined => {
    const value = optional(b, 'time');
    if (value === undefined) return undefined;
    const span = parseTimeSpan(value);
    if (!span) throw new Error(`${at(b, 'time')}: ${b.kind} "${b.name}" time must be "HH:MM-HH:MM" or "HH:MM", got "${value}"`);
    return span;
  };
  const placeOf = (b: Extract<Block, { props: unknown }>): string | undefined => {
    const value = optional(b, 'place');
    if (value !== undefined && !NAME.test(value)) throw new Error(`${at(b, 'place')}: ${b.kind} "${b.name}" place must be a place id, got "${value}"`);
    return value;
  };

  const seasons: ParsedSeason[] = [];
  const weekly: ParsedWeekly[] = [];
  const dates: ParsedDate[] = [];
  for (const b of blocks) {
    if (b.kind === 'windows' || b.kind === 'daily') continue;
    if (b.kind === 'season') {
      const from = need(b, 'from');
      if (!isMonthDay(from)) throw new Error(`${at(b, 'from')}: season "${b.name}" from must be "MM-DD" (e.g. 03-01), got "${from}"`);
      const twin = seasons.find(s => s.from === from);
      if (twin) throw new Error(`${at(b, 'from')}: seasons "${twin.name}" and "${b.name}" both start on ${from}`);
      seasons.push({ name: b.name, label: need(b, 'label'), from });
      continue;
    }
    if (b.kind === 'weekly') {
      const label = need(b, 'label');
      const daysValue = need(b, 'days');
      const days = parseDayList(daysValue);
      if (!days) throw new Error(`${at(b, 'days')}: weekly "${b.name}" days must be weekdays like sat, thu-fri or mon, wed, got "${daysValue}"`);
      const time = timeOf(b);
      const place = placeOf(b);
      const context = optional(b, 'context');
      weekly.push({ name: b.name, label, days, ...(time ? { time } : {}), ...(place ? { place } : {}), ...(context ? { context } : {}) });
      continue;
    }
    const label = need(b, 'label');
    const onValue = need(b, 'on');
    const m = /^(\d{2}-\d{2}|\d{4}-\d{2}-\d{2})(?:\.\.(\d{2}-\d{2}|\d{4}-\d{2}-\d{2}))?$/.exec(onValue);
    const yearly = !!m && m[1].length === 5;
    const valid = (d: string) => (yearly ? isMonthDay(d) : isDate(d));
    if (!m || !valid(m[1]) || (m[2] && (m[2].length !== m[1].length || !valid(m[2])))) {
      throw new Error(`${at(b, 'on')}: date "${b.name}" on must be "MM-DD", "MM-DD..MM-DD", "YYYY-MM-DD" or "YYYY-MM-DD..YYYY-MM-DD", got "${onValue}"`);
    }
    const to = m[2] ?? m[1];
    if (!yearly && to < m[1]) throw new Error(`${at(b, 'on')}: date "${b.name}" ends before it starts (${onValue})`);
    const leadValue = optional(b, 'lead');
    if (leadValue !== undefined && !/^\d+$/.test(leadValue)) throw new Error(`${at(b, 'lead')}: date "${b.name}" lead must be a whole number of days, got "${leadValue}"`);
    const time = timeOf(b);
    const place = placeOf(b);
    const context = optional(b, 'context');
    dates.push({
      name: b.name, label, on: { from: m[1], to, yearly },
      ...(time ? { time } : {}),
      lead: leadValue !== undefined ? Number(leadValue) : DEFAULT_LEAD,
      ...(place ? { place } : {}),
      ...(context ? { context } : {}),
    });
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
    weekly,
    dates,
    daily,
  };
}

// ── Lookups ───────────────────────────────────────────────────────────────────

/** The entry a `when:` names, or undefined. A daily moment is not a `when:` target. */
export function timeEntry(time: ParsedTime, name: string): TimeEntry | undefined {
  if (time.windows[name]) return { kind: 'window', name, ranges: time.windows[name] };
  const season = time.seasons.find(s => s.name === name);
  if (season) return { kind: 'season', name, season };
  const weekly = time.weekly.find(w => w.name === name);
  if (weekly) return { kind: 'weekly', name, weekly };
  const date = time.dates.find(d => d.name === name);
  if (date) return { kind: 'date', name, date };
  return undefined;
}

/** Every name a `when:` may use, in file order by kind: windows, seasons, weeklies, dates. */
export function timeEntryNames(time: ParsedTime): string[] {
  return [...Object.keys(time.windows), ...time.seasons.map(s => s.name), ...time.weekly.map(w => w.name), ...time.dates.map(d => d.name)];
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
function localDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Days from `a` to `b`, local calendar. */
function daysBetween(a: Date, b: Date): number {
  return Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() - new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) / 86_400_000);
}

/** Start and end of a date's occurrence that could cover `date`, as local dates: the one-off itself, or
 *  the yearly occurrence starting in the year before, the year of, or the year after `date`. */
function dateOccurrences(d: ParsedDate, date: Date): Array<{ start: Date; end: Date }> {
  if (!d.on.yearly) return [{ start: localDate(d.on.from), end: localDate(d.on.to) }];
  const [fm, fd] = d.on.from.split('-').map(Number);
  const [tm, td] = d.on.to.split('-').map(Number);
  return [-1, 0, 1].map(offset => {
    const year = date.getFullYear() + offset;
    const start = new Date(year, fm - 1, fd);
    const end = new Date(d.on.to < d.on.from ? year + 1 : year, tm - 1, td);
    return { start, end };
  });
}

/** Whether a `when:` entry is in season on a day: inside a window or season, on a weekly's days, from
 *  `lead` days before a date to its end. An unknown name is never in season. */
export function isInSeason(time: ParsedTime, name: string, date: Date): boolean {
  const entry = timeEntry(time, name);
  if (!entry) return false;
  switch (entry.kind) {
    case 'window': return isInDateWindow(entry.ranges, date);
    case 'season': return seasonForDate(time, date)?.name === name;
    case 'weekly': {
      const weekday = (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as Weekday[])[(date.getDay() + 6) % 7];
      return entry.weekly.days.includes(weekday);
    }
    case 'date':
      return dateOccurrences(entry.date, date).some(({ start, end }) => {
        const until = daysBetween(date, start);
        return until <= entry.date.lead && daysBetween(date, end) >= 0;
      });
  }
}

/** Whole years from a `YYYY-MM-DD` or `YYYY` (January 1) to a day; negative before it. */
export function yearsSince(dateOrYear: string, date: Date): number {
  const start = dateOrYear.length === 4 ? new Date(Number(dateOrYear), 0, 1) : localDate(dateOrYear);
  let years = date.getFullYear() - start.getFullYear();
  if (date.getMonth() < start.getMonth() || (date.getMonth() === start.getMonth() && date.getDate() < start.getDate())) years--;
  return years;
}
