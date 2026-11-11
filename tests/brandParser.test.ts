/**
 * Parser tests for brand-colors grouped syntax, references, state-colors,
 * color-bounds, and color-mode minimum-structure validation (v0.8.0+).
 *
 * Run: npm test
 * (uses tsx — no build step, imports the parser directly)
 */

import { isInDateWindow } from '../parser/dateWindows';
import { parseBrandFile, photoLibrary, videoLibrary, checkBrand } from '../parser/brandParser';
import { parseTimeFile } from '../parser/timeParser';
import { parsePersonFile } from '../parser/personParser';
import { parseGroupFile } from '../parser/groupParser';
import { parseWorkFile } from '../parser/workParser';

// ── Tiny test harness (no dep) ────────────────────────────────────────────────

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
function assertThrows(fn: () => unknown, matcher: RegExp, label: string) {
  try {
    fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!matcher.test(msg)) {
      throw new Error(`${label}: expected error matching ${matcher}, got "${msg}"`);
    }
    return;
  }
  throw new Error(`${label}: expected to throw, but did not`);
}

const HEADER = `id: test\nname: Test\nlanguage: en\nlocale: en-US\n`;

// ── Flat syntax still works (regression) ─────────────────────────────────────

console.log('\nFlat brand-colors (regression):');

test('parses flat colors', () => {
  const src = `${HEADER}brand-colors\n  primary: #0324B1\n  accent: #E32D39\n`;
  const out = parseBrandFile(src, 'test.brand');
  assertEq(out.brandColors, { primary: '#0324B1', accent: '#E32D39' }, 'brandColors');
  assertEq(out.colorGroups, undefined, 'colorGroups (should be undefined)');
});

test('parses flat colors with print specs', () => {
  const src = `${HEADER}brand-colors\n  primary: #0324B1\n    pantone: 286 C\n    cmyk: 97/80/0/31\n`;
  const out = parseBrandFile(src, 'test.brand');
  assertEq(out.brandColorPrint?.primary, { pantone: '286 C', cmyk: '97/80/0/31' }, 'brandColorPrint.primary');
});

test('rejects alpha in flat brand color (unchanged behavior)', () => {
  const src = `${HEADER}brand-colors\n  primary: #0324B1 75%\n`;
  assertThrows(() => parseBrandFile(src, 'test.brand'), /alpha syntax/, 'alpha reject');
});

// ── Grouped syntax ───────────────────────────────────────────────────────────

console.log('\nGrouped brand-colors:');

const GROUPED_MIN = `${HEADER}brand-colors\n
  primary
    meaning: identity
    distribution: 60%
    #2C1810  Espresso
      meaning: core mark
    #5C3A28  Walnut
      role: warmth

  neutral
    meaning: structure
    #FAF6F0  Flour
      role: light
    #2C1810  Espresso Text
      role: dark
`;

test('parses grouped syntax with 2 groups', () => {
  const out = parseBrandFile(GROUPED_MIN, 'test.brand');
  if (!out.colorGroups) throw new Error('colorGroups missing');
  assertEq(out.colorGroups.length, 2, 'group count');
  assertEq(out.colorGroups[0].key, 'primary', 'first group');
  assertEq(out.colorGroups[0].meaning, 'identity', 'primary meaning');
  assertEq(out.colorGroups[0].distribution, 60, 'primary distribution');
  assertEq(out.colorGroups[0].entries.length, 2, 'primary entries');
  assertEq(out.colorGroups[0].entries[0].hex, '#2C1810', 'first hex');
  assertEq(out.colorGroups[0].entries[0].name, 'Espresso', 'first name');
  assertEq(out.colorGroups[0].entries[0].meaning, 'core mark', 'first meaning');
});

test('first-declared entry becomes default in identity group', () => {
  const out = parseBrandFile(GROUPED_MIN, 'test.brand');
  assertEq(out.colorGroups![0].entries[0].isDefault, true, 'Espresso isDefault');
  assertEq(out.colorGroups![0].entries[1].isDefault, undefined, 'Walnut is not default');
});

test('explicit role: default wins over first-declared', () => {
  const src = `${HEADER}brand-colors\n
  primary
    #2C1810  Espresso
    #5C3A28  Walnut
      role: default
  neutral
    #FAF6F0  Flour
      role: light
    #1C1E26  Slate
      role: dark
`;
  const out = parseBrandFile(src, 'test.brand');
  assertEq(out.colorGroups![0].entries[0].isDefault, undefined, 'Espresso not default');
  assertEq(out.colorGroups![0].entries[1].isDefault, true, 'Walnut default');
});

test('flat projection generated from grouped entries', () => {
  const out = parseBrandFile(GROUPED_MIN, 'test.brand');
  assertEq(out.brandColors?.['espresso'], '#2C1810', 'flat projection espresso');
  assertEq(out.brandColors?.['walnut'], '#5C3A28', 'flat projection walnut');
  assertEq(out.brandColors?.['flour'], '#FAF6F0', 'flat projection flour');
});

test('neutral group rejects distribution', () => {
  const src = `${HEADER}brand-colors\n
  primary
    #2C1810  Espresso
  neutral
    distribution: 20%
    #FAF6F0  Flour
      role: light
    #1C1E26  Slate
      role: dark
`;
  assertThrows(() => parseBrandFile(src, 'test.brand'), /neutral group cannot declare distribution/, 'neutral distribution reject');
});

