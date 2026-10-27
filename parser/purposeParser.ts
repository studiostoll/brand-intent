/**
 * Parser for .purpose definition files.
 *
 * Strict, line-based format. Every line must match a known pattern or be blank.
 * Throws on parse errors with file name and line number.
 */

import type { SlotId } from './types';
import { parseIconRef, parseListItem } from './icons';
import type { IconRef } from './icons';
import { SAMPLE_WINDOW_MARKER } from './dateWindows';

// ── Parsed types ──────────────────────────────────────────────────────────────

export type Density = 'light' | 'medium' | 'full';
export type ListMarker = 'none' | 'counter' | 'icon';

export interface ParsedPurpose {
  id: string;
  name: string;
  description: string;
  preferredCompositions: string[];
  slots: ParsedPurposeSlot[];
  /** Content density — how much content this purpose typically carries. */
  density?: Density;
  /** Scope — narrows the composed upstream (audience, pillars). */
  scope?: { audience?: string[]; pillars?: string };
  /** Context — purpose-specific slot guidance (free-form text). */
  context?: string;
  /** Voice hints — purpose-specific writing rules for AI text generation. */
  voice?: Record<string, string>;
  /** Palette strategy: 'dynamic' (default), a theme name, or 'rotate T1, T2'. */
  palette?: string;
  /** Default logo asset ID — pre-selects this logo on page creation. */
  defaultLogo?: string;
  /** Default photo asset ID — pre-selects this photo on page creation. */
  defaultPhoto?: string;
  /** Default video asset ID — pre-selects this video on page creation. */
  defaultVideo?: string;
  /** When false, hides Take Photo / Upload buttons for this purpose. Default: true. */
  camera?: boolean;
  /** `camera: front | rear` — overrides the brand's camera facing for this purpose. */
  cameraFacing?: 'front' | 'rear';
  /** `framing: <id>` — the brand framing module photos for this purpose are shot in. */
  framing?: string;
  /** `goal: <id>` — the identity goal this purpose serves by default. */
  goal?: string;
  /** When false, photo/video analysis skips this purpose (no AI text generation). Default: true. */
  analyze?: boolean;
  /** Default icon for the icon slot. Resolves in the brand set first, then Phosphor (see resolveIconRef). */
  defaultIcon?: IconRef;
  /** Optional prompt text shown in the empty background placeholder. Default: "Select a background". */
  bgPrompt?: string;
  /** Example pages: all texts of one page written together, one topic each. Built from deprecated
   *  slot `samples:` (paired by position, `legacy: true`) when the file has no `example` blocks. */
  examples: ParsedExample[];
  /** Deprecations and other non-fatal findings, as "file:line: message". Implementations show them. */
  warnings: string[];
}

/** One `example` block: a whole page about one topic. */
export interface ParsedExample {
  /** What the page is about, one sentence. Becomes the page topic. */
  topic?: string;
  /** Identity goal id; overrides the purpose `goal:` for this page. */
  goal?: string;
  /** Date window name from the `.brand` `windows` block; undefined = all year. */
  when?: string;
  /** Text per slot. List items are newline-separated. Slots with `value:` never appear. */
  texts: Partial<Record<SlotId, string>>;
  /** True when built from deprecated slot `samples:`. */
  legacy?: boolean;
}

export interface ParsedPurposeSlot {
  id: SlotId;
  label: string;
  /** @deprecated Slot `samples:` from older files; content lives in `ParsedPurpose.examples`.
   *  Empty for files with `example` blocks; `[value]` for a fixed-value slot. */
  samples: string[];
  /** @deprecated Date window per legacy sample (parallel to `samples`), from a trailing `@name` marker. */
  sampleWindows?: (string | undefined)[];
  /** Fixed value — when set, this slot is never AI-generated or shuffled. Never part of an example. */
  value?: string;
  maxLength: number;
  /** Editorial word range (`words: 3..8`). Guidance on top of the hard `maxLength`. */
  words?: CountRange;
  /** Editorial sentence range (`sentences: 1..2`). Guidance on top of the hard `maxLength`. */
  sentences?: CountRange;
  /** 'text' (default) or 'list'. */
  slotType?: 'text' | 'list';
  /** Max number of items (list slots only). */
  maxItems?: number;
  /** List item marker (list slots only). Default: 'none'. */
  marker?: ListMarker;
  /** Default icon for `marker: icon` items without an `[id]` prefix (list slots only). */
  defaultIcon?: IconRef;
  /** Icon-only list — icons fill available space, text is suppressed. Implies `marker: icon`. */
  iconOnly?: boolean;
  /** Space between marker and text, in em (list slots only). Default: 0.4 */
  iconGap?: number;
  /** Gap between list items in em. Default: 0.5 */
  itemGap?: number;
  /** List layout direction: 'vertical' (default) or 'horizontal'. */
  listDirection?: 'vertical' | 'horizontal';
  /** When false, this slot is locked — users cannot edit it in any mode. Default: true (editable). */
  editable?: boolean;
  typography: {
    fontFamily: string;
    fontWeight: number;
    fontSizeBase: number;
    lineHeight: number;
    letterSpacing?: number;
    opticalSize?: number;
  };
  /** Name of the brand typography style this slot references (e.g. 'headline'). */
  typographyRef?: string;
  /** Brand color token this slot uses (e.g. 'text-primary', 'text-tertiary'). */
  colorRef?: string;
  /** Explicit per-slot overrides on top of typographyRef. */
  typographyOverrides?: Partial<{
    weight: number;
    size: number;
    opsz: number;
    lineHeight: number;
    letterSpacing: number;
    italic: boolean;
    uppercase: boolean;
    autofitMin: number;
    autofitMax: number;
    textAlign: 'left' | 'center' | 'right' | 'justify';
    /** true = hyphenate freely (body text); 'fit' = only when a word doesn't fit at autofit-min. */
    hyphenate: boolean | 'fit';
  }>;
}

