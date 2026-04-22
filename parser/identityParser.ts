/**
 * Parser for .identity brand identity files.
 *
 * Line-based format with indentation-based blocks.
 * Contains brand strategy: essence, promise, voice, pillars, audiences, values.
 * No visual properties of any kind.
 */

// ── Parsed types ──────────────────────────────────────────────────────────────

export interface ParsedIdentity {
  // ── Required ──
  /** One-sentence brand essence (2-5 words ideal) */
  essence: string;
  /** Brand promise — the commitment to the audience */
  promise: string;
  /** Voice and tone definition */
  voice: ParsedVoice;
  /** Content pillar definitions */
  pillars: ParsedPillars;
  /** Audience segments keyed by ID */
  audiences: Record<string, ParsedAudience>;

  // ── Optional ──
  /** Public-facing brand claim / tagline */
  tagline?: string;
  /** Competitive positioning — what makes this brand the only one of its kind */
  positioning?: string;
  /** Brand purpose — why the brand exists, the inner motivation (distinct from promise, mission, vision) */
  purpose?: string;
  /** Organizational mission — what the brand does, for whom */
  mission?: string;
  /** Aspirational future state */
  vision?: string;
  /** Brand archetype shorthand (e.g. "craftsman", "sage") */
  archetype?: string;
  /** Named brand narratives (one should be marked primary) */
  narratives?: ParsedNarrative[];
  /** Core brand values with behavior statements */
  values?: ParsedValue[];
  /** Explicitly not-our-audience segments keyed by ID */
  antiAudiences?: Record<string, ParsedAntiAudience>;
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

export interface ParsedAntiAudience {
  /** Human-readable name */
  label: string;
  /** Who they are and why the brand is not for them */
  description: string;
}

export interface ParsedNarrative {
  /** Narrative title (e.g. "Origin Story", "Im besonderen Licht") */
  name: string;
  /** Whether this is the brand's dominant narrative */
  primary: boolean;
  /** Free-form narrative text */
  text: string;
}

export interface ParsedValue {
  /** Value name (e.g. "Handwerk", "Ehrlichkeit") */
  name: string;
  /** Behavior statement — what this value means in practice */
  behavior: string;
}

// ── Parser ────────────────────────────────────────────────────────────────────

type Block = 'top' | 'voice' | 'pillars' | 'audience' | 'anti-audience' | 'values' | 'narrative';
type NarrativeState = { name: string; primary: boolean; text: string };
type ListTarget = 'always' | 'never' | 'primary' | 'secondary' | 'avoid';

export function parseIdentityFile(content: string, fileName: string): ParsedIdentity {
  const lines = content.split('\n');

  let essence = '';
  let promise = '';
  let tagline = '';
  let positioning = '';
  let purpose = '';
  let mission = '';
  let vision = '';
  let archetype = '';
  const narratives: ParsedNarrative[] = [];
  let currentNarrative: NarrativeState | null = null;
  const voice: Partial<ParsedVoice> = { always: [], never: [] };
  const pillars: Partial<ParsedPillars> = { primary: [], avoid: [] };
  const audiences: Record<string, Partial<ParsedAudience>> = {};
  const antiAudiences: Record<string, Partial<ParsedAntiAudience>> = {};
  const values: ParsedValue[] = [];

  let block: Block = 'top';
  let currentAudience = '';
  let currentAntiAudience = '';
  let currentValueName = '';
  let currentValueBehavior = '';
  let listTarget: ListTarget | null = null;
  let continuationKey: string | null = null;

  function flushNarrative() {
    if (currentNarrative && currentNarrative.text) {
      narratives.push({
        name: currentNarrative.name,
        primary: currentNarrative.primary,
        text: currentNarrative.text.trim(),
      });
    }
    currentNarrative = null;
  }

  function flushValue() {
    if (currentValueName && currentValueBehavior) {
      values.push({ name: currentValueName, behavior: currentValueBehavior.trim() });
    }
    currentValueName = '';
    currentValueBehavior = '';
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNum = i + 1;

    // Strip inline comments (but not inside quoted strings)
    const line = raw.replace(/\s+#.*$/, '');

    // Skip blank lines and full-line comments
    if (line.trim() === '' || line.trim().startsWith('#')) {
      if (line.trim() === '') continuationKey = null;
      continue;
    }

    // ── Values block: 2-space = value name, 4-space = behavior ──
    if (block === 'values' && /^\s{2,}/.test(raw) && !raw.trim().startsWith('#')) {
      const indent = raw.match(/^(\s*)/)?.[1].length ?? 0;
      const text = raw.trim();
      if (indent <= 2 && !text.includes(':')) {
        // New value name (2-space indent)
        flushValue();
        currentValueName = text;
      } else if (currentValueName) {
        // Behavior text (4+ space indent) or continuation
        currentValueBehavior += (currentValueBehavior ? ' ' : '') + text;
      }
      continue;
    }

    // ── Narrative block: primary flag or text lines ──
    if (block === 'narrative' && currentNarrative && /^\s{2,}/.test(raw) && !raw.trim().startsWith('#')) {
      const trimmed = raw.trim();
      if (trimmed === 'primary') {
        currentNarrative.primary = true;
      } else {
        currentNarrative.text += (currentNarrative.text ? '\n' : '') + trimmed;
      }
      continue;
    }

    // ── Indented continuation lines ──
    if (/^\s{2,}/.test(raw) && !raw.trim().startsWith('-') && !raw.trim().includes(':')) {
      const continuation = raw.trim();

      // Top-level multi-line continuation
      if (continuationKey) {
        if (continuationKey === 'essence') essence += ' ' + continuation;
        else if (continuationKey === 'promise') promise += ' ' + continuation;
        else if (continuationKey === 'positioning') positioning += ' ' + continuation;
        else if (continuationKey === 'purpose') purpose += ' ' + continuation;
        else if (continuationKey === 'mission') mission += ' ' + continuation;
        else if (continuationKey === 'vision') vision += ' ' + continuation;
        continue;
      }
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
      } else if (block === 'anti-audience' && currentAntiAudience) {
        const aa = antiAudiences[currentAntiAudience] ??= {};
        switch (key) {
          case 'label': aa.label = val; break;
          case 'description': aa.description = val; break;
          default:
            throw new Error(`${fileName}:${lineNum}: unknown anti-audience key "${key}"`);
        }
      }
      continue;
    }

    // ── Top-level key: value ──
    const topMatch = line.match(/^([\w-]+):\s*(.*)/);
    if (topMatch) {
      const [, key, value] = topMatch;
      const val = value.trim();
      if (block === 'values') flushValue();
      if (block === 'narrative') flushNarrative();
      block = 'top';
      listTarget = null;
      continuationKey = null;

      switch (key) {
        case 'essence':
          essence = val;
          continuationKey = 'essence';
          break;
        case 'promise':
          promise = val;
          continuationKey = 'promise';
          break;
        case 'tagline':
          tagline = val;
          break;
        case 'positioning':
          positioning = val;
          continuationKey = 'positioning';
          break;
        case 'purpose':
          purpose = val;
          continuationKey = 'purpose';
          break;
        case 'mission':
          mission = val;
          continuationKey = 'mission';
          break;
        case 'vision':
          vision = val;
          continuationKey = 'vision';
          break;
        case 'archetype':
          archetype = val;
          break;
        default:
          throw new Error(`${fileName}:${lineNum}: unknown top-level key "${key}"`);
      }
      continue;
    }

    // ── Block headers ──
    if (raw.match(/^voice\s*$/)) {
      if (block === 'values') flushValue();
      if (block === 'narrative') flushNarrative();
      block = 'voice';
      listTarget = null;
      continuationKey = null;
      continue;
    }

    if (raw.match(/^pillars\s*$/)) {
      if (block === 'values') flushValue();
      if (block === 'narrative') flushNarrative();
      block = 'pillars';
      listTarget = null;
      continuationKey = null;
      continue;
    }

    if (raw.match(/^values\s*$/)) {
      if (block === 'values') flushValue();
      if (block === 'narrative') flushNarrative();
      block = 'values';
      listTarget = null;
      continuationKey = null;
      continue;
    }

    const narrativeMatch = raw.match(/^narrative\s+(.+?)\s*$/);
    if (narrativeMatch) {
      if (block === 'values') flushValue();
      if (block === 'narrative') flushNarrative();
      block = 'narrative';
      currentNarrative = { name: narrativeMatch[1].trim(), primary: false, text: '' };
      listTarget = null;
      continuationKey = null;
      continue;
    }

    const audienceMatch = raw.match(/^audience\s+(\S+)\s*$/);
    if (audienceMatch) {
      if (block === 'values') flushValue();
      if (block === 'narrative') flushNarrative();
      block = 'audience';
      currentAudience = audienceMatch[1];
      audiences[currentAudience] ??= {};
      listTarget = null;
      continuationKey = null;
      continue;
    }

    const antiAudienceMatch = raw.match(/^anti-audience\s+(\S+)\s*$/);
    if (antiAudienceMatch) {
      if (block === 'values') flushValue();
      if (block === 'narrative') flushNarrative();
      block = 'anti-audience';
      currentAntiAudience = antiAudienceMatch[1];
      antiAudiences[currentAntiAudience] ??= {};
      listTarget = null;
      continuationKey = null;
      continue;
    }
  }

  // Flush last value/narrative if in those blocks
  if (block === 'values') flushValue();
  if (block === 'narrative') flushNarrative();

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

  for (const [id, aa] of Object.entries(antiAudiences)) {
    if (!aa.label) throw new Error(`${fileName}: anti-audience "${id}" missing required field "label:"`);
    if (!aa.description) throw new Error(`${fileName}: anti-audience "${id}" missing required field "description:"`);
  }

  // ── Hex value exclusion rule ──
  const hexPattern = /#[0-9A-Fa-f]{3,8}\b/;
  if (hexPattern.test(content.replace(/#.*$/gm, ''))) {
    throw new Error(`${fileName}: identity files must not contain hex color values`);
  }

  const result: ParsedIdentity = {
    essence,
    promise,
    voice: voice as ParsedVoice,
    pillars: pillars as ParsedPillars,
    audiences: audiences as Record<string, ParsedAudience>,
  };

  // Optional fields — only include if present
  if (tagline) result.tagline = tagline;
  if (positioning) result.positioning = positioning;
  if (purpose) result.purpose = purpose;
  if (mission) result.mission = mission;
  if (vision) result.vision = vision;
  if (archetype) result.archetype = archetype;
  if (narratives.length > 0) result.narratives = narratives;
  if (values.length > 0) result.values = values;
  if (Object.keys(antiAudiences).length > 0) {
    result.antiAudiences = antiAudiences as Record<string, ParsedAntiAudience>;
  }

  return result;
}
