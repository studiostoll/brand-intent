/**
 * Parser for .identity brand identity files.
 *
 * Line-based format with indentation-based blocks.
 * Contains brand strategy: essence, promise, voice, pillars, audiences, values,
 * imagery, goals and review checks.
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
  /** Rules for photos and film: what the imagery always shows and never shows */
  imagery?: ParsedImagery;
  /** Named image themes, in declaration order */
  imageThemes?: ParsedImageTheme[];
  /** Communication goals keyed by ID (e.g. the shares of a content mix), in declaration order */
  goals?: Record<string, ParsedGoal>;
  /** Questions to check before publishing */
  review?: ParsedReview;
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
  /** Phrases to replace, each with the brand's own wording */
  instead?: ParsedReplacement[];
}

export interface ParsedReplacement {
  /** The phrase to avoid */
  avoid: string;
  /** What the brand writes instead */
  use: string;
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
  /** Example lines that carry this value */
  say?: string[];
  /** Counter-examples: lines that miss it */
  not?: string[];
}

export interface ParsedImagery {
  /** What every photo and film shows */
  always: string[];
  /** What the imagery never shows */
  never: string[];
}

export interface ParsedImageTheme {
  /** Theme title (free-form) */
  name: string;
  /** Name of the narrative this theme belongs to */
  narrative?: string;
  /** What the images show */
  text: string;
}

export interface ParsedGoal {
  /** Human-readable goal name */
  label: string;
  /** Target share of the content mix, 0–100 */
  share?: number;
  /** The question content for this goal answers */
  question?: string;
  /** Narratives this goal draws on */
  narratives?: string[];
  /** Rules content for this goal follows */
  always?: string[];
  /** Rules content for this goal never breaks */
  never?: string[];
}

export interface ParsedReview {
  /** Questions for texts */
  copy?: string[];
  /** Questions for photos and film */
  image?: string[];
}

// ── Parser ────────────────────────────────────────────────────────────────────

