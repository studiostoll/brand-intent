/**
 * Tests for .story files: pages, open/fixed/variable slots, examples, cross-file checks.
 *
 * Run: npm test
 */

import { parseStoryFile, checkStory, storyPlace, storyTextVariables } from '../parser/storyParser';
import { addressStreet, type ParsedPlace } from '../parser/placeParser';
import { parsePurposeFile } from '../parser/purposeParser';
import { parseTimeFile } from '../parser/timeParser';
import { parsePersonFile } from '../parser/personParser';
import { parseGroupFile } from '../parser/groupParser';
import { parseWorkFile } from '../parser/workParser';

let pass = 0;
let fail = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    fail++;
    console.log(`  ✗ ${name}`);
    console.log(`      ${err instanceof Error ? err.message : String(err)}`);
  }
}

function assertEq<T>(actual: T, expected: T, label = 'value') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}

function assertThrows(fn: () => unknown, match: string) {
  try { fn(); } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes(match)) throw new Error(`expected error containing "${match}", got "${msg}"`);
    return;
  }
  throw new Error(`expected error containing "${match}", nothing thrown`);
}

const HEAD = 'id: s\nformat: 9:16\n';
const parse = (body: string) => parseStoryFile(HEAD + body, 's.story');

const PURPOSE = parsePurposeFile(`id: notice
compositions: stack, panel

slot primary
  label: Headline
  typography: headline
  maxLength: 20

slot detail
  label: Items
  typography: body
  maxLength: 30
  type: list
    maxItems: 2
    maxLength: 12

slot label
  label: Badge
  typography: label
  maxLength: 10
  value: New

example
  primary: Open today
  detail:
    One
    Two
`, 'notice.purpose');
const BRAND = { purposes: [PURPOSE], compositions: ['stack', 'panel', 'grid'], formats: ['9:16'] };

console.log('\nstory pages:');

test('pages in order, fixed texts, open slots left out', () => {
  const s = parse('topic: The week ahead\n\npage\n  purpose: notice\n  composition: stack\n  primary: Hello\n\npage\n  purpose: notice\n  topic: Second\n');
  assertEq(s.topic, 'The week ahead', 'story topic');
  assertEq(s.pages, [
    { purpose: 'notice', texts: { primary: 'Hello' }, composition: 'stack' },
    { purpose: 'notice', texts: {}, topic: 'Second' },
  ], 'pages');
  assertEq(s.name, 'S', 'derived name');
});

test('multi-line slot text on 4-space lines', () => {
  const s = parse('page\n  purpose: notice\n  detail:\n    One\n    Two\n  primary: Hi\n');
  assertEq(s.pages[0].texts, { detail: 'One\nTwo', primary: 'Hi' }, 'texts');
});

test('required: id, format, a page, a purpose per page', () => {
  assertThrows(() => parseStoryFile('format: 9:16\npage\n  purpose: notice\n', 's.story'), 'missing story id');
  assertThrows(() => parseStoryFile('id: s\npage\n  purpose: notice\n', 's.story'), 'missing "format:"');
  assertThrows(() => parse('topic: x\n'), 'no pages');
  assertThrows(() => parse('page\n  primary: Hi\n'), 'page without "purpose:"');
});

test('unknown keys, duplicates and bad indent are errors', () => {
  assertThrows(() => parse('page\n  purpose: notice\n  body: x\n'), 'unknown key "body"');
  assertThrows(() => parse('page\n  purpose: notice\n  primary: a\n  primary: b\n'), 'duplicate "primary"');
  assertThrows(() => parse('page\n    purpose: notice\n'), 'unexpected indent');
  assertThrows(() => parse('colour: red\n'), 'unexpected');
});

console.log('\nvariables:');

test('{weekday} and {date} in page texts', () => {
  const s = parse('page\n  purpose: notice\n  primary: Open {weekday}\n  detail:\n    From {date}\n');
  assertEq(s.pages[0].texts, { primary: 'Open {weekday}', detail: 'From {date}' }, 'texts');
  assertEq(storyTextVariables('{weekday}, {date}'), ['weekday', 'date'], 'names');
});

test('unknown variable is an error, plain braces stay text', () => {
  assertThrows(() => parse('page\n  purpose: notice\n  primary: Open {clock}\n'), 'unknown variable "{clock}"');
  assertEq(parse('page\n  purpose: notice\n  primary: a {B} c\n').pages[0].texts.primary, 'a {B} c', 'not a variable');
});

