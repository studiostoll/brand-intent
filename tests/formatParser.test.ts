/**
 * Tests for .format files: categories.
 *
 * Run: npm test
 */

import { parseFormatFile } from '../parser/formatParser';

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

const format = (category: string) =>
  `id: 1.91:1\nlabel: 1.91:1\nsublabel: Feed Landscape\ncategory: ${category}\n\nsize: 1200 630\ngrid: 3 6\n`;

test('facebook is a category with px dimensions', () => {
  const f = parseFormatFile(format('facebook'), 'f.format');
  assertEq(f.category, 'facebook', 'category');
  assertEq([f.widthPx, f.heightPx], [1200, 630], 'size');
});

test('an unknown category is refused', () => {
  assertThrows(() => parseFormatFile(format('tiktok'), 'f.format'), 'category must be');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
