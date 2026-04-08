/**
 * Parser for .identity brand identity files.
 *
 * Line-based format with indentation-based blocks.
 * Contains brand strategy: essence, promise, voice, pillars, audiences.
 * No visual properties of any kind.
 */

// ── Parsed types ──────────────────────────────────────────────────────────────

export interface ParsedIdentity {
  /** One-sentence brand essence */
  essence: string;
  /** Brand promise (may span multiple lines) */
  promise: string;
  /** Voice and tone definition */
  voice: ParsedVoice;
  /** Content pillar definitions */
  pillars: ParsedPillars;
  /** Audience segments keyed by ID */
  audiences: Record<string, ParsedAudience>;
}

export interface ParsedVoice {
  /** Formality level (e.g. "informal, Du") */
  register: string;
  /** Voice character description */
  persona: string;
  /** Sentence structure guidance */
  rhythm?: string;
  /** Concrete rules the brand always follows */
  always: string[];
  /** Concrete rules the brand never breaks */
  never: string[];
}

export interface ParsedPillars {
  /** Primary content topics */
  primary: string[];
  /** Secondary content topics */
  secondary?: string[];
  /** Topics the brand does not inhabit */
  avoid: string[];
}

export interface ParsedAudience {
  /** Human-readable audience name */
  label: string;
  /** Demographic and behavioral description */
  profile?: string;
  /** What this audience wants from the brand */
  motivation: string;
  /** Tone and register guidance for this audience */
  language: string;
}

// ── Parser ────────────────────────────────────────────────────────────────────

type Block = 'top' | 'voice' | 'pillars' | 'audience';
type ListTarget = 'always' | 'never' | 'primary' | 'secondary' | 'avoid';