test('sky and weather variables', () => {
  const s = parse('page\n  purpose: notice\n  primary: {sunrise}–{sunset}, {day-length}\n  detail:\n    {moon}\n    {temperature}, {wind}, {weather}\n');
  assertEq(storyTextVariables(s.pages[0].texts.primary!), ['sunrise', 'sunset', 'day-length'], 'names with a dash');
});

test('scrim: none takes the brand scrim off the story', () => {
  assertEq(parse('scrim: none\npage\n  purpose: notice\n').scrim, 'none', 'none');
  assertEq('scrim' in parse('page\n  purpose: notice\n'), false, 'absent');
  assertThrows(() => parse('scrim: 30%\npage\n  purpose: notice\n'), 'invalid scrim "30%"');
});

console.log('\nexamples:');

const TWO_PAGES = 'page\n  purpose: notice\n  primary: Fixed\n\npage\n  purpose: notice\n';

test('example fills open slots per page, with story and page topics', () => {
  const s = parse(`${TWO_PAGES}\nexample\n  topic: Story A\n  page 1\n    detail:\n      One\n  page 2\n    topic: Page A2\n    primary: Second\n`);
  assertEq(s.examples, [{ pages: [
    { page: 1, texts: { detail: 'One' } },
    { page: 2, texts: { primary: 'Second' }, topic: 'Page A2' },
  ], topic: 'Story A' }], 'examples');
});

test('example rules: page exists, slot not fixed, no variables, not empty', () => {
  assertThrows(() => parse(`${TWO_PAGES}\nexample\n  page 3\n    primary: x\n`), 'fills page 3, the story has 2');
  assertThrows(() => parse(`${TWO_PAGES}\nexample\n  page 1\n    primary: x\n`), 'is fixed on page 1');
  assertThrows(() => parse(`${TWO_PAGES}\nexample\n  page 2\n    primary: {weekday}\n`), 'variable "{weekday}" in an example');
  assertThrows(() => parse(`${TWO_PAGES}\nexample\n  topic: x\n`), 'example without pages');
  assertThrows(() => parse(`${TWO_PAGES}\nexample\n  page 2\n  page 2\n`), 'duplicate "page 2"');
});

console.log('\ncheckStory:');

test('a fitting story has no problems', () => {
  const s = parse('page\n  purpose: notice\n  composition: panel\n  primary: Open {weekday}\n');
  assertEq(checkStory(s, BRAND, 's.story'), [], 'problems');
});

test('missing format, purpose, composition', () => {
  const s = parseStoryFile('id: s\nformat: 1:1\npage\n  purpose: nope\npage\n  purpose: notice\n  composition: zz\npage\n  purpose: notice\n  composition: grid\n', 's.story');
  assertEq(checkStory(s, BRAND, 's.story'), [
    's.story: format "1:1" does not exist',
    's.story: page 1: purpose "nope" does not exist',
    's.story: page 2: composition "zz" does not exist',
    's.story: page 3: composition "grid" is not one of purpose "notice"\'s compositions',
  ], 'problems');
});

test('slots: undeclared, fixed by the purpose, maxLength with variables, list limits', () => {
  const s = parse('page\n  purpose: notice\n  meta: x\n  label: Hot\n  primary: Open on {weekday}!\n  detail:\n    a\n    b\n    Way too long item\n');
  assertEq(checkStory(s, BRAND, 's.story'), [
    's.story: page 1: slot "meta" is not declared by purpose "notice"',
    's.story: page 1: slot "label" has a fixed value in purpose "notice"',
    's.story: page 1: slot "detail" has 3 items, maxItems is 2',
    's.story: page 1: slot "detail" is 17 characters long, maxLength is 12',
  ], 'problems (primary fits: 19 of 20 with the longest weekday)');
  const long = parse('page\n  purpose: notice\n  primary: Open {weekday} {date}\n');
  assertEq(checkStory(long, BRAND, 's.story'), ['s.story: page 1: slot "primary" is 29 characters long, maxLength is 20'], 'variables at longest form');
});

test('example texts are checked too', () => {
  const s = parse(`${TWO_PAGES}\nexample\n  page 2\n    primary: Much longer than twenty\n`);
  assertEq(checkStory(s, BRAND, 's.story'), ['s.story: example 1, page 2: slot "primary" is 23 characters long, maxLength is 20'], 'problems');
});