test('neutral role must be in fixed vocabulary', () => {
  const src = `${HEADER}brand-colors\n
  primary
    #2C1810  Espresso
  neutral
    #FAF6F0  Flour
      role: light
    #1C1E26  Slate
      role: depth
`;
  assertThrows(() => parseBrandFile(src, 'test.brand'), /not in the fixed vocabulary/, 'bad neutral role');
});

// ── Layer 2 references ──────────────────────────────────────────────────────

console.log('\nLayer 2 references:');

test('$primary.default resolves to first-declared primary', () => {
  const src = `${HEADER}brand-colors\n
  primary
    #2C1810  Espresso
    #5C3A28  Walnut

  neutral
    #FAF6F0  Flour
      role: light
    $primary.default
      role: dark
      meaning: text and structural weight
`;
  const out = parseBrandFile(src, 'test.brand');
  const neutral = out.colorGroups!.find(g => g.key === 'neutral')!;
  assertEq(neutral.entries[1].hex, '#2C1810', 'ref hex');
  assertEq(neutral.entries[1].name, 'Espresso', 'ref name (inherited)');
  assertEq(neutral.entries[1].role, 'dark', 'ref role (authored locally)');
  assertEq(neutral.entries[1].meaning, 'text and structural weight', 'ref meaning (authored locally)');
  assertEq(neutral.entries[1].referencedFrom, 'primary.default', 'referencedFrom recorded');
});

test('$primary.<role> (non-default) resolves by role match', () => {
  const src = `${HEADER}brand-colors\n
  primary
    #2C1810  Espresso
    #5C3A28  Walnut
      role: warmth

  neutral
    #FAF6F0  Flour
      role: light
    $primary.warmth
      role: dark
`;
  const out = parseBrandFile(src, 'test.brand');
  const neutral = out.colorGroups!.find(g => g.key === 'neutral')!;
  assertEq(neutral.entries[1].hex, '#5C3A28', 'ref hex for $primary.warmth');
  assertEq(neutral.entries[1].name, 'Walnut', 'ref name');
});

test('forward reference is rejected', () => {
  const src = `${HEADER}brand-colors\n
  primary
    $neutral.light
      role: light
  neutral
    #FAF6F0  Flour
      role: light
    #1C1E26  Slate
      role: dark
`;
  assertThrows(() => parseBrandFile(src, 'test.brand'), /declared earlier|unknown group/, 'forward reference reject');
});

// ── Minimum structure for guided ────────────────────────────────────────────

console.log('\ncolor-mode: guided minimum structure:');

test('guided with flat syntax is rejected', () => {
  const src = `${HEADER}color-mode: guided\nbrand-colors\n  primary: #0324B1\n`;
  assertThrows(() => parseBrandFile(src, 'test.brand'), /requires grouped brand-colors/, 'flat+guided reject');
});

test('guided without neutral is rejected', () => {
  const src = `${HEADER}color-mode: guided\nbrand-colors\n
  primary
    #0324B1  Blue
`;
  assertThrows(() => parseBrandFile(src, 'test.brand'), /requires a "neutral" group/, 'missing neutral');
});

test('guided without neutral.light is rejected', () => {
  const src = `${HEADER}color-mode: guided\nbrand-colors\n
  primary
    #0324B1  Blue

  neutral
    #1C1E26  Slate
      role: dark
`;
  assertThrows(() => parseBrandFile(src, 'test.brand'), /role "light"/, 'missing neutral.light');
});

test('guided with minimum structure parses', () => {
  const src = `${HEADER}color-mode: guided\nbrand-colors\n
  primary
    #0324B1  Blue

  neutral
    #FAFAFA  White
      role: light
    #1C1E26  Slate
      role: dark
`;
  const out = parseBrandFile(src, 'test.brand');
  assertEq(out.colorMode, 'guided', 'colorMode');
});

// ── state-colors, color-bounds, adherence ───────────────────────────────────

console.log('\nstate-colors / color-bounds / adherence:');

test('state-colors parses flat hex values', () => {
  const src = `${HEADER}state-colors\n  problem: #C62828\n  success: #2E7D32\n  info: #1565C0\n`;
  const out = parseBrandFile(src, 'test.brand');
  assertEq(out.stateColors, { problem: '#C62828', success: '#2E7D32', info: '#1565C0' }, 'stateColors');
});

test('state-colors rejects non-hex values', () => {
  const src = `${HEADER}state-colors\n  problem: red\n`;
  assertThrows(() => parseBrandFile(src, 'test.brand'), /not a valid hex/, 'bad state hex');
});

test('color-bounds parses numeric values', () => {
  const src = `${HEADER}color-bounds\n  light: 0.95\n  dark: 0.04\n  saturation-floor: 15\n`;
  const out = parseBrandFile(src, 'test.brand');
  assertEq(out.colorBounds, { light: 0.95, dark: 0.04, saturationFloor: 15 }, 'colorBounds');
});

test('color-mode and color-strategy parse', () => {
  const src = `${HEADER}color-mode: dynamic\ncolor-strategy: duotone\n`;
  const out = parseBrandFile(src, 'test.brand');
  assertEq(out.colorMode, 'dynamic', 'colorMode');
  assertEq(out.colorStrategy, 'duotone', 'colorStrategy');
});

test('color-mode: brand without themes is rejected', () => {
  const src = `${HEADER}color-mode: brand\n`;
  assertThrows(() => parseBrandFile(src, 'test.brand'), /color-mode: brand requires at least one theme/, 'brand without themes');
});

