/**
 * Tests for .work files: keys, dates and days, facts, in season, days until, and the cross-file checks.
 *
 * Run: npm test
 */

import { parseWorkFile, checkWork, isWorkInSeason, daysUntil, isWorkWithdrawn, workItem, colorDistance } from '../parser/workParser';
import { parseTimeFile } from '../parser/timeParser';

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

const parse = (body: string) => parseWorkFile(body, 'rye-loaf.work');
const HEAD = 'id: rye-loaf\ntitle: Rye loaf\nkind: bread\n';
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

console.log('\nwork:');

test('parses a release', () => {
  const w = parseWorkFile(`# works/quasi-casa.work
# A release.

id:     quasi-casa
title:  Quasi Casa
kind:   album
by:     giardini-di-miro
on:     2025-10-24
lead:   42
price:  from €15   # 2xLP
links:  https://www.2ndrec.com/products/quasi-casa
photos: quasi-casa-sleeve
facts:
  A live recording of their final show.
  2xLP with download code and a 20-page booklet.
`, 'quasi-casa.work');
  assertEq(w, {
    id: 'quasi-casa', description: 'works/quasi-casa.work A release.', title: 'Quasi Casa', kind: 'album',
    by: ['giardini-di-miro'], on: { from: '2025-10-24', to: '2025-10-24', yearly: false }, lead: 42,
    price: 'from €15', links: ['https://www.2ndrec.com/products/quasi-casa'], photos: ['quasi-casa-sleeve'],
    facts: 'A live recording of their final show.\n2xLP with download code and a 20-page booklet.',
    reviews: [],
  }, 'parsed');
});

test('parses a class with days, a time, a place and a when', () => {
  const w = parse(`${HEAD}days: thu-fri, sun\ntime: 14:00-18:00\nplace: weserstrasse\nwhen: advent\nuntil: 2026-12-24\n`);
  assertEq([w.days, w.time, w.place, w.when, w.until, w.lead], [['thu', 'fri', 'sun'], { from: '14:00', to: '18:00' }, 'weserstrasse', 'advent', '2026-12-24', 14], 'keys');
  assertEq(parse(`${HEAD}time: 19:00\n`).time, { from: '19:00' }, 'single time');
  assertEq('on' in parse(HEAD), false, 'no on');
});

test('id, title and kind are required', () => {
  assertThrows(() => parse('title: Rye loaf\nkind: bread\n'), 'missing work id');
  assertThrows(() => parse('id: rye-loaf\nkind: bread\n'), 'work needs title:');
  assertThrows(() => parse('id: rye-loaf\ntitle: Rye loaf\n'), 'work needs kind:');
  assertThrows(() => parse('id: Rye Loaf\ntitle: Rye loaf\nkind: bread\n'), 'work id must be lowercase kebab-case');
});

test('on takes yearly and one-off forms, lead needs it, until comes after it', () => {
  const on = (v: string) => parse(`${HEAD}on: ${v}\n`).on;
  assertEq(on('05-02'), { from: '05-02', to: '05-02', yearly: true }, 'yearly day');
  assertEq(on('12-27..01-02'), { from: '12-27', to: '01-02', yearly: true }, 'yearly run over the year end');
  assertEq(on('2026-11-20..2026-11-22'), { from: '2026-11-20', to: '2026-11-22', yearly: false }, 'one-off run');
  assertThrows(() => on('2026-11-22..2026-11-20'), 'on ends before it starts');
  assertThrows(() => on('05-02..2026-05-02'), 'on must be "MM-DD"');
  assertThrows(() => on('02-30'), 'on must be "MM-DD"');
  assertThrows(() => on('20 November'), 'on must be "MM-DD"');
  assertThrows(() => parse(`${HEAD}lead: two\non: 05-02\n`), 'lead must be a whole number of days');
  assertThrows(() => parse(`${HEAD}lead: 21\n`), 'lead counts the days before on:, which the work doesn\'t have');
  assertThrows(() => parse(`${HEAD}on: 2026-11-20\nuntil: 2026-11-19\n`), 'until 2026-11-19 is before on 2026-11-20');
  assertThrows(() => parse(`${HEAD}until: 2026\n`), 'until must be a date YYYY-MM-DD');
});

