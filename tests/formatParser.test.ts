/**
 * Tests for .format files: categories and post.
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

test('post is feed or story, absent when not set', () => {
  assertEq(parseFormatFile(format('facebook') + 'post: story\n', 'f.format').post, 'story', 'story');
  assertEq(parseFormatFile(format('instagram') + 'post: feed\n', 'f.format').post, 'feed', 'feed');
  assertEq(parseFormatFile(format('facebook'), 'f.format').post, undefined, 'absent');
});

test('an unknown post value is refused', () => {
  assertThrows(() => parseFormatFile(format('instagram') + 'post: reel\n', 'f.format'), 'post must be');
});

console.log('\ninline comments:');

test('values keep their meaning when a comment follows', () => {
  const f = parseFormatFile('id: 4:5   # the feed portrait\nlabel: 4:5\nsublabel: Feed Portrait\ncategory: instagram # platform\npost: feed\nsize: 1080 1350  # px\ngrid: 5 4           # 5 rows × 4 columns\ncrop: 0 34 0 34     # profile grid\ncomfort: 40 # margin\npurposes: daily-bread, seasonal-special   # editorially valid here\n', 'x.format');
  assertEq(f.id, '4:5', 'id');
  assertEq(f.category, 'instagram', 'category');
  assertEq(f.grid, { rows: 5, cols: 4 }, 'grid');
  assertEq(f.purposes, ['daily-bread', 'seasonal-special'], 'purposes');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
