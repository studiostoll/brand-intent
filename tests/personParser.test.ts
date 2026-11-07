/**
 * Tests for .person files: keys, dates, photos, quotes, and what the file is consent for.
 *
 * Run: npm test
 */

import { parsePersonFile, personLabel, isWithdrawn, hasSomethingToShow } from '../parser/personParser';

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

const parse = (body: string) => parsePersonFile(body, 'thomas.person');
const HEAD = 'id: thomas\nrole: Regular\n';

console.log('\nperson:');

test('parses keys and quotes', () => {
  const p = parse(`# people/thomas.person
# A regular from Lemkenhafen.

id:      thomas
name:    Thomas
role:    Regular in Lemkenhafen
since:   2006
place:   lemkenhafen
reason:  Holiday without a programme
context: Comes every May for two weeks.   # cycles every morning
photos:  thomas-jetty, thomas-bike
consent: 2026-05-02
until:   2028-05-02

quote
  I don't need a programme here. The dyke is enough.

quote
  Seven in the morning at the jetty,
  nobody there yet.
`);
  assertEq(p, {
    id: 'thomas', description: 'people/thomas.person A regular from Lemkenhafen.',
    name: 'Thomas', role: 'Regular in Lemkenhafen', since: '2006', place: 'lemkenhafen',
    reason: 'Holiday without a programme', context: 'Comes every May for two weeks.',
    photos: ['thomas-jetty', 'thomas-bike'], consent: '2026-05-02', until: '2028-05-02',
    quotes: ["I don't need a programme here. The dyke is enough.", 'Seven in the morning at the jetty,\nnobody there yet.'],
  }, 'parsed');
});

test('a person without a name is their role', () => {
  const p = parse('id: baker\nrole: Baker\nsince: 2019-05-04\n\nquote\n  What\'s gone is gone.\n');
  assertEq('name' in p, false, 'no name');
  assertEq(personLabel(p), 'Baker', 'label is the role');
  assertEq(personLabel({ name: 'Thomas', role: 'Regular' }), 'Thomas', 'label is the name');
});

test('id and role are required', () => {
  assertThrows(() => parse('role: Baker\n'), 'missing person id');
  assertThrows(() => parse('id: baker\n'), 'person needs role:');
  assertThrows(() => parse('id: Baker\nrole: Baker\n'), 'person id must be lowercase kebab-case');
});

test('dates: since takes a year, consent and until a full date after one another', () => {
  assertThrows(() => parse(`${HEAD}since: May 2006\n`), 'since must be a date YYYY-MM-DD or a year YYYY');
  assertThrows(() => parse(`${HEAD}consent: 2026\n`), 'consent must be a date YYYY-MM-DD');
  assertThrows(() => parse(`${HEAD}until: 2026-02-30\n`), 'until must be a date YYYY-MM-DD');
  assertThrows(() => parse(`${HEAD}consent: 2026-05-02\nuntil: 2026-05-02\n`), 'until 2026-05-02 is not after consent 2026-05-02');
  assertEq(parse(`${HEAD}until: 2028-05-02\n`).until, '2028-05-02', 'until without consent');
});

test('photos are unique ids', () => {
  assertThrows(() => parse(`${HEAD}photos: a, a\n`), 'photo "a" is listed twice');
  assertThrows(() => parse(`${HEAD}photos: Thomas Jetty\n`), 'photos must be photo ids');
  assertThrows(() => parse(`${HEAD}place: Lemkenhafen\n`), 'place must be a place id');
});

test('quotes are blocks of 2-space lines, never empty', () => {
  assertThrows(() => parse(`${HEAD}quote\n`), 'empty quote');
  assertThrows(() => parse(`${HEAD}quote\n    deep\n`), 'unexpected indent');
  assertThrows(() => parse(`${HEAD}  stray\n`), 'unexpected indent');
  assertEq(parse(`${HEAD}quote\n  # not a comment, the person's words\n`).quotes, ["# not a comment, the person's words"], 'words as written');
});

test('unknown keys, duplicates, empty values', () => {
  assertThrows(() => parse(`${HEAD}age: 42\n`), 'unknown key "age"');
  assertThrows(() => parse(`${HEAD}role: Baker\n`), 'duplicate "role"');
  assertThrows(() => parse(`${HEAD}reason:\n`), 'empty reason');
  assertThrows(() => parse(`${HEAD}consent\n`), 'expected "key: value" or a quote block');
});

test('withdrawn from until: on; something to show', () => {
  assertEq(isWithdrawn({ until: '2028-05-02' }, '2028-05-01'), false, 'before');
  assertEq(isWithdrawn({ until: '2028-05-02' }, '2028-05-02'), true, 'the day');
  assertEq(isWithdrawn({}, '2030-01-01'), false, 'no until');
  assertEq(hasSomethingToShow({ quotes: [] }), false, 'nothing');
  assertEq(hasSomethingToShow({ quotes: ['x'] }), true, 'a quote');
  assertEq(hasSomethingToShow({ quotes: [], photos: ['p'] }), true, 'a photo');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
