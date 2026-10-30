/**
 * Tests for .story files: pages, open/fixed/variable slots, examples, cross-file checks.
 *
 * Run: npm test
 */

import { parseStoryFile, checkStory, storyTextVariables } from '../parser/storyParser';
import { parsePurposeFile } from '../parser/purposeParser';

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
  assertThrows(() => parse('page\n  purpose: notice\n  primary: Open {time}\n'), 'unknown variable "{time}"');
  assertEq(parse('page\n  purpose: notice\n  primary: a {B} c\n').pages[0].texts.primary, 'a {B} c', 'not a variable');
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

test('illustrations must exist when the brand lists them', () => {
  const s = parse('page\n  purpose: notice\n  illustration: one, missing\n');
  assertEq(checkStory(s, { ...BRAND, illustrations: ['one'] }, 's.story'), ['s.story: page 1: illustration "missing" does not exist'], 'problems');
  assertEq(checkStory(s, BRAND, 's.story'), [], 'not checked without a list');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
