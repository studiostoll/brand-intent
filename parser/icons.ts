/**
 * Icons: brand icon sets (`icons` block in .brand) and icon references
 * (`defaultIcon:` and `[id]` list-sample prefixes in .purpose).
 *
 * A reference resolves in the brand set first, then as a Phosphor name.
 * `phosphor:NAME` skips the brand set.
 */

export const PHOSPHOR_WEIGHTS = ['thin', 'light', 'regular', 'bold', 'fill', 'duotone'] as const;
export type PhosphorWeight = typeof PHOSPHOR_WEIGHTS[number];

/** Where a brand icon comes from. */
export type IconSource =
  /** Glyph in a brand font. `font` is the font block name; exactly one of codepoint / glyph is set. */
  | { kind: 'font'; font: string; codepoint?: number; glyph?: string }
  /** SVG file, relative to the brand folder. */
  | { kind: 'svg'; src: string }
  /** Phosphor icon adopted into the set. `name` is PascalCase (e.g. "MapPin"). */
  | { kind: 'phosphor'; name: string; weight?: PhosphorWeight };

export interface ParsedIconDef {
  /** Semantic id, e.g. "quote", "pin". */
  id: string;
  source: IconSource;
}

/** Icon reference from a .purpose file. */
export interface IconRef {
  /** Icon id as written, kebab-case (e.g. "quote", "map-pin"). */
  id: string;
  /** Set when written as `phosphor:NAME` — skips the brand set. */
  library?: 'phosphor';
  /** Phosphor weight. Only meaningful when the reference resolves to Phosphor. */
  weight?: PhosphorWeight;
}

export type ResolvedIcon =
  | { kind: 'brand'; icon: ParsedIconDef }
  | { kind: 'phosphor'; name: string; weight?: PhosphorWeight };

const ICON_ID = /^[a-z][a-z0-9-]*$/;

/** "map-pin" → "MapPin" */
export function phosphorName(id: string): string {
  return id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

function parseWeight(value: string, where: string): PhosphorWeight {
  if (!(PHOSPHOR_WEIGHTS as readonly string[]).includes(value)) {
    throw new Error(`${where}: invalid icon weight "${value}" — expected ${PHOSPHOR_WEIGHTS.join(', ')}`);
  }
  return value as PhosphorWeight;
}

/** Parse `quote`, `map-pin bold`, `phosphor:quotes duotone`. */
export function parseIconRef(value: string, where: string): IconRef {
  const parts = value.trim().split(/\s+/);
  if (parts.length === 0 || parts.length > 2 || !parts[0]) {
    throw new Error(`${where}: invalid icon reference "${value}" — expected "ID [WEIGHT]" or "phosphor:ID [WEIGHT]"`);
  }
  let id = parts[0];
  let library: IconRef['library'];
  if (id.startsWith('phosphor:')) {
    library = 'phosphor';
    id = id.slice(9);
  }
  if (!ICON_ID.test(id)) {
    throw new Error(`${where}: invalid icon id "${id}" — use lowercase kebab-case (e.g. "map-pin")`);
  }
  const ref: IconRef = { id };
  if (library) ref.library = library;
  if (parts[1]) ref.weight = parseWeight(parts[1], where);
  return ref;
}

/**
 * Parse one entry of the `icons` block (the part after `ID:`):
 *   font $display U+201C   glyph by codepoint
 *   font $display icon.pin glyph by name
 *   font U+201C            glyph in the default (first) font
 *   icons/map.svg          brand SVG
 *   phosphor wave light    Phosphor icon adopted into the set
 * Font names are checked later, once all font blocks are known.
 */
export function parseIconSource(value: string, where: string): IconSource {
  const parts = value.trim().split(/\s+/);
  if (parts[0] === 'font') {
    const rest = parts.slice(1);
    if (rest.length === 0 || rest.length > 2) {
      throw new Error(`${where}: font icon must be "font [$FONT] U+XXXX" or "font [$FONT] GLYPHNAME"`);
    }
    let font = '';
    if (rest.length === 2) {
      if (!rest[0].startsWith('$')) throw new Error(`${where}: font reference must start with "$" (e.g. "$display"), got "${rest[0]}"`);
      font = rest[0].slice(1);
    }
    const glyphRef = rest[rest.length - 1];
    const cp = glyphRef.match(/^U\+([0-9A-Fa-f]{4,6})$/);
    if (cp) return { kind: 'font', font, codepoint: parseInt(cp[1], 16) };
    if (/^U\+/i.test(glyphRef)) throw new Error(`${where}: invalid codepoint "${glyphRef}" — expected U+ and 4–6 hex digits`);
    return { kind: 'font', font, glyph: glyphRef };
  }
  if (parts[0] === 'phosphor') {
    if (parts.length < 2 || parts.length > 3) throw new Error(`${where}: phosphor icon must be "phosphor NAME [WEIGHT]"`);
    if (!ICON_ID.test(parts[1])) throw new Error(`${where}: invalid Phosphor name "${parts[1]}" — use kebab-case (e.g. "map-pin")`);
    const source: IconSource = { kind: 'phosphor', name: phosphorName(parts[1]) };
    if (parts[2]) source.weight = parseWeight(parts[2], where);
    return source;
  }
  if (parts.length === 1 && parts[0].toLowerCase().endsWith('.svg')) {
    return { kind: 'svg', src: parts[0] };
  }
  throw new Error(`${where}: invalid icon source "${value}" — expected "font …", "phosphor …" or a path to an .svg file`);
}

/** Parse the icon id at the start of an `icons` block line. */
export function isIconId(id: string): boolean {
  return ICON_ID.test(id);
}

/**
 * Resolve a reference against a brand's icon set.
 * Brand set first, then Phosphor. Whether the Phosphor name exists is up to the consumer.
 */
export function resolveIconRef(ref: IconRef, icons: ParsedIconDef[] | undefined): ResolvedIcon {
  if (!ref.library) {
    const icon = icons?.find(i => i.id === ref.id);
    if (icon) return { kind: 'brand', icon };
  }
  const resolved: ResolvedIcon = { kind: 'phosphor', name: phosphorName(ref.id) };
  if (ref.weight) resolved.weight = ref.weight;
  return resolved;
}

/** Split an optional `[id]` prefix off a list item: "[pin] Hafen Burgstaaken". */
export function parseListItem(item: string): { icon?: IconRef; text: string } {
  const m = item.match(/^\[([^\]]+)\]\s*(.*)$/s);
  if (!m) return { text: item };
  return { icon: parseIconRef(m[1], `list item "${item}"`), text: m[2] };
}
