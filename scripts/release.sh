#!/bin/bash
set -euo pipefail

# ── Brand Intent release script ──
# Bumps version in both package.json files, commits, tags, pushes,
# then publishes to npm and VS Code Marketplace.
#
# Usage:  ./scripts/release.sh <patch|minor|major|x.y.z>
# Example: ./scripts/release.sh patch

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VSCE_DIR="$ROOT/vscode-extension"

# ── Validate input ──

BUMP="${1:-}"
if [ -z "$BUMP" ]; then
  echo "Usage: ./scripts/release.sh <patch|minor|major|x.y.z>"
  exit 1
fi

# ── Ensure clean working tree ──

if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
  echo "Error: working tree is not clean. Commit or stash changes first."
  exit 1
fi

# ── Read current version ──

CURRENT=$(node -p "require('$ROOT/package.json').version")
echo "Current version: $CURRENT"

# ── Calculate new version ──

if [[ "$BUMP" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  NEW="$BUMP"
else
  IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
  case "$BUMP" in
    patch) NEW="$MAJOR.$MINOR.$((PATCH + 1))" ;;
    minor) NEW="$MAJOR.$((MINOR + 1)).0" ;;
    major) NEW="$((MAJOR + 1)).0.0" ;;
    *) echo "Error: invalid bump type '$BUMP'. Use patch, minor, major, or x.y.z"; exit 1 ;;
  esac
fi

echo "New version:     $NEW"
echo ""

# ── Bump both package.json files ──

node -e "
  const fs = require('fs');
  for (const f of ['$ROOT/package.json', '$VSCE_DIR/package.json']) {
    const pkg = JSON.parse(fs.readFileSync(f, 'utf-8'));
    pkg.version = '$NEW';
    fs.writeFileSync(f, JSON.stringify(pkg, null, 2) + '\n');
    console.log('  ✓ ' + f.replace('$ROOT/', ''));
  }
"

# ── Commit, tag, push ──

git -C "$ROOT" add package.json vscode-extension/package.json
git -C "$ROOT" commit -m "release: v$NEW"
git -C "$ROOT" tag "v$NEW"
git -C "$ROOT" push
git -C "$ROOT" push --tags

echo ""
echo "Pushed v$NEW. Now publishing..."
echo ""

# ── Publish npm ──

echo "── npm publish ──"
cd "$ROOT"
npm publish
echo ""

# ── Publish VS Code extension ──

echo "── vsce publish ──"
cd "$VSCE_DIR"
npx @vscode/vsce publish
echo ""

echo "Done. v$NEW published to npm and VS Code Marketplace."