test('illustration takes one id or a list', () => {
  const s = parse('page\n  purpose: notice\n  illustration: one, two\n\npage\n  purpose: notice\n  illustration: three\n\npage\n  purpose: notice\n');
  assertEq(s.pages[0].illustrations, ['one', 'two'], 'list');
  assertEq(s.pages[1].illustrations, ['three'], 'single');
  assertEq(s.pages[2].illustrations, undefined, 'none');
});

test('photo names one or more ids per page', () => {
  const s = parse('page\n  purpose: notice\n  photo: one\n\npage\n  purpose: notice\n  photo: one, two,three\n\npage\n  purpose: notice\n');
  assertEq(s.pages[0].photos, ['one'], 'one');
  assertEq(s.pages[1].photos, ['one', 'two', 'three'], 'list');
  assertEq(s.pages[2].photos, undefined, 'none');
});

test('photo: camera asks for a photo taken now', () => {
  const s = parse('page\n  purpose: notice\n  photo: camera\n');
  assertEq([s.pages[0].camera, s.pages[0].photos], [true, undefined], 'camera');
  assertThrows(() => parse('page\n  purpose: notice\n  photo: camera, one\n'), 'stands alone');
  const noCamera = { ...BRAND, purposes: BRAND.purposes.map(p => ({ ...p, camera: false })) };
  assertEq(checkStory(s, noCamera, 's.story'), ['s.story: page 1: photo: camera, but purpose "notice" has camera: false'], 'purpose without camera');
  assertEq(checkStory(s, BRAND, 's.story'), [], 'ok');
});

test('photo must exist when the brand lists them', () => {
  const s = parse('page\n  purpose: notice\n  photo: missing\n');
  assertEq(checkStory(s, { ...BRAND, photos: ['one'] }, 's.story'), ['s.story: page 1: photo "missing" does not exist'], 'unknown');
  assertEq(checkStory(s, BRAND, 's.story'), [], 'no list, no check');
});

test('theme sets one page\'s colours and must exist when the brand lists them', () => {
  const s = parse('page\n  purpose: notice\n\npage\n  purpose: notice\n  theme: Night\n');
  assertEq(s.pages[0].theme, undefined, 'none');
  assertEq(s.pages[1].theme, 'Night', 'named');
  assertEq(checkStory(s, { ...BRAND, themes: ['Day'] }, 's.story'), ['s.story: page 2: theme "Night" does not exist'], 'unknown');
  assertEq(checkStory(s, { ...BRAND, themes: ['Day', 'Night'] }, 's.story'), [], 'known');
});

test('an example page names the one photo its texts belong to', () => {
  const s = parse('page\n  purpose: notice\n  photo: one, two\n\nexample\n  page 1\n    photo: two\n    primary: Two\n');
  assertEq(s.examples[0].pages[0].photo, 'two', 'photo');
  assertEq(checkStory(s, { ...BRAND, photos: ['one', 'three'] }, 's.story').slice(1), ['s.story: example 1, page 1: photo "two" does not exist'], 'unknown');
  assertThrows(() => parse('page\n  purpose: notice\n\nexample\n  page 1\n    photo: one, two\n'), 'names one photo');
});

test('illustrations must exist when the brand lists them', () => {
  const s = parse('page\n  purpose: notice\n  illustration: one, missing\n');
  assertEq(checkStory(s, { ...BRAND, illustrations: ['one'] }, 's.story'), ['s.story: page 1: illustration "missing" does not exist'], 'problems');
  assertEq(checkStory(s, BRAND, 's.story'), [], 'not checked without a list');
});

const HARBOUR: ParsedPlace = { id: 'harbour', name: 'Harbour', description: '' };
const QUAY: ParsedPlace = { id: 'quay', name: 'Quay', description: '', hours: { thu: [{ label: 'Lunch', from: '12:00', to: '14:00' }, { from: '17:00', to: '22:00' }] } };

test('sky and weather variables need a location', () => {
  const s = parse('page\n  purpose: notice\n  primary: {wind} {wind}\n');
  assertEq(checkStory(s, { ...BRAND, location: false }, 's.story'), ['s.story: page 1: variable "{wind}" needs a location block in the .brand'], 'no location');
  assertEq(checkStory(s, { ...BRAND, location: true, places: [] }, 's.story'), [], 'location, no place needed');
  assertEq(checkStory(s, BRAND, 's.story'), [], 'not checked when unknown');
  assertEq(checkStory(s, { ...BRAND, location: false, places: [{ ...HARBOUR, latitude: 54, longitude: 10 }] }, 's.story'), [], 'the place\'s coordinates');
});

