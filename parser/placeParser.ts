/**
 * Parser for .place files: a site the brand's posts speak about (a shop, a bar, an office),
 * with its address, coordinates, capacity and opening hours: the regular week, a new week from a day on,
 * and named sets of special days. The area the brand is in is the
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

/** A week's opening hours per weekday, ranges in order. A weekday that isn't there is closed. */
export type WeekHours = Partial<Record<Weekday, OpeningRange[]>>;

/** A regular week that replaces the one before it from a day on (`hours from DATE`). */
export interface HoursFrom {
  /** `YYYY-MM-DD`: the first day the week holds. */
  from: string;
  hours: WeekHours;
}

/** One line of a set of special days: a date or a run of dates with their times. */
export interface SpecialDays {
  /** `YYYY-MM-DD`: the first day. */
  from: string;
  /** `YYYY-MM-DD`: the last day; the same as `from` for a single date. */
  to: string;
  /** The times of each of these days, in order. Empty = closed. */
  ranges: OpeningRange[];
}

/** A named set of special days (`hours NAME`): the days around a holiday, with their dates. */
export interface SpecialHours {
  name: string;
  /** The set's lines in date order. */
  days: SpecialDays[];
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
  hours?: WeekHours;
  /** Regular weeks that replace `hours` from a day on, in date order. */
  hoursFrom?: HoursFrom[];
  /** Named sets of special days, as declared. On their dates they come before the regular week. */
  specialHours?: SpecialHours[];
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
const SET_NAME = /^[a-z][a-z0-9-]*$/;

/** `mon`, `mon-fri` or `fri-mon` (wraps over the week end) → the weekdays, Monday first. */
export function parseDays(spec: string): Weekday[] | null {
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
  let hours: WeekHours | undefined;
  const hoursFrom: HoursFrom[] = [];
  const specialHours: SpecialHours[] = [];
  let capacity: PlaceCapacity | undefined;
  /** The open block: a week (`hours`, `hours from DATE`), a set of special days (`hours NAME`) or `capacity`. */
  let block: { week: WeekHours } | { set: SpecialHours } | 'capacity' | null = null;

  /** `08:00-18:00`, `Lunch 12:00-14:00, Evening 17:00-22:00` or `closed` (no ranges). */
  const parseRanges = (value: string, lineNum: number): OpeningRange[] => {
    if (value === 'closed') return [];
    return value.split(',').map(part => {
      const m = RANGE.exec(part.trim());
      if (!m || !TIME.test(m[2]) || !TIME.test(m[3]) || m[2] === '24:00') {
        throw new Error(`${fileName}:${lineNum}: invalid opening range "${part.trim()}" (expected "HH:MM-HH:MM", optionally after a label, or closed)`);
      }
      if (m[2] === m[3]) throw new Error(`${fileName}:${lineNum}: opening range "${part.trim()}" starts and ends at the same time`);
      return { ...(m[1] ? { label: m[1] } : {}), from: m[2], to: m[3] };
    });
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
      if (line === 'hours') {
        if (hours) throw new Error(`${fileName}:${lineNum}: duplicate hours block`);
        hours = {};
        block = { week: hours };
        return;
      }
      const head = /^hours\s+(.+)$/.exec(line.replace(/\s+#.*$/, ''));
      if (head) {
        const from = /^from\s+(.+)$/.exec(head[1]);
        if (from) {
          if (!isDate(from[1])) throw new Error(`${fileName}:${lineNum}: "hours from" needs a date YYYY-MM-DD, got "${from[1]}"`);
          if (hoursFrom.some(h => h.from === from[1])) throw new Error(`${fileName}:${lineNum}: duplicate "hours from ${from[1]}"`);
          const week: WeekHours = {};
          hoursFrom.push({ from: from[1], hours: week });
          block = { week };
          return;
        }
        if (head[1] === 'from' || !SET_NAME.test(head[1])) {
          throw new Error(`${fileName}:${lineNum}: expected "hours", "hours from YYYY-MM-DD" or "hours NAME" (lowercase, e.g. hours christmas), got "${line}"`);
        }
        if (specialHours.some(s => s.name === head[1])) throw new Error(`${fileName}:${lineNum}: duplicate "hours ${head[1]}"`);
        const set: SpecialHours = { name: head[1], days: [] };
        specialHours.push(set);
        block = { set };
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
    if ('set' in block) {
      // A date or a run of dates: `2026-12-24: …`, `2026-12-25..2026-12-26: …`
      const m = colonIdx === -1 ? null : /^(\S+?)(?:\.\.(\S+))?$/.exec(entry.slice(0, colonIdx).trim());
      if (!m) throw new Error(`${fileName}:${lineNum}: entry of "hours ${block.set.name}" must be "DATE: RANGES" or "DATE..DATE: RANGES", got "${line}"`);
      const [from, to] = [m[1], m[2] ?? m[1]];
      for (const date of [from, to]) {
        if (!isDate(date)) throw new Error(`${fileName}:${lineNum}: "hours ${block.set.name}" lists dates YYYY-MM-DD, got "${date}"`);
      }
      if (to < from) throw new Error(`${fileName}:${lineNum}: ${from}..${to} ends before it starts`);
      for (const set of specialHours) {
        const taken = set.days.find(d => from <= d.to && d.from <= to);
        if (taken) throw new Error(`${fileName}:${lineNum}: ${taken.from > from ? taken.from : from} already has hours${set === block.set ? '' : ` in "hours ${set.name}"`}`);
      }
      block.set.days.push({ from, to, ranges: parseRanges(entry.slice(colonIdx + 1).trim(), lineNum) });
      return;
    }
    if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: hours entry must be "DAYS: RANGES", got "${line}"`);
    const daySpec = entry.slice(0, colonIdx).trim();
    const days = parseDays(daySpec);
    if (!days) throw new Error(`${fileName}:${lineNum}: invalid days "${daySpec}" (expected a day like mon or a range like mon-fri)`);
    const ranges = parseRanges(entry.slice(colonIdx + 1).trim(), lineNum);
    for (const day of days) {
      if (block.week[day]) throw new Error(`${fileName}:${lineNum}: ${day} already has hours`);
      block.week[day] = ranges;
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
  if (hoursFrom.length && !hours) throw new Error(`${fileName}: "hours from ${hoursFrom[0].from}" needs the regular hours block it replaces`);
  const empty = specialHours.find(s => !s.days.length);
  if (empty) throw new Error(`${fileName}: empty "hours ${empty.name}" block (add a line "YYYY-MM-DD: RANGES")`);
  // Monday first; closed days stay out: a day that isn't named is closed
  const week = (w: WeekHours) => Object.fromEntries(WEEKDAYS.filter(d => w[d]?.length).map(d => [d, w[d]!])) as WeekHours;
  const days = hours && week(hours);
  const byDate = <T extends { from: string }>(list: T[]) => [...list].sort((a, b) => a.from.localeCompare(b.from));

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
    ...(hoursFrom.length ? { hoursFrom: byDate(hoursFrom).map(h => ({ from: h.from, hours: week(h.hours) })) } : {}),
    ...(specialHours.length ? { specialHours: specialHours.map(s => ({ name: s.name, days: byDate(s.days) })) } : {}),
    ...(capacity ? { capacity } : {}),
  };
}

/** The week's opening hours as lines: consecutive days (Monday first) with the same times share
 *  a line, closed days are left out. Labels don't count: `Lunch 12:00-14:00` and `12:00-14:00` match. */
export function weekOpeningDays(hours: WeekHours): OpeningDays[] {
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

/** The regular week that holds on a YYYY-MM-DD date: the latest `hours from` block that has started,
 *  else the `hours` block. Undefined = the place has no opening hours. */
export function weekHoursOn(place: Pick<ParsedPlace, 'hours' | 'hoursFrom'>, date: string): WeekHours | undefined {
  return [...(place.hoursFrom ?? [])].reverse().find(h => h.from <= date)?.hours ?? place.hours;
}

/** The next regular week that has not started on a YYYY-MM-DD date: what a page announces. */
export function upcomingHours(place: Pick<ParsedPlace, 'hoursFrom'>, date: string): HoursFrom | undefined {
  return place.hoursFrom?.find(h => h.from > date);
}

/** A place's set of special days by name, while it still has a day on or after a YYYY-MM-DD date.
 *  After its last day there is nothing left to announce. */
export function specialHoursOn(place: Pick<ParsedPlace, 'specialHours'>, name: string, date: string): SpecialHours | undefined {
  const set = place.specialHours?.find(s => s.name === name);
  return set && set.days[set.days.length - 1].to >= date ? set : undefined;
}

/** The opening ranges of a YYYY-MM-DD date, empty when closed: a special day first, else the weekday of
 *  the regular week that holds; before `opening:` the place is closed. */
export function hoursOn(place: Pick<ParsedPlace, 'hours' | 'hoursFrom' | 'specialHours' | 'opening'>, date: string): OpeningRange[] {
  if (!isOpenYet(place, date)) return [];
  for (const set of place.specialHours ?? []) {
    const special = set.days.find(d => d.from <= date && date <= d.to);
    if (special) return special.ranges;
  }
  return weekHoursOn(place, date)?.[weekdayOf(date)] ?? [];
}

/** The street part of an address, up to its first comma: "Quay 3" of "Quay 3, Harbour Town". */
export function addressStreet(address: string): string {
  return address.split(',')[0].trim();
}

/** The weekday of a YYYY-MM-DD date. */
export function weekdayOf(date: string): Weekday {
  return WEEKDAYS[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7];
}
