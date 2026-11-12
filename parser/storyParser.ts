/**
 * Parser for .story files: ordered pages, each a purpose + composition with
 * fixed, variable or open slots, plus example fills for the open slots and an optional prompt that writes them.
 *
 * Strict, line-based format. Every line must match a known pattern or be blank.
 * Throws on parse errors with file name and line number. Cross-file checks
 * (purposes, compositions, formats, maxLength) live in `checkStory`.
 */

import { SLOT_IDS, type SlotId } from './types';
import type { ParsedPurpose } from './purposeParser';
import { addressStreet, weekOpeningDays, type ParsedPlace, type WeekHours } from './placeParser';
import { timeEntry, type ParsedTime, type TimeEntry } from './timeParser';
import { personLabel, hasSomethingToShow, type ParsedPerson } from './personParser';
import { groupHasSomethingToShow, type ParsedGroup } from './groupParser';
import { isHexItem, type ParsedWork } from './workParser';

// ── Parsed types ──────────────────────────────────────────────────────────────

/** Placeholders a page text may contain. Implementations resolve them for the story's date. */
export type StoryVariable =
  | 'weekday' | 'date'
  | 'sunrise' | 'sunset' | 'day-length' | 'moon'
  | 'temperature' | 'wind' | 'weather'
  | 'place' | 'address' | 'street' | 'hours' | 'week-hours' | 'opens' | 'closes' | 'opening'
  | 'new-week-hours' | 'new-hours-from'
  | 'season' | 'founded' | 'years' | 'daily'
  | 'person' | 'role' | 'since' | 'since-years' | 'reason'
  | 'group' | 'where' | 'group-since' | 'group-years'
  | 'work' | 'kind' | 'by' | 'price' | 'on' | 'time' | 'days-until'
  | 'item' | 'item-name' | 'item-note'
  | 'n' | 'count';

/** Longest resolved form per variable (German and English), used for the `maxLength` check.
 *  `location`: the variable needs coordinates: the story's place's, else the brand's `location`
 *  block. `place`: it needs the story's place; `needs`: and that place's `address:`, `hours` or `opening:`.
 *  `time`: it needs that part of the `.time`.
 *  `person`: it needs the page's person; `personNeeds`: and that key in the person's file. `group` and
 *  `work` likewise, with `groupNeeds` and `workNeeds`.
 *  A `maxLength` of 0 means the variable counts at the length of the fact it shows (see `checkStory`).
 *  `{daily NAME}` is written with its moment's name; the table lists it as `daily`. `{hours NAME}` is a
 *  place's set of special days and is listed with `hours`.
 *  `shortMaxLength`: the variable has a short form, written `{NAME short}`, and this is its longest. */
export const STORY_VARIABLES: Record<StoryVariable, { maxLength: number; shortMaxLength?: number; location?: true; place?: true; needs?: 'address' | 'hours' | 'opening' | 'hoursFrom'; time?: 'seasons' | 'founded' | 'daily'; person?: true; personNeeds?: 'since' | 'reason'; group?: true; groupNeeds?: 'where' | 'since'; work?: true; workNeeds?: 'price' | 'on' | 'time' | 'items'; list?: true }> = {
  weekday: { maxLength: 10, shortMaxLength: 3 },    // "Donnerstag", short "Thu"
  date: { maxLength: 13, shortMaxLength: 7 },       // "30. September", short "30. Sep"
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
  opening: { maxLength: 13, shortMaxLength: 7, place: true, needs: 'opening' }, // "30. September"
  'new-week-hours': { maxLength: 0, place: true, needs: 'hoursFrom' },           // the week of the next "hours from" block
  'new-hours-from': { maxLength: 13, shortMaxLength: 7, place: true, needs: 'hoursFrom' }, // the day it starts
  season: { maxLength: 0, time: 'seasons' },         // the season's label
  founded: { maxLength: 4, time: 'founded' },        // "2019"
  years: { maxLength: 3, time: 'founded' },          // "7"
  daily: { maxLength: 8, time: 'daily' },            // "10:30 AM"
  person: { maxLength: 0, person: true },            // the name, or the role without a name
  role: { maxLength: 0, person: true },              // the role
  since: { maxLength: 4, person: true, personNeeds: 'since' },        // "2006"
  'since-years': { maxLength: 3, person: true, personNeeds: 'since' }, // "20"
  reason: { maxLength: 0, person: true, personNeeds: 'reason' },      // the reason
  group: { maxLength: 0, group: true },              // the group's name
  where: { maxLength: 0, group: true, groupNeeds: 'where' },          // the region
  'group-since': { maxLength: 4, group: true, groupNeeds: 'since' },  // "2001"
  'group-years': { maxLength: 3, group: true, groupNeeds: 'since' },  // "25"
  work: { maxLength: 0, work: true },                // the title
  kind: { maxLength: 0, work: true },                // the kind
  by: { maxLength: 0, work: true },                  // the names of its by: ids, or the brand's name
  price: { maxLength: 0, work: true, workNeeds: 'price' },           // the price
  on: { maxLength: 13, shortMaxLength: 7, work: true, workNeeds: 'on' }, // "30. September"
  time: { maxLength: 17, work: true, workNeeds: 'time' },            // "10:30 AM–10:30 PM"
  'days-until': { maxLength: 3, work: true, workNeeds: 'on' },       // "365"
  item: { maxLength: 0, work: true, workNeeds: 'items' },            // the day's item: "#002B36"
  'item-name': { maxLength: 0, work: true, workNeeds: 'items' },     // its name
  'item-note': { maxLength: 0, work: true, workNeeds: 'items' },     // its note
  n: { maxLength: 2, list: true },                  // "10": the page's position in its page list
  count: { maxLength: 2, list: true },              // "10": how many pages the page list has
};