test('place variables need a place', () => {
  const s = parse('page\n  purpose: notice\n  primary: {place}\n');
  assertEq(checkStory(s, { ...BRAND, places: [] }, 's.story'), ['s.story: page 1: variable "{place}" needs a place: add a .place file'], 'no place');
  assertEq(checkStory(s, { ...BRAND, places: [HARBOUR] }, 's.story'), [], 'the only place');
  assertEq(checkStory(s, { ...BRAND, places: [HARBOUR, QUAY] }, 's.story'), ['s.story: page 1: variable "{place}" needs a place: name it with "place:"'], 'several places');
});

test('repeat: makes a page list, {n} and {count} count it', () => {
  const s = parse('page\n  purpose: notice\n  primary: {count} spots\n\npage\n  purpose: notice\n  repeat: 2-6\n  primary: {n}\n');
  assertEq(s.pages[1].repeat, { min: 2, max: 6 }, 'parsed');
  assertEq('repeat' in s.pages[0], false, 'absent');
  assertThrows(() => parse('page\n  purpose: notice\n  repeat: 3\n'), 'invalid repeat "3"');
  assertThrows(() => parse('page\n  purpose: notice\n  repeat: 4-2\n'), 'invalid repeat "4-2"');
  assertThrows(() => parse('page\n  purpose: notice\n  repeat: 0-2\n'), 'invalid repeat "0-2"');
  assertThrows(() => parse('page\n  purpose: notice\n  repeat: 1-3\npage\n  purpose: notice\n  repeat: 1-3\n'), 'at most one page with "repeat:"');
  assertThrows(() => parse('page\n  purpose: notice\n  primary: {n}\n'), '"{n}" only on the page with "repeat:"');
  assertThrows(() => parse('page\n  purpose: notice\n  primary: {count}\n'), '"{count}" needs a page with "repeat:"');
  assertEq(checkStory(s, BRAND, 's.story'), [], 'counts at 2 characters');
});

test('an example fills a page list copy by copy, up to its max', () => {
  const list = 'page\n  purpose: notice\n  repeat: 1-2\n';
  const s = parse(`${list}\nexample\n  page 1\n    secondary: One\n  page 1\n    secondary: Two\n`);
  assertEq(s.examples[0].pages.map(p => [p.page, p.texts.secondary]), [[1, 'One'], [1, 'Two']], 'two copies');
  assertThrows(() => parse(`${list}\nexample\n  page 1\n    secondary: A\n  page 1\n    secondary: B\n  page 1\n    secondary: C\n`), 'more than 2 copies of page 1');
});

const TIME = parseTimeFile(`founded: 2019-05-04
season winter
  label: Winter
  from: 12-01
season summer
  label: Summer
  from: 06-01
windows
  christmas: 11-27..12-24
daily
  oven: 04:00 Oven on
`, 't.time');
const NO_TIME = parseTimeFile('', 't.time');

test('when: names the .time entry the story fits', () => {
  const s = parse('when: christmas\npage\n  purpose: notice\n');
  assertEq(s.when, 'christmas', 'parsed');
  assertEq('when' in parse('page\n  purpose: notice\n'), false, 'absent');
  assertThrows(() => parse('when: Christmas Time\npage\n  purpose: notice\n'), 'invalid when');
  assertEq(checkStory(s, { ...BRAND, time: TIME }, 's.story'), [], 'known');
  assertEq(checkStory(s, { ...BRAND, time: NO_TIME }, 's.story'), ['s.story: when "christmas" is not in the .time'], 'unknown');
  assertEq(checkStory(s, { ...BRAND, time: null }, 's.story'), ['s.story: when "christmas" is not in the .time (the brand has no .time)'], 'no .time');
  assertEq(checkStory(s, BRAND, 's.story'), [], 'not checked when unknown');
});

test('a page has no when: since v0.44; an occasion is a work', () => {
  assertThrows(() => parse('page\n  purpose: notice\n  when: tasting\n'), 'when: is not a page key');
});

