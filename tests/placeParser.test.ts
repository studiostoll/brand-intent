/**
 * Tests for .place files: keys, coordinates, opening hours.
 *
 * Run: npm test
 */

import { parsePlaceFile, isOpenYet, weekdayOf, weekOpeningDays, weekHoursOn, upcomingHours, specialHoursOn, hoursOn } from '../parser/placeParser';

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

const HEAD = 'id: harbour\nname: Harbour Café\n';
const parse = (body: string) => parsePlaceFile(HEAD + body, 'harbour.place');

console.log('\nplace:');

test('parses keys and hours', () => {
  const p = parsePlaceFile(`# The café on the quay
id: harbour
name: Harbour Café
address: Quay 3, Harbour Town   # as on the sign
latitude: 54.32
longitude: -10.14
maps: https://maps.example.com/?q=harbour#pin
context: Ferry crowd in the morning, locals in the afternoon.

hours
  mon-wed: 08:00-18:00
  thu-fri: Lunch 12:00-14:00, Evening 17:00-02:00
  sat: closed
`, 'harbour.place');
  assertEq(p, {
    id: 'harbour', name: 'Harbour Café', description: 'The café on the quay',
    address: 'Quay 3, Harbour Town', latitude: 54.32, longitude: -10.14, maps: 'https://maps.example.com/?q=harbour#pin',
    context: 'Ferry crowd in the morning, locals in the afternoon.',
    hours: {
      mon: [{ from: '08:00', to: '18:00' }], tue: [{ from: '08:00', to: '18:00' }], wed: [{ from: '08:00', to: '18:00' }],
      thu: [{ label: 'Lunch', from: '12:00', to: '14:00' }, { label: 'Evening', from: '17:00', to: '02:00' }],
      fri: [{ label: 'Lunch', from: '12:00', to: '14:00' }, { label: 'Evening', from: '17:00', to: '02:00' }],
    },
  }, 'place');
});

test('only id and name are required', () => {
  assertEq(parse(''), { id: 'harbour', name: 'Harbour Café', description: '' }, 'minimal');
  assertThrows(() => parsePlaceFile('name: X\n', 'x.place'), 'missing place id');
  assertThrows(() => parsePlaceFile('id: x\n', 'x.place'), 'place needs name:');
  assertThrows(() => parse('latitude: 54\n'), 'both latitude: and longitude:, or neither');
  assertThrows(() => parse('latitude: 54°N\nlongitude: 1\n'), 'decimal degrees');
});

test('day ranges wrap over the week end; a day once', () => {
  assertEq(Object.keys(parse('hours\n  fri-mon: 10:00-12:00\n').hours!), ['mon', 'fri', 'sat', 'sun'], 'wraps');
  assertThrows(() => parse('hours\n  mon-fri: 10:00-12:00\n  fri: 13:00-14:00\n'), 'fri already has hours');
  assertThrows(() => parse('hours\n  monday: 10:00-12:00\n'), 'invalid days "monday"');
});

test('bad values', () => {
  assertThrows(() => parse('hours\n  mon: 10-12\n'), 'invalid opening range "10-12"');
  assertThrows(() => parse('hours\n  mon: 10:00-25:00\n'), 'invalid opening range');
  assertThrows(() => parse('hours\n  mon: 10:00-10:00\n'), 'starts and ends at the same time');
  assertThrows(() => parse('zip: 1\n'), 'unknown key "zip"');
  assertThrows(() => parse('maps: maps.example.com\n'), 'maps must be an https link');
  assertThrows(() => parse('hours\n  mon: 10:00-12:00\nhours\n'), 'duplicate hours block');
  assertThrows(() => parse('  mon: 10:00-12:00\n'), 'unexpected indent');
});