test('color-mode: brand with a theme parses', () => {
  const src = `${HEADER}color-mode: brand\ntheme Light\n  background: #FAFAFA\n  text-primary: #1C1E26\n`;
  const out = parseBrandFile(src, 'test.brand');
  assertEq(out.colorMode, 'brand', 'colorMode');
});

test('color-mode rejects unknown value', () => {
  const src = `${HEADER}color-mode: magical\n`;
  assertThrows(() => parseBrandFile(src, 'test.brand'), /color-mode must be/, 'bad color-mode');
});

test('color-adherence with tolerance overrides', () => {
  const src = `${HEADER}color-adherence: on-brand\n  hue-tolerance: 4\n  sat-tolerance: 8\n`;
  const out = parseBrandFile(src, 'test.brand');
  assertEq(out.colorAdherence, 'on-brand', 'colorAdherence');
  assertEq(out.colorAdherenceOverrides, { hueTolerance: 4, satTolerance: 8 }, 'overrides');
});

// ── Logo assets: gltf + generator + generator-params ─────────────────────────

console.log('\nLogo asset fields:');

test('parses logo gltf source', () => {
  const src = `${HEADER}logo mark\n  label: Mark\n  src: logos/mark.svg\n  gltf: logos/mark.glb\n  aspect: 1\n  animated\n`;
  const out = parseBrandFile(src, 'test.brand');
  const logo = out.assets?.logos?.[0];
  assertEq(logo?.gltfSrc, 'logos/mark.glb', 'gltfSrc');
  assertEq(logo?.animated, true, 'animated');
  assertEq(logo?.src, 'logos/mark.svg', 'src (2D fallback kept)');
});

test('parses logo generator id', () => {
  const src = `${HEADER}logo spiral\n  label: Spiral\n  src: logos/spiral.svg\n  generator: spiral\n  aspect: 1\n`;
  const out = parseBrandFile(src, 'test.brand');
  const logo = out.assets?.logos?.[0];
  assertEq(logo?.generator, 'spiral', 'generator');
});

test('parses logo generator-params sub-block', () => {
  const src = `${HEADER}logo spiral\n  label: Spiral\n  src: logos/spiral.svg\n  generator: spiral\n  generator-params\n    turns: 3\n    radius: 0.4\n    thickness: 0.05\n  aspect: 1\n`;
  const out = parseBrandFile(src, 'test.brand');
  const logo = out.assets?.logos?.[0];
  assertEq(logo?.generatorParams, { turns: 3, radius: 0.4, thickness: 0.05 }, 'generatorParams');
});

test('generator-params sub-block closes on next top-level key', () => {
  // label appears AFTER the sub-block to check it does not leak into generatorParams.
  const src = `${HEADER}logo spiral\n  src: logos/spiral.svg\n  generator: spiral\n  generator-params\n    turns: 3\n  label: Spiral\n  aspect: 1\n`;
  const out = parseBrandFile(src, 'test.brand');
  const logo = out.assets?.logos?.[0];
  assertEq(logo?.generatorParams, { turns: 3 }, 'only turns in params');
  assertEq(logo?.label, 'Spiral', 'label at logo level, not captured by sub-block');
});

test('parses logo align variants', () => {
  const src = `${HEADER}logo wordmark\n  label: Wordmark\n  src: logos/wordmark-centered.svg\n  aspect: 1.82\n  align-left\n    src: logos/wordmark-left.svg\n    aspect: 1.79\n  scale: 1.1\n`;
  const out = parseBrandFile(src, 'test.brand');
  const logo = out.assets?.logos?.[0];
  assertEq(logo?.src, 'logos/wordmark-centered.svg', 'base src stays');
  assertEq(logo?.aspectRatio, 1.82, 'base aspect stays');
  assertEq(logo?.alignVariants, { left: { src: 'logos/wordmark-left.svg', aspectRatio: 1.79 } }, 'left variant');
  assertEq(logo?.scale, 1.1, 'key after sub-block belongs to the logo');
});

test('group: on a photo names a .group; a video takes none', () => {
  const src = `${HEADER}photo old\n  group: drax-mill\n  work: rye-loaf\n\nvideo clip\n  label: Clip\n`;
  const out = parseBrandFile(src, 'test.brand');
  assertEq([out.assets?.photos?.[0]?.group, out.assets?.photos?.[0]?.work], ['drax-mill', 'rye-loaf'], 'photo group and work');
  assertEq(out.assets?.videos?.[0], { id: 'clip', label: 'Clip', src: '' }, 'video block: facts only');
  assertThrows(() => parseBrandFile(`${HEADER}logo mark\n  src: logos/a/b/mark.svg\n`, 'test.brand'), /nested too deep/, 'two subfolders');
  assertThrows(() => parseBrandFile(`${HEADER}photo p\n  section: old\n`, 'test.brand'), /section: is gone since v0.46/, 'section key');
  assertThrows(() => parseBrandFile(`${HEADER}video clip\n  group: experimental\n`, 'test.brand'), /a library section is the subfolder since v0.46/, 'group on a video');
  assertThrows(() => parseBrandFile(`${HEADER}photo p\n  group: Drax Mill\n`, 'test.brand'), /group: must be an id/, 'group id');
});