/** Inclusive count range; `words: 3` is { min: 3, max: 3 }. */
export interface CountRange {
  min: number;
  max: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_SLOTS = new Set<string>(['primary', 'secondary', 'detail', 'meta', 'cta', 'label']);

/** Map short font family names to CSS font-family strings. */
function resolveFontFamily(name: string): string {
  return `'${name}', sans-serif`;
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parsePurposeFile(content: string, fileName: string): ParsedPurpose {
  const lines = content.split('\n');

  let id = '';
  let name = '';
  let description = '';
  let compositions: string[] | null = null;
  let scope: { audience?: string[]; pillars?: string } | undefined;
  let context: string | undefined;
  let inScopeBlock = false;
  let inContextBlock = false;
  let inVoiceBlock = false;
  const contextLines: string[] = [];
  let voice: Record<string, string> | undefined;
  let palette: string | undefined;
  let density: Density | undefined;
  let defaultLogo: string | undefined;
  let defaultPhoto: string | undefined;
  let defaultVideo: string | undefined;
  let camera: boolean | undefined;
  let cameraFacing: 'front' | 'rear' | undefined;
  let framing: string | undefined;
  let goal: string | undefined;
  let analyze: boolean | undefined;
  let defaultIcon: IconRef | undefined;
  let bgPrompt: string | undefined;
  const slots: ParsedPurposeSlot[] = [];
  const warnings: string[] = [];
  const examples: (ParsedExample & { line: number; keyLines: Partial<Record<string, number>> })[] = [];
  // Example block being built, and the slot key whose multi-line value is being read (4-space lines)
  let currentExample: (typeof examples)[number] | null = null;
  let exampleMultiKey: SlotId | null = null;
  // First line of a deprecated slot `samples:` (0 = none)
  let legacySamplesLine = 0;
  // For backward compat: track first # line text for fallback id
  let firstHashText = '';

  // Current slot being built (null when not inside a slot block)
  let currentSlot: Partial<ParsedPurposeSlot> & { id?: SlotId } | null = null;
  // Whether we're currently inside an override: block (4-space indent)
  let inOverrideBlock = false;
  // Whether we're currently inside a type: list sub-block (4-space indent)
  let inListBlock = false;
  // Multi-line samples state: 'slot' (2-space context) or 'list' (4-space context)
  let inMultiLineSamples: 'slot' | 'list' | false = false;

  function finalizeSlot(lineNum: number) {
    if (!currentSlot) return;
    const s = currentSlot;
    if (!s.id) throw new Error(`${fileName}:${lineNum}: slot missing id`);
    if (!s.label) throw new Error(`${fileName}:${lineNum}: slot "${s.id}" missing label`);
    if (!s.maxLength) throw new Error(`${fileName}:${lineNum}: slot "${s.id}" missing maxLength`);
    if (s.iconOnly) {
      if (s.marker && s.marker !== 'icon') throw new Error(`${fileName}:${lineNum}: slot "${s.id}": iconOnly needs "marker: icon", got "${s.marker}"`);
      s.marker = 'icon';
    }
    if (s.defaultIcon && s.marker !== 'icon') throw new Error(`${fileName}:${lineNum}: slot "${s.id}": defaultIcon needs "marker: icon"`);
    if (!s.value && s.samples) {
      // Trailing `@name` window marker, on the sample's first line only
      const windows = s.samples.map((sample, i) => {
        const [first, ...rest] = sample.split('\n');
        if (rest.some(l => SAMPLE_WINDOW_MARKER.test(l))) throw new Error(`${fileName}:${lineNum}: slot "${s.id}": window marker belongs on the sample's first line ("${rest.find(l => SAMPLE_WINDOW_MARKER.test(l))}")`);
        const m = first.match(SAMPLE_WINDOW_MARKER);
        if (!m) return undefined;
        s.samples![i] = [first.slice(0, m.index).trimEnd(), ...rest].join('\n');
        return m[1];
      });
      if (windows.some(Boolean)) s.sampleWindows = windows;
    }
    if (s.slotType === 'list') {
      for (const sample of s.samples ?? []) {
        for (const item of sample.split('\n')) {
          const { icon } = parseListItem(item);
          if (icon && s.marker !== 'icon') throw new Error(`${fileName}:${lineNum}: slot "${s.id}": sample item "${item}" names an icon, but the list has no "marker: icon"`);
        }
      }
    }
    const t = s.typography as ParsedPurposeSlot['typography'];
    if (!s.typographyRef) {
      // Legacy direct font: path — all fields required
      if (!t?.fontFamily) throw new Error(`${fileName}:${lineNum}: slot "${s.id}" must have either "font:" or "typography:" (neither found)`);
      if (!t.fontSizeBase) throw new Error(`${fileName}:${lineNum}: slot "${s.id}" missing size`);
      if (!t.lineHeight) throw new Error(`${fileName}:${lineNum}: slot "${s.id}" missing lineHeight`);
    }
    inOverrideBlock = false;
    inListBlock = false;
    inMultiLineSamples = false;
    slots.push(s as ParsedPurposeSlot);
    currentSlot = null;
  }

  function finalizeExample() {
    currentExample = null;
    exampleMultiKey = null;
  }

  /** A top-level line closes the open slot or example block. */
  function closeBlocks(lineNum: number) {
    finalizeSlot(lineNum);
    finalizeExample();
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const raw = lines[i];
    const line = raw.trim();

    // Blank line
    if (line === '') continue;

    // Comment — ALL # lines go to description now
    if (line.startsWith('#')) {
      const text = line.slice(1).trim();
      if (!firstHashText) firstHashText = text;
      description = description ? `${description} ${text}` : text;
      continue;
    }

    // id: field
    if (line.startsWith('id:')) {
      id = line.slice(3).trim();
      continue;
    }

    // name: field
    if (line.startsWith('name:')) {
      name = line.slice(5).trim();
      continue;
    }

    // scope block header
    if (line === 'scope' && !raw.startsWith(' ')) {
      closeBlocks(lineNum);
      inScopeBlock = true;
      inContextBlock = false;
      inVoiceBlock = false;
      scope = scope ?? {};
      continue;
    }

    // context block header
    if (line === 'context' && !raw.startsWith(' ')) {
      closeBlocks(lineNum);
      inContextBlock = true;
      inScopeBlock = false;
      inVoiceBlock = false;
      continue;
    }

    // voice block header
    if (line === 'voice' && !raw.startsWith(' ')) {
      closeBlocks(lineNum);
      inVoiceBlock = true;
      inScopeBlock = false;
      inContextBlock = false;
      voice = voice ?? {};
      continue;
    }

    // example block header: one whole page
    if (line === 'example' && !raw.startsWith(' ')) {
      closeBlocks(lineNum);
      inScopeBlock = inContextBlock = inVoiceBlock = false;
      currentExample = { texts: {}, line: lineNum, keyLines: {} };
      examples.push(currentExample);
      continue;
    }

    // example block lines: `key: value`, or bare `key:` followed by 4-space lines (list items, line breaks)
    if (currentExample && raw.startsWith('  ')) {
      if (raw.startsWith('    ')) {
        if (!exampleMultiKey) throw new Error(`${fileName}:${lineNum}: unexpected "${line}" in example (multi-line text follows a bare "slot:" line)`);
        const prev = currentExample.texts[exampleMultiKey];
        currentExample.texts[exampleMultiKey] = prev ? `${prev}\n${line}` : line;
        continue;
      }
      exampleMultiKey = null;
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: expected "key: value" in example, got "${line}"`);
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      if (key in currentExample.keyLines) throw new Error(`${fileName}:${lineNum}: duplicate "${key}" in example`);
      currentExample.keyLines[key] = lineNum;
      if (key === 'topic' || key === 'goal' || key === 'when') {
        if (!value) throw new Error(`${fileName}:${lineNum}: empty ${key}`);
        if (key === 'when' && !/^[a-z][a-z0-9-]*$/.test(value)) throw new Error(`${fileName}:${lineNum}: invalid window name "${value}" (lowercase kebab-case)`);
        currentExample[key] = value;
        continue;
      }
      if (!VALID_SLOTS.has(key)) throw new Error(`${fileName}:${lineNum}: unknown example key "${key}" (expected topic, goal, when or a slot id)`);
      if (value) currentExample.texts[key as SlotId] = value;
      else exampleMultiKey = key as SlotId;
      continue;
    } else if (currentExample && !raw.startsWith(' ')) {
      finalizeExample();
    }

    // scope block properties (2-space indent)
    if (inScopeBlock && raw.startsWith('  ') && !raw.startsWith('    ')) {
      if (line.startsWith('audience:')) {
        scope = scope ?? {};
        scope.audience = line.slice(9).trim().split(/[\s,]+/).filter(s => s.length > 0);
      } else if (line.startsWith('pillars:')) {
        scope = scope ?? {};
        scope.pillars = line.slice(8).trim();
      }
      continue;
    } else if (inScopeBlock && !raw.startsWith(' ')) {
      inScopeBlock = false;
    }

    // voice block properties (2-space indent, key: value)
    if (inVoiceBlock && raw.startsWith('  ') && !raw.startsWith('    ')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        voice = voice ?? {};
        voice[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
      }
      continue;
    } else if (inVoiceBlock && !raw.startsWith(' ')) {
      inVoiceBlock = false;
    }

    // context block lines (2-space indent, free-form text)
    if (inContextBlock && raw.startsWith('  ')) {
      contextLines.push(line);
      continue;
    } else if (inContextBlock && !raw.startsWith(' ')) {
      inContextBlock = false;
    }

    if (line.startsWith('compositions:')) {
      const colonIdx = line.indexOf(':');
      const value = line.slice(colonIdx + 1).trim();
      compositions = value.split(/[\s,]+/).map(s => s.trim()).filter(s => s.length > 0);
      if (compositions.length === 0) throw new Error(`${fileName}:${lineNum}: empty compositions list`);
      continue;
    }

    // Palette strategy
    if (line.startsWith('palette:')) {
      palette = line.slice(8).trim();
      continue;
    }

    // Content density
    if (line.startsWith('density:')) {
      const value = line.slice(8).trim() as Density;
      if (!['light', 'medium', 'full'].includes(value)) throw new Error(`${fileName}:${lineNum}: invalid density "${value}" — expected light, medium, or full`);
      density = value;
      continue;
    }

    // Default logo asset ID
    if (line.startsWith('logo:')) {
      defaultLogo = line.slice(5).trim();
      continue;
    }

    // Default photo asset ID
    if (line.startsWith('photo:')) {
      defaultPhoto = line.slice(6).trim();
      continue;
    }

    // Default video asset ID
    if (line.startsWith('video:')) {
      defaultVideo = line.slice(6).trim();
      continue;
    }

    // Camera control
    if (line.startsWith('camera:')) {
      const value = line.slice(7).trim();
      camera = value !== 'false';
      if (value === 'front' || value === 'rear') cameraFacing = value;
      continue;
    }

    // Framing module: one of the brand's `framing NAME` blocks
    if (line.startsWith('framing:')) {
      framing = line.slice(8).trim() || undefined;
      continue;
    }

    // Goal: one of the identity's `goal NAME` blocks
    if (line.startsWith('goal:') && !raw.startsWith(' ')) {
      goal = line.slice(5).trim() || undefined;
      continue;
    }

    // Photo/video analysis control
    if (line.startsWith('analyze:')) {
      analyze = line.slice(8).trim() !== 'false';
      continue;
    }

    // Background placeholder prompt: "bg-prompt: Mach dein Selfie"
    if (line.startsWith('bg-prompt:')) {
      bgPrompt = line.slice(10).trim().replace(/^["']|["']$/g, '');
      continue;
    }

    // Default icon: "defaultIcon: quote", "defaultIcon: phosphor:warning-circle duotone"
    if (line.startsWith('defaultIcon:') && !raw.startsWith(' ')) {
      defaultIcon = parseIconRef(line.slice(12), `${fileName}:${lineNum}`);
      continue;
    }

    // Backward compat: "icon: warning-circle" (deprecated — use defaultIcon:)
    if (line.startsWith('icon:') && !raw.startsWith(' ')) {
      warnings.push(`${fileName}:${lineNum}: deprecated "icon:" — use "defaultIcon:" instead`);
      defaultIcon = parseIconRef(line.slice(5), `${fileName}:${lineNum}`);
      continue;
    }

    // Slot start
    if (line.startsWith('slot ')) {
      closeBlocks(lineNum);
      const slotId = line.slice(5).trim();
      if (!VALID_SLOTS.has(slotId)) throw new Error(`${fileName}:${lineNum}: unknown slot "${slotId}"`);
      currentSlot = { id: slotId as SlotId, samples: [], typography: {} as ParsedPurposeSlot['typography'] };
      continue;
    }

    // Multi-line samples: continuation lines after a bare `samples:` line
    if (inMultiLineSamples && currentSlot) {
      const baseIndent = inMultiLineSamples === 'list' ? 6 : 4;
      const contIndent = baseIndent + 2;
      const isVariantLine = raw.length >= baseIndent && raw.slice(0, baseIndent) === ' '.repeat(baseIndent) && raw[baseIndent] === '-' && raw[baseIndent + 1] === ' ';
      const isContLine = raw.length > contIndent && raw.slice(0, contIndent) === ' '.repeat(contIndent) && raw[contIndent] !== '-';

      if (isVariantLine) {
        // "- text" starts a new sample variant
        const text = raw.slice(baseIndent + 2).trim();
        if (!text) throw new Error(`${fileName}:${lineNum}: empty sample variant`);
        currentSlot.samples!.push(text);
        continue;
      }
      if (isContLine && currentSlot.samples!.length > 0) {
        // Continuation line — append to the last sample variant with \n
        const text = raw.slice(contIndent).trim();
        if (!text) throw new Error(`${fileName}:${lineNum}: empty sample continuation line`);
        currentSlot.samples![currentSlot.samples!.length - 1] += '\n' + text;
        continue;
      }
      // Not a sample line — end multi-line mode and fall through
      inMultiLineSamples = false;
    }

    // 4-space indent: sub-block properties (override: or type: list)
    if (raw.startsWith('    ') && currentSlot && (inOverrideBlock || inListBlock)) {
      const prop = line;
      if (inOverrideBlock) {
        if (!currentSlot.typographyRef) throw new Error(`${fileName}:${lineNum}: "override:" block requires "typography:" on the slot`);
        if (!currentSlot.typographyOverrides) currentSlot.typographyOverrides = {};
        if (prop.startsWith('weight:')) {
          const n = parseInt(prop.slice(7).trim(), 10);
          if (isNaN(n) || n < 1 || n > 999) throw new Error(`${fileName}:${lineNum}: invalid weight "${prop.slice(7).trim()}"`);
          currentSlot.typographyOverrides.weight = n;
          continue;
        }
        if (prop.startsWith('size:')) {
          const n = parseFloat(prop.slice(5).trim());
          if (isNaN(n) || n <= 0) throw new Error(`${fileName}:${lineNum}: invalid size "${prop.slice(5).trim()}"`);
          currentSlot.typographyOverrides.size = n;
          continue;
        }
        if (prop.startsWith('lineHeight:')) {
          const n = parseFloat(prop.slice(11).trim());
          if (isNaN(n) || n <= 0) throw new Error(`${fileName}:${lineNum}: invalid lineHeight "${prop.slice(11).trim()}"`);
          currentSlot.typographyOverrides.lineHeight = n;
          continue;
        }
        if (prop.startsWith('letterSpacing:')) {
          const n = parseFloat(prop.slice(14).trim());
          if (isNaN(n)) throw new Error(`${fileName}:${lineNum}: invalid letterSpacing "${prop.slice(14).trim()}"`);
          currentSlot.typographyOverrides.letterSpacing = n;
          continue;
        }
        if (prop.startsWith('opsz:')) {
          const n = parseFloat(prop.slice(5).trim());
          if (isNaN(n)) throw new Error(`${fileName}:${lineNum}: invalid opsz "${prop.slice(5).trim()}"`);
          currentSlot.typographyOverrides.opsz = n;
          continue;
        }
        if (prop === 'italic' || prop === 'italic: true') { currentSlot.typographyOverrides.italic = true; continue; }
        if (prop === 'italic: false') { currentSlot.typographyOverrides.italic = false; continue; }
        if (prop === 'uppercase' || prop === 'uppercase: true') { currentSlot.typographyOverrides.uppercase = true; continue; }
        if (prop === 'uppercase: false') { currentSlot.typographyOverrides.uppercase = false; continue; }
        if (prop === 'hyphenate' || prop === 'hyphenate: true') { currentSlot.typographyOverrides.hyphenate = true; continue; }
        if (prop === 'hyphenate: false') { currentSlot.typographyOverrides.hyphenate = false; continue; }
        if (prop === 'hyphenate: fit') { currentSlot.typographyOverrides.hyphenate = 'fit'; continue; }
        if (prop === 'autofit: none' || prop === 'autofit:none') {
          currentSlot.typographyOverrides.autofitMin = -1;
          currentSlot.typographyOverrides.autofitMax = -1;
          continue;
        }
        if (prop.startsWith('autofit-min:')) {
          const n = parseFloat(prop.slice(12).trim());
          if (isNaN(n)) throw new Error(`${fileName}:${lineNum}: invalid autofit-min "${prop.slice(12).trim()}"`);
          currentSlot.typographyOverrides.autofitMin = n;
          continue;
        }
        if (prop.startsWith('autofit-max:')) {
          const n = parseFloat(prop.slice(12).trim());
          if (isNaN(n)) throw new Error(`${fileName}:${lineNum}: invalid autofit-max "${prop.slice(12).trim()}"`);
          currentSlot.typographyOverrides.autofitMax = n;
          continue;
        }
        if (prop.startsWith('textAlign:')) {
          const v = prop.slice(10).trim();
          if (v !== 'left' && v !== 'center' && v !== 'right' && v !== 'justify') {
            throw new Error(`${fileName}:${lineNum}: invalid textAlign "${v}" — expected left, center, right, or justify`);
          }
          currentSlot.typographyOverrides.textAlign = v;
          continue;
        }
        throw new Error(`${fileName}:${lineNum}: unknown override property "${prop}"`);
      }
      if (inListBlock) {
        if (prop.startsWith('maxItems:')) {
          const n = parseInt(prop.slice(9).trim(), 10);
          if (isNaN(n) || n <= 0) throw new Error(`${fileName}:${lineNum}: invalid maxItems "${prop.slice(9).trim()}"`);
          currentSlot.maxItems = n;
          continue;
        }
        if (prop.startsWith('maxLength:')) {
          const n = parseInt(prop.slice(10).trim(), 10);
          if (isNaN(n) || n <= 0) throw new Error(`${fileName}:${lineNum}: invalid maxLength "${prop.slice(10).trim()}"`);
          currentSlot.maxLength = n;
          continue;
        }
        if (prop.startsWith('samples:')) {
          legacySamplesLine ||= lineNum;
          const raw = prop.slice(8).trim();
          if (!raw) {
            // Bare `samples:` — enter multi-line mode
            currentSlot.samples = [];
            inMultiLineSamples = 'list';
            continue;
          }
          currentSlot.samples = raw.split('|').map(s => s.trim().replace(/\\n/g, '\n'));
          continue;
        }
        if (prop.startsWith('marker:')) {
          const m = prop.slice(7).trim();
          if (m !== 'none' && m !== 'counter' && m !== 'icon') throw new Error(`${fileName}:${lineNum}: invalid marker "${m}" — must be "none", "counter" or "icon"`);
          currentSlot.marker = m;
          continue;
        }
        if (prop.startsWith('defaultIcon:')) {
          currentSlot.defaultIcon = parseIconRef(prop.slice(12), `${fileName}:${lineNum}`);
          continue;
        }
        if (prop === 'icons: true' || prop === 'icons:true') {
          warnings.push(`${fileName}:${lineNum}: deprecated "icons: true" — use "marker: counter" or "marker: icon"`);
          currentSlot.marker = currentSlot.marker ?? 'counter';
          continue;
        }
        if (prop === 'icons: false' || prop === 'icons:false') {
          warnings.push(`${fileName}:${lineNum}: deprecated "icons: false" — use "marker: none"`);
          currentSlot.marker = currentSlot.marker ?? 'none';
          continue;
        }
        if (prop === 'iconOnly: true' || prop === 'iconOnly:true') { currentSlot.iconOnly = true; continue; }
        if (prop.startsWith('iconGap:')) {
          const n = parseFloat(prop.slice(8).trim());
          if (isNaN(n) || n < 0) throw new Error(`${fileName}:${lineNum}: invalid iconGap "${prop.slice(8).trim()}"`);
          currentSlot.iconGap = n;
          continue;
        }
        if (prop.startsWith('itemGap:')) {
          const n = parseFloat(prop.slice(8).trim());
          if (isNaN(n) || n < 0) throw new Error(`${fileName}:${lineNum}: invalid itemGap "${prop.slice(8).trim()}"`);
          currentSlot.itemGap = n;
          continue;
        }
        if (prop.startsWith('direction:')) {
          const d = prop.slice(10).trim();
          if (d !== 'vertical' && d !== 'horizontal') throw new Error(`${fileName}:${lineNum}: invalid list direction "${d}" — must be "vertical" or "horizontal"`);
          currentSlot.listDirection = d;
          continue;
        }
        throw new Error(`${fileName}:${lineNum}: unknown list property "${prop}"`);
      }
    }

    // 2-space indent: slot properties (must be inside a slot block)
    if (raw.startsWith('  ') && currentSlot) {
      const prop = line;

      if (prop === 'override:') {
        if (!currentSlot.typographyRef) throw new Error(`${fileName}:${lineNum}: "override:" block requires "typography:" on the slot`);
        inOverrideBlock = true;
        inListBlock = false;
        continue;
      }
      if (prop.startsWith('type:')) {
        const t = prop.slice(5).trim();
        if (t !== 'text' && t !== 'list') throw new Error(`${fileName}:${lineNum}: invalid slot type "${t}" — must be "text" or "list"`);
        currentSlot.slotType = t;
        inListBlock = t === 'list';
        inOverrideBlock = false;
        continue;
      }
      // Any other 2-space line ends sub-blocks
      inOverrideBlock = false;
      inListBlock = false;
      inMultiLineSamples = false;

      if (prop.startsWith('label:')) {
        currentSlot.label = prop.slice(6).trim();
        continue;
      }
      if (prop.startsWith('value:')) {
        const val = prop.slice(6).trim();
        if (!val) throw new Error(`${fileName}:${lineNum}: empty value`);
        currentSlot.value = val;
        // value implies a single-entry samples array for backward compat
        currentSlot.samples = [val];
        continue;
      }
      if (prop.startsWith('samples:')) {
        legacySamplesLine ||= lineNum;
        const raw = prop.slice(8).trim();
        if (!raw) {
          // Bare `samples:` — enter multi-line mode
          currentSlot.samples = [];
          inMultiLineSamples = 'slot';
          continue;
        }
        currentSlot.samples = raw.split('|').map(s => s.trim().replace(/\\n/g, '\n'));
        continue;
      }
      if (prop.startsWith('maxLength:')) {
        const n = parseInt(prop.slice(10).trim(), 10);
        if (isNaN(n) || n <= 0) throw new Error(`${fileName}:${lineNum}: invalid maxLength "${prop.slice(10).trim()}"`);
        currentSlot.maxLength = n;
        continue;
      }
      if (prop.startsWith('words:') || prop.startsWith('sentences:')) {
        const key = prop.startsWith('words:') ? 'words' : 'sentences';
        const v = prop.slice(key.length + 1).trim();
        const m = v.match(/^(\d+)(?:\.\.(\d+))?$/);
        const range = m ? { min: parseInt(m[1], 10), max: parseInt(m[2] ?? m[1], 10) } : null;
        if (!range || range.min <= 0 || range.max < range.min) throw new Error(`${fileName}:${lineNum}: invalid ${key} "${v}" — expected N or MIN..MAX`);
        currentSlot[key] = range;
        continue;
      }
      if (prop.startsWith('typography:')) {
        currentSlot.typographyRef = prop.slice(11).trim();
        continue;
      }
      if (prop.startsWith('color:')) {
        currentSlot.colorRef = prop.slice(6).trim();
        continue;
      }
      if (prop === 'editable' || prop === 'editable: true' || prop === 'editable:true') { currentSlot.editable = true; continue; }
      if (prop === 'editable: false' || prop === 'editable:false') { currentSlot.editable = false; continue; }
      if (prop.startsWith('font:')) {
        // "Die Grotesk 800" → family="Die Grotesk", weight=800  (legacy direct path)
        const value = prop.slice(5).trim();
        const lastSpace = value.lastIndexOf(' ');
        if (lastSpace === -1) throw new Error(`${fileName}:${lineNum}: font must be "FAMILY WEIGHT" (e.g. "Die Grotesk 800")`);
        const familyName = value.slice(0, lastSpace);
        const weight = parseInt(value.slice(lastSpace + 1), 10);
        if (isNaN(weight) || weight < 1 || weight > 999) throw new Error(`${fileName}:${lineNum}: invalid font weight "${value.slice(lastSpace + 1)}"`);
        currentSlot.typography!.fontFamily = resolveFontFamily(familyName);
        currentSlot.typography!.fontWeight = weight;
        continue;
      }
      if (prop.startsWith('size:')) {
        const n = parseFloat(prop.slice(5).trim());
        if (isNaN(n) || n <= 0) throw new Error(`${fileName}:${lineNum}: invalid size "${prop.slice(5).trim()}"`);
        currentSlot.typography!.fontSizeBase = n;
        continue;
      }
      if (prop.startsWith('align:')) {
        // Ignored — textAlign is a layout concern, defined in .composition files
        continue;
      }
      if (prop.startsWith('lineHeight:')) {
        const n = parseFloat(prop.slice(11).trim());
        if (isNaN(n) || n <= 0) throw new Error(`${fileName}:${lineNum}: invalid lineHeight "${prop.slice(11).trim()}"`);
        currentSlot.typography!.lineHeight = n;
        continue;
      }
      if (prop.startsWith('letterSpacing:')) {
        const n = parseFloat(prop.slice(14).trim());
        if (isNaN(n)) throw new Error(`${fileName}:${lineNum}: invalid letterSpacing "${prop.slice(14).trim()}"`);
        currentSlot.typography!.letterSpacing = n;
        continue;
      }
      if (prop.startsWith('opsz:')) {
        const n = parseFloat(prop.slice(5).trim());
        if (isNaN(n)) throw new Error(`${fileName}:${lineNum}: invalid opsz "${prop.slice(5).trim()}"`);
        currentSlot.typography!.opticalSize = n;
        continue;
      }

      throw new Error(`${fileName}:${lineNum}: unknown slot property "${prop}"`);
    }

    // Unknown line
    throw new Error(`${fileName}:${lineNum}: unexpected "${line}"`);
  }

  // Finalize last block
  closeBlocks(lines.length);

  // Backward compat: if no id: line but we have a first # line, use it as id
  if (!id) {
    if (firstHashText) {
      warnings.push(`${fileName}: deprecated — add "id: ${firstHashText}" line (first # line used as fallback id)`);
      id = firstHashText;
    } else {
      throw new Error(`${fileName}: missing purpose id (add "id:" line)`);
    }
  }

  // Validate required fields
  if (!compositions) throw new Error(`${fileName}: missing "compositions:" line`);
  if (slots.length === 0) throw new Error(`${fileName}: no slots defined`);

  // Derive display name from id if not provided: capitalize first letter of each word
  if (!name) {
    name = id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  // Finalize context from block lines (if any)
  if (contextLines.length > 0 && !context) {
    context = contextLines.join('\n').trim();
  }

  const parsedExamples = resolveExamples(examples, slots, legacySamplesLine, fileName, warnings);

  return { id, name, description, preferredCompositions: compositions, slots, density, palette, scope, context, voice, defaultLogo, defaultPhoto, defaultVideo, camera, cameraFacing, framing, goal, analyze, defaultIcon, bgPrompt, examples: parsedExamples, warnings };
}

/** Validate `example` blocks against the declared slots, or build examples from deprecated slot
 *  `samples:` (paired by position) when the file has none. Mixing both is an error. */
function resolveExamples(
  examples: (ParsedExample & { line: number; keyLines: Partial<Record<string, number>> })[],
  slots: ParsedPurposeSlot[],
  legacySamplesLine: number,
  fileName: string,
  warnings: string[],
): ParsedExample[] {
  const byId = new Map(slots.map(s => [s.id, s]));
  const contentSlots = slots.filter(s => !s.value && !s.iconOnly);

  if (examples.length > 0) {
    if (legacySamplesLine) throw new Error(`${fileName}:${legacySamplesLine}: slot "samples:" next to "example" blocks — move the texts into the examples`);
    for (const ex of examples) {
      const at = (key: string) => `${fileName}:${ex.keyLines[key] ?? ex.line}`;
      const filled = Object.keys(ex.texts) as SlotId[];
      if (filled.length === 0) throw new Error(`${fileName}:${ex.line}: example without slot texts`);
      for (const slotId of filled) {
        const slot = byId.get(slotId);
        if (!slot) throw new Error(`${at(slotId)}: example fills slot "${slotId}", which the purpose does not declare`);
        if (slot.value) throw new Error(`${at(slotId)}: slot "${slotId}" has a fixed value and takes no example text`);
        const text = ex.texts[slotId]!;
        if (text.split('\n').some(l => SAMPLE_WINDOW_MARKER.test(l))) throw new Error(`${at(slotId)}: window marker in example text — use "when:" on the example`);
        if (slot.slotType === 'list') {
          for (const item of text.split('\n')) {
            const { icon } = parseListItem(item);
            if (icon && slot.marker !== 'icon') throw new Error(`${at(slotId)}: slot "${slotId}": item "${item}" names an icon, but the list has no "marker: icon"`);
          }
        }
      }
    }
    for (const slot of contentSlots) {
      if (!examples.some(ex => ex.texts[slot.id])) throw new Error(`${fileName}: slot "${slot.id}" is filled by no example`);
    }
    return examples.map(({ line: _line, keyLines: _keyLines, ...ex }) => ex);
  }

  for (const slot of contentSlots) {
    if (slot.samples.length === 0) throw new Error(`${fileName}: slot "${slot.id}" has no text — add "example" blocks or a "value:"`);
  }
  if (!legacySamplesLine) return [];
  warnings.push(`${fileName}:${legacySamplesLine}: deprecated slot "samples:" — write whole pages as "example" blocks`);
  const sampled = slots.filter(s => !s.value && s.samples.length > 0);
  const count = Math.max(...sampled.map(s => s.samples.length));
  return Array.from({ length: count }, (_, i) => {
    const texts: Partial<Record<SlotId, string>> = {};
    let when: string | undefined;
    for (const slot of sampled) {
      const idx = i % slot.samples.length;
      texts[slot.id] = slot.samples[idx];
      when ??= slot.sampleWindows?.[idx];
    }
    return { texts, ...(when ? { when } : {}), legacy: true };
  });
}