test('opening', () => {
  const p = parse('opening: 2026-11-28\n');
  assertEq(p.opening, '2026-11-28', 'parsed');
  assertEq(isOpenYet(p, '2026-11-27'), false, 'day before');
  assertEq(isOpenYet(p, '2026-11-28'), true, 'the day');
  assertEq(isOpenYet(parse(''), '2020-01-01'), true, 'no opening: always');
  assertThrows(() => parse('opening: 28.11.2026\n'), 'opening must be a date YYYY-MM-DD');
  assertThrows(() => parse('opening: 2026-02-30\n'), 'opening must be a date');
});

test('capacity', () => {
  assertEq(parse('capacity\n  indoor:  25\n  outdoor: 8\n').capacity, { indoor: 25, outdoor: 8 }, 'both sides');
  assertEq(parse('capacity\n  indoor: 60\n').capacity, { indoor: 60 }, 'one side');
  assertThrows(() => parse('capacity\n'), 'empty capacity block');
  assertThrows(() => parse('capacity\n  inside: 25\n'), 'capacity entry must be');
  assertThrows(() => parse('capacity\n  indoor: about 25\n'), 'whole number of people');
  assertThrows(() => parse('capacity\n  indoor: 25\n  indoor: 30\n'), 'duplicate capacity "indoor"');
});

test('weekOpeningDays: consecutive days with the same times share a line', () => {
  const p = parse('hours\n  wed: Evening 17:00-22:00\n  thu-fri: Lunch 12:00-14:00, Evening 17:00-22:00\n  sat: 17:00-22:00\n  mon: 17:00-22:00\n');
  assertEq(weekOpeningDays(p.hours!).map(l => [l.days, l.ranges.length]), [[['mon'], 1], [['wed'], 1], [['thu', 'fri'], 2], [['sat'], 1]], 'closed tue splits, labels don\'t count');
  assertEq(weekOpeningDays(parse('hours\n  wed-fri: 14:00-22:00\n  sat: 14:00-22:00\n').hours!).map(l => l.days), [['wed', 'thu', 'fri', 'sat']], 'same times merge');
});

test('hours from: a new regular week from a day on', () => {
  const p = parse('hours\n  wed-fri: 14:00-22:00\n\nhours from 2027-03-02   # also Tuesdays\n  tue-fri: 14:00-22:00\n  sun: closed\n');
  assertEq(p.hoursFrom, [{ from: '2027-03-02', hours: { tue: [{ from: '14:00', to: '22:00' }], wed: [{ from: '14:00', to: '22:00' }], thu: [{ from: '14:00', to: '22:00' }], fri: [{ from: '14:00', to: '22:00' }] } }], 'parsed, closed days left out');
  assertEq(Object.keys(weekHoursOn(p, '2027-03-01')!), ['wed', 'thu', 'fri'], 'the day before: the old week');
  assertEq(Object.keys(weekHoursOn(p, '2027-03-02')!), ['tue', 'wed', 'thu', 'fri'], 'the day: the new week');
  assertEq(hoursOn(p, '2027-02-23'), [], 'a Tuesday before: closed');
  assertEq(hoursOn(p, '2027-03-02'), [{ from: '14:00', to: '22:00' }], 'the first new Tuesday');
  assertEq(upcomingHours(p, '2027-03-01')?.from, '2027-03-02', 'still to come');
  assertEq(upcomingHours(p, '2027-03-02'), undefined, 'started: nothing to announce');
  const two = parse('hours\n  mon: 10:00-12:00\nhours from 2027-06-01\n  tue: 10:00-12:00\nhours from 2027-03-01\n  wed: 10:00-12:00\n');
  assertEq(two.hoursFrom!.map(h => h.from), ['2027-03-01', '2027-06-01'], 'in date order');
  assertEq(Object.keys(weekHoursOn(two, '2027-04-01')!), ['wed'], 'the latest that has started');
  assertEq(upcomingHours(two, '2027-01-01')?.from, '2027-03-01', 'the next one');
  assertThrows(() => parse('hours from 2027-03-02\n  tue: 10:00-12:00\n'), 'needs the regular hours block it replaces');
  assertThrows(() => parse('hours\n  mon: 10:00-12:00\nhours from 03-02\n'), '"hours from" needs a date YYYY-MM-DD');
  assertThrows(() => parse('hours\n  mon: 10:00-12:00\nhours from 2027-03-02\n  mon: 10:00-12:00\nhours from 2027-03-02\n'), 'duplicate "hours from 2027-03-02"');
  assertThrows(() => parse('hours\n  mon: 10:00-12:00\nhours from\n'), 'expected "hours", "hours from YYYY-MM-DD" or "hours NAME"');
});