export function parseIdentityFile(content: string, fileName: string): ParsedIdentity {
  const lines = content.split('\n');

  let essence = '';
  let promise = '';
  const voice: Partial<ParsedVoice> = { always: [], never: [] };
  const pillars: Partial<ParsedPillars> = { primary: [], avoid: [] };
  const audiences: Record<string, Partial<ParsedAudience>> = {};

  let block: Block = 'top';
  let currentAudience = '';
  let listTarget: ListTarget | null = null;
  let continuationKey: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNum = i + 1;

    // Strip inline comments (but not inside quoted strings)
    const line = raw.replace(/\s+#.*$/, '');

    // Skip blank lines and full-line comments
    if (line.trim() === '' || line.trim().startsWith('#')) {
      // Blank line resets continuation
      if (line.trim() === '') continuationKey = null;
      continue;
    }

    // ── Indented continuation line ──
    if (/^\s{2,}/.test(raw) && continuationKey && !raw.trim().startsWith('-') && !raw.trim().includes(':')) {
      const continuation = raw.trim();
      if (continuationKey === 'essence') essence += ' ' + continuation;
      else if (continuationKey === 'promise') promise += ' ' + continuation;
      continue;
    }

    // ── List items (- prefixed, indented) ──
    const listMatch = raw.match(/^\s{4,}-\s+(.+)/);
    if (listMatch && listTarget) {
      const value = listMatch[1].trim();
      switch (listTarget) {
        case 'always': voice.always!.push(value); break;
        case 'never': voice.never!.push(value); break;
        case 'primary': pillars.primary!.push(value); break;
        case 'secondary': (pillars.secondary ??= []).push(value); break;
        case 'avoid': pillars.avoid!.push(value); break;
      }
      continuationKey = null;
      continue;
    }

    // ── Indented key: value inside a block ──
    const propMatch = raw.match(/^\s{2,}([\w-]+):\s*(.*)/);
    if (propMatch) {
      const [, key, value] = propMatch;
      const val = value.trim();
      listTarget = null;
      continuationKey = null;

      if (block === 'voice') {
        switch (key) {
          case 'register': voice.register = val; break;
          case 'persona': voice.persona = val; break;
          case 'rhythm': voice.rhythm = val; break;
          case 'always': listTarget = 'always'; break;
          case 'never': listTarget = 'never'; break;
          default:
            throw new Error(`${fileName}:${lineNum}: unknown voice key "${key}"`);
        }
      } else if (block === 'pillars') {
        switch (key) {
          case 'primary':
            if (val) pillars.primary = val.split(',').map(s => s.trim());
            else listTarget = 'primary';
            break;
          case 'secondary':
            if (val) pillars.secondary = val.split(',').map(s => s.trim());
            else listTarget = 'secondary';
            break;
          case 'avoid':
            if (val) pillars.avoid = val.split(',').map(s => s.trim());
            else listTarget = 'avoid';
            break;
          default:
            throw new Error(`${fileName}:${lineNum}: unknown pillars key "${key}"`);
        }
      } else if (block === 'audience' && currentAudience) {
        const aud = audiences[currentAudience] ??= {};
        switch (key) {
          case 'label': aud.label = val; break;
          case 'profile': aud.profile = val; break;
          case 'motivation': aud.motivation = val; break;
          case 'language': aud.language = val; break;
          default:
            throw new Error(`${fileName}:${lineNum}: unknown audience key "${key}"`);
        }
      }
      continue;
    }

    // ── Top-level key: value ──
    const topMatch = raw.match(/^([\w-]+):\s*(.*)/);
    if (topMatch) {
      const [, key, value] = topMatch;
      const val = value.trim();
      block = 'top';
      listTarget = null;

      switch (key) {
        case 'essence':
          essence = val;
          continuationKey = 'essence';
          break;
        case 'promise':
          promise = val;
          continuationKey = 'promise';
          break;
        default:
          throw new Error(`${fileName}:${lineNum}: unknown top-level key "${key}"`);
      }
      continue;
    }

    // ── Block headers ──
    const voiceMatch = raw.match(/^voice\s*$/);
    if (voiceMatch) {
      block = 'voice';
      listTarget = null;
      continuationKey = null;
      continue;
    }

    const pillarsMatch = raw.match(/^pillars\s*$/);
    if (pillarsMatch) {
      block = 'pillars';
      listTarget = null;
      continuationKey = null;
      continue;
    }

    const audienceMatch = raw.match(/^audience\s+(\S+)\s*$/);
    if (audienceMatch) {
      block = 'audience';
      currentAudience = audienceMatch[1];
      audiences[currentAudience] ??= {};
      listTarget = null;
      continuationKey = null;
      continue;
    }
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  if (!essence) throw new Error(`${fileName}: missing required field "essence:"`);
  if (!promise) throw new Error(`${fileName}: missing required field "promise:"`);
  if (!voice.register) throw new Error(`${fileName}: missing required field "voice.register:"`);
  if (!voice.persona) throw new Error(`${fileName}: missing required field "voice.persona:"`);
  if (!voice.always?.length) throw new Error(`${fileName}: voice.always must have at least one rule`);
  if (!voice.never?.length) throw new Error(`${fileName}: voice.never must have at least one rule`);
  if (!pillars.primary?.length) throw new Error(`${fileName}: pillars.primary must have at least one topic`);
  if (!pillars.avoid?.length) throw new Error(`${fileName}: pillars.avoid must have at least one topic`);
  if (Object.keys(audiences).length === 0) throw new Error(`${fileName}: at least one audience block is required`);

  for (const [id, aud] of Object.entries(audiences)) {
    if (!aud.label) throw new Error(`${fileName}: audience "${id}" missing required field "label:"`);
    if (!aud.motivation) throw new Error(`${fileName}: audience "${id}" missing required field "motivation:"`);
    if (!aud.language) throw new Error(`${fileName}: audience "${id}" missing required field "language:"`);
  }

  // ── Hex value exclusion rule ──
  const hexPattern = /#[0-9A-Fa-f]{3,8}\b/;
  if (hexPattern.test(content.replace(/#.*$/gm, ''))) {
    throw new Error(`${fileName}: identity files must not contain hex color values`);
  }

  return {
    essence,
    promise,
    voice: voice as ParsedVoice,
    pillars: pillars as ParsedPillars,
    audiences: audiences as Record<string, ParsedAudience>,
  };
}
