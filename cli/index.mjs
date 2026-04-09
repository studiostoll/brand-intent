#!/usr/bin/env node

import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, resolve, basename } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_ROOT = resolve(__dirname, '..');

const SKILL_FILE = join(PKG_ROOT, 'skills', 'brand-intent.md');

// ── Harness detection and install paths ──

const HARNESSES = [
  { id: 'claude',  label: 'Claude Code',      dir: '.claude/commands' },
  { id: 'cursor',  label: 'Cursor',           dir: '.cursor/rules' },
  { id: 'gemini',  label: 'Gemini CLI',       dir: '.gemini' },
  { id: 'copilot', label: 'VS Code Copilot',  dir: '.github/copilot-instructions' },
];

function detectHarnesses(cwd) {
  return HARNESSES.filter(h => {
    const parent = h.dir.split('/')[0];
    return existsSync(join(cwd, parent));
  });
}

// ── Readline helpers (single shared instance) ──

let _rl;
function rl() {
  if (!_rl) {
    _rl = createInterface({ input: process.stdin, output: process.stdout });
  }
  return _rl;
}
function closeRl() {
  if (_rl) { _rl.close(); _rl = null; }
}

function ask(q) {
  return new Promise((res) => rl().question(q, res));
}

async function choose(prompt, options) {
  console.log(`  ${prompt}\n`);
  options.forEach((opt, i) => {
    console.log(`  ${i + 1}) ${opt.label}`);
  });
  console.log('');
  const answer = await ask('  Choose [1-' + options.length + ']: ');
  const idx = parseInt(answer, 10) - 1;
  if (idx >= 0 && idx < options.length) return options[idx].value;
  return options[0].value;
}

async function confirm(question, defaultYes = true) {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  const answer = await ask(`  ${question} (${hint}) `);
  if (answer.trim() === '') return defaultYes;
  return answer.trim().toLowerCase().startsWith('y');
}

async function input(question, defaultValue) {
  const hint = defaultValue ? ` (${defaultValue})` : '';
  const answer = await ask(`  ${question}${hint}: `);
  return answer.trim() || defaultValue || '';
}

// ── File operations ──

