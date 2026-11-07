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

weekly wheat-blend
  label:   Wheat blend
  days:    sat
  context: 500 g, only on Saturdays, sold out by ten.

weekly baking-class
  label:   Baking class
  days:    thu-fri, sun
  time:    14:00-18:00
  place:   weserstrasse

date anniversary
  label:   Five years of Krume
  on:      2024-05-04

date mill-day
  label:   Mill day
  on:      05-02
  time:    10:00-16:00
  lead:    21
  context: The mill from Dachau sets up its stones in the yard.

date fair
  label:   Bread fair
  on:      12-27..01-02

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
  assertEq(t.weekly, [
    { name: 'wheat-blend', label: 'Wheat blend', days: ['sat'], context: '500 g, only on Saturdays, sold out by ten.' },
    { name: 'baking-class', label: 'Baking class', days: ['thu', 'fri', 'sun'], time: { from: '14:00', to: '18:00' }, place: 'weserstrasse' },
  ], 'weekly');
  assertEq(t.dates, [
    { name: 'anniversary', label: 'Five years of Krume', on: { from: '2024-05-04', to: '2024-05-04', yearly: false }, lead: 14 },
    { name: 'mill-day', label: 'Mill day', on: { from: '05-02', to: '05-02', yearly: true }, time: { from: '10:00', to: '16:00' }, lead: 21, context: 'The mill from Dachau sets up its stones in the yard.' },
    { name: 'fair', label: 'Bread fair', on: { from: '12-27', to: '01-02', yearly: true }, lead: 14 },
  ], 'dates');
  assertEq(t.daily, [
    { name: 'oven', time: '04:00', label: 'Oven on' },
    { name: 'shelf', time: '06:00', label: 'Everything on the shelf' },
    { name: 'gone', time: '12:00' },
  ], 'daily');
});

test('an empty file is a brand without seasons, windows or occasions', () => {
  assertEq(parse(''), { description: '', seasons: [], windows: {}, weekly: [], dates: [], daily: [] }, 'empty');
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
  assertThrows(() => parse('windows\n  advent: 11-27..12-24\nweekly advent\n  label: Advent\n  days: sat\n'), '"advent" is already declared on line 2');
  assertThrows(() => parse('daily\n  oven: 04:00\ndate oven\n  label: Oven\n  on: 05-02\n'), '"oven" is already declared');
});

test('windows take ranges, wrapping over the year end', () => {
  assertEq(parse('windows\n  christmas: 11-27..01-06\n').windows, { christmas: [{ from: '11-27', to: '01-06' }] }, 'wrap');
  assertThrows(() => parse('windows\n  berries: 05-01-05-31\n'), 'window "berries": expected "MM-DD..MM-DD"');
  assertThrows(() => parse('windows\n  berries: 05-01..05-31\nwindows\n  x: 05-01..05-31\n'), 'duplicate windows block');
});

test('weekly needs label and days; days as in hours', () => {
  assertThrows(() => parse('weekly tasting\n  days: thu\n'), 'weekly "tasting" needs label:');
  assertThrows(() => parse('weekly tasting\n  label: Tasting\n'), 'weekly "tasting" needs days:');
  assertThrows(() => parse('weekly tasting\n  label: Tasting\n  days: thursday\n'), 'days must be weekdays like sat, thu-fri or mon, wed');
  assertEq(parse('weekly t\n  label: T\n  days: fri-mon\n').weekly[0].days, ['mon', 'fri', 'sat', 'sun'], 'wraps, Monday first');
  assertThrows(() => parse('weekly t\n  label: T\n  days: sat\n  time: 7pm\n'), 'time must be "HH:MM-HH:MM" or "HH:MM"');
  assertEq(parse('weekly t\n  label: T\n  days: sat\n  time: 19:00\n').weekly[0].time, { from: '19:00' }, 'single time');
  assertThrows(() => parse('weekly t\n  label: T\n  days: sat\n  place: The Quay\n'), 'place must be a place id');
});

test('date takes yearly and one-off forms', () => {
  const on = (v: string) => parse(`date d\n  label: D\n  on: ${v}\n`).dates[0].on;
  assertEq(on('05-02'), { from: '05-02', to: '05-02', yearly: true }, 'yearly day');
  assertEq(on('12-27..01-02'), { from: '12-27', to: '01-02', yearly: true }, 'yearly run');
  assertEq(on('2026-05-02..2026-05-03'), { from: '2026-05-02', to: '2026-05-03', yearly: false }, 'one-off run');
  assertThrows(() => on('2. Mai'), 'on must be "MM-DD"');
  assertThrows(() => on('05-02..2026-05-03'), 'on must be "MM-DD"');
  assertThrows(() => on('2026-05-03..2026-05-02'), 'ends before it starts');
  assertThrows(() => parse('date d\n  label: D\n  on: 05-02\n  lead: two weeks\n'), 'lead must be a whole number of days');
  assertThrows(() => parse('date d\n  on: 05-02\n'), 'date "d" needs label:');
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
  assertEq(timeEntry(T, 'wheat-blend')?.kind, 'weekly', 'weekly');
  assertEq(timeEntry(T, 'mill-day')?.kind, 'date', 'date');
  assertEq(timeEntry(T, 'oven'), undefined, 'a daily moment is not a when: target');
  assertEq(timeEntryNames(T), ['rhubarb', 'advent', 'spring', 'summer', 'autumn', 'winter', 'wheat-blend', 'baking-class', 'anniversary', 'mill-day', 'fair'], 'names');
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
  assertEq(isInSeason(T, 'wheat-blend', day(2026, 11, 7)), true, 'Saturday');
  assertEq(isInSeason(T, 'wheat-blend', day(2026, 11, 8)), false, 'Sunday');
  assertEq(isInSeason(T, 'mill-day', day(2026, 4, 11)), true, 'lead 21: three weeks before');
  assertEq(isInSeason(T, 'mill-day', day(2026, 4, 10)), false, 'a day earlier');
  assertEq(isInSeason(T, 'mill-day', day(2026, 5, 2)), true, 'the day');
  assertEq(isInSeason(T, 'mill-day', day(2026, 5, 3)), false, 'the day after');
  assertEq(isInSeason(T, 'fair', day(2026, 12, 20)), true, 'yearly run, lead over the year end');
  assertEq(isInSeason(T, 'fair', day(2027, 1, 2)), true, 'last day of the run in the new year');
  assertEq(isInSeason(T, 'fair', day(2027, 1, 3)), false, 'after the run');
  assertEq(isInSeason(T, 'anniversary', day(2024, 4, 25)), true, 'one-off, in its lead');
  assertEq(isInSeason(T, 'anniversary', day(2025, 4, 25)), false, 'one-off, never again');
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
