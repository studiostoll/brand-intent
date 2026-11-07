/**
 * Tests for .time files: founded, seasons, windows, weeklies, dates, daily moments, and in-season lookups.
 *
 * Run: npm test
 */

import { parseTimeFile, timeEntry, timeEntryNames, seasonForDate, isInSeason, yearsSince } from '../parser/timeParser';

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

const parse = (body: string) => parseTimeFile(body, 'krume.time');

const KRUME = `# krume.time
# The brand's time.

founded: 2019-05-04

season spring
  label: Spring
  from:  03-01

season summer
  label: Summer
  from:  06-01

season autumn
  label: Autumn
  from:  09-01

season winter
  label: Winter
  from:  12-01

windows
  rhubarb: 04-15..06-24   # the first stalks
  advent:  11-27..12-24

daily
  oven:     04:00  Oven on
  shelf:    06:00  Everything on the shelf
  gone:     12:00
`;

console.log('\ntime:');

test('parses the whole file', () => {
  const t = parse(KRUME);
  assertEq(t.description, "krume.time The brand's time.", 'description');
  assertEq(t.founded, '2019-05-04', 'founded');
  assertEq(t.seasons, [
    { name: 'spring', label: 'Spring', from: '03-01' },
    { name: 'summer', label: 'Summer', from: '06-01' },
    { name: 'autumn', label: 'Autumn', from: '09-01' },
    { name: 'winter', label: 'Winter', from: '12-01' },
  ], 'seasons');
  assertEq(t.windows, { rhubarb: [{ from: '04-15', to: '06-24' }], advent: [{ from: '11-27', to: '12-24' }] }, 'windows');
  assertEq(t.daily, [
    { name: 'oven', time: '04:00', label: 'Oven on' },
    { name: 'shelf', time: '06:00', label: 'Everything on the shelf' },
    { name: 'gone', time: '12:00' },
  ], 'daily');
});

test('an empty file is a brand without seasons, windows or daily moments', () => {
  assertEq(parse(''), { description: '', seasons: [], windows: {}, daily: [] }, 'empty');
  assertEq(parse('founded: 2019\n').founded, '2019', 'bare year');
});

test('founded must be a date or a year', () => {
  assertThrows(() => parse('founded: May 2019\n'), 'founded must be a date YYYY-MM-DD or a year YYYY');
  assertThrows(() => parse('founded: 2019-02-30\n'), 'founded must be a date');
  assertThrows(() => parse('founded: 2019\nfounded: 2020\n'), 'duplicate "founded"');
});

test('seasons need label and from, at least two, unique starts', () => {
  assertThrows(() => parse('season spring\n  from: 03-01\n'), 'season "spring" needs label:');
  assertThrows(() => parse('season spring\n  label: Spring\n'), 'season "spring" needs from:');
  assertThrows(() => parse('season spring\n  label: Spring\n  from: 03-01\n'), 'one season is no season');
  assertThrows(() => parse('season spring\n  label: Spring\n  from: 02-30\nseason x\n  label: X\n  from: 06-01\n'), 'from must be "MM-DD"');
  assertThrows(() => parse('season a\n  label: A\n  from: 03-01\nseason b\n  label: B\n  from: 03-01\n'), 'seasons "a" and "b" both start on 03-01');
  assertThrows(() => parse('season a\n  label: A\n  from: 03-01\n  colour: red\n'), 'unknown key "colour" in season "a"');
});

test('names are kebab-case and unique across the file', () => {
  assertThrows(() => parse('season Spring\n  label: Spring\n  from: 03-01\n'), 'season name must be lowercase kebab-case');
  assertThrows(() => parse('windows\n  advent: 11-27..12-24\nseason advent\n  label: Advent\n  from: 11-27\n'), '"advent" is already declared on line 2');
  assertThrows(() => parse('daily\n  oven: 04:00\nseason oven\n  label: Oven\n  from: 05-02\n'), '"oven" is already declared');
});