test('hours NAME: a set of special days', () => {
  const p = parse('hours\n  mon-sat: 08:00-18:00\n\nhours christmas\n  2026-12-31: 08:00-14:00\n  2026-12-24: Morning 08:00-12:00\n  2026-12-25..2026-12-26: closed\n');
  assertEq(p.specialHours, [{ name: 'christmas', days: [
    { from: '2026-12-24', to: '2026-12-24', ranges: [{ label: 'Morning', from: '08:00', to: '12:00' }] },
    { from: '2026-12-25', to: '2026-12-26', ranges: [] },
    { from: '2026-12-31', to: '2026-12-31', ranges: [{ from: '08:00', to: '14:00' }] },
  ] }], 'parsed, in date order');
  assertEq(hoursOn(p, '2026-12-24'), [{ label: 'Morning', from: '08:00', to: '12:00' }], 'a special day');
  assertEq(hoursOn(p, '2026-12-26'), [], 'a Saturday, closed in the set');
  assertEq(hoursOn(p, '2026-12-28'), [{ from: '08:00', to: '18:00' }], 'a day the set does not list keeps the regular hours');
  assertEq(hoursOn({ ...p, opening: '2027-01-01' }, '2026-12-24'), [], 'before opening: closed');
  assertEq(specialHoursOn(p, 'christmas', '2026-11-24')?.name, 'christmas', 'a month ahead');
  assertEq(specialHoursOn(p, 'christmas', '2026-12-31')?.name, 'christmas', 'on its last day');
  assertEq(specialHoursOn(p, 'christmas', '2027-01-01'), undefined, 'over');
  assertEq(specialHoursOn(p, 'easter', '2026-11-24'), undefined, 'no such set');
  assertEq(parse('hours easter\n  2027-03-28: 10:00-12:00\n').specialHours!.length, 1, 'without regular hours');
  assertThrows(() => parse('hours christmas\n'), 'empty "hours christmas" block');
  assertThrows(() => parse('hours Christmas\n'), 'expected "hours", "hours from YYYY-MM-DD" or "hours NAME"');
  assertThrows(() => parse('hours christmas\n  12-24: closed\n'), 'lists dates YYYY-MM-DD, got "12-24"');
  assertThrows(() => parse('hours christmas\n  mon: closed\n'), 'lists dates YYYY-MM-DD, got "mon"');
  assertThrows(() => parse('hours christmas\n  2026-12-26..2026-12-24: closed\n'), 'ends before it starts');
  assertThrows(() => parse('hours christmas\n  2026-12-24..2026-12-26: closed\n  2026-12-25: 10:00-12:00\n'), '2026-12-25 already has hours');
  assertThrows(() => parse('hours christmas\n  2026-12-24: closed\nhours winter\n  2026-12-20..2026-12-27: closed\n'), '2026-12-24 already has hours in "hours christmas"');
  assertThrows(() => parse('hours christmas\n  2026-12-24: closed\nhours christmas\n'), 'duplicate "hours christmas"');
  assertThrows(() => parse('hours christmas\n  2026-12-24: 10-12\n'), 'invalid opening range "10-12"');
});

test('weekdayOf', () => {
  assertEq(weekdayOf('2026-11-04'), 'wed', 'Wednesday');
  assertEq(weekdayOf('2026-11-08'), 'sun', 'Sunday');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
