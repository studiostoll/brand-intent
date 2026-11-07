/**
 * Parser for .group files: more than one person the brand's posts speak about as one. A band,
 * an estate, a family farm, a mill, a club, a label. Facts, not voice.
 *
 * A group is public, and the file is not a consent: it has a region and links, no `consent:`
 * and no `until:`. The humans in it who are named, quoted or shown have their own person files
 * and name the group with `group:`. What the group published as one (a statement, liner notes,
 * a back label) is a `quote` block, attributed with `{group}`.
 *
 * Strict, line-based format. Every line must match a known pattern or be blank.
 * Throws on parse errors with file name and line number.
 */

import { isDateOrYear } from './timeParser';

// ── Parsed types ──────────────────────────────────────────────────────────────

export interface ParsedGroup {
  id: string;
  /** Header comment, if any. */
  description: string;
  /** The name as posts write it. `{group}` shows it. */
  name: string;
  /** What the group is to the brand, as a post would say it. */
  role: string;
  /** `YYYY-MM-DD` or `YYYY`: since when. A bare year counts from January 1. */
  since?: string;
  /** Region or town, as a post says it. A fact, not a place. */
  where?: string;
  /** Person ids. Each of them names this group with `group:`. */
  members?: string[];
  /** The group's own pages. */
  links?: string[];
  /** Photo ids from the `.brand` that show the group. */
  photos?: string[];
  /** Facts for AI writing. Not voice. */
  context?: string;
  /** Words the group published as one, verbatim, one per block. */
  quotes: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const KEYS = new Set(['id', 'name', 'role', 'since', 'where', 'members', 'links', 'photos', 'context']);
const NAME = /^[a-z][a-z0-9-]*$/;
const LINK = /^https:\/\/\S+$/;

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseGroupFile(content: string, fileName: string): ParsedGroup {
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
      // A URL keeps its `#`; elsewhere a trailing ` # …` is a comment
      const rest = line.slice(colonIdx + 1).trim();
      const value = key === 'links' ? rest : rest.replace(/\s+#.*$/, '');
      if (!KEYS.has(key)) throw new Error(`${fileName}:${lineNum}: unknown key "${key}" (expected ${[...KEYS].join(', ')} or a quote block)`);
      if (raw[key]) throw new Error(`${fileName}:${lineNum}: duplicate "${key}"`);
      if (!value) throw new Error(`${fileName}:${lineNum}: empty ${key}`);
      raw[key] = { value, line: lineNum };
      return;
    }

    // A quote's lines are the group's words as written, comments included
    if (!quote || indent !== 2) throw new Error(`${fileName}:${lineNum}: unexpected indent (a quote's lines use 2 spaces under "quote")`);
    quote.lines.push(line);
  });

  if (!raw['id']) throw new Error(`${fileName}: missing group id (add "id:" line)`);
  if (!NAME.test(raw['id'].value)) throw new Error(`${fileName}:${raw['id'].line}: group id must be lowercase kebab-case, got "${raw['id'].value}"`);
  if (!raw['name']) throw new Error(`${fileName}: group needs name: (the name as posts write it)`);
  if (!raw['role']) throw new Error(`${fileName}: group needs role: (what the group is to the brand, as a post would say it)`);
  if (raw['since'] && !isDateOrYear(raw['since'].value)) throw new Error(`${fileName}:${raw['since'].line}: since must be a date YYYY-MM-DD or a year YYYY, got "${raw['since'].value}"`);

  const idList = (key: 'members' | 'photos', what: string): string[] | undefined => {
    if (!raw[key]) return undefined;
    const ids = raw[key].value.split(',').map(p => p.trim()).filter(Boolean);
    for (const id of ids) {
      if (!NAME.test(id)) throw new Error(`${fileName}:${raw[key].line}: ${key} must be ${what} ids, got "${id}"`);
      if (ids.indexOf(id) !== ids.lastIndexOf(id)) throw new Error(`${fileName}:${raw[key].line}: ${what} "${id}" is listed twice`);
    }
    return ids;
  };
  const members = idList('members', 'person');
  const photos = idList('photos', 'photo');
  let links: string[] | undefined;
  if (raw['links']) {
    links = raw['links'].value.split(',').map(l => l.trim()).filter(Boolean);
    for (const l of links) {
      if (!LINK.test(l)) throw new Error(`${fileName}:${raw['links'].line}: links must be https links, got "${l}"`);
    }
  }
  for (const q of quotes) {
    if (q.lines.length === 0) throw new Error(`${fileName}:${q.line}: empty quote (the group's words go on the following 2-space lines)`);
  }

  return {
    id: raw['id'].value,
    description,
    name: raw['name'].value,
    role: raw['role'].value,
    ...(raw['since'] ? { since: raw['since'].value } : {}),
    ...(raw['where'] ? { where: raw['where'].value } : {}),
    ...(members ? { members } : {}),
    ...(links ? { links } : {}),
    ...(photos ? { photos } : {}),
    ...(raw['context'] ? { context: raw['context'].value } : {}),
    quotes: quotes.map(q => q.lines.join('\n')),
  };
}

// ── Lookups ───────────────────────────────────────────────────────────────────

/** Whether a page of a purpose with `group: required` can show something of the group's: a quote or a photo. */
export function groupHasSomethingToShow(group: Pick<ParsedGroup, 'quotes' | 'photos'>): boolean {
  return group.quotes.length > 0 || (group.photos?.length ?? 0) > 0;
}

// ── Cross-file checks ─────────────────────────────────────────────────────────

/** Checks a group against the brand's people. Returns problems as "file: message"; empty when they fit.
 *  `people`: the brand's `.person` files (empty = none); undefined = not checked. Every member must exist
 *  and name this group with `group:`. */
export function checkGroup(
  group: Pick<ParsedGroup, 'id' | 'members'>,
  facts: { people?: Array<{ id: string; group?: string }> },
  fileName: string,
): string[] {
  const problems: string[] = [];
  if (!facts.people) return problems;
  for (const id of group.members ?? []) {
    const person = facts.people.find(p => p.id === id);
    if (!person) problems.push(`${fileName}: member "${id}" does not exist`);
    else if (person.group !== group.id) problems.push(`${fileName}: member "${id}" ${person.group ? `belongs to group "${person.group}"` : 'names no group'} (add "group: ${group.id}" to the person)`);
  }
  return problems;
}
