/**
 * Parser for .place files: a site the brand's posts speak about (a shop, a bar, an office),
 * with its address, coordinates, capacity and regular opening hours. The area the brand is in is the
 * `.brand`'s `location` block; sky and weather use a place's coordinates when it has them.
 *
 * Strict, line-based format. Every line must match a known pattern or be blank.
 * Throws on parse errors with file name and line number.
 */

// ── Parsed types ──────────────────────────────────────────────────────────────

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** Monday first, as the `hours` block counts ranges like `mon-fri`. */
export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** One opening time range on a day. `to` before `from` runs past midnight. */
export interface OpeningRange {
  /** Optional name of the range, e.g. "Lunch". */
  label?: string;
  /** `HH:MM`, 24-hour. */
  from: string;
  /** `HH:MM`, 24-hour; `24:00` is midnight. */
  to: string;
}

export interface ParsedPlace {
  id: string;
  /** Name, as people say it. */
  name: string;
  /** Header comment, if any. */
  description: string;
  /** Decimal degrees, north positive. With `longitude`, or neither. */
  latitude?: number;
  /** Decimal degrees, east positive. */
  longitude?: number;
  /** Postal address, as written on a sign or a post. */
  address?: string;
  /** Link to the place on a map. */
  maps?: string;
  /** Facts about the place for AI writing: what it is like, who comes, what it offers. */
  context?: string;
  /** `YYYY-MM-DD`: the day the place opens. Before it the place is closed every day, whatever `hours` says. */
  opening?: string;
  /** Regular opening hours per weekday, ranges in order. Undefined = the place has no opening hours.
   *  A weekday the block doesn't name is closed. */
  hours?: Partial<Record<Weekday, OpeningRange[]>>;
  /** How many people the place holds, inside and outside. Undefined = not stated. */
  capacity?: PlaceCapacity;
}

/** People a place holds: seats, or standing room where people stand. At least one side is set. */
export interface PlaceCapacity {
  indoor?: number;
  outdoor?: number;
}