test('a photo or video names no file: src: is gone, the id is the file name', () => {
  assertThrows(() => parseBrandFile(`${HEADER}video clip\n  src: videos/clip.mp4\n`, 'test.brand'), /video "clip": src: is gone since v0.52.*media\/videos\/clip\.mp4/, 'video src key');
  assertThrows(() => parseBrandFile(`${HEADER}video Old_Clip\n`, 'test.brand'), /lowercase kebab-case/, 'video id is no file name');
  assertThrows(() => parseBrandFile(`${HEADER}photo p\n  src: photos/p.jpg\n`, 'test.brand'), /src: is gone since v0.46/, 'src key');
  assertThrows(() => parseBrandFile(`${HEADER}photo Old_Mill\n  label: Mill\n`, 'test.brand'), /lowercase kebab-case/, 'id is no file name');
});

test('photoLibrary: files below media/photos/ are the library, blocks add facts', () => {
  const declared = parseBrandFile(`${HEADER}photo mill\n  label: The mill\n  work: rye-loaf\n\nphoto hero\n  label: Hero\n`, 'test.brand').assets?.photos;
  const lib = photoLibrary(declared, ['hero.jpg', 'Releases/Rye/mill.jpeg', 'Old days/oven.png', 'Releases/cover.webp'], 'test.brand');
  assertEq(lib.map(p => p.id), ['mill', 'hero', 'oven', 'cover'], 'declared first, in their order, then the rest in file order');
  assertEq(lib[0], { id: 'mill', label: 'The mill', src: 'media/photos/Releases/Rye/mill.jpeg', work: 'rye-loaf', section: 'Releases', subsection: 'Rye' }, 'two levels');
  assertEq(lib[1], { id: 'hero', label: 'Hero', src: 'media/photos/hero.jpg' }, 'top folder: no section');
  assertEq(lib[2], { id: 'oven', label: 'oven', src: 'media/photos/Old days/oven.png', section: 'Old days' }, 'undeclared file: label = id, folder as written');
  assertEq(lib[3].subsection, undefined, 'file directly in a section');
  assertEq(photoLibrary(undefined, ['Caf\u0065\u0301/a.jpg'], 't')[0].section, 'Café', 'folder name NFC');
  assertThrows(() => photoLibrary(declared, ['hero.jpg'], 'test.brand'), /photo "mill" has no file/, 'declared without file');
  assertThrows(() => photoLibrary(undefined, ['a/x.jpg', 'b/x.png'], 'test.brand'), /same name/, 'duplicate name');
  assertThrows(() => photoLibrary(undefined, ['IMG_1234.jpg'], 'test.brand'), /lowercase kebab-case/, 'camera name');
  assertThrows(() => photoLibrary(undefined, ['a/b/c/x.jpg'], 'test.brand'), /nested too deep/, 'three levels');
  assertThrows(() => photoLibrary(undefined, ['notes.txt'], 'test.brand'), /not a photo/, 'not an image');
});

