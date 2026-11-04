/**
 * Parser for .story files: ordered pages, each a purpose + composition with
 * fixed, variable or open slots, plus example fills for the open slots.
 *
 * Strict, line-based format. Every line must match a known pattern or be blank.
 * Throws on parse errors with file name and line number. Cross-file checks
 * (purposes, compositions, formats, maxLength) live in `checkStory`.
 */

import type { SlotId } from './types';
import type { ParsedPurpose } from './purposeParser';
import type { ParsedPlace } from './placeParser';

// ── Parsed types ──────────────────────────────────────────────────────────────

/** Placeholders a page text may contain. Implementations resolve them for the story's date. */
export type StoryVariable =
  | 'weekday' | 'date'
  | 'sunrise' | 'sunset' | 'day-length' | 'moon'
  | 'temperature' | 'wind' | 'weather'
  | 'place' | 'address' | 'hours' | 'opens' | 'closes';

/** Longest resolved form per variable (German and English), used for the `maxLength` check.
 *  `location`: the variable needs coordinates: the story's place's, else the brand's `location`
 *  block. `place`: it needs the story's
 *  place; `needs`: and that place's `address:` or `hours`. `{place}`, `{address}` and `{hours}`
 *  count at their length for that place (see `checkStory`). */
export const STORY_VARIABLES: Record<StoryVariable, { maxLength: number; location?: true; place?: true; needs?: 'address' | 'hours' }> = {
  weekday: { maxLength: 10 },                       // "Donnerstag"
  date: { maxLength: 13 },                          // "30. September"
  sunrise: { maxLength: 8, location: true },        // "12:59 PM"
  sunset: { maxLength: 8, location: true },
  'day-length': { maxLength: 15, location: true },  // "16 Std. 59 Min."
  moon: { maxLength: 20, location: true },          // "abnehmender Halbmond"
  temperature: { maxLength: 6, location: true },    // "-12 °C"
  wind: { maxLength: 6, location: true },           // "12 Bft"
  weather: { maxLength: 13, location: true },       // "teils bewölkt"
  place: { maxLength: 0, place: true },
  address: { maxLength: 0, place: true, needs: 'address' },
  hours: { maxLength: 0, place: true, needs: 'hours' },
  opens: { maxLength: 8, place: true, needs: 'hours' },   // "10:30 AM"
  closes: { maxLength: 8, place: true, needs: 'hours' },
};

/** Longest form of one `{hours}` line without its label: "10:30 AM–10:30 PM". */
const HOURS_RANGE_LENGTH = 17;
/** `{hours}` on a closed day: "geschlossen". */
const HOURS_CLOSED_LENGTH = 11;

export interface ParsedStory {
  id: string;
  name: string;
  description: string;
  /** Format id every page renders at. */
  format: string;
  /** Story topic: what the whole story is about, one sentence. */
  topic?: string;
  /** `scrim: none`: no scrim under the story's text, whatever the brand and purposes declare. */
  scrim?: 'none';
  /** Place id the story speaks for. Undefined = the brand's only place, if it has exactly one. */
  place?: string;
  pages: ParsedStoryPage[];
  /** Example fills for the open slots, one story topic each. */
  examples: ParsedStoryExample[];
}

export interface ParsedStoryPage {
  purpose: string;
  /** Composition id; undefined = the implementation picks one of the purpose's compositions. */
  composition?: string;
  /** Illustration ids; implementations pick one per story date, the same one every time for that date. */
  illustrations?: string[];
  /** Photo ids; override the purpose's `photo:` default for this page. Implementations pick one per
   *  story date, the same one every time for that date. */
  photos?: string[];
  /** Page topic: what this page adds to the story. */
  topic?: string;
  /** Fixed slot texts, may contain `{variable}`s. A slot the page doesn't name is open. */
  texts: Partial<Record<SlotId, string>>;
}

/** One `example` block: texts for the open slots of several pages, about one story topic. */
export interface ParsedStoryExample {
  topic?: string;
  pages: ParsedStoryExamplePage[];
}

