/**
 * Tests for .place files: keys, coordinates, opening hours.
 *
 * Run: npm test
 */

import { parsePlaceFile, weekdayOf } from '../parser/placeParser';

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

test('weekdayOf', () => {
  assertEq(weekdayOf('2026-11-04'), 'wed', 'Wednesday');
  assertEq(weekdayOf('2026-11-08'), 'sun', 'Sunday');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