test('windows take ranges, wrapping over the year end', () => {
  assertEq(parse('windows\n  christmas: 11-27..01-06\n').windows, { christmas: [{ from: '11-27', to: '01-06' }] }, 'wrap');
  assertThrows(() => parse('windows\n  berries: 05-01-05-31\n'), 'window "berries": expected "MM-DD..MM-DD"');
  assertThrows(() => parse('windows\n  berries: 05-01..05-31\nwindows\n  x: 05-01..05-31\n'), 'duplicate windows block');
});

test('weekly and date blocks are works since v0.44', () => {
  assertThrows(() => parse('weekly tasting\n  label: Tasting\n  days: thu\n'), 'weekly "tasting" is not part of the .time: an event is a work. Write works/tasting.work with days:');
  assertThrows(() => parse('date mill-day\n  label: Mill day\n  on: 05-02\n'), 'date "mill-day" is not part of the .time: an event is a work. Write works/mill-day.work with on:');
});

test('daily moments are HH:MM with an optional label, in order', () => {
  assertThrows(() => parse('daily\n  oven: four\n'), 'daily "oven" must be "HH:MM"');
  assertThrows(() => parse('daily\n  oven: 24:00\n'), 'daily "oven" must be "HH:MM"');
  assertThrows(() => parse('daily\n  shelf: 06:00\n  oven: 04:00\n'), 'daily "oven" at 04:00 comes before "shelf" at 06:00');
});

test('structure errors', () => {
  assertThrows(() => parse('  label: x\n'), 'unexpected indent');
  assertThrows(() => parse('seasons\n'), 'expected "founded: DATE"');
  assertThrows(() => parse('colour: red\n'), 'unknown key "colour"');
  assertThrows(() => parse('season a\n  label: A\n  from: 03-01\n  from: 04-01\n'), 'duplicate "from" in season "a"');
});

console.log('\nin season:');

const T = parse(KRUME);
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

test('timeEntry and timeEntryNames', () => {
  assertEq(timeEntry(T, 'advent')?.kind, 'window', 'window');
  assertEq(timeEntry(T, 'winter')?.kind, 'season', 'season');
  assertEq(timeEntry(T, 'oven'), undefined, 'a daily moment is not a when: target');
  assertEq(timeEntry(T, 'wheat-blend'), undefined, 'a work is not a when: target');
  assertEq(timeEntryNames(T), ['rhubarb', 'advent', 'spring', 'summer', 'autumn', 'winter'], 'names');
});

test('seasonForDate wraps over the year end', () => {
  assertEq(seasonForDate(T, day(2026, 1, 15))?.name, 'winter', 'January');
  assertEq(seasonForDate(T, day(2026, 3, 1))?.name, 'spring', 'first day');
  assertEq(seasonForDate(T, day(2026, 11, 30))?.name, 'autumn', 'last day');
  assertEq(seasonForDate({ seasons: [] }, day(2026, 1, 1)), undefined, 'no seasons');
});

test('isInSeason per kind', () => {
  assertEq(isInSeason(T, 'advent', day(2026, 12, 1)), true, 'window in');
  assertEq(isInSeason(T, 'advent', day(2026, 12, 25)), false, 'window out');
  assertEq(isInSeason(T, 'summer', day(2026, 7, 1)), true, 'season in');
  assertEq(isInSeason(T, 'summer', day(2026, 9, 1)), false, 'season out');
  assertEq(isInSeason(T, 'nothing', day(2026, 1, 1)), false, 'unknown');
});

test('yearsSince counts whole years, a bare year from January 1', () => {
  assertEq(yearsSince('2019-05-04', day(2026, 5, 3)), 6, 'day before');
  assertEq(yearsSince('2019-05-04', day(2026, 5, 4)), 7, 'the day');
  assertEq(yearsSince('2019', day(2026, 1, 1)), 7, 'bare year');
  assertEq(yearsSince('2019', day(2025, 12, 31)), 6, 'bare year, eve');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
