/**
 * Parser for .story files: ordered pages, each a purpose + composition with
 * fixed, variable or open slots, plus example fills for the open slots.
 *
 * Strict, line-based format. Every line must match a known pattern or be blank.
 * Throws on parse errors with file name and line number. Cross-file checks
 * (purposes, compositions, formats, maxLength) live in `checkStory`.
 */

import { SLOT_IDS, type SlotId } from './types';
import type { ParsedPurpose } from './purposeParser';
import { addressStreet, weekOpeningDays, type ParsedPlace } from './placeParser';

// ── Parsed types ──────────────────────────────────────────────────────────────

/** Placeholders a page text may contain. Implementations resolve them for the story's date. */
export type StoryVariable =
  | 'weekday' | 'date'
  | 'sunrise' | 'sunset' | 'day-length' | 'moon'
  | 'temperature' | 'wind' | 'weather'
  | 'place' | 'address' | 'street' | 'hours' | 'week-hours' | 'opens' | 'closes' | 'opening'
  | 'n' | 'count';

/** Longest resolved form per variable (German and English), used for the `maxLength` check.
 *  `location`: the variable needs coordinates: the story's place's, else the brand's `location`
 *  block. `place`: it needs the story's
 *  place; `needs`: and that place's `address:` or `hours`. `{place}`, `{address}`, `{street}`, `{hours}` and
 *  `{week-hours}` count at their length for that place (see `checkStory`). */
export const STORY_VARIABLES: Record<StoryVariable, { maxLength: number; location?: true; place?: true; needs?: 'address' | 'hours' | 'opening'; list?: true }> = {
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
  street: { maxLength: 0, place: true, needs: 'address' },
  hours: { maxLength: 0, place: true, needs: 'hours' },
  'week-hours': { maxLength: 0, place: true, needs: 'hours' },
  opens: { maxLength: 8, place: true, needs: 'hours' },   // "10:30 AM"
  closes: { maxLength: 8, place: true, needs: 'hours' },
  opening: { maxLength: 13, place: true, needs: 'opening' }, // "30. September"
  n: { maxLength: 2, list: true },                  // "10": the page's position in its page list
  count: { maxLength: 2, list: true },              // "10": how many pages the page list has
};

/** Longest form of one `{hours}` line without its label: "10:30 AM–10:30 PM". */
const HOURS_RANGE_LENGTH = 17;
/** Longest days part of a `{week-hours}` line, with its space: "Mon–Fri ". */
const WEEK_DAYS_LENGTH = 8;
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
  /** Name of a `.brand` date window the story fits. Undefined = all year. */
  when?: string;
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
  /** `photo: camera`: the page starts without a photo and asks for one taken now. Implementations offer the
   *  camera in its photo region. Neither the page's nor the purpose's photo list applies. */
  camera?: true;
  /** Theme name from the `.brand`; this page uses it instead of the colours the story starts with. */
  theme?: string;
  /** Page topic: what this page adds to the story. */
  topic?: string;
  /** `repeat: MIN-MAX`: the page is a page list, between `min` and `max` copies of it in a row. At most one per story. */
  repeat?: { min: number; max: number };
  /** Fixed slot texts, may contain `{variable}`s. A slot the page doesn't name is open. */
  texts: Partial<Record<SlotId, string>>;
}

/** One `example` block: texts for the open slots of several pages, about one story topic. */
export interface ParsedStoryExample {
  topic?: string;
  pages: ParsedStoryExamplePage[];
}