/** Days that share the same opening times, Monday first: one line of the week's hours. */
export interface OpeningDays {
  days: Weekday[];
  ranges: OpeningRange[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const KEYS = new Set(['id', 'name', 'address', 'latitude', 'longitude', 'maps', 'context', 'opening']);
const CAPACITY_KEYS = new Set(['indoor', 'outdoor']);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;
const RANGE = /^(?:(.+?)\s+)?(\d{2}:\d{2})-(\d{2}:\d{2})$/;

/** `mon`, `mon-fri` or `fri-mon` (wraps over the week end) → the weekdays, Monday first. */
function parseDays(spec: string): Weekday[] | null {
  const m = /^([a-z]{3})(?:-([a-z]{3}))?$/.exec(spec);
  if (!m) return null;
  const from = WEEKDAYS.indexOf(m[1] as Weekday);
  const to = m[2] ? WEEKDAYS.indexOf(m[2] as Weekday) : from;
  if (from === -1 || to === -1) return null;
  const days: Weekday[] = [];
  for (let i = from; ; i = (i + 1) % 7) {
    days.push(WEEKDAYS[i]);
    if (i === to) break;
  }
  return days;
}

/** A real calendar date written YYYY-MM-DD. */
function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parsePlaceFile(content: string, fileName: string): ParsedPlace {
  const raw: Record<string, { value: string; line: number }> = {};
  let description = '';
  let hours: Partial<Record<Weekday, OpeningRange[]>> | undefined;
  let capacity: PlaceCapacity | undefined;
  let block: 'hours' | 'capacity' | null = null;

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
      if (line === 'hours') {
        if (hours) throw new Error(`${fileName}:${lineNum}: duplicate hours block`);
        hours = {};
        block = 'hours';
        return;
      }
      if (line === 'capacity') {
        if (capacity) throw new Error(`${fileName}:${lineNum}: duplicate capacity block`);
        capacity = {};
        block = 'capacity';
        return;
      }
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: expected "key: value", got "${line}"`);
      const key = line.slice(0, colonIdx).trim();
      // A URL keeps its `#`; elsewhere a trailing ` # …` is a comment
      const rest = line.slice(colonIdx + 1).trim();
      const value = key === 'maps' ? rest : rest.replace(/\s+#.*$/, '');
      if (!KEYS.has(key)) throw new Error(`${fileName}:${lineNum}: unknown key "${key}" (expected ${[...KEYS].join(', ')}, an hours or a capacity block)`);
      if (raw[key]) throw new Error(`${fileName}:${lineNum}: duplicate "${key}"`);
      if (!value) throw new Error(`${fileName}:${lineNum}: empty ${key}`);
      raw[key] = { value, line: lineNum };
      return;
    }

    if (!block || indent !== 2) throw new Error(`${fileName}:${lineNum}: unexpected indent (entries use 2 spaces under "hours" or "capacity")`);
    const entry = line.replace(/\s+#.*$/, '');
    if (block === 'capacity') {
      const m = /^([a-z]+):\s*(.*)$/.exec(entry);
      if (!m || !CAPACITY_KEYS.has(m[1])) throw new Error(`${fileName}:${lineNum}: capacity entry must be "indoor: N" or "outdoor: N", got "${line}"`);
      const side = m[1] as keyof PlaceCapacity;
      if (capacity![side] !== undefined) throw new Error(`${fileName}:${lineNum}: duplicate capacity "${side}"`);
      if (!/^[1-9]\d*$/.test(m[2])) throw new Error(`${fileName}:${lineNum}: capacity ${side} must be a whole number of people, got "${m[2]}"`);
      capacity![side] = Number(m[2]);
      return;
    }
    const colonIdx = entry.indexOf(':');
    if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: hours entry must be "DAYS: RANGES", got "${line}"`);
    const daySpec = entry.slice(0, colonIdx).trim();
    const days = parseDays(daySpec);
    if (!days) throw new Error(`${fileName}:${lineNum}: invalid days "${daySpec}" (expected a day like mon or a range like mon-fri)`);
    const value = entry.slice(colonIdx + 1).trim();
    let ranges: OpeningRange[] = [];
    if (value !== 'closed') {
      ranges = value.split(',').map(part => {
        const m = RANGE.exec(part.trim());
        if (!m || !TIME.test(m[2]) || !TIME.test(m[3]) || m[2] === '24:00') {
          throw new Error(`${fileName}:${lineNum}: invalid opening range "${part.trim()}" (expected "HH:MM-HH:MM", optionally after a label, or closed)`);
        }
        if (m[2] === m[3]) throw new Error(`${fileName}:${lineNum}: opening range "${part.trim()}" starts and ends at the same time`);
        return { ...(m[1] ? { label: m[1] } : {}), from: m[2], to: m[3] };
      });
    }
    for (const day of days) {
      if (hours![day]) throw new Error(`${fileName}:${lineNum}: ${day} already has hours`);
      hours![day] = ranges;
    }
  });

  if (capacity && capacity.indoor === undefined && capacity.outdoor === undefined) throw new Error(`${fileName}: empty capacity block (add "indoor:" or "outdoor:")`);
  if (!raw['id']) throw new Error(`${fileName}: missing place id (add "id:" line)`);
  if (!raw['name']) throw new Error(`${fileName}: place needs name:`);
  if (!raw['latitude'] !== !raw['longitude']) throw new Error(`${fileName}: place needs both latitude: and longitude:, or neither`);
  const degrees = (key: 'latitude' | 'longitude', limit: number) => {
    const { value, line } = raw[key];
    const n = Number(value);
    if (!/^-?\d+(\.\d+)?$/.test(value) || Math.abs(n) > limit) {
      throw new Error(`${fileName}:${line}: ${key} must be decimal degrees (−${limit} to ${limit}), got "${value}"`);
    }
    return n;
  };
  if (raw['maps'] && !/^https:\/\/\S+$/.test(raw['maps'].value)) throw new Error(`${fileName}:${raw['maps'].line}: maps must be an https link`);
  if (raw['opening'] && !isDate(raw['opening'].value)) throw new Error(`${fileName}:${raw['opening'].line}: opening must be a date YYYY-MM-DD, got "${raw['opening'].value}"`);
  // Monday first; closed days stay out: a day that isn't named is closed
  const days = hours && Object.fromEntries(WEEKDAYS.filter(d => hours![d]?.length).map(d => [d, hours![d]!])) as Partial<Record<Weekday, OpeningRange[]>>;

  return {
    id: raw['id'].value,
    name: raw['name'].value,
    description,
    ...(raw['address'] ? { address: raw['address'].value } : {}),
    ...(raw['latitude'] ? { latitude: degrees('latitude', 90), longitude: degrees('longitude', 180) } : {}),
    ...(raw['maps'] ? { maps: raw['maps'].value } : {}),
    ...(raw['context'] ? { context: raw['context'].value } : {}),
    ...(raw['opening'] ? { opening: raw['opening'].value } : {}),
    ...(days ? { hours: days } : {}),
    ...(capacity ? { capacity } : {}),
  };
}

/** The week's opening hours as lines: consecutive days (Monday first) with the same times share
 *  a line, closed days are left out. Labels don't count: `Lunch 12:00-14:00` and `12:00-14:00` match. */
export function weekOpeningDays(hours: Partial<Record<Weekday, OpeningRange[]>>): OpeningDays[] {
  const times = (ranges: OpeningRange[]) => ranges.map(r => `${r.from}-${r.to}`).join(',');
  const lines: OpeningDays[] = [];
  let prev: Weekday | undefined;
  for (const day of WEEKDAYS) {
    const ranges = hours[day];
    if (!ranges?.length) { prev = undefined; continue; }
    const last = lines[lines.length - 1];
    if (last && prev && times(last.ranges) === times(ranges)) last.days.push(day);
    else lines.push({ days: [day], ranges });
    prev = day;
  }
  return lines;
}

/** Whether the place is open on a YYYY-MM-DD date by its `opening:`: false before the day it opens. */
export function isOpenYet(place: Pick<ParsedPlace, 'opening'>, date: string): boolean {
  return !place.opening || date >= place.opening;
}

/** The street part of an address, up to its first comma: "Quay 3" of "Quay 3, Harbour Town". */
export function addressStreet(address: string): string {
  return address.split(',')[0].trim();
}

/** The weekday of a YYYY-MM-DD date. */
export function weekdayOf(date: string): Weekday {
  return WEEKDAYS[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7];
}