test('videoLibrary: files below media/videos/ are the library, by the photo rules', () => {
  const declared = parseBrandFile(`${HEADER}video intro\n  label: Intro Clip\n  loop\n`, 'test.brand').assets?.videos;
  const lib = videoLibrary(declared, ['Events/Summer/harbour.mov', 'intro.mp4'], 'test.brand');
  assertEq(lib[0], { id: 'intro', label: 'Intro Clip', src: 'media/videos/intro.mp4', loop: true }, 'declared: facts plus file');
  assertEq(lib[1], { id: 'harbour', label: 'harbour', src: 'media/videos/Events/Summer/harbour.mov', section: 'Events', subsection: 'Summer' }, 'undeclared, two levels');
  assertThrows(() => videoLibrary(declared, [], 'test.brand'), /video "intro" has no file.*media\/videos\//, 'declared without file');
  assertThrows(() => videoLibrary(undefined, ['in the woods.mp4'], 'test.brand'), /lowercase kebab-case/, 'spaces in the name');
  assertThrows(() => videoLibrary(undefined, ['hero.jpg'], 'test.brand'), /not a video/, 'not a video');
});

// ── framing ──────────────────────────────────────────────────────────────────

test('parses framing modules in order', () => {
  const src = `${HEADER}framing wide\n  label: Wide\n  horizon: 60%\n  description: The shop seen from across the square.\n\nframing close\n  label: Close\n  horizon: none\n`;
  const out = parseBrandFile(src, 'test.brand');
  assertEq(out.framings, [
    { id: 'wide', label: 'Wide', horizon: 60, description: 'The shop seen from across the square.' },
    { id: 'close', label: 'Close', horizon: null },
  ], 'framings');
});

test('framing label defaults to id; no block → no framings', () => {
  assertEq(parseBrandFile(`${HEADER}framing licht\n  horizon: 80%\n`, 'test.brand').framings?.[0]?.label, 'licht', 'label');
  assertEq(parseBrandFile(HEADER, 'test.brand').framings, undefined, 'absent');
});

test('framing caption and goals', () => {
  const out = parseBrandFile(`${HEADER}framing handlung\n  horizon: 30%\n  caption: Wer lernt hier was?\n  goals: profile, localhood\n`, 'test.brand');
  assertEq(out.framings?.[0]?.caption, 'Wer lernt hier was?', 'caption');
  assertEq(out.framings?.[0]?.goals, ['profile', 'localhood'], 'goals');
});

test('photo metadata: framing, place, person, taken', () => {
  const src = `${HEADER}framing close\n  horizon: none\n\nphoto baeckerin\n  framing: close\n  place: Backstube, Hauptstraße\n  person: anna\n  taken: 2026-05-14\n`;
  const p = parseBrandFile(src, 'test.brand').assets?.photos?.[0];
  assertEq([p?.framing, p?.place, p?.person, p?.taken], ['close', 'Backstube, Hauptstraße', 'anna', '2026-05-14'], 'metadata');
});

test('photo metadata rejects unknown framing, bad date, non-photo use', () => {
  assertThrows(() => parseBrandFile(`${HEADER}photo a\n  framing: nope\n`, 'test.brand'), /unknown framing/, 'unknown framing');
  assertThrows(() => parseBrandFile(`${HEADER}photo a\n  taken: 14.05.2026\n`, 'test.brand'), /YYYY-MM-DD/, 'bad date');
  assertThrows(() => parseBrandFile(`${HEADER}logo a\n  src: a.svg\n  place: Burg\n`, 'test.brand'), /for photos only/, 'logo');
});

test('photo focus and horizon', () => {
  const src = `${HEADER}photo a\n  focus: 45% 30.5%\n  horizon: 58%\n\nphoto b\n  focus: none\n  horizon: none\n\nphoto c\n`;
  const [a, b, c] = parseBrandFile(src, 'test.brand').assets?.photos ?? [];
  assertEq([a?.focus, a?.horizon], [{ x: 45, y: 30.5 }, 58], 'declared');
  assertEq([b?.focus, b?.horizon], [null, null], 'none');
  assertEq(['focus' in (c ?? {}), 'horizon' in (c ?? {})], [false, false], 'absent');
  assertThrows(() => parseBrandFile(`${HEADER}photo a\n  focus: 45%\n`, 'test.brand'), /focus: must be/, 'one value');
  assertThrows(() => parseBrandFile(`${HEADER}photo a\n  horizon: 0.6\n`, 'test.brand'), /horizon: must be/, 'no percent');
  assertThrows(() => parseBrandFile(`${HEADER}photo a\n  horizon: 120%\n`, 'test.brand'), /above 100%/, 'range');
  assertThrows(() => parseBrandFile(`${HEADER}logo a\n  src: a.svg\n  focus: 50% 50%\n`, 'test.brand'), /for photos only/, 'logo');
});

test('framing rejects bad horizon, missing horizon, unknown keys, duplicates', () => {
  assertThrows(() => parseBrandFile(`${HEADER}framing a\n  horizon: 120%\n`, 'test.brand'), /framing horizon/, 'out of range');
  assertThrows(() => parseBrandFile(`${HEADER}framing a\n  horizon: 0.5\n`, 'test.brand'), /framing horizon/, 'no percent');
  assertThrows(() => parseBrandFile(`${HEADER}framing a\n  label: A\n`, 'test.brand'), /needs "horizon/, 'missing horizon');
  assertThrows(() => parseBrandFile(`${HEADER}framing a\n  horizon: 50%\n  tilt: 2\n`, 'test.brand'), /unknown framing property/, 'unknown key');
  assertThrows(() => parseBrandFile(`${HEADER}framing a\n  horizon: 50%\nframing a\n  horizon: 30%\n`, 'test.brand'), /duplicate framing/, 'duplicate');
});

// ── camera ───────────────────────────────────────────────────────────────────

test('parses camera block', () => {
  assertEq(parseBrandFile(`${HEADER}camera\n  facing: front\n  grid: 3 4\n`, 'test.brand').camera, { facing: 'front', grid: { rows: 3, cols: 4 } }, 'full');
  assertEq(parseBrandFile(`${HEADER}camera\n  grid: 3\n`, 'test.brand').camera, { facing: 'rear', grid: { rows: 3, cols: 3 } }, 'square grid, rear default');
  assertEq(parseBrandFile(HEADER, 'test.brand').camera, undefined, 'absent');
});

test('camera rejects bad facing, grid and keys', () => {
  assertThrows(() => parseBrandFile(`${HEADER}camera\n  facing: back\n`, 'test.brand'), /camera facing/, 'facing');
  assertThrows(() => parseBrandFile(`${HEADER}camera\n  grid: 1\n`, 'test.brand'), /camera grid/, 'grid too small');
  assertThrows(() => parseBrandFile(`${HEADER}camera\n  grid: thirds\n`, 'test.brand'), /camera grid/, 'grid word');
  assertThrows(() => parseBrandFile(`${HEADER}camera\n  zoom: 2\n`, 'test.brand'), /unknown camera property/, 'unknown key');
});

// ── photo-look ───────────────────────────────────────────────────────────────

const LOOK_ZERO = { saturation: 0, contrast: 0, warmth: 0, fade: 0, mono: false, fixed: [] };

test('parses photo-look block', () => {
  assertEq(parseBrandFile(`${HEADER}photo-look\n  saturation: -15   # iPhone colour calmed\n`, 'test.brand').photoLook, { ...LOOK_ZERO, saturation: -15 }, 'saturation only');
  assertEq(parseBrandFile(`${HEADER}photo-look\n  contrast: +10\n  warmth: -20\n  fade: 30\n`, 'test.brand').photoLook, { ...LOOK_ZERO, contrast: 10, warmth: -20, fade: 30 }, 'contrast, warmth, fade');
  assertEq(parseBrandFile(`${HEADER}photo-look\n  mono\n  contrast: 20\n  fixed: mono\n`, 'test.brand').photoLook, { ...LOOK_ZERO, contrast: 20, mono: true, fixed: ['mono'] }, 'mono fixed');
  assertEq(parseBrandFile(HEADER, 'test.brand').photoLook, undefined, 'absent');
});

test('photo-look duotone resolves brand colors', () => {
  const src = `${HEADER}brand-colors\n  ink: #112233\nphoto-look\n  duotone: $ink #fc0\n  fixed: duotone\n`;
  assertEq(parseBrandFile(src, 'test.brand').photoLook, { ...LOOK_ZERO, duotone: { shadow: '#112233', highlight: '#FFCC00' }, fixed: ['duotone'] }, 'ref + hex');
});

test('photo-look scrim', () => {
  assertEq(parseBrandFile(`${HEADER}photo-look\n  saturation: -15\n  scrim: 45%\n`, 'test.brand').photoLook, { ...LOOK_ZERO, saturation: -15, scrim: 45 }, 'scrim percent');
  assertThrows(() => parseBrandFile(`${HEADER}photo-look\n  scrim: 45\n`, 'test.brand'), /photo-look scrim/, 'no percent sign');
  assertThrows(() => parseBrandFile(`${HEADER}photo-look\n  scrim: 0%\n`, 'test.brand'), /photo-look scrim/, 'zero');
  assertThrows(() => parseBrandFile(`${HEADER}photo-look\n  scrim: 120%\n`, 'test.brand'), /photo-look scrim/, 'over 100');
  assertThrows(() => parseBrandFile(`${HEADER}photo-look\n  scrim: 45%\n  fixed: scrim\n`, 'test.brand'), /fixed lists unknown/, 'not a fixed key');
});

test('photo-look scrim-padding and scrim-gap', () => {
  const look = (body: string) => parseBrandFile(`${HEADER}photo-look\n${body}`, 'test.brand').photoLook!;
  assertEq(look('  scrim-padding: 1 1.6\n  scrim-gap: 0.4\n').scrimPadding, [1, 1.6, 1, 1.6], 'two values');
  assertEq(look('  scrim-padding: 1\n').scrimPadding, [1, 1, 1, 1], 'one value');
  assertEq(look('  scrim-padding: 1 2 3\n').scrimPadding, [1, 2, 3, 2], 'three values');
  assertEq(look('  scrim-padding: 1 2 3 4\n').scrimPadding, [1, 2, 3, 4], 'four values');
  assertEq(look('  scrim-gap: 0.4\n').scrimGap, 0.4, 'gap');
  assertEq('scrimGap' in look('  scrim: 45%\n'), false, 'absent');
  assertThrows(() => look('  scrim-padding: 1 2 3 4 5\n'), /photo-look scrim-padding/, 'five values');
  assertThrows(() => look('  scrim-padding: 1cqh\n'), /photo-look scrim-padding/, 'a unit');
  assertThrows(() => look('  scrim-gap: -1\n'), /photo-look scrim-gap/, 'negative');
});

test('photo-look rejects bad values and keys', () => {
  assertThrows(() => parseBrandFile(`${HEADER}photo-look\n  saturation: -150\n`, 'test.brand'), /photo-look saturation/, 'out of range');
  assertThrows(() => parseBrandFile(`${HEADER}photo-look\n  saturation: 15%\n`, 'test.brand'), /photo-look saturation/, 'percent');
  assertThrows(() => parseBrandFile(`${HEADER}photo-look\n  fade: -5\n`, 'test.brand'), /photo-look fade/, 'negative fade');
  assertThrows(() => parseBrandFile(`${HEADER}photo-look\n  mono: yes\n`, 'test.brand'), /mono is a flag/, 'mono value');
  assertThrows(() => parseBrandFile(`${HEADER}photo-look\n  mono\n  duotone: #000 #fff\n`, 'test.brand'), /both mono and duotone/, 'mono + duotone');
  assertThrows(() => parseBrandFile(`${HEADER}photo-look\n  duotone: $nope #fff\n`, 'test.brand'), /unknown brand color/, 'unknown ref');
  assertThrows(() => parseBrandFile(`${HEADER}photo-look\n  duotone: #000\n`, 'test.brand'), /SHADOW HIGHLIGHT/, 'one color');
  assertThrows(() => parseBrandFile(`${HEADER}photo-look\n  saturation: -15\n  fixed: contrast\n`, 'test.brand'), /not set/, 'fixed unset key');
  assertThrows(() => parseBrandFile(`${HEADER}photo-look\n  fixed: grain\n`, 'test.brand'), /fixed lists unknown/, 'fixed unknown key');
  assertThrows(() => parseBrandFile(`${HEADER}photo-look\n  grain: 5\n`, 'test.brand'), /unknown photo-look property/, 'unknown key');
  assertThrows(() => parseBrandFile(`${HEADER}photo-look\n  saturation: -15\nphoto-look\n  saturation: 0\n`, 'test.brand'), /duplicate photo-look/, 'duplicate');
});

// ── location ─────────────────────────────────────────────────────────────────

console.log('\nlocation:');

test('parses location block', () => {
  const b = parseBrandFile(`${HEADER}location\n  name:      Harbour Town   # shown in credits\n  latitude:  54.32\n  longitude: -10.5\n`, 'test.brand');
  assertEq(b.location, { name: 'Harbour Town', latitude: 54.32, longitude: -10.5 }, 'location');
  assertEq(b.name, 'Test', 'top-level name untouched');
  assertEq(parseBrandFile(HEADER, 'test.brand').location, undefined, 'absent');
});

test('location rejects missing, bad and unknown keys', () => {
  assertThrows(() => parseBrandFile(`${HEADER}location\n  name: X\n  latitude: 54\n`, 'test.brand'), /location needs longitude/, 'missing');
  assertThrows(() => parseBrandFile(`${HEADER}location\n  name: X\n  latitude: 91\n  longitude: 10\n`, 'test.brand'), /location latitude/, 'out of range');
  assertThrows(() => parseBrandFile(`${HEADER}location\n  name: X\n  latitude: 54°N\n  longitude: 10\n`, 'test.brand'), /decimal degrees/, 'not decimal');
  assertThrows(() => parseBrandFile(`${HEADER}location\n  name: X\n  latitude: 54\n  longitude: 10\n  zip: 1\n`, 'test.brand'), /unknown location property/, 'unknown key');
  assertThrows(() => parseBrandFile(`${HEADER}location\n  name: X\n  latitude: 54\n  longitude: 10\nlocation\n`, 'test.brand'), /duplicate location/, 'duplicate');
});

// ── windows (moved to the .time) ─────────────────────────────────────────────

console.log('\nwindows:');

test('a leftover windows block is ignored with a warning; photo when: stays an id', () => {
  const b = parseBrandFile(`${HEADER}windows\n  strawberries: 05-01..05-31   # peak mid-May\n  plums:  03-01..05-31, 08-15..10-31\n\nphoto berries\n  when: strawberries\n`, 'test.brand');
  assertEq('windows' in b, false, 'no windows on the brand');
  assertEq(b.warnings, ['test.brand:5: windows block is ignored — windows live in the .time now; move it to "test.time"'], 'warning');
  assertEq(b.assets?.photos?.[0].when, 'strawberries', 'photo when');
  assertThrows(() => parseBrandFile(`${HEADER}photo raps\n  when: Raps Season\n`, 'test.brand'), /when: must be an id/, 'when id');
  assertThrows(() => parseBrandFile(`${HEADER}logo main\n  src: logos/main.svg\n  when: raps\n`, 'test.brand'), /photos only/, 'logo when');
});

test('isInDateWindow: inclusive ends, year-end wrap, multiple ranges', () => {
  const d = (m: number, day: number) => new Date(2026, m - 1, day);
  const berries = [{ from: '05-01', to: '05-31' }];
  assertEq([d(4, 30), d(5, 1), d(5, 31), d(6, 1)].map(x => isInDateWindow(berries, x)), [false, true, true, false], 'berries');
  const ny = [{ from: '12-27', to: '01-06' }];
  assertEq([d(12, 26), d(12, 31), d(1, 6), d(1, 7)].map(x => isInDateWindow(ny, x)), [false, true, true, false], 'wrap');
  const zug = [{ from: '03-01', to: '05-31' }, { from: '08-15', to: '10-31' }];
  assertEq([d(4, 1), d(7, 1), d(9, 20)].map(x => isInDateWindow(zug, x)), [true, false, true], 'two ranges');
});

test('checkBrand: photo when: against the .time, photo person: against the people', () => {
  const b = parseBrandFile(`${HEADER}photo jetty\n  when: advent\n  person: thomas\nphoto bike\n  person: thomas\nphoto counter\n`, 'test.brand');
  const time = parseTimeFile('windows\n  advent: 11-27..12-24\n', 'test.time');
  const thomas = parsePersonFile('id: thomas\nrole: Regular\nphotos: jetty, bike\n', 'thomas.person');
  assertEq(checkBrand(b, { time, people: [thomas] }, 'test.brand'), [], 'fits');
  assertEq(checkBrand(b, { time: null }, 'test.brand'), ['test.brand: photo "jetty": when "advent" is not in the .time (the brand has no .time)'], 'no .time');
  assertEq(checkBrand(b, { time: parseTimeFile('', 'test.time') }, 'test.brand'), ['test.brand: photo "jetty": when "advent" is not in the .time'], 'unknown when');
  assertEq(checkBrand(b, { people: [] }, 'test.brand'), ['test.brand: photo "jetty": person "thomas" does not exist', 'test.brand: photo "bike": person "thomas" does not exist'], 'unknown person');
  const partial = parsePersonFile('id: thomas\nrole: Regular\nphotos: jetty, counter, gone\n', 'thomas.person');
  assertEq(checkBrand(b, { people: [partial] }, 'test.brand'), [
    'test.brand: photo "bike" names person "thomas", but their photos: doesn\'t list it (the person agreed to the photos the file lists)',
    'test.brand: person "thomas": photo "counter" names no person (add "person: thomas" to the photo)',
    'test.brand: person "thomas": photo "gone" does not exist',
  ], 'mismatches');
  assertEq(checkBrand(b, {}, 'test.brand'), [], 'not checked');
});

test('checkBrand: photo group: and work: mirror the group\'s and work\'s photos:', () => {
  const b = parseBrandFile(`${HEADER}photo van\n  group: fenster\nphoto sleeve\n  work: nachtfahrt\nphoto stage\n`, 'test.brand');
  const fenster = parseGroupFile('id: fenster\nname: Fenster\nrole: Band\nphotos: van\n', 'fenster.group');
  const album = parseWorkFile('id: nachtfahrt\ntitle: Nachtfahrt\nkind: album\nphotos: sleeve\n', 'nachtfahrt.work');
  assertEq(checkBrand(b, { groups: [fenster], works: [album] }, 'test.brand'), [], 'fits');
  assertEq(checkBrand(b, { groups: [], works: [] }, 'test.brand'), [
    'test.brand: photo "van": group "fenster" does not exist (a library section is the subfolder since v0.46)',
    'test.brand: photo "sleeve": work "nachtfahrt" does not exist',
  ], 'unknown');
  const partial = parseGroupFile('id: fenster\nname: Fenster\nrole: Band\nphotos: stage, gone\n', 'fenster.group');
  assertEq(checkBrand(b, { groups: [partial] }, 'test.brand'), [
    'test.brand: photo "van" names group "fenster", but its photos: doesn\'t list it',
    'test.brand: group "fenster": photo "stage" names no group (add "group: fenster" to the photo)',
    'test.brand: group "fenster": photo "gone" does not exist',
  ], 'mismatches');
});

// ── tones ────────────────────────────────────────────────────────────────────

console.log('\ntones:');

const TONES = `${HEADER}brand-colors
  blue:  #2B4C7E
  white: #FFFFFF
  green: #40604B

tones   # imported, don't edit
  steps: 10, 30, 95
  $blue:  #0B1A30 #2B4C7E #F0F4FA
  $green: #14231A #40604B #E2F2E8   # anchor on 30
`;

test('parses ladders and resolves $name.step in themes, shared and families', () => {
  const src = `${TONES}
color-families
  shared: $blue.10, $white
  family Dusk
    core:     $green
    accent:   $blue
    contrast: $blue.10
  family Dawn
    core:     $green.95
    contrast: $blue.10

theme Light
  background: $blue.95
  text-primary: $blue.10 70%
`;
  const b = parseBrandFile(src, 'test.brand');
  assertEq(b.tones?.steps, [10, 30, 95], 'steps');
  assertEq(b.tones?.colors.blue[95], '#F0F4FA', 'ladder');
  assertEq(b.themes?.Light.background, '#F0F4FA', 'theme step');
  assertEq(b.themes?.Light['text-primary'], 'rgba(11, 26, 48, 0.7)', 'step with alpha');
  assertEq(b.colorFamilies?.shared[0], { name: 'blue.10', hex: '#0B1A30' }, 'shared step');
  const dusk = b.colorFamilies!.families[0].colors;
  assertEq(dusk.map(c => [c.role, c.key, c.hex]), [['core', 'green', '#40604B'], ['accent', 'blue', '#2B4C7E'], ['contrast', 'blue.10', '#0B1A30']], 'family refs');
  assertEq(Object.keys(b.brandColors!), ['blue', 'white', 'green'], 'refs do not join brandColors');
});

test('two families may reference the same color', () => {
  const src = `${TONES}
color-families
  family A
    core: $green
    contrast: $blue.10
  family B
    core: $green
    contrast: $blue.10
`;
  assertEq(parseBrandFile(src, 'test.brand').colorFamilies?.families.length, 2, 'families');
});

test('rejects broken tones', () => {
  const p = (body: string) => () => parseBrandFile(`${HEADER}brand-colors\n  blue: #2B4C7E\n\n${body}`, 'test.brand');
  assertThrows(p('tones\n  $blue: #0B1A30 #2B4C7E\n'), /needs a "steps:" line/, 'no steps');
  assertThrows(p('tones\n  steps: 30, 10\n  $blue: #0B1A30 #2B4C7E\n'), /ascending/, 'order');
  assertThrows(p('tones\n  steps: 10, 30\n  $blue: #2B4C7E\n'), /has 1 values, steps declares 2/, 'count');
  assertThrows(p('tones\n  steps: 10, 30\n  $blue: #0B1A30 #1C3558\n'), /must contain its own hex #2B4C7E/, 'anchor');
  assertThrows(p('tones\n  steps: 10, 30\n  $red: #0B1A30 #2B4C7E\n'), /"\$red" is not a brand color/, 'unknown color');
  assertThrows(p('tones\n  steps: 10, 30\n  $blue: #0B1A30 #2B4C7E\n  $blue: #0B1A30 #2B4C7E\n'), /twice/, 'duplicate');
  assertThrows(p('tones\n  steps: 10, 30\n  $blue: #0B1A30 #2B4C7E\n\ntheme T\n  background: $blue.20\n'), /unknown brand color "\$blue\.20"/, 'unknown step');
});

// ── Inline comments (SPEC: allowed after any value) ──────────────────────────

console.log('\nInline comments:');

test('flat brand color keeps its hex when a comment follows', () => {
  const src = `${HEADER}brand-colors\n  primary: #2C1810   # dark roast - the colour of a crust\n  white:   #FAF6F0 # flour\n    pantone: 7527 C   # print\ntheme Laden\n  background: $white\n  text-primary: $primary\n`;
  const out = parseBrandFile(src, 'test.brand');
  assertEq(out.brandColors, { primary: '#2C1810', white: '#FAF6F0' }, 'brandColors');
  assertEq(out.brandColorPrint?.white?.pantone, '7527 C', 'print spec');
  assertEq(out.themes?.Laden?.background, '#FAF6F0', 'theme resolves the commented colour');
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(f);
  process.exit(1);
}
