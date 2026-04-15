/**
 * Parser for .purpose definition files.
 *
 * Strict, line-based format. Every line must match a known pattern or be blank.
 * Throws on parse errors with file name and line number.
 */

import type { SlotId } from './types';

// ── Parsed types ──────────────────────────────────────────────────────────────

export type Density = 'light' | 'medium' | 'full';

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
  /** Default icon (Phosphor PascalCase name, e.g. "ArrowRight"). */
  defaultIcon?: string;
  /** Default icon weight. */
  defaultIconWeight?: string;
  /** Optional prompt text shown in the empty background placeholder. Default: "Select a background". */
  bgPrompt?: string;
}

export interface ParsedPurposeSlot {
  id: SlotId;
  label: string;
  /** Sample text variants for this slot. Picked randomly on page creation. */
  samples: string[];
  maxLength: number;
  /** 'text' (default) or 'list'. */
  slotType?: 'text' | 'list';
  /** Max number of items (list slots only). */
  maxItems?: number;
  /** Whether per-item icons are supported (list slots only). */
  icons?: boolean;
  /** Icon-only list — icons fill available space, text is suppressed. */
  iconOnly?: boolean;
  /** Space between icon and text, in em (list slots only). Default: 0.4 */
  iconGap?: number;
  /** Gap between list items in em. Default: 0.5 */
  itemGap?: number;
  /** List layout direction: 'vertical' (default) or 'horizontal'. */
  listDirection?: 'vertical' | 'horizontal';
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
    hyphenate: boolean;
  }>;
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
  let defaultIcon: string | undefined;
  let defaultIconWeight: string | undefined;
  let bgPrompt: string | undefined;
  const slots: ParsedPurposeSlot[] = [];
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
    if ((!s.samples || s.samples.length === 0) && !s.iconOnly) throw new Error(`${fileName}:${lineNum}: slot "${s.id}" missing samples`);
    if (!s.maxLength) throw new Error(`${fileName}:${lineNum}: slot "${s.id}" missing maxLength`);
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
      finalizeSlot(lineNum);
      inScopeBlock = true;
      inContextBlock = false;
      inVoiceBlock = false;
      scope = scope ?? {};
      continue;
    }

    // context block header
    if (line === 'context' && !raw.startsWith(' ')) {
      finalizeSlot(lineNum);
      inContextBlock = true;
      inScopeBlock = false;
      inVoiceBlock = false;
      continue;
    }

    // voice block header
    if (line === 'voice' && !raw.startsWith(' ')) {
      finalizeSlot(lineNum);
      inVoiceBlock = true;
      inScopeBlock = false;
      inContextBlock = false;
      voice = voice ?? {};
      continue;
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
      camera = line.slice(7).trim() !== 'false';
      continue;
    }

    // Background placeholder prompt: "bg-prompt: Mach dein Selfie"
    if (line.startsWith('bg-prompt:')) {
      bgPrompt = line.slice(10).trim().replace(/^["']|["']$/g, '');
      continue;
    }

    // Default icon: "defaultIcon: warning-circle" or "defaultIcon: warning-circle duotone"
    // Accepts kebab-case (natural for file format) and converts to PascalCase for Phosphor lookup.
    if (line.startsWith('defaultIcon:')) {
      const parts = line.slice(12).trim().split(/\s+/);
      // Convert kebab-case to PascalCase: "warning-circle" → "WarningCircle"
      defaultIcon = parts[0].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
      if (parts[1]) defaultIconWeight = parts[1];
      continue;
    }

    // Backward compat: "icon: warning-circle" (deprecated — use defaultIcon:)
    if (line.startsWith('icon:')) {
      console.warn(`${fileName}:${lineNum}: deprecated "icon:" — use "defaultIcon:" instead`);
      const parts = line.slice(5).trim().split(/\s+/);
      // Convert kebab-case to PascalCase: "warning-circle" → "WarningCircle"
      defaultIcon = parts[0].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
      if (parts[1]) defaultIconWeight = parts[1];
      continue;
    }

    // Slot start
    if (line.startsWith('slot ')) {
      finalizeSlot(lineNum);
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
        if (prop === 'icons: true' || prop === 'icons:true') { currentSlot.icons = true; continue; }
        if (prop === 'icons: false' || prop === 'icons:false') { currentSlot.icons = false; continue; }
        if (prop === 'iconOnly: true' || prop === 'iconOnly:true') { currentSlot.iconOnly = true; currentSlot.icons = true; continue; }
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
      if (prop.startsWith('samples:')) {
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
      if (prop.startsWith('typography:')) {
        currentSlot.typographyRef = prop.slice(11).trim();
        continue;
      }
      if (prop.startsWith('color:')) {
        currentSlot.colorRef = prop.slice(6).trim();
        continue;
      }
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

  // Finalize last slot
  finalizeSlot(lines.length);

  // Backward compat: if no id: line but we have a first # line, use it as id
  if (!id) {
    if (firstHashText) {
      console.warn(`${fileName}: deprecated — add "id: ${firstHashText}" line (first # line used as fallback id)`);
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

  return { id, name, description, preferredCompositions: compositions, slots, density, palette, scope, context, voice, defaultLogo, defaultPhoto, defaultVideo, camera, defaultIcon, defaultIconWeight, bgPrompt };
}
