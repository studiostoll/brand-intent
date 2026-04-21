/**
 * Parser for .brand brand definition files.
 *
 * Line-based format, same conventions as .purpose / .composition / .format / .identity.
 * Strategic/narrative content belongs in the sibling `.identity` file — this parser
 * handles expression-layer primitives only (colors, typography, dividers, assets, badge styles).
 */

// ── Parsed type ────────────────────────────────────────────────────────────────

export interface ParsedBrand {
  id: string;
  name: string;
  language: string;
  locale: string;
  /** Canonical domain for this brand (used for OG meta, favicon paths, share links). */
  domain?: string;
  /** Named font primitives: name → font definition. First entry is the brand default. */
  fonts?: Record<string, ParsedFontDef>;
  /** Token source type: 'figma' | 'inline' */
  tokensSource: 'figma' | 'inline';
  /** Figma file key (only when tokensSource === 'figma') */
  figmaFileKey?: string;
  /** Figma collection name (only when tokensSource === 'figma') */
  figmaCollection?: string;
  /** Path to the runtime tokens file (relative to /src) */
  tokensFile: string;
  /** Path to app icon asset (relative to /public), used for PWA icon */
  appIcon?: string;
  /** Path to favicon asset (relative to /public), used for browser tab icon */
  favicon?: string;
  /** Path to OG image asset (relative to /public), used for social sharing previews */
  ogImage?: string;
  /** Core brand color primitives: name → hex (e.g. primary, secondary, accent1, accent2, white) */
  brandColors?: Record<string, string>;
  /** Structured print specs per brand color: name → {pantone?, hks?, cmyk?} */
  brandColorPrint?: Record<string, BrandColorPrintSpec>;
  /** Inline themes: theme name → slot name → resolved hex color (only when tokensSource === 'inline') */
  themes?: Record<string, Record<string, string>>;
  /** Print annotations from inline # comments: slot name → annotation text */
  themeDescriptions?: Record<string, string>;
  /** Spacing scale (only when tokensSource === 'inline') */
  spacing?: { unit: string; xs: number; s: number; m: number; l: number; xl: number };
  /** Divider style definitions: name → divider config */
  dividers?: Record<string, ParsedDividerDef>;
  /** Named typography styles: name → style definition */
  typographies?: Record<string, ParsedTypographyDef>;
  /** Brand-declared assets: curated logos, photos, videos, illustrations with labels and metadata */
  assets?: { logos?: ParsedAssetDef[]; photos?: ParsedAssetDef[]; videos?: ParsedAssetDef[]; illustrations?: ParsedAssetDef[] };
  /** Label badge style — padding (top/right/bottom/left in cqh) and corner radius (cqh) */
  label?: ParsedBadgeStyle;
  /** CTA pill style — padding (top/right/bottom/left in cqh) and corner radius (cqh, or 999 for full pill) */
  cta?: ParsedBadgeStyle;
}

export interface ParsedAssetDef {
  id: string;
  label: string;
  src: string;
  aspectRatio?: number;
  scale?: number;
  lottieSrc?: string;
  animated?: boolean;
  loop?: boolean;
}

export interface ParsedBadgeStyle {
  /** Padding in cqh: [top, right, bottom, left] */
  padding: [number, number, number, number];
  /** Corner radius in cqh. Use 999 for a full pill. */
  radius: number;
}

export interface ParsedFontDef {
  /** Display name, e.g. "Matter", "system-ui", "Inter" */
  name: string;
  /** CSS fallback stack, e.g. "sans-serif", "serif" */
  fallback: string;
  /** Font source: 'local' (bundled in public/fonts/), 'system' (no @font-face), 'google' (future) */
  source: 'local' | 'system' | 'google';
  /** Variable font filename, relative to the brand's fonts/ directory. Used by preview where weight interpolation matters. */
  variable?: string;
  /** Variable italic font filename, when the family ships separate Roman/Italic variable files. */
  variableItalic?: string;
  /**
   * Static font instances, keyed by `{weight}` or `{weight}i` (italic).
   * E.g. `{ "400": "Pangea-Regular.ttf", "400i": "Pangea-Italic.ttf", "600": "Pangea-SemiBold.ttf" }`.
   * Required for export pipelines (Chromium PDF, print) that cannot embed variable or WOFF2 fonts.
   * Filenames are relative to the brand's `fonts/` directory and may contain subdirectories.
   */
  static?: Record<string, string>;
}

