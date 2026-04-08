// @ts-check
const vscode = require('vscode');

/** @param {vscode.ExtensionContext} context */
function activate(context) {
  // ── Composition file completions ─────────────────────────────────────────
  const compositionProvider = vscode.languages.registerCompletionItemProvider(
    [{ language: 'brand-intent-composition' }],
    {
      provideCompletionItems(document, position) {
        const line = document.lineAt(position).text;
        const prefix = line.substring(0, position.character);
        const items = [];

        // image: line — suggest region keywords
        if (prefix.match(/^image:\s*/)) {
          for (const [v, detail] of [
            ['full', 'Full canvas'],
            ['none', 'No image'],
            ['top--center', 'Top half'],
            ['center--bottom', 'Bottom half'],
            ['top--bottom', 'Full height split'],
            ['top--center cols 1--2', 'Top half, left columns'],
            ['top--center cols 3--4', 'Top half, right columns'],
            ['center--bottom cols 1--2', 'Bottom half, left columns'],
            ['center--bottom cols 3--4', 'Bottom half, right columns'],
          ]) {
            const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.Value);
            item.detail = detail;
            items.push(item);
          }
        }

        // logo: line — suggest keyword positions
        if (prefix.match(/^logo:\s*$/)) {
          for (const [v, detail] of [
            ['none', 'No logo'],
            ['top col left', 'Top-left'],
            ['top col right', 'Top-right'],
            ['top col center', 'Top-center'],
            ['bottom col left', 'Bottom-left'],
            ['bottom col right', 'Bottom-right'],
            ['center col center', 'Center-center'],
          ]) {
            const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.Value);
            item.detail = detail;
            items.push(item);
          }
        }

        // icon: line — suggest keyword positions
        if (prefix.match(/^icon:\s*$/)) {
          for (const [v, detail] of [
            ['top col right m', 'Top-right, medium'],
            ['top col left m', 'Top-left, medium'],
            ['top col center m', 'Top-center, medium'],
            ['center col right m', 'Center-right, medium'],
            ['center col left m', 'Center-left, medium'],
            ['center col center m', 'Center, medium'],
            ['bottom col right m', 'Bottom-right, medium'],
            ['bottom col left m', 'Bottom-left, medium'],
          ]) {
            const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.Value);
            item.detail = detail;
            items.push(item);
          }
        }

        // mode: — suggest layout modes
        if (prefix.match(/^mode:\s*$/)) {
          for (const [v, detail] of [
            ['grid', 'Grid-based positioning'],
            ['flow', 'Content-driven reflow'],
          ]) {
            const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.EnumMember);
            item.detail = detail;
            items.push(item);
          }
        }

        // flow: split — suggest edge and fraction
        if (prefix.match(/^flow:\s+split\s*$/)) {
          for (const [v, detail] of [
            ['bottom 1/2', 'Text bottom half, image top'],
            ['top 1/2', 'Text top half, image bottom'],
            ['bottom 1/3', 'Text bottom third, image top 2/3'],
            ['top 1/3', 'Text top third, image bottom 2/3'],
            ['left 1/2', 'Text left half, image right'],
            ['right 1/2', 'Text right half, image left'],
            ['left 2/3', 'Text left 2/3, image right 1/3'],
          ]) {
            const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.Value);
            item.detail = detail;
            items.push(item);
          }
        }

        // row number after "row "
        if (prefix.match(/\brow\s+$/)) {
          for (const [n, detail] of [
            ['1', 'Top row (A)'], ['2', 'Row 2 (B)'], ['3', 'Row 3 (C)'],
            ['4', 'Row 4 (D)'], ['5', 'Row 5 (E)'], ['6', 'Bottom row (F)'],
          ]) {
            const item = new vscode.CompletionItem(n, vscode.CompletionItemKind.Enum);
            item.detail = detail;
            items.push(item);
          }
        }

        // col keyword after "col " (for logo/icon)
        if (prefix.match(/\bcol\s+$/)) {
          for (const [c, detail] of [
            ['left', 'Left column'],
            ['right', 'Right column'],
            ['center', 'Center column'],
          ]) {
            const item = new vscode.CompletionItem(c, vscode.CompletionItemKind.Enum);
            item.detail = detail;
            items.push(item);
          }
        }

        // logo/icon size after "col X " — s/m/l
        if (prefix.match(/^(?:logo|icon):\s+\S+\s+col\s+\S+\s+$/)) {
          for (const [sz, detail] of [['s', 'Small'], ['m', 'Medium (default)'], ['l', 'Large']]) {
            const item = new vscode.CompletionItem(sz, vscode.CompletionItemKind.Enum);
            item.detail = detail;
            items.push(item);
          }
        }

        // cols range after "cols "
        if (prefix.match(/\bcols\s+$/)) {
          for (const [v, detail] of [
            ['1--4', 'Full width (4 cols)'],
            ['1--3', 'Three-quarter left'],
            ['2--4', 'Three-quarter right'],
            ['1--2', 'Left half'],
            ['3--4', 'Right half'],
            ['2--3', 'Center two'],
            ['1--1', 'Column 1 only'],
            ['4--4', 'Column 4 only'],
          ]) {
            const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.Enum);
            item.detail = detail;
            items.push(item);
          }
        }

        // alignment after "cols N--M " or "col X "
        if (prefix.match(/--\d\s+$/) || prefix.match(/\bcol\s+\S+\s+(?:row\s+\d+\s+)?cols\s+\S+\s+$/)) {
          for (const a of ['left', 'center', 'right']) {
            const item = new vscode.CompletionItem(a, vscode.CompletionItemKind.Enum);
            item.detail = 'Text alignment';
            items.push(item);
          }
        }

        // slot names at start of line or after |
        if (prefix.match(/^\s*\|\s*$/) || prefix.match(/^\s*$/)) {
          for (const [s, detail] of [
            ['primary left', 'Primary text slot, left-aligned'],
            ['primary center', 'Primary text slot, centered'],
            ['primary right', 'Primary text slot, right-aligned'],
            ['secondary left', 'Secondary text slot, left-aligned'],
            ['secondary center', 'Secondary text slot, centered'],
            ['detail left', 'Detail text slot, left-aligned'],
            ['meta left', 'Meta text slot, left-aligned'],
            ['cta left', 'Call-to-action slot, left-aligned'],
            ['label left', 'Label badge slot, left-aligned'],
          ]) {
            const item = new vscode.CompletionItem(s, vscode.CompletionItemKind.Field);
            item.detail = detail;
            items.push(item);
          }
          for (const sp of ['spacer-xs', 'spacer-s', 'spacer-m', 'spacer-l', 'spacer-xl', 'spacer-auto']) {
            const item = new vscode.CompletionItem(sp, vscode.CompletionItemKind.Constant);
            item.detail = sp === 'spacer-auto' ? 'Fill remaining space' : `Fixed spacer: ${sp.slice(7)}`;
            items.push(item);
          }
        }

        // spacer- size suffix
        if (prefix.match(/\bspacer-$/)) {
          for (const [s, detail] of [
            ['xs', 'Extra small'], ['s', 'Small'], ['m', 'Medium'],
            ['l', 'Large'], ['xl', 'Extra large'], ['auto', 'Fill remaining space'],
          ]) {
            const item = new vscode.CompletionItem(s, vscode.CompletionItemKind.Constant);
            item.detail = detail;
            items.push(item);
          }
        }

        // Top-level composition keywords at start of line
        if (prefix.match(/^\s*$/) || prefix.match(/^\s*[\w-]*$/)) {
          for (const [kw, detail] of [
            ['id:', 'Composition identifier (e.g. bottom-left)'],
            ['name:', 'Display name (e.g. Bottom Left)'],
            ['grid:', 'Native grid declaration -- rows cols (e.g. 1 8)'],
            ['image:', 'Image region -- full, none, or top--center etc.'],
            ['logo:', 'Logo placement -- position col side [size]'],
            ['icon:', 'Icon slot placement -- position col side size'],
            ['mode:', 'Layout mode -- grid or flow'],
            ['flow:', 'Flow region -- plain, panel, or split'],
            ['sticky:', 'Sticky header/footer bar'],
          ]) {
            const item = new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword);
            item.detail = detail;
            items.push(item);
          }
        }

        return items;
      }
    },
    ' ', ':', '-'  // trigger characters
  );

  // ── Purpose file completions ─────────────────────────────────────────────
  const purposeProvider = vscode.languages.registerCompletionItemProvider(
    'brand-intent-purpose',
    {
      provideCompletionItems(document, position) {
        const line = document.lineAt(position).text;
        const prefix = line.substring(0, position.character);
        const items = [];

        // compositions: line — all known composition names
        if (prefix.match(/^compositions:\s*/)) {
          for (const [a, detail] of [
            ['bottom-stack', 'Text stacked at bottom'],
            ['center-stage', 'Text centered'],
            ['top-anchor', 'Text at top'],
            ['editorial', 'Secondary above primary'],
            ['bottom-left', 'Text bottom-left, logo top-right'],
            ['bottom-right', 'Text bottom-right, logo top-left'],
            ['center-left', 'Text centered, left-aligned'],
            ['center-right', 'Text centered, right-aligned'],
            ['top-right', 'Text top-right, logo bottom'],
            ['bottom-bar', 'Text in bottom band'],
            ['split-horizontal', 'Primary offset from logo'],
            ['diagonal-top-left', 'Primary top-left, secondary bottom-right'],
            ['diagonal-top-right', 'Primary top-right, secondary bottom-left'],
            ['info-list', 'Headline top, list in columns'],
            ['half-stack-top', 'Text top half, photo bottom (flow+split)'],
            ['half-stack-bottom', 'Photo top half, text bottom (flow+split)'],
            ['ruled-split', 'Kicker + divider + headline, image top half'],
            ['caption-ruled', 'Headline + divider + caption over full image'],
            ['quote-ruled', 'Quote + divider + attribution over full image'],
            ['longread', 'Flow: sticky header, body columns, divider'],
            ['panel', 'Flow: floating panel over full image'],
            ['caption', 'Flow: sticky logo, small caption at bottom'],
            ['sign', 'Flow: horizontal signage, sticky logo left'],
            ['sign-icons', 'Flow: horizontal icon row'],
            ['sign-text-only', 'Signage: text only (grid)'],
            ['sign-icon-text', 'Signage: icon + text (grid)'],
            ['sign-icon-only', 'Signage: single icon (grid)'],
          ]) {
            const item = new vscode.CompletionItem(a, vscode.CompletionItemKind.Reference);
            item.detail = detail;
            items.push(item);
          }
        }

        // density: values
        if (prefix.match(/^density:\s*$/)) {
          for (const [v, detail] of [
            ['light', 'Minimal content density'],
            ['medium', 'Standard content density'],
            ['full', 'Maximum content density'],
          ]) {
            const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.EnumMember);
            item.detail = detail;
            items.push(item);
          }
        }

        // defaultIcon: icon name (Phosphor kebab-case)
        if (prefix.match(/^defaultIcon:\s*/)) {
          for (const [name, detail] of [
            ['arrow-right', 'Arrow right'], ['arrow-left', 'Arrow left'],
            ['arrow-up', 'Arrow up'], ['arrow-down', 'Arrow down'],
            ['map-pin', 'Map pin'], ['map-pin-line', 'Map pin (outline)'],
            ['info', 'Info circle'], ['warning', 'Warning triangle'],
            ['warning-circle', 'Warning circle'], ['check', 'Checkmark'],
            ['check-circle', 'Checkmark circle'], ['x-circle', 'X circle'],
            ['phone', 'Phone'], ['envelope', 'Envelope / email'],
            ['globe', 'Globe / website'], ['house', 'House'],
            ['calendar', 'Calendar'], ['clock', 'Clock'],
            ['star', 'Star'], ['heart', 'Heart'],
            ['lighthouse', 'Lighthouse'], ['anchor', 'Anchor'],
            ['fish', 'Fish'], ['compass', 'Compass'],
            ['parking', 'Parking'], ['wheelchair', 'Wheelchair / accessible'],
            ['fork-knife', 'Restaurant'], ['bed', 'Accommodation'],
            ['number-circle-one', 'Number 1'], ['number-circle-two', 'Number 2'],
            ['number-circle-three', 'Number 3'], ['number-circle-four', 'Number 4'],
          ]) {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Value);
            item.detail = detail;
            items.push(item);
          }
        }

        // defaultIcon weight after icon name
        if (prefix.match(/^defaultIcon:\s+[\w-]+\s+$/)) {
          for (const [w, detail] of [
            ['thin', 'Thinnest weight'], ['light', 'Light weight'],
            ['regular', 'Regular weight (default)'], ['bold', 'Bold weight'],
            ['fill', 'Filled variant'], ['duotone', 'Duotone variant'],
          ]) {
            const item = new vscode.CompletionItem(w, vscode.CompletionItemKind.Enum);
            item.detail = detail;
            items.push(item);
          }
        }

        // slot X line
        if (prefix.match(/^slot\s+$/)) {
          for (const [s, detail] of [
            ['primary', 'Primary text slot'], ['secondary', 'Secondary text slot'],
            ['detail', 'Detail text slot'], ['meta', 'Meta text slot'],
            ['cta', 'Call-to-action slot'], ['label', 'Label badge slot'],
          ]) {
            const item = new vscode.CompletionItem(s, vscode.CompletionItemKind.Field);
            item.detail = detail;
            items.push(item);
          }
        }

        // Indented slot property names
        if (prefix.match(/^\s+$/) || prefix.match(/^\s+[\w]*$/)) {
          for (const [p, detail] of [
            ['label:', 'Display name shown in UI'],
            ['samples:', 'Sample texts (pipe-separated or multi-line with "- ")'],
            ['maxLength:', 'Character limit'],
            ['font:', 'Font family + weight'],
            ['size:', 'Base font size (% of canvas height)'],
            ['opsz:', 'Optical size axis value'],
            ['lineHeight:', 'Line height multiplier'],
            ['letterSpacing:', 'Letter spacing in em units'],
            ['typography:', 'Typography style reference ($name)'],
            ['color:', 'Color token reference ($name)'],
            ['type:', 'Slot type (text or list)'],
          ]) {
            const item = new vscode.CompletionItem(p, vscode.CompletionItemKind.Property);
            item.detail = detail;
            items.push(item);
          }
        }

        // identity-filter block properties
        if (prefix.match(/^\s+(audience|pillars):\s*$/)) {
          // Just trigger — values are brand-specific
        }

        // Top-level purpose keywords at start of line
        if (prefix.match(/^\s*$/) || prefix.match(/^\s*[\w-]*$/)) {
          for (const [kw, detail] of [
            ['id:', 'Purpose identifier (e.g. outdoor-sign)'],
            ['name:', 'Display name (e.g. Outdoor Sign)'],
            ['compositions:', 'Preferred compositions (comma-separated)'],
            ['density:', 'Content density -- light, medium, or full'],
            ['defaultIcon:', 'Default icon name (Phosphor kebab-case) + weight'],
            ['identity-filter', 'Filter identity traits for this purpose'],
            ['identity-extension', 'Extend identity traits for this purpose'],
            ['slot primary', 'Define primary text slot'],
            ['slot secondary', 'Define secondary text slot'],
            ['slot detail', 'Define detail text slot'],
            ['slot meta', 'Define meta text slot'],
            ['slot cta', 'Define call-to-action slot'],
            ['slot label', 'Define label badge slot'],
          ]) {
            const item = new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword);
            item.detail = detail;
            items.push(item);
          }
        }

        return items;
      }
    },
    ' ', ':'  // trigger characters
  );

  // ── Format file completions ──────────────────────────────────────────────
  const formatProvider = vscode.languages.registerCompletionItemProvider(
    'brand-intent-format',
    {
      provideCompletionItems(document, position) {
        const line = document.lineAt(position).text;
        const prefix = line.substring(0, position.character);
        const items = [];

        // category: value
        if (prefix.match(/^category:\s*/)) {
          for (const [v, detail] of [
            ['instagram', 'Instagram -- px dimensions'],
            ['linkedin', 'LinkedIn -- px dimensions'],
            ['print', 'Print -- mm dimensions, 300 dpi'],
            ['signage', 'Signage/banners -- mm dimensions, 300 dpi'],
          ]) {
            const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.EnumMember);
            item.detail = detail;
            items.push(item);
          }
        }

        // size: value — common presets
        if (prefix.match(/^size:\s*/)) {
          for (const [v, detail] of [
            ['1080 1080', 'Square (1:1) -- Instagram'],
            ['1080 1350', 'Portrait 4:5 -- Instagram feed'],
            ['1080 1920', 'Story/Reel (9:16)'],
            ['1080 566', 'Landscape 1.91:1 -- LinkedIn'],
            ['1200 628', 'Landscape -- LinkedIn/Facebook'],
            ['594mm 297mm', 'A4 Landscape -- print'],
            ['210mm 297mm', 'A4 Portrait -- print'],
            ['600mm 300mm', '2:1 Sign -- signage'],
            ['600mm 200mm', '3:1 Sign -- signage'],
            ['1200mm 200mm', '6:1 Sign -- signage'],
          ]) {
            const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.Value);
            item.detail = detail;
            items.push(item);
          }
        }

        // dpi: value
        if (prefix.match(/^dpi:\s*/)) {
          for (const [v, detail] of [
            ['300', 'Standard print/signage resolution'],
            ['150', 'Screen-quality print'],
            ['72', 'Screen only'],
          ]) {
            const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.Value);
            item.detail = detail;
            items.push(item);
          }
        }

        // bleed: value
        if (prefix.match(/^bleed:\s*/)) {
          for (const [v, detail] of [
            ['3mm', 'Standard bleed (3mm)'],
            ['5mm', 'Extended bleed (5mm)'],
            ['0', 'No bleed'],
          ]) {
            const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.Value);
            item.detail = detail;
            items.push(item);
          }
        }

        // comfort: value
        if (prefix.match(/^comfort:\s*/)) {
          for (const [v, detail] of [
            ['40', 'Standard inner margin (px)'],
            ['10mm', 'Standard inner margin (mm)'],
            ['20mm', 'Generous inner margin (mm)'],
            ['0', 'No comfort margin'],
          ]) {
            const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.Value);
            item.detail = detail;
            items.push(item);
          }
        }

        // danger: and crop: values — shorthand hint
        if (prefix.match(/^(?:danger|crop):\s*$/)) {
          for (const [v, detail] of [
            ['0', 'No safe zone (all sides)'],
            ['0 0 0 0', 'No safe zone (T R B L)'],
            ['none', 'No crop zone (crop: only)'],
          ]) {
            const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.Value);
            item.detail = detail;
            items.push(item);
          }
        }

        // crop: none shorthand
        if (prefix.match(/^crop:\s*/)) {
          const item = new vscode.CompletionItem('none', vscode.CompletionItemKind.Value);
          item.detail = 'No crop zone';
          items.push(item);
        }

        // no: restriction flags
        if (prefix.match(/^no:\s*/) || prefix.match(/^no:\s+\S.*\s+$/)) {
          for (const [v, detail] of [
            ['motion', 'Disallow animated/motion content'],
            ['video', 'Disallow video backgrounds'],
            ['photo', 'Disallow photo backgrounds'],
          ]) {
            const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.EnumMember);
            item.detail = detail;
            items.push(item);
          }
        }

        // Top-level format keywords at start of line
        if (prefix.match(/^\s*$/) || prefix.match(/^\s*[\w-]*$/)) {
          for (const [kw, detail] of [
            ['id:', 'Format identifier (e.g. sign-6:1)'],
            ['label:', 'Short display label (e.g. 6:1)'],
            ['sublabel:', 'Format type label (e.g. Sign)'],
            ['category:', 'Format category -- instagram|linkedin|print|signage'],
            ['size:', 'Canvas dimensions -- px (e.g. 1080 1080) or mm (e.g. 594mm 297mm)'],
            ['dpi:', 'Resolution -- print/signage only (default: 300)'],
            ['bleed:', 'Bleed margin -- mm (e.g. 3mm)'],
            ['grid:', 'Custom grid override -- rows cols (e.g. 1 8)'],
            ['danger:', 'Danger zone insets -- 1, 2, or 4 values (T R B L)'],
            ['crop:', 'Crop zone insets -- T R B L, or none'],
            ['comfort:', 'Inner margin -- px or mm (e.g. 10mm)'],
            ['no:', 'Capability restrictions -- motion video photo'],
            ['purposes:', 'Allowed purpose IDs (comma-separated)'],
          ]) {
            const item = new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword);
            item.detail = detail;
            items.push(item);
          }
        }

        return items;
      }
    },
    ' ', ':'
  );

  // ── Brand file completions ───────────────────────────────────────────────
  const brandProvider = vscode.languages.registerCompletionItemProvider(
    'brand-intent-brand',
    {
      provideCompletionItems(document, position) {
        const line = document.lineAt(position).text;
        const prefix = line.substring(0, position.character);
        const items = [];

        // tokens: enum values
        if (prefix.match(/^tokens:\s*/)) {
          for (const [v, detail] of [
            ['figma', 'Token source: Figma file sync'],
            ['inline', 'Token source: inline theme blocks in this file'],
          ]) {
            const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.EnumMember);
            item.detail = detail;
            items.push(item);
          }
        }

        // language: values
        if (prefix.match(/^language:\s*/)) {
          for (const [v, detail] of [['de', 'German'], ['en', 'English'], ['fr', 'French'], ['es', 'Spanish']]) {
            const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.Value);
            item.detail = detail;
            items.push(item);
          }
        }

        // locale: values
        if (prefix.match(/^locale:\s*/)) {
          for (const [v, detail] of [
            ['de-DE', 'German (Germany)'], ['en-US', 'English (US)'], ['en-GB', 'English (UK)'],
            ['fr-FR', 'French (France)'], ['es-ES', 'Spanish (Spain)'],
          ]) {
            const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.Value);
            item.detail = detail;
            items.push(item);
          }
        }

        // theme ThemeName — generic prompt (no brand-specific names)
        if (prefix.match(/^theme\s+$/)) {
          for (const [v, detail] of [
            ['Primary', 'Primary brand theme'],
            ['Secondary', 'Secondary/alternate theme'],
            ['Dark', 'Dark mode theme'],
            ['Light', 'Light mode theme'],
          ]) {
            const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.EnumMember);
            item.detail = detail;
            items.push(item);
          }
        }

        // voice-constraints block properties
        if (prefix.match(/^\s{2,}$/) || prefix.match(/^\s{2,}[\w-]*$/)) {
          // Check if we're inside a voice-constraints block
          let inVoiceConstraints = false;
          let inContentDefaults = false;
          for (let i = position.line - 1; i >= 0; i--) {
            const prevLine = document.lineAt(i).text;
            if (prevLine.match(/^voice-constraints\s*$/)) { inVoiceConstraints = true; break; }
            if (prevLine.match(/^content-defaults\s*$/)) { inContentDefaults = true; break; }
            if (!prevLine.match(/^\s/) && prevLine.trim() !== '') break;
          }

          if (inVoiceConstraints) {
            for (const [p, detail] of [
              ['register:', 'Voice register (e.g. formal, casual, friendly)'],
              ['sentence-max:', 'Maximum sentence length'],
              ['headline-pattern:', 'Headline writing pattern'],
              ['number-format:', 'Number formatting convention'],
            ]) {
              const item = new vscode.CompletionItem(p, vscode.CompletionItemKind.Property);
              item.detail = detail;
              items.push(item);
            }
          } else if (inContentDefaults) {
            for (const [p, detail] of [
              ['density:', 'Default content density (light, medium, full)'],
              ['image-treatment:', 'Default image treatment'],
              ['divider:', 'Default divider style'],
            ]) {
              const item = new vscode.CompletionItem(p, vscode.CompletionItemKind.Property);
              item.detail = detail;
              items.push(item);
            }
          } else {
            // Generic indented properties (theme slots, spacing, font, typography, divider)
            for (const [slot, detail] of [
              ['background:', 'Canvas background color'],
              ['text-primary:', 'Primary text color'],
              ['text-secondary:', 'Secondary text color'],
              ['text-tertiary:', 'Tertiary text color'],
              ['text-subtle:', 'Subtle text color'],
              ['text-muted:', 'Muted text color'],
              ['logo:', 'Logo tint color'],
              ['sticker-bg:', 'Sticker background color'],
              ['sticker-fg:', 'Sticker foreground color'],
              ['cta:', 'Call-to-action accent color'],
              ['icon:', 'Icon color'],
              ['unit:', 'Spacing unit (e.g. cqmin)'],
              ['xs:', 'Extra-small spacing value'],
              ['s:', 'Small spacing value'],
              ['m:', 'Medium spacing value'],
              ['l:', 'Large spacing value'],
              ['xl:', 'Extra-large spacing value'],
              ['name:', 'Font family name'],
              ['fallback:', 'Fallback font family'],
              ['source:', 'Font source path or URL'],
              ['thickness:', 'Divider thickness'],
              ['width:', 'Divider width'],
              ['color:', 'Divider color'],
              ['spacing:', 'Divider spacing'],
              ['align:', 'Divider alignment'],
            ]) {
              const item = new vscode.CompletionItem(slot, vscode.CompletionItemKind.Property);
              item.detail = detail;
              items.push(item);
            }
          }
        }

        // Top-level brand keywords at start of line
        if (prefix.match(/^\s*$/) || prefix.match(/^\s*[\w-]*$/)) {
          for (const [kw, detail] of [
            ['id:', 'Brand identifier'],
            ['name:', 'Display name'],
            ['language:', 'Primary language code (e.g. de, en)'],
            ['locale:', 'Locale (e.g. de-DE, en-US)'],
            ['domain:', 'Deployment domain'],
            ['app-icon:', 'App icon path'],
            ['favicon:', 'Favicon path'],
            ['tokens:', 'Token source -- figma or inline'],
            ['figma-file-key:', 'Figma file key (tokens: figma only)'],
            ['figma-collection:', 'Figma collection name (tokens: figma only)'],
            ['tokens-file:', 'Runtime tokens file path (default: tokens.json)'],
            ['theme ', 'Inline color theme block (tokens: inline only)'],
            ['spacing:', 'Spacing scale block (tokens: inline only)'],
            ['brand-colors', 'Brand color definitions block'],
            ['voice-constraints', 'Voice and writing constraints block'],
            ['content-defaults', 'Default content settings block'],
            ['font ', 'Named font definition block'],
            ['typography ', 'Named typography style block'],
            ['divider ', 'Named divider style block'],
          ]) {
            const item = new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword);
            item.detail = detail;
            items.push(item);
          }
        }

        return items;
      }
    },
    ' ', ':'
  );

  // ── Identity file completions ────────────────────────────────────────────
  const identityProvider = vscode.languages.registerCompletionItemProvider(
    'brand-intent-identity',
    {
      provideCompletionItems(document, position) {
        const line = document.lineAt(position).text;
        const prefix = line.substring(0, position.character);
        const items = [];

        // Detect which block we're in
        let currentBlock = null;
        for (let i = position.line - 1; i >= 0; i--) {
          const prevLine = document.lineAt(i).text;
          if (prevLine.match(/^voice\s*$/)) { currentBlock = 'voice'; break; }
          if (prevLine.match(/^pillars\s*$/)) { currentBlock = 'pillars'; break; }
          if (prevLine.match(/^audience\s+/)) { currentBlock = 'audience'; break; }
          if (!prevLine.match(/^\s/) && prevLine.trim() !== '') break;
        }

        // Indented properties inside blocks
        if (prefix.match(/^\s+$/) || prefix.match(/^\s+[\w]*$/)) {
          if (currentBlock === 'voice') {
            for (const [p, detail] of [
              ['register:', 'Voice register (e.g. warm, authoritative, playful)'],
              ['persona:', 'Brand persona description'],
              ['rhythm:', 'Writing rhythm (e.g. short-punchy, flowing)'],
              ['always:', 'Voice traits to always use'],
              ['never:', 'Voice traits to never use'],
            ]) {
              const item = new vscode.CompletionItem(p, vscode.CompletionItemKind.Property);
              item.detail = detail;
              items.push(item);
            }
          } else if (currentBlock === 'pillars') {
            for (const [p, detail] of [
              ['primary:', 'Primary brand pillar'],
              ['secondary:', 'Secondary brand pillar'],
              ['avoid:', 'Anti-pillar -- what the brand avoids'],
            ]) {
              const item = new vscode.CompletionItem(p, vscode.CompletionItemKind.Property);
              item.detail = detail;
              items.push(item);
            }
          } else if (currentBlock === 'audience') {
            for (const [p, detail] of [
              ['label:', 'Audience segment label'],
              ['profile:', 'Audience profile description'],
              ['motivation:', 'What motivates this audience'],
              ['language:', 'Language preferences for this audience'],
            ]) {
              const item = new vscode.CompletionItem(p, vscode.CompletionItemKind.Property);
              item.detail = detail;
              items.push(item);
            }
          }
        }

        // Top-level identity keywords at start of line
        if (prefix.match(/^\s*$/) || prefix.match(/^\s*[\w-]*$/)) {
          for (const [kw, detail] of [
            ['essence:', 'Core brand essence -- one-line distillation'],
            ['promise:', 'Brand promise to the audience'],
            ['voice', 'Voice characteristics block'],
            ['pillars', 'Brand pillars block'],
            ['audience ', 'Audience segment block (followed by segment name)'],
          ]) {
            const item = new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword);
            item.detail = detail;
            items.push(item);
          }
        }

        return items;
      }
    },
    ' ', ':'
  );

  // ── Hover documentation ──────────────────────────────────────────────────

  /** @type {Record<string, string>} */
  const COMPOSITION_HOVER_DOCS = {
    'image:': '**`image:`** -- Photo region.\n\n`full` fills the canvas. `none` disables the image. Region keywords like `top--center` define partial fills.\nOptional `cols 1--2` restricts the photo to specific columns.',
    'logo:': '**`logo:`** -- Logo position.\n\n`row N col X` places the logo at grid row N (1-6), column X.\n`top/center/bottom col X` uses grid keywords.\n\n**col values:** `left`, `right`, `center`.\n\n**size (optional):** `s` (65%), `m` (default, 100%), `l` (140%) of base logo size.',
    'icon:': '**`icon:`** -- Icon slot position.\n\nSame syntax as `logo:` but for a decorative icon.\n\nIcons are always decorative -- set the icon in the `.purpose` file with `defaultIcon:`.',
    'grid:': '**`grid:`** -- Native grid declaration.\n\n`grid: rows cols` declares that this composition was designed for a specific grid.\nWhen the format\'s grid matches, column indices are used directly (no proportional mapping).',
    'mode:': '**`mode:`** -- Layout mode.\n\n`grid` = grid-based positioning. `flow` = content-driven reflow.',
    'flow:': '**`flow:`** -- Flow region.\n\nBare `flow:` fills remaining space.\n`flow: panel bottom-left 2/3 1/1` creates a floating panel.\n`flow: split bottom 1/2` splits canvas -- text in specified fraction, image fills the rest.\n\nWith `image: full` + `split`, photo covers entire canvas and text overlays the split region.',
    'sticky:': '**`sticky:`** -- Sticky bar.\n\n`sticky: top s` creates a small bar at the top.\nContains `| logo` and `| label` items.\n\nPositions: `top`, `bottom`, `left`, `right`. Sizes: `s`, `m`, `l`.',
    'primary': '**`primary`** -- Primary text slot.\n\nThe headline or main message. Usually largest and most prominent.',
    'secondary': '**`secondary`** -- Secondary text slot.\n\nSupporting text. Smaller than primary.',
    'detail': '**`detail`** -- Detail text slot.\n\nSmall supporting text for dates, locations, or context.',
    'meta': '**`meta`** -- Meta text slot.\n\nMetadata like author, date, or category.',
    'cta': '**`cta`** -- Call-to-action slot.\n\nAction prompt or button label.',
    'label': '**`label`** -- Label badge slot.\n\nSmall label or tag, often used for categories or badges.',
  };

  /** @type {Record<string, string>} */
  const PURPOSE_HOVER_DOCS = {
    'compositions:': '**`compositions:`** -- Preferred compositions.\n\nComma-separated list of `.composition` file IDs. The layout engine randomly picks from this list.\n\nExample: `compositions: bottom-left, center-left, editorial`',
    'density:': '**`density:`** -- Content density.\n\n`light` = minimal content, `medium` = standard, `full` = maximum content density.',
    'defaultIcon:': '**`defaultIcon:`** -- Default Phosphor icon.\n\nKebab-case Phosphor icon name, optionally followed by a weight.\n\nExample: `defaultIcon: calendar regular`\n\nWeights: `thin`, `light`, `regular`, `bold`, `fill`, `duotone`',
    'slot': '**`slot`** -- Text slot definition.\n\nFollowed by `primary`, `secondary`, `detail`, `meta`, `cta`, or `label`.\nIndented properties below define the slot\'s typography and content.',
    'identity-filter': '**`identity-filter`** -- Filter identity traits for this purpose.\n\nIndented properties specify which audience segments or pillars to prioritize when this purpose is active.',
    'identity-extension': '**`identity-extension`** -- Extend identity traits for this purpose.\n\nIndented properties add purpose-specific voice or content traits that augment the base identity.',
    'label:': '**`label:`** -- Display name for this slot in the UI.',
    'samples:': '**`samples:`** -- Sample texts for this slot.\n\nInline: pipe-separated (`|`) list. Multi-line: bare `samples:` followed by `- ` lines.\nOne variant is picked randomly when creating a new page.',
    'maxLength:': '**`maxLength:`** -- Maximum character count for this slot.',
    'font:': '**`font:`** -- Font family name and weight.',
    'size:': '**`size:`** -- Base font size.\n\nScaled proportionally to the canvas.',
    'lineHeight:': '**`lineHeight:`** -- Line height multiplier (e.g. `1.1`).',
    'letterSpacing:': '**`letterSpacing:`** -- Letter spacing in em (e.g. `0.02`).',
    'opsz:': '**`opsz:`** -- Optical size axis value for variable fonts.',
    'typography:': '**`typography:`** -- Typography style reference.\n\nReferences a named typography style from the `.brand` file (e.g. `$heading`).',
    'color:': '**`color:`** -- Color token reference.\n\nReferences a color token from the `.brand` file (e.g. `$text-primary`).',
  };

  /** @type {Record<string, string>} */
  const BRAND_HOVER_DOCS = {
    'id:': '**`id:`** -- Brand identifier.\n\nUsed as the key in multi-brand setups and as the brand file name.',
    'name:': '**`name:`** -- Display name for this brand.',
    'language:': '**`language:`** -- Primary language code.\n\nUsed for AI context and text direction hints.\n\nExample: `language: de`',
    'locale:': '**`locale:`** -- Full locale code.\n\nUsed for date/number formatting.\n\nExample: `locale: de-DE`',
    'domain:': '**`domain:`** -- Deployment domain.',
    'app-icon:': '**`app-icon:`** -- Path to the app icon asset.\n\nUsed for PWA manifest and favicon generation.',
    'tokens:': '**`tokens:`** -- Token source mode.\n\n`figma` -- tokens synced from Figma\n`inline` -- tokens authored directly in this file as `theme` blocks',
    'figma-file-key:': '**`figma-file-key:`** -- Figma file key for token sync.\n\nRequired when `tokens: figma`.\n\nFound in the Figma file URL: `figma.com/design/FILEKEY/...`',
    'figma-collection:': '**`figma-collection:`** -- Figma variable collection name.\n\nThe collection to read color variables from.',
    'tokens-file:': '**`tokens-file:`** -- Runtime tokens file path.\n\nDefaults to `tokens.json`.',
    'theme': '**`theme ThemeName`** -- Inline color theme block.\n\nOnly used when `tokens: inline`. Each theme defines color slots.\nIndented lines: `slot-name: #HEX  # optional annotation`',
    'spacing:': '**`spacing:`** -- Spacing scale block.\n\nOnly used when `tokens: inline`. Indented key-value pairs define the spacing unit and named sizes.\n\n```\nspacing:\n  unit: cqmin\n  xs: 1.5\n  s: 2\n  m: 3\n  l: 5\n  xl: 6.5\n```',
    'voice-constraints': '**`voice-constraints`** -- Voice and writing constraints block.\n\nDefines guardrails for content generation: register, sentence length, headline patterns, number formatting.',
    'content-defaults': '**`content-defaults`** -- Default content settings block.\n\nDefines default density, image treatment, and divider style for content created under this brand.',
    'brand-colors': '**`brand-colors`** -- Brand color definitions.\n\nDefines named brand colors with optional print specifications (Pantone, HKS, CMYK).',
    'font': '**`font Name`** -- Named font definition block.\n\nDefines a font family with name, fallback, and source.',
    'typography': '**`typography Name`** -- Named typography style block.\n\nDefines reusable typography settings (font ref, weight, size, line height, etc.).',
    'divider': '**`divider Name`** -- Named divider style block.\n\nDefines a reusable divider style (thickness, width, color, spacing, alignment).',
  };

  /** @type {Record<string, string>} */
  const FORMAT_HOVER_DOCS = {
    'category:': '**`category:`** -- Output category.\n\n`instagram` -- Square/portrait social\n`linkedin` -- Landscape social\n`print` -- Physical print (uses mm + dpi)\n`signage` -- Large-format display (uses mm + dpi)',
    'size:': '**`size:`** -- Canvas dimensions.\n\n`size: width height` in px (social) or mm (print/signage).\n\nExample: `size: 1080 1350` or `size: 594mm 841mm`',
    'dpi:': '**`dpi:`** -- Resolution for print/signage formats.\n\nCommon values: `72` (screen), `150` (large-format), `300` (standard print).',
    'bleed:': '**`bleed:`** -- Bleed margin in mm.\n\nExtra area beyond the trim edge for print. Typically `3` or `5` mm.',
    'comfort:': '**`comfort:`** -- Comfort margin in px (or mm for print).\n\nInner padding from the danger zone edge. Keeps text visually clear of the boundary.',
    'danger:': '**`danger:`** -- Danger zone insets.\n\nCSS-style shorthand: 1, 2, or 4 values.\n`danger: 0` -- all sides 0\n`danger: 10 20` -- top/bottom 10, left/right 20\n`danger: 10 20 30 40` -- top right bottom left',
    'crop:': '**`crop:`** -- Crop/trim insets.\n\nSame shorthand as `danger:`. Marks the physical trim line for print.',
    'grid:': '**`grid:`** -- Custom grid for this format.\n\n`grid: rows cols` -- overrides the default portrait/landscape grid.',
    'no:': '**`no:`** -- Capability restrictions.\n\nSpace-separated flags: `motion`, `video`, `photo`.\n\nExample: `no: motion video` disables animated logos and video backgrounds.',
    'purposes:': '**`purposes:`** -- Allowed purpose IDs.\n\nComma-separated list. When set, only these purposes are available for this format.\n\nAbsent = all purposes allowed.',
  };

  /** @type {Record<string, string>} */
  const IDENTITY_HOVER_DOCS = {
    'essence:': '**`essence:`** -- Core brand essence.\n\nA one-line distillation of what the brand fundamentally is.',
    'promise:': '**`promise:`** -- Brand promise.\n\nThe commitment the brand makes to its audience.',
    'voice': '**`voice`** -- Voice characteristics block.\n\nDefines the brand\'s voice traits: register, persona, rhythm, and behavioral guidelines (always/never).',
    'pillars': '**`pillars`** -- Brand pillars block.\n\nDefines primary and secondary brand pillars, plus anti-pillars (what the brand avoids).',
    'audience': '**`audience Name`** -- Audience segment block.\n\nDefines a target audience segment with label, profile, motivation, and language preferences.',
    'register:': '**`register:`** -- Voice register.\n\nThe tonal register of the brand voice (e.g. warm, authoritative, playful, professional).',
    'persona:': '**`persona:`** -- Brand persona.\n\nA description of the brand as if it were a person.',
    'rhythm:': '**`rhythm:`** -- Writing rhythm.\n\nThe cadence and flow of brand copy (e.g. short-punchy, flowing, staccato).',
    'always:': '**`always:`** -- Voice traits to always use.\n\nGuidelines for what the brand voice should consistently do.',
    'never:': '**`never:`** -- Voice traits to never use.\n\nGuidelines for what the brand voice should avoid.',
    'primary:': '**`primary:`** -- Primary brand pillar.\n\nThe most important brand value or attribute.',
    'secondary:': '**`secondary:`** -- Secondary brand pillar.\n\nA supporting brand value or attribute.',
    'avoid:': '**`avoid:`** -- Anti-pillar.\n\nWhat the brand deliberately avoids or stands against.',
    'label:': '**`label:`** -- Audience segment label.\n\nShort name for this audience segment.',
    'profile:': '**`profile:`** -- Audience profile.\n\nDescription of who this audience is.',
    'motivation:': '**`motivation:`** -- Audience motivation.\n\nWhat drives this audience to engage with the brand.',
    'language:': '**`language:`** -- Audience language preferences.\n\nHow this audience prefers to be spoken to.',
  };

  /**
   * @param {Record<string, string>} docs
   * @returns {vscode.HoverProvider}
   */
  function makeHoverProvider(docs) {
    return {
      /** @param {vscode.TextDocument} document @param {vscode.Position} position */
      provideHover(document, position) {
        const line = document.lineAt(position).text.trim();
        for (const [keyword, md] of Object.entries(docs)) {
          // Match keyword at start of (trimmed) line, or as a bare word
          const pattern = keyword.endsWith(':')
            ? new RegExp(`^${keyword.replace(':', '\\:')}`)
            : new RegExp(`^${keyword}(?:\\s|$)`);
          if (pattern.test(line)) {
            return new vscode.Hover(new vscode.MarkdownString(md));
          }
        }
        return null;
      }
    };
  }

  const compositionHover = vscode.languages.registerHoverProvider(
    [{ language: 'brand-intent-composition' }],
    makeHoverProvider(COMPOSITION_HOVER_DOCS)
  );

  const purposeHover = vscode.languages.registerHoverProvider(
    'brand-intent-purpose',
    makeHoverProvider(PURPOSE_HOVER_DOCS)
  );

  const formatHover = vscode.languages.registerHoverProvider(
    'brand-intent-format',
    makeHoverProvider(FORMAT_HOVER_DOCS)
  );

  const brandHover = vscode.languages.registerHoverProvider(
    'brand-intent-brand',
    makeHoverProvider(BRAND_HOVER_DOCS)
  );

  const identityHover = vscode.languages.registerHoverProvider(
    'brand-intent-identity',
    makeHoverProvider(IDENTITY_HOVER_DOCS)
  );

  context.subscriptions.push(
    compositionProvider, purposeProvider, formatProvider, brandProvider, identityProvider,
    compositionHover, purposeHover, formatHover, brandHover, identityHover
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