test('time variables need their part of the .time', () => {
  const s = parse('page\n  purpose: notice\n  primary: {season} {founded} {years} {daily oven}\n');
  assertEq(s.pages[0].texts.primary, '{season} {founded} {years} {daily oven}', 'texts');
  assertEq(storyTextVariables('{daily oven}'), ['daily oven'], 'daily with its name');
  assertEq(checkStory(s, { ...BRAND, time: TIME }, 's.story'), ['s.story: page 1: slot "primary" is 24 characters long, maxLength is 20'], 'Summer + 2019 + 7 + 10:30 AM');
  assertEq(checkStory(s, { ...BRAND, time: NO_TIME }, 's.story'), [
    's.story: page 1: variable "{season}" needs season blocks in the .time',
    's.story: page 1: variable "{founded}" needs founded: in the .time',
    's.story: page 1: variable "{years}" needs founded: in the .time',
    's.story: page 1: variable "{daily oven}" needs a daily moment "oven" in the .time',
  ], 'empty .time');
  assertEq(checkStory(s, BRAND, 's.story'), [], 'not checked');
  assertThrows(() => parse('page\n  purpose: notice\n  primary: {daily}\n'), '"{daily}" needs the moment\'s name');
  assertThrows(() => parse('page\n  purpose: notice\n  primary: {daily-oven}\n'), 'unknown variable "{daily-oven}"');
  assertEq(parse('page\n  purpose: notice\n  primary: {daily Oven}\n').pages[0].texts.primary, '{daily Oven}', 'not lowercase: plain text');
});

const THOMAS = parsePersonFile('id: thomas\nname: Thomas\nrole: Regular in Lemkenhafen\nsince: 2006\nreason: Holiday without a programme\n\nquote\n  The dyke is enough.\n', 'thomas.person');
const BAKER = parsePersonFile('id: baker\nrole: Baker\n', 'baker.person');
const REQUIRED = parsePurposeFile('id: portrait\ncompositions: stack\nperson: required\n\nslot primary\n  label: Headline\n  typography: headline\n  maxLength: 20\n\nexample\n  primary: Thomas\n', 'portrait.purpose');

test('person: names the story\'s or the page\'s person', () => {
  const s = parse('person: thomas\npage\n  purpose: notice\n\npage\n  purpose: notice\n  person: baker\n');
  assertEq(s.person, 'thomas', 'story');
  assertEq(s.pages.map(p => p.person), [undefined, 'baker'], 'pages');
  assertThrows(() => parse('person: Thomas\npage\n  purpose: notice\n'), 'invalid person');
  assertEq(checkStory(s, { ...BRAND, people: [THOMAS, BAKER] }, 's.story'), [], 'both exist');
  assertEq(checkStory(s, { ...BRAND, people: [THOMAS] }, 's.story'), ['s.story: page 2: person "baker" does not exist'], 'unknown page person');
  assertEq(checkStory(s, { ...BRAND, people: [] }, 's.story'), ['s.story: person "thomas" does not exist', 's.story: page 2: person "baker" does not exist'], 'nobody');
  assertEq(checkStory(s, BRAND, 's.story'), [], 'not checked');
});

test('person variables need a person and what they show', () => {
  const s = parse('person: thomas\npage\n  purpose: notice\n  primary: {person} {role} {since} {since-years} {reason}\n');
  assertEq(checkStory(s, { ...BRAND, people: [THOMAS] }, 's.story'), ['s.story: page 1: slot "primary" is 66 characters long, maxLength is 20'], 'at their lengths');
  const b = parse('person: baker\npage\n  purpose: notice\n  primary: {person}, {since}\n  detail:\n    {reason}\n');
  assertEq(checkStory(b, { ...BRAND, people: [BAKER] }, 's.story'), [
    's.story: page 1: variable "{since}" needs since: in person "baker"',
    's.story: page 1: variable "{reason}" needs reason: in person "baker"',
  ], 'role as the name, since and reason missing');
  const n = parse('page\n  purpose: notice\n  primary: {person}\n');
  assertEq(checkStory(n, { ...BRAND, people: [THOMAS] }, 's.story'), ['s.story: page 1: variable "{person}" needs a person: on the page or the story'], 'no person');
});

test('person: required needs a person with a quote or a photo', () => {
  const brand = { ...BRAND, purposes: [PURPOSE, REQUIRED], people: [THOMAS, BAKER] };
  assertEq(checkStory(parse('person: thomas\npage\n  purpose: portrait\n'), brand, 's.story'), [], 'a quote');
  assertEq(checkStory(parse('page\n  purpose: portrait\n'), brand, 's.story'), ['s.story: page 1: purpose "portrait" has person: required, but neither the page nor the story names a person'], 'nobody named');
  assertEq(checkStory(parse('page\n  purpose: portrait\n  person: baker\n'), brand, 's.story'), ['s.story: page 1: person "baker" has neither a quote nor a photo, and purpose "portrait" has person: required'], 'nothing to show');
  assertEq(checkStory(parse('page\n  purpose: portrait\n'), { ...brand, people: undefined }, 's.story'), [], 'not checked');
});