test('days, time, when, place, by, photos, links', () => {
  assertThrows(() => parse(`${HEAD}days: saturday\n`), 'days must be weekdays like sat, thu-fri or mon, wed');
  assertThrows(() => parse(`${HEAD}time: 7pm\n`), 'time must be "HH:MM-HH:MM" or "HH:MM"');
  assertThrows(() => parse(`${HEAD}when: Advent\n`), 'when must be the name of a .time window or season');
  assertThrows(() => parse(`${HEAD}place: The Shop\n`), 'place must be a place id');
  assertThrows(() => parse(`${HEAD}by: Drax Mill\n`), 'by must be person or group ids');
  assertThrows(() => parse(`${HEAD}by: a, a\n`), '"a" is listed twice in by');
  assertThrows(() => parse(`${HEAD}photos: a, a\n`), '"a" is listed twice in photos');
  assertThrows(() => parse(`${HEAD}links: 2ndrec.com\n`), 'links must be https links');
  assertEq(parse(`${HEAD}by: drax-mill, baker\n`).by, ['drax-mill', 'baker'], 'several');
});

test('facts is a block of 2-space lines', () => {
  assertThrows(() => parse(`${HEAD}facts: Rye 1150\n`), 'facts go on the following 2-space lines');
  assertThrows(() => parse(`${HEAD}facts:\n`), 'empty facts');
  assertThrows(() => parse(`${HEAD}facts:\n    deep\n`), 'unexpected indent');
  assertThrows(() => parse(`${HEAD}facts:\n  a\nfacts:\n  b\n`), 'duplicate "facts"');
  assertEq(parse(`${HEAD}facts:\n  Rye 1150   # with a comment kept\n  # a line that starts with a hash is a fact too\n`).facts, 'Rye 1150   # with a comment kept\n# a line that starts with a hash is a fact too', 'as written');
});

test('unknown keys, duplicates, empty values', () => {
  assertThrows(() => parse(`${HEAD}weight: 750 g\n`), 'unknown key "weight"');
  assertThrows(() => parse(`${HEAD}kind: loaf\n`), 'duplicate "kind"');
  assertThrows(() => parse(`${HEAD}price:\n`), 'empty price');
  assertThrows(() => parse(`${HEAD}  stray\n`), 'unexpected indent');
});

console.log('\nin season:');

const TIME = parseTimeFile('season winter\n  label: Winter\n  from: 12-01\nseason summer\n  label: Summer\n  from: 06-01\nwindows\n  advent: 11-27..12-24\n', 'k.time');
const MILL = parse(`${HEAD}on: 05-02\nlead: 21\n`);
const FAIR = parse(`${HEAD}on: 12-27..01-02\n`);
const ALBUM = parse(`${HEAD}on: 2026-11-20\nlead: 42\n`);
const SHOW = parse(`${HEAD}on: 2026-11-20\nuntil: 2026-11-20\n`);
const BLEND = parse(`${HEAD}days: sat\n`);
const STOLLEN = parse(`${HEAD}when: advent\non: 11-27..12-24\n`);
const CLASS = parse(`${HEAD}days: sat\nwhen: winter\n`);

test('a work without dates fits all year', () => {
  assertEq(isWorkInSeason(parse(HEAD), TIME, day(2026, 7, 1)), true, 'any day');
  assertEq(isWorkInSeason(parse(HEAD), null, day(2026, 7, 1)), true, 'no .time needed');
});

test('a yearly on: from lead days before to its end', () => {
  assertEq(isWorkInSeason(MILL, TIME, day(2026, 4, 11)), true, 'lead 21: three weeks before');
  assertEq(isWorkInSeason(MILL, TIME, day(2026, 4, 10)), false, 'a day earlier');
  assertEq(isWorkInSeason(MILL, TIME, day(2026, 5, 2)), true, 'the day');
  assertEq(isWorkInSeason(MILL, TIME, day(2026, 5, 3)), false, 'the day after');
  assertEq(isWorkInSeason(FAIR, TIME, day(2026, 12, 20)), true, 'yearly run, lead over the year end');
  assertEq(isWorkInSeason(FAIR, TIME, day(2027, 1, 2)), true, 'last day of the run in the new year');
  assertEq(isWorkInSeason(FAIR, TIME, day(2027, 1, 3)), false, 'after the run');
});

test('a one-off on: is a launch: in season from lead days before, and from then on', () => {
  assertEq(isWorkInSeason(ALBUM, TIME, day(2026, 10, 8)), false, 'too early');
  assertEq(isWorkInSeason(ALBUM, TIME, day(2026, 10, 9)), true, '42 days before');
  assertEq(isWorkInSeason(ALBUM, TIME, day(2026, 11, 20)), true, 'the day');
  assertEq(isWorkInSeason(ALBUM, TIME, day(2027, 6, 1)), true, 'still out');
  assertEq(isWorkInSeason(SHOW, TIME, day(2026, 11, 20)), true, 'a show on its day');
  assertEq(isWorkInSeason(SHOW, TIME, day(2026, 11, 21)), false, 'withdrawn with until: the day after');
});