function copyDirRecursive(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

async function installSkills(cwd) {
  if (!existsSync(SKILL_FILE)) {
    console.error('Error: skill file not found at', SKILL_FILE);
    process.exit(1);
  }

  const skill = readFileSync(SKILL_FILE, 'utf-8');
  let harnesses = detectHarnesses(cwd);

  if (harnesses.length === 0) {
    // Nothing detected — ask which to install
    console.log('  Which AI tools do you use?\n');
    HARNESSES.forEach((h, i) => {
      console.log(`  ${i + 1}) ${h.label}`);
    });
    console.log(`  ${HARNESSES.length + 1}) all of the above`);
    console.log('');
    const answer = await ask(`  Choose [1-${HARNESSES.length + 1}]: `);
    const idx = parseInt(answer, 10) - 1;
    if (idx === HARNESSES.length) {
      harnesses = HARNESSES;
    } else if (idx >= 0 && idx < HARNESSES.length) {
      harnesses = [HARNESSES[idx]];
    } else {
      harnesses = [HARNESSES[0]];
    }
  }

  for (const { label, dir } of harnesses) {
    const target = join(cwd, dir);
    mkdirSync(target, { recursive: true });
    const dest = join(target, 'brand-intent.md');
    writeFileSync(dest, skill, 'utf-8');
    console.log(`  \u2713 ${label} \u2014 ${dir}/brand-intent.md`);
  }
}

// ── Explore the example ──

function scaffoldExample(targetDir) {
  const brandSrc = join(PKG_ROOT, 'brands', 'krume');
  const exampleDest = join(targetDir, 'examples', 'krume');

  // Copy brand files
  copyDirRecursive(brandSrc, exampleDest);
  console.log('  \u2713 examples/krume/krume.identity');
  console.log('  \u2713 examples/krume/krume.brand');

  // Copy one format, one purpose, one composition as starting examples
  const examples = [
    { layer: 'formats', file: 'instagram-4-5-feed-portrait.format' },
    { layer: 'purposes', file: 'daily-bread.purpose' },
    { layer: 'compositions', file: 'editorial.composition' },
  ];

  for (const { layer, file } of examples) {
    const src = join(PKG_ROOT, layer, file);
    if (existsSync(src)) {
      const dest = join(exampleDest, layer, file);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(src, dest);
      console.log(`  \u2713 examples/krume/${layer}/${file}`);
    }
  }

  console.log(`
  The Krume bakery is a fully commented reference implementation.
  Read the .identity file first \u2014 it explains every decision.
  Then look at how .brand derives expression intent from identity.
  Formats, purposes, and compositions show the remaining three layers.`);
}

// ── Create your own brand ──

async function scaffoldOwnBrand(targetDir) {
  console.log('\n  Let\u2019s define your brand. Answer what you can \u2014 skip the rest.\n');

  const brandName = await input('Brand name');
  if (!brandName) {
    console.error('\n  A brand needs a name. Try again.\n');
    process.exit(1);
  }

  const brandId = brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const language = await input('Language', 'en');
  const locale = await input('Locale', language === 'de' ? 'de-DE' : language === 'en' ? 'en-US' : `${language}-${language.toUpperCase()}`);

  // Identity
  const essence = await input('Essence \u2014 one sentence, what this brand is about');
  const promise = await input('Promise \u2014 what people experience');
  const tagline = await input('Tagline');
  const archetype = await input('Archetype (e.g. craftsman, sage, rebel)');

  // Voice
  console.log('\n  Voice \u2014 how the brand speaks.\n');
  const register = await input('Register (e.g. informal/Du, formal/Sie, casual)');
  const persona = await input('Persona \u2014 who is speaking?');
  const rhythm = await input('Rhythm \u2014 sentence style');

  console.log('\n  Always rules \u2014 what the brand always does. One per line, empty line to stop.\n');
  const always = await collectList();

  console.log('\n  Never rules \u2014 what the brand never does. One per line, empty line to stop.\n');
  const never = await collectList();

  // Pillars
  console.log('');
  const primaryPillars = await input('Primary pillars (comma-separated)');
  const secondaryPillars = await input('Secondary pillars (comma-separated)');
  const avoidPillars = await input('Avoid topics (comma-separated)');

  // Audiences
  console.log('\n  Audiences \u2014 who the brand speaks to.\n');
  const audiences = await collectAudiences();

  // Colors
  console.log('\n  Colors \u2014 the brand palette.\n');
  const primaryColor = await input('Primary color (hex)', '#1a1a1a');
  const secondaryColor = await input('Secondary color (hex)', '#4a4a4a');
  const accentColor = await input('Accent color (hex)', '#0066cc');
  const whiteColor = await input('Background/white (hex)', '#ffffff');

  // Typography
  console.log('\n  Typography\n');
  const primaryFont = await input('Primary font name', 'Inter');
  const primaryFontSource = await input('Font source (google/local)', 'google');

  // ── Write .identity ──

  let identity = `# ${brandId}.identity\n`;
  if (essence) identity += `\nessence:  ${essence}\n`;
  if (promise) identity += `\npromise:  ${promise}\n`;
  if (tagline) identity += `\ntagline:  ${tagline}\n`;
  if (archetype) identity += `\narchetype: ${archetype}\n`;

  if (register || persona || rhythm || always.length || never.length) {
    identity += `\nvoice\n`;
    if (register) identity += `  register:  ${register}\n`;
    if (persona) identity += `  persona:   ${persona}\n`;
    if (rhythm) identity += `  rhythm:    ${rhythm}\n`;
    if (always.length) {
      identity += `\n  always:\n`;
      for (const rule of always) identity += `    - ${rule}\n`;
    }
    if (never.length) {
      identity += `\n  never:\n`;
      for (const rule of never) identity += `    - ${rule}\n`;
    }
  }

  if (primaryPillars || secondaryPillars || avoidPillars) {
    identity += `\npillars\n`;
    if (primaryPillars) identity += `  primary:   ${primaryPillars}\n`;
    if (secondaryPillars) identity += `  secondary: ${secondaryPillars}\n`;
    if (avoidPillars) identity += `  avoid:     ${avoidPillars}\n`;
  }

  for (const aud of audiences) {
    identity += `\naudience ${aud.id}\n`;
    identity += `  label:       ${aud.label}\n`;
    if (aud.profile) identity += `  profile:     ${aud.profile}\n`;
    if (aud.motivation) identity += `  motivation:  ${aud.motivation}\n`;
    if (aud.language) identity += `  language:    ${aud.language}\n`;
  }

  writeFileSync(join(targetDir, `${brandId}.identity`), identity, 'utf-8');
  console.log(`\n  \u2713 ${brandId}.identity`);

  // ── Write .brand ──

  let brand = `# ${brandId}.brand \u2014 expression intent derived from ${brandId}.identity\n\n`;
  brand += `id:       ${brandId}\n`;
  brand += `name:     ${brandName}\n`;
  brand += `language: ${language}\n`;
  brand += `locale:   ${locale}\n`;

  brand += `\nbrand-colors\n`;
  brand += `  primary:   ${primaryColor}\n`;
  brand += `  secondary: ${secondaryColor}\n`;
  brand += `  accent1:   ${accentColor}\n`;
  brand += `  white:     ${whiteColor}\n`;

  brand += `\ntheme Default\n`;
  brand += `  background:     $white\n`;
  brand += `  text-primary:   $primary\n`;
  brand += `  text-secondary: $secondary\n`;
  brand += `  cta:            $accent1\n`;
  brand += `  divider:        $secondary\n`;

  brand += `\nfont primary\n`;
  brand += `  name:     ${primaryFont}\n`;
  brand += `  fallback: sans-serif\n`;
  brand += `  source:   ${primaryFontSource}\n`;

  brand += `\ntypography headline\n`;
  brand += `  weight:      700\n`;
  brand += `  size:        6\n`;
  brand += `  lineHeight:  1.15\n`;

  brand += `\ntypography body\n`;
  brand += `  weight:      400\n`;
  brand += `  size:        2.8\n`;
  brand += `  lineHeight:  1.5\n`;

  brand += `\ntypography caption\n`;
  brand += `  weight:      400\n`;
  brand += `  size:        2.2\n`;
  brand += `  lineHeight:  1.4\n`;

  brand += `\ntypography label\n`;
  brand += `  weight:      600\n`;
  brand += `  size:        2\n`;
  brand += `  lineHeight:  1.2\n`;
  brand += `  uppercase\n`;

  brand += `\nspacing:\n`;
  brand += `  unit: cqmin\n`;
  brand += `  xs: 1.5\n`;
  brand += `  s: 2\n`;
  brand += `  m: 3\n`;
  brand += `  l: 5\n`;
  brand += `  xl: 6.5\n`;

  writeFileSync(join(targetDir, `${brandId}.brand`), brand, 'utf-8');
  console.log(`  \u2713 ${brandId}.brand`);

  // ── Write a starter .purpose ──

  let purpose = `id:   starter\n`;
  purpose += `name: Starter Purpose\n`;
  purpose += `density: light\n`;
  purpose += `palette: dynamic\n\n`;
  purpose += `slot primary\n`;
  purpose += `  label:      Headline\n`;
  purpose += `  typography: headline\n`;
  purpose += `  color:      text-primary\n`;
  purpose += `  maxLength:  60\n`;
  purpose += `  samples:\n`;
  purpose += `    - Your headline here\n\n`;
  purpose += `slot secondary\n`;
  purpose += `  label:      Subline\n`;
  purpose += `  typography: body\n`;
  purpose += `  color:      text-secondary\n`;
  purpose += `  maxLength:  120\n`;
  purpose += `  samples:\n`;
  purpose += `    - Supporting text goes here\n`;

  const purposesDir = join(targetDir, 'purposes');
  mkdirSync(purposesDir, { recursive: true });
  writeFileSync(join(purposesDir, 'starter.purpose'), purpose, 'utf-8');
  console.log(`  \u2713 purposes/starter.purpose`);

  console.log(`
  Your brand is scaffolded. Next steps:
  - Edit ${brandId}.identity \u2014 add narratives, values, and audiences
  - Edit ${brandId}.brand \u2014 refine colors, add themes, typography styles
  - Replace purposes/starter.purpose with real content purposes
  - Add formats/ and compositions/ when you\u2019re ready for layout`);
}

async function collectList() {
  const items = [];
  while (true) {
    const line = await ask('  - ');
    if (!line.trim()) break;
    items.push(line.trim());
  }
  return items;
}

async function collectAudiences() {
  const audiences = [];
  while (true) {
    const id = await input('Audience ID (e.g. "regulars", empty to stop)');
    if (!id) break;
    const label = await input(`  Label for "${id}"`);
    const profile = await input('  Profile (demographics, behavior)');
    const motivation = await input('  Motivation');
    const language = await input('  Language style');
    audiences.push({ id, label: label || id, profile, motivation, language });
    console.log('');
  }
  return audiences;
}

// ── Interactive init flow ──

async function interactiveInit() {
  console.log('  Brand Intent \u2014 What a brand means. Authored, structured, shared.\n');

  const folder = await input('Project folder');
  if (!folder) {
    console.error('\n  A project folder is required.\n');
    process.exit(1);
  }

  const targetDir = resolve(process.cwd(), folder);

  const mode = await choose('How do you want to start?', [
    { label: 'Explore the example', value: 'explore' },
    { label: 'Create your own brand', value: 'create' },
    { label: 'Just install the AI skill', value: 'skill-only' },
  ]);

  // Create project directory
  mkdirSync(targetDir, { recursive: true });
  console.log('');

  if (mode === 'explore') {
    scaffoldExample(targetDir);
  } else if (mode === 'create') {
    await scaffoldOwnBrand(targetDir);
  }

  // Always install skills — they're the infrastructure
  console.log('');
  await installSkills(targetDir);

  closeRl();
  console.log('\n  Done. Happy branding.\n');
}

// ── CLI entry point ──

const args = process.argv.slice(2);
const command = args[0];

const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf-8'));
console.log(`Brand Intent v${pkg.version}\n`);

switch (command) {
  case 'install-skills':
    await installSkills(process.cwd());
    closeRl();
    break;

  case 'init':
    await interactiveInit();
    break;

  default:
    if (command && command !== '--help' && command !== '-h') {
      console.log(`  Unknown command: ${command}\n`);
    }
    console.log('Usage:');
    console.log('  brand-intent init              Guided setup \u2014 explore the example or create your own brand');
    console.log('  brand-intent install-skills     Install Brand Intent skill for your AI harness');
    console.log('');
    console.log('Example:');
    console.log('  npx brand-intent init');
    break;
}