export interface ParsedStoryExamplePage {
  /** 1-based page number in the file. A page list's page may appear several times: one entry per copy, in order. */
  page: number;
  topic?: string;
  /** Photo id from the `.brand` that goes with this example's texts; overrides the page's photos. */
  photo?: string;
  texts: Partial<Record<SlotId, string>>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_SLOTS = new Set<string>(SLOT_IDS);
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
  let when: string | undefined;
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
      if (key === 'when') {
        if (!/^[a-z][a-z0-9-]*$/.test(value)) throw new Error(`${fileName}:${lineNum}: invalid when "${value}" (expected the name of one .brand window)`);
        when = value;
        continue;
      }
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
      const read = readKey(line, lineNum, currentPage, ['purpose', 'composition', 'illustration', 'photo', 'theme', 'repeat'], true);
      if (read && 'multi' in read) { multiKey = read.multi; multiIndent = 4; }
      else if (read?.key === 'purpose') currentPage.purpose = read.value;
      else if (read?.key === 'illustration') currentPage.illustrations = read.value.split(',').map(id => id.trim()).filter(Boolean);
      else if (read?.key === 'photo') {
        const ids = read.value.split(',').map(id => id.trim()).filter(Boolean);
        if (ids.includes('camera')) {
          if (ids.length > 1) throw new Error(`${fileName}:${lineNum}: photo: camera stands alone, without photo ids`);
          currentPage.camera = true;
        } else currentPage.photos = ids;
      }
      else if (read?.key === 'theme') currentPage.theme = read.value;
      else if (read?.key === 'repeat') {
        const m = /^(\d+)\s*-\s*(\d+)$/.exec(read.value);
        const min = m ? parseInt(m[1], 10) : 0;
        const max = m ? parseInt(m[2], 10) : 0;
        if (!m || min < 1 || max < min) throw new Error(`${fileName}:${lineNum}: invalid repeat "${read.value}" (expected MIN-MAX, e.g. 2-6, with 1 <= MIN <= MAX)`);
        currentPage.repeat = { min, max };
      }
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
        const read = readKey(line, lineNum, currentExamplePage, ['photo'], false);
        if (read && 'multi' in read) { multiKey = read.multi; multiIndent = 6; }
        else if (read?.key === 'photo') {
          if (read.value.includes(',')) throw new Error(`${fileName}:${lineNum}: an example page names one photo, the one its texts belong to`);
          currentExamplePage.photo = read.value;
        }
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
  const lists = pages.filter(p => p.repeat);
  if (lists.length > 1) throw new Error(`${fileName}:${lists[1].line}: a story has at most one page with "repeat:"`);
  for (const p of pages) {
    for (const text of Object.values(p.texts)) {
      const vars = storyTextVariables(text!);
      if (vars.includes('n') && !p.repeat) throw new Error(`${fileName}:${p.line}: "{n}" only on the page with "repeat:", where it counts the copies`);
      if (vars.includes('count') && lists.length === 0) throw new Error(`${fileName}:${p.line}: "{count}" needs a page with "repeat:"`);
    }
  }
  for (const ex of examples) {
    if (ex.pages.length === 0) throw new Error(`${fileName}:${ex.line}: example without pages`);
    // A page list's page may appear once per copy, any other page once
    for (const ep of ex.pages) {
      const page = pages[ep.page - 1];
      const copy = ex.pages.filter(o => o.page === ep.page).indexOf(ep) + 1;
      const at = `${fileName}:${examplePageLines.get(ep)}`;
      if (page && copy > 1 && !page.repeat) throw new Error(`${at}: duplicate "page ${ep.page}" in example`);
      if (page?.repeat && copy > page.repeat.max) throw new Error(`${at}: example has more than ${page.repeat.max} copies of page ${ep.page} (repeat: ${page.repeat.min}-${page.repeat.max})`);
    }
    for (const ep of ex.pages) {
      const at = `${fileName}:${examplePageLines.get(ep)}`;
      const page = pages[ep.page - 1];
      if (!page) throw new Error(`${at}: example fills page ${ep.page}, the story has ${pages.length}`);
      if (Object.keys(ep.texts).length === 0 && !ep.topic && !ep.photo) throw new Error(`${at}: example page ${ep.page} is empty`);
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
    ...(when ? { when } : {}),
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
    if (v === 'street') return 'x'.repeat(place?.address ? addressStreet(place.address).length : 0);
    if (v === 'hours') {
      const days = Object.values(place?.hours ?? {});
      const lines = Math.max(1, ...days.map(r => r.length));
      const line = Math.max(HOURS_CLOSED_LENGTH, ...days.flat().map(r => (r.label ? r.label.length + 2 : 0) + HOURS_RANGE_LENGTH));
      return Array.from({ length: lines }, () => 'x'.repeat(line)).join('\n');
    }
    if (v === 'week-hours') {
      const lines = weekOpeningDays(place?.hours ?? {});
      if (!lines.length) return 'x'.repeat(HOURS_CLOSED_LENGTH);
      return lines.map(l => 'x'.repeat(WEEK_DAYS_LENGTH + l.ranges.length * HOURS_RANGE_LENGTH + (l.ranges.length - 1) * 2)).join('\n');
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
  brand: { purposes: ParsedPurpose[]; compositions: string[]; formats: string[]; illustrations?: string[]; photos?: string[]; themes?: string[]; location?: boolean; places?: ParsedPlace[]; windows?: string[] },
  fileName: string,
): string[] {
  const problems: string[] = [];
  const say = (msg: string) => problems.push(`${fileName}: ${msg}`);
  if (!brand.formats.includes(story.format)) say(`format "${story.format}" does not exist`);
  const place = brand.places ? storyPlace(story, brand.places) : undefined;
  if (brand.places && story.place && !place) say(`place "${story.place}" does not exist`);
  if (brand.windows && story.when && !brand.windows.includes(story.when)) say(`when "${story.when}" is not a window in the .brand`);

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
          else if (variable.needs && !place[variable.needs]) say(`${where}: variable "{${v}}" needs ${{ hours: 'an hours block', address: 'an address:', opening: 'an opening:' }[variable.needs]} in place "${place.id}"`);
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
    if (page.camera && purpose.camera === false) say(`${where}: photo: camera, but purpose "${purpose.id}" has camera: false`);
    if (page.theme && brand.themes && !brand.themes.includes(page.theme)) say(`${where}: theme "${page.theme}" does not exist`);
    checkTexts(where, purpose, page.texts);
  });
  story.examples.forEach((ex, i) => {
    for (const ep of ex.pages) {
      const purpose = purposes.get(story.pages[ep.page - 1].purpose);
      if (purpose) checkTexts(`example ${i + 1}, page ${ep.page}`, purpose, ep.texts);
      if (ep.photo && brand.photos && !brand.photos.includes(ep.photo)) say(`example ${i + 1}, page ${ep.page}: photo "${ep.photo}" does not exist`);
    }
  });
  return problems;
}