test('days:, when:, and all of them together', () => {
  assertEq(isWorkInSeason(BLEND, TIME, day(2026, 11, 7)), true, 'Saturday');
  assertEq(isWorkInSeason(BLEND, TIME, day(2026, 11, 8)), false, 'Sunday');
  assertEq(isWorkInSeason(STOLLEN, TIME, day(2026, 11, 20)), false, 'in the lead of the shelf run, but advent not yet open');
  assertEq(isWorkInSeason(STOLLEN, TIME, day(2026, 12, 1)), true, 'advent, after on:');
  assertEq(isWorkInSeason(STOLLEN, TIME, day(2026, 12, 25)), false, 'advent over');
  assertEq(isWorkInSeason(STOLLEN, null, day(2026, 12, 1)), false, 'when: without a .time is never in season');
  assertEq(isWorkInSeason(CLASS, TIME, day(2026, 12, 5)), true, 'a Saturday in winter');
  assertEq(isWorkInSeason(CLASS, TIME, day(2026, 7, 4)), false, 'a Saturday in summer');
});

test('daysUntil counts to the next on: day; nothing after a one-off', () => {
  assertEq(daysUntil(MILL, day(2026, 4, 11)), 21, 'three weeks');
  assertEq(daysUntil(MILL, day(2026, 5, 2)), 0, 'the day');
  assertEq(daysUntil(MILL, day(2026, 5, 3)), 364, 'next year');
  assertEq(daysUntil(ALBUM, day(2026, 11, 8)), 12, 'before the release');
  assertEq(daysUntil(ALBUM, day(2026, 11, 21)), undefined, 'after it');
  assertEq(daysUntil(BLEND, day(2026, 11, 8)), undefined, 'no on:');
  assertEq(isWorkWithdrawn(SHOW, '2026-11-20'), false, 'on its until: day');
  assertEq(isWorkWithdrawn(SHOW, '2026-11-21'), true, 'after');
  assertEq(isWorkWithdrawn(BLEND, '2030-01-01'), false, 'no until');
});


console.log('\nitems:');

const SERIES = parse(`${HEAD}on: 2026-12-01\nuntil: 2026-12-31\nitems\n`.replace('items\n', `items:
  #1F3A5F  Harbour Night
    The colour of the quay
    after dark.
  #F2C14E  Mustard
  # warm ones next
  #C8553D
`));

test('items: value, name, note; # lines inside are items unless "# …"', () => {
  assertEq(SERIES.items, [
    { value: '#1F3A5F', name: 'Harbour Night', note: 'The colour of the quay after dark.' },
    { value: '#F2C14E', name: 'Mustard' },
    { value: '#C8553D' },
  ], 'items');
  assertEq(SERIES.itemsCycle, undefined, 'no cycle');
  const words = parse(`${HEAD}on: 2026-01-05\ndays: mon\nitems: cycle\n  Wanderlust  The urge to go\n  Fernweh\n`);
  assertEq(words.items!.map(i => i.value), ['Wanderlust', 'Fernweh'], 'words');
  assertEq(words.itemsCycle, true, 'cycle');
});

test('items: errors', () => {
  assertThrows(() => parse(`${HEAD}items:\n  Fernweh\n`), 'needs a one-off on:');
  assertThrows(() => parse(`${HEAD}on: 05-02\nitems:\n  Fernweh\n`), 'needs a one-off on:');
  assertThrows(() => parse(`${HEAD}on: 2026-01-05\nitems:\n`), 'empty items');
  assertThrows(() => parse(`${HEAD}on: 2026-01-05\nitems: shuffle\n  Fernweh\n`), 'items: cycle');
  assertThrows(() => parse(`${HEAD}on: 2026-01-05\nitems:\n  Fernweh\n  fernweh\n`), 'repeats line');
  assertThrows(() => parse(`${HEAD}on: 2026-01-05\nitems:\n  #FDF6E3  One\n  #FFF8E7  Two\n`), 'looks the same');
  assertThrows(() => parse(`${HEAD}on: 2026-01-05\nitems:\n      Fernweh\n`), 'unexpected indent');
});

test('colorDistance: OKLab, black to white is 1', () => {
  assertEq(Math.round(colorDistance('#000000', '#FFFFFF') * 1000) / 1000, 1, 'black-white');
  assertEq(colorDistance('#268BD2', '#268bd2'), 0, 'case');
});

