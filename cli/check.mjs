// cli/check.ts
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// parser/identityParser.ts
function parseIdentityFile(content, fileName) {
  const lines = content.split("\n");
  let essence = "";
  let promise = "";
  let tagline = "";
  let positioning = "";
  let purpose = "";
  let mission = "";
  let vision = "";
  let archetype = "";
  const narratives = [];
  let currentNarrative = null;
  const voice = { always: [], never: [] };
  const pillars = { primary: [], avoid: [] };
  const audiences = {};
  const antiAudiences = {};
  const values = [];
  const imagery = { always: [], never: [] };
  let imageryDeclared = false;
  const imageThemes = [];
  let currentImageTheme = null;
  const goals = {};
  let currentGoal = "";
  const review = {};
  let reviewDeclared = false;
  let block = "top";
  let currentAudience = "";
  let currentAntiAudience = "";
  let currentValueName = "";
  let currentValueBehavior = "";
  let currentValueSay = [];
  let currentValueNot = [];
  let listTarget = null;
  let continuationKey = null;
  function flushNarrative() {
    if (currentNarrative && currentNarrative.text) {
      narratives.push({
        name: currentNarrative.name,
        primary: currentNarrative.primary,
        text: currentNarrative.text.trim()
      });
    }
    currentNarrative = null;
  }
  function flushValue() {
    if (currentValueName && currentValueBehavior) {
      const value = { name: currentValueName, behavior: currentValueBehavior.trim() };
      if (currentValueSay.length > 0) value.say = currentValueSay;
      if (currentValueNot.length > 0) value.not = currentValueNot;
      values.push(value);
    }
    currentValueName = "";
    currentValueBehavior = "";
    currentValueSay = [];
    currentValueNot = [];
  }
  function flushImageTheme() {
    if (currentImageTheme && currentImageTheme.text) {
      imageThemes.push({ ...currentImageTheme, text: currentImageTheme.text.trim() });
    }
    currentImageTheme = null;
  }
  function flushBlock() {
    if (block === "values") flushValue();
    if (block === "narrative") flushNarrative();
    if (block === "image-theme") flushImageTheme();
  }
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNum = i + 1;
    const line = raw.replace(/\s+#.*$/, "");
    if (line.trim() === "" || line.trim().startsWith("#")) {
      if (line.trim() === "") continuationKey = null;
      continue;
    }
    if (block === "values" && /^\s{2,}/.test(raw) && !raw.trim().startsWith("#")) {
      const indent = raw.match(/^(\s*)/)?.[1].length ?? 0;
      const text = raw.trim();
      const example = text.match(/^(say|not):\s*(.+)$/);
      if (indent <= 2 && !text.includes(":")) {
        flushValue();
        currentValueName = text;
      } else if (currentValueName && example) {
        (example[1] === "say" ? currentValueSay : currentValueNot).push(example[2].trim());
      } else if (currentValueName) {
        currentValueBehavior += (currentValueBehavior ? " " : "") + text;
      }
      continue;
    }
    if (block === "narrative" && currentNarrative && /^\s{2,}/.test(raw) && !raw.trim().startsWith("#")) {
      const trimmed = raw.trim();
      if (trimmed === "primary") {
        currentNarrative.primary = true;
      } else {
        currentNarrative.text += (currentNarrative.text ? "\n" : "") + trimmed;
      }
      continue;
    }
    if (block === "image-theme" && currentImageTheme && /^\s{2,}/.test(raw) && !raw.trim().startsWith("#")) {
      const trimmed = raw.trim();
      const ref = trimmed.match(/^narrative:\s*(.+)$/);
      if (ref) currentImageTheme.narrative = ref[1].trim();
      else currentImageTheme.text += (currentImageTheme.text ? "\n" : "") + trimmed;
      continue;
    }
    if (/^\s{2,}/.test(raw) && !raw.trim().startsWith("-") && !raw.trim().includes(":")) {
      const continuation = raw.trim();
      if (continuationKey) {
        if (continuationKey === "essence") essence += " " + continuation;
        else if (continuationKey === "promise") promise += " " + continuation;
        else if (continuationKey === "positioning") positioning += " " + continuation;
        else if (continuationKey === "purpose") purpose += " " + continuation;
        else if (continuationKey === "mission") mission += " " + continuation;
        else if (continuationKey === "vision") vision += " " + continuation;
        continue;
      }
    }
    const listMatch = raw.match(/^\s{4,}-\s+(.+)/);
    if (listMatch && listTarget) {
      const value = listMatch[1].trim();
      switch (listTarget) {
        case "always":
          voice.always.push(value);
          break;
        case "never":
          voice.never.push(value);
          break;
        case "primary":
          pillars.primary.push(value);
          break;
        case "secondary":
          (pillars.secondary ??= []).push(value);
          break;
        case "avoid":
          pillars.avoid.push(value);
          break;
        case "instead": {
          const arrow = value.indexOf("->");
          if (arrow === -1) throw new Error(`${fileName}:${lineNum}: voice.instead item must be "PHRASE -> REPLACEMENT", got "${value}"`);
          const unquote = (s) => s.trim().replace(/^["„“](.*)["“”]$/, "$1");
          (voice.instead ??= []).push({ avoid: unquote(value.slice(0, arrow)), use: unquote(value.slice(arrow + 2)) });
          break;
        }
        case "imagery-always":
          imagery.always.push(value);
          break;
        case "imagery-never":
          imagery.never.push(value);
          break;
        case "goal-always":
          (goals[currentGoal].always ??= []).push(value);
          break;
        case "goal-never":
          (goals[currentGoal].never ??= []).push(value);
          break;
        case "review-copy":
          (review.copy ??= []).push(value);
          break;
        case "review-image":
          (review.image ??= []).push(value);
          break;
      }
      continuationKey = null;
      continue;
    }
    const propMatch = raw.match(/^\s{2,}([\w-]+):\s*(.*)/);
    if (propMatch) {
      const [, key, value] = propMatch;
      const val = value.trim();
      listTarget = null;
      continuationKey = null;
      if (block === "voice") {
        switch (key) {
          case "register":
            voice.register = val;
            break;
          case "persona":
            voice.persona = val;
            break;
          case "rhythm":
            voice.rhythm = val;
            break;
          case "always":
            listTarget = "always";
            break;
          case "never":
            listTarget = "never";
            break;
          case "instead":
            listTarget = "instead";
            break;
          default:
            throw new Error(`${fileName}:${lineNum}: unknown voice key "${key}"`);
        }
      } else if (block === "pillars") {
        switch (key) {
          case "primary":
            if (val) pillars.primary = val.split(",").map((s) => s.trim());
            else listTarget = "primary";
            break;
          case "secondary":
            if (val) pillars.secondary = val.split(",").map((s) => s.trim());
            else listTarget = "secondary";
            break;
          case "avoid":
            if (val) pillars.avoid = val.split(",").map((s) => s.trim());
            else listTarget = "avoid";
            break;
          default:
            throw new Error(`${fileName}:${lineNum}: unknown pillars key "${key}"`);
        }
      } else if (block === "audience" && currentAudience) {
        const aud = audiences[currentAudience] ??= {};
        switch (key) {
          case "label":
            aud.label = val;
            break;
          case "profile":
            aud.profile = val;
            break;
          case "motivation":
            aud.motivation = val;
            break;
          case "language":
            aud.language = val;
            break;
          default:
            throw new Error(`${fileName}:${lineNum}: unknown audience key "${key}"`);
        }
      } else if (block === "anti-audience" && currentAntiAudience) {
        const aa = antiAudiences[currentAntiAudience] ??= {};
        switch (key) {
          case "label":
            aa.label = val;
            break;
          case "description":
            aa.description = val;
            break;
          default:
            throw new Error(`${fileName}:${lineNum}: unknown anti-audience key "${key}"`);
        }
      } else if (block === "imagery") {
        switch (key) {
          case "always":
            listTarget = "imagery-always";
            break;
          case "never":
            listTarget = "imagery-never";
            break;
          default:
            throw new Error(`${fileName}:${lineNum}: unknown imagery key "${key}"`);
        }
      } else if (block === "goal" && currentGoal) {
        const goal = goals[currentGoal];
        switch (key) {
          case "label":
            goal.label = val;
            break;
          case "question":
            goal.question = val;
            break;
          case "share": {
            const m = val.match(/^(\d+(?:\.\d+)?)%$/);
            const n = m ? parseFloat(m[1]) : NaN;
            if (!(n >= 0 && n <= 100)) throw new Error(`${fileName}:${lineNum}: goal share must be a percentage between 0% and 100%, got "${val}"`);
            goal.share = n;
            break;
          }
          case "narratives":
            goal.narratives = val.split(",").map((s) => s.trim()).filter(Boolean);
            break;
          case "always":
            listTarget = "goal-always";
            break;
          case "never":
            listTarget = "goal-never";
            break;
          default:
            throw new Error(`${fileName}:${lineNum}: unknown goal key "${key}"`);
        }
      } else if (block === "review") {
        switch (key) {
          case "copy":
            listTarget = "review-copy";
            break;
          case "image":
            listTarget = "review-image";
            break;
          default:
            throw new Error(`${fileName}:${lineNum}: unknown review key "${key}"`);
        }
      }
      continue;
    }
    const topMatch = line.match(/^([\w-]+):\s*(.*)/);
    if (topMatch) {
      const [, key, value] = topMatch;
      const val = value.trim();
      flushBlock();
      block = "top";
      listTarget = null;
      continuationKey = null;
      switch (key) {
        case "essence":
          essence = val;
          continuationKey = "essence";
          break;
        case "promise":
          promise = val;
          continuationKey = "promise";
          break;
        case "tagline":
          tagline = val;
          break;
        case "positioning":
          positioning = val;
          continuationKey = "positioning";
          break;
        case "purpose":
          purpose = val;
          continuationKey = "purpose";
          break;
        case "mission":
          mission = val;
          continuationKey = "mission";
          break;
        case "vision":
          vision = val;
          continuationKey = "vision";
          break;
        case "archetype":
          archetype = val;
          break;
        default:
          throw new Error(`${fileName}:${lineNum}: unknown top-level key "${key}"`);
      }
      continue;
    }
    if (raw.match(/^voice\s*$/)) {
      flushBlock();
      block = "voice";
      listTarget = null;
      continuationKey = null;
      continue;
    }
    if (raw.match(/^pillars\s*$/)) {
      flushBlock();
      block = "pillars";
      listTarget = null;
      continuationKey = null;
      continue;
    }
    if (raw.match(/^values\s*$/)) {
      flushBlock();
      block = "values";
      listTarget = null;
      continuationKey = null;
      continue;
    }
    const narrativeMatch = raw.match(/^narrative\s+(.+?)\s*$/);
    if (narrativeMatch) {
      flushBlock();
      block = "narrative";
      currentNarrative = { name: narrativeMatch[1].trim(), primary: false, text: "" };
      listTarget = null;
      continuationKey = null;
      continue;
    }
    if (raw.match(/^imagery\s*$/)) {
      flushBlock();
      block = "imagery";
      imageryDeclared = true;
      listTarget = null;
      continuationKey = null;
      continue;
    }
    if (raw.match(/^review\s*$/)) {
      flushBlock();
      block = "review";
      reviewDeclared = true;
      listTarget = null;
      continuationKey = null;
      continue;
    }
    const imageThemeMatch = raw.match(/^image-theme\s+(.+?)\s*$/);
    if (imageThemeMatch) {
      flushBlock();
      block = "image-theme";
      currentImageTheme = { name: imageThemeMatch[1].trim(), text: "" };
      listTarget = null;
      continuationKey = null;
      continue;
    }
    const goalMatch = raw.match(/^goal\s+(\S+)\s*$/);
    if (goalMatch) {
      flushBlock();
      block = "goal";
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
      block = "audience";
      currentAudience = audienceMatch[1];
      audiences[currentAudience] ??= {};
      listTarget = null;
      continuationKey = null;
      continue;
    }
    const antiAudienceMatch = raw.match(/^anti-audience\s+(\S+)\s*$/);
    if (antiAudienceMatch) {
      flushBlock();
      block = "anti-audience";
      currentAntiAudience = antiAudienceMatch[1];
      antiAudiences[currentAntiAudience] ??= {};
      listTarget = null;
      continuationKey = null;
      continue;
    }
  }
  flushBlock();
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
  const narrativeNames = new Set(narratives.map((n) => n.name));
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
  const hexPattern = /#[0-9A-Fa-f]{3,8}\b/;
  if (hexPattern.test(content.replace(/#.*$/gm, ""))) {
    throw new Error(`${fileName}: identity files must not contain hex color values`);
  }
  const result = {
    essence,
    promise,
    voice,
    pillars,
    audiences
  };
  if (tagline) result.tagline = tagline;
  if (positioning) result.positioning = positioning;
  if (purpose) result.purpose = purpose;
  if (mission) result.mission = mission;
  if (vision) result.vision = vision;
  if (archetype) result.archetype = archetype;
  if (narratives.length > 0) result.narratives = narratives;
  if (values.length > 0) result.values = values;
  if (Object.keys(antiAudiences).length > 0) {
    result.antiAudiences = antiAudiences;
  }
  if (imageryDeclared) result.imagery = imagery;
  if (imageThemes.length > 0) result.imageThemes = imageThemes;
  if (Object.keys(goals).length > 0) {
    result.goals = Object.fromEntries(
      Object.entries(goals).map(([id, { line: _line, ...goal }]) => [id, goal])
    );
  }
  if (reviewDeclared) result.review = review;
  return result;
}

// parser/dateWindows.ts
var DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function parseDateWindowRanges(value) {
  const parts = value.split(",").map((p) => p.trim());
  if (parts.length === 0 || parts.some((p) => !p)) throw new Error(`expected "MM-DD..MM-DD", got "${value}"`);
  return parts.map((part) => {
    const m = part.match(/^(\d{2}-\d{2})\.\.(\d{2}-\d{2})$/);
    if (!m) throw new Error(`expected "MM-DD..MM-DD", got "${part}"`);
    for (const md of [m[1], m[2]]) {
      const [month, day] = md.split("-").map(Number);
      if (month < 1 || month > 12 || day < 1 || day > DAYS_IN_MONTH[month - 1]) throw new Error(`invalid date "${md}"`);
    }
    return { from: m[1], to: m[2] };
  });
}
var SAMPLE_WINDOW_MARKER = /\s+@([a-z][a-z0-9-]*)\s*$/;

// parser/placeParser.ts
var WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
var KEYS = /* @__PURE__ */ new Set(["id", "name", "address", "latitude", "longitude", "maps", "context", "opening"]);
var CAPACITY_KEYS = /* @__PURE__ */ new Set(["indoor", "outdoor"]);
var TIME = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;
var RANGE = /^(?:(.+?)\s+)?(\d{2}:\d{2})-(\d{2}:\d{2})$/;
function parseDays(spec) {
  const m = /^([a-z]{3})(?:-([a-z]{3}))?$/.exec(spec);
  if (!m) return null;
  const from = WEEKDAYS.indexOf(m[1]);
  const to = m[2] ? WEEKDAYS.indexOf(m[2]) : from;
  if (from === -1 || to === -1) return null;
  const days = [];
  for (let i = from; ; i = (i + 1) % 7) {
    days.push(WEEKDAYS[i]);
    if (i === to) break;
  }
  return days;
}
function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return (/* @__PURE__ */ new Date(`${value}T12:00:00Z`)).toISOString().slice(0, 10) === value;
}
function parsePlaceFile(content, fileName) {
  const raw = {};
  let description = "";
  let hours;
  let capacity;
  let block = null;
  content.split("\n").forEach((rawLine, i) => {
    const lineNum = i + 1;
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();
    if (line === "") return;
    if (line.startsWith("#")) {
      if (indent === 0) description = description ? `${description} ${line.slice(1).trim()}` : line.slice(1).trim();
      return;
    }
    if (indent === 0) {
      block = null;
      if (line === "hours") {
        if (hours) throw new Error(`${fileName}:${lineNum}: duplicate hours block`);
        hours = {};
        block = "hours";
        return;
      }
      if (line === "capacity") {
        if (capacity) throw new Error(`${fileName}:${lineNum}: duplicate capacity block`);
        capacity = {};
        block = "capacity";
        return;
      }
      const colonIdx2 = line.indexOf(":");
      if (colonIdx2 === -1) throw new Error(`${fileName}:${lineNum}: expected "key: value", got "${line}"`);
      const key = line.slice(0, colonIdx2).trim();
      const rest = line.slice(colonIdx2 + 1).trim();
      const value2 = key === "maps" ? rest : rest.replace(/\s+#.*$/, "");
      if (!KEYS.has(key)) throw new Error(`${fileName}:${lineNum}: unknown key "${key}" (expected ${[...KEYS].join(", ")}, an hours or a capacity block)`);
      if (raw[key]) throw new Error(`${fileName}:${lineNum}: duplicate "${key}"`);
      if (!value2) throw new Error(`${fileName}:${lineNum}: empty ${key}`);
      raw[key] = { value: value2, line: lineNum };
      return;
    }
    if (!block || indent !== 2) throw new Error(`${fileName}:${lineNum}: unexpected indent (entries use 2 spaces under "hours" or "capacity")`);
    const entry = line.replace(/\s+#.*$/, "");
    if (block === "capacity") {
      const m = /^([a-z]+):\s*(.*)$/.exec(entry);
      if (!m || !CAPACITY_KEYS.has(m[1])) throw new Error(`${fileName}:${lineNum}: capacity entry must be "indoor: N" or "outdoor: N", got "${line}"`);
      const side = m[1];
      if (capacity[side] !== void 0) throw new Error(`${fileName}:${lineNum}: duplicate capacity "${side}"`);
      if (!/^[1-9]\d*$/.test(m[2])) throw new Error(`${fileName}:${lineNum}: capacity ${side} must be a whole number of people, got "${m[2]}"`);
      capacity[side] = Number(m[2]);
      return;
    }
    const colonIdx = entry.indexOf(":");
    if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: hours entry must be "DAYS: RANGES", got "${line}"`);
    const daySpec = entry.slice(0, colonIdx).trim();
    const days2 = parseDays(daySpec);
    if (!days2) throw new Error(`${fileName}:${lineNum}: invalid days "${daySpec}" (expected a day like mon or a range like mon-fri)`);
    const value = entry.slice(colonIdx + 1).trim();
    let ranges = [];
    if (value !== "closed") {
      ranges = value.split(",").map((part) => {
        const m = RANGE.exec(part.trim());
        if (!m || !TIME.test(m[2]) || !TIME.test(m[3]) || m[2] === "24:00") {
          throw new Error(`${fileName}:${lineNum}: invalid opening range "${part.trim()}" (expected "HH:MM-HH:MM", optionally after a label, or closed)`);
        }
        if (m[2] === m[3]) throw new Error(`${fileName}:${lineNum}: opening range "${part.trim()}" starts and ends at the same time`);
        return { ...m[1] ? { label: m[1] } : {}, from: m[2], to: m[3] };
      });
    }
    for (const day of days2) {
      if (hours[day]) throw new Error(`${fileName}:${lineNum}: ${day} already has hours`);
      hours[day] = ranges;
    }
  });
  if (capacity && capacity.indoor === void 0 && capacity.outdoor === void 0) throw new Error(`${fileName}: empty capacity block (add "indoor:" or "outdoor:")`);
  if (!raw["id"]) throw new Error(`${fileName}: missing place id (add "id:" line)`);
  if (!raw["name"]) throw new Error(`${fileName}: place needs name:`);
  if (!raw["latitude"] !== !raw["longitude"]) throw new Error(`${fileName}: place needs both latitude: and longitude:, or neither`);
  const degrees = (key, limit) => {
    const { value, line } = raw[key];
    const n = Number(value);
    if (!/^-?\d+(\.\d+)?$/.test(value) || Math.abs(n) > limit) {
      throw new Error(`${fileName}:${line}: ${key} must be decimal degrees (\u2212${limit} to ${limit}), got "${value}"`);
    }
    return n;
  };
  if (raw["maps"] && !/^https:\/\/\S+$/.test(raw["maps"].value)) throw new Error(`${fileName}:${raw["maps"].line}: maps must be an https link`);
  if (raw["opening"] && !isDate(raw["opening"].value)) throw new Error(`${fileName}:${raw["opening"].line}: opening must be a date YYYY-MM-DD, got "${raw["opening"].value}"`);
  const days = hours && Object.fromEntries(WEEKDAYS.filter((d) => hours[d]?.length).map((d) => [d, hours[d]]));
  return {
    id: raw["id"].value,
    name: raw["name"].value,
    description,
    ...raw["address"] ? { address: raw["address"].value } : {},
    ...raw["latitude"] ? { latitude: degrees("latitude", 90), longitude: degrees("longitude", 180) } : {},
    ...raw["maps"] ? { maps: raw["maps"].value } : {},
    ...raw["context"] ? { context: raw["context"].value } : {},
    ...raw["opening"] ? { opening: raw["opening"].value } : {},
    ...days ? { hours: days } : {},
    ...capacity ? { capacity } : {}
  };
}
function weekOpeningDays(hours) {
  const times = (ranges) => ranges.map((r) => `${r.from}-${r.to}`).join(",");
  const lines = [];
  let prev;
  for (const day of WEEKDAYS) {
    const ranges = hours[day];
    if (!ranges?.length) {
      prev = void 0;
      continue;
    }
    const last = lines[lines.length - 1];
    if (last && prev && times(last.ranges) === times(ranges)) last.days.push(day);
    else lines.push({ days: [day], ranges });
    prev = day;
  }
  return lines;
}
function addressStreet(address) {
  return address.split(",")[0].trim();
}

// parser/timeParser.ts
var NAME = /^[a-z][a-z0-9-]*$/;
var TIME2 = /^([01]\d|2[0-3]):[0-5]\d$/;
var DAYS_IN_MONTH2 = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
var SEASON_KEYS = /* @__PURE__ */ new Set(["label", "from"]);
function isMonthDay(value) {
  const m = /^(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const month = Number(m[1]), day = Number(m[2]);
  return month >= 1 && month <= 12 && day >= 1 && day <= DAYS_IN_MONTH2[month - 1];
}
function isDate2(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return (/* @__PURE__ */ new Date(`${value}T12:00:00Z`)).toISOString().slice(0, 10) === value;
}
function isDateOrYear(value) {
  return /^\d{4}$/.test(value) || isDate2(value);
}
function parseTimeSpan(value) {
  const m = /^(\d{2}:\d{2})(?:-(\d{2}:\d{2}))?$/.exec(value);
  if (!m || !TIME2.test(m[1]) || m[2] && !TIME2.test(m[2])) return null;
  return m[2] ? { from: m[1], to: m[2] } : { from: m[1] };
}
function parseDayList(value) {
  const out = [];
  for (const part of value.split(",").map((p) => p.trim())) {
    const days = parseDays(part);
    if (!days) return null;
    for (const d of days) if (!out.includes(d)) out.push(d);
  }
  const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  return out.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}
function parseTimeFile(content, fileName) {
  let description = "";
  let founded;
  const blocks = [];
  const windowsRaw = [];
  const dailyRaw = [];
  let block = null;
  const names = /* @__PURE__ */ new Map();
  const declare = (name, lineNum, what) => {
    if (!NAME.test(name)) throw new Error(`${fileName}:${lineNum}: ${what} name must be lowercase kebab-case, got "${name}"`);
    const prev = names.get(name);
    if (prev !== void 0) throw new Error(`${fileName}:${lineNum}: "${name}" is already declared on line ${prev} (names are unique across the file)`);
    names.set(name, lineNum);
  };
  content.split("\n").forEach((rawLine, i) => {
    const lineNum = i + 1;
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();
    if (line === "") return;
    if (line.startsWith("#")) {
      if (indent === 0) description = description ? `${description} ${line.slice(1).trim()}` : line.slice(1).trim();
      return;
    }
    if (indent === 0) {
      block = null;
      const header = /^(season|weekly|date)\s+(\S+)\s*$/.exec(line);
      if (header && header[1] !== "season") {
        const key3 = header[1] === "weekly" ? "days:" : "on:";
        throw new Error(`${fileName}:${lineNum}: ${header[1]} "${header[2]}" is not part of the .time: an event is a work. Write works/${header[2]}.work with ${key3}, and name it with work: instead of when:`);
      }
      if (header) {
        declare(header[2], lineNum, "season");
        const named = { kind: "season", name: header[2], line: lineNum, props: {} };
        block = named;
        blocks.push(named);
        return;
      }
      if (line === "windows" || line === "daily") {
        if (blocks.some((b) => b.kind === line)) throw new Error(`${fileName}:${lineNum}: duplicate ${line} block`);
        const plain = { kind: line, line: lineNum };
        block = plain;
        blocks.push(plain);
        return;
      }
      const colonIdx2 = line.indexOf(":");
      if (colonIdx2 === -1) throw new Error(`${fileName}:${lineNum}: expected "founded: DATE", a "season NAME" block, "windows" or "daily", got "${line}"`);
      const key2 = line.slice(0, colonIdx2).trim();
      const value2 = line.slice(colonIdx2 + 1).trim().replace(/\s+#.*$/, "");
      if (key2 !== "founded") throw new Error(`${fileName}:${lineNum}: unknown key "${key2}" (expected founded, or a season, windows or daily block)`);
      if (founded) throw new Error(`${fileName}:${lineNum}: duplicate "founded"`);
      if (!isDateOrYear(value2)) throw new Error(`${fileName}:${lineNum}: founded must be a date YYYY-MM-DD or a year YYYY, got "${value2}"`);
      founded = { value: value2, line: lineNum };
      return;
    }
    if (!block || indent !== 2) throw new Error(`${fileName}:${lineNum}: unexpected indent (entries use 2 spaces under their block)`);
    const entry = line.replace(/\s+#.*$/, "");
    const colonIdx = entry.indexOf(":");
    if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: expected "key: value", got "${line}"`);
    const key = entry.slice(0, colonIdx).trim();
    const value = entry.slice(colonIdx + 1).trim();
    if (block.kind === "windows") {
      declare(key, lineNum, "window");
      windowsRaw.push({ name: key, value, line: lineNum });
      return;
    }
    if (block.kind === "daily") {
      declare(key, lineNum, "daily");
      dailyRaw.push({ name: key, value, line: lineNum });
      return;
    }
    if (!SEASON_KEYS.has(key)) throw new Error(`${fileName}:${lineNum}: unknown key "${key}" in season "${block.name}" (expected ${[...SEASON_KEYS].join(", ")})`);
    if (block.props[key]) throw new Error(`${fileName}:${lineNum}: duplicate "${key}" in season "${block.name}"`);
    if (!value) throw new Error(`${fileName}:${lineNum}: empty ${key}`);
    block.props[key] = { value, line: lineNum };
  });
  const seasons = [];
  for (const b of blocks) {
    if (b.kind !== "season") continue;
    const at = (key) => `${fileName}:${key && b.props[key] ? b.props[key].line : b.line}`;
    const need = (key) => {
      if (!b.props[key]) throw new Error(`${at()}: season "${b.name}" needs ${key}:`);
      return b.props[key].value;
    };
    const from = need("from");
    if (!isMonthDay(from)) throw new Error(`${at("from")}: season "${b.name}" from must be "MM-DD" (e.g. 03-01), got "${from}"`);
    const twin = seasons.find((s) => s.from === from);
    if (twin) throw new Error(`${at("from")}: seasons "${twin.name}" and "${b.name}" both start on ${from}`);
    seasons.push({ name: b.name, label: need("label"), from });
  }
  if (seasons.length === 1) throw new Error(`${fileName}: one season is no season (declare at least two, or none)`);
  const windows = {};
  for (const w of windowsRaw) {
    try {
      windows[w.name] = parseDateWindowRanges(w.value);
    } catch (e) {
      throw new Error(`${fileName}:${w.line}: window "${w.name}": ${e.message}`);
    }
  }
  const daily = [];
  for (const d of dailyRaw) {
    const m = /^(\d{2}:\d{2})(?:\s+(.+))?$/.exec(d.value);
    if (!m || !TIME2.test(m[1])) throw new Error(`${fileName}:${d.line}: daily "${d.name}" must be "HH:MM" followed by an optional label, got "${d.value}"`);
    const prev = daily[daily.length - 1];
    if (prev && m[1] < prev.time) throw new Error(`${fileName}:${d.line}: daily "${d.name}" at ${m[1]} comes before "${prev.name}" at ${prev.time} (moments are in order of the day)`);
    daily.push({ name: d.name, time: m[1], ...m[2] ? { label: m[2].trim() } : {} });
  }
  return {
    description,
    ...founded ? { founded: founded.value } : {},
    seasons,
    windows,
    daily
  };
}
function timeEntry(time, name) {
  if (time.windows[name]) return { kind: "window", name, ranges: time.windows[name] };
  const season = time.seasons.find((s) => s.name === name);
  if (season) return { kind: "season", name, season };
  return void 0;
}
function timeEntryNames(time) {
  return [...Object.keys(time.windows), ...time.seasons.map((s) => s.name)];
}

// parser/colorSystem.ts
var HEX6 = /^#[0-9a-fA-F]{6}$/;
function isHex6(value) {
  return HEX6.test(value);
}
function relativeLuminance(hex) {
  const channel = (i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
var DEFAULT_COLOR_RULES = {
  text: 4.5,
  figure: 3,
  avoid: [],
  tones: [1.8, 4.5]
};
function toneClass(hex, tones = DEFAULT_COLOR_RULES.tones) {
  const vsWhite = contrastRatio(hex, "#FFFFFF");
  if (vsWhite < tones[0]) return "light";
  if (vsWhite >= tones[1]) return "dark";
  return "mid";
}
function pairRuleViolations(ground, figure, rules) {
  const reasons = [];
  const ratio = contrastRatio(ground, figure);
  if (ratio < rules.figure) {
    reasons.push(`contrast ${ratio.toFixed(1)}:1 below ${rules.figure}:1`);
  }
  const tg = toneClass(ground, rules.tones);
  const tf = toneClass(figure, rules.tones);
  for (const [a, b] of rules.avoid) {
    if (tg === a && tf === b || tg === b && tf === a) {
      reasons.push(`${tg}+${tf} combination avoided`);
      break;
    }
  }
  return reasons;
}
var TEXT_TIERS = [
  ["text-secondary", 0.85],
  ["text-tertiary", 0.7],
  ["text-subtle", 0.55],
  ["text-muted", 0.4]
];
function withAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function derivePairSlots(ground, figure, text) {
  const slots = {
    "background": ground,
    "text-primary": text,
    "headline": text
  };
  for (const [slot, alpha] of TEXT_TIERS) slots[slot] = withAlpha(text, alpha);
  for (const slot of ["logo", "cta", "divider", "icon", "illustration", "sticker-bg", "label-bg", "counter-bg"]) {
    slots[slot] = figure;
  }
  slots["sticker-fg"] = ground;
  slots["label-fg"] = ground;
  slots["counter-fg"] = ground;
  return slots;
}
function resolveTextColor(ground, preferred, rules) {
  const candidates = preferred.filter(isHex6);
  const pool = candidates.length > 0 ? candidates : ["#000000", "#FFFFFF"];
  for (const c of pool) {
    const ratio = contrastRatio(ground, c);
    if (ratio >= rules.text) return { text: c, ratio, passes: true };
  }
  let best = pool[0];
  let bestRatio = contrastRatio(ground, best);
  for (const c of pool.slice(1)) {
    const ratio = contrastRatio(ground, c);
    if (ratio > bestRatio) {
      best = c;
      bestRatio = ratio;
    }
  }
  return { text: best, ratio: bestRatio, passes: false };
}
function cycleMembers(families) {
  const seasonal = families.flatMap((f, i) => f.season ? [i] : []);
  return seasonal.length > 0 ? seasonal : families.map((_, i) => i);
}
function reachableFamilies(count, index, config, members) {
  if (members) {
    const pos = members.indexOf(index);
    if (pos === -1) return /* @__PURE__ */ new Map();
    const inner = reachableFamilies(members.length, pos, config);
    return new Map([...inner].map(([j, dir]) => [members[j], dir]));
  }
  const reach = /* @__PURE__ */ new Map();
  if (config.borrow === "none") return reach;
  const wantPrev = config.borrow === "previous" || config.borrow === "both";
  const wantNext = config.borrow === "next" || config.borrow === "both";
  for (let d = 1; d <= config.distance; d++) {
    if (wantPrev) {
      const j = index - d;
      if (j >= 0) reach.set(j, "prev");
      else if (config.order === "cycle") reach.set((j % count + count) % count, "prev");
    }
    if (wantNext) {
      const j = index + d;
      if (j < count) {
        if (!reach.has(j)) reach.set(j, "next");
      } else if (config.order === "cycle") {
        const w = j % count;
        if (!reach.has(w)) reach.set(w, "next");
      }
    }
  }
  reach.delete(index);
  return reach;
}
function reachCoversAll(count, config) {
  if (count < 3) return false;
  for (let i = 0; i < count; i++) {
    if (reachableFamilies(count, i, config).size < count - 1) return false;
  }
  return true;
}
function colorOrigin(hex, index, system, config, toneAnchors = {}) {
  const families = system.families;
  const candidates = [hex, ...toneAnchors[hex] ?? []];
  const holds = (colors) => colors.some((c) => candidates.includes(c.hex));
  if (families[index] && holds(families[index].colors)) return "own";
  if (holds(system.shared)) return "shared";
  const reach = reachableFamilies(families.length, index, config, cycleMembers(families));
  for (const [j, dir] of reach) {
    if (holds(families[j].colors)) return dir;
  }
  return null;
}
function toneAnchorsFrom(ladders, colorHex) {
  const out = {};
  for (const [name, ladder] of Object.entries(ladders ?? {})) {
    const anchor = colorHex(name);
    if (!anchor) continue;
    for (const hex of Object.values(ladder)) {
      if (hex === anchor) continue;
      const list = out[hex] ?? [];
      if (!list.includes(anchor)) list.push(anchor);
      out[hex] = list;
    }
  }
  return out;
}
function owningFamily(hex, families, toneAnchors = {}) {
  const candidates = [hex, ...toneAnchors[hex] ?? []];
  return families.find((f) => f.colors.some((c) => candidates.includes(c.hex)))?.name;
}
function familyTextCandidates(family, shared, extra = []) {
  const out = [];
  for (const c of family.colors) if (c.role === "contrast") out.push(c.hex);
  for (const s of shared) out.push(s.hex);
  for (const e of extra) out.push(e);
  return [...new Set(out)];
}
function checkFamilyPair(ground, figure, index, system, config, rules, extraTextCandidates = [], toneAnchors = {}) {
  const reasons = [];
  const origins = [
    colorOrigin(ground, index, system, config, toneAnchors),
    colorOrigin(figure, index, system, config, toneAnchors)
  ];
  for (const [hex, origin] of [[ground, origins[0]], [figure, origins[1]]]) {
    if (origin === null) {
      const owner = owningFamily(hex, system.families, toneAnchors);
      reasons.push(owner ? `${hex} from ${owner} is out of reach` : `${hex} is not in any family or shared`);
    }
  }
  reasons.push(...pairRuleViolations(ground, figure, rules));
  const family = system.families[index];
  const text = resolveTextColor(ground, familyTextCandidates(family, system.shared, extraTextCandidates), rules);
  return {
    ground,
    figure,
    text: text.text,
    figureRatio: contrastRatio(ground, figure),
    textRatio: text.ratio,
    textPasses: text.passes,
    tones: [toneClass(ground, rules.tones), toneClass(figure, rules.tones)],
    origins: [origins[0] ?? "outside", origins[1] ?? "outside"],
    valid: reasons.length === 0,
    reasons
  };
}
var LEVEL_SLOTS = [
  "ground",
  "on-ground/headline",
  "on-ground/text",
  "on-ground/accent",
  "on-ground/line",
  "on-ground/divider",
  "contrast",
  "on-contrast",
  "inset",
  "on-inset/text",
  "on-inset/accent",
  "signal",
  "on-signal"
];
var LEVEL_PAIRS = [
  ["on-ground/headline", "ground", "text"],
  ["on-ground/text", "ground", "text"],
  ["on-ground/accent", "ground", "figure"],
  ["on-ground/line", "ground", "figure"],
  ["on-contrast", "contrast", "text"],
  ["on-inset/text", "inset", "text"],
  ["on-inset/accent", "inset", "figure"],
  ["on-signal", "signal", "text"]
];
function levelRuleViolations(family, level, cell, rules) {
  const out = [];
  for (const [fig, ground, rule] of LEVEL_PAIRS) {
    const ratio = contrastRatio(cell[fig], cell[ground]);
    if (ratio < rules[rule]) out.push(`${family} / ${level} / ${fig} on ${ground} ${ratio.toFixed(1)}:1 < ${rules[rule]}`);
  }
  return out;
}

// parser/icons.ts
var PHOSPHOR_WEIGHTS = ["thin", "light", "regular", "bold", "fill", "duotone"];
var ICON_ID = /^[a-z][a-z0-9-]*$/;
function phosphorName(id) {
  return id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}
function parseWeight(value, where) {
  if (!PHOSPHOR_WEIGHTS.includes(value)) {
    throw new Error(`${where}: invalid icon weight "${value}" \u2014 expected ${PHOSPHOR_WEIGHTS.join(", ")}`);
  }
  return value;
}
function parseIconRef(value, where) {
  const parts = value.trim().split(/\s+/);
  if (parts.length === 0 || parts.length > 2 || !parts[0]) {
    throw new Error(`${where}: invalid icon reference "${value}" \u2014 expected "ID [WEIGHT]" or "phosphor:ID [WEIGHT]"`);
  }
  let id = parts[0];
  let library;
  if (id.startsWith("phosphor:")) {
    library = "phosphor";
    id = id.slice(9);
  }
  if (!ICON_ID.test(id)) {
    throw new Error(`${where}: invalid icon id "${id}" \u2014 use lowercase kebab-case (e.g. "map-pin")`);
  }
  const ref = { id };
  if (library) ref.library = library;
  if (parts[1]) ref.weight = parseWeight(parts[1], where);
  return ref;
}
function parseIconSource(value, where) {
  const parts = value.trim().split(/\s+/);
  if (parts[0] === "font") {
    const rest = parts.slice(1);
    if (rest.length === 0 || rest.length > 2) {
      throw new Error(`${where}: font icon must be "font [$FONT] U+XXXX" or "font [$FONT] GLYPHNAME"`);
    }
    let font = "";
    if (rest.length === 2) {
      if (!rest[0].startsWith("$")) throw new Error(`${where}: font reference must start with "$" (e.g. "$display"), got "${rest[0]}"`);
      font = rest[0].slice(1);
    }
    const glyphRef = rest[rest.length - 1];
    const cp = glyphRef.match(/^U\+([0-9A-Fa-f]{4,6})$/);
    if (cp) return { kind: "font", font, codepoint: parseInt(cp[1], 16) };
    if (/^U\+/i.test(glyphRef)) throw new Error(`${where}: invalid codepoint "${glyphRef}" \u2014 expected U+ and 4\u20136 hex digits`);
    return { kind: "font", font, glyph: glyphRef };
  }
  if (parts[0] === "phosphor") {
    if (parts.length < 2 || parts.length > 3) throw new Error(`${where}: phosphor icon must be "phosphor NAME [WEIGHT]"`);
    if (!ICON_ID.test(parts[1])) throw new Error(`${where}: invalid Phosphor name "${parts[1]}" \u2014 use kebab-case (e.g. "map-pin")`);
    const source = { kind: "phosphor", name: phosphorName(parts[1]) };
    if (parts[2]) source.weight = parseWeight(parts[2], where);
    return source;
  }
  if (parts.length === 1 && parts[0].toLowerCase().endsWith(".svg")) {
    return { kind: "svg", src: parts[0] };
  }
  throw new Error(`${where}: invalid icon source "${value}" \u2014 expected "font \u2026", "phosphor \u2026" or a path to an .svg file`);
}
function isIconId(id) {
  return ICON_ID.test(id);
}
function parseListItem(item) {
  const m = item.match(/^\[([^\]]+)\]\s*(.*)$/s);
  if (!m) return { text: item };
  return { icon: parseIconRef(m[1], `list item "${item}"`), text: m[2] };
}
function splitLabelledItem(text) {
  const at = text.indexOf(": ");
  if (at <= 0) return { value: text };
  return { label: text.slice(0, at).trim(), value: text.slice(at + 2).trim() };
}

// parser/brandParser.ts
var GROUP_KEYWORDS = /* @__PURE__ */ new Set(["primary", "secondary", "accent", "neutral"]);
var NEUTRAL_ROLES = /* @__PURE__ */ new Set(["light", "subtle", "mid", "muted", "dark"]);
var STATE_KEYS = /* @__PURE__ */ new Set(["problem", "warning", "success", "info", "inactive"]);
var VALID_COLOR_MODES = /* @__PURE__ */ new Set(["static", "dynamic", "guided", "brand"]);
var VALID_STRATEGIES = /* @__PURE__ */ new Set(["monochrome", "duotone", "tricolor", "spectrum"]);
var VALID_ADHERENCES = /* @__PURE__ */ new Set(["strict", "on-brand", "flexible"]);
var TONE_CLASSES = /* @__PURE__ */ new Set(["light", "mid", "dark"]);
var FAMILY_ROLES = /* @__PURE__ */ new Set(["core", "accent", "contrast"]);
var FAMILY_ORDERS = /* @__PURE__ */ new Set(["cycle", "sequence"]);
var FAMILY_BORROWS = /* @__PURE__ */ new Set(["previous", "next", "both", "none"]);
var PAIR_KEYS = ["ground", "figure", "text"];
function colorKey(name) {
  return name.toLowerCase().replace(/\s+/g, "-");
}
function normalizeHex(hex) {
  const m = hex.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (!m) return null;
  const body = m[1];
  if (body.length === 3) {
    return "#" + body.split("").map((c) => c + c).join("").toUpperCase();
  }
  return "#" + body.toUpperCase();
}
function hexToRgb(hex6) {
  const body = hex6.slice(1);
  return [
    parseInt(body.slice(0, 2), 16),
    parseInt(body.slice(2, 4), 16),
    parseInt(body.slice(4, 6), 16)
  ];
}
function lookupColorRef(refName, brandColors, tones) {
  if (brandColors[refName]) return brandColors[refName];
  const m = refName.match(/^(.+)\.(\d+)$/);
  return m ? tones?.[m[1]]?.[Number(m[2])] : void 0;
}
function resolveThemeSlotValue(raw, brandColors, fileName, slot, tones) {
  const value = raw.trim();
  if (/^rgba?\s*\(/i.test(value)) return value;
  let base = value;
  let alpha = null;
  const alphaMatch = value.match(/^(\S+)\s+([0-9]+(?:\.[0-9]+)?)%$/);
  if (alphaMatch) {
    base = alphaMatch[1];
    alpha = parseFloat(alphaMatch[2]);
    if (alpha < 0 || alpha > 100) {
      throw new Error(
        `${fileName}: theme slot "${slot}" alpha must be between 0 and 100, got ${alpha}`
      );
    }
  } else if (value.includes("%")) {
    throw new Error(
      `${fileName}: theme slot "${slot}" alpha syntax is "<value> NN%" with a single space, got "${value}"`
    );
  }
  let hex = null;
  if (base.startsWith("$")) {
    const refName = base.slice(1);
    const resolved = lookupColorRef(refName, brandColors, tones);
    if (!resolved) {
      throw new Error(
        `${fileName}: theme slot "${slot}" references unknown brand color "$${refName}"`
      );
    }
    hex = normalizeHex(resolved);
    if (!hex) {
      throw new Error(
        `${fileName}: theme slot "${slot}" base "$${refName}" resolves to "${resolved}", which is not a valid hex color`
      );
    }
  } else {
    hex = normalizeHex(base);
    if (!hex) {
      if (alpha !== null) {
        throw new Error(
          `${fileName}: theme slot "${slot}" base "${base}" must be "$ref" or "#HEX" when using alpha`
        );
      }
      return value;
    }
  }
  if (alpha === null) return hex;
  if (alpha === 100) return hex;
  const [r, g, b] = hexToRgb(hex);
  const a = Number((alpha / 100).toFixed(4)).toString();
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function parseBrandFile(content, fileName) {
  const lines = content.split("\n");
  const parseSlotLine = (trimmed, lineNum, where) => {
    const colonIdx = trimmed.indexOf(":");
    const slot = colonIdx !== -1 ? trimmed.slice(0, colonIdx).trim() : "";
    if (!LEVEL_SLOTS.includes(slot)) {
      throw new Error(`${fileName}:${lineNum}: ${where}: unknown slot "${slot || trimmed}" (slots: ${LEVEL_SLOTS.join(", ")})`);
    }
    const value = trimmed.slice(colonIdx + 1).replace(/\s+#\s.*$/, "").trim();
    if (!value) throw new Error(`${fileName}:${lineNum}: ${where}: slot "${slot}" has no value`);
    return { slot, value, line: lineNum };
  };
  const result = {};
  let activeBlock = "none";
  let currentThemeName = "";
  let currentDividerName = "";
  let currentTypographyName = "";
  let currentFontName = "";
  const brandColors = {};
  const brandColorPrint = {};
  let currentBrandColorName = "";
  let brandColorsShape = "unknown";
  const colorGroups = [];
  let currentGroup = null;
  let currentGroupedEntry = null;
  const stateColorsRaw = {};
  const colorBoundsRaw = {};
  const adherenceOverridesRaw = {};
  const colorRulesRaw = {};
  let colorRulesDeclared = false;
  let tonesDeclared = false;
  let tonesStepsRaw = null;
  const tonesRaw = [];
  const levelsRaw = [];
  let levelsDeclared = false;
  let currentLevel = null;
  let currentFamilyLevel = null;
  let familyLevelIndent = 0;
  const familiesProps = {};
  const familiesRaw = [];
  let familiesDeclared = false;
  let currentFamily = null;
  let inPairs = false;
  const themes = {};
  const themeDescriptions = {};
  const spacingRaw = {};
  const dividersRaw = {};
  const typographiesRaw = {};
  const fontsRaw = [];
  const logosRaw = [];
  const photosRaw = [];
  const videosRaw = [];
  const illustrationsRaw = [];
  let currentAssetId = "";
  let currentSubBlock = null;
  const labelRaw = {};
  const ctaRaw = {};
  const icons = [];
  let iconsDeclared = false;
  const counterRaw = {};
  let counterDeclared = false;
  const cameraRaw = {};
  let cameraDeclared = false;
  const locationRaw = {};
  let locationDeclared = false;
  const photoLookRaw = {};
  let photoLookDeclared = false;
  const warnings = [];
  const framingsRaw = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNum = i + 1;
    const isIndented = raw.startsWith("  ") || raw.startsWith("	");
    if (raw.startsWith("#")) {
      activeBlock = "none";
      continue;
    }
    if (isIndented) {
      if (activeBlock === "brand-colors") {
        const trimmed = raw.trimStart();
        if (trimmed === "") continue;
        const indentLen = raw.length - trimmed.length;
        if (brandColorsShape === "unknown") {
          if (GROUP_KEYWORDS.has(trimmed) && indentLen <= 2) {
            brandColorsShape = "grouped";
          } else {
            brandColorsShape = "flat";
          }
        }
        if (brandColorsShape === "grouped") {
          const groupKwMatch = GROUP_KEYWORDS.has(trimmed) && indentLen <= 2;
          if (groupKwMatch) {
            const key3 = trimmed;
            if (colorGroups.some((g) => g.key === key3)) {
              throw new Error(`${fileName}:${lineNum}: duplicate color group "${key3}"`);
            }
            currentGroup = { key: key3, entries: [] };
            colorGroups.push(currentGroup);
            currentGroupedEntry = null;
            continue;
          }
          if (!currentGroup) {
            throw new Error(
              `${fileName}:${lineNum}: grouped brand-colors entries must appear inside a group block (primary/secondary/accent/neutral)`
            );
          }
          if (trimmed.startsWith("#") || trimmed.startsWith("$")) {
            if (trimmed.startsWith("#")) {
              const headerMatch = trimmed.match(/^(#[0-9a-fA-F]{3,8})(?:\s+(.+))?$/);
              if (!headerMatch) {
                throw new Error(
                  `${fileName}:${lineNum}: expected "#HEX  Name" entry header, got "${trimmed}"`
                );
              }
              const hex = normalizeHex(headerMatch[1]);
              if (!hex) {
                throw new Error(
                  `${fileName}:${lineNum}: invalid hex "${headerMatch[1]}"`
                );
              }
              const name = (headerMatch[2] ?? "").trim();
              if (!name) {
                throw new Error(
                  `${fileName}:${lineNum}: color entry needs a display name after the hex`
                );
              }
              currentGroupedEntry = { hex, name };
              currentGroup.entries.push(currentGroupedEntry);
            } else {
              const refMatch = trimmed.match(/^\$([a-z]+)\.([a-z-]+)$/i);
              if (!refMatch) {
                throw new Error(
                  `${fileName}:${lineNum}: expected "$group.role" reference, got "${trimmed}"`
                );
              }
              currentGroupedEntry = {
                hex: "",
                name: "",
                referencedFrom: `${refMatch[1]}.${refMatch[2]}`
              };
              currentGroup.entries.push(currentGroupedEntry);
            }
            continue;
          }
          const colonIdx3 = trimmed.indexOf(":");
          if (colonIdx3 === -1) continue;
          const key2 = trimmed.slice(0, colonIdx3).trim();
          const value2 = trimmed.slice(colonIdx3 + 1).trim();
          if (indentLen <= 4 && !currentGroupedEntry) {
            if (key2 === "meaning") {
              currentGroup.meaning = value2;
            } else if (key2 === "distribution") {
              if (currentGroup.key === "neutral") {
                throw new Error(
                  `${fileName}:${lineNum}: neutral group cannot declare distribution \u2014 it's the scale, not a selection target`
                );
              }
              const pct = parseFloat(value2.replace(/%$/, ""));
              if (isNaN(pct)) {
                throw new Error(
                  `${fileName}:${lineNum}: distribution "${value2}" is not a number`
                );
              }
              currentGroup.distribution = pct;
            }
            continue;
          }
          if (!currentGroupedEntry) continue;
          if (key2 === "role") {
            currentGroupedEntry.role = value2;
            if (value2 === "default") currentGroupedEntry.isDefault = true;
          } else if (key2 === "meaning") {
            currentGroupedEntry.meaning = value2;
          } else if (key2 === "pantone" || key2 === "hks" || key2 === "cmyk") {
            if (!currentGroupedEntry.print) currentGroupedEntry.print = {};
            currentGroupedEntry.print[key2] = value2;
          }
          continue;
        }
        const colonIdx2 = trimmed.indexOf(":");
        if (colonIdx2 !== -1) {
          const key2 = trimmed.slice(0, colonIdx2).trim();
          const value2 = trimmed.slice(colonIdx2 + 1).trim().replace(/\s+#.*$/, "");
          if (indentLen <= 2) {
            if (/%/.test(value2) || /rgba\s*\(/i.test(value2)) {
              throw new Error(
                `${fileName}:${lineNum}: brand color "${key2}" must be a solid hex \u2014 alpha syntax (e.g. "$ref 75%" or rgba()) is only allowed in theme slots`
              );
            }
            brandColors[key2] = value2;
            currentBrandColorName = key2;
          } else if (currentBrandColorName) {
            if (!brandColorPrint[currentBrandColorName]) brandColorPrint[currentBrandColorName] = {};
            const spec = brandColorPrint[currentBrandColorName];
            if (key2 === "pantone") spec.pantone = value2;
            else if (key2 === "hks") spec.hks = value2;
            else if (key2 === "cmyk") spec.cmyk = value2;
          }
        }
        continue;
      }
      if (activeBlock === "state-colors") {
        const trimmed = raw.trimStart();
        const colonIdx2 = trimmed.indexOf(":");
        if (colonIdx2 !== -1) {
          const key2 = trimmed.slice(0, colonIdx2).trim();
          const value2 = trimmed.slice(colonIdx2 + 1).trim();
          stateColorsRaw[key2] = value2;
        }
        continue;
      }
      if (activeBlock === "color-bounds") {
        const trimmed = raw.trimStart();
        const colonIdx2 = trimmed.indexOf(":");
        if (colonIdx2 !== -1) {
          const key2 = trimmed.slice(0, colonIdx2).trim();
          const value2 = trimmed.slice(colonIdx2 + 1).trim();
          colorBoundsRaw[key2] = value2;
        }
        continue;
      }
      if (activeBlock === "color-adherence") {
        const trimmed = raw.trimStart();
        const colonIdx2 = trimmed.indexOf(":");
        if (colonIdx2 !== -1) {
          const key2 = trimmed.slice(0, colonIdx2).trim();
          const value2 = trimmed.slice(colonIdx2 + 1).trim();
          adherenceOverridesRaw[key2] = value2;
        }
        continue;
      }
      if (activeBlock === "color-rules") {
        const trimmed = raw.trim();
        const colonIdx2 = trimmed.indexOf(":");
        if (colonIdx2 !== -1) {
          colorRulesRaw[trimmed.slice(0, colonIdx2).trim()] = trimmed.slice(colonIdx2 + 1).trim();
        }
        continue;
      }
      if (activeBlock === "tones") {
        const trimmed = raw.trim().replace(/\s+#\s.*$/, "");
        if (trimmed === "" || trimmed.startsWith("# ")) continue;
        const colonIdx2 = trimmed.indexOf(":");
        const key2 = colonIdx2 !== -1 ? trimmed.slice(0, colonIdx2).trim() : "";
        const value2 = trimmed.slice(colonIdx2 + 1).trim();
        if (key2 === "steps") {
          if (tonesStepsRaw) throw new Error(`${fileName}:${lineNum}: tones declares steps: twice`);
          tonesStepsRaw = { value: value2, line: lineNum };
        } else if (key2.startsWith("$") && key2.length > 1) {
          const name = key2.slice(1);
          if (tonesRaw.some((t) => t.name === name)) throw new Error(`${fileName}:${lineNum}: tones declares "${key2}" twice`);
          tonesRaw.push({ name, values: value2.split(/\s+/).filter(Boolean), line: lineNum });
        } else {
          throw new Error(`${fileName}:${lineNum}: expected "steps: \u2026" or "$color: #HEX \u2026" in tones, got "${trimmed}"`);
        }
        continue;
      }
      if (activeBlock === "levels") {
        const trimmed = raw.trim();
        if (trimmed === "" || trimmed.startsWith("#")) continue;
        const levelMatch = trimmed.match(/^level\s+(\S+)$/);
        if (levelMatch) {
          if (levelsRaw.some((l) => l.name === levelMatch[1])) throw new Error(`${fileName}:${lineNum}: duplicate level "${levelMatch[1]}"`);
          currentLevel = { name: levelMatch[1], line: lineNum, slots: [] };
          levelsRaw.push(currentLevel);
          continue;
        }
        if (!currentLevel) throw new Error(`${fileName}:${lineNum}: expected "level NAME" in levels, got "${trimmed}"`);
        currentLevel.slots.push(parseSlotLine(trimmed, lineNum, `level ${currentLevel.name}`));
        continue;
      }
      if (activeBlock === "color-families") {
        const trimmed = raw.trim();
        if (trimmed === "") continue;
        const familyMatch = trimmed.match(/^family\s+(\S+)$/);
        if (familyMatch) {
          if (familiesRaw.some((f) => f.name === familyMatch[1])) {
            throw new Error(`${fileName}:${lineNum}: duplicate family "${familyMatch[1]}"`);
          }
          currentFamily = { name: familyMatch[1], line: lineNum, colors: [], pairs: [], levels: [] };
          currentFamilyLevel = null;
          familiesRaw.push(currentFamily);
          inPairs = false;
          continue;
        }
        if (!currentFamily) {
          const colonIdx3 = trimmed.indexOf(":");
          if (colonIdx3 === -1) {
            throw new Error(`${fileName}:${lineNum}: expected "key: value" or "family NAME" in color-families, got "${trimmed}"`);
          }
          familiesProps[trimmed.slice(0, colonIdx3).trim()] = trimmed.slice(colonIdx3 + 1).trim();
          continue;
        }
        const indent = raw.length - raw.trimStart().length;
        if (currentFamilyLevel && indent > familyLevelIndent) {
          currentFamilyLevel.slots.push(parseSlotLine(trimmed, lineNum, `family "${currentFamily.name}" level ${currentFamilyLevel.name}`));
          continue;
        }
        currentFamilyLevel = null;
        const familyLevelMatch = trimmed.match(/^level\s+(\S+)$/);
        if (familyLevelMatch) {
          if (currentFamily.levels.some((l) => l.name === familyLevelMatch[1])) {
            throw new Error(`${fileName}:${lineNum}: family "${currentFamily.name}" declares level ${familyLevelMatch[1]} twice`);
          }
          currentFamilyLevel = { name: familyLevelMatch[1], line: lineNum, slots: [] };
          familyLevelIndent = indent;
          currentFamily.levels.push(currentFamilyLevel);
          inPairs = false;
          continue;
        }
        if (trimmed === "pairs") {
          inPairs = true;
          continue;
        }
        if (inPairs && trimmed.includes("/")) {
          const parts = trimmed.split("/").map((p) => p.trim());
          if (parts.length !== 2 || !parts[0] || !parts[1]) {
            throw new Error(`${fileName}:${lineNum}: pair must be "ground / figure", got "${trimmed}"`);
          }
          currentFamily.pairs.push({ ground: parts[0], figure: parts[1], line: lineNum });
          continue;
        }
        const colonIdx2 = trimmed.indexOf(":");
        const key2 = colonIdx2 !== -1 ? trimmed.slice(0, colonIdx2).trim() : trimmed;
        if (key2 === "season" && colonIdx2 !== -1) {
          const value2 = trimmed.slice(colonIdx2 + 1).trim();
          if (currentFamily.season !== void 0) throw new Error(`${fileName}:${lineNum}: family "${currentFamily.name}" declares season: twice`);
          if (!/^[a-z][a-z0-9-]*$/.test(value2)) throw new Error(`${fileName}:${lineNum}: family "${currentFamily.name}" season: must name a .time season (lowercase kebab-case), got "${value2}"`);
          inPairs = false;
          currentFamily.season = value2;
          continue;
        }
        if (key2 === "from" && colonIdx2 !== -1) {
          warnings.push(`${fileName}:${lineNum}: family "${currentFamily.name}" from: is ignored \u2014 seasons live in the .time; name the family's season with "season: NAME"`);
          inPairs = false;
          continue;
        }
        if (key2 === "signal" && colonIdx2 !== -1) {
          if (currentFamily.signal) throw new Error(`${fileName}:${lineNum}: family "${currentFamily.name}" declares signal: twice`);
          currentFamily.signal = { value: trimmed.slice(colonIdx2 + 1).trim(), line: lineNum };
          inPairs = false;
          continue;
        }
        if (colonIdx2 === -1 || !FAMILY_ROLES.has(key2)) {
          throw new Error(`${fileName}:${lineNum}: family "${currentFamily.name}": expected season / core / accent / contrast / signal / level / pairs, got "${trimmed}"`);
        }
        inPairs = false;
        currentFamily.colors.push({ role: key2, value: trimmed.slice(colonIdx2 + 1).trim(), line: lineNum });
        continue;
      }
      if (activeBlock === "theme" && currentThemeName) {
        const colonIdx2 = raw.indexOf(":");
        if (colonIdx2 !== -1) {
          const slot = raw.slice(0, colonIdx2).trim();
          const rest = raw.slice(colonIdx2 + 1).trim();
          const commentIdx = rest.search(/\s+#/);
          const value2 = commentIdx !== -1 ? rest.slice(0, commentIdx).trim() : rest.trim();
          const comment = commentIdx !== -1 ? rest.slice(commentIdx).replace(/^\s+#\s*/, "") : "";
          if (!themes[currentThemeName]) themes[currentThemeName] = {};
          themes[currentThemeName][slot] = value2;
          if (comment && !themeDescriptions[slot]) {
            themeDescriptions[slot] = comment;
          }
        }
        continue;
      }
      if (activeBlock === "spacing") {
        const colonIdx2 = raw.indexOf(":");
        if (colonIdx2 !== -1) {
          const key2 = raw.slice(0, colonIdx2).trim();
          const value2 = raw.slice(colonIdx2 + 1).trim();
          spacingRaw[key2] = value2;
        }
        continue;
      }
      if (activeBlock === "divider" && currentDividerName) {
        const colonIdx2 = raw.indexOf(":");
        if (colonIdx2 !== -1) {
          const key2 = raw.slice(0, colonIdx2).trim();
          const value2 = raw.slice(colonIdx2 + 1).trim();
          if (key2 === "color") {
            throw new Error(
              `${fileName}:${lineNum}: divider "${currentDividerName}": color is no longer configurable. Remove the "color:" line \u2014 divider color is sourced from the theme's "divider" slot.`
            );
          }
          if (!dividersRaw[currentDividerName]) dividersRaw[currentDividerName] = {};
          dividersRaw[currentDividerName][key2] = value2;
        }
        continue;
      }
      if (activeBlock === "typography" && currentTypographyName) {
        const trimmed = raw.trim();
        if (!typographiesRaw[currentTypographyName]) typographiesRaw[currentTypographyName] = {};
        const colonIdx2 = trimmed.indexOf(":");
        if (colonIdx2 !== -1) {
          const key2 = trimmed.slice(0, colonIdx2).trim();
          const value2 = trimmed.slice(colonIdx2 + 1).trim();
          typographiesRaw[currentTypographyName][key2] = value2;
        } else if (trimmed === "italic" || trimmed === "uppercase") {
          typographiesRaw[currentTypographyName][trimmed] = "true";
        }
        continue;
      }
      if (activeBlock === "font" && currentFontName) {
        const colonIdx2 = raw.indexOf(":");
        if (colonIdx2 !== -1) {
          const key2 = raw.slice(0, colonIdx2).trim();
          const value2 = raw.slice(colonIdx2 + 1).trim();
          const last = fontsRaw[fontsRaw.length - 1];
          if (last && last.name === currentFontName) last.props[key2] = value2;
        }
        continue;
      }
      if ((activeBlock === "logo" || activeBlock === "photo" || activeBlock === "video" || activeBlock === "illustration") && currentAssetId) {
        const indent = raw.match(/^(\s*)/)?.[1].length ?? 0;
        const colonIdx2 = raw.indexOf(":");
        if (colonIdx2 !== -1) {
          const key2 = raw.slice(0, colonIdx2).trim();
          const value2 = raw.slice(colonIdx2 + 1).trim();
          const arr = activeBlock === "logo" ? logosRaw : activeBlock === "photo" ? photosRaw : activeBlock === "video" ? videosRaw : illustrationsRaw;
          const last = arr[arr.length - 1];
          if (last && last.id === currentAssetId) {
            if (indent >= 4 && currentSubBlock) {
              last.props[`${currentSubBlock}.${key2}`] = value2;
            } else {
              last.props[key2] = value2;
              currentSubBlock = null;
            }
          }
        } else {
          const trimmed = raw.trim();
          if (trimmed === "animated" || trimmed === "loop") {
            const arr = activeBlock === "logo" ? logosRaw : activeBlock === "photo" ? photosRaw : activeBlock === "video" ? videosRaw : illustrationsRaw;
            const last = arr[arr.length - 1];
            if (last && last.id === currentAssetId) last.props[trimmed] = "true";
            currentSubBlock = null;
          } else if (trimmed === "generator-params" || activeBlock === "logo" && /^align-(left|center|right)$/.test(trimmed)) {
            currentSubBlock = trimmed;
          }
        }
        continue;
      }
      if (activeBlock === "label" || activeBlock === "cta") {
        const colonIdx2 = raw.indexOf(":");
        if (colonIdx2 !== -1) {
          const key2 = raw.slice(0, colonIdx2).trim();
          const value2 = raw.slice(colonIdx2 + 1).trim();
          const target = activeBlock === "label" ? labelRaw : ctaRaw;
          target[key2] = value2;
        }
        continue;
      }
      if (activeBlock === "icons") {
        const trimmed = raw.trim();
        if (trimmed.startsWith("#")) continue;
        const commentIdx = trimmed.search(/\s+#/);
        const entry = commentIdx !== -1 ? trimmed.slice(0, commentIdx) : trimmed;
        const colonIdx2 = entry.indexOf(":");
        if (colonIdx2 === -1) throw new Error(`${fileName}:${lineNum}: icons entry must be "ID: SOURCE", got "${trimmed}"`);
        const id = entry.slice(0, colonIdx2).trim();
        if (!isIconId(id)) throw new Error(`${fileName}:${lineNum}: invalid icon id "${id}" \u2014 use lowercase kebab-case`);
        if (icons.some((ic) => ic.id === id)) throw new Error(`${fileName}:${lineNum}: duplicate icon "${id}"`);
        icons.push({ id, source: parseIconSource(entry.slice(colonIdx2 + 1), `${fileName}:${lineNum}`) });
        continue;
      }
      if (activeBlock === "counter") {
        const trimmed = raw.trim();
        if (trimmed.startsWith("#")) continue;
        const commentIdx = trimmed.search(/\s+#/);
        const entry = commentIdx !== -1 ? trimmed.slice(0, commentIdx) : trimmed;
        const colonIdx2 = entry.indexOf(":");
        if (colonIdx2 === -1) throw new Error(`${fileName}:${lineNum}: counter property must be "KEY: VALUE", got "${trimmed}"`);
        counterRaw[entry.slice(0, colonIdx2).trim()] = { value: entry.slice(colonIdx2 + 1).trim(), line: lineNum };
        continue;
      }
      if (activeBlock === "camera") {
        const trimmed = raw.trim();
        if (trimmed.startsWith("#")) continue;
        const commentIdx = trimmed.search(/\s+#/);
        const entry = commentIdx !== -1 ? trimmed.slice(0, commentIdx) : trimmed;
        const colonIdx2 = entry.indexOf(":");
        if (colonIdx2 === -1) throw new Error(`${fileName}:${lineNum}: camera property must be "KEY: VALUE", got "${trimmed}"`);
        cameraRaw[entry.slice(0, colonIdx2).trim()] = { value: entry.slice(colonIdx2 + 1).trim(), line: lineNum };
        continue;
      }
      if (activeBlock === "location") {
        const trimmed = raw.trim();
        if (trimmed.startsWith("#")) continue;
        const entry = trimmed.replace(/\s+#.*$/, "");
        const colonIdx2 = entry.indexOf(":");
        if (colonIdx2 === -1) throw new Error(`${fileName}:${lineNum}: location property must be "KEY: VALUE", got "${trimmed}"`);
        locationRaw[entry.slice(0, colonIdx2).trim()] = { value: entry.slice(colonIdx2 + 1).trim(), line: lineNum };
        continue;
      }
      if (activeBlock === "photo-look") {
        const trimmed = raw.trim();
        if (trimmed.startsWith("#")) continue;
        const commentIdx = trimmed.search(/\s+#(?![0-9a-f]{3}(?:[0-9a-f]{3}(?:[0-9a-f]{2})?)?(?:\s|$))/i);
        const entry = commentIdx !== -1 ? trimmed.slice(0, commentIdx) : trimmed;
        const colonIdx2 = entry.indexOf(":");
        if (colonIdx2 === -1) photoLookRaw[entry.trim()] = { value: "", line: lineNum };
        else photoLookRaw[entry.slice(0, colonIdx2).trim()] = { value: entry.slice(colonIdx2 + 1).trim(), line: lineNum };
        continue;
      }
      if (activeBlock === "windows") continue;
      if (activeBlock === "framing") {
        const trimmed = raw.trim();
        if (trimmed.startsWith("#")) continue;
        const colonIdx2 = trimmed.indexOf(":");
        if (colonIdx2 === -1) throw new Error(`${fileName}:${lineNum}: framing property must be "KEY: VALUE", got "${trimmed}"`);
        framingsRaw[framingsRaw.length - 1].props[trimmed.slice(0, colonIdx2).trim()] = { value: trimmed.slice(colonIdx2 + 1).trim(), line: lineNum };
        continue;
      }
      continue;
    }
    if (raw.trim() === "") continue;
    activeBlock = "none";
    if (raw.trim() === "brand-colors") {
      activeBlock = "brand-colors";
      currentGroup = null;
      currentGroupedEntry = null;
      continue;
    }
    if (raw.trim() === "state-colors") {
      activeBlock = "state-colors";
      continue;
    }
    if (raw.trim() === "color-bounds") {
      activeBlock = "color-bounds";
      continue;
    }
    if (raw.trim() === "color-rules") {
      activeBlock = "color-rules";
      colorRulesDeclared = true;
      continue;
    }
    if (/^tones(\s+#.*)?$/.test(raw.trim())) {
      if (tonesDeclared) throw new Error(`${fileName}:${lineNum}: duplicate tones block`);
      activeBlock = "tones";
      tonesDeclared = true;
      continue;
    }
    if (raw.trim() === "levels") {
      if (levelsDeclared) throw new Error(`${fileName}:${lineNum}: duplicate levels block`);
      activeBlock = "levels";
      levelsDeclared = true;
      currentLevel = null;
      continue;
    }
    if (raw.trim() === "color-families") {
      if (familiesDeclared) throw new Error(`${fileName}:${lineNum}: duplicate color-families block`);
      activeBlock = "color-families";
      familiesDeclared = true;
      currentFamily = null;
      inPairs = false;
      continue;
    }
    if (raw.trim() === "icons") {
      if (iconsDeclared) throw new Error(`${fileName}:${lineNum}: duplicate icons block`);
      iconsDeclared = true;
      activeBlock = "icons";
      continue;
    }
    if (raw.trim() === "counter") {
      if (counterDeclared) throw new Error(`${fileName}:${lineNum}: duplicate counter block`);
      counterDeclared = true;
      activeBlock = "counter";
      continue;
    }
    if (raw.trim() === "camera") {
      if (cameraDeclared) throw new Error(`${fileName}:${lineNum}: duplicate camera block`);
      cameraDeclared = true;
      activeBlock = "camera";
      continue;
    }
    if (raw.trim() === "location") {
      if (locationDeclared) throw new Error(`${fileName}:${lineNum}: duplicate location block`);
      locationDeclared = true;
      activeBlock = "location";
      continue;
    }
    if (raw.trim() === "photo-look") {
      if (photoLookDeclared) throw new Error(`${fileName}:${lineNum}: duplicate photo-look block`);
      photoLookDeclared = true;
      activeBlock = "photo-look";
      continue;
    }
    if (raw.trim() === "windows") {
      warnings.push(`${fileName}:${lineNum}: windows block is ignored \u2014 windows live in the .time now; move it to "${result.id || "brand"}.time"`);
      activeBlock = "windows";
      continue;
    }
    const framingMatch = raw.match(/^framing\s+(\S+)\s*$/);
    if (framingMatch) {
      const id = framingMatch[1];
      if (framingsRaw.some((f) => f.id === id)) throw new Error(`${fileName}:${lineNum}: duplicate framing "${id}"`);
      framingsRaw.push({ id, line: lineNum, props: {} });
      activeBlock = "framing";
      continue;
    }
    const themeMatch = raw.match(/^theme\s+(\S+)/);
    if (themeMatch) {
      currentThemeName = themeMatch[1];
      activeBlock = "theme";
      continue;
    }
    const dividerMatch = raw.match(/^divider\s+(\S+)/);
    if (dividerMatch) {
      currentDividerName = dividerMatch[1];
      activeBlock = "divider";
      continue;
    }
    const typographyMatch = raw.match(/^typography\s+(\S+)/);
    if (typographyMatch) {
      currentTypographyName = typographyMatch[1];
      activeBlock = "typography";
      continue;
    }
    const fontBlockMatch = raw.match(/^font(?:\s+(\S+))?$/);
    if (fontBlockMatch) {
      currentFontName = fontBlockMatch[1] ?? "_default";
      fontsRaw.push({ name: currentFontName, props: {} });
      activeBlock = "font";
      continue;
    }
    const assetMatch = raw.match(/^(logo|photo|video|illustration)\s+(\S+)/);
    if (assetMatch) {
      const [, type, id] = assetMatch;
      currentAssetId = id;
      activeBlock = type;
      const arr = type === "logo" ? logosRaw : type === "photo" ? photosRaw : type === "video" ? videosRaw : illustrationsRaw;
      arr.push({ id, props: {} });
      continue;
    }
    const colonIdx = raw.indexOf(":");
    if (colonIdx === -1) continue;
    const key = raw.slice(0, colonIdx).trim();
    const value = raw.slice(colonIdx + 1).trim();
    switch (key) {
      case "id":
        result.id = value;
        break;
      case "name":
        result.name = value;
        break;
      case "language":
        result.language = value;
        break;
      case "locale":
        result.locale = value;
        break;
      case "spacing":
        activeBlock = "spacing";
        break;
      case "label":
        activeBlock = "label";
        break;
      case "cta":
        activeBlock = "cta";
        break;
      case "color-mode":
        if (!VALID_COLOR_MODES.has(value)) {
          throw new Error(`${fileName}:${lineNum}: color-mode must be "static", "dynamic", "guided", or "brand", got "${value}"`);
        }
        result.colorMode = value;
        break;
      case "color-strategy":
        if (!VALID_STRATEGIES.has(value)) {
          throw new Error(`${fileName}:${lineNum}: color-strategy must be one of monochrome/duotone/tricolor/spectrum, got "${value}"`);
        }
        result.colorStrategy = value;
        break;
      case "color-adherence":
        if (!VALID_ADHERENCES.has(value)) {
          throw new Error(`${fileName}:${lineNum}: color-adherence must be "strict", "on-brand", or "flexible", got "${value}"`);
        }
        result.colorAdherence = value;
        activeBlock = "color-adherence";
        break;
      default:
        break;
    }
  }
  if (colorGroups.length > 0) {
    const resolvedNames = /* @__PURE__ */ new Set();
    for (let gi = 0; gi < colorGroups.length; gi++) {
      const group = colorGroups[gi];
      for (const entry of group.entries) {
        if (!entry.referencedFrom) {
          if (resolvedNames.has(entry.name)) {
            throw new Error(`${fileName}: duplicate color name "${entry.name}" in brand-colors`);
          }
          resolvedNames.add(entry.name);
          continue;
        }
        const [refGroupKey, refRole] = entry.referencedFrom.split(".");
        const refGroupIdx = colorGroups.findIndex((g) => g.key === refGroupKey);
        if (refGroupIdx === -1) {
          throw new Error(`${fileName}: reference "$${entry.referencedFrom}" targets unknown group "${refGroupKey}"`);
        }
        if (refGroupIdx >= gi) {
          throw new Error(`${fileName}: reference "$${entry.referencedFrom}" must point to a group declared earlier (forward/self references forbidden)`);
        }
        const refGroup = colorGroups[refGroupIdx];
        let target;
        if (refRole === "default") {
          target = refGroup.entries.find((e) => e.isDefault) ?? refGroup.entries[0];
        } else {
          target = refGroup.entries.find((e) => e.role === refRole);
        }
        if (!target) {
          throw new Error(`${fileName}: reference "$${entry.referencedFrom}" \u2014 no entry with role "${refRole}" in group "${refGroupKey}"`);
        }
        entry.hex = target.hex;
        entry.name = target.name;
      }
      if (group.key !== "neutral" && group.entries.length > 0) {
        const explicit = group.entries.find((e) => e.isDefault);
        if (!explicit) {
          group.entries[0].isDefault = true;
        }
      }
      if (group.key === "neutral") {
        for (const entry of group.entries) {
          if (entry.role && !NEUTRAL_ROLES.has(entry.role)) {
            throw new Error(
              `${fileName}: neutral entry "${entry.name}" role "${entry.role}" is not in the fixed vocabulary (light | subtle | mid | muted | dark)`
            );
          }
        }
      }
    }
    result.colorGroups = colorGroups;
    for (const group of colorGroups) {
      for (const entry of group.entries) {
        const key = entry.name.toLowerCase().replace(/\s+/g, "-");
        if (!brandColors[key]) {
          brandColors[key] = entry.hex;
          if (entry.print) brandColorPrint[key] = entry.print;
        }
      }
    }
  }
  const colorWarnings = [];
  const rules = { ...DEFAULT_COLOR_RULES, avoid: [], tones: [...DEFAULT_COLOR_RULES.tones] };
  if (colorRulesDeclared) {
    const num = (key) => {
      const n = parseFloat(colorRulesRaw[key]);
      if (isNaN(n) || n < 1 || n > 21) {
        throw new Error(`${fileName}: color-rules "${key}" must be a contrast ratio between 1 and 21, got "${colorRulesRaw[key]}"`);
      }
      return n;
    };
    if (colorRulesRaw.text !== void 0) rules.text = num("text");
    if (colorRulesRaw.figure !== void 0) rules.figure = num("figure");
    if (colorRulesRaw.avoid !== void 0) {
      for (const combo of colorRulesRaw.avoid.split(",").map((c) => c.trim()).filter(Boolean)) {
        const parts = combo.split("+").map((c) => c.trim());
        if (parts.length !== 2 || !parts.every((t) => TONE_CLASSES.has(t))) {
          throw new Error(`${fileName}: color-rules avoid "${combo}" must be two of light / mid / dark joined by "+"`);
        }
        rules.avoid.push([parts[0], parts[1]]);
      }
    }
    if (colorRulesRaw.tones !== void 0) {
      const t = colorRulesRaw.tones.split(",").map((v) => parseFloat(v.trim()));
      if (t.length !== 2 || t.some(isNaN) || t[0] >= t[1]) {
        throw new Error(`${fileName}: color-rules tones must be two ascending contrast values, e.g. "1.8, 4.5"`);
      }
      rules.tones = [t[0], t[1]];
    }
    result.colorRules = rules;
  }
  let tones;
  if (tonesDeclared) {
    if (!tonesStepsRaw) throw new Error(`${fileName}: tones needs a "steps:" line`);
    const stepsLine = tonesStepsRaw.line;
    const steps = tonesStepsRaw.value.split(",").map((s) => s.trim()).map((s) => /^\d+$/.test(s) ? Number(s) : NaN);
    if (steps.length === 0 || steps.some(isNaN) || steps.some((s, i) => i > 0 && s <= steps[i - 1])) {
      throw new Error(`${fileName}:${stepsLine}: tones steps must be ascending whole numbers, e.g. "10, 20, 30", got "${tonesStepsRaw.value}"`);
    }
    tones = { steps, colors: {} };
    for (const t of tonesRaw) {
      if (t.values.length !== steps.length) {
        throw new Error(`${fileName}:${t.line}: tones "$${t.name}" has ${t.values.length} values, steps declares ${steps.length}`);
      }
      const ladder = {};
      t.values.forEach((v, i) => {
        const hex = normalizeHex(v);
        if (!hex || !isHex6(hex)) throw new Error(`${fileName}:${t.line}: tones "$${t.name}" value "${v}" is not a 6-digit hex`);
        ladder[steps[i]] = hex;
      });
      tones.colors[t.name] = ladder;
    }
  }
  let colorFamilies;
  if (familiesDeclared) {
    const order = familiesProps.order ?? "cycle";
    if (!FAMILY_ORDERS.has(order)) throw new Error(`${fileName}: color-families order must be "cycle" or "sequence", got "${order}"`);
    const borrow = familiesProps.borrow ?? "both";
    if (!FAMILY_BORROWS.has(borrow)) throw new Error(`${fileName}: color-families borrow must be previous / next / both / none, got "${borrow}"`);
    const distance = familiesProps.distance !== void 0 ? Number(familiesProps.distance) : 1;
    if (!Number.isInteger(distance) || distance < 1) throw new Error(`${fileName}: color-families distance must be a whole number \u2265 1, got "${familiesProps.distance}"`);
    if (familiesRaw.length === 0) throw new Error(`${fileName}: color-families declares no family`);
    const colorRefs = (key) => (familiesProps[key] ?? "").split(",").map((r) => r.trim()).filter(Boolean).map((ref) => {
      if (!ref.startsWith("$")) throw new Error(`${fileName}: color-families ${key} entries must be $refs to brand-colors, got "${ref}"`);
      const found = lookupColorRef(ref.slice(1), brandColors, tones?.colors);
      const hex = found ? normalizeHex(found) : null;
      if (!hex || !isHex6(hex)) throw new Error(`${fileName}: color-families ${key} "${ref}" is not a known 6-digit brand color`);
      return { name: ref.slice(1), hex };
    });
    const shared = colorRefs("shared");
    const photoFallback = colorRefs("photo-fallback");
    const families = [];
    for (const raw of familiesRaw) {
      const counts = {};
      for (const c of raw.colors) counts[c.role] = (counts[c.role] ?? 0) + 1;
      if (counts.core !== 1) throw new Error(`${fileName}:${raw.line}: family "${raw.name}" needs exactly one core color`);
      if ((counts.contrast ?? 0) > 1) throw new Error(`${fileName}:${raw.line}: family "${raw.name}" declares more than one contrast color`);
      const seen = {};
      const refs = /* @__PURE__ */ new Set();
      const colors = raw.colors.map((c) => {
        if (c.value.startsWith("$")) {
          const ref = c.value.slice(1);
          const found = lookupColorRef(ref, brandColors, tones?.colors);
          const hex2 = found ? normalizeHex(found) : null;
          if (!hex2 || !isHex6(hex2)) throw new Error(`${fileName}:${c.line}: family "${raw.name}" ${c.role} "${c.value}" is not a known 6-digit color`);
          seen[c.role] = (seen[c.role] ?? 0) + 1;
          const color = { role: c.role, hex: hex2, name: ref, key: ref };
          refs.add(color);
          return color;
        }
        const m = c.value.match(/^(#[0-9a-fA-F]{3,6})(?:\s+(.+))?$/);
        const hex = m ? normalizeHex(m[1]) : null;
        if (!m || !hex || !isHex6(hex)) {
          throw new Error(`${fileName}:${c.line}: family "${raw.name}" ${c.role} must be "#HEX", "#HEX  Name" or "$ref", got "${c.value}"`);
        }
        seen[c.role] = (seen[c.role] ?? 0) + 1;
        const generated = `${raw.name.toLowerCase()}-${c.role}${counts[c.role] > 1 ? `-${seen[c.role]}` : ""}`;
        const name = m[2]?.trim() || generated;
        return { role: c.role, hex, name, key: colorKey(name) };
      });
      for (const c of colors) {
        if (refs.has(c)) continue;
        if (brandColors[c.key]) {
          throw new Error(`${fileName}: family "${raw.name}" color name "${c.name}" collides with an existing brand color`);
        }
        brandColors[c.key] = c.hex;
      }
      families.push({ name: raw.name, ...raw.season ? { season: raw.season } : {}, colors, pairs: [] });
    }
    const seasonal = familiesRaw.filter((f) => f.season !== void 0);
    for (const f of seasonal) {
      const twin = seasonal.find((o) => o !== f && o.season === f.season);
      if (twin) throw new Error(`${fileName}:${f.line}: families "${twin.name}" and "${f.name}" both name season "${f.season}"`);
    }
    colorFamilies = { order, borrow, distance, shared, ...photoFallback.length > 0 ? { photoFallback } : {}, families };
    if (borrow !== "none" && reachCoversAll(cycleMembers(families).length, { order, borrow, distance })) {
      colorWarnings.push(`color-families: borrow "${borrow}" with distance ${distance} reaches every family \u2014 the borrow rule has no effect`);
    }
    result.colorFamilies = colorFamilies;
  }
  if (tones) {
    for (const t of tonesRaw) {
      const own = brandColors[t.name] ? normalizeHex(brandColors[t.name]) : null;
      if (!own) throw new Error(`${fileName}:${t.line}: tones "$${t.name}" is not a brand color or family color`);
      if (!Object.values(tones.colors[t.name]).includes(own)) {
        throw new Error(`${fileName}:${t.line}: tones "$${t.name}" must contain its own hex ${own} on one of its steps`);
      }
    }
    result.tones = tones;
  }
  if (levelsDeclared) {
    if (!colorFamilies) throw new Error(`${fileName}: levels needs a color-families block`);
    if (levelsRaw.length === 0) throw new Error(`${fileName}: levels declares no level`);
    const names = levelsRaw.map((l) => l.name);
    const levelByKey = new Map(levelsRaw.map((l) => [l.name.toLowerCase(), l]));
    for (const l of levelsRaw) {
      if (/^(p|a1|a2)$/i.test(l.name)) throw new Error(`${fileName}:${l.line}: level name "${l.name}" is reserved (family shorthand)`);
    }
    const cells = {};
    colorFamilies.families.forEach((family, index) => {
      const raw = familiesRaw[index];
      for (const o of raw.levels) {
        if (!levelByKey.has(o.name.toLowerCase())) throw new Error(`${fileName}:${o.line}: family "${family.name}" overrides unknown level "${o.name}"`);
      }
      let signal = {};
      if (raw.signal) {
        const parts = raw.signal.value.split("/").map((p) => p.trim());
        if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error(`${fileName}:${raw.signal.line}: family "${family.name}" signal must be "signal / on-signal", got "${raw.signal.value}"`);
        signal = { "signal": { slot: "signal", value: parts[0], line: raw.signal.line }, "on-signal": { slot: "on-signal", value: parts[1], line: raw.signal.line } };
      }
      const authored = (level, slot) => raw.levels.find((o) => o.name.toLowerCase() === level.name.toLowerCase())?.slots.find((s) => s.slot === slot) ?? signal[slot] ?? level.slots.find((s) => s.slot === slot);
      const role = (shorthand) => {
        const core = family.colors.find((c) => c.role === "core");
        const accents = family.colors.filter((c) => c.role === "accent");
        return shorthand === "p" ? core : shorthand === "a1" ? accents[0] ?? core : accents[1] ?? core;
      };
      const memo = /* @__PURE__ */ new Map();
      const resolve = (level, slot, stack) => {
        const id = `${level.name.toLowerCase()}.${slot}`;
        const cached = memo.get(id);
        if (cached) return cached;
        if (stack.includes(id)) throw new Error(`${fileName}: family "${family.name}": circular cell reference ${[...stack, id].join(" \u2192 ")}`);
        const a = authored(level, slot);
        const where = `family "${family.name}" level ${level.name} ${slot}`;
        if (!a) throw new Error(`${fileName}: ${where} is not set (level default or family override)`);
        if (a.value === "required") throw new Error(`${fileName}:${a.line}: ${where} is required: set it in family "${family.name}" (level ${level.name})`);
        const at = `${fileName}:${a.line}: ${where}`;
        let hex = null;
        const short = a.value.match(/^(p|a1|a2)(?:\.(\d+))?$/);
        const cellRef = a.value.match(/^([^$#.\s]+)\.(\S+)$/);
        if (short) {
          const color = role(short[1]);
          if (short[2] === void 0) hex = color.hex;
          else {
            hex = tones?.colors[color.key]?.[Number(short[2])] ?? null;
            if (!hex) throw new Error(`${at}: "${a.value}" \u2014 ${color.name} has no tone ${short[2]}`);
          }
        } else if (a.value.startsWith("$")) {
          const found = lookupColorRef(a.value.slice(1), brandColors, tones?.colors);
          hex = found ? normalizeHex(found) : null;
          if (!hex) throw new Error(`${at}: unknown color "${a.value}"`);
        } else if (a.value.startsWith("#")) {
          hex = normalizeHex(a.value);
        } else if (cellRef) {
          const target = levelByKey.get(cellRef[1].toLowerCase());
          if (!target || !LEVEL_SLOTS.includes(cellRef[2])) throw new Error(`${at}: "${a.value}" is not a cell (level.slot)`);
          hex = resolve(target, cellRef[2], [...stack, id]);
        }
        if (!hex || !isHex6(hex)) throw new Error(`${at}: value "${a.value}" must be p / a1 / a2 [.step], $ref [.step], #HEX or level.slot`);
        memo.set(id, hex);
        return hex;
      };
      cells[family.name] = {};
      for (const level of levelsRaw) {
        const cell = {};
        for (const slot of LEVEL_SLOTS) cell[slot] = resolve(level, slot, []);
        cells[family.name][level.name] = cell;
        if (colorRulesDeclared) colorWarnings.push(...levelRuleViolations(family.name, level.name, cell, rules));
      }
    });
    result.levels = { names, cells };
  } else if (familiesRaw.some((f) => f.signal || f.levels.length > 0)) {
    throw new Error(`${fileName}: family signal: / level overrides need a levels block`);
  }
  if (Object.keys(brandColors).length > 0) {
    result.brandColors = brandColors;
    if (Object.keys(brandColorPrint).length > 0) result.brandColorPrint = brandColorPrint;
  }
  if (Object.keys(stateColorsRaw).length > 0) {
    const state = {};
    for (const [key, value] of Object.entries(stateColorsRaw)) {
      if (!STATE_KEYS.has(key)) continue;
      const hex = normalizeHex(value);
      if (!hex) {
        throw new Error(`${fileName}: state-colors "${key}" value "${value}" is not a valid hex`);
      }
      state[key] = hex;
    }
    if (Object.keys(state).length > 0) result.stateColors = state;
  }
  if (Object.keys(colorBoundsRaw).length > 0) {
    const bounds = {};
    if (colorBoundsRaw.light !== void 0) bounds.light = parseFloat(colorBoundsRaw.light);
    if (colorBoundsRaw.dark !== void 0) bounds.dark = parseFloat(colorBoundsRaw.dark);
    if (colorBoundsRaw["saturation-floor"] !== void 0) {
      bounds.saturationFloor = parseFloat(colorBoundsRaw["saturation-floor"]);
    }
    result.colorBounds = bounds;
  }
  if (Object.keys(adherenceOverridesRaw).length > 0) {
    const overrides = {};
    if (adherenceOverridesRaw["hue-tolerance"] !== void 0) {
      overrides.hueTolerance = parseFloat(adherenceOverridesRaw["hue-tolerance"]);
    }
    if (adherenceOverridesRaw["sat-tolerance"] !== void 0) {
      overrides.satTolerance = parseFloat(adherenceOverridesRaw["sat-tolerance"]);
    }
    if (Object.keys(overrides).length > 0) result.colorAdherenceOverrides = overrides;
  }
  if (result.colorMode === "guided" && !(colorFamilies && colorFamilies.families.length >= 2)) {
    if (colorGroups.length === 0) {
      throw new Error(
        `${fileName}: color-mode: guided requires grouped brand-colors syntax or a color-families block with at least two families \u2014 flat syntax alone is not sufficient.`
      );
    }
    const primary = colorGroups.find((g) => g.key === "primary");
    const neutral2 = colorGroups.find((g) => g.key === "neutral");
    if (!primary) {
      throw new Error(`${fileName}: color-mode: guided requires a "primary" group`);
    }
    if (!neutral2) {
      throw new Error(`${fileName}: color-mode: guided requires a "neutral" group`);
    }
    const neutralRoles = new Set(neutral2.entries.map((e) => e.role).filter(Boolean));
    if (!neutralRoles.has("light")) {
      throw new Error(`${fileName}: color-mode: guided requires neutral group to declare at least role "light"`);
    }
    if (!neutralRoles.has("dark")) {
      throw new Error(`${fileName}: color-mode: guided requires neutral group to declare at least role "dark"`);
    }
    if (primary.entries.length === 0) {
      throw new Error(`${fileName}: color-mode: guided requires primary group to have at least one color`);
    }
  }
  const themePairs = {};
  const neutral = colorGroups.find((g) => g.key === "neutral");
  const neutralText = ["dark", "light"].map((role) => neutral?.entries.find((e) => e.role === role)?.hex).filter((h) => !!h);
  for (const [name, theme] of Object.entries(themes)) {
    const pairRaw = {};
    for (const key of PAIR_KEYS) {
      if (theme[key] !== void 0) {
        pairRaw[key] = theme[key];
        delete theme[key];
      }
    }
    for (const [slot, value] of Object.entries(theme)) {
      theme[slot] = resolveThemeSlotValue(value, brandColors, fileName, slot, tones?.colors);
    }
    if (Object.keys(pairRaw).length === 0) continue;
    if (!pairRaw.ground || !pairRaw.figure) {
      throw new Error(`${fileName}: theme "${name}" needs both "ground:" and "figure:" (pair theme), or neither`);
    }
    const solid = (key, value) => {
      const hex = resolveThemeSlotValue(value, brandColors, fileName, key, tones?.colors);
      if (!isHex6(hex)) throw new Error(`${fileName}: theme "${name}" ${key} must be a solid 6-digit color, got "${value}"`);
      return hex;
    };
    const ground = solid("ground", pairRaw.ground);
    const figure = solid("figure", pairRaw.figure);
    let text;
    if (pairRaw.text) {
      text = solid("text", pairRaw.text);
    } else {
      const resolved = resolveTextColor(ground, neutralText, rules);
      text = resolved.text;
      if (!resolved.passes) {
        colorWarnings.push(`theme "${name}": no text color reaches ${rules.text}:1 on ${ground} \u2014 using ${text} (${resolved.ratio.toFixed(1)}:1)`);
      }
    }
    themes[name] = { ...derivePairSlots(ground, figure, text), ...theme };
    themePairs[name] = { ground, figure, text };
  }
  if (colorFamilies) {
    const config = { order: colorFamilies.order, borrow: colorFamilies.borrow, distance: colorFamilies.distance };
    const toneAnchors = toneAnchorsFrom(tones?.colors, (name) => {
      const raw = brandColors[name];
      return raw ? normalizeHex(raw) ?? void 0 : void 0;
    });
    colorFamilies.families.forEach((family, index) => {
      const raw = familiesRaw[index];
      raw.pairs.forEach((p, n) => {
        const resolve = (value) => {
          const found = value.startsWith("$") ? lookupColorRef(value.slice(1), brandColors, tones?.colors) : value;
          const hex = found ? normalizeHex(found) : null;
          if (!hex || !isHex6(hex)) throw new Error(`${fileName}:${p.line}: pair color "${value}" is not a known 6-digit color`);
          return hex;
        };
        const check = checkFamilyPair(resolve(p.ground), resolve(p.figure), index, colorFamilies, config, rules, neutralText, toneAnchors);
        const themeName = `${family.name}-${n + 1}`;
        if (check.valid) {
          if (themes[themeName]) throw new Error(`${fileName}: family pair theme "${themeName}" collides with an authored theme`);
          themes[themeName] = derivePairSlots(check.ground, check.figure, check.text);
          themePairs[themeName] = { ground: check.ground, figure: check.figure, text: check.text, family: family.name };
          family.pairs.push({ ...check, theme: themeName });
          if (!check.textPasses) {
            colorWarnings.push(`${themeName}: no text color reaches ${rules.text}:1 on ${check.ground} \u2014 using ${check.text} (${check.textRatio.toFixed(1)}:1)`);
          }
        } else {
          family.pairs.push(check);
          colorWarnings.push(`${themeName} (${check.ground} / ${check.figure}) rejected: ${check.reasons.join("; ")}`);
        }
      });
    });
  }
  for (const theme of Object.values(themes)) {
    if (theme["headline"] === void 0 && theme["text-primary"] !== void 0) theme["headline"] = theme["text-primary"];
    if (theme["counter-bg"] === void 0 && theme["label-bg"] !== void 0) theme["counter-bg"] = theme["label-bg"];
    if (theme["counter-fg"] === void 0 && theme["label-fg"] !== void 0) theme["counter-fg"] = theme["label-fg"];
  }
  if (colorRulesDeclared) {
    for (const [name, theme] of Object.entries(themes)) {
      const bg = theme["background"];
      if (!bg || !isHex6(bg)) continue;
      const txt = theme["text-primary"];
      if (txt && isHex6(txt) && contrastRatio(bg, txt) < rules.text && !themePairs[name]) {
        colorWarnings.push(`theme "${name}": text-primary ${txt} on ${bg} is ${contrastRatio(bg, txt).toFixed(1)}:1, below ${rules.text}:1`);
      }
      const fig = theme["logo"];
      if (fig && isHex6(fig) && contrastRatio(bg, fig) < rules.figure && !themePairs[name]?.family) {
        colorWarnings.push(`theme "${name}": logo ${fig} on ${bg} is ${contrastRatio(bg, fig).toFixed(1)}:1, below ${rules.figure}:1`);
      }
    }
  }
  if (result.colorMode === "brand" && Object.keys(themes).length === 0 && !result.levels) {
    throw new Error(`${fileName}: color-mode: brand requires at least one theme (a theme block or a valid color-families pair)`);
  }
  if (Object.keys(themes).length > 0) {
    result.themes = themes;
    result.themeDescriptions = themeDescriptions;
  }
  if (Object.keys(themePairs).length > 0) result.themePairs = themePairs;
  if (colorWarnings.length > 0) result.colorWarnings = colorWarnings;
  if (Object.keys(spacingRaw).length > 0) {
    result.spacing = {
      unit: spacingRaw["unit"] ?? "cqmin",
      xs: parseFloat(spacingRaw["xs"] ?? "1.5"),
      s: parseFloat(spacingRaw["s"] ?? "2"),
      m: parseFloat(spacingRaw["m"] ?? "3"),
      l: parseFloat(spacingRaw["l"] ?? "5"),
      xl: parseFloat(spacingRaw["xl"] ?? "6.5")
    };
  }
  if (Object.keys(dividersRaw).length > 0) {
    const dividers = {};
    for (const [name, raw] of Object.entries(dividersRaw)) {
      const alignRaw = raw["align"] ?? "left";
      const align = alignRaw === "center" ? "center" : alignRaw === "right" ? "right" : "left";
      dividers[name] = {
        thickness: parseFloat(raw["thickness"] ?? "0.2"),
        width: raw["width"] ?? "100%",
        spacing: raw["spacing"] ?? "xs",
        align
      };
    }
    result.dividers = dividers;
  }
  if (fontsRaw.length > 0) {
    const fonts = {};
    for (const { name, props } of fontsRaw) {
      const fontName = props["name"];
      if (!fontName) {
        console.warn(`${fileName}: font block "${name}" missing "name:" property \u2014 skipping`);
        continue;
      }
      const rawSource = props["source"];
      const source = rawSource === "system" ? "system" : rawSource === "google" ? "google" : "local";
      const fallback = props["fallback"] ?? "sans-serif";
      const def = { name: fontName, fallback, source };
      if (props["variable"]) def.variable = props["variable"];
      if (props["variable-italic"]) def.variableItalic = props["variable-italic"];
      const staticInstances = {};
      for (const [key, value] of Object.entries(props)) {
        const match = key.match(/^static-(\d{3})(i)?$/);
        if (match) staticInstances[match[1] + (match[2] ?? "")] = value;
      }
      if (Object.keys(staticInstances).length > 0) def.static = staticInstances;
      fonts[name] = def;
    }
    if (Object.keys(fonts).length > 0) result.fonts = fonts;
  }
  if (Object.keys(typographiesRaw).length > 0) {
    const typographies = {};
    for (const [name, raw] of Object.entries(typographiesRaw)) {
      const weight = parseInt(raw["weight"] ?? "400", 10);
      const size = parseFloat(raw["size"] ?? "3");
      const lineHeight = parseFloat(raw["lineHeight"] ?? "1.4");
      if (isNaN(weight) || isNaN(size) || isNaN(lineHeight)) {
        console.warn(`${fileName}: typography "${name}" has invalid numeric values \u2014 skipping`);
        continue;
      }
      const def = { weight, size, lineHeight };
      if (raw["font"] !== void 0) def.font = raw["font"].replace(/^\$/, "");
      if (raw["opsz"] !== void 0) def.opsz = parseFloat(raw["opsz"]);
      if (raw["letterSpacing"] !== void 0) def.letterSpacing = parseFloat(raw["letterSpacing"]);
      if (raw["italic"] === "true" || raw["italic"] === "") def.italic = true;
      if (raw["uppercase"] === "true" || raw["uppercase"] === "") def.uppercase = true;
      if (raw["strong"] !== void 0) def.strong = parseInt(raw["strong"], 10);
      if (raw["autofit-min"] !== void 0) def.autofitMin = parseFloat(raw["autofit-min"]);
      if (raw["autofit-max"] !== void 0) def.autofitMax = parseFloat(raw["autofit-max"]);
      typographies[name] = def;
    }
    result.typographies = typographies;
  }
  const parsePercent = (v) => parseFloat(v);
  const toAssetDef = (raw) => {
    const def = { id: raw.id, label: raw.props["label"] ?? raw.id, src: raw.props["src"] ?? "" };
    if (raw.props["aspect"]) def.aspectRatio = parseFloat(raw.props["aspect"]);
    if (raw.props["scale"]) def.scale = parseFloat(raw.props["scale"]);
    if (raw.props["lottie"]) def.lottieSrc = raw.props["lottie"];
    if (raw.props["animated"] === "true") def.animated = true;
    if (raw.props["loop"] === "true") def.loop = true;
    if (raw.props["gltf"]) def.gltfSrc = raw.props["gltf"];
    if (raw.props["generator"]) def.generator = raw.props["generator"];
    const folders = def.src.split("/").slice(1, -1);
    if (folders.length === 1) def.section = folders[0].normalize("NFC");
    if (raw.props["when"]) def.when = raw.props["when"];
    for (const key of ["framing", "place", "person", "group", "work", "taken"]) {
      if (raw.props[key]) def[key] = raw.props[key];
    }
    const focus = raw.props["focus"];
    if (focus) def.focus = focus === "none" ? null : (() => {
      const [x, y] = focus.split(/\s+/).map(parsePercent);
      return { x, y };
    })();
    const horizon = raw.props["horizon"];
    if (horizon) def.horizon = horizon === "none" ? null : parsePercent(horizon);
    const paramEntries = [];
    for (const [k, v] of Object.entries(raw.props)) {
      if (k.startsWith("generator-params.")) {
        const paramKey = k.slice("generator-params.".length);
        const n = parseFloat(v);
        if (!Number.isNaN(n)) paramEntries.push([paramKey, n]);
      }
    }
    if (paramEntries.length > 0) def.generatorParams = Object.fromEntries(paramEntries);
    for (const align of ["left", "center", "right"]) {
      const src = raw.props[`align-${align}.src`];
      if (!src) continue;
      const aspect = raw.props[`align-${align}.aspect`];
      def.alignVariants = { ...def.alignVariants, [align]: { src, ...aspect ? { aspectRatio: parseFloat(aspect) } : {} } };
    }
    return def;
  };
  const photoOnly = ["when", "framing", "place", "person", "group", "work", "taken", "focus", "horizon"];
  for (const [kind, arr] of [["logo", logosRaw], ["video", videosRaw], ["illustration", illustrationsRaw]]) {
    for (const key of photoOnly) {
      const a = arr.find((r) => r.props[key]);
      if (a && key === "group") throw new Error(`${fileName}: ${kind} "${a.id}": group: names a .group and is for photos only; a library section is the subfolder since v0.46`);
      if (a) throw new Error(`${fileName}: ${kind} "${a.id}": ${key}: is for photos only`);
    }
  }
  for (const p of photosRaw) {
    if (p.props["src"] !== void 0) throw new Error(`${fileName}: photo "${p.id}": src: is gone since v0.46; the file name is the id, put the file at photos/${p.id}.jpg or in a folder below photos/`);
    if (!/^[a-z][a-z0-9-]*$/.test(p.id)) throw new Error(`${fileName}: photo "${p.id}": the id is the file name and must be lowercase kebab-case`);
  }
  for (const [kind, arr] of [["logo", logosRaw], ["photo", photosRaw], ["video", videosRaw], ["illustration", illustrationsRaw]]) {
    for (const a of arr) {
      if (a.props["section"] !== void 0) throw new Error(`${fileName}: ${kind} "${a.id}": section: is gone since v0.46; the section is the subfolder, put the file in ${kind === "illustration" ? "its folder" : `${kind}s`}/<section>/`);
      const src = a.props["src"] ?? "";
      if (src.split("/").length > 3) throw new Error(`${fileName}: ${kind} "${a.id}": src: "${src}" is nested too deep; one subfolder (the section) is the limit`);
    }
  }
  for (const p of photosRaw) {
    for (const key of ["when", "person", "group", "work"]) {
      const value = p.props[key];
      if (value && !/^[a-z][a-z0-9-]*$/.test(value)) throw new Error(`${fileName}: photo "${p.id}": ${key}: must be an id (lowercase kebab-case), got "${value}"${key === "group" ? " (a library section is the subfolder since v0.46)" : ""}`);
    }
    const taken = p.props["taken"];
    if (taken && !/^\d{4}-\d{2}-\d{2}$/.test(taken)) throw new Error(`${fileName}: photo "${p.id}": taken: must be YYYY-MM-DD, got "${taken}"`);
    const framing = p.props["framing"];
    if (framing && !framingsRaw.some((f) => f.id === framing)) throw new Error(`${fileName}: photo "${p.id}" references unknown framing "${framing}"`);
    const focus = p.props["focus"];
    if (focus && focus !== "none" && !/^\d+(\.\d+)?%\s+\d+(\.\d+)?%$/.test(focus)) throw new Error(`${fileName}: photo "${p.id}": focus: must be "X% Y%" or "none", got "${focus}"`);
    const horizon = p.props["horizon"];
    if (horizon && horizon !== "none" && !/^\d+(\.\d+)?%$/.test(horizon)) throw new Error(`${fileName}: photo "${p.id}": horizon: must be "N%" or "none", got "${horizon}"`);
    for (const v of [...focus && focus !== "none" ? focus.split(/\s+/) : [], ...horizon && horizon !== "none" ? [horizon] : []]) {
      if (parsePercent(v) > 100) throw new Error(`${fileName}: photo "${p.id}": ${v} is above 100%`);
    }
  }
  if (logosRaw.length > 0 || photosRaw.length > 0 || videosRaw.length > 0 || illustrationsRaw.length > 0) {
    result.assets = {};
    if (logosRaw.length > 0) result.assets.logos = logosRaw.map(toAssetDef);
    if (photosRaw.length > 0) result.assets.photos = photosRaw.map(toAssetDef);
    if (videosRaw.length > 0) result.assets.videos = videosRaw.map(toAssetDef);
    if (illustrationsRaw.length > 0) result.assets.illustrations = illustrationsRaw.map(toAssetDef);
  }
  const parseBadgeStyle = (raw, defaults) => {
    const padding = (() => {
      const p = raw["padding"];
      if (!p) return defaults.padding;
      const nums = p.split(/\s+/).map(parseFloat).filter((n) => !isNaN(n));
      if (nums.length === 1) return [nums[0], nums[0], nums[0], nums[0]];
      if (nums.length === 2) return [nums[0], nums[1], nums[0], nums[1]];
      if (nums.length === 3) return [nums[0], nums[1], nums[2], nums[1]];
      if (nums.length >= 4) return [nums[0], nums[1], nums[2], nums[3]];
      return defaults.padding;
    })();
    const radius = raw["radius"] !== void 0 ? parseFloat(raw["radius"]) : defaults.radius;
    return { padding, radius: isNaN(radius) ? defaults.radius : radius };
  };
  if (Object.keys(labelRaw).length > 0) {
    result.label = parseBadgeStyle(labelRaw, { padding: [0.5, 1, 0.7, 1], radius: 0 });
  }
  if (Object.keys(ctaRaw).length > 0) {
    result.cta = parseBadgeStyle(ctaRaw, { padding: [0.8, 2.5, 0.8, 2.5], radius: 999 });
  }
  if (iconsDeclared) {
    if (icons.length === 0) throw new Error(`${fileName}: icons block is empty`);
    const fontNames = Object.keys(result.fonts ?? {});
    for (const icon of icons) {
      if (icon.source.kind !== "font") continue;
      if (!icon.source.font) {
        if (fontNames.length === 0) throw new Error(`${fileName}: icon "${icon.id}" uses a font glyph, but no font block is declared`);
        icon.source.font = fontNames[0];
      } else if (!fontNames.includes(icon.source.font)) {
        throw new Error(`${fileName}: icon "${icon.id}" references unknown font "$${icon.source.font}"`);
      }
    }
    result.icons = icons;
  }
  if (counterDeclared) {
    const known = /* @__PURE__ */ new Set(["format", "typography", "shape", "size", "padding"]);
    for (const [key, { line }] of Object.entries(counterRaw)) {
      if (!known.has(key)) throw new Error(`${fileName}:${line}: unknown counter property "${key}"`);
    }
    const formats = ["1", "01", "1.", "(1)", "i"];
    const shapes = ["none", "circle", "square", "pill"];
    const em = (key, fallback) => {
      const entry = counterRaw[key];
      if (!entry) return fallback;
      const m = entry.value.match(/^(\d+(?:\.\d+)?)(?:em)?$/);
      if (!m) throw new Error(`${fileName}:${entry.line}: counter ${key} must be a number in em (e.g. "1.2em"), got "${entry.value}"`);
      return parseFloat(m[1]);
    };
    const format = counterRaw["format"]?.value ?? "1";
    if (!formats.includes(format)) {
      throw new Error(`${fileName}:${counterRaw["format"].line}: counter format must be one of ${formats.join(" | ")}, got "${format}"`);
    }
    const shape = counterRaw["shape"]?.value ?? "circle";
    if (!shapes.includes(shape)) {
      throw new Error(`${fileName}:${counterRaw["shape"].line}: counter shape must be one of ${shapes.join(" | ")}, got "${shape}"`);
    }
    const counter = {
      format,
      shape,
      size: em("size", 1),
      padding: em("padding", 0.2)
    };
    const typo = counterRaw["typography"];
    if (typo) {
      if (!result.typographies?.[typo.value]) throw new Error(`${fileName}:${typo.line}: counter typography "${typo.value}" is not a declared typography`);
      counter.typography = typo.value;
    }
    result.counter = counter;
  }
  if (cameraDeclared) {
    const known = /* @__PURE__ */ new Set(["facing", "grid"]);
    for (const [key, { line }] of Object.entries(cameraRaw)) {
      if (!known.has(key)) throw new Error(`${fileName}:${line}: unknown camera property "${key}"`);
    }
    const facing = cameraRaw["facing"]?.value ?? "rear";
    if (facing !== "front" && facing !== "rear") {
      throw new Error(`${fileName}:${cameraRaw["facing"].line}: camera facing must be front | rear, got "${facing}"`);
    }
    const camera = { facing };
    const g = cameraRaw["grid"];
    if (g) {
      const nums = g.value.split(/\s+/).map(Number);
      const [rows, cols = rows] = nums;
      if (nums.length > 2 || ![rows, cols].every((n) => Number.isInteger(n) && n >= 2 && n <= 12)) {
        throw new Error(`${fileName}:${g.line}: camera grid must be "N" or "ROWS COLS" (2\u201312), got "${g.value}"`);
      }
      camera.grid = { rows, cols };
    }
    result.camera = camera;
  }
  if (locationDeclared) {
    const known = /* @__PURE__ */ new Set(["name", "latitude", "longitude"]);
    for (const [key, { line }] of Object.entries(locationRaw)) {
      if (!known.has(key)) throw new Error(`${fileName}:${line}: unknown location property "${key}"`);
    }
    for (const key of known) {
      if (!locationRaw[key]?.value) throw new Error(`${fileName}: location needs ${key}:`);
    }
    const degrees = (key, limit) => {
      const { value, line } = locationRaw[key];
      const n = Number(value);
      if (!/^-?\d+(\.\d+)?$/.test(value) || Math.abs(n) > limit) {
        throw new Error(`${fileName}:${line}: location ${key} must be decimal degrees (\u2212${limit} to ${limit}), got "${value}"`);
      }
      return n;
    };
    result.location = { name: locationRaw["name"].value, latitude: degrees("latitude", 90), longitude: degrees("longitude", 180) };
  }
  if (photoLookDeclared) {
    const keys = ["saturation", "contrast", "warmth", "fade", "mono", "duotone"];
    for (const [key, { line }] of Object.entries(photoLookRaw)) {
      if (key !== "fixed" && key !== "scrim" && !keys.includes(key)) throw new Error(`${fileName}:${line}: unknown photo-look property "${key}"`);
    }
    const int = (key, min, max) => {
      const p = photoLookRaw[key];
      if (!p) return 0;
      const n = Number(p.value);
      if (!/^[+-]?\d+$/.test(p.value) || n < min || n > max) {
        throw new Error(`${fileName}:${p.line}: photo-look ${key} must be an integer from ${min} to ${max}, got "${p.value}"`);
      }
      return n;
    };
    const look = {
      saturation: int("saturation", -100, 100),
      contrast: int("contrast", -100, 100),
      warmth: int("warmth", -100, 100),
      fade: int("fade", 0, 100),
      mono: false,
      fixed: []
    };
    const mono = photoLookRaw["mono"];
    if (mono) {
      if (mono.value !== "") throw new Error(`${fileName}:${mono.line}: photo-look mono is a flag and takes no value`);
      look.mono = true;
    }
    const duo = photoLookRaw["duotone"];
    if (duo) {
      if (mono) throw new Error(`${fileName}:${duo.line}: photo-look cannot be both mono and duotone`);
      const refs = duo.value.split(/\s+/);
      if (refs.length !== 2) throw new Error(`${fileName}:${duo.line}: photo-look duotone must be "SHADOW HIGHLIGHT", got "${duo.value}"`);
      const [shadow, highlight] = refs.map((ref) => {
        const found = ref.startsWith("$") ? lookupColorRef(ref.slice(1), brandColors, tones?.colors) : ref;
        if (!found) {
          throw new Error(`${fileName}:${duo.line}: photo-look duotone references unknown brand color "${ref}"`);
        }
        const hex = normalizeHex(found);
        if (!hex) throw new Error(`${fileName}:${duo.line}: photo-look duotone colors must be $ref or #HEX, got "${ref}"`);
        return hex;
      });
      look.duotone = { shadow, highlight };
    }
    const fixed = photoLookRaw["fixed"];
    if (fixed) {
      for (const key of fixed.value.split(/\s+/)) {
        if (!keys.includes(key)) throw new Error(`${fileName}:${fixed.line}: photo-look fixed lists unknown key "${key}"`);
        if (!photoLookRaw[key]) throw new Error(`${fileName}:${fixed.line}: photo-look fixed lists "${key}", which is not set`);
        look.fixed.push(key);
      }
    }
    const scrim = photoLookRaw["scrim"];
    if (scrim) {
      const m = /^(\d+)%$/.exec(scrim.value);
      if (!m || Number(m[1]) < 1 || Number(m[1]) > 100) {
        throw new Error(`${fileName}:${scrim.line}: photo-look scrim must be a percentage from 1% to 100%, got "${scrim.value}"`);
      }
      look.scrim = Number(m[1]);
    }
    result.photoLook = look;
  }
  if (framingsRaw.length > 0) {
    const known = /* @__PURE__ */ new Set(["label", "horizon", "description", "caption", "goals"]);
    result.framings = framingsRaw.map(({ id, line, props }) => {
      for (const [key, { line: l }] of Object.entries(props)) {
        if (!known.has(key)) throw new Error(`${fileName}:${l}: unknown framing property "${key}"`);
      }
      const h = props["horizon"];
      if (!h) throw new Error(`${fileName}:${line}: framing "${id}" needs "horizon: N%" or "horizon: none"`);
      let horizon = null;
      if (h.value !== "none") {
        const m = h.value.match(/^(\d+(?:\.\d+)?)%$/);
        const n = m ? parseFloat(m[1]) : NaN;
        if (!(n > 0 && n < 100)) throw new Error(`${fileName}:${h.line}: framing horizon must be a percentage between 0% and 100% or "none", got "${h.value}"`);
        horizon = n;
      }
      const def = { id, label: props["label"]?.value || id, horizon };
      if (props["description"]?.value) def.description = props["description"].value;
      if (props["caption"]?.value) def.caption = props["caption"].value;
      if (props["goals"]?.value) def.goals = props["goals"].value.split(",").map((g) => g.trim()).filter(Boolean);
      return def;
    });
  }
  const required = ["id", "name", "language", "locale"];
  for (const field of required) {
    if (!result[field]) {
      throw new Error(`${fileName}: missing required field "${field}"`);
    }
  }
  if (warnings.length > 0) result.warnings = warnings;
  return result;
}
var PHOTO_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif", "gif"];
function photoLibrary(declared, files, fileName) {
  const byId = /* @__PURE__ */ new Map();
  for (const raw of files) {
    const path = raw.normalize("NFC");
    const parts = path.split("/");
    const name = parts[parts.length - 1];
    const dot = name.lastIndexOf(".");
    const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
    if (!PHOTO_EXTENSIONS.includes(ext)) throw new Error(`${fileName}: photos/${path}: not a photo (${PHOTO_EXTENSIONS.join(", ")})`);
    const id = name.slice(0, dot);
    if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error(`${fileName}: photos/${path}: the file name is the photo's id and must be lowercase kebab-case (e.g. glas-am-fenster.${ext})`);
    if (parts.length > 3) throw new Error(`${fileName}: photos/${path}: nested too deep; two folders below photos/ are the limit`);
    const other = byId.get(id);
    if (other) throw new Error(`${fileName}: photos/${path} and ${other.src} have the same name; a photo's file name is its id and must be unique`);
    byId.set(id, { src: `photos/${path}`, ...parts.length > 1 ? { section: parts[0] } : {}, ...parts.length > 2 ? { subsection: parts[1] } : {} });
  }
  const out = [];
  for (const d of declared ?? []) {
    const file = byId.get(d.id);
    if (!file) throw new Error(`${fileName}: photo "${d.id}" has no file; put ${d.id}.jpg (or .png, .webp\u2026) below photos/`);
    const { section: _s, subsection: _ss, ...facts } = d;
    out.push({ ...facts, ...file });
    byId.delete(d.id);
  }
  for (const [id, file] of byId) out.push({ id, label: id, ...file });
  return out;
}
function checkBrand(brand, facts, fileName) {
  const problems = [];
  const say = (msg) => problems.push(`${fileName}: ${msg}`);
  const photos = brand.assets?.photos ?? [];
  if (facts.time !== void 0) {
    const time = facts.time;
    const noTime = " (the brand has no .time)";
    for (const f of brand.colorFamilies?.families ?? []) {
      if (f.season && !time?.seasons.some((s) => s.name === f.season)) say(`family "${f.name}": season "${f.season}" is not in the .time${time ? "" : noTime}`);
    }
    for (const p of photos) {
      if (p.when && !(time && timeEntryNames(time).includes(p.when))) say(`photo "${p.id}": when "${p.when}" is not in the .time${time ? "" : noTime}`);
    }
  }
  if (facts.people !== void 0) {
    const people = new Map(facts.people.map((p) => [p.id, p]));
    for (const p of photos) {
      if (!p.person) continue;
      const person = people.get(p.person);
      if (!person) {
        say(`photo "${p.id}": person "${p.person}" does not exist`);
        continue;
      }
      if (!person.photos?.includes(p.id)) say(`photo "${p.id}" names person "${person.id}", but their photos: doesn't list it (the person agreed to the photos the file lists)`);
    }
    for (const person of facts.people) {
      for (const id of person.photos ?? []) {
        const photo = photos.find((p) => p.id === id);
        if (!photo) say(`person "${person.id}": photo "${id}" does not exist`);
        else if (photo.person !== person.id) say(`person "${person.id}": photo "${id}" ${photo.person ? `shows "${photo.person}"` : "names no person"} (add "person: ${person.id}" to the photo)`);
      }
    }
  }
  const mirror = (kind, files, hint) => {
    if (!files) return;
    const byId = new Map(files.map((f) => [f.id, f]));
    for (const p of photos) {
      const id = p[kind];
      if (!id) continue;
      const file = byId.get(id);
      if (!file) {
        say(`photo "${p.id}": ${kind} "${id}" does not exist${hint}`);
        continue;
      }
      if (!file.photos?.includes(p.id)) say(`photo "${p.id}" names ${kind} "${id}", but its photos: doesn't list it`);
    }
    for (const file of files) {
      for (const id of file.photos ?? []) {
        const photo = photos.find((p) => p.id === id);
        if (!photo) say(`${kind} "${file.id}": photo "${id}" does not exist`);
        else if (photo[kind] !== file.id) say(`${kind} "${file.id}": photo "${id}" ${photo[kind] ? `shows "${photo[kind]}"` : `names no ${kind}`} (add "${kind}: ${file.id}" to the photo)`);
      }
    }
  };
  mirror("group", facts.groups, " (a library section is the subfolder since v0.46)");
  mirror("work", facts.works, "");
  return problems;
}

// parser/formatParser.ts
var ZONE_NONE = { top: 0, bottom: 0, left: 0, right: 0 };
function parsePositiveInt(s, fileName, lineNum, field) {
  const n = parseInt(s, 10);
  if (isNaN(n) || n < 0) throw new Error(`${fileName}:${lineNum}: ${field} must be a non-negative integer, got "${s}"`);
  return n;
}
function parseInsets(parts, fileName, lineNum, field) {
  if (parts.length === 1) {
    const v = parsePositiveInt(parts[0], fileName, lineNum, field);
    return { top: v, right: v, bottom: v, left: v };
  }
  if (parts.length === 2) {
    const v = parsePositiveInt(parts[0], fileName, lineNum, `${field} top/bottom`);
    const h = parsePositiveInt(parts[1], fileName, lineNum, `${field} left/right`);
    return { top: v, right: h, bottom: v, left: h };
  }
  if (parts.length === 4) {
    return {
      top: parsePositiveInt(parts[0], fileName, lineNum, `${field} top`),
      right: parsePositiveInt(parts[1], fileName, lineNum, `${field} right`),
      bottom: parsePositiveInt(parts[2], fileName, lineNum, `${field} bottom`),
      left: parsePositiveInt(parts[3], fileName, lineNum, `${field} left`)
    };
  }
  throw new Error(`${fileName}:${lineNum}: ${field} requires 1, 2, or 4 values (got ${parts.length})`);
}
function scaleInsets(insets, factor) {
  return {
    top: Math.round(insets.top * factor),
    right: Math.round(insets.right * factor),
    bottom: Math.round(insets.bottom * factor),
    left: Math.round(insets.left * factor)
  };
}
function parseFormatFile(content, fileName) {
  const lines = content.split("\n");
  let id;
  let name;
  let label;
  let sublabel;
  let category;
  let post;
  let widthPx;
  let heightPx;
  let widthMm;
  let heightMm;
  let dpi;
  let bleedMm;
  let grid;
  let danger = ZONE_NONE;
  let gridCrop = null;
  let comfortRaw;
  let comfortIsMm = false;
  let purposes;
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i].trim().replace(/\s+#.*$/, "");
    if (!line || line.startsWith("#")) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: expected "key: value", got "${line}"`);
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    switch (key) {
      case "id":
        id = value;
        break;
      case "name":
        name = value;
        break;
      case "label":
        label = value;
        break;
      case "sublabel":
        sublabel = value;
        break;
      case "category":
        if (value !== "instagram" && value !== "facebook" && value !== "linkedin" && value !== "print" && value !== "signage")
          throw new Error(`${fileName}:${lineNum}: category must be instagram, facebook, linkedin, print, or signage, got "${value}"`);
        category = value;
        break;
      case "post":
        if (value !== "feed" && value !== "story")
          throw new Error(`${fileName}:${lineNum}: post must be feed or story, got "${value}"`);
        post = value;
        break;
      case "size": {
        const parts = value.split(/\s+/);
        if (parts.length !== 2) throw new Error(`${fileName}:${lineNum}: size requires 2 values, got "${value}"`);
        const isMm = parts[0].endsWith("mm");
        if (isMm) {
          widthMm = parseFloat(parts[0]);
          heightMm = parseFloat(parts[1]);
          if (isNaN(widthMm) || isNaN(heightMm) || widthMm <= 0 || heightMm <= 0)
            throw new Error(`${fileName}:${lineNum}: invalid mm dimensions "${value}"`);
        } else {
          widthPx = parsePositiveInt(parts[0], fileName, lineNum, "width");
          heightPx = parsePositiveInt(parts[1], fileName, lineNum, "height");
          if (widthPx <= 0 || heightPx <= 0)
            throw new Error(`${fileName}:${lineNum}: size values must be positive`);
        }
        break;
      }
      case "dpi":
        dpi = parseInt(value, 10);
        if (isNaN(dpi) || dpi <= 0) throw new Error(`${fileName}:${lineNum}: dpi must be a positive integer, got "${value}"`);
        break;
      case "bleed": {
        const raw = value.endsWith("mm") ? parseFloat(value) : parseFloat(value);
        if (isNaN(raw) || raw < 0) throw new Error(`${fileName}:${lineNum}: bleed must be a non-negative number, got "${value}"`);
        bleedMm = raw;
        break;
      }
      case "grid": {
        const parts = value.split(/\s+/);
        if (parts.length !== 2) throw new Error(`${fileName}:${lineNum}: grid requires "rows cols", got "${value}"`);
        const rows = parseInt(parts[0], 10);
        const cols = parseInt(parts[1], 10);
        if (isNaN(rows) || rows < 1 || isNaN(cols) || cols < 1)
          throw new Error(`${fileName}:${lineNum}: grid rows and cols must be positive integers`);
        grid = { rows, cols };
        break;
      }
      case "danger": {
        const parts = value.split(/\s+/);
        danger = parseInsets(parts, fileName, lineNum, "danger");
        break;
      }
      case "crop": {
        if (value === "none") {
          gridCrop = null;
        } else {
          const parts = value.split(/\s+/);
          gridCrop = parseInsets(parts, fileName, lineNum, "crop");
        }
        break;
      }
      case "comfort": {
        const isMm = value.endsWith("mm");
        comfortIsMm = isMm;
        comfortRaw = isMm ? parseFloat(value) : parseFloat(value);
        if (isNaN(comfortRaw) || comfortRaw < 0)
          throw new Error(`${fileName}:${lineNum}: comfort must be a non-negative number, got "${value}"`);
        break;
      }
      case "purposes": {
        purposes = value.split(/[\s,]+/).filter(Boolean);
        break;
      }
      default:
        throw new Error(`${fileName}:${lineNum}: unknown key "${key}"`);
    }
  }
  if (!id) throw new Error(`${fileName}: missing required field "id"`);
  if (!label) throw new Error(`${fileName}: missing required field "label"`);
  if (!sublabel) throw new Error(`${fileName}: missing required field "sublabel"`);
  if (!category) throw new Error(`${fileName}: missing required field "category"`);
  const effectiveDpi = dpi ?? 300;
  if (widthMm !== void 0 && heightMm !== void 0) {
    const pxPerMm = effectiveDpi / 25.4;
    const bleed = bleedMm ?? 0;
    widthPx = Math.round((widthMm + 2 * bleed) * pxPerMm);
    heightPx = Math.round((heightMm + 2 * bleed) * pxPerMm);
  }
  if (widthPx === void 0 || heightPx === void 0)
    throw new Error(`${fileName}: missing required field "size"`);
  if (category === "print" || category === "signage") {
    const pxPerMm = effectiveDpi / 25.4;
    danger = scaleInsets(danger, pxPerMm);
    if (gridCrop) gridCrop = scaleInsets(gridCrop, pxPerMm);
  }
  let comfort = 0;
  let comfortMm;
  if (comfortRaw !== void 0) {
    if (comfortIsMm || category === "print" || category === "signage") {
      comfortMm = comfortRaw;
    } else {
      comfort = Math.round(comfortRaw);
    }
  }
  return {
    id,
    name,
    label,
    sublabel,
    category,
    post,
    widthPx,
    heightPx,
    widthMm,
    heightMm,
    dpi: dpi ?? (category === "print" || category === "signage" ? effectiveDpi : void 0),
    bleedMm,
    grid,
    danger,
    gridCrop,
    comfort,
    comfortMm,
    purposes
  };
}

// parser/types.ts
var SLOT_IDS = ["primary", "secondary", "detail", "meta", "cta", "label", "credit"];

// parser/purposeParser.ts
var VALID_SLOTS = new Set(SLOT_IDS);
function resolveFontFamily(name) {
  return `'${name}', sans-serif`;
}
function parsePurposeFile(content, fileName) {
  const lines = content.split("\n");
  let id = "";
  let name = "";
  let description = "";
  let compositions = null;
  let scope;
  let context;
  let inScopeBlock = false;
  let inContextBlock = false;
  let inVoiceBlock = false;
  const contextLines = [];
  let voice;
  let palette;
  let density;
  let defaultLogo;
  let photos;
  let defaultVideo;
  let illustrations;
  let camera;
  let cameraFacing;
  let scrim;
  let framing;
  let goal;
  let person;
  let group;
  let work;
  let analyze;
  let defaultIcon;
  let bgPrompt;
  const slots = [];
  const warnings = [];
  const examples = [];
  let currentExample = null;
  let exampleMultiKey = null;
  let legacySamplesLine = 0;
  let firstHashText = "";
  let currentSlot = null;
  let inOverrideBlock = false;
  let inListBlock = false;
  let inMultiLineSamples = false;
  function finalizeSlot(lineNum) {
    if (!currentSlot) return;
    const s = currentSlot;
    if (!s.id) throw new Error(`${fileName}:${lineNum}: slot missing id`);
    if (!s.label) throw new Error(`${fileName}:${lineNum}: slot "${s.id}" missing label`);
    if (!s.maxLength) throw new Error(`${fileName}:${lineNum}: slot "${s.id}" missing maxLength`);
    if (s.iconOnly) {
      if (s.marker && s.marker !== "icon") throw new Error(`${fileName}:${lineNum}: slot "${s.id}": iconOnly needs "marker: icon", got "${s.marker}"`);
      s.marker = "icon";
    }
    if (s.listColumns && s.listColumns > 1 && s.listDirection === "horizontal") throw new Error(`${fileName}:${lineNum}: slot "${s.id}": columns needs a vertical list`);
    if (s.labelSize !== void 0 && s.listLabels !== "above") throw new Error(`${fileName}:${lineNum}: slot "${s.id}": labelSize needs "labels: above"`);
    if (s.listDivider === "hairline" && !(s.listColumns && s.listColumns > 1)) throw new Error(`${fileName}:${lineNum}: slot "${s.id}": divider needs "columns:" 2 or more`);
    if (s.defaultIcon && s.marker !== "icon") throw new Error(`${fileName}:${lineNum}: slot "${s.id}": defaultIcon needs "marker: icon"`);
    if (!s.value && s.samples) {
      const windows = s.samples.map((sample, i) => {
        const [first, ...rest] = sample.split("\n");
        if (rest.some((l) => SAMPLE_WINDOW_MARKER.test(l))) throw new Error(`${fileName}:${lineNum}: slot "${s.id}": window marker belongs on the sample's first line ("${rest.find((l) => SAMPLE_WINDOW_MARKER.test(l))}")`);
        const m = first.match(SAMPLE_WINDOW_MARKER);
        if (!m) return void 0;
        s.samples[i] = [first.slice(0, m.index).trimEnd(), ...rest].join("\n");
        return m[1];
      });
      if (windows.some(Boolean)) s.sampleWindows = windows;
    }
    if (s.slotType === "list") {
      for (const sample of s.samples ?? []) {
        for (const item of sample.split("\n")) {
          const { icon } = parseListItem(item);
          if (icon && s.marker !== "icon") throw new Error(`${fileName}:${lineNum}: slot "${s.id}": sample item "${item}" names an icon, but the list has no "marker: icon"`);
        }
      }
    }
    const t = s.typography;
    if (!s.typographyRef) {
      if (!t?.fontFamily) throw new Error(`${fileName}:${lineNum}: slot "${s.id}" must have either "font:" or "typography:" (neither found)`);
      if (!t.fontSizeBase) throw new Error(`${fileName}:${lineNum}: slot "${s.id}" missing size`);
      if (!t.lineHeight) throw new Error(`${fileName}:${lineNum}: slot "${s.id}" missing lineHeight`);
    }
    inOverrideBlock = false;
    inListBlock = false;
    inMultiLineSamples = false;
    slots.push(s);
    currentSlot = null;
  }
  function finalizeExample() {
    currentExample = null;
    exampleMultiKey = null;
  }
  function closeBlocks(lineNum) {
    finalizeSlot(lineNum);
    finalizeExample();
  }
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const raw = lines[i];
    const text = raw.trim();
    const line = text.replace(/\s+#.*$/, "");
    if (line === "") continue;
    if (line.startsWith("#")) {
      const text2 = line.slice(1).trim();
      if (!firstHashText) firstHashText = text2;
      description = description ? `${description} ${text2}` : text2;
      continue;
    }
    if (line.startsWith("id:")) {
      id = line.slice(3).trim();
      continue;
    }
    if (line.startsWith("name:")) {
      name = line.slice(5).trim();
      continue;
    }
    if (line === "scope" && !raw.startsWith(" ")) {
      closeBlocks(lineNum);
      inScopeBlock = true;
      inContextBlock = false;
      inVoiceBlock = false;
      scope = scope ?? {};
      continue;
    }
    if (line === "context" && !raw.startsWith(" ")) {
      closeBlocks(lineNum);
      inContextBlock = true;
      inScopeBlock = false;
      inVoiceBlock = false;
      continue;
    }
    if (line === "voice" && !raw.startsWith(" ")) {
      closeBlocks(lineNum);
      inVoiceBlock = true;
      inScopeBlock = false;
      inContextBlock = false;
      voice = voice ?? {};
      continue;
    }
    if (line === "example" && !raw.startsWith(" ")) {
      closeBlocks(lineNum);
      inScopeBlock = inContextBlock = inVoiceBlock = false;
      currentExample = { texts: {}, line: lineNum, keyLines: {} };
      examples.push(currentExample);
      continue;
    }
    if (currentExample && raw.startsWith("  ")) {
      if (raw.startsWith("    ")) {
        if (!exampleMultiKey) throw new Error(`${fileName}:${lineNum}: unexpected "${line}" in example (multi-line text follows a bare "slot:" line)`);
        const prev = currentExample.texts[exampleMultiKey];
        currentExample.texts[exampleMultiKey] = prev ? `${prev}
${text}` : text;
        continue;
      }
      exampleMultiKey = null;
      const colonIdx = text.indexOf(":");
      if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: expected "key: value" in example, got "${text}"`);
      const key = text.slice(0, colonIdx).trim();
      const value = (key === "topic" || key === "goal" || key === "when" || key === "work" ? line : text).slice(colonIdx + 1).trim();
      if (key in currentExample.keyLines) throw new Error(`${fileName}:${lineNum}: duplicate "${key}" in example`);
      currentExample.keyLines[key] = lineNum;
      if (key === "topic" || key === "goal" || key === "when" || key === "work") {
        if (!value) throw new Error(`${fileName}:${lineNum}: empty ${key}`);
        if (key === "when" && !/^[a-z][a-z0-9-]*$/.test(value)) throw new Error(`${fileName}:${lineNum}: invalid when "${value}" (the name of one .time window or season, lowercase kebab-case)`);
        if (key === "work" && !/^[a-z][a-z0-9-]*$/.test(value)) throw new Error(`${fileName}:${lineNum}: invalid work "${value}" (the id of one .work, lowercase kebab-case)`);
        currentExample[key] = value;
        continue;
      }
      if (!VALID_SLOTS.has(key)) throw new Error(`${fileName}:${lineNum}: unknown example key "${key}" (expected topic, goal, when, work or a slot id)`);
      if (value) currentExample.texts[key] = value;
      else exampleMultiKey = key;
      continue;
    } else if (currentExample && !raw.startsWith(" ")) {
      finalizeExample();
    }
    if (inScopeBlock && raw.startsWith("  ") && !raw.startsWith("    ")) {
      if (line.startsWith("audience:")) {
        scope = scope ?? {};
        scope.audience = line.slice(9).trim().split(/[\s,]+/).filter((s) => s.length > 0);
      } else if (line.startsWith("pillars:")) {
        scope = scope ?? {};
        scope.pillars = line.slice(8).trim();
      }
      continue;
    } else if (inScopeBlock && !raw.startsWith(" ")) {
      inScopeBlock = false;
    }
    if (inVoiceBlock && raw.startsWith("  ") && !raw.startsWith("    ")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx !== -1) {
        voice = voice ?? {};
        voice[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
      }
      continue;
    } else if (inVoiceBlock && !raw.startsWith(" ")) {
      inVoiceBlock = false;
    }
    if (inContextBlock && raw.startsWith("  ")) {
      contextLines.push(text);
      continue;
    } else if (inContextBlock && !raw.startsWith(" ")) {
      inContextBlock = false;
    }
    if (line.startsWith("compositions:")) {
      const colonIdx = line.indexOf(":");
      const value = line.slice(colonIdx + 1).trim();
      compositions = value.split(/[\s,]+/).map((s) => s.trim()).filter((s) => s.length > 0);
      if (compositions.length === 0) throw new Error(`${fileName}:${lineNum}: empty compositions list`);
      continue;
    }
    if (line.startsWith("palette:")) {
      palette = line.slice(8).trim();
      continue;
    }
    if (line.startsWith("density:")) {
      const value = line.slice(8).trim();
      if (!["light", "medium", "full"].includes(value)) throw new Error(`${fileName}:${lineNum}: invalid density "${value}" \u2014 expected light, medium, or full`);
      density = value;
      continue;
    }
    if (line.startsWith("logo:")) {
      defaultLogo = line.slice(5).trim();
      continue;
    }
    if (line.startsWith("photo:")) {
      photos = line.slice(6).split(",").map((id2) => id2.trim()).filter(Boolean);
      continue;
    }
    if (line.startsWith("video:")) {
      defaultVideo = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("illustration:")) {
      illustrations = line.slice(13).split(",").map((id2) => id2.trim()).filter(Boolean);
      continue;
    }
    if (line.startsWith("scrim:")) {
      const value = line.slice(6).trim();
      if (value !== "none") throw new Error(`${fileName}:${lineNum}: invalid scrim "${value}" (expected none; how dark is the brand's photo-look scrim)`);
      scrim = "none";
      continue;
    }
    if (line.startsWith("camera:")) {
      const value = line.slice(7).trim();
      camera = value !== "false";
      if (value === "front" || value === "rear") cameraFacing = value;
      continue;
    }
    if (line.startsWith("framing:")) {
      framing = line.slice(8).trim() || void 0;
      continue;
    }
    if (line.startsWith("goal:") && !raw.startsWith(" ")) {
      goal = line.slice(5).trim() || void 0;
      continue;
    }
    const subject = /^(person|group|work):\s*(.*)$/.exec(line);
    if (subject && !raw.startsWith(" ")) {
      const [, key, value] = subject;
      if (value.trim() !== "required") throw new Error(`${fileName}:${lineNum}: invalid ${key} "${value.trim()}" (expected required: every page names a .${key})`);
      if (key === "person") person = "required";
      else if (key === "group") group = "required";
      else work = "required";
      continue;
    }
    if (line.startsWith("analyze:")) {
      analyze = line.slice(8).trim() !== "false";
      continue;
    }
    if (line.startsWith("bg-prompt:")) {
      bgPrompt = text.slice(10).trim().replace(/^["']|["']$/g, "");
      continue;
    }
    if (line.startsWith("defaultIcon:") && !raw.startsWith(" ")) {
      defaultIcon = parseIconRef(line.slice(12), `${fileName}:${lineNum}`);
      continue;
    }
    if (line.startsWith("icon:") && !raw.startsWith(" ")) {
      warnings.push(`${fileName}:${lineNum}: deprecated "icon:" \u2014 use "defaultIcon:" instead`);
      defaultIcon = parseIconRef(line.slice(5), `${fileName}:${lineNum}`);
      continue;
    }
    if (line.startsWith("slot ")) {
      closeBlocks(lineNum);
      const slotId = line.slice(5).trim();
      if (!VALID_SLOTS.has(slotId)) throw new Error(`${fileName}:${lineNum}: unknown slot "${slotId}"`);
      currentSlot = { id: slotId, samples: [], typography: {} };
      continue;
    }
    if (inMultiLineSamples && currentSlot) {
      const baseIndent = inMultiLineSamples === "list" ? 6 : 4;
      const contIndent = baseIndent + 2;
      const isVariantLine = raw.length >= baseIndent && raw.slice(0, baseIndent) === " ".repeat(baseIndent) && raw[baseIndent] === "-" && raw[baseIndent + 1] === " ";
      const isContLine = raw.length > contIndent && raw.slice(0, contIndent) === " ".repeat(contIndent) && raw[contIndent] !== "-";
      if (isVariantLine) {
        const text2 = raw.slice(baseIndent + 2).trim();
        if (!text2) throw new Error(`${fileName}:${lineNum}: empty sample variant`);
        currentSlot.samples.push(text2);
        continue;
      }
      if (isContLine && currentSlot.samples.length > 0) {
        const text2 = raw.slice(contIndent).trim();
        if (!text2) throw new Error(`${fileName}:${lineNum}: empty sample continuation line`);
        currentSlot.samples[currentSlot.samples.length - 1] += "\n" + text2;
        continue;
      }
      inMultiLineSamples = false;
    }
    if (raw.startsWith("    ") && currentSlot && (inOverrideBlock || inListBlock)) {
      const prop = line;
      if (inOverrideBlock) {
        if (!currentSlot.typographyRef) throw new Error(`${fileName}:${lineNum}: "override:" block requires "typography:" on the slot`);
        if (!currentSlot.typographyOverrides) currentSlot.typographyOverrides = {};
        if (prop.startsWith("weight:")) {
          const n = parseInt(prop.slice(7).trim(), 10);
          if (isNaN(n) || n < 1 || n > 999) throw new Error(`${fileName}:${lineNum}: invalid weight "${prop.slice(7).trim()}"`);
          currentSlot.typographyOverrides.weight = n;
          continue;
        }
        if (prop.startsWith("size:")) {
          const n = parseFloat(prop.slice(5).trim());
          if (isNaN(n) || n <= 0) throw new Error(`${fileName}:${lineNum}: invalid size "${prop.slice(5).trim()}"`);
          currentSlot.typographyOverrides.size = n;
          continue;
        }
        if (prop.startsWith("lineHeight:")) {
          const n = parseFloat(prop.slice(11).trim());
          if (isNaN(n) || n <= 0) throw new Error(`${fileName}:${lineNum}: invalid lineHeight "${prop.slice(11).trim()}"`);
          currentSlot.typographyOverrides.lineHeight = n;
          continue;
        }
        if (prop.startsWith("letterSpacing:")) {
          const n = parseFloat(prop.slice(14).trim());
          if (isNaN(n)) throw new Error(`${fileName}:${lineNum}: invalid letterSpacing "${prop.slice(14).trim()}"`);
          currentSlot.typographyOverrides.letterSpacing = n;
          continue;
        }
        if (prop.startsWith("opsz:")) {
          const n = parseFloat(prop.slice(5).trim());
          if (isNaN(n)) throw new Error(`${fileName}:${lineNum}: invalid opsz "${prop.slice(5).trim()}"`);
          currentSlot.typographyOverrides.opsz = n;
          continue;
        }
        if (prop === "italic" || prop === "italic: true") {
          currentSlot.typographyOverrides.italic = true;
          continue;
        }
        if (prop === "italic: false") {
          currentSlot.typographyOverrides.italic = false;
          continue;
        }
        if (prop === "uppercase" || prop === "uppercase: true") {
          currentSlot.typographyOverrides.uppercase = true;
          continue;
        }
        if (prop === "uppercase: false") {
          currentSlot.typographyOverrides.uppercase = false;
          continue;
        }
        if (prop === "hyphenate" || prop === "hyphenate: true") {
          currentSlot.typographyOverrides.hyphenate = true;
          continue;
        }
        if (prop === "hyphenate: false") {
          currentSlot.typographyOverrides.hyphenate = false;
          continue;
        }
        if (prop === "hyphenate: fit") {
          currentSlot.typographyOverrides.hyphenate = "fit";
          continue;
        }
        if (prop === "autofit: none" || prop === "autofit:none") {
          currentSlot.typographyOverrides.autofitMin = -1;
          currentSlot.typographyOverrides.autofitMax = -1;
          continue;
        }
        if (prop.startsWith("autofit-min:")) {
          const n = parseFloat(prop.slice(12).trim());
          if (isNaN(n)) throw new Error(`${fileName}:${lineNum}: invalid autofit-min "${prop.slice(12).trim()}"`);
          currentSlot.typographyOverrides.autofitMin = n;
          continue;
        }
        if (prop.startsWith("autofit-max:")) {
          const n = parseFloat(prop.slice(12).trim());
          if (isNaN(n)) throw new Error(`${fileName}:${lineNum}: invalid autofit-max "${prop.slice(12).trim()}"`);
          currentSlot.typographyOverrides.autofitMax = n;
          continue;
        }
        if (prop.startsWith("textAlign:")) {
          const v = prop.slice(10).trim();
          if (v !== "left" && v !== "center" && v !== "right" && v !== "justify") {
            throw new Error(`${fileName}:${lineNum}: invalid textAlign "${v}" \u2014 expected left, center, right, or justify`);
          }
          currentSlot.typographyOverrides.textAlign = v;
          continue;
        }
        throw new Error(`${fileName}:${lineNum}: unknown override property "${prop}"`);
      }
      if (inListBlock) {
        if (prop.startsWith("maxItems:")) {
          const n = parseInt(prop.slice(9).trim(), 10);
          if (isNaN(n) || n <= 0) throw new Error(`${fileName}:${lineNum}: invalid maxItems "${prop.slice(9).trim()}"`);
          currentSlot.maxItems = n;
          continue;
        }
        if (prop.startsWith("maxLength:")) {
          const n = parseInt(prop.slice(10).trim(), 10);
          if (isNaN(n) || n <= 0) throw new Error(`${fileName}:${lineNum}: invalid maxLength "${prop.slice(10).trim()}"`);
          currentSlot.maxLength = n;
          continue;
        }
        if (prop.startsWith("samples:")) {
          legacySamplesLine ||= lineNum;
          const raw2 = prop.slice(8).trim();
          if (!raw2) {
            currentSlot.samples = [];
            inMultiLineSamples = "list";
            continue;
          }
          currentSlot.samples = raw2.split("|").map((s) => s.trim().replace(/\\n/g, "\n"));
          continue;
        }
        if (prop.startsWith("marker:")) {
          const m = prop.slice(7).trim();
          if (m !== "none" && m !== "counter" && m !== "icon") throw new Error(`${fileName}:${lineNum}: invalid marker "${m}" \u2014 must be "none", "counter" or "icon"`);
          currentSlot.marker = m;
          continue;
        }
        if (prop.startsWith("defaultIcon:")) {
          currentSlot.defaultIcon = parseIconRef(prop.slice(12), `${fileName}:${lineNum}`);
          continue;
        }
        if (prop === "icons: true" || prop === "icons:true") {
          warnings.push(`${fileName}:${lineNum}: deprecated "icons: true" \u2014 use "marker: counter" or "marker: icon"`);
          currentSlot.marker = currentSlot.marker ?? "counter";
          continue;
        }
        if (prop === "icons: false" || prop === "icons:false") {
          warnings.push(`${fileName}:${lineNum}: deprecated "icons: false" \u2014 use "marker: none"`);
          currentSlot.marker = currentSlot.marker ?? "none";
          continue;
        }
        if (prop === "iconOnly: true" || prop === "iconOnly:true") {
          currentSlot.iconOnly = true;
          continue;
        }
        if (prop.startsWith("iconGap:")) {
          const n = parseFloat(prop.slice(8).trim());
          if (isNaN(n) || n < 0) throw new Error(`${fileName}:${lineNum}: invalid iconGap "${prop.slice(8).trim()}"`);
          currentSlot.iconGap = n;
          continue;
        }
        if (prop.startsWith("itemGap:")) {
          const n = parseFloat(prop.slice(8).trim());
          if (isNaN(n) || n < 0) throw new Error(`${fileName}:${lineNum}: invalid itemGap "${prop.slice(8).trim()}"`);
          currentSlot.itemGap = n;
          continue;
        }
        if (prop.startsWith("direction:")) {
          const d = prop.slice(10).trim();
          if (d !== "vertical" && d !== "horizontal") throw new Error(`${fileName}:${lineNum}: invalid list direction "${d}" \u2014 must be "vertical" or "horizontal"`);
          currentSlot.listDirection = d;
          continue;
        }
        if (prop.startsWith("columns:")) {
          const n = Number(prop.slice(8).trim());
          if (!Number.isInteger(n) || n < 1 || n > 6) throw new Error(`${fileName}:${lineNum}: invalid columns "${prop.slice(8).trim()}" \u2014 must be 1 to 6`);
          currentSlot.listColumns = n;
          continue;
        }
        if (prop.startsWith("labels:")) {
          const l = prop.slice(7).trim();
          if (l !== "none" && l !== "above") throw new Error(`${fileName}:${lineNum}: invalid labels "${l}" \u2014 must be "none" or "above"`);
          currentSlot.listLabels = l;
          continue;
        }
        if (prop.startsWith("labelSize:")) {
          const n = parseFloat(prop.slice(10).trim());
          if (isNaN(n) || n <= 0 || n > 1) throw new Error(`${fileName}:${lineNum}: invalid labelSize "${prop.slice(10).trim()}" \u2014 must be above 0 and at most 1`);
          currentSlot.labelSize = n;
          continue;
        }
        if (prop.startsWith("divider:")) {
          const d = prop.slice(8).trim();
          if (d !== "none" && d !== "hairline") throw new Error(`${fileName}:${lineNum}: invalid list divider "${d}" \u2014 must be "none" or "hairline"`);
          currentSlot.listDivider = d;
          continue;
        }
        throw new Error(`${fileName}:${lineNum}: unknown list property "${prop}"`);
      }
    }
    if (raw.startsWith("  ") && currentSlot) {
      const prop = line;
      if (prop === "override:") {
        if (!currentSlot.typographyRef) throw new Error(`${fileName}:${lineNum}: "override:" block requires "typography:" on the slot`);
        inOverrideBlock = true;
        inListBlock = false;
        continue;
      }
      if (prop.startsWith("type:")) {
        const t = prop.slice(5).trim();
        if (t !== "text" && t !== "list") throw new Error(`${fileName}:${lineNum}: invalid slot type "${t}" \u2014 must be "text" or "list"`);
        currentSlot.slotType = t;
        inListBlock = t === "list";
        inOverrideBlock = false;
        continue;
      }
      inOverrideBlock = false;
      inListBlock = false;
      inMultiLineSamples = false;
      if (prop.startsWith("label:")) {
        currentSlot.label = prop.slice(6).trim();
        continue;
      }
      if (prop.startsWith("value:")) {
        const val = prop.slice(6).trim();
        if (!val) throw new Error(`${fileName}:${lineNum}: empty value`);
        currentSlot.value = val;
        currentSlot.samples = [val];
        continue;
      }
      if (prop.startsWith("samples:")) {
        legacySamplesLine ||= lineNum;
        const raw2 = prop.slice(8).trim();
        if (!raw2) {
          currentSlot.samples = [];
          inMultiLineSamples = "slot";
          continue;
        }
        currentSlot.samples = raw2.split("|").map((s) => s.trim().replace(/\\n/g, "\n"));
        continue;
      }
      if (prop.startsWith("maxLength:")) {
        const n = parseInt(prop.slice(10).trim(), 10);
        if (isNaN(n) || n <= 0) throw new Error(`${fileName}:${lineNum}: invalid maxLength "${prop.slice(10).trim()}"`);
        currentSlot.maxLength = n;
        continue;
      }
      if (prop.startsWith("words:") || prop.startsWith("sentences:")) {
        const key = prop.startsWith("words:") ? "words" : "sentences";
        const v = prop.slice(key.length + 1).trim();
        const m = v.match(/^(\d+)(?:\.\.(\d+))?$/);
        const range = m ? { min: parseInt(m[1], 10), max: parseInt(m[2] ?? m[1], 10) } : null;
        if (!range || range.min <= 0 || range.max < range.min) throw new Error(`${fileName}:${lineNum}: invalid ${key} "${v}" \u2014 expected N or MIN..MAX`);
        currentSlot[key] = range;
        continue;
      }
      if (prop.startsWith("typography:")) {
        currentSlot.typographyRef = prop.slice(11).trim();
        continue;
      }
      if (prop.startsWith("color:")) {
        currentSlot.colorRef = prop.slice(6).trim();
        continue;
      }
      if (prop === "editable" || prop === "editable: true" || prop === "editable:true") {
        currentSlot.editable = true;
        continue;
      }
      if (prop === "editable: false" || prop === "editable:false") {
        currentSlot.editable = false;
        continue;
      }
      if (prop.startsWith("font:")) {
        const value = prop.slice(5).trim();
        const lastSpace = value.lastIndexOf(" ");
        if (lastSpace === -1) throw new Error(`${fileName}:${lineNum}: font must be "FAMILY WEIGHT" (e.g. "Die Grotesk 800")`);
        const familyName = value.slice(0, lastSpace);
        const weight = parseInt(value.slice(lastSpace + 1), 10);
        if (isNaN(weight) || weight < 1 || weight > 999) throw new Error(`${fileName}:${lineNum}: invalid font weight "${value.slice(lastSpace + 1)}"`);
        currentSlot.typography.fontFamily = resolveFontFamily(familyName);
        currentSlot.typography.fontWeight = weight;
        continue;
      }
      if (prop.startsWith("size:")) {
        const n = parseFloat(prop.slice(5).trim());
        if (isNaN(n) || n <= 0) throw new Error(`${fileName}:${lineNum}: invalid size "${prop.slice(5).trim()}"`);
        currentSlot.typography.fontSizeBase = n;
        continue;
      }
      if (prop.startsWith("align:")) {
        continue;
      }
      if (prop.startsWith("lineHeight:")) {
        const n = parseFloat(prop.slice(11).trim());
        if (isNaN(n) || n <= 0) throw new Error(`${fileName}:${lineNum}: invalid lineHeight "${prop.slice(11).trim()}"`);
        currentSlot.typography.lineHeight = n;
        continue;
      }
      if (prop.startsWith("letterSpacing:")) {
        const n = parseFloat(prop.slice(14).trim());
        if (isNaN(n)) throw new Error(`${fileName}:${lineNum}: invalid letterSpacing "${prop.slice(14).trim()}"`);
        currentSlot.typography.letterSpacing = n;
        continue;
      }
      if (prop.startsWith("opsz:")) {
        const n = parseFloat(prop.slice(5).trim());
        if (isNaN(n)) throw new Error(`${fileName}:${lineNum}: invalid opsz "${prop.slice(5).trim()}"`);
        currentSlot.typography.opticalSize = n;
        continue;
      }
      throw new Error(`${fileName}:${lineNum}: unknown slot property "${prop}"`);
    }
    throw new Error(`${fileName}:${lineNum}: unexpected "${line}"`);
  }
  closeBlocks(lines.length);
  if (!id) {
    if (firstHashText) {
      warnings.push(`${fileName}: deprecated \u2014 add "id: ${firstHashText}" line (first # line used as fallback id)`);
      id = firstHashText;
    } else {
      throw new Error(`${fileName}: missing purpose id (add "id:" line)`);
    }
  }
  if (!compositions) throw new Error(`${fileName}: missing "compositions:" line`);
  if (slots.length === 0) throw new Error(`${fileName}: no slots defined`);
  if (!name) {
    name = id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
  if (contextLines.length > 0 && !context) {
    context = contextLines.join("\n").trim();
  }
  const parsedExamples = resolveExamples(examples, slots, legacySamplesLine, fileName, warnings);
  return { id, name, description, preferredCompositions: compositions, slots, density, palette, scope, context, voice, defaultLogo, photos, defaultVideo, illustrations, camera, cameraFacing, ...scrim ? { scrim } : {}, framing, goal, ...person ? { person } : {}, ...group ? { group } : {}, ...work ? { work } : {}, analyze, defaultIcon, bgPrompt, examples: parsedExamples, warnings };
}
function resolveExamples(examples, slots, legacySamplesLine, fileName, warnings) {
  const byId = new Map(slots.map((s) => [s.id, s]));
  const contentSlots = slots.filter((s) => !s.value && !s.iconOnly && s.id !== "credit");
  if (examples.length > 0) {
    if (legacySamplesLine) throw new Error(`${fileName}:${legacySamplesLine}: slot "samples:" next to "example" blocks \u2014 move the texts into the examples`);
    for (const ex of examples) {
      const at = (key) => `${fileName}:${ex.keyLines[key] ?? ex.line}`;
      const filled = Object.keys(ex.texts);
      if (filled.length === 0) throw new Error(`${fileName}:${ex.line}: example without slot texts`);
      for (const slotId of filled) {
        const slot = byId.get(slotId);
        if (!slot) throw new Error(`${at(slotId)}: example fills slot "${slotId}", which the purpose does not declare`);
        if (slot.value) throw new Error(`${at(slotId)}: slot "${slotId}" has a fixed value and takes no example text`);
        const text = ex.texts[slotId];
        if (text.split("\n").some((l) => SAMPLE_WINDOW_MARKER.test(l))) throw new Error(`${at(slotId)}: window marker in example text \u2014 use "when:" on the example`);
        if (slot.slotType === "list") {
          text.split("\n").forEach((item, i) => {
            const { icon } = parseListItem(item);
            if (icon && slot.marker !== "icon") throw new Error(`${at(slotId)}: slot "${slotId}": item "${item}" names an icon, but the list has no "marker: icon"`);
            const continues = i > 0 && !(slot.listColumns && slot.listColumns > 1);
            if (slot.listLabels === "above" && !continues && !splitLabelledItem(item).label) throw new Error(`${at(slotId)}: slot "${slotId}": item "${item}" needs a label ("Label: value") for "labels: above"`);
          });
        }
      }
    }
    for (const slot of contentSlots) {
      if (!examples.some((ex) => ex.texts[slot.id])) throw new Error(`${fileName}: slot "${slot.id}" is filled by no example`);
    }
    return examples.map(({ line: _line, keyLines: _keyLines, ...ex }) => ex);
  }
  for (const slot of contentSlots) {
    if (slot.samples.length === 0) throw new Error(`${fileName}: slot "${slot.id}" has no text \u2014 add "example" blocks or a "value:"`);
  }
  if (!legacySamplesLine) return [];
  warnings.push(`${fileName}:${legacySamplesLine}: deprecated slot "samples:" \u2014 write whole pages as "example" blocks`);
  const sampled = slots.filter((s) => !s.value && s.samples.length > 0);
  const count = Math.max(...sampled.map((s) => s.samples.length));
  return Array.from({ length: count }, (_, i) => {
    const texts = {};
    let when;
    for (const slot of sampled) {
      const idx = i % slot.samples.length;
      texts[slot.id] = slot.samples[idx];
      when ??= slot.sampleWindows?.[idx];
    }
    return { texts, ...when ? { when } : {}, legacy: true };
  });
}
function checkPurpose(purpose, facts, fileName) {
  const problems = [];
  const names = facts.time ? timeEntryNames(facts.time) : [];
  purpose.examples.forEach((ex, i) => {
    if (facts.time !== void 0 && ex.when && !names.includes(ex.when)) problems.push(`${fileName}: example ${i + 1}: when "${ex.when}" is not in the .time${facts.time ? "" : " (the brand has no .time)"}`);
    if (facts.works && ex.work && !facts.works.some((w) => w.id === ex.work)) problems.push(`${fileName}: example ${i + 1}: work "${ex.work}" does not exist`);
  });
  return problems;
}

// parser/compositionParser.ts
var ILLUSTRATION_ANCHORS = /* @__PURE__ */ new Set([
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right"
]);
var GRID_Y_KEYWORDS = /* @__PURE__ */ new Set(["top", "center", "bottom"]);
var VALID_SLOTS2 = new Set(SLOT_IDS);
function parseCol(value, fileName, lineNum, maxCol = 12) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 1 || n > maxCol) {
    throw new Error(`${fileName}:${lineNum}: invalid column "${value}" (expected 1--${maxCol})`);
  }
  return n - 1;
}
function parseColRange(range, fileName, lineNum, maxCol = 12) {
  const parts = range.split("--");
  if (parts.length !== 2) {
    throw new Error(`${fileName}:${lineNum}: invalid column range "${range}" (expected "A--B")`);
  }
  const start = parseCol(parts[0].trim(), fileName, lineNum, maxCol);
  const end = parseCol(parts[1].trim(), fileName, lineNum, maxCol);
  return { start, end };
}
function resolveColKeyword(raw, fileName, lineNum) {
  if (raw === "left" || raw === "center" || raw === "right") return raw;
  throw new Error(`${fileName}:${lineNum}: invalid col keyword "${raw}" (expected left, center, or right)`);
}
function parseCompositionFile(content, fileName) {
  const lines = content.split("\n");
  let id = "";
  let name = "";
  let description = "";
  let mode = null;
  let image = null;
  let imageExplicit = false;
  let logo = null;
  let logoNone = false;
  let icon = void 0;
  const slots = [];
  const sticky = [];
  let flow = null;
  let illustration = void 0;
  function parseFraction(s, ctx) {
    const parts = s.split("/");
    if (parts.length !== 2) throw new Error(`${ctx}: invalid fraction "${s}" (expected "N/M")`);
    const num = parseInt(parts[0], 10);
    const den = parseInt(parts[1], 10);
    if (isNaN(num) || isNaN(den) || den === 0) throw new Error(`${ctx}: invalid fraction "${s}"`);
    return num / den;
  }
  let firstHashText = "";
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const raw = lines[i];
    const fullLine = raw.trim();
    if (fullLine === "") continue;
    if (fullLine.startsWith("#")) {
      const text = fullLine.slice(1).trim();
      if (!firstHashText) firstHashText = text;
      description = description ? `${description} ${text}` : text;
      continue;
    }
    const line = fullLine.replace(/\s+#.*$/, "");
    if (line.startsWith("id:")) {
      id = line.slice(3).trim();
      continue;
    }
    if (line.startsWith("name:")) {
      name = line.slice(5).trim();
      continue;
    }
    if (line.startsWith("mode:")) {
      const raw2 = line.slice(5).trim();
      const value = raw2 === "compose" ? "grid" : raw2;
      if (value !== "flow" && value !== "grid") {
        throw new Error(`${fileName}:${lineNum}: invalid mode "${value}" (expected "flow" or "grid")`);
      }
      mode = value;
      continue;
    }
    if (line.startsWith("image:")) {
      const value = line.slice(6).trim();
      imageExplicit = true;
      if (value === "none") {
        image = "none";
        continue;
      }
      if (value === "full") {
        image = "full";
      } else {
        const match = value.match(/^(\w+)--(\w+)(?:\s+cols\s+(\S+))?$/);
        if (!match) throw new Error(`${fileName}:${lineNum}: invalid image region "${value}" (expected "full" or "keyword--keyword [cols N--M]")`);
        const [, yStartStr, yEndStr, colRangeStr] = match;
        if (!GRID_Y_KEYWORDS.has(yStartStr)) throw new Error(`${fileName}:${lineNum}: unknown grid keyword "${yStartStr}" (expected top, center, bottom)`);
        if (!GRID_Y_KEYWORDS.has(yEndStr)) throw new Error(`${fileName}:${lineNum}: unknown grid keyword "${yEndStr}" (expected top, center, bottom)`);
        const parsed = { yStart: yStartStr, yEnd: yEndStr };
        if (colRangeStr) {
          const cols = parseColRange(colRangeStr, fileName, lineNum);
          if (typeof cols.start !== "number") throw new Error(`${fileName}:${lineNum}: image cols cannot use dynamic expressions`);
          parsed.colStart = cols.start;
          parsed.colEnd = cols.end;
        }
        image = parsed;
      }
      continue;
    }
    if (line.startsWith("illustration:")) {
      const parts = line.slice(13).trim().split(/\s+/);
      if (parts.length < 3) throw new Error(`${fileName}:${lineNum}: invalid illustration line \u2014 expected "illustration: <anchor> <fit-width|fit-height> <N%>"`);
      const anchor = parts[0];
      if (!ILLUSTRATION_ANCHORS.has(anchor)) throw new Error(`${fileName}:${lineNum}: invalid illustration anchor "${anchor}" (expected ${[...ILLUSTRATION_ANCHORS].join(", ")})`);
      const fitStr = parts[1];
      if (fitStr !== "fit-width" && fitStr !== "fit-height") throw new Error(`${fileName}:${lineNum}: invalid illustration fit "${fitStr}" (expected fit-width or fit-height)`);
      const scaleStr = parts[2];
      const scaleMatch = scaleStr.match(/^(\d+(?:\.\d+)?)%$/);
      if (!scaleMatch) throw new Error(`${fileName}:${lineNum}: invalid illustration scale "${scaleStr}" (expected e.g. "90%")`);
      const scale = parseFloat(scaleMatch[1]) / 100;
      if (scale <= 0 || scale > 2) throw new Error(`${fileName}:${lineNum}: illustration scale out of range (expected 1%\u2013200%)`);
      const illu = { anchor, fit: fitStr === "fit-width" ? "width" : "height", scale };
      if (parts.length >= 5 && parts[3] === "offset") {
        const ox = parseFloat(parts[4]);
        const oy = parts.length >= 6 ? parseFloat(parts[5]) : 0;
        if (!isNaN(ox) && !isNaN(oy)) illu.offset = [ox, oy];
      }
      illustration = illu;
      continue;
    }
    if (line.startsWith("grid:")) {
      console.warn(`${fileName}:${lineNum}: "grid:" in layout files is no longer needed \u2014 format defines the grid`);
      continue;
    }
    if (line.startsWith("logo:")) {
      const logoValue = line.slice(5).trim();
      if (logoValue === "none") {
        logo = null;
        logoNone = true;
        continue;
      }
      const kwMatch = line.match(/^logo:\s+(top|center|bottom)\s+(?:col\s+)?(left|center|right)(?:\s+(s|m|l))?\s*$/);
      if (kwMatch) {
        const col = resolveColKeyword(kwMatch[2], fileName, lineNum);
        logo = { row: kwMatch[1], col, size: kwMatch[3] ?? void 0 };
        continue;
      }
      const rowMatch = line.match(/^logo:\s+row\s+(\d+)\s+(?:col\s+)?(left|center|right)(?:\s+(s|m|l))?\s*$/);
      if (rowMatch) {
        const col = resolveColKeyword(rowMatch[2], fileName, lineNum);
        logo = { row: parseInt(rowMatch[1], 10) - 1, col, size: rowMatch[3] ?? void 0 };
        continue;
      }
      throw new Error(`${fileName}:${lineNum}: invalid logo line "${line}" (expected "logo: row N left|center|right" or "logo: top/center/bottom left|center|right")`);
    }
    if (line.startsWith("icon:")) {
      const kwMatch = line.match(/^icon:\s+(top|center|bottom)\s+(?:col\s+)?(left|center|right)(?:\s+(s|m|l))?\s*$/);
      if (kwMatch) {
        const col = resolveColKeyword(kwMatch[2], fileName, lineNum);
        icon = { row: kwMatch[1], col, size: kwMatch[3] ?? void 0 };
        continue;
      }
      const rowMatch = line.match(/^icon:\s+row\s+(\d+)\s+(?:col\s+)?(left|center|right)(?:\s+(s|m|l))?\s*$/);
      if (rowMatch) {
        const col = resolveColKeyword(rowMatch[2], fileName, lineNum);
        icon = { row: parseInt(rowMatch[1], 10) - 1, col, size: rowMatch[3] ?? void 0 };
        continue;
      }
      throw new Error(`${fileName}:${lineNum}: invalid icon line "${line}"`);
    }
    if (line.startsWith("sticky:")) {
      const stickyParts = line.slice(7).trim().split(/\s+/);
      const position = stickyParts[0];
      if (!["top", "bottom", "left", "right"].includes(position)) {
        throw new Error(`${fileName}:${lineNum}: invalid sticky position "${position}" (expected top, bottom, left, right)`);
      }
      const stickySize = stickyParts[1] ?? "m";
      if (!["s", "m", "l"].includes(stickySize)) {
        throw new Error(`${fileName}:${lineNum}: invalid sticky size "${stickyParts[1]}" (expected s, m, l)`);
      }
      const stickyItems = [];
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine === "") {
          i++;
          continue;
        }
        if (!nextLine.startsWith("|")) break;
        i++;
        const itemStr = nextLine.slice(1).trim();
        const parts = itemStr.split(/\s+/);
        const VALIGNS = ["top", "center", "bottom"];
        const parseVAlign = (p) => VALIGNS.includes(p ?? "") ? p : void 0;
        if (parts[0] === "logo") {
          const vAlign = parseVAlign(parts[2]);
          const sizeIdx = vAlign ? 3 : 2;
          stickyItems.push({
            type: "logo",
            align: parts[1] ?? "left",
            verticalAlign: vAlign,
            size: parts[sizeIdx]
          });
        } else if (parts[0] === "icon") {
          stickyItems.push({
            type: "icon",
            align: parts[1] ?? "left",
            verticalAlign: parseVAlign(parts[2])
          });
        } else if (VALID_SLOTS2.has(parts[0])) {
          stickyItems.push({
            type: "slot",
            id: parts[0],
            align: parts[1] ?? "left",
            verticalAlign: parseVAlign(parts[2])
          });
        } else {
          throw new Error(`${fileName}:${i + 1}: unknown sticky item "${parts[0]}"`);
        }
      }
      sticky.push({ position, size: stickySize, items: stickyItems });
      continue;
    }
    if (line.startsWith("flow:")) {
      const value = line.slice(5).trim();
      let panel = void 0;
      let direction = "vertical";
      let columns;
      let columnGap;
      let split = void 0;
      if (value.startsWith("panel")) {
        const all = value.split(/\s+/);
        const inset = all.includes("inset");
        const parts = all.filter((p) => p !== "inset");
        const pos = parts[1] ?? "bottom-left";
        const wFrac = parts[2] ? parseFraction(parts[2], `${fileName}:${lineNum}`) : 2 / 3;
        const hFrac = parts[3] ? parseFraction(parts[3], `${fileName}:${lineNum}`) : wFrac;
        if (parts.length > 4) throw new Error(`${fileName}:${lineNum}: unexpected "${parts.slice(4).join(" ")}" in panel (expected: panel <position> [<width>] [<height>] [inset])`);
        panel = { position: pos, widthFraction: wFrac, heightFraction: hFrac, ...inset ? { inset: true } : {} };
      } else if (value.startsWith("split")) {
        const parts = value.split(/\s+/);
        const edge = parts[1];
        if (!["top", "bottom", "left", "right"].includes(edge)) {
          throw new Error(`${fileName}:${lineNum}: invalid split edge "${edge}" \u2014 expected top, bottom, left, right`);
        }
        const fraction = parts[2] ? parseFraction(parts[2], `${fileName}:${lineNum}`) : 0.5;
        split = { edge, fraction };
      }
      const flowItems = [];
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine === "") {
          i++;
          continue;
        }
        if (nextLine.startsWith("direction:")) {
          i++;
          const dir = nextLine.slice(10).trim();
          if (dir === "horizontal") direction = "horizontal";
          else if (dir === "vertical") direction = "vertical";
          else throw new Error(`${fileName}:${i + 1}: invalid direction "${dir}" (expected vertical, horizontal)`);
          continue;
        }
        if (nextLine.startsWith("columns:")) {
          i++;
          const n = parseInt(nextLine.slice(8).trim(), 10);
          if (isNaN(n) || n < 1 || n > 6) throw new Error(`${fileName}:${i + 1}: invalid columns "${nextLine.slice(8).trim()}" (expected 1\u20136)`);
          columns = n;
          continue;
        }
        if (nextLine.startsWith("column-gap:")) {
          i++;
          columnGap = nextLine.slice(11).trim();
          continue;
        }
        if (!nextLine.startsWith("|")) break;
        i++;
        const itemStr = nextLine.slice(1).trim();
        if (itemStr === "photo" || itemStr.startsWith("photo ")) {
          const photoParts = itemStr.split(/\s+/);
          const align = photoParts[1] ?? "center";
          const size = photoParts[2] ?? "m";
          if (!["left", "center", "right"].includes(align)) throw new Error(`${fileName}:${i + 1}: invalid photo align "${align}" (expected left, center, right)`);
          if (!["s", "m", "l"].includes(size)) throw new Error(`${fileName}:${i + 1}: invalid photo size "${size}" (expected s, m, l)`);
          if (photoParts.length > 3) throw new Error(`${fileName}:${i + 1}: unexpected "${photoParts.slice(3).join(" ")}" after photo (expected: photo ALIGN [SIZE])`);
          if (flowItems.some((it) => it.type === "photo")) throw new Error(`${fileName}:${i + 1}: a flow has one photo at most`);
          flowItems.push({ type: "photo", align, size });
        } else if (itemStr.startsWith("icon")) {
          const iconParts = itemStr.split(/\s+/);
          const align = iconParts[1] ?? "center";
          const size = iconParts[2] ?? "m";
          flowItems.push({ type: "icon", align, size });
        } else if (itemStr.startsWith("spacer-")) {
          const size = itemStr.slice(7);
          flowItems.push({ type: "spacer", size });
        } else if (itemStr.startsWith("divider-")) {
          const variant = itemStr.slice(8);
          flowItems.push({ type: "divider", variant });
        } else {
          const parts = itemStr.split(/\s+/);
          const slotId = parts[0];
          if (!VALID_SLOTS2.has(slotId)) throw new Error(`${fileName}:${i + 1}: unknown slot "${slotId}" in flow block`);
          const align = parts[1] ?? "left";
          const VALIGNS = ["top", "center", "bottom"];
          let vAlign;
          let slotCols;
          let slotGap;
          for (let p = 2; p < parts.length; p++) {
            if (VALIGNS.includes(parts[p])) {
              vAlign = parts[p];
            } else if (parts[p].startsWith("columns:")) {
              slotCols = parseInt(parts[p].slice(8), 10);
              if (isNaN(slotCols) || slotCols < 1 || slotCols > 6) throw new Error(`${fileName}:${i + 1}: invalid columns "${parts[p].slice(8)}"`);
            } else if (parts[p].startsWith("gap:")) {
              slotGap = parts[p].slice(4);
            }
          }
          flowItems.push({ type: "slot", id: slotId, textAlign: align, verticalAlign: vAlign, columns: slotCols, columnGap: slotGap });
        }
      }
      flow = { panel, split, direction, columns, columnGap, items: flowItems };
      continue;
    }
    if (line.startsWith("group:")) {
      throw new Error(`${fileName}:${lineNum}: "group:" syntax is removed \u2014 use "flow:" with "split" instead`);
    }
    const rowSlotMatch = line.match(/^(\w+)\s+(?:row\s+)?(\d+|top|center|bottom)\s+cols\s+(\S+)\s+(left|center|right)(?:\s+(top|center|bottom))?$/);
    if (rowSlotMatch) {
      const [, slotId, rowStr, colRange, hAlign, vAlign] = rowSlotMatch;
      if (!VALID_SLOTS2.has(slotId)) throw new Error(`${fileName}:${lineNum}: unknown slot "${slotId}"`);
      const rowNum = rowStr === "top" ? -1 : rowStr === "center" ? -2 : rowStr === "bottom" ? -3 : parseInt(rowStr, 10) - 1;
      const cols = parseColRange(colRange, fileName, lineNum, 12);
      slots.push({
        id: slotId,
        row: rowNum,
        colStart: cols.start,
        colEnd: cols.end,
        textAlign: hAlign,
        ...vAlign ? { verticalAlign: vAlign } : {}
      });
      continue;
    }
    throw new Error(`${fileName}:${lineNum}: unexpected "${line}"`);
  }
  if (!id) {
    if (firstHashText) {
      console.warn(`${fileName}: deprecated \u2014 add "id: ${firstHashText}" line (first # line used as fallback id)`);
      id = firstHashText;
    } else {
      throw new Error(`${fileName}: missing composition id (add "id:" line)`);
    }
  }
  if (!name) {
    name = id;
  }
  if (flow?.items.some((it) => it.type === "photo")) {
    if (imageExplicit) throw new Error(`${fileName}: "image:" and a "| photo" flow item can't be combined (the flow photo is the page's image)`);
    if (flow.panel || flow.split) throw new Error(`${fileName}: "| photo" is only allowed in a plain "flow:" (not in a panel or split)`);
  }
  if (!image) image = "full";
  if (!logo && !logoNone && !sticky.length) throw new Error(`${fileName}: missing "logo:" line (or use sticky: block)`);
  return { id, name, description, mode, image, imageExplicit, logo, logoNone: logoNone || void 0, icon, slots, sticky, flow, illustration };
}

// parser/personParser.ts
var KEYS2 = /* @__PURE__ */ new Set(["id", "name", "role", "since", "place", "group", "reason", "context", "photos", "consent", "until"]);
var NAME2 = /^[a-z][a-z0-9-]*$/;
function parsePersonFile(content, fileName) {
  const raw = {};
  let description = "";
  const quotes = [];
  let quote = null;
  content.split("\n").forEach((rawLine, i) => {
    const lineNum = i + 1;
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();
    if (line === "") return;
    if (line.startsWith("#") && (indent === 0 || !quote)) {
      if (indent === 0) description = description ? `${description} ${line.slice(1).trim()}` : line.slice(1).trim();
      return;
    }
    if (indent === 0) {
      quote = null;
      if (line === "quote") {
        quote = { lines: [], line: lineNum };
        quotes.push(quote);
        return;
      }
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: expected "key: value" or a quote block, got "${line}"`);
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim().replace(/\s+#.*$/, "");
      if (!KEYS2.has(key)) throw new Error(`${fileName}:${lineNum}: unknown key "${key}" (expected ${[...KEYS2].join(", ")} or a quote block)`);
      if (raw[key]) throw new Error(`${fileName}:${lineNum}: duplicate "${key}"`);
      if (!value) throw new Error(`${fileName}:${lineNum}: empty ${key}`);
      raw[key] = { value, line: lineNum };
      return;
    }
    if (!quote || indent !== 2) throw new Error(`${fileName}:${lineNum}: unexpected indent (a quote's lines use 2 spaces under "quote")`);
    quote.lines.push(line);
  });
  if (!raw["id"]) throw new Error(`${fileName}: missing person id (add "id:" line)`);
  if (!NAME2.test(raw["id"].value)) throw new Error(`${fileName}:${raw["id"].line}: person id must be lowercase kebab-case, got "${raw["id"].value}"`);
  if (!raw["role"]) throw new Error(`${fileName}: person needs role: (who they are to the brand, as a post would say it)`);
  if (raw["since"] && !isDateOrYear(raw["since"].value)) throw new Error(`${fileName}:${raw["since"].line}: since must be a date YYYY-MM-DD or a year YYYY, got "${raw["since"].value}"`);
  if (raw["place"] && !NAME2.test(raw["place"].value)) throw new Error(`${fileName}:${raw["place"].line}: place must be a place id, got "${raw["place"].value}"`);
  if (raw["group"] && !NAME2.test(raw["group"].value)) throw new Error(`${fileName}:${raw["group"].line}: group must be a group id, got "${raw["group"].value}"`);
  for (const key of ["consent", "until"]) {
    if (raw[key] && !isDate2(raw[key].value)) throw new Error(`${fileName}:${raw[key].line}: ${key} must be a date YYYY-MM-DD, got "${raw[key].value}"`);
  }
  if (raw["consent"] && raw["until"] && raw["until"].value <= raw["consent"].value) {
    throw new Error(`${fileName}:${raw["until"].line}: until ${raw["until"].value} is not after consent ${raw["consent"].value}`);
  }
  let photos;
  if (raw["photos"]) {
    photos = raw["photos"].value.split(",").map((p) => p.trim()).filter(Boolean);
    for (const p of photos) {
      if (!NAME2.test(p)) throw new Error(`${fileName}:${raw["photos"].line}: photos must be photo ids, got "${p}"`);
      if (photos.indexOf(p) !== photos.lastIndexOf(p)) throw new Error(`${fileName}:${raw["photos"].line}: photo "${p}" is listed twice`);
    }
  }
  for (const q of quotes) {
    if (q.lines.length === 0) throw new Error(`${fileName}:${q.line}: empty quote (the person's words go on the following 2-space lines)`);
  }
  return {
    id: raw["id"].value,
    description,
    ...raw["name"] ? { name: raw["name"].value } : {},
    role: raw["role"].value,
    ...raw["since"] ? { since: raw["since"].value } : {},
    ...raw["place"] ? { place: raw["place"].value } : {},
    ...raw["group"] ? { group: raw["group"].value } : {},
    ...raw["reason"] ? { reason: raw["reason"].value } : {},
    ...raw["context"] ? { context: raw["context"].value } : {},
    ...photos ? { photos } : {},
    ...raw["consent"] ? { consent: raw["consent"].value } : {},
    ...raw["until"] ? { until: raw["until"].value } : {},
    quotes: quotes.map((q) => q.lines.join("\n"))
  };
}
function personLabel(person) {
  return person.name ?? person.role;
}
function hasSomethingToShow(person) {
  return person.quotes.length > 0 || (person.photos?.length ?? 0) > 0;
}
function checkPerson(person, facts, fileName) {
  const problems = [];
  if (facts.groups && person.group) {
    const group = facts.groups.find((g) => g.id === person.group);
    if (!group) problems.push(`${fileName}: group "${person.group}" does not exist`);
    else if (!group.members?.includes(person.id)) problems.push(`${fileName}: group "${group.id}" doesn't list "${person.id}" in its members: (a membership is written on both sides)`);
  }
  if (facts.places && person.place && !facts.places.some((p) => p.id === person.place)) problems.push(`${fileName}: place "${person.place}" does not exist`);
  return problems;
}

// parser/groupParser.ts
var KEYS3 = /* @__PURE__ */ new Set(["id", "name", "role", "since", "where", "members", "links", "photos", "context"]);
var NAME3 = /^[a-z][a-z0-9-]*$/;
var LINK = /^https:\/\/\S+$/;
function parseGroupFile(content, fileName) {
  const raw = {};
  let description = "";
  const quotes = [];
  let quote = null;
  content.split("\n").forEach((rawLine, i) => {
    const lineNum = i + 1;
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();
    if (line === "") return;
    if (line.startsWith("#") && (indent === 0 || !quote)) {
      if (indent === 0) description = description ? `${description} ${line.slice(1).trim()}` : line.slice(1).trim();
      return;
    }
    if (indent === 0) {
      quote = null;
      if (line === "quote") {
        quote = { lines: [], line: lineNum };
        quotes.push(quote);
        return;
      }
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: expected "key: value" or a quote block, got "${line}"`);
      const key = line.slice(0, colonIdx).trim();
      const rest = line.slice(colonIdx + 1).trim();
      const value = key === "links" ? rest : rest.replace(/\s+#.*$/, "");
      if (!KEYS3.has(key)) throw new Error(`${fileName}:${lineNum}: unknown key "${key}" (expected ${[...KEYS3].join(", ")} or a quote block)`);
      if (raw[key]) throw new Error(`${fileName}:${lineNum}: duplicate "${key}"`);
      if (!value) throw new Error(`${fileName}:${lineNum}: empty ${key}`);
      raw[key] = { value, line: lineNum };
      return;
    }
    if (!quote || indent !== 2) throw new Error(`${fileName}:${lineNum}: unexpected indent (a quote's lines use 2 spaces under "quote")`);
    quote.lines.push(line);
  });
  if (!raw["id"]) throw new Error(`${fileName}: missing group id (add "id:" line)`);
  if (!NAME3.test(raw["id"].value)) throw new Error(`${fileName}:${raw["id"].line}: group id must be lowercase kebab-case, got "${raw["id"].value}"`);
  if (!raw["name"]) throw new Error(`${fileName}: group needs name: (the name as posts write it)`);
  if (!raw["role"]) throw new Error(`${fileName}: group needs role: (what the group is to the brand, as a post would say it)`);
  if (raw["since"] && !isDateOrYear(raw["since"].value)) throw new Error(`${fileName}:${raw["since"].line}: since must be a date YYYY-MM-DD or a year YYYY, got "${raw["since"].value}"`);
  const idList = (key, what) => {
    if (!raw[key]) return void 0;
    const ids = raw[key].value.split(",").map((p) => p.trim()).filter(Boolean);
    for (const id of ids) {
      if (!NAME3.test(id)) throw new Error(`${fileName}:${raw[key].line}: ${key} must be ${what} ids, got "${id}"`);
      if (ids.indexOf(id) !== ids.lastIndexOf(id)) throw new Error(`${fileName}:${raw[key].line}: ${what} "${id}" is listed twice`);
    }
    return ids;
  };
  const members = idList("members", "person");
  const photos = idList("photos", "photo");
  let links;
  if (raw["links"]) {
    links = raw["links"].value.split(",").map((l) => l.trim()).filter(Boolean);
    for (const l of links) {
      if (!LINK.test(l)) throw new Error(`${fileName}:${raw["links"].line}: links must be https links, got "${l}"`);
    }
  }
  for (const q of quotes) {
    if (q.lines.length === 0) throw new Error(`${fileName}:${q.line}: empty quote (the group's words go on the following 2-space lines)`);
  }
  return {
    id: raw["id"].value,
    description,
    name: raw["name"].value,
    role: raw["role"].value,
    ...raw["since"] ? { since: raw["since"].value } : {},
    ...raw["where"] ? { where: raw["where"].value } : {},
    ...members ? { members } : {},
    ...links ? { links } : {},
    ...photos ? { photos } : {},
    ...raw["context"] ? { context: raw["context"].value } : {},
    quotes: quotes.map((q) => q.lines.join("\n"))
  };
}
function groupHasSomethingToShow(group) {
  return group.quotes.length > 0 || (group.photos?.length ?? 0) > 0;
}
function checkGroup(group, facts, fileName) {
  const problems = [];
  if (!facts.people) return problems;
  for (const id of group.members ?? []) {
    const person = facts.people.find((p) => p.id === id);
    if (!person) problems.push(`${fileName}: member "${id}" does not exist`);
    else if (person.group !== group.id) problems.push(`${fileName}: member "${id}" ${person.group ? `belongs to group "${person.group}"` : "names no group"} (add "group: ${group.id}" to the person)`);
  }
  return problems;
}

// parser/workParser.ts
var KEYS4 = /* @__PURE__ */ new Set(["id", "title", "kind", "by", "on", "days", "time", "lead", "until", "when", "place", "price", "links", "photos"]);
var NAME4 = /^[a-z][a-z0-9-]*$/;
var LINK2 = /^https:\/\/\S+$/;
var DEFAULT_LEAD = 14;
var HEX = /^#[0-9a-fA-F]{6}$/;
var NEAR_DUPLICATE = 0.03;
function isHexItem(value) {
  return HEX.test(value);
}
function oklab(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ];
}
function colorDistance(a, b) {
  const [p, q] = [oklab(a), oklab(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
function parseWorkFile(content, fileName) {
  const raw = {};
  let description = "";
  let facts = null;
  let inFacts = false;
  let items = null;
  let inItems = false;
  const reviews = [];
  let review = null;
  content.split("\n").forEach((rawLine, i) => {
    const lineNum = i + 1;
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();
    if (line === "") return;
    if (line.startsWith("#") && (indent === 0 || !inFacts && !inItems && !review || inItems && /^#(\s|$)/.test(line))) {
      if (indent === 0) description = description ? `${description} ${line.slice(1).trim()}` : line.slice(1).trim();
      return;
    }
    if (indent === 0) {
      inFacts = false;
      inItems = false;
      review = null;
      if (line === "review") {
        review = { lines: [], keys: {}, line: lineNum };
        reviews.push(review);
        return;
      }
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: expected "key: value", a "facts:" block or a review block, got "${line}"`);
      const key = line.slice(0, colonIdx).trim();
      const rest = line.slice(colonIdx + 1).trim();
      const value = key === "links" ? rest : rest.replace(/\s+#.*$/, "");
      if (key === "facts") {
        if (facts) throw new Error(`${fileName}:${lineNum}: duplicate "facts"`);
        if (value) throw new Error(`${fileName}:${lineNum}: facts go on the following 2-space lines, after a bare "facts:"`);
        facts = { lines: [], line: lineNum };
        inFacts = true;
        return;
      }
      if (key === "items") {
        if (items) throw new Error(`${fileName}:${lineNum}: duplicate "items"`);
        if (value && value !== "cycle") throw new Error(`${fileName}:${lineNum}: items is a bare "items:" or "items: cycle", the items go on the following 2-space lines, got "${value}"`);
        items = { list: [], line: lineNum, cycle: value === "cycle" };
        inItems = true;
        return;
      }
      if (!KEYS4.has(key)) throw new Error(`${fileName}:${lineNum}: unknown key "${key}" (expected ${[...KEYS4].join(", ")} , a facts: block or a review block)`);
      if (raw[key]) throw new Error(`${fileName}:${lineNum}: duplicate "${key}"`);
      if (!value) throw new Error(`${fileName}:${lineNum}: empty ${key}`);
      raw[key] = { value, line: lineNum };
      return;
    }
    if (review) {
      if (indent !== 2) throw new Error(`${fileName}:${lineNum}: unexpected indent (a review's lines use 2 spaces under "review")`);
      const key = /^(by|on|link):\s*(.*)$/.exec(line);
      if (key && review.lines.length === 0) {
        if (review.keys[key[1]] !== void 0) throw new Error(`${fileName}:${lineNum}: duplicate "${key[1]}" in review`);
        if (!key[2]) throw new Error(`${fileName}:${lineNum}: empty ${key[1]} in review`);
        review.keys[key[1]] = key[2].trim();
        return;
      }
      review.lines.push(line);
      return;
    }
    if (inItems && items) {
      if (indent === 2) {
        const m = /^(\S(?:.*?\S)?)(?:\s{2,}(\S.*))?$/.exec(line);
        items.list.push({ value: m[1], ...m[2] ? { name: m[2] } : {}, line: lineNum });
        return;
      }
      const item = items.list[items.list.length - 1];
      if (indent !== 4 || !item) throw new Error(`${fileName}:${lineNum}: unexpected indent (an item is "VALUE  Name" on a 2-space line, its note on 4-space lines below)`);
      item.note = item.note ? `${item.note} ${line}` : line;
      return;
    }
    if (!inFacts || !facts || indent !== 2) throw new Error(`${fileName}:${lineNum}: unexpected indent (the facts' lines use 2 spaces under "facts:")`);
    facts.lines.push(line);
  });
  const at = (key) => `${fileName}:${raw[key].line}`;
  if (!raw["id"]) throw new Error(`${fileName}: missing work id (add "id:" line)`);
  if (!NAME4.test(raw["id"].value)) throw new Error(`${at("id")}: work id must be lowercase kebab-case, got "${raw["id"].value}"`);
  if (!raw["title"]) throw new Error(`${fileName}: work needs title: (the title as posts write it)`);
  if (!raw["kind"]) throw new Error(`${fileName}: work needs kind: (what it is, in the brand's own word: bread, album, class, event)`);
  const idList = (key, what) => {
    if (!raw[key]) return void 0;
    const ids = raw[key].value.split(",").map((p) => p.trim()).filter(Boolean);
    for (const id of ids) {
      if (!NAME4.test(id)) throw new Error(`${at(key)}: ${key} must be ${what} ids, got "${id}"`);
      if (ids.indexOf(id) !== ids.lastIndexOf(id)) throw new Error(`${at(key)}: "${id}" is listed twice in ${key}`);
    }
    return ids;
  };
  const by = idList("by", "person or group");
  const photos = idList("photos", "photo");
  let on;
  if (raw["on"]) {
    const onValue = raw["on"].value;
    const m = /^(\d{2}-\d{2}|\d{4}-\d{2}-\d{2})(?:\.\.(\d{2}-\d{2}|\d{4}-\d{2}-\d{2}))?$/.exec(onValue);
    const yearly = !!m && m[1].length === 5;
    const valid = (d) => yearly ? isMonthDay(d) : isDate2(d);
    if (!m || !valid(m[1]) || m[2] && (m[2].length !== m[1].length || !valid(m[2]))) {
      throw new Error(`${at("on")}: on must be "MM-DD", "MM-DD..MM-DD", "YYYY-MM-DD" or "YYYY-MM-DD..YYYY-MM-DD", got "${onValue}"`);
    }
    const to = m[2] ?? m[1];
    if (!yearly && to < m[1]) throw new Error(`${at("on")}: on ends before it starts (${onValue})`);
    on = { from: m[1], to, yearly };
  }
  let days;
  if (raw["days"]) {
    days = parseDayList(raw["days"].value) ?? void 0;
    if (!days) throw new Error(`${at("days")}: days must be weekdays like sat, thu-fri or mon, wed, got "${raw["days"].value}"`);
  }
  let time;
  if (raw["time"]) {
    time = parseTimeSpan(raw["time"].value) ?? void 0;
    if (!time) throw new Error(`${at("time")}: time must be "HH:MM-HH:MM" or "HH:MM", got "${raw["time"].value}"`);
  }
  let lead = DEFAULT_LEAD;
  if (raw["lead"]) {
    if (!/^\d+$/.test(raw["lead"].value)) throw new Error(`${at("lead")}: lead must be a whole number of days, got "${raw["lead"].value}"`);
    if (!on) throw new Error(`${at("lead")}: lead counts the days before on:, which the work doesn't have`);
    lead = Number(raw["lead"].value);
  }
  if (raw["until"] && !isDate2(raw["until"].value)) throw new Error(`${at("until")}: until must be a date YYYY-MM-DD, got "${raw["until"].value}"`);
  if (raw["until"] && on && !on.yearly && raw["until"].value < on.from) throw new Error(`${at("until")}: until ${raw["until"].value} is before on ${on.from}`);
  for (const key of ["when", "place"]) {
    if (raw[key] && !NAME4.test(raw[key].value)) throw new Error(`${at(key)}: ${key} must be ${key === "when" ? "the name of a .time window or season" : "a place id"}, got "${raw[key].value}"`);
  }
  let links;
  if (raw["links"]) {
    links = raw["links"].value.split(",").map((l) => l.trim()).filter(Boolean);
    for (const l of links) {
      if (!LINK2.test(l)) throw new Error(`${at("links")}: links must be https links, got "${l}"`);
    }
  }
  const factsBlock = facts;
  if (factsBlock && factsBlock.lines.length === 0) throw new Error(`${fileName}:${factsBlock.line}: empty facts (the facts go on the following 2-space lines)`);
  const itemsBlock = items;
  if (itemsBlock) {
    if (itemsBlock.list.length === 0) throw new Error(`${fileName}:${itemsBlock.line}: empty items (one item per 2-space line: "VALUE  Name")`);
    if (!on || on.yearly) throw new Error(`${fileName}:${itemsBlock.line}: items count from the work's start, which needs a one-off on: YYYY-MM-DD`);
    itemsBlock.list.forEach((item, i) => {
      for (const other of itemsBlock.list.slice(0, i)) {
        if (other.value.toLowerCase() === item.value.toLowerCase()) throw new Error(`${fileName}:${item.line}: item "${item.value}" repeats line ${other.line}`);
        if (isHexItem(item.value) && isHexItem(other.value) && colorDistance(item.value, other.value) < NEAR_DUPLICATE) {
          throw new Error(`${fileName}:${item.line}: item ${item.value} looks the same as ${other.value} on line ${other.line} (closer than ${NEAR_DUPLICATE} in OKLab)`);
        }
      }
    });
  }
  for (const r of reviews) {
    if (!r.keys["by"]) throw new Error(`${fileName}:${r.line}: review needs by: (who wrote it where, as a post credits it)`);
    if (r.lines.length === 0) throw new Error(`${fileName}:${r.line}: empty review (the critic's words go on the 2-space lines after by:, on: and link:)`);
    if (r.keys["on"] !== void 0 && !isDate2(r.keys["on"])) throw new Error(`${fileName}:${r.line}: review on must be a date YYYY-MM-DD, got "${r.keys["on"]}"`);
    if (r.keys["link"] !== void 0 && !LINK2.test(r.keys["link"])) throw new Error(`${fileName}:${r.line}: review link must be an https link, got "${r.keys["link"]}"`);
  }
  return {
    id: raw["id"].value,
    description,
    title: raw["title"].value,
    kind: raw["kind"].value,
    ...by ? { by } : {},
    ...on ? { on } : {},
    ...days ? { days } : {},
    ...time ? { time } : {},
    lead,
    ...raw["until"] ? { until: raw["until"].value } : {},
    ...raw["when"] ? { when: raw["when"].value } : {},
    ...raw["place"] ? { place: raw["place"].value } : {},
    ...raw["price"] ? { price: raw["price"].value } : {},
    ...links ? { links } : {},
    ...photos ? { photos } : {},
    ...factsBlock ? { facts: factsBlock.lines.join("\n") } : {},
    ...itemsBlock ? { items: itemsBlock.list.map(({ line: _, ...item }) => item) } : {},
    ...itemsBlock?.cycle ? { itemsCycle: true } : {},
    reviews: reviews.map((r) => ({
      text: r.lines.join("\n"),
      by: r.keys["by"],
      ...r.keys["on"] ? { on: r.keys["on"] } : {},
      ...r.keys["link"] ? { link: r.keys["link"] } : {}
    }))
  };
}
function checkWork(work, facts, fileName) {
  const problems = [];
  if (facts.people !== void 0 || facts.groups !== void 0) {
    for (const id of work.by ?? []) {
      const known = (facts.people ?? []).some((p) => p.id === id) || (facts.groups ?? []).some((g) => g.id === id);
      if (!known) problems.push(`${fileName}: by "${id}" is neither a person nor a group`);
    }
  }
  if (facts.time !== void 0 && work.when && !(facts.time && timeEntryNames(facts.time).includes(work.when))) {
    problems.push(`${fileName}: when "${work.when}" is not in the .time${facts.time ? "" : " (the brand has no .time)"}`);
  }
  if (facts.places && work.place && !facts.places.some((p) => p.id === work.place)) problems.push(`${fileName}: place "${work.place}" does not exist`);
  return problems;
}

// parser/storyParser.ts
var STORY_VARIABLES = {
  weekday: { maxLength: 10, shortMaxLength: 3 },
  // "Donnerstag", short "Thu"
  date: { maxLength: 13, shortMaxLength: 7 },
  // "30. September", short "30. Sep"
  sunrise: { maxLength: 8, location: true },
  // "12:59 PM"
  sunset: { maxLength: 8, location: true },
  "day-length": { maxLength: 15, location: true },
  // "16 Std. 59 Min."
  moon: { maxLength: 20, location: true },
  // "abnehmender Halbmond"
  temperature: { maxLength: 6, location: true },
  // "-12 °C"
  wind: { maxLength: 6, location: true },
  // "12 Bft"
  weather: { maxLength: 13, location: true },
  // "teils bewölkt"
  place: { maxLength: 0, place: true },
  address: { maxLength: 0, place: true, needs: "address" },
  street: { maxLength: 0, place: true, needs: "address" },
  hours: { maxLength: 0, place: true, needs: "hours" },
  "week-hours": { maxLength: 0, place: true, needs: "hours" },
  opens: { maxLength: 8, place: true, needs: "hours" },
  // "10:30 AM"
  closes: { maxLength: 8, place: true, needs: "hours" },
  opening: { maxLength: 13, shortMaxLength: 7, place: true, needs: "opening" },
  // "30. September"
  season: { maxLength: 0, time: "seasons" },
  // the season's label
  founded: { maxLength: 4, time: "founded" },
  // "2019"
  years: { maxLength: 3, time: "founded" },
  // "7"
  daily: { maxLength: 8, time: "daily" },
  // "10:30 AM"
  person: { maxLength: 0, person: true },
  // the name, or the role without a name
  role: { maxLength: 0, person: true },
  // the role
  since: { maxLength: 4, person: true, personNeeds: "since" },
  // "2006"
  "since-years": { maxLength: 3, person: true, personNeeds: "since" },
  // "20"
  reason: { maxLength: 0, person: true, personNeeds: "reason" },
  // the reason
  group: { maxLength: 0, group: true },
  // the group's name
  where: { maxLength: 0, group: true, groupNeeds: "where" },
  // the region
  "group-since": { maxLength: 4, group: true, groupNeeds: "since" },
  // "2001"
  "group-years": { maxLength: 3, group: true, groupNeeds: "since" },
  // "25"
  work: { maxLength: 0, work: true },
  // the title
  kind: { maxLength: 0, work: true },
  // the kind
  by: { maxLength: 0, work: true },
  // the names of its by: ids, or the brand's name
  price: { maxLength: 0, work: true, workNeeds: "price" },
  // the price
  on: { maxLength: 13, shortMaxLength: 7, work: true, workNeeds: "on" },
  // "30. September"
  time: { maxLength: 17, work: true, workNeeds: "time" },
  // "10:30 AM–10:30 PM"
  "days-until": { maxLength: 3, work: true, workNeeds: "on" },
  // "365"
  item: { maxLength: 0, work: true, workNeeds: "items" },
  // the day's item: "#002B36"
  "item-name": { maxLength: 0, work: true, workNeeds: "items" },
  // its name
  "item-note": { maxLength: 0, work: true, workNeeds: "items" },
  // its note
  n: { maxLength: 2, list: true },
  // "10": the page's position in its page list
  count: { maxLength: 2, list: true }
  // "10": how many pages the page list has
};
var HOURS_RANGE_LENGTH = 17;
var WEEK_DAYS_LENGTH = 8;
var HOURS_CLOSED_LENGTH = 11;
var BY_AND_LENGTH = 5;
var VALID_SLOTS3 = new Set(SLOT_IDS);
var ID = /^[a-z][a-z0-9-]*$/;
var VARIABLE = /\{([a-z][a-z0-9-]*(?: [a-z][a-z0-9-]*)?)\}/g;
function storyTextVariables(text) {
  return [...text.matchAll(VARIABLE)].map((m) => m[1]);
}
function variableKey(name) {
  const key = name.split(" ")[0];
  return key in STORY_VARIABLES ? key : void 0;
}
function isShort(name) {
  return name.endsWith(" short") && !name.startsWith("daily ");
}
function parseStoryFile(content, fileName) {
  const lines = content.split("\n");
  let id = "";
  let name = "";
  let description = "";
  let format = "";
  let topic;
  let scrim;
  let place;
  let when;
  let person;
  let group;
  let work;
  const pages = [];
  const examples = [];
  let currentPage = null;
  let currentExample = null;
  let currentExamplePage = null;
  let multiKey = null;
  let multiIndent = 0;
  const examplePageLines = /* @__PURE__ */ new Map();
  let promptLine = 0;
  let inPrompt = false;
  const promptLines = [];
  let promptModel;
  function readKey(line, lineNum, target, extra, allowVariables) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) throw new Error(`${fileName}:${lineNum}: expected "key: value", got "${line}"`);
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (target.keys.has(key)) throw new Error(`${fileName}:${lineNum}: duplicate "${key}"`);
    target.keys.add(key);
    if (key === "topic") {
      if (!value) throw new Error(`${fileName}:${lineNum}: empty topic`);
      target.topic = value;
      return null;
    }
    if (extra.includes(key)) {
      if (!value) throw new Error(`${fileName}:${lineNum}: empty ${key}`);
      return { key, value };
    }
    if (!VALID_SLOTS3.has(key)) throw new Error(`${fileName}:${lineNum}: unknown key "${key}" (expected ${[...extra, "topic"].join(", ")} or a slot id)`);
    if (!value) return { multi: key };
    checkVariables(value, lineNum, allowVariables);
    target.texts[key] = value;
    return null;
  }
  function checkVariables(text, lineNum, allowed) {
    for (const v of storyTextVariables(text)) {
      if (!allowed) throw new Error(`${fileName}:${lineNum}: variable "{${v}}" in an example \u2014 examples are sample texts, variables belong in page texts`);
      if (v === "daily") throw new Error(`${fileName}:${lineNum}: "{daily}" needs the moment's name, e.g. {daily oven}`);
      const key = variableKey(v);
      if (!key) throw new Error(`${fileName}:${lineNum}: unknown variable "{${v}}" (expected ${Object.keys(STORY_VARIABLES).map((k) => k === "daily" ? "{daily NAME}" : `{${k}}`).join(", ")})`);
      if (key !== "daily" && v !== key) {
        const short = Object.entries(STORY_VARIABLES).filter(([, d]) => d.shortMaxLength).map(([k]) => `{${k} short}`).join(", ");
        if (!isShort(v)) throw new Error(`${fileName}:${lineNum}: "{${v}}": the only word after a variable's name is "short" (${short})`);
        if (!STORY_VARIABLES[key].shortMaxLength) throw new Error(`${fileName}:${lineNum}: "{${v}}": {${key}} has no short form (${short})`);
      }
    }
  }
  function closeBlocks() {
    currentPage = null;
    currentExample = null;
    currentExamplePage = null;
    multiKey = null;
    inPrompt = false;
  }
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const raw = lines[i];
    const line = raw.trim();
    const indent = raw.length - raw.trimStart().length;
    if (line === "") continue;
    if (inPrompt && indent >= 2) {
      const model = promptLines.length === 0 && promptModel === void 0 ? /^model:\s*(.*)$/.exec(line) : null;
      if (model) {
        if (!ID.test(model[1])) throw new Error(`${fileName}:${lineNum}: invalid model "${model[1]}" (expected a model name like haiku)`);
        promptModel = model[1];
      } else promptLines.push(line);
      continue;
    }
    if (line.startsWith("#")) {
      if (indent === 0) description = description ? `${description} ${line.slice(1).trim()}` : line.slice(1).trim();
      continue;
    }
    if (multiKey && indent >= multiIndent) {
      const target = currentExamplePage ?? currentPage;
      checkVariables(line, lineNum, !currentExamplePage);
      const prev = target.texts[multiKey];
      target.texts[multiKey] = prev ? `${prev}
${line}` : line;
      continue;
    }
    if (multiKey) {
      const target = currentExamplePage ?? currentPage;
      if (!target.texts[multiKey]) throw new Error(`${fileName}:${lineNum}: "${multiKey}:" has no text (write it after the colon or on the following, deeper lines)`);
      multiKey = null;
    }
    if (indent === 0) {
      closeBlocks();
      if (line === "page") {
        currentPage = { purpose: "", texts: {}, line: lineNum, keys: /* @__PURE__ */ new Set() };
        pages.push(currentPage);
        continue;
      }
      if (line === "example") {
        currentExample = { pages: [], line: lineNum };
        examples.push(currentExample);
        continue;
      }
      if (line === "prompt") {
        if (promptLine) throw new Error(`${fileName}:${lineNum}: duplicate "prompt" (a story has one)`);
        promptLine = lineNum;
        inPrompt = true;
        continue;
      }
      const colonIdx = line.indexOf(":");
      const key = colonIdx === -1 ? line : line.slice(0, colonIdx).trim();
      const value = colonIdx === -1 ? "" : line.slice(colonIdx + 1).trim();
      if (key === "when" || key === "person" || key === "group" || key === "work") {
        if (!ID.test(value)) throw new Error(`${fileName}:${lineNum}: invalid ${key} "${value}" (expected the ${key === "when" ? "name of one .time window or season" : `id of one .${key}`})`);
        if (key === "when") when = value;
        else if (key === "person") person = value;
        else if (key === "group") group = value;
        else work = value;
        continue;
      }
      if (key === "id" || key === "name" || key === "format" || key === "topic" || key === "place") {
        if (!value) throw new Error(`${fileName}:${lineNum}: empty ${key}`);
        if (key === "id") id = value;
        else if (key === "name") name = value;
        else if (key === "format") format = value;
        else if (key === "place") place = value;
        else topic = value;
        continue;
      }
      if (key === "scrim") {
        if (value !== "none") throw new Error(`${fileName}:${lineNum}: invalid scrim "${value}" (expected none; how dark is the brand's photo-look scrim)`);
        scrim = "none";
        continue;
      }
      throw new Error(`${fileName}:${lineNum}: unexpected "${line}"`);
    }
    if (currentPage) {
      if (indent !== 2) throw new Error(`${fileName}:${lineNum}: unexpected indent in page (page keys use 2 spaces)`);
      if (/^when\s*:/.test(line)) throw new Error(`${fileName}:${lineNum}: when: is not a page key: a page about an occasion names its work with "work:" (an event is a work since v0.44); a window or season goes on the story`);
      const read = readKey(line, lineNum, currentPage, ["purpose", "composition", "illustration", "photo", "theme", "background", "person", "group", "work", "repeat"], true);
      if (read && "multi" in read) {
        multiKey = read.multi;
        multiIndent = 4;
      } else if (read?.key === "purpose") currentPage.purpose = read.value;
      else if (read?.key === "person" || read?.key === "group" || read?.key === "work") {
        if (!ID.test(read.value)) throw new Error(`${fileName}:${lineNum}: invalid ${read.key} "${read.value}" (expected the id of one .${read.key})`);
        currentPage[read.key] = read.value;
      } else if (read?.key === "illustration") currentPage.illustrations = read.value.split(",").map((id2) => id2.trim()).filter(Boolean);
      else if (read?.key === "photo") {
        const ids = read.value.split(",").map((id2) => id2.trim()).filter(Boolean);
        if (ids.includes("camera")) {
          if (ids.length > 1) throw new Error(`${fileName}:${lineNum}: photo: camera stands alone, without photo ids`);
          currentPage.camera = true;
        } else currentPage.photos = ids;
      } else if (read?.key === "theme") currentPage.theme = read.value;
      else if (read?.key === "background") {
        if (!/^#[0-9a-fA-F]{6}$/.test(read.value) && read.value !== "{item}") throw new Error(`${fileName}:${lineNum}: invalid background "${read.value}" (expected #RRGGBB or {item})`);
        currentPage.background = read.value;
      } else if (read?.key === "repeat") {
        const m = /^(\d+)\s*-\s*(\d+)$/.exec(read.value);
        const min = m ? parseInt(m[1], 10) : 0;
        const max = m ? parseInt(m[2], 10) : 0;
        if (!m || min < 1 || max < min) throw new Error(`${fileName}:${lineNum}: invalid repeat "${read.value}" (expected MIN-MAX, e.g. 2-6, with 1 <= MIN <= MAX)`);
        currentPage.repeat = { min, max };
      } else if (read) currentPage.composition = read.value;
      continue;
    }
    if (currentExample) {
      if (indent === 2) {
        currentExamplePage = null;
        const pageHead = /^page\s+(\d+)$/.exec(line);
        if (pageHead) {
          const n = parseInt(pageHead[1], 10);
          currentExamplePage = { page: n, texts: {}, line: lineNum, keys: /* @__PURE__ */ new Set() };
          currentExample.pages.push(currentExamplePage);
          examplePageLines.set(currentExamplePage, lineNum);
          continue;
        }
        if (line.startsWith("topic:")) {
          const value = line.slice(6).trim();
          if (!value) throw new Error(`${fileName}:${lineNum}: empty topic`);
          if (currentExample.topic) throw new Error(`${fileName}:${lineNum}: duplicate "topic" in example`);
          currentExample.topic = value;
          continue;
        }
        throw new Error(`${fileName}:${lineNum}: expected "topic:" or "page N" in example, got "${line}"`);
      }
      if (indent === 4 && currentExamplePage) {
        const read = readKey(line, lineNum, currentExamplePage, ["photo"], false);
        if (read && "multi" in read) {
          multiKey = read.multi;
          multiIndent = 6;
        } else if (read?.key === "photo") {
          if (read.value.includes(",")) throw new Error(`${fileName}:${lineNum}: an example page names one photo, the one its texts belong to`);
          currentExamplePage.photo = read.value;
        }
        continue;
      }
      throw new Error(`${fileName}:${lineNum}: unexpected indent in example (page N at 2 spaces, its keys at 4)`);
    }
    throw new Error(`${fileName}:${lineNum}: unexpected "${line}"`);
  }
  if (multiKey) {
    const target = currentExamplePage ?? currentPage;
    if (!target.texts[multiKey]) throw new Error(`${fileName}:${lines.length}: "${multiKey}:" has no text`);
  }
  if (promptLine && promptLines.length === 0) throw new Error(`${fileName}:${promptLine}: "prompt" has no text (write the brief on the following, indented lines)`);
  if (!id) throw new Error(`${fileName}: missing story id (add "id:" line)`);
  if (!format) throw new Error(`${fileName}: missing "format:" line`);
  if (pages.length === 0) throw new Error(`${fileName}: no pages defined`);
  for (const p of pages) {
    if (!p.purpose) throw new Error(`${fileName}:${p.line}: page without "purpose:"`);
  }
  const lists = pages.filter((p) => p.repeat);
  if (lists.length > 1) throw new Error(`${fileName}:${lists[1].line}: a story has at most one page with "repeat:"`);
  for (const p of pages) {
    for (const text of Object.values(p.texts)) {
      const vars = storyTextVariables(text);
      if (vars.includes("n") && !p.repeat) throw new Error(`${fileName}:${p.line}: "{n}" only on the page with "repeat:", where it counts the copies`);
      if (vars.includes("count") && lists.length === 0) throw new Error(`${fileName}:${p.line}: "{count}" needs a page with "repeat:"`);
    }
  }
  for (const ex of examples) {
    if (ex.pages.length === 0) throw new Error(`${fileName}:${ex.line}: example without pages`);
    for (const ep of ex.pages) {
      const page = pages[ep.page - 1];
      const copy = ex.pages.filter((o) => o.page === ep.page).indexOf(ep) + 1;
      const at = `${fileName}:${examplePageLines.get(ep)}`;
      if (page && copy > 1 && !page.repeat) throw new Error(`${at}: duplicate "page ${ep.page}" in example`);
      if (page?.repeat && copy > page.repeat.max) throw new Error(`${at}: example has more than ${page.repeat.max} copies of page ${ep.page} (repeat: ${page.repeat.min}-${page.repeat.max})`);
    }
    for (const ep of ex.pages) {
      const at = `${fileName}:${examplePageLines.get(ep)}`;
      const page = pages[ep.page - 1];
      if (!page) throw new Error(`${at}: example fills page ${ep.page}, the story has ${pages.length}`);
      if (Object.keys(ep.texts).length === 0 && !ep.topic && !ep.photo) throw new Error(`${at}: example page ${ep.page} is empty`);
      for (const slot of Object.keys(ep.texts)) {
        if (page.texts[slot] !== void 0) throw new Error(`${at}: slot "${slot}" is fixed on page ${ep.page} and takes no example text`);
      }
    }
  }
  if (!name) name = id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return {
    id,
    name,
    description,
    format,
    topic,
    ...scrim ? { scrim } : {},
    ...place ? { place } : {},
    ...when ? { when } : {},
    ...person ? { person } : {},
    ...group ? { group } : {},
    ...work ? { work } : {},
    pages: pages.map(({ line: _line, keys: _keys, ...p }) => p),
    examples: examples.map(({ line: _line, ...ex }) => ({
      ...ex,
      pages: ex.pages.map((p) => {
        const { line: _l, keys: _k, ...rest } = p;
        return rest;
      })
    })),
    ...promptLines.length ? { prompt: promptLines.join("\n") } : {},
    ...promptModel ? { promptModel } : {}
  };
}
function storyPlace(story, places) {
  if (story.place) return places.find((p) => p.id === story.place);
  return places.length === 1 ? places[0] : void 0;
}
function variableProblem(v, src) {
  const key = variableKey(v);
  if (!key) return `unknown variable "{${v}}"`;
  const variable = STORY_VARIABLES[key];
  const needs = (what) => `variable "{${v}}" needs ${what}`;
  const { place, time } = src;
  if (variable.location && src.location === false && place?.latitude === void 0) return needs("a location block in the .brand");
  if (variable.place && src.places && !src.placeUnknown) {
    if (!place) return needs(`a place: ${src.places.length > 1 ? 'name it with "place:"' : "add a .place file"}`);
    if (variable.needs && !place[variable.needs]) return needs(`${{ hours: "an hours block", address: "an address:", opening: "an opening:" }[variable.needs]} in place "${place.id}"`);
  }
  if (variable.time && time !== void 0) {
    const noTime = time ? "" : " (the brand has no .time)";
    if (variable.time === "seasons" && !time?.seasons.length) return needs(`season blocks in the .time${noTime}`);
    if (variable.time === "founded" && !time?.founded) return needs(`founded: in the .time${noTime}`);
    if (variable.time === "daily") {
      const name = v.slice("daily ".length);
      if (!time?.daily.some((d) => d.name === name)) return needs(`a daily moment "${name}" in the .time${noTime}`);
    }
  }
  if (variable.person && src.checked.person) {
    if (!src.named.person) return needs(src.nameIt.person);
    if (src.person && variable.personNeeds && !src.person[variable.personNeeds]) return needs(`${variable.personNeeds}: in person "${src.person.id}"`);
  }
  if (variable.group && src.checked.group) {
    if (!src.named.group) return needs(src.nameIt.group);
    if (src.group && variable.groupNeeds && !src.group[variable.groupNeeds]) return needs(`${variable.groupNeeds}: in group "${src.group.id}"`);
  }
  if (variable.work && src.checked.work) {
    if (!src.named.work) return needs(src.nameIt.work);
    if (src.work && variable.workNeeds && !src.work[variable.workNeeds]) return needs(`${variable.workNeeds}: in work "${src.work.id}"`);
    if (src.work?.items && (v === "item-name" || v === "item-note")) {
      const field = v === "item-name" ? "name" : "note";
      const bare = src.work.items.find((item) => !item[field]);
      if (bare) return needs(`a ${field} on every item of work "${src.work.id}", "${bare.value}" has none`);
    }
  }
  return void 0;
}
function longestText(text, { place, time, person, group, work, byNames }) {
  return text.replace(VARIABLE, (_, v) => {
    if (v === "season") return "x".repeat(Math.max(0, ...(time?.seasons ?? []).map((s) => s.label.length)));
    if (v === "person") return "x".repeat(person ? personLabel(person).length : 0);
    if (v === "role") return "x".repeat(person?.role.length ?? 0);
    if (v === "reason") return "x".repeat(person?.reason?.length ?? 0);
    if (v === "group") return "x".repeat(group?.name.length ?? 0);
    if (v === "where") return "x".repeat(group?.where?.length ?? 0);
    if (v === "work") return "x".repeat(work?.title.length ?? 0);
    if (v === "kind") return "x".repeat(work?.kind.length ?? 0);
    if (v === "price") return "x".repeat(work?.price?.length ?? 0);
    if (v === "item" || v === "item-name" || v === "item-note") {
      const field = v === "item" ? "value" : v === "item-name" ? "name" : "note";
      return "x".repeat(Math.max(0, ...(work?.items ?? []).map((item) => item[field]?.length ?? 0)));
    }
    if (v === "by") {
      const names = byNames ?? [];
      return "x".repeat(names.reduce((n, name) => n + name.length, 0) + Math.max(0, names.length - 1) * BY_AND_LENGTH);
    }
    if (v === "place") return "x".repeat(place?.name.length ?? 0);
    if (v === "address") return "x".repeat(place?.address?.length ?? 0);
    if (v === "street") return "x".repeat(place?.address ? addressStreet(place.address).length : 0);
    if (v === "hours") {
      const days = Object.values(place?.hours ?? {});
      const lines = Math.max(1, ...days.map((r) => r.length));
      const line = Math.max(HOURS_CLOSED_LENGTH, ...days.flat().map((r) => (r.label ? r.label.length + 2 : 0) + HOURS_RANGE_LENGTH));
      return Array.from({ length: lines }, () => "x".repeat(line)).join("\n");
    }
    if (v === "week-hours") {
      const lines = weekOpeningDays(place?.hours ?? {});
      if (!lines.length) return "x".repeat(HOURS_CLOSED_LENGTH);
      return lines.map((l) => "x".repeat(WEEK_DAYS_LENGTH + l.ranges.length * HOURS_RANGE_LENGTH + (l.ranges.length - 1) * 2)).join("\n");
    }
    const variable = STORY_VARIABLES[variableKey(v)];
    return "x".repeat((isShort(v) ? variable?.shortMaxLength : variable?.maxLength) ?? 0);
  });
}
function checkStory(story, brand, fileName) {
  const problems = [];
  const say = (msg) => problems.push(`${fileName}: ${msg}`);
  if (!brand.formats.includes(story.format)) say(`format "${story.format}" does not exist`);
  const place = brand.places ? storyPlace(story, brand.places) : void 0;
  if (brand.places && story.place && !place) say(`place "${story.place}" does not exist`);
  const { time, people, groups, works } = brand;
  const noTime = time ? "" : " (the brand has no .time)";
  const whenEntry = (when, where) => {
    if (!when || time === void 0) return void 0;
    const entry = time ? timeEntry(time, when) : void 0;
    if (!entry) say(`${where}when "${when}" is not in the .time${noTime}`);
    return entry;
  };
  whenEntry(story.when, "");
  const persons = people && new Map(people.map((p) => [p.id, p]));
  const groupMap = groups && new Map(groups.map((g) => [g.id, g]));
  const workMap = works && new Map(works.map((w) => [w.id, w]));
  const personOf = (id, where) => {
    if (!id || !persons) return void 0;
    const person = persons.get(id);
    if (!person) say(`${where}person "${id}" does not exist`);
    return person;
  };
  const groupOf = (id, where) => {
    if (!id || !groupMap) return void 0;
    const group = groupMap.get(id);
    if (!group) say(`${where}group "${id}" does not exist`);
    return group;
  };
  const workOf = (id, where) => {
    if (!id || !workMap) return void 0;
    const work = workMap.get(id);
    if (!work) say(`${where}work "${id}" does not exist`);
    return work;
  };
  const storyPerson = personOf(story.person, "");
  const storyGroup = groupOf(story.group, "");
  const storyWork = workOf(story.work, "");
  const byNamesOf = (work) => {
    if (!work) return void 0;
    if (!work.by) return brand.name ? [brand.name] : [];
    return work.by.map((id) => persons?.get(id) ? personLabel(persons.get(id)) : groupMap?.get(id)?.name ?? "");
  };
  const purposes = new Map(brand.purposes.map((p) => [p.id, p]));
  const checkTexts = (where, purpose, texts, facts, named) => {
    for (const [slotId, text] of Object.entries(texts)) {
      const slot = purpose.slots.find((s) => s.id === slotId);
      if (!slot) {
        say(`${where}: slot "${slotId}" is not declared by purpose "${purpose.id}"`);
        continue;
      }
      if (slot.value) {
        say(`${where}: slot "${slotId}" has a fixed value in purpose "${purpose.id}"`);
        continue;
      }
      for (const v of new Set(storyTextVariables(text))) {
        const problem = variableProblem(v, {
          location: brand.location,
          places: brand.places,
          place,
          placeUnknown: !!story.place && !place,
          time,
          person: facts.person,
          group: facts.group,
          work: facts.work,
          named,
          checked: { person: !!persons, group: !!groupMap, work: !!workMap },
          nameIt: { person: "a person: on the page or the story", group: "a group: on the page or the story, or a person with a group", work: "a work: on the page or the story" }
        });
        if (problem) say(`${where}: ${problem}`);
      }
      const longest = longestText(text, facts);
      const parts = slot.slotType === "list" ? longest.split("\n") : [longest];
      if (slot.slotType === "list" && slot.maxItems && parts.length > slot.maxItems) say(`${where}: slot "${slotId}" has ${parts.length} items, maxItems is ${slot.maxItems}`);
      for (const part of parts) {
        if (part.length > slot.maxLength) say(`${where}: slot "${slotId}" is ${part.length} characters long, maxLength is ${slot.maxLength}`);
      }
    }
  };
  const pageFacts = story.pages.map((page, i) => {
    const where = `page ${i + 1}: `;
    const person = page.person ? personOf(page.person, where) : storyPerson;
    const personGroupId = page.person ?? story.person ? person?.group : void 0;
    const groupId = page.group ?? story.group ?? personGroupId;
    const group = page.group ? groupOf(page.group, where) : story.group ? storyGroup : personGroupId ? groupOf(personGroupId, `${where}person "${person.id}": `) : void 0;
    const work = page.work ? workOf(page.work, where) : storyWork;
    return [{ place, time, person, group, work, byNames: byNamesOf(work) }, { person: !!(page.person ?? story.person), group: !!groupId, work: !!(page.work ?? story.work) }];
  });
  story.pages.forEach((page, i) => {
    const where = `page ${i + 1}`;
    const [facts, named] = pageFacts[i];
    const purpose = purposes.get(page.purpose);
    if (!purpose) {
      say(`${where}: purpose "${page.purpose}" does not exist`);
      return;
    }
    if (purpose.person === "required" && persons) {
      if (!named.person) say(`${where}: purpose "${purpose.id}" has person: required, but neither the page nor the story names a person`);
      else if (facts.person && !hasSomethingToShow(facts.person)) say(`${where}: person "${facts.person.id}" has neither a quote nor a photo, and purpose "${purpose.id}" has person: required`);
    }
    if (purpose.group === "required" && groupMap) {
      if (!named.group) say(`${where}: purpose "${purpose.id}" has group: required, but neither the page nor the story names a group`);
      else if (facts.group && !groupHasSomethingToShow(facts.group)) say(`${where}: group "${facts.group.id}" has neither a quote nor a photo, and purpose "${purpose.id}" has group: required`);
    }
    if (purpose.work === "required" && workMap && !named.work) say(`${where}: purpose "${purpose.id}" has work: required, but neither the page nor the story names a work`);
    if (page.composition) {
      if (!brand.compositions.includes(page.composition)) say(`${where}: composition "${page.composition}" does not exist`);
      else if (!purpose.preferredCompositions.includes(page.composition)) say(`${where}: composition "${page.composition}" is not one of purpose "${purpose.id}"'s compositions`);
    }
    for (const id of page.illustrations ?? []) {
      if (brand.illustrations && !brand.illustrations.includes(id)) say(`${where}: illustration "${id}" does not exist`);
    }
    for (const id of page.photos ?? []) {
      if (brand.photos && !brand.photos.includes(id)) say(`${where}: photo "${id}" does not exist`);
    }
    if (page.camera && purpose.camera === false) say(`${where}: photo: camera, but purpose "${purpose.id}" has camera: false`);
    if (page.theme && brand.themes && !brand.themes.includes(page.theme)) say(`${where}: theme "${page.theme}" does not exist`);
    if (page.background === "{item}" && workMap) {
      if (!named.work) say(`${where}: background {item} needs a work: on the page or the story`);
      else if (facts.work && !facts.work.items) say(`${where}: background {item} needs items: in work "${facts.work.id}"`);
      else if (facts.work) {
        const notHex = facts.work.items.find((item) => !isHexItem(item.value));
        if (notHex) say(`${where}: background {item} needs colours, but item "${notHex.value}" of work "${facts.work.id}" is not #RRGGBB`);
      }
    }
    checkTexts(where, purpose, page.texts, facts, named);
  });
  if (story.prompt) {
    const open = story.pages.some((page) => purposes.get(page.purpose)?.slots.some((slot) => !slot.value && page.texts[slot.id] === void 0));
    if (!open && story.pages.every((page) => purposes.has(page.purpose))) say("prompt: no page has an open slot for it to write");
  }
  story.examples.forEach((ex, i) => {
    for (const ep of ex.pages) {
      const purpose = purposes.get(story.pages[ep.page - 1].purpose);
      if (purpose) checkTexts(`example ${i + 1}, page ${ep.page}`, purpose, ep.texts, ...pageFacts[ep.page - 1]);
      if (ep.photo && brand.photos && !brand.photos.includes(ep.photo)) say(`example ${i + 1}, page ${ep.page}: photo "${ep.photo}" does not exist`);
    }
  });
  return problems;
}

// parser/checkFiles.ts
function checkFiles(files) {
  const issues = [];
  const { brand, identity, formats, compositions, purposes, stories, places, time, people, groups, works } = files;
  const error = (file, message) => issues.push({ severity: "error", file, message });
  const warning = (file, message) => issues.push({ severity: "warning", file, message });
  const errorsOf = (file, problems) => problems.forEach((p) => error(file, p.startsWith(`${file}: `) ? p.slice(file.length + 2) : p));
  const unique = (ext, list) => {
    const seen = /* @__PURE__ */ new Set();
    for (const { id } of list) {
      if (seen.has(id)) error(`${id}.${ext}`, `more than one .${ext} has the id "${id}"`);
      seen.add(id);
    }
  };
  unique("purpose", purposes);
  unique("composition", compositions);
  unique("format", formats);
  const purposeIds = new Set(purposes.map((p) => p.id));
  for (const format of formats) {
    for (const id of format.purposes ?? []) {
      if (!purposeIds.has(id)) error(`${format.id}.format`, `purposes: purpose "${id}" does not exist`);
    }
  }
  const compositionIds = new Set(compositions.map((c) => c.id));
  const used = /* @__PURE__ */ new Set();
  for (const purpose of purposes) {
    const file = `${purpose.id}.purpose`;
    if (!purpose.preferredCompositions.length) warning(file, "compositions: is empty, so the purpose is never placed on a canvas");
    for (const id of purpose.preferredCompositions) {
      used.add(id);
      if (!compositionIds.has(id)) error(file, `compositions: composition "${id}" does not exist`);
    }
  }
  for (const composition of compositions) {
    const file = `${composition.id}.composition`;
    if (!used.has(composition.id)) warning(file, "no purpose lists this composition, so it is never used");
    if (composition.mode === "grid" && composition.sticky.length) warning(file, "sticky: is for flow mode; a grid-mode composition ignores it");
  }
  const firstTheme = Object.values(brand?.themes ?? {})[0];
  const themeKeys = firstTheme && new Set(Object.keys(firstTheme));
  for (const purpose of purposes) {
    const file = `${purpose.id}.purpose`;
    if (identity) {
      for (const id of purpose.scope?.audience ?? []) {
        if (!(id in identity.audiences)) error(file, `scope: audience "${id}" is not in the .identity`);
      }
    }
    errorsOf(file, checkPurpose(purpose, { time, works }, file));
    if (brand) {
      for (const slot of purpose.slots) {
        if (slot.typographyRef && !brand.typographies?.[slot.typographyRef]) error(file, `typography "${slot.typographyRef}" is not in the .brand`);
        if (slot.colorRef && themeKeys && !themeKeys.has(slot.colorRef)) error(file, `slot "${slot.id}": color "${slot.colorRef}" is not a slot of the .brand's themes`);
      }
      if (purpose.framing && !brand.framings?.some((fr) => fr.id === purpose.framing)) error(file, `framing "${purpose.framing}" is not in the .brand`);
    }
    const place = storyPlace({}, places);
    purpose.examples.forEach((example, i) => {
      const work = example.work ? works.find((w) => w.id === example.work) : void 0;
      for (const [slotId, text] of Object.entries(example.texts)) {
        for (const v of new Set(storyTextVariables(text ?? ""))) {
          const problem = variableProblem(v, {
            location: brand && !!brand.location,
            places,
            place,
            time,
            work,
            named: { person: false, group: false, work: !!example.work },
            checked: { person: true, group: true, work: true },
            nameIt: { person: "a person, which a purpose example cannot name", group: "a group, which a purpose example cannot name", work: "a work: on the example" }
          });
          if (problem) error(file, `example ${i + 1}, slot "${slotId}": ${problem}`);
        }
      }
    });
  }
  if (brand) errorsOf(`${brand.id}.brand`, checkBrand(brand, { time, people, groups, works }, `${brand.id}.brand`));
  for (const p of people) errorsOf(`${p.id}.person`, checkPerson(p, { groups, places }, `${p.id}.person`));
  for (const g of groups) errorsOf(`${g.id}.group`, checkGroup(g, { people }, `${g.id}.group`));
  for (const w of works) errorsOf(`${w.id}.work`, checkWork(w, { people, groups, time, places }, `${w.id}.work`));
  if (brand) {
    for (const story of stories) {
      const file = `${story.id}.story`;
      errorsOf(file, checkStory(story, {
        purposes,
        places,
        time,
        people,
        groups,
        works,
        compositions: [...compositionIds],
        formats: formats.map((f) => f.id),
        themes: Object.keys(brand.themes ?? {}),
        photos: files.photos ?? (brand.assets?.photos ?? []).map((p) => p.id),
        illustrations: (brand.assets?.illustrations ?? []).map((i) => i.id),
        name: brand.name,
        location: !!brand.location
      }, file));
    }
  }
  return issues;
}

// cli/check.ts
var SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", ".github", ".claude"]);
function listPhotos(photosDir, prefix = "", skipped = []) {
  const out = [];
  for (const name of readdirSync(join(photosDir, prefix))) {
    if (name.startsWith(".") || !prefix && name === "index.json") continue;
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(join(photosDir, rel)).isDirectory()) {
      out.push(...listPhotos(photosDir, rel, skipped));
      continue;
    }
    const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
    if (PHOTO_EXTENSIONS.includes(ext)) out.push(rel.normalize("NFC"));
    else skipped.push(rel);
  }
  return out.sort();
}
function photoIndexText(photosDir, skipped) {
  return JSON.stringify(listPhotos(photosDir, "", skipped), null, 2) + "\n";
}
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return SKIP_DIRS.has(e.name) || e.name.startsWith(".") ? [] : walk(join(dir, e.name));
    return [join(dir, e.name)];
  });
}
function checkFolder(dir, label = dir) {
  const errors = [];
  const warnings = [];
  const counts = {};
  const files = walk(dir);
  const name = (f) => relative(dir, f);
  const read = (f) => readFileSync(f, "utf8");
  const ofType = (ext) => {
    const list = files.filter((f) => f.endsWith(`.${ext}`));
    if (list.length) counts[ext] = list.length;
    return list;
  };
  const attempt = (f, fn) => {
    try {
      return fn();
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `${name(f)}: ${String(err)}`);
      return void 0;
    }
  };
  const brandFiles = ofType("brand");
  if (brandFiles.length !== 1) errors.push(`${brandFiles.length ? "more than one" : "no"} .brand file in ${dir}; a brand folder has exactly one`.replace(` in ${dir}`, ` in ${label}`));
  let identity;
  for (const f of ofType("identity")) identity = attempt(f, () => parseIdentityFile(read(f), name(f))) ?? identity;
  let brand;
  for (const f of brandFiles.slice(0, 1)) brand = attempt(f, () => parseBrandFile(read(f), name(f)));
  if (brand?.warnings?.length) warnings.push(...brand.warnings);
  let time = null;
  for (const f of ofType("time")) time = attempt(f, () => parseTimeFile(read(f), name(f))) ?? time;
  const collect = (ext, parse) => ofType(ext).flatMap((f) => {
    const out = attempt(f, () => parse(read(f), name(f)));
    return out === void 0 ? [] : [out];
  });
  const people = collect("person", parsePersonFile);
  const groups = collect("group", parseGroupFile);
  const works = collect("work", parseWorkFile);
  const places = collect("place", parsePlaceFile);
  const formats = collect("format", parseFormatFile);
  const compositions = collect("composition", parseCompositionFile);
  const stories = collect("story", parseStoryFile);
  const purposes = collect("purpose", parsePurposeFile);
  for (const p of purposes) if (p.warnings?.length) warnings.push(...p.warnings);
  const photosDir = join(dir, "photos");
  let photoIds = (brand?.assets?.photos ?? []).map((p) => p.id);
  if (existsSync(photosDir)) {
    const skipped = [];
    const expected = photoIndexText(photosDir, skipped);
    for (const s of skipped) warnings.push(`photos/${s}: not a photo, left out of the library`);
    const indexFile = join(photosDir, "index.json");
    const current = existsSync(indexFile) ? readFileSync(indexFile, "utf8") : "";
    if (current !== expected) errors.push(`photos/index.json is out of date; run: npx brand-intent photos ${label === "." ? "" : label}`.trimEnd());
    if (brand) {
      const library = attempt(indexFile, () => photoLibrary(brand.assets?.photos, JSON.parse(expected), name(brandFiles[0])));
      if (library) photoIds = library.map((p) => p.id);
    }
  }
  for (const issue of checkFiles({ brand, identity, formats, compositions, purposes, stories, places, time, people, groups, works, photos: photoIds })) {
    (issue.severity === "error" ? errors : warnings).push(`${issue.file}: ${issue.message}`);
  }
  return { errors, warnings, counts };
}
export {
  checkFolder,
  listPhotos,
  photoIndexText
};