export interface BrandColorPrintSpec {
  /** PANTONE color name, e.g. "286 C" */
  pantone?: string;
  /** HKS color name, e.g. "44 K" */
  hks?: string;
  /** CMYK values as "C/M/Y/K" string, e.g. "97/80/0/31" */
  cmyk?: string;
}

export interface ParsedTypographyDef {
  /** Font key referencing a named font block (e.g. "mono"). Defaults to the brand primary font. */
  font?: string;
  weight: number;
  size: number;
  opsz?: number;
  lineHeight: number;
  letterSpacing?: number;
  italic?: boolean;
  uppercase?: boolean;
  /** Weight to use for **strong** inline markup. If absent, strong renders as normal. */
  strong?: number;
  /** Autofit minimum font size in cqh. If absent, autofit is disabled (fixed size). */
  autofitMin?: number;
  /** Autofit maximum font size in cqh. If absent, autofit is disabled (fixed size). */
  autofitMax?: number;
}

export interface ParsedDividerDef {
  /** Line thickness in cqmin */
  thickness: number;
  /** Line width — percentage string (e.g. '15%') or '100%' */
  width: string;
  /** Spacing token name applied above and below the divider (xs | s | m | l | xl) */
  spacing: string;
  /** Horizontal alignment of a partial-width divider (default: 'left') */
  align: 'left' | 'center' | 'right';
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Expand a 3-digit hex to 6-digit. Pass-through for 6 or 8-digit.
 * Returns null for invalid input.
 */
function normalizeHex(hex: string): string | null {
  const m = hex.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (!m) return null;
  const body = m[1];
  if (body.length === 3) {
    return '#' + body.split('').map(c => c + c).join('').toUpperCase();
  }
  return '#' + body.toUpperCase();
}

/** Parse a 6-digit hex into [r, g, b]. Input must be normalised to 6 digits. */
function hexToRgb(hex6: string): [number, number, number] {
  const body = hex6.slice(1);
  return [
    parseInt(body.slice(0, 2), 16),
    parseInt(body.slice(2, 4), 16),
    parseInt(body.slice(4, 6), 16),
  ];
}

/**
 * Resolve a theme-slot value string to a final CSS color.
 *
 * Supports: `$ref`, `$ref NN%`, `#HEX`, `#HEX NN%`, raw rgba(...) pass-through.
 * Throws on malformed alpha or unresolved `$ref`.
 */
function resolveThemeSlotValue(
  raw: string,
  brandColors: Record<string, string>,
  fileName: string,
  slot: string,
): string {
  const value = raw.trim();

  // Legacy rgba(...) literal — pass through unchanged.
  if (/^rgba?\s*\(/i.test(value)) return value;

  // Detect an alpha suffix: "<base> NN%" (one or more spaces, numeric, trailing %).
  // If the line contains a % but the shape doesn't match, it's malformed.
  let base = value;
  let alpha: number | null = null;
  const alphaMatch = value.match(/^(\S+)\s+([0-9]+(?:\.[0-9]+)?)%$/);
  if (alphaMatch) {
    base = alphaMatch[1];
    alpha = parseFloat(alphaMatch[2]);
    if (alpha < 0 || alpha > 100) {
      throw new Error(
        `${fileName}: theme slot "${slot}" alpha must be between 0 and 100, got ${alpha}`,
      );
    }
  } else if (value.includes('%')) {
    throw new Error(
      `${fileName}: theme slot "${slot}" alpha syntax is "<value> NN%" with a single space, got "${value}"`,
    );
  }

  // Resolve base to a hex string.
  let hex: string | null = null;
  if (base.startsWith('$')) {
    const refName = base.slice(1);
    const resolved = brandColors[refName];
    if (!resolved) {
      throw new Error(
        `${fileName}: theme slot "${slot}" references unknown brand color "$${refName}"`,
      );
    }
    hex = normalizeHex(resolved);
    if (!hex) {
      throw new Error(
        `${fileName}: theme slot "${slot}" base "$${refName}" resolves to "${resolved}", which is not a valid hex color`,
      );
    }
  } else {
    hex = normalizeHex(base);
    if (!hex) {
      // Not a hex, not a $ref — but it might be a bare keyword like "currentColor" or
      // a semantic slot name used for dividers historically. Pass through only when
      // no alpha was requested; with alpha, the base must be concrete.
      if (alpha !== null) {
        throw new Error(
          `${fileName}: theme slot "${slot}" base "${base}" must be "$ref" or "#HEX" when using alpha`,
        );
      }
      return value;
    }
  }

  // No alpha → solid hex.
  if (alpha === null) return hex;

  // 100% alpha → emit solid hex (keep output clean).
  if (alpha === 100) return hex;

  const [r, g, b] = hexToRgb(hex);
  // Drop trailing zeros for cleanliness: 0.7 not 0.70, 0.5 not 0.50.
  const a = Number((alpha / 100).toFixed(4)).toString();
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// ── Parser ─────────────────────────────────────────────────────────────────────

export function parseBrandFile(content: string, fileName: string): ParsedBrand {
  const lines = content.split('\n');

  const result: Partial<ParsedBrand> = {
    tokensFile: 'tokens.json',
    tokensSource: 'figma',
  };

  type ActiveBlock = 'none' | 'brand-colors' | 'theme' | 'spacing' | 'divider' | 'typography' | 'font' | 'logo' | 'photo' | 'video' | 'illustration' | 'label' | 'cta';
  let activeBlock: ActiveBlock = 'none';
  let currentThemeName = '';
  let currentDividerName = '';
  let currentTypographyName = '';
  let currentFontName = '';
  const brandColors: Record<string, string> = {};
  const brandColorPrint: Record<string, BrandColorPrintSpec> = {};
  let currentBrandColorName = '';
  const themes: Record<string, Record<string, string>> = {};
  const themeDescriptions: Record<string, string> = {};
  const spacingRaw: Record<string, string> = {};
  const dividersRaw: Record<string, Record<string, string>> = {};
  const typographiesRaw: Record<string, Record<string, string>> = {};
  const fontsRaw: Array<{ name: string; props: Record<string, string> }> = [];
  const logosRaw: Array<{ id: string; props: Record<string, string> }> = [];
  const photosRaw: Array<{ id: string; props: Record<string, string> }> = [];
  const videosRaw: Array<{ id: string; props: Record<string, string> }> = [];
  const illustrationsRaw: Array<{ id: string; props: Record<string, string> }> = [];
  let currentAssetId = '';
  const labelRaw: Record<string, string> = {};
  const ctaRaw: Record<string, string> = {};

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNum = i + 1;
    const isIndented = raw.startsWith('  ') || raw.startsWith('\t');

    // Comment — end any active block and skip
    if (raw.startsWith('#')) {
      activeBlock = 'none';
      continue;
    }

    // Indented continuation line — route to the active block
    if (isIndented) {
      if (activeBlock === 'brand-colors') {
        const trimmed = raw.trimStart();
        const indentLen = raw.length - trimmed.length;
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx !== -1) {
          const key = trimmed.slice(0, colonIdx).trim();
          const value = trimmed.slice(colonIdx + 1).trim();
          if (indentLen <= 2) {
            // Top-level color line: "  primary: #0324B1"
            // Brand colors are solid primitives only — alpha belongs in theme slots.
            if (/%/.test(value) || /rgba\s*\(/i.test(value)) {
              throw new Error(
                `${fileName}:${lineNum}: brand color "${key}" must be a solid hex — alpha syntax (e.g. "$ref 75%" or rgba()) is only allowed in theme slots`,
              );
            }
            brandColors[key] = value;
            currentBrandColorName = key;
          } else if (currentBrandColorName) {
            // Print sub-key: "    pantone: 286 C" / "    hks: 44 K" / "    cmyk: 97/80/0/31"
            if (!brandColorPrint[currentBrandColorName]) brandColorPrint[currentBrandColorName] = {};
            const spec = brandColorPrint[currentBrandColorName];
            if (key === 'pantone') spec.pantone = value;
            else if (key === 'hks') spec.hks = value;
            else if (key === 'cmyk') spec.cmyk = value;
          }
        }
        continue;
      }
      if (activeBlock === 'theme' && currentThemeName) {
        // slot: #HEX or $ref  # optional comment
        const colonIdx = raw.indexOf(':');
        if (colonIdx !== -1) {
          const slot = raw.slice(0, colonIdx).trim();
          const rest = raw.slice(colonIdx + 1).trim();
          // Split on first ' #' to separate value from inline comment
          const commentIdx = rest.search(/\s+#/);
          const value = commentIdx !== -1 ? rest.slice(0, commentIdx).trim() : rest.trim();
          const comment = commentIdx !== -1 ? rest.slice(commentIdx).replace(/^\s+#\s*/, '') : '';
          if (!themes[currentThemeName]) themes[currentThemeName] = {};
          themes[currentThemeName][slot] = value; // may be $ref — resolved after parsing
          if (comment && !themeDescriptions[slot]) {
            themeDescriptions[slot] = comment;
          }
        }
        continue;
      }
      if (activeBlock === 'spacing') {
        const colonIdx = raw.indexOf(':');
        if (colonIdx !== -1) {
          const key = raw.slice(0, colonIdx).trim();
          const value = raw.slice(colonIdx + 1).trim();
          spacingRaw[key] = value;
        }
        continue;
      }
      if (activeBlock === 'divider' && currentDividerName) {
        const colonIdx = raw.indexOf(':');
        if (colonIdx !== -1) {
          const key = raw.slice(0, colonIdx).trim();
          const value = raw.slice(colonIdx + 1).trim();
          if (key === 'color') {
            throw new Error(
              `${fileName}:${lineNum}: divider "${currentDividerName}": color is no longer configurable. Remove the "color:" line — divider color is sourced from the theme's "divider" slot.`,
            );
          }
          if (!dividersRaw[currentDividerName]) dividersRaw[currentDividerName] = {};
          dividersRaw[currentDividerName][key] = value;
        }
        continue;
      }
      if (activeBlock === 'typography' && currentTypographyName) {
        const trimmed = raw.trim();
        if (!typographiesRaw[currentTypographyName]) typographiesRaw[currentTypographyName] = {};
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx !== -1) {
          const key = trimmed.slice(0, colonIdx).trim();
          const value = trimmed.slice(colonIdx + 1).trim();
          typographiesRaw[currentTypographyName][key] = value;
        } else if (trimmed === 'italic' || trimmed === 'uppercase') {
          // Bare flag — presence means true
          typographiesRaw[currentTypographyName][trimmed] = 'true';
        }
        continue;
      }
      if (activeBlock === 'font' && currentFontName) {
        const colonIdx = raw.indexOf(':');
        if (colonIdx !== -1) {
          const key = raw.slice(0, colonIdx).trim();
          const value = raw.slice(colonIdx + 1).trim();
          const last = fontsRaw[fontsRaw.length - 1];
          if (last && last.name === currentFontName) last.props[key] = value;
        }
        continue;
      }
      if ((activeBlock === 'logo' || activeBlock === 'photo' || activeBlock === 'video' || activeBlock === 'illustration') && currentAssetId) {
        const colonIdx = raw.indexOf(':');
        if (colonIdx !== -1) {
          const key = raw.slice(0, colonIdx).trim();
          const value = raw.slice(colonIdx + 1).trim();
          const arr = activeBlock === 'logo' ? logosRaw : activeBlock === 'photo' ? photosRaw : activeBlock === 'video' ? videosRaw : illustrationsRaw;
          const last = arr[arr.length - 1];
          if (last && last.id === currentAssetId) last.props[key] = value;
        } else {
          const trimmed = raw.trim();
          if (trimmed === 'animated' || trimmed === 'loop') {
            const arr = activeBlock === 'logo' ? logosRaw : activeBlock === 'photo' ? photosRaw : activeBlock === 'video' ? videosRaw : illustrationsRaw;
            const last = arr[arr.length - 1];
            if (last && last.id === currentAssetId) last.props[trimmed] = 'true';
          }
        }
        continue;
      }
      if (activeBlock === 'label' || activeBlock === 'cta') {
        const colonIdx = raw.indexOf(':');
        if (colonIdx !== -1) {
          const key = raw.slice(0, colonIdx).trim();
          const value = raw.slice(colonIdx + 1).trim();
          const target = activeBlock === 'label' ? labelRaw : ctaRaw;
          target[key] = value;
        }
        continue;
      }
      // Indented line with no active block — ignore
      continue;
    }

    // Non-indented line ends any active block
    activeBlock = 'none';

    if (raw.trim() === '') continue;

    // brand-colors — starts the brand color primitives block
    if (raw.trim() === 'brand-colors') {
      activeBlock = 'brand-colors';
      continue;
    }

    // theme ThemeName — starts a theme block
    const themeMatch = raw.match(/^theme\s+(\S+)/);
    if (themeMatch) {
      currentThemeName = themeMatch[1];
      activeBlock = 'theme';
      continue;
    }

    // divider name — starts a divider block
    const dividerMatch = raw.match(/^divider\s+(\S+)/);
    if (dividerMatch) {
      currentDividerName = dividerMatch[1];
      activeBlock = 'divider';
      continue;
    }

    // typography name — starts a typography block
    const typographyMatch = raw.match(/^typography\s+(\S+)/);
    if (typographyMatch) {
      currentTypographyName = typographyMatch[1];
      activeBlock = 'typography';
      continue;
    }

    // font <name> or bare "font" — starts a font primitive block
    // Bare "font" (no name) uses "_default" internally; first font is always the brand default.
    const fontBlockMatch = raw.match(/^font(?:\s+(\S+))?$/);
    if (fontBlockMatch) {
      currentFontName = fontBlockMatch[1] ?? '_default';
      fontsRaw.push({ name: currentFontName, props: {} });
      activeBlock = 'font';
      continue;
    }

    // logo/photo/video/illustration <id> — starts an asset block
    const assetMatch = raw.match(/^(logo|photo|video|illustration)\s+(\S+)/);
    if (assetMatch) {
      const [, type, id] = assetMatch;
      currentAssetId = id;
      activeBlock = type as 'logo' | 'photo' | 'video' | 'illustration';
      const arr = type === 'logo' ? logosRaw : type === 'photo' ? photosRaw : type === 'video' ? videosRaw : illustrationsRaw;
      arr.push({ id, props: {} });
      continue;
    }

    const colonIdx = raw.indexOf(':');
    if (colonIdx === -1) continue;

    const key = raw.slice(0, colonIdx).trim();
    const value = raw.slice(colonIdx + 1).trim();

    switch (key) {
      case 'id':           result.id = value; break;
      case 'name':         result.name = value; break;
      case 'language':     result.language = value; break;
      case 'locale':       result.locale = value; break;
      case 'domain':       result.domain = value; break;
      case 'tokens':
        if (value === 'figma' || value === 'inline') {
          result.tokensSource = value;
        } else {
          console.warn(`${fileName}:${lineNum}: unknown tokens source "${value}", defaulting to "figma"`);
        }
        break;
      case 'figma-file-key':    result.figmaFileKey = value; break;
      case 'figma-collection':  result.figmaCollection = value; break;
      case 'tokens-file':       result.tokensFile = value; break;
      case 'app-icon':          result.appIcon = value; break;
      case 'favicon':           result.favicon = value; break;
      case 'og-image':          result.ogImage = value; break;
      case 'spacing':
        activeBlock = 'spacing';
        break;
      case 'label':
        activeBlock = 'label';
        break;
      case 'cta':
        activeBlock = 'cta';
        break;
      default:
        // Unknown keys silently ignored for forward compatibility
        break;
    }
  }

  // Store brand colors
  if (Object.keys(brandColors).length > 0) {
    result.brandColors = brandColors;
    if (Object.keys(brandColorPrint).length > 0) result.brandColorPrint = brandColorPrint;
  }

  // Finalise inline tokens — resolve $ref values against brandColors, apply optional alpha.
  //
  // Theme slot grammar:
  //   slot: $ref              → resolve ref to hex
  //   slot: $ref 75%          → resolve ref, then apply alpha (rgba)
  //   slot: #HEX              → pass through
  //   slot: #HEX 30%          → apply alpha (rgba)
  //   slot: rgba(...)         → pass through (legacy, discouraged)
  //
  // Alpha is expressed as `<number>%`, 0–100, separated from the base value by exactly one space.
  // 100% emits solid hex (not rgba) to keep output clean.
  if (Object.keys(themes).length > 0) {
    for (const theme of Object.values(themes)) {
      for (const [slot, value] of Object.entries(theme)) {
        theme[slot] = resolveThemeSlotValue(value, brandColors, fileName, slot);
      }
    }
    result.themes = themes;
    result.themeDescriptions = themeDescriptions;
  }
  if (Object.keys(spacingRaw).length > 0) {
    result.spacing = {
      unit: spacingRaw['unit'] ?? 'cqmin',
      xs: parseFloat(spacingRaw['xs'] ?? '1.5'),
      s:  parseFloat(spacingRaw['s']  ?? '2'),
      m:  parseFloat(spacingRaw['m']  ?? '3'),
      l:  parseFloat(spacingRaw['l']  ?? '5'),
      xl: parseFloat(spacingRaw['xl'] ?? '6.5'),
    };
  }

  // Finalise dividers — color is always sourced from the active theme's "divider" slot.
  if (Object.keys(dividersRaw).length > 0) {
    const dividers: Record<string, ParsedDividerDef> = {};
    for (const [name, raw] of Object.entries(dividersRaw)) {
      const alignRaw = raw['align'] ?? 'left';
      const align: ParsedDividerDef['align'] =
        alignRaw === 'center' ? 'center' : alignRaw === 'right' ? 'right' : 'left';
      dividers[name] = {
        thickness: parseFloat(raw['thickness'] ?? '0.2'),
        width: raw['width'] ?? '100%',
        spacing: raw['spacing'] ?? 'xs',
        align,
      };
    }
    result.dividers = dividers;
  }

  // Finalise font primitives
  if (fontsRaw.length > 0) {
    const fonts: Record<string, ParsedFontDef> = {};
    for (const { name, props } of fontsRaw) {
      const fontName = props['name'];
      if (!fontName) {
        console.warn(`${fileName}: font block "${name}" missing "name:" property — skipping`);
        continue;
      }
      const rawSource = props['source'];
      const source: ParsedFontDef['source'] =
        rawSource === 'system' ? 'system' : rawSource === 'google' ? 'google' : 'local';
      const fallback = props['fallback'] ?? 'sans-serif';
      const def: ParsedFontDef = { name: fontName, fallback, source };
      if (props['variable']) def.variable = props['variable'];
      if (props['variable-italic']) def.variableItalic = props['variable-italic'];
      const staticInstances: Record<string, string> = {};
      for (const [key, value] of Object.entries(props)) {
        const match = key.match(/^static-(\d{3})(i)?$/);
        if (match) staticInstances[match[1] + (match[2] ?? '')] = value;
      }
      if (Object.keys(staticInstances).length > 0) def.static = staticInstances;
      fonts[name] = def;
    }
    if (Object.keys(fonts).length > 0) result.fonts = fonts;
  }

  // Finalise typographies
  if (Object.keys(typographiesRaw).length > 0) {
    const typographies: Record<string, ParsedTypographyDef> = {};
    for (const [name, raw] of Object.entries(typographiesRaw)) {
      const weight = parseInt(raw['weight'] ?? '400', 10);
      const size = parseFloat(raw['size'] ?? '3');
      const lineHeight = parseFloat(raw['lineHeight'] ?? '1.4');
      if (isNaN(weight) || isNaN(size) || isNaN(lineHeight)) {
        console.warn(`${fileName}: typography "${name}" has invalid numeric values — skipping`);
        continue;
      }
      const def: ParsedTypographyDef = { weight, size, lineHeight };
      if (raw['font'] !== undefined) def.font = raw['font'].replace(/^\$/, '');
      if (raw['opsz'] !== undefined) def.opsz = parseFloat(raw['opsz']);
      if (raw['letterSpacing'] !== undefined) def.letterSpacing = parseFloat(raw['letterSpacing']);
      if (raw['italic'] === 'true' || raw['italic'] === '') def.italic = true;
      if (raw['uppercase'] === 'true' || raw['uppercase'] === '') def.uppercase = true;
      if (raw['strong'] !== undefined) def.strong = parseInt(raw['strong'], 10);
      if (raw['autofit-min'] !== undefined) def.autofitMin = parseFloat(raw['autofit-min']);
      if (raw['autofit-max'] !== undefined) def.autofitMax = parseFloat(raw['autofit-max']);
      typographies[name] = def;
    }
    result.typographies = typographies;
  }

  // Finalise brand-declared assets
  const toAssetDef = (raw: { id: string; props: Record<string, string> }): ParsedAssetDef => {
    const def: ParsedAssetDef = { id: raw.id, label: raw.props['label'] ?? raw.id, src: raw.props['src'] ?? '' };
    if (raw.props['aspect']) def.aspectRatio = parseFloat(raw.props['aspect']);
    if (raw.props['scale']) def.scale = parseFloat(raw.props['scale']);
    if (raw.props['lottie']) def.lottieSrc = raw.props['lottie'];
    if (raw.props['animated'] === 'true') def.animated = true;
    if (raw.props['loop'] === 'true') def.loop = true;
    return def;
  };
  if (logosRaw.length > 0 || photosRaw.length > 0 || videosRaw.length > 0 || illustrationsRaw.length > 0) {
    result.assets = {};
    if (logosRaw.length > 0) result.assets.logos = logosRaw.map(toAssetDef);
    if (photosRaw.length > 0) result.assets.photos = photosRaw.map(toAssetDef);
    if (videosRaw.length > 0) result.assets.videos = videosRaw.map(toAssetDef);
    if (illustrationsRaw.length > 0) result.assets.illustrations = illustrationsRaw.map(toAssetDef);
  }

  // Finalise label / cta badge styles
  const parseBadgeStyle = (raw: Record<string, string>, defaults: ParsedBadgeStyle): ParsedBadgeStyle => {
    const padding = (() => {
      const p = raw['padding'];
      if (!p) return defaults.padding;
      const nums = p.split(/\s+/).map(parseFloat).filter(n => !isNaN(n));
      if (nums.length === 1) return [nums[0], nums[0], nums[0], nums[0]] as [number, number, number, number];
      if (nums.length === 2) return [nums[0], nums[1], nums[0], nums[1]] as [number, number, number, number];
      if (nums.length === 3) return [nums[0], nums[1], nums[2], nums[1]] as [number, number, number, number];
      if (nums.length >= 4) return [nums[0], nums[1], nums[2], nums[3]] as [number, number, number, number];
      return defaults.padding;
    })();
    const radius = raw['radius'] !== undefined ? parseFloat(raw['radius']) : defaults.radius;
    return { padding, radius: isNaN(radius) ? defaults.radius : radius };
  };
  if (Object.keys(labelRaw).length > 0) {
    result.label = parseBadgeStyle(labelRaw, { padding: [0.5, 1, 0.7, 1], radius: 0 });
  }
  if (Object.keys(ctaRaw).length > 0) {
    result.cta = parseBadgeStyle(ctaRaw, { padding: [0.8, 2.5, 0.8, 2.5], radius: 999 });
  }

  // Validate required fields
  const required: (keyof ParsedBrand)[] = ['id', 'name', 'language', 'locale'];
  for (const field of required) {
    if (!result[field]) {
      throw new Error(`${fileName}: missing required field "${field}"`);
    }
  }

  return result as ParsedBrand;
}