export interface ParsedStoryExamplePage {
  /** 1-based page number. */
  page: number;
  topic?: string;
  texts: Partial<Record<SlotId, string>>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_SLOTS = new Set<string>(['primary', 'secondary', 'detail', 'meta', 'cta', 'label']);
const VARIABLE = /\{([a-z][a-z0-9-]*)\}/g;

/** Variable names in a text, in order of appearance. */
export function storyTextVariables(text: string): string[] {
  return [...text.matchAll(VARIABLE)].map(m => m[1]);
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseStoryFile(content: string, fileName: string): ParsedStory {
  const lines = content.split('\n');

  let id = '';
  let name = '';
  let description = '';
  let format = '';
  let topic: string | undefined;
  let scrim: 'none' | undefined;
  let place: string | undefined;
  const pages: (ParsedStoryPage & { line: number; keys: Set<string> })[] = [];
  const examples: (ParsedStoryExample & { line: number })[] = [];

  let currentPage: (typeof pages)[number] | null = null;
  let currentExample: (typeof examples)[number] | null = null;
  // Page inside the current example, with the line it starts on
  let currentExamplePage: (ParsedStoryExamplePage & { line: number; keys: Set<string> }) | null = null;
  // Slot whose multi-line value is being read, and the indent of its lines
  let multiKey: SlotId | null = null;
  let multiIndent = 0;
  const examplePageLines = new Map<ParsedStoryExamplePage, number>();

  /** `key: value` line of a page or example page: topic, one of `extra`, or a slot text.
   *  Returns the `extra` key and value, or the slot of a bare `slot:` line. */
  function readKey(
    line: string,
    lineNum: number,
    target: { topic?: string; texts: Partial<Record<SlotId, string>>; keys: Set<string> },
    extra: string[],
    allowVariables: boolean,
  ): { key: string; value: string } | { multi: SlotId } | null {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: expected "key: value", got "${line}"`);
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (target.keys.has(key)) throw new Error(`${fileName}:${lineNum}: duplicate "${key}"`);
    target.keys.add(key);
    if (key === 'topic') {
      if (!value) throw new Error(`${fileName}:${lineNum}: empty topic`);
      target.topic = value;
      return null;
    }
    if (extra.includes(key)) {
      if (!value) throw new Error(`${fileName}:${lineNum}: empty ${key}`);
      return { key, value };
    }
    if (!VALID_SLOTS.has(key)) throw new Error(`${fileName}:${lineNum}: unknown key "${key}" (expected ${[...extra, 'topic'].join(', ')} or a slot id)`);
    if (!value) return { multi: key as SlotId };
    checkVariables(value, lineNum, allowVariables);
    target.texts[key as SlotId] = value;
    return null;
  }

  function checkVariables(text: string, lineNum: number, allowed: boolean) {
    for (const v of storyTextVariables(text)) {
      if (!allowed) throw new Error(`${fileName}:${lineNum}: variable "{${v}}" in an example — examples are sample texts, variables belong in page texts`);
      if (!(v in STORY_VARIABLES)) throw new Error(`${fileName}:${lineNum}: unknown variable "{${v}}" (expected ${Object.keys(STORY_VARIABLES).map(k => `{${k}}`).join(', ')})`);
    }
  }

  function closeBlocks() {
    currentPage = null;
    currentExample = null;
    currentExamplePage = null;
    multiKey = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const raw = lines[i];
    const line = raw.trim();
    const indent = raw.length - raw.trimStart().length;

    if (line === '') continue;

    if (line.startsWith('#')) {
      if (indent === 0) description = description ? `${description} ${line.slice(1).trim()}` : line.slice(1).trim();
      continue;
    }

    // Multi-line slot text: lines deeper than the bare `slot:` line
    if (multiKey && indent >= multiIndent) {
      const target = currentExamplePage ?? currentPage!;
      checkVariables(line, lineNum, !currentExamplePage);
      const prev = target.texts[multiKey];
      target.texts[multiKey] = prev ? `${prev}\n${line}` : line;
      continue;
    }
    if (multiKey) {
      const target = currentExamplePage ?? currentPage!;
      if (!target.texts[multiKey]) throw new Error(`${fileName}:${lineNum}: "${multiKey}:" has no text (write it after the colon or on the following, deeper lines)`);
      multiKey = null;
    }

    if (indent === 0) {
      closeBlocks();
      if (line === 'page') {
        currentPage = { purpose: '', texts: {}, line: lineNum, keys: new Set() };
        pages.push(currentPage);
        continue;
      }
      if (line === 'example') {
        currentExample = { pages: [], line: lineNum };
        examples.push(currentExample);
        continue;
      }
      const colonIdx = line.indexOf(':');
      const key = colonIdx === -1 ? line : line.slice(0, colonIdx).trim();
      const value = colonIdx === -1 ? '' : line.slice(colonIdx + 1).trim();
      if (key === 'id' || key === 'name' || key === 'format' || key === 'topic' || key === 'place') {
        if (!value) throw new Error(`${fileName}:${lineNum}: empty ${key}`);
        if (key === 'id') id = value;
        else if (key === 'name') name = value;
        else if (key === 'format') format = value;
        else if (key === 'place') place = value;
        else topic = value;
        continue;
      }
      if (key === 'scrim') {
        if (value !== 'none') throw new Error(`${fileName}:${lineNum}: invalid scrim "${value}" (expected none; how dark is the brand's photo-look scrim)`);
        scrim = 'none';
        continue;
      }
      throw new Error(`${fileName}:${lineNum}: unexpected "${line}"`);
    }

    // Page lines (2-space)
    if (currentPage) {
      if (indent !== 2) throw new Error(`${fileName}:${lineNum}: unexpected indent in page (page keys use 2 spaces)`);
      const read = readKey(line, lineNum, currentPage, ['purpose', 'composition', 'illustration', 'photo'], true);
      if (read && 'multi' in read) { multiKey = read.multi; multiIndent = 4; }
      else if (read?.key === 'purpose') currentPage.purpose = read.value;
      else if (read?.key === 'illustration') currentPage.illustrations = read.value.split(',').map(id => id.trim()).filter(Boolean);
      else if (read?.key === 'photo') currentPage.photos = read.value.split(',').map(id => id.trim()).filter(Boolean);
      else if (read) currentPage.composition = read.value;
      continue;
    }

    // Example lines: `topic:` and `page N` (2-space), page keys (4-space)
    if (currentExample) {
      if (indent === 2) {
        currentExamplePage = null;
        const pageHead = /^page\s+(\d+)$/.exec(line);
        if (pageHead) {
          const n = parseInt(pageHead[1], 10);
          if (currentExample.pages.some(p => p.page === n)) throw new Error(`${fileName}:${lineNum}: duplicate "page ${n}" in example`);
          currentExamplePage = { page: n, texts: {}, line: lineNum, keys: new Set() };
          currentExample.pages.push(currentExamplePage);
          examplePageLines.set(currentExamplePage, lineNum);
          continue;
        }
        if (line.startsWith('topic:')) {
          const value = line.slice(6).trim();
          if (!value) throw new Error(`${fileName}:${lineNum}: empty topic`);
          if (currentExample.topic) throw new Error(`${fileName}:${lineNum}: duplicate "topic" in example`);
          currentExample.topic = value;
          continue;
        }
        throw new Error(`${fileName}:${lineNum}: expected "topic:" or "page N" in example, got "${line}"`);
      }
      if (indent === 4 && currentExamplePage) {
        const read = readKey(line, lineNum, currentExamplePage, [], false);
        if (read && 'multi' in read) { multiKey = read.multi; multiIndent = 6; }
        continue;
      }
      throw new Error(`${fileName}:${lineNum}: unexpected indent in example (page N at 2 spaces, its keys at 4)`);
    }

    throw new Error(`${fileName}:${lineNum}: unexpected "${line}"`);
  }
  if (multiKey) {
    const target = currentExamplePage ?? currentPage!;
    if (!target.texts[multiKey]) throw new Error(`${fileName}:${lines.length}: "${multiKey}:" has no text`);
  }

  if (!id) throw new Error(`${fileName}: missing story id (add "id:" line)`);
  if (!format) throw new Error(`${fileName}: missing "format:" line`);
  if (pages.length === 0) throw new Error(`${fileName}: no pages defined`);
  for (const p of pages) {
    if (!p.purpose) throw new Error(`${fileName}:${p.line}: page without "purpose:"`);
  }
  for (const ex of examples) {
    if (ex.pages.length === 0) throw new Error(`${fileName}:${ex.line}: example without pages`);
    for (const ep of ex.pages) {
      const at = `${fileName}:${examplePageLines.get(ep)}`;
      const page = pages[ep.page - 1];
      if (!page) throw new Error(`${at}: example fills page ${ep.page}, the story has ${pages.length}`);
      if (Object.keys(ep.texts).length === 0 && !ep.topic) throw new Error(`${at}: example page ${ep.page} is empty`);
      for (const slot of Object.keys(ep.texts)) {
        if (page.texts[slot as SlotId] !== undefined) throw new Error(`${at}: slot "${slot}" is fixed on page ${ep.page} and takes no example text`);
      }
    }
  }

  if (!name) name = id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return {
    id,
    name,
    description,
    format,
    topic,
    ...(scrim ? { scrim } : {}),
    ...(place ? { place } : {}),
    pages: pages.map(({ line: _line, keys: _keys, ...p }) => p),
    examples: examples.map(({ line: _line, ...ex }) => ({
      ...ex,
      pages: ex.pages.map(p => {
        const { line: _l, keys: _k, ...rest } = p as ParsedStoryExamplePage & { line: number; keys: Set<string> };
        return rest;
      }),
    })),
  };
}

// ── Cross-file checks ─────────────────────────────────────────────────────────

/** The place a story speaks for: the one its `place:` names, else the brand's only place. */
export function storyPlace(story: Pick<ParsedStory, 'place'>, places: ParsedPlace[]): ParsedPlace | undefined {
  if (story.place) return places.find(p => p.id === story.place);
  return places.length === 1 ? places[0] : undefined;
}

/** A text with each variable at its longest form, `{hours}` as its longest lines for the place. */
function longestText(text: string, place: ParsedPlace | undefined): string {
  return text.replace(VARIABLE, (_, v: string) => {
    if (v === 'place') return 'x'.repeat(place?.name.length ?? 0);
    if (v === 'address') return 'x'.repeat(place?.address?.length ?? 0);
    if (v === 'hours') {
      const days = Object.values(place?.hours ?? {});
      const lines = Math.max(1, ...days.map(r => r.length));
      const line = Math.max(HOURS_CLOSED_LENGTH, ...days.flat().map(r => (r.label ? r.label.length + 2 : 0) + HOURS_RANGE_LENGTH));
      return Array.from({ length: lines }, () => 'x'.repeat(line)).join('\n');
    }
    return 'x'.repeat(STORY_VARIABLES[v as StoryVariable]?.maxLength ?? 0);
  });
}

/** Checks a story against the brand's other files. Returns problems as "file: message";
 *  empty when the story fits. Variables count at their longest form for `maxLength`.
 *  `location: false` reports sky and weather variables (the brand has no `location` block) unless
 *  the story's place has coordinates.
 *  `places` (the brand's .place files) is checked when given: the story's `place:`, and the
 *  place that place variables need. */
export function checkStory(
  story: ParsedStory,
  brand: { purposes: ParsedPurpose[]; compositions: string[]; formats: string[]; illustrations?: string[]; photos?: string[]; location?: boolean; places?: ParsedPlace[] },
  fileName: string,
): string[] {
  const problems: string[] = [];
  const say = (msg: string) => problems.push(`${fileName}: ${msg}`);
  if (!brand.formats.includes(story.format)) say(`format "${story.format}" does not exist`);
  const place = brand.places ? storyPlace(story, brand.places) : undefined;
  if (brand.places && story.place && !place) say(`place "${story.place}" does not exist`);

  const purposes = new Map(brand.purposes.map(p => [p.id, p]));
  const checkTexts = (where: string, purpose: ParsedPurpose, texts: Partial<Record<SlotId, string>>) => {
    for (const [slotId, text] of Object.entries(texts) as [SlotId, string][]) {
      const slot = purpose.slots.find(s => s.id === slotId);
      if (!slot) { say(`${where}: slot "${slotId}" is not declared by purpose "${purpose.id}"`); continue; }
      if (slot.value) { say(`${where}: slot "${slotId}" has a fixed value in purpose "${purpose.id}"`); continue; }
      for (const v of new Set(storyTextVariables(text))) {
        const variable = STORY_VARIABLES[v as StoryVariable];
        if (variable?.location && brand.location === false && place?.latitude === undefined) say(`${where}: variable "{${v}}" needs a location block in the .brand`);
        if (variable?.place && brand.places && !(story.place && !place)) {
          if (!place) say(`${where}: variable "{${v}}" needs a place: ${brand.places.length > 1 ? 'name it with "place:"' : 'add a .place file'}`);
          else if (variable.needs && !place[variable.needs]) say(`${where}: variable "{${v}}" needs ${variable.needs === 'hours' ? 'an hours block' : 'an address:'} in place "${place.id}"`);
        }
      }
      const longest = longestText(text, place);
      const parts = slot.slotType === 'list' ? longest.split('\n') : [longest];
      if (slot.slotType === 'list' && slot.maxItems && parts.length > slot.maxItems) say(`${where}: slot "${slotId}" has ${parts.length} items, maxItems is ${slot.maxItems}`);
      for (const part of parts) {
        if (part.length > slot.maxLength) say(`${where}: slot "${slotId}" is ${part.length} characters long, maxLength is ${slot.maxLength}`);
      }
    }
  };

  story.pages.forEach((page, i) => {
    const where = `page ${i + 1}`;
    const purpose = purposes.get(page.purpose);
    if (!purpose) { say(`${where}: purpose "${page.purpose}" does not exist`); return; }
    if (page.composition) {
      if (!brand.compositions.includes(page.composition)) say(`${where}: composition "${page.composition}" does not exist`);
      else if (!purpose.preferredCompositions.includes(page.composition)) say(`${where}: composition "${page.composition}" is not one of purpose "${purpose.id}"'s compositions`);
    }
    for (const id of page.illustrations ?? []) {
      if (brand.illustrations && !brand.illustrations.includes(id)) say(`${where}: illustration "${id}" does not exist`);
    }
    for (const id of page.photos ?? []) {
      if (brand.photos && !brand.photos.includes(id)) say(`${where}: photo "${id}" does not exist`);
    }
    checkTexts(where, purpose, page.texts);
  });
  story.examples.forEach((ex, i) => {
    for (const ep of ex.pages) {
      const purpose = purposes.get(story.pages[ep.page - 1].purpose);
      if (purpose) checkTexts(`example ${i + 1}, page ${ep.page}`, purpose, ep.texts);
    }
  });
  return problems;
}