test('place: names the story\'s place', () => {
  const s = parse('place: quay\n\npage\n  purpose: notice\n  primary: {opens}\n');
  assertEq(s.place, 'quay', 'parsed');
  assertEq(checkStory(s, { ...BRAND, places: [HARBOUR, QUAY] }, 's.story'), [], 'found');
  assertEq(checkStory(s, { ...BRAND, places: [HARBOUR] }, 's.story'), ['s.story: place "quay" does not exist'], 'unknown, reported once');
  assertEq(storyPlace(s, [HARBOUR, QUAY])?.id, 'quay', 'storyPlace');
  assertEq(storyPlace(parse('page\n  purpose: notice\n'), [HARBOUR])?.id, 'harbour', 'only place');
});

test('place variables need what they show', () => {
  const s = parse('page\n  purpose: notice\n  primary: {address}\n');
  assertEq(checkStory(s, { ...BRAND, places: [HARBOUR] }, 's.story'), ['s.story: page 1: variable "{address}" needs an address: in place "harbour"'], 'address');
  const h = parse('page\n  purpose: notice\n  primary: {closes}\n');
  assertEq(checkStory(h, { ...BRAND, places: [HARBOUR] }, 's.story'), ['s.story: page 1: variable "{closes}" needs an hours block in place "harbour"'], 'hours');
  const st = parse('page\n  purpose: notice\n  primary: {street}\n');
  assertEq(checkStory(st, { ...BRAND, places: [HARBOUR] }, 's.story'), ['s.story: page 1: variable "{street}" needs an address: in place "harbour"'], 'street');
  assertEq(addressStreet('Quay 3, Harbour Town'), 'Quay 3', 'street part');
  const op = parse('page\n  purpose: notice\n  primary: {opening}\n');
  assertEq(checkStory(op, { ...BRAND, places: [HARBOUR] }, 's.story'), ['s.story: page 1: variable "{opening}" needs an opening: in place "harbour"'], 'opening');
  assertEq(checkStory(op, { ...BRAND, places: [{ ...HARBOUR, opening: '2026-11-28' }] }, 's.story'), [], 'opening given');
  assertThrows(() => parse('page\n  purpose: notice\n  primary: {opening-day}\n'), 'unknown variable "{opening-day}"');
});

test('{hours} counts as its lines for the place', () => {
  // Quay: up to two ranges a day, the longest "Lunch, " + 17
  const s = parse('page\n  purpose: notice\n  detail: {hours}\n');
  assertEq(checkStory(s, { ...BRAND, places: [QUAY] }, 's.story'), ['s.story: page 1: slot "detail" is 24 characters long, maxLength is 12', 's.story: page 1: slot "detail" is 24 characters long, maxLength is 12'], 'two lines, each too long');
  const p = parse('page\n  purpose: notice\n  primary: {place}\n');
  assertEq(checkStory(p, { ...BRAND, places: [{ ...HARBOUR, name: 'The Harbour Café on the Quay' }] }, 's.story'), ['s.story: page 1: slot "primary" is 28 characters long, maxLength is 20'], 'name length');
});

test('{week-hours} counts as one line per group of days', () => {
  // Quay: Thursday only, two ranges: "Mon–Fri " + 2 × 17 + ", "
  const s = parse('page\n  purpose: notice\n  detail: {week-hours}\n');
  assertEq(checkStory(s, { ...BRAND, places: [QUAY] }, 's.story'), ['s.story: page 1: slot "detail" is 44 characters long, maxLength is 12'], 'one line');
  assertEq(checkStory(s, { ...BRAND, places: [HARBOUR] }, 's.story'), ['s.story: page 1: variable "{week-hours}" needs an hours block in place "harbour"'], 'needs hours');
});