type Block = 'top' | 'voice' | 'pillars' | 'audience' | 'anti-audience' | 'values' | 'narrative' | 'imagery' | 'image-theme' | 'goal' | 'review';
type NarrativeState = { name: string; primary: boolean; text: string };
type ListTarget = 'always' | 'never' | 'instead' | 'primary' | 'secondary' | 'avoid'
  | 'imagery-always' | 'imagery-never' | 'goal-always' | 'goal-never' | 'review-copy' | 'review-image';

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
  const imagery: ParsedImagery = { always: [], never: [] };
  let imageryDeclared = false;
  const imageThemes: ParsedImageTheme[] = [];
  let currentImageTheme: ParsedImageTheme | null = null;
  const goals: Record<string, Partial<ParsedGoal> & { line: number }> = {};
  let currentGoal = '';
  const review: ParsedReview = {};
  let reviewDeclared = false;

  let block: Block = 'top';
  let currentAudience = '';
  let currentAntiAudience = '';
  let currentValueName = '';
  let currentValueBehavior = '';
  let currentValueSay: string[] = [];
  let currentValueNot: string[] = [];
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
      const value: ParsedValue = { name: currentValueName, behavior: currentValueBehavior.trim() };
      if (currentValueSay.length > 0) value.say = currentValueSay;
      if (currentValueNot.length > 0) value.not = currentValueNot;
      values.push(value);
    }
    currentValueName = '';
    currentValueBehavior = '';
    currentValueSay = [];
    currentValueNot = [];
  }

  function flushImageTheme() {
    if (currentImageTheme && currentImageTheme.text) {
      imageThemes.push({ ...currentImageTheme, text: currentImageTheme.text.trim() });
    }
    currentImageTheme = null;
  }

  /** Close the free-text blocks before a new block or top-level key starts. */
  function flushBlock() {
    if (block === 'values') flushValue();
    if (block === 'narrative') flushNarrative();
    if (block === 'image-theme') flushImageTheme();
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
      const example = text.match(/^(say|not):\s*(.+)$/);
      if (indent <= 2 && !text.includes(':')) {
        // New value name (2-space indent)
        flushValue();
        currentValueName = text;
      } else if (currentValueName && example) {
        (example[1] === 'say' ? currentValueSay : currentValueNot).push(example[2].trim());
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

    // ── Image theme block: optional narrative reference, then text lines ──
    if (block === 'image-theme' && currentImageTheme && /^\s{2,}/.test(raw) && !raw.trim().startsWith('#')) {
      const trimmed = raw.trim();
      const ref = trimmed.match(/^narrative:\s*(.+)$/);
      if (ref) currentImageTheme.narrative = ref[1].trim();
      else currentImageTheme.text += (currentImageTheme.text ? '\n' : '') + trimmed;
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
        case 'instead': {
          const arrow = value.indexOf('->');
          if (arrow === -1) throw new Error(`${fileName}:${lineNum}: voice.instead item must be "PHRASE -> REPLACEMENT", got "${value}"`);
          const unquote = (s: string) => s.trim().replace(/^["„“](.*)["“”]$/, '$1');
          (voice.instead ??= []).push({ avoid: unquote(value.slice(0, arrow)), use: unquote(value.slice(arrow + 2)) });
          break;
        }
        case 'imagery-always': imagery.always.push(value); break;
        case 'imagery-never': imagery.never.push(value); break;
        case 'goal-always': (goals[currentGoal].always ??= []).push(value); break;
        case 'goal-never': (goals[currentGoal].never ??= []).push(value); break;
        case 'review-copy': (review.copy ??= []).push(value); break;
        case 'review-image': (review.image ??= []).push(value); break;
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
          case 'instead': listTarget = 'instead'; break;
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
      } else if (block === 'imagery') {
        switch (key) {
          case 'always': listTarget = 'imagery-always'; break;
          case 'never': listTarget = 'imagery-never'; break;
          default:
            throw new Error(`${fileName}:${lineNum}: unknown imagery key "${key}"`);
        }
      } else if (block === 'goal' && currentGoal) {
        const goal = goals[currentGoal];
        switch (key) {
          case 'label': goal.label = val; break;
          case 'question': goal.question = val; break;
          case 'share': {
            const m = val.match(/^(\d+(?:\.\d+)?)%$/);
            const n = m ? parseFloat(m[1]) : NaN;
            if (!(n >= 0 && n <= 100)) throw new Error(`${fileName}:${lineNum}: goal share must be a percentage between 0% and 100%, got "${val}"`);
            goal.share = n;
            break;
          }
          case 'narratives': goal.narratives = val.split(',').map(s => s.trim()).filter(Boolean); break;
          case 'always': listTarget = 'goal-always'; break;
          case 'never': listTarget = 'goal-never'; break;
          default:
            throw new Error(`${fileName}:${lineNum}: unknown goal key "${key}"`);
        }
      } else if (block === 'review') {
        switch (key) {
          case 'copy': listTarget = 'review-copy'; break;
          case 'image': listTarget = 'review-image'; break;
          default:
            throw new Error(`${fileName}:${lineNum}: unknown review key "${key}"`);
        }
      }
      continue;
    }

    // ── Top-level key: value ──
    const topMatch = line.match(/^([\w-]+):\s*(.*)/);
    if (topMatch) {
      const [, key, value] = topMatch;
      const val = value.trim();
      flushBlock();
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
      flushBlock();
      block = 'voice';
      listTarget = null;
      continuationKey = null;
      continue;
    }

    if (raw.match(/^pillars\s*$/)) {
      flushBlock();
      block = 'pillars';
      listTarget = null;
      continuationKey = null;
      continue;
    }

    if (raw.match(/^values\s*$/)) {
      flushBlock();
      block = 'values';
      listTarget = null;
      continuationKey = null;
      continue;
    }

    const narrativeMatch = raw.match(/^narrative\s+(.+?)\s*$/);
    if (narrativeMatch) {
      flushBlock();
      block = 'narrative';
      currentNarrative = { name: narrativeMatch[1].trim(), primary: false, text: '' };
      listTarget = null;
      continuationKey = null;
      continue;
    }

    if (raw.match(/^imagery\s*$/)) {
      flushBlock();
      block = 'imagery';
      imageryDeclared = true;
      listTarget = null;
      continuationKey = null;
      continue;
    }

    if (raw.match(/^review\s*$/)) {
      flushBlock();
      block = 'review';
      reviewDeclared = true;
      listTarget = null;
      continuationKey = null;
      continue;
    }

    const imageThemeMatch = raw.match(/^image-theme\s+(.+?)\s*$/);
    if (imageThemeMatch) {
      flushBlock();
      block = 'image-theme';
      currentImageTheme = { name: imageThemeMatch[1].trim(), text: '' };
      listTarget = null;
      continuationKey = null;
      continue;
    }

    const goalMatch = raw.match(/^goal\s+(\S+)\s*$/);
    if (goalMatch) {
      flushBlock();
      block = 'goal';
      currentGoal = goalMatch[1];
      if (goals[currentGoal]) throw new Error(`${fileName}:${lineNum}: duplicate goal "${currentGoal}"`);
      goals[currentGoal] = { line: lineNum };
      listTarget = null;
      continuationKey = null;
      continue;
    }

    const audienceMatch = raw.match(/^audience\s+(\S+)\s*$/);
    if (audienceMatch) {
      flushBlock();
      block = 'audience';
      currentAudience = audienceMatch[1];
      audiences[currentAudience] ??= {};
      listTarget = null;
      continuationKey = null;
      continue;
    }

    const antiAudienceMatch = raw.match(/^anti-audience\s+(\S+)\s*$/);
    if (antiAudienceMatch) {
      flushBlock();
      block = 'anti-audience';
      currentAntiAudience = antiAudienceMatch[1];
      antiAudiences[currentAntiAudience] ??= {};
      listTarget = null;
      continuationKey = null;
      continue;
    }
  }

  // Flush the last free-text block
  flushBlock();

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

  const narrativeNames = new Set(narratives.map(n => n.name));
  for (const theme of imageThemes) {
    if (theme.narrative && !narrativeNames.has(theme.narrative)) {
      throw new Error(`${fileName}: image-theme "${theme.name}" references unknown narrative "${theme.narrative}"`);
    }
  }

  let shareTotal = 0;
  for (const [id, goal] of Object.entries(goals)) {
    if (!goal.label) throw new Error(`${fileName}:${goal.line}: goal "${id}" missing required field "label:"`);
    for (const name of goal.narratives ?? []) {
      if (!narrativeNames.has(name)) throw new Error(`${fileName}:${goal.line}: goal "${id}" references unknown narrative "${name}"`);
    }
    shareTotal += goal.share ?? 0;
  }
  if (shareTotal > 100) throw new Error(`${fileName}: goal shares add up to ${shareTotal}%, more than 100%`);

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
  if (imageryDeclared) result.imagery = imagery;
  if (imageThemes.length > 0) result.imageThemes = imageThemes;
  if (Object.keys(goals).length > 0) {
    result.goals = Object.fromEntries(
      Object.entries(goals).map(([id, { line: _line, ...goal }]) => [id, goal as ParsedGoal]),
    );
  }
  if (reviewDeclared) result.review = review;

  return result;
}