/** Longest form of one `{hours}` line without its label: "10:30 AM–10:30 PM". */
const HOURS_RANGE_LENGTH = 17;
/** Longest days part of a `{week-hours}` line, with its space: "Mon–Fri ". */
const WEEK_DAYS_LENGTH = 8;
/** `{hours}` on a closed day: "geschlossen". */
const HOURS_CLOSED_LENGTH = 11;
/** Longest day part of a `{hours NAME}` line, with its space: "Thu 30. Sep ". */
const SPECIAL_DAY_LENGTH = 12;
/** Longest part of a `{hours NAME}` line for a run of days, with its space: "Thu 30. Sep – Sat 30. Sep ". */
const SPECIAL_RUN_LENGTH = 26;
/** The word between two names in `{by}`, with its spaces: " and " / " und ". */
const BY_AND_LENGTH = 5;

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
  /** Name of a `.time` entry the story fits: a window or a season. Undefined = all year. */
  when?: string;
  /** Person id the story speaks about. Person variables resolve from it on every page that doesn't name its own. */
  person?: string;
  /** Group id the story speaks about. Group variables resolve from it on every page that doesn't name its own. */
  group?: string;
  /** Work id the story is about. Work variables resolve from it on every page that doesn't name its own, and
   *  the story is offered only while the work is in season. */
  work?: string;
  pages: ParsedStoryPage[];
  /** Example fills for the open slots, one story topic each. */
  examples: ParsedStoryExample[];
  /** The `prompt` block: the brief for writing the open slots anew for each date the story is posted on.
   *  Lines as written, joined with newlines. */
  prompt?: string;
  /** `model:` of the prompt block: the name of the model that writes. Undefined = the implementation's default. */
  promptModel?: string;
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
  /** `video:` video ids from the `.brand`: the page's ground is a video instead of a photo. With several, or
   *  beside `photo:`, they are one pool (the photos first, then the videos): implementations pick one per
   *  story date, the same one every time for that date. Since v0.53, a list and beside photos since v0.56. */
  videos?: string[];
  /** Theme name from the `.brand`; this page uses it instead of the colours the story starts with. */
  theme?: string;
  /** The page's ground: `#RRGGBB`, or `{item}` for the day's item of the page's work. Text and logo follow
   *  the brand's contrast rule against it. */
  background?: string;
  /** Page topic: what this page adds to the story. */
  topic?: string;
  /** Person id this page speaks about, instead of the story's. */
  person?: string;
  /** Group id this page speaks about, instead of the story's. */
  group?: string;
  /** Work id this page is about, instead of the story's. One page names one work. */
  work?: string;
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
const ID = /^[a-z][a-z0-9-]*$/;
const VARIABLE = /\{([a-z][a-z0-9-]*(?: [a-z][a-z0-9-]*)?)\}/g;

/** Variable names in a text, in order of appearance, each with its second word: `{daily oven}` gives
 *  "daily oven", `{date short}` gives "date short". */
