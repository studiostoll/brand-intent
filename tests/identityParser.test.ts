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

console.log('\nIdentity: voice instead, value examples:');

test('voice.instead parses phrase -> replacement and strips quotes', () => {
  const src = BASE.replace('  never:\n    - nothing\n', '  never:\n    - nothing\n  instead:\n    - "beste Zutaten" -> Tipo 1 aus der Mühle\n    - frisch -> seit 4 Uhr im Ofen\n');
  const out = parseIdentityFile(src, 'test.identity');
  assertEq(out.voice.instead, [
    { avoid: 'beste Zutaten', use: 'Tipo 1 aus der Mühle' },
    { avoid: 'frisch', use: 'seit 4 Uhr im Ofen' },
  ], 'instead');
});

test('voice.instead without arrow throws', () => {
  const src = BASE.replace('  never:\n    - nothing\n', '  never:\n    - nothing\n  instead:\n    - just a phrase\n');
  let threw = false;
  try { parseIdentityFile(src, 'test.identity'); } catch { threw = true; }
  assertEq(threw, true, 'threw');
});

test('values carry say: and not: examples', () => {
  const src = `${BASE}values
  Handwerk
    Wir benennen den Prozess.
    say: Der Roggen steht seit gestern Abend.
    say: Achtzehn Stunden Teigruhe.
    not: Mit Liebe gemacht.

  Ehrlichkeit
    Keine Versprechen.
`;
  const out = parseIdentityFile(src, 'test.identity');
  assertEq(out.values, [
    { name: 'Handwerk', behavior: 'Wir benennen den Prozess.', say: ['Der Roggen steht seit gestern Abend.', 'Achtzehn Stunden Teigruhe.'], not: ['Mit Liebe gemacht.'] },
    { name: 'Ehrlichkeit', behavior: 'Keine Versprechen.' },
  ], 'values');
});

console.log('\nIdentity: imagery, image themes, goals, review:');

const NARRATIVES = `narrative Achtzehn Stunden
  primary
  Das Brot entsteht in achtzehn Stunden.

narrative Nachbarschaft
  Die Bäckerei gehört zum Viertel.
`;

test('imagery always/never lists', () => {
  const src = `${BASE}imagery
  always:
    - Hände im Teig
  never:
    - gestellte Lächeln
    - KI-generierte Bilder
`;
  const out = parseIdentityFile(src, 'test.identity');
  assertEq(out.imagery, { always: ['Hände im Teig'], never: ['gestellte Lächeln', 'KI-generierte Bilder'] }, 'imagery');
});

test('image-theme with narrative reference and multi-line text', () => {
  const src = `${BASE}${NARRATIVES}
image-theme Teig am Morgen
  narrative: Achtzehn Stunden
  Hände im Teig, Mehl auf dem Tisch,
  Licht durch das Backstubenfenster.

image-theme Ladentür
  Die Tür zur Straße, Menschen mit Brot unterm Arm.
`;
  const out = parseIdentityFile(src, 'test.identity');
  assertEq(out.imageThemes, [
    { name: 'Teig am Morgen', text: 'Hände im Teig, Mehl auf dem Tisch,\nLicht durch das Backstubenfenster.', narrative: 'Achtzehn Stunden' },
    { name: 'Ladentür', text: 'Die Tür zur Straße, Menschen mit Brot unterm Arm.' },
  ], 'imageThemes');
});

test('image-theme with unknown narrative throws', () => {
  const src = `${BASE}${NARRATIVES}
image-theme Teig
  narrative: Gibt es nicht
  Text.
`;
  let threw = false;
  try { parseIdentityFile(src, 'test.identity'); } catch { threw = true; }
  assertEq(threw, true, 'threw');
});

test('goals parse label, share, question, narratives and rules', () => {
  const src = `${BASE}${NARRATIVES}
goal craft
  label:      Handwerk zeigen
  share:      60%
  question:   Wie entsteht das Brot?
  narratives: Achtzehn Stunden
  always:
    - einen konkreten Arbeitsschritt zeigen

goal neighbours
  label: Nachbarschaft
  share: 40%
  narratives: Nachbarschaft, Achtzehn Stunden
  never:
    - Stammgäste ohne Einverständnis zeigen
`;
  const out = parseIdentityFile(src, 'test.identity');
  assertEq(out.goals, {
    craft: { label: 'Handwerk zeigen', share: 60, question: 'Wie entsteht das Brot?', narratives: ['Achtzehn Stunden'], always: ['einen konkreten Arbeitsschritt zeigen'] },
    neighbours: { label: 'Nachbarschaft', share: 40, narratives: ['Nachbarschaft', 'Achtzehn Stunden'], never: ['Stammgäste ohne Einverständnis zeigen'] },
  }, 'goals');
});

test('goal shares over 100% throw', () => {
  const src = `${BASE}goal a\n  label: A\n  share: 70%\n\ngoal b\n  label: B\n  share: 40%\n`;
  let threw = false;
  try { parseIdentityFile(src, 'test.identity'); } catch { threw = true; }
  assertEq(threw, true, 'threw');
});

test('goal without label throws', () => {
  let threw = false;
  try { parseIdentityFile(`${BASE}goal a\n  share: 10%\n`, 'test.identity'); } catch { threw = true; }
  assertEq(threw, true, 'threw');
});

test('review copy/image lists', () => {
  const src = `${BASE}review
  copy:
    - Ist der Anlass klar?
  image:
    - Ist das Brot echt?
    - Ist der Ort erkennbar?
`;
  const out = parseIdentityFile(src, 'test.identity');
  assertEq(out.review, { copy: ['Ist der Anlass klar?'], image: ['Ist das Brot echt?', 'Ist der Ort erkennbar?'] }, 'review');
});

test('new blocks are absent when not declared', () => {
  const out = parseIdentityFile(BASE, 'test.identity');
  assertEq([out.imagery, out.imageThemes, out.goals, out.review, out.voice.instead], [undefined, undefined, undefined, undefined, undefined], 'absent');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(f);
  process.exit(1);
}
