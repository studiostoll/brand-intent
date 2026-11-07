/**
 * Parser for .work files: a thing the brand puts out or puts on, that posts return to. A bread,
 * a wine, a record, a book, an exhibition, a class, a tasting evening, a show, a mill day. Facts,
 * not voice: what it is, who it is by, what it costs, when it is out or when it takes place.
 *
 * The work carries its own date: a one-off or yearly `on:`, or the `days:` it comes round on.
 * That is why an event is a work and not an entry in the `.time`. `isWorkInSeason` says whether
 * content about the work fits a day; `daysUntil` counts to its next `on:` day.
 *
 * Strict, line-based format. Every line must match a known pattern or be blank.
 * Throws on parse errors with file name and line number.
 */

import { isDate, isMonthDay, isInSeason, timeEntryNames, parseTimeSpan, parseDayList, daysBetween, localDate, type ParsedTime, type TimeSpan } from './timeParser';
import { WEEKDAYS, type Weekday } from './placeParser';

// ── Parsed types ──────────────────────────────────────────────────────────────

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
}

// ── Constants ─────────────────────────────────────────────────────────────────

const KEYS = new Set(['id', 'title', 'kind', 'by', 'on', 'days', 'time', 'lead', 'until', 'when', 'place', 'price', 'links', 'photos']);
const NAME = /^[a-z][a-z0-9-]*$/;
const LINK = /^https:\/\/\S+$/;
const DEFAULT_LEAD = 14;

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseWorkFile(content: string, fileName: string): ParsedWork {
  const raw: Record<string, { value: string; line: number }> = {};
  let description = '';
  let facts: { lines: string[]; line: number } | null = null;
  let inFacts = false;

  content.split('\n').forEach((rawLine, i) => {
    const lineNum = i + 1;
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();
    if (line === '') return;
    if (line.startsWith('#') && (indent === 0 || !inFacts)) {
      if (indent === 0) description = description ? `${description} ${line.slice(1).trim()}` : line.slice(1).trim();
      return;
    }

    if (indent === 0) {
      inFacts = false;
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
      if (!KEYS.has(key)) throw new Error(`${fileName}:${lineNum}: unknown key "${key}" (expected ${[...KEYS].join(', ')} or a facts: block)`);
      if (raw[key]) throw new Error(`${fileName}:${lineNum}: duplicate "${key}"`);
      if (!value) throw new Error(`${fileName}:${lineNum}: empty ${key}`);
      raw[key] = { value, line: lineNum };
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
