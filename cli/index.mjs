#!/usr/bin/env node

import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, resolve, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_ROOT = resolve(__dirname, '..');

const SKILL_FILE = join(PKG_ROOT, 'skills', 'brand-intent.md');

// ── Harness detection and install paths ──

const HARNESS_DIRS = {
  claude:  '.claude/commands',
  cursor:  '.cursor/rules',
  gemini:  '.gemini',
  copilot: '.github/copilot-instructions',
};

function detectHarnesses(cwd) {
  const found = [];
  for (const [name, dir] of Object.entries(HARNESS_DIRS)) {
    // Check if the harness config directory exists (or parent does)
    const parent = dir.split('/')[0];
    if (existsSync(join(cwd, parent))) {
      found.push({ name, dir });
    }
  }
  return found;
}

// ── Commands ──

function installSkills(cwd) {
  if (!existsSync(SKILL_FILE)) {
    console.error('Error: skill file not found at', SKILL_FILE);
    process.exit(1);
  }

  const skill = readFileSync(SKILL_FILE, 'utf-8');
  const harnesses = detectHarnesses(cwd);

  if (harnesses.length === 0) {
    // No harness detected — install to .claude/ by default
    harnesses.push({ name: 'claude', dir: HARNESS_DIRS.claude });
  }

  let installed = 0;
  for (const { name, dir } of harnesses) {
    const target = join(cwd, dir);
    mkdirSync(target, { recursive: true });
    const dest = join(target, 'brand-intent.md');
    writeFileSync(dest, skill, 'utf-8');
    console.log(`  ✓ ${name} — ${dir}/brand-intent.md`);
    installed++;
  }

  console.log(`\nInstalled Brand Intent skill to ${installed} harness${installed > 1 ? 'es' : ''}.`);
}

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

function initFromBrand(brandName, cwd) {
  const brandSrc = join(PKG_ROOT, 'brands', brandName);
  if (!existsSync(brandSrc)) {
    console.error(`Error: brand "${brandName}" not found.`);
    console.error(`Available brands: ${readdirSync(join(PKG_ROOT, 'brands')).join(', ')}`);
    process.exit(1);
  }

  // Copy brand files
  const brandDest = join(cwd, `brands/${brandName}`);
  copyDirRecursive(brandSrc, brandDest);
  console.log(`  ✓ brand files → brands/${brandName}/`);

  // Copy shared layers (formats, purposes, compositions)
  for (const layer of ['formats', 'purposes', 'compositions']) {
    const layerSrc = join(PKG_ROOT, layer);
    if (existsSync(layerSrc) && readdirSync(layerSrc).length > 0) {
      const layerDest = join(cwd, layer);
      copyDirRecursive(layerSrc, layerDest);
      console.log(`  ✓ ${layer}/ → ${layer}/`);
    }
  }

  console.log(`\nScaffolded from "${brandName}". Edit the .identity and .brand files to make it yours.`);
}

function addBrand(brandRef, cwd) {
  // brandRef is "brandName/brand" — extract the brand name
  const brandName = brandRef.split('/')[0];
  const brandSrc = join(PKG_ROOT, 'brands', brandName);
  if (!existsSync(brandSrc)) {
    console.error(`Error: brand "${brandName}" not found.`);
    process.exit(1);
  }

  const brandDest = join(cwd, `brands/${brandName}`);
  copyDirRecursive(brandSrc, brandDest);
  console.log(`  ✓ brand files → brands/${brandName}/`);
  console.log(`\nAdded "${brandName}" brand files to your project.`);
}

// ── CLI entry point ──

const args = process.argv.slice(2);
const command = args[0];
const cwd = process.cwd();

console.log('Brand Intent v0.1.0\n');

switch (command) {
  case 'install-skills':
    installSkills(cwd);
    break;

  case 'init': {
    const fromIdx = args.indexOf('--from');
    if (fromIdx === -1 || !args[fromIdx + 1]) {
      console.error('Usage: brand-intent init --from <brand-name>');
      console.error('Example: brand-intent init --from krume');
      process.exit(1);
    }
    initFromBrand(args[fromIdx + 1], cwd);
    break;
  }

  case 'add': {
    if (!args[1]) {
      console.error('Usage: brand-intent add <brand-name>/brand');
      console.error('Example: brand-intent add krume/brand');
      process.exit(1);
    }
    addBrand(args[1], cwd);
    break;
  }

  default:
    console.log('Usage:');
    console.log('  brand-intent install-skills       Install Brand Intent skill for your AI harness');
    console.log('  brand-intent init --from <brand>   Scaffold a project from a reference brand');
    console.log('  brand-intent add <brand>/brand     Add a brand to an existing project');
    console.log('');
    console.log('Examples:');
    console.log('  npx brand-intent install-skills');
    console.log('  npx brand-intent init --from krume');
    console.log('  npx brand-intent add krume/brand');
    break;
}