const FENSTER = parseGroupFile('id: fenster\nname: Fenster\nrole: Band on the label\nsince: 2021\nwhere: Leipzig\nmembers: lena\n\nquote\n  No festivals that don\'t pay the opening act.\n', 'fenster.group');
const DRAX = parseGroupFile('id: drax-mill\nname: Drax mill\nrole: The mill\n', 'drax-mill.group');
const LENA = parsePersonFile('id: lena\nname: Lena\nrole: Singer\ngroup: fenster\n', 'lena.person');
const ALBUM = parseWorkFile('id: nachtfahrt\ntitle: Nachtfahrt\nkind: album\nby: fenster, lena\non: 2026-11-20\nprice: from €15\n', 'nachtfahrt.work');
const LOAF = parseWorkFile('id: rye-loaf\ntitle: Rye loaf\nkind: bread\n', 'rye-loaf.work');
const GROUP_REQUIRED = parsePurposeFile('id: band\ncompositions: stack\ngroup: required\n\nslot primary\n  label: Headline\n  typography: headline\n  maxLength: 20\n\nexample\n  primary: Fenster\n', 'band.purpose');
const WORK_REQUIRED = parsePurposeFile('id: release\ncompositions: stack\nwork: required\n\nslot primary\n  label: Headline\n  typography: headline\n  maxLength: 20\n\nexample\n  primary: Out now\n', 'release.purpose');

console.log('\nstory groups and works:');

test('group: and work: name the story\'s or the page\'s group and work', () => {
  const s = parse('group: fenster\nwork: nachtfahrt\npage\n  purpose: notice\n\npage\n  purpose: notice\n  group: drax-mill\n  work: rye-loaf\n');
  assertEq([s.group, s.work], ['fenster', 'nachtfahrt'], 'story');
  assertEq(s.pages.map(p => [p.group, p.work]), [[undefined, undefined], ['drax-mill', 'rye-loaf']], 'pages');
  assertThrows(() => parse('group: Fenster\npage\n  purpose: notice\n'), 'invalid group');
  assertThrows(() => parse('page\n  purpose: notice\n  work: Rye Loaf\n'), 'invalid work');
  assertEq(checkStory(s, { ...BRAND, groups: [FENSTER, DRAX], works: [ALBUM, LOAF] }, 's.story'), [], 'all exist');
  assertEq(checkStory(s, { ...BRAND, groups: [FENSTER], works: [LOAF] }, 's.story'), ['s.story: work "nachtfahrt" does not exist', 's.story: page 2: group "drax-mill" does not exist'], 'unknown');
  assertEq(checkStory(s, BRAND, 's.story'), [], 'not checked');
});

test('group variables need a group, or a person with one', () => {
  const s = parse('group: fenster\npage\n  purpose: notice\n  primary: {group} {where} {group-since} {group-years}\n');
  assertEq(checkStory(s, { ...BRAND, groups: [FENSTER] }, 's.story'), ['s.story: page 1: slot "primary" is 24 characters long, maxLength is 20'], 'Fenster + Leipzig + 2021 + 25');
  const d = parse('group: drax-mill\npage\n  purpose: notice\n  primary: {where} {group-since}\n');
  assertEq(checkStory(d, { ...BRAND, groups: [DRAX] }, 's.story'), [
    's.story: page 1: variable "{where}" needs where: in group "drax-mill"',
    's.story: page 1: variable "{group-since}" needs since: in group "drax-mill"',
  ], 'where and since missing');
  const p = parse('person: lena\npage\n  purpose: notice\n  primary: {group}\n');
  assertEq(checkStory(p, { ...BRAND, people: [LENA], groups: [FENSTER] }, 's.story'), [], 'the person\'s group');
  assertEq(checkStory(p, { ...BRAND, people: [LENA], groups: [] }, 's.story'), ['s.story: page 1: person "lena": group "fenster" does not exist'], 'the person\'s group is unknown');
  const n = parse('page\n  purpose: notice\n  primary: {group}\n');
  assertEq(checkStory(n, { ...BRAND, groups: [FENSTER] }, 's.story'), ['s.story: page 1: variable "{group}" needs a group: on the page or the story, or a person with a group'], 'no group');
});