export function storyTextVariables(text: string): string[] {
  return [...text.matchAll(VARIABLE)].map(m => m[1]);
}

/** The table key of a variable name: its first word, so "daily" for "daily oven" and "date" for "date short". */
function variableKey(name: string): StoryVariable | undefined {
  const key = name.split(' ')[0];
  return key in STORY_VARIABLES ? (key as StoryVariable) : undefined;
}

/** Whether a variable name carries a name of the brand's own as its second word: `{daily oven}`, a moment
 *  of the .time, and `{hours christmas}`, a place's set of special days. */
function isNamed(name: string): boolean {
  return name.startsWith('daily ') || name.startsWith('hours ');
}

/** Whether a variable name asks for the short form: "date short". `{daily short}` is the moment named
 *  "short", `{hours short}` the set of special days. */
function isShort(name: string): boolean {
  return name.endsWith(' short') && !isNamed(name);
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
  let person: string | undefined;
  let group: string | undefined;
  let work: string | undefined;
  const pages: (ParsedStoryPage & { line: number; keys: Set<string> })[] = [];
  const examples: (ParsedStoryExample & { line: number })[] = [];

  let currentPage: (typeof pages)[number] | null = null;
  let currentExample: (typeof examples)[number] | null = null;
  // Page inside the current example, with the line it starts on
  let currentExamplePage: (ParsedStoryExamplePage & { line: number; keys: Set<string> }) | null = null;
  // Slot whose multi-line value is being read, and the indent of its lines
  let multiKey: SlotId | null = null;
  let multiIndent = 0;
  // A blank line was read inside a multi-line slot text: the next line starts a new paragraph
  let multiBlank = false;
  const examplePageLines = new Map<ParsedStoryExamplePage, number>();
  // The `prompt` block: its header line once seen, whether its lines are being read, and its text
  let promptLine = 0;
  let inPrompt = false;
  const promptLines: string[] = [];
  let promptModel: string | undefined;

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
      if (v === 'daily') throw new Error(`${fileName}:${lineNum}: "{daily}" needs the moment's name, e.g. {daily oven}`);
      const key = variableKey(v);
      if (!key) throw new Error(`${fileName}:${lineNum}: unknown variable "{${v}}" (expected ${Object.keys(STORY_VARIABLES).map(k => (k === 'daily' ? '{daily NAME}' : k === 'hours' ? '{hours}, {hours NAME}' : `{${k}}`)).join(', ')})`);
      if (!isNamed(v) && v !== key) {
        const short = Object.entries(STORY_VARIABLES).filter(([, d]) => d.shortMaxLength).map(([k]) => `{${k} short}`).join(', ');
        if (!isShort(v)) throw new Error(`${fileName}:${lineNum}: "{${v}}": the only word after a variable's name is "short" (${short})`);
        if (!STORY_VARIABLES[key].shortMaxLength) throw new Error(`${fileName}:${lineNum}: "{${v}}": {${key}} has no short form (${short})`);
      }
    }
  }

  function closeBlocks() {
    currentPage = null;
    currentExample = null;
    currentExamplePage = null;
    multiKey = null;
    inPrompt = false;
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const raw = lines[i];
    const line = raw.trim();
    const indent = raw.length - raw.trimStart().length;

    // Blank line. Inside a multi-line slot text it is a paragraph break, once more text follows
    if (line === '') {
      if (multiKey && (currentExamplePage ?? currentPage)?.texts[multiKey]) multiBlank = true;
      continue;
    }

    // Prompt lines are free text, kept as written (a line may start with "#")
    if (inPrompt && indent >= 2) {
      // `model:` is a key only as the block's first line; anywhere else the line is part of the brief
      const model = promptLines.length === 0 && promptModel === undefined ? /^model:\s*(.*)$/.exec(line) : null;
      if (model) {
        if (!ID.test(model[1])) throw new Error(`${fileName}:${lineNum}: invalid model "${model[1]}" (expected a model name like haiku)`);
        promptModel = model[1];
      } else promptLines.push(line);
      continue;
    }

    if (line.startsWith('#')) {
      if (indent === 0) description = description ? `${description} ${line.slice(1).trim()}` : line.slice(1).trim();
      continue;
    }

    // Multi-line slot text: lines deeper than the bare `slot:` line
    if (multiKey && indent >= multiIndent) {
      const target = currentExamplePage ?? currentPage!;
      checkVariables(line, lineNum, !currentExamplePage);
      const prev = target.texts[multiKey];
      target.texts[multiKey] = prev ? `${prev}${multiBlank ? '\n\n' : '\n'}${line}` : line;
      multiBlank = false;
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
      if (line === 'prompt') {
        if (promptLine) throw new Error(`${fileName}:${lineNum}: duplicate "prompt" (a story has one)`);
        promptLine = lineNum;
        inPrompt = true;
        continue;
      }
      const colonIdx = line.indexOf(':');
      const key = colonIdx === -1 ? line : line.slice(0, colonIdx).trim();
      const value = colonIdx === -1 ? '' : line.slice(colonIdx + 1).trim();
      if (key === 'when' || key === 'person' || key === 'group' || key === 'work') {
        if (!ID.test(value)) throw new Error(`${fileName}:${lineNum}: invalid ${key} "${value}" (expected the ${key === 'when' ? 'name of one .time window or season' : `id of one .${key}`})`);
        if (key === 'when') when = value;
        else if (key === 'person') person = value;
        else if (key === 'group') group = value;
        else work = value;
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
      if (/^when\s*:/.test(line)) throw new Error(`${fileName}:${lineNum}: when: is not a page key: a page about an occasion names its work with "work:" (an event is a work since v0.44); a window or season goes on the story`);
      const read = readKey(line, lineNum, currentPage, ['purpose', 'composition', 'illustration', 'photo', 'video', 'theme', 'background', 'person', 'group', 'work', 'repeat'], true);
      if (read && 'multi' in read) { multiKey = read.multi; multiIndent = 4; }
      else if (read?.key === 'purpose') currentPage.purpose = read.value;
      else if (read?.key === 'person' || read?.key === 'group' || read?.key === 'work') {
        if (!ID.test(read.value)) throw new Error(`${fileName}:${lineNum}: invalid ${read.key} "${read.value}" (expected the id of one .${read.key})`);
        currentPage[read.key] = read.value;
      }
      else if (read?.key === 'illustration') currentPage.illustrations = read.value.split(',').map(id => id.trim()).filter(Boolean);
      else if (read?.key === 'photo') {
        const ids = read.value.split(',').map(id => id.trim()).filter(Boolean);
        if (ids.includes('camera')) {
          if (ids.length > 1) throw new Error(`${fileName}:${lineNum}: photo: camera stands alone, without photo ids`);
          if (currentPage.videos) throw new Error(`${fileName}:${lineNum}: photo: camera stands alone, without a video`);
          currentPage.camera = true;
        } else currentPage.photos = ids;
      }
      else if (read?.key === 'video') {
        if (currentPage.camera) throw new Error(`${fileName}:${lineNum}: photo: camera stands alone, without a video`);
        const ids = read.value.split(',').map(id => id.trim()).filter(Boolean);
        if (ids.length) currentPage.videos = ids;
      }
      else if (read?.key === 'theme') currentPage.theme = read.value;
      else if (read?.key === 'background') {
        if (!/^#[0-9a-fA-F]{6}$/.test(read.value) && read.value !== '{item}') throw new Error(`${fileName}:${lineNum}: invalid background "${read.value}" (expected #RRGGBB or {item})`);
        currentPage.background = read.value;
      }
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

  if (promptLine && promptLines.length === 0) throw new Error(`${fileName}:${promptLine}: "prompt" has no text (write the brief on the following, indented lines)`);

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
    ...(person ? { person } : {}),
    ...(group ? { group } : {}),
    ...(work ? { work } : {}),
    pages: pages.map(({ line: _line, keys: _keys, ...p }) => p),
    examples: examples.map(({ line: _line, ...ex }) => ({
      ...ex,
      pages: ex.pages.map(p => {
        const { line: _l, keys: _k, ...rest } = p as ParsedStoryExamplePage & { line: number; keys: Set<string> };
        return rest;
      }),
    })),
    ...(promptLines.length ? { prompt: promptLines.join('\n') } : {}),
    ...(promptModel ? { promptModel } : {}),
  };
}

// ── Cross-file checks ─────────────────────────────────────────────────────────

/** The place a story speaks for: the one its `place:` names, else the brand's only place. */
export function storyPlace(story: Pick<ParsedStory, 'place'>, places: ParsedPlace[]): ParsedPlace | undefined {
  if (story.place) return places.find(p => p.id === story.place);
  return places.length === 1 ? places[0] : undefined;
}

/** What a text's variables resolve from. A list that is undefined is not checked. */
export interface VariableSources {
  /** Whether the .brand has a `location` block. */
  location?: boolean;
  places?: ParsedPlace[];
  /** The place the text's variables read. */
  place?: ParsedPlace;
  /** A place was named that does not exist: reported where it is named, not per variable. */
  placeUnknown?: boolean;
  time?: ParsedTime | null;
  person?: ParsedPerson;
  group?: ParsedGroup;
  work?: ParsedWork;
  /** Which subjects are named at all, whether or not their file exists. */
  named: { person: boolean; group: boolean; work: boolean };
  /** Which subjects' files are known. */
  checked: { person: boolean; group: boolean; work: boolean };
  /** What a variable without its subject asks for: "a work: on the page or the story". */
  nameIt: { person: string; group: string; work: string };
}

/** Why a variable (as `storyTextVariables` gives it) cannot be filled from these sources, or undefined. */
export function variableProblem(v: string, src: VariableSources): string | undefined {
  const key = variableKey(v);
  if (!key) return `unknown variable "{${v}}"`;
  const variable = STORY_VARIABLES[key];
  const needs = (what: string) => `variable "{${v}}" needs ${what}`;
  const { place, time } = src;
  if (variable.location && src.location === false && place?.latitude === undefined) return needs('a location block in the .brand');
  if (variable.place && src.places && !src.placeUnknown) {
    if (!place) return needs(`a place: ${src.places.length > 1 ? 'name it with "place:"' : 'add a .place file'}`);
    if (v.startsWith('hours ')) {
      const name = v.slice('hours '.length);
      return place.specialHours?.some(s => s.name === name) ? undefined : needs(`an "hours ${name}" block in place "${place.id}"`);
    }
    if (variable.needs && !place[variable.needs]) return needs(`${{ hours: 'an hours block', address: 'an address:', opening: 'an opening:', hoursFrom: 'an "hours from" block' }[variable.needs]} in place "${place.id}"`);
  }
  if (variable.time && time !== undefined) {
    const noTime = time ? '' : ' (the brand has no .time)';
    if (variable.time === 'seasons' && !time?.seasons.length) return needs(`season blocks in the .time${noTime}`);
    if (variable.time === 'founded' && !time?.founded) return needs(`founded: in the .time${noTime}`);
    if (variable.time === 'daily') {
      const name = v.slice('daily '.length);
      if (!time?.daily.some(d => d.name === name)) return needs(`a daily moment "${name}" in the .time${noTime}`);
    }
  }
  if (variable.person && src.checked.person) {
    if (!src.named.person) return needs(src.nameIt.person);
    if (src.person && variable.personNeeds && !src.person[variable.personNeeds]) return needs(`${variable.personNeeds}: in person "${src.person.id}"`);
  }
  if (variable.group && src.checked.group) {
    if (!src.named.group) return needs(src.nameIt.group);
    if (src.group && variable.groupNeeds && !src.group[variable.groupNeeds]) return needs(`${variable.groupNeeds}: in group "${src.group.id}"`);
  }
  if (variable.work && src.checked.work) {
    if (!src.named.work) return needs(src.nameIt.work);
    if (src.work && variable.workNeeds && !src.work[variable.workNeeds]) return needs(`${variable.workNeeds}: in work "${src.work.id}"`);
    if (src.work?.items && (v === 'item-name' || v === 'item-note')) {
      const field = v === 'item-name' ? 'name' : 'note';
      const bare = src.work.items.find(item => !item[field]);
      if (bare) return needs(`a ${field} on every item of work "${src.work.id}", "${bare.value}" has none`);
    }
  }
  return undefined;
}

/** What a page's variables resolve from, as far as the brand's files are known. */
interface PageFacts {
  place?: ParsedPlace;
  time?: ParsedTime | null;
  person?: ParsedPerson;
  group?: ParsedGroup;
  work?: ParsedWork;
  /** Names `{by}` can show: the work's `by:` persons and groups, else the brand's name. */
  byNames?: string[];
}

/** A week's `{week-hours}` at its longest form: one line per run of days. */
function longestWeek(hours: WeekHours): string {
  const lines = weekOpeningDays(hours);
  if (!lines.length) return 'x'.repeat(HOURS_CLOSED_LENGTH);
  return lines.map(l => 'x'.repeat(WEEK_DAYS_LENGTH + l.ranges.length * HOURS_RANGE_LENGTH + (l.ranges.length - 1) * 2)).join('\n');
}

/** The longest of several texts. */
function longestOf(texts: string[]): string {
  return texts.reduce((a, b) => (b.length > a.length ? b : a), '');
}

/** A text with each variable at its longest form, `{hours}` as its longest lines for the place, a label
 *  or a name at its length. */
function longestText(text: string, { place, time, person, group, work, byNames }: PageFacts): string {
  return text.replace(VARIABLE, (_, v: string) => {
    if (v === 'season') return 'x'.repeat(Math.max(0, ...(time?.seasons ?? []).map(s => s.label.length)));
    if (v === 'person') return 'x'.repeat(person ? personLabel(person).length : 0);
    if (v === 'role') return 'x'.repeat(person?.role.length ?? 0);
    if (v === 'reason') return 'x'.repeat(person?.reason?.length ?? 0);
    if (v === 'group') return 'x'.repeat(group?.name.length ?? 0);
    if (v === 'where') return 'x'.repeat(group?.where?.length ?? 0);
    if (v === 'work') return 'x'.repeat(work?.title.length ?? 0);
    if (v === 'kind') return 'x'.repeat(work?.kind.length ?? 0);
    if (v === 'price') return 'x'.repeat(work?.price?.length ?? 0);
    if (v === 'item' || v === 'item-name' || v === 'item-note') {
      const field = v === 'item' ? 'value' : v === 'item-name' ? 'name' : 'note';
      return 'x'.repeat(Math.max(0, ...(work?.items ?? []).map(item => item[field]?.length ?? 0)));
    }
    if (v === 'by') {
      const names = byNames ?? [];
      return 'x'.repeat(names.reduce((n, name) => n + name.length, 0) + Math.max(0, names.length - 1) * BY_AND_LENGTH);
    }
    if (v === 'place') return 'x'.repeat(place?.name.length ?? 0);
    if (v === 'address') return 'x'.repeat(place?.address?.length ?? 0);
    if (v === 'street') return 'x'.repeat(place?.address ? addressStreet(place.address).length : 0);
    if (v === 'hours') {
      // Every day the place can have: of its regular weeks and of its special days
      const days = [
        ...[place?.hours, ...(place?.hoursFrom ?? []).map(h => h.hours)].flatMap(week => Object.values(week ?? {})),
        ...(place?.specialHours ?? []).flatMap(s => s.days.map(d => d.ranges)),
      ];
      const lines = Math.max(1, ...days.map(r => r.length));
      const line = Math.max(HOURS_CLOSED_LENGTH, ...days.flat().map(r => (r.label ? r.label.length + 2 : 0) + HOURS_RANGE_LENGTH));
      return Array.from({ length: lines }, () => 'x'.repeat(line)).join('\n');
    }
    if (v === 'week-hours') return longestOf([place?.hours ?? {}, ...(place?.hoursFrom ?? []).map(h => h.hours)].map(longestWeek));
    if (v === 'new-week-hours') return longestOf((place?.hoursFrom ?? []).map(h => longestWeek(h.hours)));
    if (v.startsWith('hours ')) {
      const set = place?.specialHours?.find(s => s.name === v.slice('hours '.length));
      return (set?.days ?? []).map(d => {
        const times = d.ranges.length ? d.ranges.length * HOURS_RANGE_LENGTH + (d.ranges.length - 1) * 2 : HOURS_CLOSED_LENGTH;
        return 'x'.repeat((d.from === d.to ? SPECIAL_DAY_LENGTH : SPECIAL_RUN_LENGTH) + times);
      }).join('\n');
    }
    const variable = STORY_VARIABLES[variableKey(v)!];
    return 'x'.repeat((isShort(v) ? variable?.shortMaxLength : variable?.maxLength) ?? 0);
  });
}

/** Checks a story against the brand's other files. Returns problems as "file: message";
 *  empty when the story fits. Variables count at their longest form for `maxLength`.
 *  `location: false` reports sky and weather variables (the brand has no `location` block) unless
 *  the story's place has coordinates.
 *  `places` (the brand's .place files) is checked when given: the story's `place:`, and the
 *  place that place variables need.
 *  `time` (the brand's .time, `null` when it has none) is checked when given: every `when:`, and what
 *  the time variables need. `people` (the brand's .person files, empty when none) likewise:
 *  every `person:`, a purpose's `person: required`, and what the person variables need. `groups` and
 *  `works` the same for `group:` and `work:`. `name` is the brand's name, what `{by}` shows without `by:`. */
export function checkStory(
  story: ParsedStory,
  brand: { purposes: ParsedPurpose[]; compositions: string[]; formats: string[]; illustrations?: string[]; photos?: string[]; videos?: string[]; themes?: string[]; location?: boolean; places?: ParsedPlace[]; time?: ParsedTime | null; people?: ParsedPerson[]; groups?: ParsedGroup[]; works?: ParsedWork[]; name?: string },
  fileName: string,
): string[] {
  const problems: string[] = [];
  const say = (msg: string) => problems.push(`${fileName}: ${msg}`);
  if (!brand.formats.includes(story.format)) say(`format "${story.format}" does not exist`);
  const place = brand.places ? storyPlace(story, brand.places) : undefined;
  if (brand.places && story.place && !place) say(`place "${story.place}" does not exist`);

  const { time, people, groups, works } = brand;
  const noTime = time ? '' : ' (the brand has no .time)';
  /** The `.time` entry a `when:` names, reporting an unknown one; undefined when unknown or unchecked. */
  const whenEntry = (when: string | undefined, where: string): TimeEntry | undefined => {
    if (!when || time === undefined) return undefined;
    const entry = time ? timeEntry(time, when) : undefined;
    if (!entry) say(`${where}when "${when}" is not in the .time${noTime}`);
    return entry;
  };
  whenEntry(story.when, '');
  const persons = people && new Map(people.map(p => [p.id, p]));
  const groupMap = groups && new Map(groups.map(g => [g.id, g]));
  const workMap = works && new Map(works.map(w => [w.id, w]));
  /** The person a `person:` names, reporting an unknown one; undefined when unknown or unchecked. */
  const personOf = (id: string | undefined, where: string): ParsedPerson | undefined => {
    if (!id || !persons) return undefined;
    const person = persons.get(id);
    if (!person) say(`${where}person "${id}" does not exist`);
    return person;
  };
  const groupOf = (id: string | undefined, where: string): ParsedGroup | undefined => {
    if (!id || !groupMap) return undefined;
    const group = groupMap.get(id);
    if (!group) say(`${where}group "${id}" does not exist`);
    return group;
  };
  const workOf = (id: string | undefined, where: string): ParsedWork | undefined => {
    if (!id || !workMap) return undefined;
    const work = workMap.get(id);
    if (!work) say(`${where}work "${id}" does not exist`);
    return work;
  };
  const storyPerson = personOf(story.person, '');
  const storyGroup = groupOf(story.group, '');
  const storyWork = workOf(story.work, '');
  /** What `{by}` shows for a work: the names of its `by:` ids, else the brand's name. */
  const byNamesOf = (work: ParsedWork | undefined): string[] | undefined => {
    if (!work) return undefined;
    if (!work.by) return brand.name ? [brand.name] : [];
    return work.by.map(id => persons?.get(id) ? personLabel(persons.get(id)!) : groupMap?.get(id)?.name ?? '');
  };

  const purposes = new Map(brand.purposes.map(p => [p.id, p]));
  /** Which of the page's subjects are named at all, by the page, the story or (for a group) the page's person. */
  type Named = { person: boolean; group: boolean; work: boolean };
  const checkTexts = (where: string, purpose: ParsedPurpose, texts: Partial<Record<SlotId, string>>, facts: PageFacts, named: Named) => {
    for (const [slotId, text] of Object.entries(texts) as [SlotId, string][]) {
      const slot = purpose.slots.find(s => s.id === slotId);
      if (!slot) { say(`${where}: slot "${slotId}" is not declared by purpose "${purpose.id}"`); continue; }
      if (slot.value) { say(`${where}: slot "${slotId}" has a fixed value in purpose "${purpose.id}"`); continue; }
      for (const v of new Set(storyTextVariables(text))) {
        const problem = variableProblem(v, {
          location: brand.location, places: brand.places, place, placeUnknown: !!story.place && !place, time,
          person: facts.person, group: facts.group, work: facts.work, named,
          checked: { person: !!persons, group: !!groupMap, work: !!workMap },
          nameIt: { person: 'a person: on the page or the story', group: 'a group: on the page or the story, or a person with a group', work: 'a work: on the page or the story' },
        });
        if (problem) say(`${where}: ${problem}`);
      }
      const longest = longestText(text, facts);
      const parts = slot.slotType === 'list' ? longest.split('\n') : [longest];
      if (slot.slotType === 'list' && slot.maxItems && parts.length > slot.maxItems) say(`${where}: slot "${slotId}" has ${parts.length} items, maxItems is ${slot.maxItems}`);
      for (const part of parts) {
        if (part.length > slot.maxLength) say(`${where}: slot "${slotId}" is ${part.length} characters long, maxLength is ${slot.maxLength}`);
      }
    }
  };

  /** What each page's variables resolve from: its own `person:`, `group:` and `work:`, else the story's;
   *  the group falls back to the page's person's. */
  const pageFacts = story.pages.map((page, i): [PageFacts, Named] => {
    const where = `page ${i + 1}: `;
    const person = page.person ? personOf(page.person, where) : storyPerson;
    const personGroupId = (page.person ?? story.person) ? person?.group : undefined;
    const groupId = page.group ?? story.group ?? personGroupId;
    const group = page.group ? groupOf(page.group, where) : story.group ? storyGroup : personGroupId ? groupOf(personGroupId, `${where}person "${person!.id}": `) : undefined;
    const work = page.work ? workOf(page.work, where) : storyWork;
    return [{ place, time, person, group, work, byNames: byNamesOf(work) }, { person: !!(page.person ?? story.person), group: !!groupId, work: !!(page.work ?? story.work) }];
  });

  story.pages.forEach((page, i) => {
    const where = `page ${i + 1}`;
    const [facts, named] = pageFacts[i];
    const purpose = purposes.get(page.purpose);
    if (!purpose) { say(`${where}: purpose "${page.purpose}" does not exist`); return; }
    if (purpose.person === 'required' && persons) {
      if (!named.person) say(`${where}: purpose "${purpose.id}" has person: required, but neither the page nor the story names a person`);
      else if (facts.person && !hasSomethingToShow(facts.person)) say(`${where}: person "${facts.person.id}" has neither a quote nor a photo, and purpose "${purpose.id}" has person: required`);
    }
    if (purpose.group === 'required' && groupMap) {
      if (!named.group) say(`${where}: purpose "${purpose.id}" has group: required, but neither the page nor the story names a group`);
      else if (facts.group && !groupHasSomethingToShow(facts.group)) say(`${where}: group "${facts.group.id}" has neither a quote nor a photo, and purpose "${purpose.id}" has group: required`);
    }
    if (purpose.work === 'required' && workMap && !named.work) say(`${where}: purpose "${purpose.id}" has work: required, but neither the page nor the story names a work`);
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
    if (brand.videos) for (const id of page.videos ?? []) if (!brand.videos.includes(id)) say(`${where}: video "${id}" does not exist`);
    if (page.camera && purpose.camera === false) say(`${where}: photo: camera, but purpose "${purpose.id}" has camera: false`);
    if (page.theme && brand.themes && !brand.themes.includes(page.theme)) say(`${where}: theme "${page.theme}" does not exist`);
    if (page.background === '{item}' && workMap) {
      if (!named.work) say(`${where}: background {item} needs a work: on the page or the story`);
      else if (facts.work && !facts.work.items) say(`${where}: background {item} needs items: in work "${facts.work.id}"`);
      else if (facts.work) {
        const notHex = facts.work.items!.find(item => !isHexItem(item.value));
        if (notHex) say(`${where}: background {item} needs colours, but item "${notHex.value}" of work "${facts.work.id}" is not #RRGGBB`);
      }
    }
    checkTexts(where, purpose, page.texts, facts, named);
  });
  if (story.prompt) {
    const open = story.pages.some(page => purposes.get(page.purpose)?.slots.some(slot => !slot.value && page.texts[slot.id] === undefined));
    if (!open && story.pages.every(page => purposes.has(page.purpose))) say('prompt: no page has an open slot for it to write');
  }
  story.examples.forEach((ex, i) => {
    for (const ep of ex.pages) {
      const purpose = purposes.get(story.pages[ep.page - 1].purpose);
      if (purpose) checkTexts(`example ${i + 1}, page ${ep.page}`, purpose, ep.texts, ...pageFacts[ep.page - 1]);
      if (ep.photo && brand.photos && !brand.photos.includes(ep.photo)) say(`example ${i + 1}, page ${ep.page}: photo "${ep.photo}" does not exist`);
    }
  });
  return problems;
}
