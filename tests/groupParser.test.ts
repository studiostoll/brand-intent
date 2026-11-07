/**
 * Tests for .group files: keys, members, links, photos, quotes, and the membership mirror.
 *
 * Run: npm test
 */

import { parseGroupFile, checkGroup, groupHasSomethingToShow } from '../parser/groupParser';
import { parsePersonFile, checkPerson } from '../parser/personParser';

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

const parse = (body: string) => parseGroupFile(body, 'fenster.group');
const HEAD = 'id: fenster\nname: Fenster\nrole: Band on the label\n';

console.log('\ngroup:');

test('parses keys and quotes', () => {
  const g = parse(`# groups/fenster.group
# A band on the label.

id:      fenster
name:    Fenster
role:    Band on the label
since:   2021-03-01
where:   Leipzig   # not a place: no hours
members: lena, ole, jakob
links:   https://fenster.band, https://fenster.bandcamp.com/#music
photos:  fenster-stage, fenster-van
context: Three people, post-punk, on the label since the first single.

quote
  We don't play festivals that don't pay the opening act.

quote
  Ten songs,
  38 minutes.
`);
  assertEq(g, {
    id: 'fenster', description: 'groups/fenster.group A band on the label.',
    name: 'Fenster', role: 'Band on the label', since: '2021-03-01', where: 'Leipzig',
    members: ['lena', 'ole', 'jakob'], links: ['https://fenster.band', 'https://fenster.bandcamp.com/#music'],
    photos: ['fenster-stage', 'fenster-van'], context: 'Three people, post-punk, on the label since the first single.',
    quotes: ["We don't play festivals that don't pay the opening act.", 'Ten songs,\n38 minutes.'],
  }, 'parsed');
});

test('id, name and role are required; no consent, no until', () => {
  assertThrows(() => parse('name: Fenster\nrole: Band\n'), 'missing group id');
  assertThrows(() => parse('id: fenster\nrole: Band\n'), 'group needs name:');
  assertThrows(() => parse('id: fenster\nname: Fenster\n'), 'group needs role:');
  assertThrows(() => parse('id: Fenster\nname: Fenster\nrole: Band\n'), 'group id must be lowercase kebab-case');
  assertThrows(() => parse(`${HEAD}consent: 2021-03-01\n`), 'unknown key "consent"');
  assertThrows(() => parse(`${HEAD}until: 2028-03-01\n`), 'unknown key "until"');
});

test('since takes a date or a year; members and photos are unique ids; links are https', () => {
  assertThrows(() => parse(`${HEAD}since: March 2021\n`), 'since must be a date YYYY-MM-DD or a year YYYY');
  assertEq(parse(`${HEAD}since: 2021\n`).since, '2021', 'bare year');
  assertThrows(() => parse(`${HEAD}members: lena, lena\n`), 'person "lena" is listed twice');
  assertThrows(() => parse(`${HEAD}members: Lena\n`), 'members must be person ids');
  assertThrows(() => parse(`${HEAD}photos: a, a\n`), 'photo "a" is listed twice');
  assertThrows(() => parse(`${HEAD}links: fenster.band\n`), 'links must be https links');
});

test('quotes are blocks of 2-space lines, never empty', () => {
  assertThrows(() => parse(`${HEAD}quote\n`), 'empty quote');
  assertThrows(() => parse(`${HEAD}quote\n    deep\n`), 'unexpected indent');
  assertThrows(() => parse(`${HEAD}  stray\n`), 'unexpected indent');
  assertEq(parse(`${HEAD}quote\n  # from the liner notes\n`).quotes, ['# from the liner notes'], 'words as written');
  assertEq(parse(HEAD).quotes, [], 'none');
});

test('unknown keys, duplicates, empty values', () => {
  assertThrows(() => parse(`${HEAD}genre: post-punk\n`), 'unknown key "genre"');
  assertThrows(() => parse(`${HEAD}role: Band\n`), 'duplicate "role"');
  assertThrows(() => parse(`${HEAD}where:\n`), 'empty where');
  assertThrows(() => parse(`${HEAD}members\n`), 'expected "key: value" or a quote block');
});

test('something to show: a quote or a photo', () => {
  assertEq(groupHasSomethingToShow({ quotes: [] }), false, 'nothing');
  assertEq(groupHasSomethingToShow({ quotes: ['x'] }), true, 'a quote');
  assertEq(groupHasSomethingToShow({ quotes: [], photos: ['p'] }), true, 'a photo');
});

console.log('\nmembership:');

const FENSTER = parse(`${HEAD}members: lena, ole\n`);
const LENA = parsePersonFile('id: lena\nrole: Singer\ngroup: fenster\n', 'lena.person');
const OLE = parsePersonFile('id: ole\nrole: Drummer\n', 'ole.person');
const ANNA = parsePersonFile('id: anna\nrole: Winemaker\ngroup: hirsch\n', 'anna.person');

test('a person\'s group: is a group id', () => {
  assertEq(LENA.group, 'fenster', 'parsed');
  assertThrows(() => parsePersonFile('id: lena\nrole: Singer\ngroup: The Band\n', 'lena.person'), 'group must be a group id');
});

test('checkGroup: every member exists and names the group', () => {
  assertEq(checkGroup(FENSTER, { people: [LENA, OLE] }, 'fenster.group'), ['fenster.group: member "ole" names no group (add "group: fenster" to the person)'], 'one side only');
  assertEq(checkGroup(FENSTER, { people: [LENA, ANNA] }, 'fenster.group'), ['fenster.group: member "ole" does not exist'], 'unknown member');
  assertEq(checkGroup(parse(`${HEAD}members: anna\n`), { people: [ANNA] }, 'fenster.group'), ['fenster.group: member "anna" belongs to group "hirsch" (add "group: fenster" to the person)'], 'another group');
  assertEq(checkGroup(FENSTER, {}, 'fenster.group'), [], 'not checked');
});

test('checkPerson: the group exists and lists the person', () => {
  assertEq(checkPerson(LENA, { groups: [FENSTER] }, 'lena.person'), [], 'fits');
  assertEq(checkPerson(ANNA, { groups: [FENSTER] }, 'anna.person'), ['anna.person: group "hirsch" does not exist'], 'unknown group');
  assertEq(checkPerson(parsePersonFile('id: jakob\nrole: Bass\ngroup: fenster\n', 'j.person'), { groups: [FENSTER] }, 'jakob.person'), ['jakob.person: group "fenster" doesn\'t list "jakob" in its members: (a membership is written on both sides)'], 'not a member');
  assertEq(checkPerson(parsePersonFile('id: t\nrole: Regular\nplace: quay\n', 't.person'), { places: [] }, 't.person'), ['t.person: place "quay" does not exist'], 'unknown place');
  assertEq(checkPerson(ANNA, {}, 'anna.person'), [], 'not checked');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