test('item variables and background: {item}', () => {
  const COLOURS = parseWorkFile('id: colour-of-the-day\ntitle: Colour of the day\nkind: series\non: 2026-12-01\nitems:\n  #1F3A5F  Harbour Night\n    After dark.\n  #F2C14E  Mustard\n    Warm.\n', 'c.work');
  const WORDS = parseWorkFile('id: word-of-the-week\ntitle: Word of the week\nkind: series\non: 2026-01-05\nitems:\n  Fernweh  Far-sickness\n', 'w.work');
  const s = parse('work: colour-of-the-day\npage\n  purpose: notice\n  background: {item}\n  primary: {item-name}\n');
  assertEq(s.pages[0].background, '{item}', 'parsed');
  assertEq(checkStory(s, { ...BRAND, works: [COLOURS] }, 's.story'), [], 'fits');
  const w = parse('work: word-of-the-week\npage\n  purpose: notice\n  background: {item}\n  primary: {item} {item-note}\n');
  assertEq(checkStory(w, { ...BRAND, works: [WORDS] }, 's.story'), [
    's.story: page 1: background {item} needs colours, but item "Fernweh" of work "word-of-the-week" is not #RRGGBB',
    's.story: page 1: variable "{item-note}" needs a note on every item of work "word-of-the-week", "Fernweh" has none',
  ], 'words are no colours');
  const n = parse('work: rye-loaf\npage\n  purpose: notice\n  background: {item}\n  primary: {item}\n');
  assertEq(checkStory(n, { ...BRAND, works: [LOAF] }, 's.story'), [
    's.story: page 1: background {item} needs items: in work "rye-loaf"',
    's.story: page 1: variable "{item}" needs items: in work "rye-loaf"',
  ], 'no items');
  const none = parse('page\n  purpose: notice\n  background: {item}\n');
  assertEq(checkStory(none, { ...BRAND, works: [COLOURS] }, 's.story'), ['s.story: page 1: background {item} needs a work: on the page or the story'], 'no work');
  assertEq(parse('page\n  purpose: notice\n  background: #FFCC00\n').pages[0].background, '#FFCC00', 'a fixed hex');
  assertThrows(() => parse('page\n  purpose: notice\n  background: {work}\n'), 'invalid background');
  assertThrows(() => parse('page\n  purpose: notice\n  background: yellow\n'), 'invalid background');
});

test('work variables need a work and what it has', () => {
  const s = parse('work: nachtfahrt\npage\n  purpose: notice\n  primary: {work} {kind} {by} {price}\n  detail:\n    {on} {days-until}\n');
  assertEq(checkStory(s, { ...BRAND, works: [ALBUM], groups: [FENSTER], people: [LENA] }, 's.story'), [
    's.story: page 1: slot "primary" is 42 characters long, maxLength is 20',
    's.story: page 1: slot "detail" is 17 characters long, maxLength is 12',
  ], 'Nachtfahrt + album + Fenster and Lena + from €15; 13 + 3');
  const l = parse('work: rye-loaf\npage\n  purpose: notice\n  primary: {by}\n  detail:\n    {price}\n    {time}\n');
  assertEq(checkStory(l, { ...BRAND, works: [LOAF], name: 'Krume' }, 's.story'), [
    's.story: page 1: variable "{price}" needs price: in work "rye-loaf"',
    's.story: page 1: variable "{time}" needs time: in work "rye-loaf"',
    's.story: page 1: slot "detail" is 17 characters long, maxLength is 12',
  ], 'without by: the brand\'s name (Krume fits); price and time missing, {time} at 17');
  const n = parse('page\n  purpose: notice\n  primary: {days-until}\n');
  assertEq(checkStory(n, { ...BRAND, works: [LOAF] }, 's.story'), ['s.story: page 1: variable "{days-until}" needs a work: on the page or the story'], 'no work');
  assertThrows(() => parse('page\n  purpose: notice\n  primary: {occasion}\n'), 'unknown variable "{occasion}"');
});

test('group: required and work: required', () => {
  const brand = { ...BRAND, purposes: [PURPOSE, GROUP_REQUIRED, WORK_REQUIRED], groups: [FENSTER, DRAX], works: [LOAF], people: [LENA] };
  assertEq(checkStory(parse('group: fenster\npage\n  purpose: band\n'), brand, 's.story'), [], 'a quote');
  assertEq(checkStory(parse('person: lena\npage\n  purpose: band\n'), brand, 's.story'), [], 'the person\'s group');
  assertEq(checkStory(parse('page\n  purpose: band\n'), brand, 's.story'), ['s.story: page 1: purpose "band" has group: required, but neither the page nor the story names a group'], 'no group');
  assertEq(checkStory(parse('page\n  purpose: band\n  group: drax-mill\n'), brand, 's.story'), ['s.story: page 1: group "drax-mill" has neither a quote nor a photo, and purpose "band" has group: required'], 'nothing to show');
  assertEq(checkStory(parse('work: rye-loaf\npage\n  purpose: release\n'), brand, 's.story'), [], 'a work');
  assertEq(checkStory(parse('page\n  purpose: release\n'), brand, 's.story'), ['s.story: page 1: purpose "release" has work: required, but neither the page nor the story names a work'], 'no work');
  assertEq(checkStory(parse('page\n  purpose: release\n'), { ...brand, works: undefined }, 's.story'), [], 'not checked');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
