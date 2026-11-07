/**
 * Parser for .person files: someone the brand's posts name, quote or show. Facts, not voice:
 * what the person said is theirs and stays verbatim.
 *
 * The file is the consent. It holds only what the person agreed to: a `name:` because it may be
 * written, `photos:` because they may be shown, `quote` blocks because they may be quoted.
 * `consent:` records when they agreed, `until:` when that ends.
 *
 * Strict, line-based format. Every line must match a known pattern or be blank.
 * Throws on parse errors with file name and line number.
 */

import { isDate, isDateOrYear } from './timeParser';

// ── Parsed types ──────────────────────────────────────────────────────────────

export interface ParsedPerson {
  id: string;
  /** Header comment, if any. */
  description: string;
  /** The name as a post may write it. Absent: the person is their role, in every post. */
  name?: string;
  /** Who they are to the brand, as a post would say it. */
  role: string;
  /** `YYYY-MM-DD` or `YYYY`: since when. A bare year counts from January 1. */
  since?: string;
  /** The place they belong to. */
  place?: string;
  /** The group they belong to: the band, the estate. The group's `members:` lists them. */
  group?: string;
  /** Why they come, what they do. */
  reason?: string;
  /** Facts for AI writing. Not voice. */
  context?: string;
  /** Photo ids from the `.brand` that show them, and may be shown. */
  photos?: string[];
  /** `YYYY-MM-DD`: when the person agreed to what the file holds. */
  consent?: string;
  /** `YYYY-MM-DD`: when the consent ends. From that day the person is withdrawn. */
  until?: string;
  /** Their words, verbatim, one per block. */
  quotes: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const KEYS = new Set(['id', 'name', 'role', 'since', 'place', 'group', 'reason', 'context', 'photos', 'consent', 'until']);
const NAME = /^[a-z][a-z0-9-]*$/;

// ── Main parser ───────────────────────────────────────────────────────────────

export function parsePersonFile(content: string, fileName: string): ParsedPerson {
  const raw: Record<string, { value: string; line: number }> = {};
  let description = '';
  const quotes: Array<{ lines: string[]; line: number }> = [];
  let quote: (typeof quotes)[number] | null = null;

  content.split('\n').forEach((rawLine, i) => {
    const lineNum = i + 1;
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();
    if (line === '') return;
    if (line.startsWith('#') && (indent === 0 || !quote)) {
      if (indent === 0) description = description ? `${description} ${line.slice(1).trim()}` : line.slice(1).trim();
      return;
    }

    if (indent === 0) {
      quote = null;
      if (line === 'quote') {
        quote = { lines: [], line: lineNum };
        quotes.push(quote);
        return;
      }
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: expected "key: value" or a quote block, got "${line}"`);
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim().replace(/\s+#.*$/, '');
      if (!KEYS.has(key)) throw new Error(`${fileName}:${lineNum}: unknown key "${key}" (expected ${[...KEYS].join(', ')} or a quote block)`);
      if (raw[key]) throw new Error(`${fileName}:${lineNum}: duplicate "${key}"`);
      if (!value) throw new Error(`${fileName}:${lineNum}: empty ${key}`);
      raw[key] = { value, line: lineNum };
      return;
    }

    // A quote's lines are the person's words as written, comments included
    if (!quote || indent !== 2) throw new Error(`${fileName}:${lineNum}: unexpected indent (a quote's lines use 2 spaces under "quote")`);
    quote.lines.push(line);
  });

  if (!raw['id']) throw new Error(`${fileName}: missing person id (add "id:" line)`);
  if (!NAME.test(raw['id'].value)) throw new Error(`${fileName}:${raw['id'].line}: person id must be lowercase kebab-case, got "${raw['id'].value}"`);
  if (!raw['role']) throw new Error(`${fileName}: person needs role: (who they are to the brand, as a post would say it)`);
  if (raw['since'] && !isDateOrYear(raw['since'].value)) throw new Error(`${fileName}:${raw['since'].line}: since must be a date YYYY-MM-DD or a year YYYY, got "${raw['since'].value}"`);
  if (raw['place'] && !NAME.test(raw['place'].value)) throw new Error(`${fileName}:${raw['place'].line}: place must be a place id, got "${raw['place'].value}"`);
  if (raw['group'] && !NAME.test(raw['group'].value)) throw new Error(`${fileName}:${raw['group'].line}: group must be a group id, got "${raw['group'].value}"`);
  for (const key of ['consent', 'until'] as const) {
    if (raw[key] && !isDate(raw[key].value)) throw new Error(`${fileName}:${raw[key].line}: ${key} must be a date YYYY-MM-DD, got "${raw[key].value}"`);
  }
  if (raw['consent'] && raw['until'] && raw['until'].value <= raw['consent'].value) {
    throw new Error(`${fileName}:${raw['until'].line}: until ${raw['until'].value} is not after consent ${raw['consent'].value}`);
  }
  let photos: string[] | undefined;
  if (raw['photos']) {
    photos = raw['photos'].value.split(',').map(p => p.trim()).filter(Boolean);
    for (const p of photos) {
      if (!NAME.test(p)) throw new Error(`${fileName}:${raw['photos'].line}: photos must be photo ids, got "${p}"`);
      if (photos.indexOf(p) !== photos.lastIndexOf(p)) throw new Error(`${fileName}:${raw['photos'].line}: photo "${p}" is listed twice`);
    }
  }
  for (const q of quotes) {
    if (q.lines.length === 0) throw new Error(`${fileName}:${q.line}: empty quote (the person's words go on the following 2-space lines)`);
  }

  return {
    id: raw['id'].value,
    description,
    ...(raw['name'] ? { name: raw['name'].value } : {}),
    role: raw['role'].value,
    ...(raw['since'] ? { since: raw['since'].value } : {}),
    ...(raw['place'] ? { place: raw['place'].value } : {}),
    ...(raw['group'] ? { group: raw['group'].value } : {}),
    ...(raw['reason'] ? { reason: raw['reason'].value } : {}),
    ...(raw['context'] ? { context: raw['context'].value } : {}),
    ...(photos ? { photos } : {}),
    ...(raw['consent'] ? { consent: raw['consent'].value } : {}),
    ...(raw['until'] ? { until: raw['until'].value } : {}),
    quotes: quotes.map(q => q.lines.join('\n')),
  };
}

// ── Lookups ───────────────────────────────────────────────────────────────────

/** What `{person}` shows: the name when the file has one, else the role. */
export function personLabel(person: Pick<ParsedPerson, 'name' | 'role'>): string {
  return person.name ?? person.role;
}

/** Whether the person is withdrawn on a `YYYY-MM-DD` day: from their `until:` on. */
export function isWithdrawn(person: Pick<ParsedPerson, 'until'>, date: string): boolean {
  return !!person.until && date >= person.until;
}

/** Whether a page of a purpose with `person: required` can show something of theirs: a quote or a photo. */
export function hasSomethingToShow(person: Pick<ParsedPerson, 'quotes' | 'photos'>): boolean {
  return person.quotes.length > 0 || (person.photos?.length ?? 0) > 0;
}

// ── Cross-file checks ─────────────────────────────────────────────────────────

/** Checks a person against the brand's groups and places. Returns problems as "file: message"; empty when
 *  they fit. `groups`: the brand's `.group` files (empty = none); undefined = not checked. The person's
 *  `group:` must exist and list them in its `members:`. `places` likewise for `place:`. */
export function checkPerson(
  person: Pick<ParsedPerson, 'id' | 'group' | 'place'>,
  facts: { groups?: Array<{ id: string; members?: string[] }>; places?: Array<{ id: string }> },
  fileName: string,
): string[] {
  const problems: string[] = [];
  if (facts.groups && person.group) {
    const group = facts.groups.find(g => g.id === person.group);
    if (!group) problems.push(`${fileName}: group "${person.group}" does not exist`);
    else if (!group.members?.includes(person.id)) problems.push(`${fileName}: group "${group.id}" doesn't list "${person.id}" in its members: (a membership is written on both sides)`);
  }
  if (facts.places && person.place && !facts.places.some(p => p.id === person.place)) problems.push(`${fileName}: place "${person.place}" does not exist`);
  return problems;
}
