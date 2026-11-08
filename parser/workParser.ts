/**
 * Parser for .work files: a thing the brand puts out or puts on, that posts return to. A bread,
 * a wine, a record, a book, an exhibition, a class, a tasting evening, a show, a mill day. Facts,
 * not voice: what it is, who it is by, what it costs, when it is out or when it takes place.
 *
 * The work carries its own date: a one-off or yearly `on:`, or the `days:` it comes round on.
 * That is why an event is a work and not an entry in the `.time`. `isWorkInSeason` says whether
 * content about the work fits a day; `daysUntil` counts to its next `on:` day.
 *
 * A work that is a series lists its `items:`, one per time it comes round, from its one-off `on:` date:
 * a colour of the day, a word of the week. `workItem` says which item a day gets.
 *
 * Strict, line-based format. Every line must match a known pattern or be blank.
 * Throws on parse errors with file name and line number.
 */

import { isDate, isMonthDay, isInSeason, timeEntryNames, parseTimeSpan, parseDayList, daysBetween, localDate, type ParsedTime, type TimeSpan } from './timeParser';
import { WEEKDAYS, type Weekday } from './placeParser';

// ── Parsed types ──────────────────────────────────────────────────────────────

/** One item of a series: its value as written (`{item}`), an optional name (`{item-name}`) and note (`{item-note}`). */
export interface WorkItem {
  value: string;
  name?: string;
  note?: string;
}

/** When a work comes out, takes place or is on the shelf. `MM-DD` start and end for a yearly date,
 *  `YYYY-MM-DD` for a one-off; a single day has `to` = `from`. */
export interface WorkDate {
  from: string;
  to: string;
  yearly: boolean;
}

