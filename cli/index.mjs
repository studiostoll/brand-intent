#!/usr/bin/env node

import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_ROOT = resolve(__dirname, '..');

const SKILL_FILES = ['brand-intent.md', 'brief.md'];

// ── Harness detection ──

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

// ── Readline ──

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

function scaffoldExample(targetDir) {
  const src = join(PKG_ROOT, 'examples', 'krume');
  const dest = join(targetDir, 'examples', 'krume');
  copyDirRecursive(src, dest);
  console.log('  \u2713 examples/krume/ \u2014 reference implementation (identity, brand, format, purpose, composition)');
}

// ── Install skill ──

async function installSkills(cwd) {
  const skills = SKILL_FILES.map(name => {
    const path = join(PKG_ROOT, 'skills', name);
    if (!existsSync(path)) {
      console.error('Error: skill file not found at', path);
      process.exit(1);
    }
    return { name, content: readFileSync(path, 'utf-8') };
  });

  let harnesses = detectHarnesses(cwd);

  if (harnesses.length === 0) {
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
    for (const { name, content } of skills) {
      const dest = join(target, name);
      writeFileSync(dest, content, 'utf-8');
      console.log(`  ✓ ${label} — ${dir}/${name}`);
    }
  }

  return harnesses;
}

// ── CLI entry point ──

const args = process.argv.slice(2);
const command = args[0];
const cwd = process.cwd();

const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf-8'));
console.log(`Brand Intent v${pkg.version}\n`);

if (command && command !== 'init' && command !== 'install-skills' && command !== '--help' && command !== '-h') {
  console.log(`  Unknown command: ${command}\n`);
}

if (!command || command === '--help' || command === '-h') {
  console.log('Usage:');
  console.log('  brand-intent init              Install the Brand Intent and Brief skills for your AI agent');
  console.log('  brand-intent install-skills     Same as init (alias)');
  console.log('');
  console.log('Example:');
  console.log('  npx brand-intent init');
  process.exit(0);
}

// Ask for project folder
console.log('  Brand Intent \u2014 What a brand means. Authored, structured, shared.\n');
const folder = await ask('  Project folder (. for current directory): ');
const targetDir = resolve(cwd, folder.trim() || '.');
if (targetDir !== cwd) {
  mkdirSync(targetDir, { recursive: true });
}
console.log('\n  This will:');
console.log('  \u2014 Copy the Krume bakery reference into examples/krume/');
console.log('  \u2014 Install the Brand Intent and Brief skills for your AI agent\n');
const proceed = await ask('  Proceed? (Y/n) ');
if (proceed.trim().toLowerCase() === 'n') {
  closeRl();
  process.exit(0);
}
console.log('');

scaffoldExample(targetDir);
await installSkills(targetDir);
closeRl();

console.log('\n  Done. Now open your AI agent and try:\n');
console.log('    "Onboard my brand"');
console.log('    "Show me the Krume bakery example"');
console.log('\n  Skill commands:\n');
console.log('    /brand-intent onboard     Create your brand through a guided interview');
console.log('    /brand-intent example     Scaffold the Krume reference implementation');
console.log('    /brand-intent validate    Validate content against your brand rules');
console.log('    /brand-intent             Discover brand files and available purposes');
console.log('    /brief                    Generate a portable brand brief');
console.log('');
