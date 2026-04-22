/**
 * Parser tests for .identity — currently focused on the v0.9.0 purpose field.
 *
 * Run: npm test
 */

import { parseIdentityFile } from '../parser/identityParser';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    fail++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`  ✗ ${name}\n      ${msg}`);
    console.log(`  ✗ ${name}`);
    console.log(`      ${msg}`);
  }
}

function assertEq<T>(actual: T, expected: T, label = 'value') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}

// Minimal identity file stub — everything the parser marks as required.
const BASE = `essence: Test essence.
promise: Test promise.
voice
  register: informal, du
  persona: Test persona
  always:
    - one
  never:
    - nothing
pillars
  primary: one, two
  avoid: bad stuff
audience a
  label: A
  motivation: test
  language: test
`;

console.log('\nIdentity: purpose field (v0.9.0):');

test('omitted purpose is undefined', () => {
  const out = parseIdentityFile(BASE, 'test.identity');
  assertEq(out.purpose, undefined, 'purpose');
});

test('single-line purpose parses', () => {
  const src = `purpose: Why the brand exists in one line.\n${BASE}`;
  const out = parseIdentityFile(src, 'test.identity');
  assertEq(out.purpose, 'Why the brand exists in one line.', 'purpose');
});

test('multi-line purpose joins with spaces', () => {
  const src = `purpose: Line one,\n         line two,\n         line three.\n${BASE}`;
  const out = parseIdentityFile(src, 'test.identity');
  assertEq(out.purpose, 'Line one, line two, line three.', 'purpose continuation');
});

test('purpose does not swallow promise', () => {
  // Ensure the top-level key break correctly reassigns continuationKey.
  const src = `purpose: The purpose.\npromise: The promise.\n${BASE.replace('promise: Test promise.\n', '')}`;
  const out = parseIdentityFile(src, 'test.identity');
  assertEq(out.purpose, 'The purpose.', 'purpose');
  assertEq(out.promise, 'The promise.', 'promise');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(f);
  process.exit(1);
}