test('workItem: one per day from on:, none before, after the last or after until:', () => {
  assertEq(workItem(SERIES, day(2026, 11, 30)), undefined, 'before');
  assertEq(workItem(SERIES, day(2026, 12, 1))?.value, '#1F3A5F', 'first day');
  assertEq(workItem(SERIES, day(2026, 12, 3))?.value, '#C8553D', 'third day');
  assertEq(workItem(SERIES, day(2026, 12, 4)), undefined, 'list used up');
  const long = { ...SERIES, items: Array.from({ length: 40 }, (_, i) => ({ value: `w${i}` })) };
  assertEq(workItem(long, day(2026, 12, 31))?.value, 'w30', 'on until:');
  assertEq(workItem(long, day(2027, 1, 1)), undefined, 'after until:');
});

test('workItem: days: count the times it comes round, the item holds in between; cycle starts over', () => {
  const weekly = parse(`${HEAD}on: 2026-01-05\ndays: mon\nitems: cycle\n  Wanderlust\n  Fernweh\n`);
  assertEq(workItem(weekly, day(2026, 1, 5))?.value, 'Wanderlust', 'first Monday');
  assertEq(workItem(weekly, day(2026, 1, 11))?.value, 'Wanderlust', 'the Sunday after');
  assertEq(workItem(weekly, day(2026, 1, 12))?.value, 'Fernweh', 'second Monday');
  assertEq(workItem(weekly, day(2026, 1, 19))?.value, 'Wanderlust', 'starts over');
  const fromSunday = parse(`${HEAD}on: 2026-01-04\ndays: mon\nitems:\n  Wanderlust\n`);
  assertEq(workItem(fromSunday, day(2026, 1, 4)), undefined, 'on: is not one of its days');
  assertEq(workItem(fromSunday, day(2026, 1, 5))?.value, 'Wanderlust', 'first Monday');
});

console.log('\nreviews:');

test('review blocks: by, on, link, then the words verbatim', () => {
  const w = parse(`${HEAD}review
  by:   Jane Roe, Field Notes
  on:   2025-11-02
  link: https://example.com/review#quasi
  A record that knows when to stop.
  # Not a comment: the critic's words as written.
review
  by: Sam Poe, Quiet Pages
  Quiet, then loud.
  by: no means a key once the words have started.
`);
  assertEq(w.reviews, [
    { text: "A record that knows when to stop.\n# Not a comment: the critic's words as written.", by: 'Jane Roe, Field Notes', on: '2025-11-02', link: 'https://example.com/review#quasi' },
    { text: 'Quiet, then loud.\nby: no means a key once the words have started.', by: 'Sam Poe, Quiet Pages' },
  ]);
  assertEq(parse(HEAD).reviews, [], 'none');
});

test('review errors', () => {
  assertThrows(() => parse(`${HEAD}review\n  Words without a credit.\n`), 'review needs by:');
  assertThrows(() => parse(`${HEAD}review\n  by: Jane Roe\n`), 'empty review');
  assertThrows(() => parse(`${HEAD}review\n  by: Jane Roe\n  by: Sam Poe\n  Words.\n`), 'duplicate "by" in review');
  assertThrows(() => parse(`${HEAD}review\n  by: Jane Roe\n  on: 2025-11\n  Words.\n`), 'review on must be a date');
  assertThrows(() => parse(`${HEAD}review\n  by: Jane Roe\n  link: http://example.com\n  Words.\n`), 'review link must be an https link');
  assertThrows(() => parse(`${HEAD}review\n    by: Jane Roe\n`), 'a review\'s lines use 2 spaces');
});

console.log('\ncross-file:');

test('checkWork: by: is a person or a group, when: in the .time, place: exists', () => {
  const w = parse(`${HEAD}by: drax-mill, baker\nwhen: advent\nplace: weserstrasse\n`);
  const people = [{ id: 'baker' }];
  const groups = [{ id: 'drax-mill' }];
  const places = [{ id: 'weserstrasse' }];
  assertEq(checkWork(w, { people, groups, time: TIME, places }, 'w.work'), [], 'fits');
  assertEq(checkWork(w, { people, groups: [], time: TIME, places }, 'w.work'), ['w.work: by "drax-mill" is neither a person nor a group'], 'unknown by');
  assertEq(checkWork(w, { people, groups, time: parseTimeFile('', 'k.time'), places }, 'w.work'), ['w.work: when "advent" is not in the .time'], 'unknown when');
  assertEq(checkWork(w, { time: null }, 'w.work'), ['w.work: when "advent" is not in the .time (the brand has no .time)'], 'no .time');
  assertEq(checkWork(w, { places: [] }, 'w.work'), ['w.work: place "weserstrasse" does not exist'], 'unknown place');
  assertEq(checkWork(w, {}, 'w.work'), [], 'not checked');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
