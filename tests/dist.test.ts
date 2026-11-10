/**
 * Tests for the built parser (dist/index.mjs): what the package's `exports` point at, so plain Node and
 * serverless functions can import it without a TypeScript loader.
 *
 * Run: npm test (builds it first)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as source from '../parser/index';

let pass = 0;
let fail = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve().then(fn).then(() => { pass++; }, err => { fail++; console.error(`FAIL: ${name}\n  ${err instanceof Error ? err.message : err}`); });
}

const built = pathToFileURL(resolve(__dirname, '../dist/index.mjs'));

async function main() {

await test('exports everything the source exports', async () => {
  const dist = await import(built.href);
  const missing = Object.keys(source).filter(k => !(k in dist));
  if (missing.length) throw new Error(`missing in dist: ${missing.join(', ')}`);
});

await test('needs no Node built-in, so it runs in a browser and on an edge runtime', () => {
  const text = readFileSync(built, 'utf8');
  const found = text.match(/from\s*["']node:[^"']+["']|require\(["'][^"']+["']\)/g);
  if (found) throw new Error(`imports ${found.join(', ')}`);
});

await test('parses a story like the source does', async () => {
  const dist = await import(built.href);
  const story = 'id: day\nformat: 4:5\n\npage\n  purpose: note\n\nprompt\n  model: haiku\n  Say what the weather means.\n';
  const a = JSON.stringify(dist.parseStoryFile(story, 'day.story'));
  const b = JSON.stringify(source.parseStoryFile(story, 'day.story'));
  if (a !== b) throw new Error(`dist: ${a}\nsource: ${b}`);
});

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
}

void main();