export interface ParsedWork {
  id: string;
  /** Header comment, if any. */
  description: string;
  /** The title as posts write it. `{work}` shows it. */
  title: string;
  /** What it is, in the brand's own word: `bread`, `album`, `class`, `event`. `{kind}` shows it. */
  kind: string;
  /** Person or group ids the work is by. Absent: the brand's own. */
  by?: string[];
  /** The day it comes out, takes place or is on the shelf. */
  on?: WorkDate;
  /** The weekdays it comes round on, Monday first. */
  days?: Weekday[];
  /** When on those days or on that date. `{time}` shows it. */
  time?: TimeSpan;
  /** Days before `on` during which the work is in season. Default 14. */
  lead: number;
  /** `YYYY-MM-DD`: the day after which the work is no longer posted about. */
  until?: string;
  /** A `.time` window or season the work fits. */
  when?: string;
  /** The place it is sold, shown or held at. */
  place?: string;
  /** As a post writes it, with the unit. `{price}` shows it; never computed with. */
  price?: string;
  /** Where to buy, listen, book. */
  links?: string[];
  /** Photo ids from the `.brand` that show the work. */
  photos?: string[];
  /** Facts for AI writing, as written, lines joined with newlines. Not voice. */
  facts?: string;
  /** A series' items in posting order, one per time the work comes round from its `on:` date. */
  items?: WorkItem[];
  /** `items: cycle`: the items start over after the last. Absent: each item is used once, then there is none. */
  itemsCycle?: true;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const KEYS = new Set(['id', 'title', 'kind', 'by', 'on', 'days', 'time', 'lead', 'until', 'when', 'place', 'price', 'links', 'photos']);
const NAME = /^[a-z][a-z0-9-]*$/;
const LINK = /^https:\/\/\S+$/;
const DEFAULT_LEAD = 14;
const HEX = /^#[0-9a-fA-F]{6}$/;
/** Two hex items closer than this (OKLab distance) look the same: a repeat in disguise. */
const NEAR_DUPLICATE = 0.03;

/** Whether an item's value is a colour, `#RRGGBB`. Such a value can fill a story page's `background:`. */
export function isHexItem(value: string): boolean {
  return HEX.test(value);
}

/** OKLab of a `#RRGGBB` (Björn Ottosson's matrices). */
function oklab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Perceptual distance of two `#RRGGBB` colours (Euclidean in OKLab; ~0.02 is just visible). */
export function colorDistance(a: string, b: string): number {
  const [p, q] = [oklab(a), oklab(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseWorkFile(content: string, fileName: string): ParsedWork {
  const raw: Record<string, { value: string; line: number }> = {};
  let description = '';
  let facts: { lines: string[]; line: number } | null = null;
  let inFacts = false;
  let items: { list: Array<WorkItem & { line: number }>; line: number; cycle: boolean } | null = null;
  let inItems = false;

  content.split('\n').forEach((rawLine, i) => {
    const lineNum = i + 1;
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();
    if (line === '') return;
    // A `#` line is a comment, except in facts and items, where only `# …` is (an item can be a hex value)
    if (line.startsWith('#') && (indent === 0 || (!inFacts && !inItems) || (inItems && /^#(\s|$)/.test(line)))) {
      if (indent === 0) description = description ? `${description} ${line.slice(1).trim()}` : line.slice(1).trim();
      return;
    }

    if (indent === 0) {
      inFacts = false;
      inItems = false;
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: expected "key: value" or a "facts:" block, got "${line}"`);
      const key = line.slice(0, colonIdx).trim();
      // A URL keeps its `#`; elsewhere a trailing ` # …` is a comment
      const rest = line.slice(colonIdx + 1).trim();
      const value = key === 'links' ? rest : rest.replace(/\s+#.*$/, '');
      if (key === 'facts') {
        if (facts) throw new Error(`${fileName}:${lineNum}: duplicate "facts"`);
        if (value) throw new Error(`${fileName}:${lineNum}: facts go on the following 2-space lines, after a bare "facts:"`);
        facts = { lines: [], line: lineNum };
        inFacts = true;
        return;
      }
      if (key === 'items') {
        if (items) throw new Error(`${fileName}:${lineNum}: duplicate "items"`);
        if (value && value !== 'cycle') throw new Error(`${fileName}:${lineNum}: items is a bare "items:" or "items: cycle", the items go on the following 2-space lines, got "${value}"`);
        items = { list: [], line: lineNum, cycle: value === 'cycle' };
        inItems = true;
        return;
      }
      if (!KEYS.has(key)) throw new Error(`${fileName}:${lineNum}: unknown key "${key}" (expected ${[...KEYS].join(', ')} or a facts: block)`);
      if (raw[key]) throw new Error(`${fileName}:${lineNum}: duplicate "${key}"`);
      if (!value) throw new Error(`${fileName}:${lineNum}: empty ${key}`);
      raw[key] = { value, line: lineNum };
      return;
    }

    // An item: `VALUE  Name` on a 2-space line, its note on the 4-space lines below
    if (inItems && items) {
      if (indent === 2) {
        const m = /^(\S(?:.*?\S)?)(?:\s{2,}(\S.*))?$/.exec(line)!;
        items.list.push({ value: m[1], ...(m[2] ? { name: m[2] } : {}), line: lineNum });
        return;
      }
      const item = items.list[items.list.length - 1];
      if (indent !== 4 || !item) throw new Error(`${fileName}:${lineNum}: unexpected indent (an item is "VALUE  Name" on a 2-space line, its note on 4-space lines below)`);
      item.note = item.note ? `${item.note} ${line}` : line;
      return;
    }

    // The facts' lines are kept as written
    if (!inFacts || !facts || indent !== 2) throw new Error(`${fileName}:${lineNum}: unexpected indent (the facts' lines use 2 spaces under "facts:")`);
    facts.lines.push(line);
  });

  const at = (key: string) => `${fileName}:${raw[key].line}`;
  if (!raw['id']) throw new Error(`${fileName}: missing work id (add "id:" line)`);
  if (!NAME.test(raw['id'].value)) throw new Error(`${at('id')}: work id must be lowercase kebab-case, got "${raw['id'].value}"`);
  if (!raw['title']) throw new Error(`${fileName}: work needs title: (the title as posts write it)`);
  if (!raw['kind']) throw new Error(`${fileName}: work needs kind: (what it is, in the brand's own word: bread, album, class, event)`);

  const idList = (key: 'by' | 'photos', what: string): string[] | undefined => {
    if (!raw[key]) return undefined;
    const ids = raw[key].value.split(',').map(p => p.trim()).filter(Boolean);
    for (const id of ids) {
      if (!NAME.test(id)) throw new Error(`${at(key)}: ${key} must be ${what} ids, got "${id}"`);
      if (ids.indexOf(id) !== ids.lastIndexOf(id)) throw new Error(`${at(key)}: "${id}" is listed twice in ${key}`);
    }
    return ids;
  };
  const by = idList('by', 'person or group');
  const photos = idList('photos', 'photo');

  let on: WorkDate | undefined;
  if (raw['on']) {
    const onValue = raw['on'].value;
    const m = /^(\d{2}-\d{2}|\d{4}-\d{2}-\d{2})(?:\.\.(\d{2}-\d{2}|\d{4}-\d{2}-\d{2}))?$/.exec(onValue);
    const yearly = !!m && m[1].length === 5;
    const valid = (d: string) => (yearly ? isMonthDay(d) : isDate(d));
    if (!m || !valid(m[1]) || (m[2] && (m[2].length !== m[1].length || !valid(m[2])))) {
      throw new Error(`${at('on')}: on must be "MM-DD", "MM-DD..MM-DD", "YYYY-MM-DD" or "YYYY-MM-DD..YYYY-MM-DD", got "${onValue}"`);
    }
    const to = m[2] ?? m[1];
    if (!yearly && to < m[1]) throw new Error(`${at('on')}: on ends before it starts (${onValue})`);
    on = { from: m[1], to, yearly };
  }
  let days: Weekday[] | undefined;
  if (raw['days']) {
    days = parseDayList(raw['days'].value) ?? undefined;
    if (!days) throw new Error(`${at('days')}: days must be weekdays like sat, thu-fri or mon, wed, got "${raw['days'].value}"`);
  }
  let time: TimeSpan | undefined;
  if (raw['time']) {
    time = parseTimeSpan(raw['time'].value) ?? undefined;
    if (!time) throw new Error(`${at('time')}: time must be "HH:MM-HH:MM" or "HH:MM", got "${raw['time'].value}"`);
  }
  let lead = DEFAULT_LEAD;
  if (raw['lead']) {
    if (!/^\d+$/.test(raw['lead'].value)) throw new Error(`${at('lead')}: lead must be a whole number of days, got "${raw['lead'].value}"`);
    if (!on) throw new Error(`${at('lead')}: lead counts the days before on:, which the work doesn't have`);
    lead = Number(raw['lead'].value);
  }
  if (raw['until'] && !isDate(raw['until'].value)) throw new Error(`${at('until')}: until must be a date YYYY-MM-DD, got "${raw['until'].value}"`);
  if (raw['until'] && on && !on.yearly && raw['until'].value < on.from) throw new Error(`${at('until')}: until ${raw['until'].value} is before on ${on.from}`);
  for (const key of ['when', 'place'] as const) {
    if (raw[key] && !NAME.test(raw[key].value)) throw new Error(`${at(key)}: ${key} must be ${key === 'when' ? 'the name of a .time window or season' : 'a place id'}, got "${raw[key].value}"`);
  }
  let links: string[] | undefined;
  if (raw['links']) {
    links = raw['links'].value.split(',').map(l => l.trim()).filter(Boolean);
    for (const l of links) {
      if (!LINK.test(l)) throw new Error(`${at('links')}: links must be https links, got "${l}"`);
    }
  }
  const factsBlock = facts as { lines: string[]; line: number } | null;
  if (factsBlock && factsBlock.lines.length === 0) throw new Error(`${fileName}:${factsBlock.line}: empty facts (the facts go on the following 2-space lines)`);
  const itemsBlock = items as { list: Array<WorkItem & { line: number }>; line: number; cycle: boolean } | null;
  if (itemsBlock) {
    if (itemsBlock.list.length === 0) throw new Error(`${fileName}:${itemsBlock.line}: empty items (one item per 2-space line: "VALUE  Name")`);
    if (!on || on.yearly) throw new Error(`${fileName}:${itemsBlock.line}: items count from the work's start, which needs a one-off on: YYYY-MM-DD`);
    itemsBlock.list.forEach((item, i) => {
      for (const other of itemsBlock.list.slice(0, i)) {
        if (other.value.toLowerCase() === item.value.toLowerCase()) throw new Error(`${fileName}:${item.line}: item "${item.value}" repeats line ${other.line}`);
        if (isHexItem(item.value) && isHexItem(other.value) && colorDistance(item.value, other.value) < NEAR_DUPLICATE) {
          throw new Error(`${fileName}:${item.line}: item ${item.value} looks the same as ${other.value} on line ${other.line} (closer than ${NEAR_DUPLICATE} in OKLab)`);
        }
      }
    });
  }

  return {
    id: raw['id'].value,
    description,
    title: raw['title'].value,
    kind: raw['kind'].value,
    ...(by ? { by } : {}),
    ...(on ? { on } : {}),
    ...(days ? { days } : {}),
    ...(time ? { time } : {}),
    lead,
    ...(raw['until'] ? { until: raw['until'].value } : {}),
    ...(raw['when'] ? { when: raw['when'].value } : {}),
    ...(raw['place'] ? { place: raw['place'].value } : {}),
    ...(raw['price'] ? { price: raw['price'].value } : {}),
    ...(links ? { links } : {}),
    ...(photos ? { photos } : {}),
    ...(factsBlock ? { facts: factsBlock.lines.join('\n') } : {}),
    ...(itemsBlock ? { items: itemsBlock.list.map(({ line: _, ...item }) => item) } : {}),
    ...(itemsBlock?.cycle ? { itemsCycle: true as const } : {}),
  };
}

// ── In season ─────────────────────────────────────────────────────────────────

/** Start and end of an `on:` occurrence that could cover `date`, as local dates: the one-off itself, or
 *  the yearly occurrence starting in the year before, the year of, or the year after `date`. */
function occurrences(on: WorkDate, date: Date): Array<{ start: Date; end: Date }> {
  if (!on.yearly) return [{ start: localDate(on.from), end: localDate(on.to) }];
  const [fm, fd] = on.from.split('-').map(Number);
  const [tm, td] = on.to.split('-').map(Number);
  return [-1, 0, 1].map(offset => {
    const year = date.getFullYear() + offset;
    return { start: new Date(year, fm - 1, fd), end: new Date(on.to < on.from ? year + 1 : year, tm - 1, td) };
  });
}

/** `YYYY-MM-DD` of a local calendar day. */
function ymd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Whether content about the work fits a day: every one of its dates says so. A yearly `on:` from `lead`
 *  days before its start to its end; a one-off `on:` from `lead` days before its start and from then on (a
 *  launch, not an expiry); `days:` on those weekdays; `when:` as the `.time` entry (`time` is the brand's
 *  `.time`, `null` when it has none: then an entry is never in season); `until:` up to that day. A work with
 *  none of them fits all year. */
export function isWorkInSeason(work: Pick<ParsedWork, 'on' | 'days' | 'when' | 'until' | 'lead'>, time: ParsedTime | null | undefined, date: Date): boolean {
  if (work.on) {
    const { on, lead } = work;
    const inOn = on.yearly
      ? occurrences(on, date).some(({ start, end }) => daysBetween(date, start) <= lead && daysBetween(date, end) >= 0)
      : daysBetween(date, localDate(on.from)) <= lead;
    if (!inOn) return false;
  }
  if (work.days && !work.days.includes(WEEKDAYS[(date.getDay() + 6) % 7])) return false;
  if (work.when && !(time && isInSeason(time, work.when, date))) return false;
  if (work.until && ymd(date) > work.until) return false;
  return true;
}

/** Days from a day to the work's next `on:` start on or after it; `0` on the day. Undefined without `on:`,
 *  and after a one-off date. */
export function daysUntil(work: Pick<ParsedWork, 'on'>, date: Date): number | undefined {
  if (!work.on) return undefined;
  const ahead = occurrences(work.on, date).map(({ start }) => daysBetween(date, start)).filter(d => d >= 0);
  return ahead.length ? Math.min(...ahead) : undefined;
}

/** Whether the work is withdrawn on a `YYYY-MM-DD` day: after its `until:`. */
export function isWorkWithdrawn(work: Pick<ParsedWork, 'until'>, date: string): boolean {
  return !!work.until && date > work.until;
}

// ── Items ─────────────────────────────────────────────────────────────────────

/** The item a day gets: the work comes round on its `on:` date and then on each of its `days:` (every day
 *  without them), and each time takes the next item. Between two times the last one's item holds (a word
 *  of the week all week). Undefined before the start, after `until:`, and after the last item unless the
 *  items cycle. */
export function workItem(work: Pick<ParsedWork, 'on' | 'days' | 'until' | 'items' | 'itemsCycle'>, date: Date): WorkItem | undefined {
  const { on, items } = work;
  if (!items?.length || !on || on.yearly) return undefined;
  if (work.until && ymd(date) > work.until) return undefined;
  const start = localDate(on.from);
  const span = daysBetween(start, date);
  if (span < 0) return undefined;
  let times = 0;
  for (let d = 0; d <= span; d++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d);
    if (!work.days || work.days.includes(WEEKDAYS[(day.getDay() + 6) % 7])) times++;
  }
  if (times === 0) return undefined;
  const index = times - 1;
  if (index >= items.length && !work.itemsCycle) return undefined;
  return items[index % items.length];
}

// ── Cross-file checks ─────────────────────────────────────────────────────────

/** Checks a work against the brand's fact files. Returns problems as "file: message"; empty when it fits.
 *  `people` and `groups` (empty = none; undefined = not checked): every `by:` id is one of them. `time`
 *  (the brand's `.time`, `null` when it has none): `when:` names one of its windows or seasons. `places`
 *  likewise for `place:`. */
export function checkWork(
  work: Pick<ParsedWork, 'id' | 'by' | 'when' | 'place'>,
  facts: { people?: Array<{ id: string }>; groups?: Array<{ id: string }>; time?: ParsedTime | null; places?: Array<{ id: string }> },
  fileName: string,
): string[] {
  const problems: string[] = [];
  if (facts.people !== undefined || facts.groups !== undefined) {
    for (const id of work.by ?? []) {
      const known = (facts.people ?? []).some(p => p.id === id) || (facts.groups ?? []).some(g => g.id === id);
      if (!known) problems.push(`${fileName}: by "${id}" is neither a person nor a group`);
    }
  }
  if (facts.time !== undefined && work.when && !(facts.time && timeEntryNames(facts.time).includes(work.when))) {
    problems.push(`${fileName}: when "${work.when}" is not in the .time${facts.time ? '' : ' (the brand has no .time)'}`);
  }
  if (facts.places && work.place && !facts.places.some(p => p.id === work.place)) problems.push(`${fileName}: place "${work.place}" does not exist`);
  return problems;
}
