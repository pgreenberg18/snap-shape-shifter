/**
 * Entity normalization utilities for the Two-Phase Screenplay Intelligence System.
 * 
 * Phase 1 only — no stylistic interpretation.
 * Handles canonicalization, alias resolution, and cross-category validation.
 */

const APOSTROPHE_RE = /[''`´]/g;

// ─── Entity type constants ───────────────────────────────────────
export const ENTITY_TYPES = [
  "CHARACTER",
  "LOCATION",
  "VEHICLE",
  "PROP",
  "WARDROBE",
  "ANIMAL",
  "PRACTICAL_LIGHT_SOURCE",
  "SOUND_EVENT",
  "ENVIRONMENTAL_CONDITION",
  "DOCUMENT",
  "WEAPON",
  "DEVICE",
  "FOOD_OR_DRINK",
] as const;

export type EntityType = typeof ENTITY_TYPES[number];

export interface RawEntity {
  entity_type: EntityType;
  name: string;
  aliases?: string[];
  first_appearance_scene?: number;
  confidence?: number;
  metadata?: Record<string, unknown>;
  scene_context?: Record<string, unknown>;
}

export interface CanonicalEntity {
  entity_type: EntityType;
  canonical_name: string;
  aliases: string[];
  first_appearance_scene: number | null;
  confidence: number;
  needs_review: boolean;
  review_note: string | null;
  metadata: Record<string, unknown>;
}

// ─── Normalization helpers ───────────────────────────────────────

export function normalizeApostrophes(value: string): string {
  return value.replace(APOSTROPHE_RE, "'").replace(/\s+/g, " ").trim();
}

function normalizeKey(value: string): string {
  return normalizeApostrophes(value).toUpperCase().replace(/\s+/g, " ").trim();
}

// ─── Character canonicalization ──────────────────────────────────

const TITLE_RE = /^(DR\.?|MR\.?|MRS\.?|MS\.?|MISS|PROFESSOR|PROF\.?|CAPTAIN|CAPT\.?|DETECTIVE|DET\.?|OFFICER|AGENT|REVEREND|REV\.?|FATHER|SISTER|BROTHER|SERGEANT|SGT\.?|LIEUTENANT|LT\.?|GENERAL|GEN\.?|COLONEL|COL\.?|MAJOR|MAJ\.?|CORPORAL|CPL\.?|PRIVATE|PVT\.?|JUDGE|SENATOR|GOVERNOR|GOV\.?|PRESIDENT|KING|QUEEN|PRINCE|PRINCESS|LORD|LADY|SIR|DAME)\s+/i;

/**
 * Resolve character aliases to a canonical name.
 * First full-name appearance defines canonical.
 * Title + surname resolves to canonical.
 */
export function canonicalizeCharacters(rawNames: { name: string; scene: number }[]): CanonicalEntity[] {
  const groups = new Map<string, { canonical: string; aliases: Set<string>; firstScene: number; confidence: number; needsReview: boolean; reviewNote: string | null }>();

  // Sort by scene order so first appearance is deterministic
  const sorted = [...rawNames].sort((a, b) => a.scene - b.scene);

  for (const { name, scene } of sorted) {
    const normalized = normalizeApostrophes(name).toUpperCase();
    if (!normalized || normalized.length < 2) continue;

    // Strip parenthetical extensions like (V.O.), (O.S.), (CONT'D)
    const clean = normalized.replace(/\s*\(.*?\)\s*/g, "").trim();
    if (!clean) continue;

    // Extract title and base name
    const titleMatch = clean.match(TITLE_RE);
    const withoutTitle = titleMatch ? clean.replace(TITLE_RE, "").trim() : clean;
    const parts = withoutTitle.split(/\s+/);
    const lastName = parts[parts.length - 1];
    const firstName = parts[0];

    // Try to find an existing group this name belongs to
    let foundKey: string | null = null;

    for (const [key, group] of groups) {
      const existingClean = group.canonical.replace(TITLE_RE, "").trim();
      const existingParts = existingClean.split(/\s+/);
      const existingLast = existingParts[existingParts.length - 1];
      const existingFirst = existingParts[0];

      // Exact match
      if (normalizeKey(clean) === normalizeKey(group.canonical)) {
        foundKey = key;
        break;
      }

      // Title + surname match (e.g. "DR. WELLS" → "HOWARD WELLS")
      if (titleMatch && parts.length === 1 && existingLast === lastName && existingParts.length > 1) {
        foundKey = key;
        break;
      }

      // First name only match (if unambiguous — only one character with that first name)
      if (parts.length === 1 && existingFirst === firstName && existingParts.length > 1) {
        // Check ambiguity: are there other groups with this first name?
        let ambiguous = false;
        for (const [otherKey, otherGroup] of groups) {
          if (otherKey === key) continue;
          const otherClean = otherGroup.canonical.replace(TITLE_RE, "").trim();
          const otherFirst = otherClean.split(/\s+/)[0];
          if (otherFirst === firstName) {
            ambiguous = true;
            break;
          }
        }
        if (!ambiguous) {
          foundKey = key;
          break;
        }
      }

      // Surname only match with existing full name
      if (parts.length === 1 && existingLast === clean && existingParts.length > 1) {
        foundKey = key;
        break;
      }

      // Check if this is a longer version of an existing single-name entry
      if (existingParts.length === 1 && parts.length > 1 && firstName === existingFirst) {
        foundKey = key;
        break;
      }
    }

    if (foundKey) {
      const group = groups.get(foundKey)!;
      group.aliases.add(clean);
      // If this name is longer (more specific), promote it to canonical
      if (clean.length > group.canonical.length && parts.length > group.canonical.split(/\s+/).length) {
        group.aliases.add(group.canonical);
        group.canonical = clean;
      }
    } else {
      // New character
      const key = normalizeKey(clean);
      groups.set(key, {
        canonical: clean,
        aliases: new Set([clean]),
        firstScene: scene,
        confidence: 1.0,
        needsReview: false,
        reviewNote: null,
      });
    }
  }

  return Array.from(groups.values()).map((g) => ({
    entity_type: "CHARACTER" as EntityType,
    canonical_name: g.canonical,
    aliases: Array.from(g.aliases).filter((a) => a !== g.canonical),
    first_appearance_scene: g.firstScene,
    confidence: g.confidence,
    needs_review: g.needsReview,
    review_note: g.reviewNote,
    metadata: {},
  }));
}

// ─── Vehicle detection ───────────────────────────────────────────

const VEHICLE_KEYWORDS = new Set([
  "CAR", "TRUCK", "VAN", "BUS", "SUV", "SEDAN", "PICKUP", "MOTORCYCLE",
  "BIKE", "BICYCLE", "TAXI", "CAB", "LIMO", "LIMOUSINE", "CONVERTIBLE",
  "COUPE", "AMBULANCE", "FIRE TRUCK", "POLICE CAR", "SQUAD CAR",
  "TESLA", "MIATA", "CORVETTE", "MUSTANG", "FERRARI", "PORSCHE",
  "MERCEDES", "BMW", "AUDI", "TOYOTA", "HONDA", "NISSAN", "FORD",
  "CHEVY", "CHEVROLET", "JEEP", "BOAT", "YACHT", "HELICOPTER",
  "PLANE", "AIRPLANE", "JET", "TRAIN", "SUBWAY", "SCOOTER", "ATV",
  "RV", "MOTORHOME", "MINIVAN", "HATCHBACK", "WAGON",
]);

/** Items that contain vehicle keywords but aren't vehicles */
const VEHICLE_EXCLUSIONS = [
  /\bCAR\s+DOOR\b/i, /\bCAR\s+SEAT\b/i, /\bCAR\s+KEY/i,
  /\bCAR\s+ALARM/i, /\bCAR\s+RADIO/i, /\bCAR\s+SPEAKER/i,
  /\bCAR\s+PHONE/i, /\bCAR\s+JACK/i, /\bCAR\s+BATTERY/i,
  /\bCAR\s+WINDOW/i, /\bCAR\s+TRUNK/i, /\bCAR\s+HOOD/i,
  /\bTRAIN\s+TRACK/i, /\bTRAIN\s+STATION/i,
  /\bBUS\s+STOP/i, /\bBUS\s+STATION/i,
  /\bBIKE\s+RACK/i, /\bBIKE\s+LOCK/i,
];

export function isVehicleEntity(name: string): boolean {
  const upper = normalizeApostrophes(name).toUpperCase();
  if (VEHICLE_EXCLUSIONS.some((p) => p.test(upper))) return false;
  // Strip possessive prefix
  const stripped = upper.replace(/^[A-Z0-9'\-]+['']S\s+/, "").trim();
  const words = stripped.split(/\s+/);
  return words.some((w) => VEHICLE_KEYWORDS.has(w));
}

// ─── Weapon detection ────────────────────────────────────────────

const WEAPON_KEYWORDS = new Set([
  "GUN", "PISTOL", "REVOLVER", "RIFLE", "SHOTGUN", "HANDGUN",
  "KNIFE", "SWORD", "DAGGER", "AXE", "MACHETE", "BAT", "CROWBAR",
  "GRENADE", "BOMB", "EXPLOSIVE", "TASER", "PEPPER SPRAY",
  "BOW", "CROSSBOW", "SPEAR", "LANCE", "MACE", "HAMMER",
  "SNIPER", "ASSAULT RIFLE", "MACHINE GUN", "SUBMACHINE",
]);

/** Items containing weapon keywords but aren't weapons */
const WEAPON_EXCLUSIONS = [
  /\bELECTRON\s+GUN/i, /\bSTAPLE\s*GUN/i, /\bGLUE\s*GUN/i,
  /\bSPRAY\s*GUN/i, /\bHEAT\s*GUN/i, /\bNAIL\s*GUN/i,
  /\bRADAR\s*GUN/i, /\bCATHODE/i,
];

export function isWeaponEntity(name: string): boolean {
  const upper = normalizeApostrophes(name).toUpperCase();
  if (WEAPON_EXCLUSIONS.some((p) => p.test(upper))) return false;
  const words = upper.split(/\s+/);
  return words.some((w) => WEAPON_KEYWORDS.has(w));
}

// ─── Practical light detection ───────────────────────────────────

const LIGHT_KEYWORDS = new Set([
  "LAMP", "LANTERN", "CANDLE", "FLASHLIGHT", "TORCH", "CHANDELIER",
  "SCONCE", "NEON SIGN", "NEON", "STREETLIGHT", "HEADLIGHTS",
  "DESK LAMP", "FLOOR LAMP", "TABLE LAMP", "SPOTLIGHT", "CAMPFIRE",
  "FIREPLACE", "MATCH", "LIGHTER", "LED", "LIGHTBULB",
]);

export function isLightEntity(name: string): boolean {
  const upper = normalizeApostrophes(name).toUpperCase();
  return LIGHT_KEYWORDS.has(upper) || Array.from(LIGHT_KEYWORDS).some((k) => upper.includes(k));
}

// ─── Document detection ──────────────────────────────────────────

const DOCUMENT_KEYWORDS = new Set([
  "LETTER", "NOTE", "JOURNAL", "DIARY", "NEWSPAPER", "MAGAZINE",
  "BOOK", "FOLDER", "ENVELOPE", "MAP", "PHOTOGRAPH", "PHOTO",
  "CONTRACT", "WILL", "TESTAMENT", "CERTIFICATE", "LICENSE", "PASSPORT",
  "BADGE", "WARRANT", "SUBPOENA", "REPORT", "MANUSCRIPT",
  "NOTEBOOK", "POSTCARD", "TELEGRAM", "RECEIPT",
]);

/** Items with document keywords that aren't really documents */
const DOCUMENT_EXCLUSIONS = [
  /\bCALLER\s+ID\b/i, /\bSOUND\s+FILE\b/i, /\bPOLICE\s+BADGE\b/i,
  /\bPICTURE\s+BOOK/i, /\bNOTE\s*PAD\b/i,
];

export function isDocumentEntity(name: string): boolean {
  const upper = normalizeApostrophes(name).toUpperCase();
  if (DOCUMENT_EXCLUSIONS.some((p) => p.test(upper))) return false;
  const words = upper.split(/\s+/);
  // Don't match single ambiguous words like "ID", "FILE", "NOTE" when they're modifiers
  const AMBIGUOUS_DOC_WORDS = new Set(["ID", "FILE", "NOTE", "SCRIPT"]);
  if (words.length >= 2 && words.some((w) => AMBIGUOUS_DOC_WORDS.has(w))) {
    // Only match if the ambiguous word is the LAST word (the noun), not a modifier
    const lastWord = words[words.length - 1];
    if (!AMBIGUOUS_DOC_WORDS.has(lastWord) && !DOCUMENT_KEYWORDS.has(lastWord)) return false;
  }
  return words.some((w) => DOCUMENT_KEYWORDS.has(w));
}

// ─── Device detection ────────────────────────────────────────────

const DEVICE_KEYWORDS = new Set([
  "PHONE", "CELLPHONE", "CELL PHONE", "SMARTPHONE", "LAPTOP", "COMPUTER",
  "TABLET", "RADIO", "WALKIE-TALKIE", "CAMERA", "TV", "TELEVISION",
  "MONITOR", "PROJECTOR", "RECORDER", "MICROPHONE", "SPEAKER",
  "EARPIECE", "HEADPHONES", "GPS", "DRONE", "REMOTE",
]);

export function isDeviceEntity(name: string): boolean {
  const upper = normalizeApostrophes(name).toUpperCase();
  const words = upper.split(/\s+/);
  return words.some((w) => DEVICE_KEYWORDS.has(w));
}

// ─── Food/Drink detection ────────────────────────────────────────

const FOOD_KEYWORDS = new Set([
  "BEER", "WINE", "WHISKEY", "BOURBON", "SCOTCH",
  "VODKA", "COCKTAIL", "DRINK", "SANDWICH",
  "PIZZA", "BURGER", "FOOD", "MEAL", "MUG",
  "JUICE", "SODA", "CHAMPAGNE", "MARTINI", "CIGARETTE",
  "MUFFIN", "HOT DOG", "HASH BROWNS", "TAKEOUT",
]);

/** Full-phrase food patterns (avoids matching "coffee table", "ocean water", etc.) */
const FOOD_PHRASE_PATTERNS = [
  /\bCOFFEE\b(?!\s+TABLE|\s+SHOP|\s+HOUSE)/i,
  /\bTEA\b(?!\s+SET|\s+PARTY|\s+ROOM)/i,
  /\bWATER\b(?!\s+HEATER|\s+TANK|\s+PIPE|\s+MAIN|\s+DAMAGE)/i,
  /\bGLASS\s+OF\b/i,
  /\bBOTTLE\s+OF\b/i,
  /\bCUP\s+OF\b/i,
  /\bPLATE\s+OF\b/i,
];

/** Items that look like food keywords but aren't food */
const FOOD_EXCLUSION_PATTERNS = [
  /\bTABLE\b/i, /\bBREWER\b/i, /\bMACHINE\b/i, /\bMAKER\b/i,
  /\bSMASHING\b/i, /\bFRAMED?\b/i, /\bOCEAN\b/i, /\bSEA\b/i,
  /\bCOLLECTION\b/i, /\bVIAL/i, /\bCARTON/i,
];

export function isFoodEntity(name: string): boolean {
  const upper = normalizeApostrophes(name).toUpperCase();

  // Check exclusion patterns first — if any match, NOT food
  if (FOOD_EXCLUSION_PATTERNS.some((p) => p.test(upper))) return false;

  const words = upper.split(/\s+/);
  // Direct keyword match (only unambiguous food words)
  if (words.some((w) => FOOD_KEYWORDS.has(w))) return true;
  // Phrase-level patterns for ambiguous words
  if (FOOD_PHRASE_PATTERNS.some((p) => p.test(upper))) return true;
  return false;
}

// ─── Cross-category classification ──────────────────────────────

/**
 * Types where the AI classification should be trusted unless we have
 * high-confidence keyword evidence to the contrary.
 * For these types, keyword reclassification only happens if the
 * keyword match is unambiguous (not blocked by exclusions).
 */
const AI_TRUSTED_TYPES = new Set<string>([
  "SOUND_EVENT", "ENVIRONMENTAL_CONDITION", "WARDROBE", "ANIMAL",
  "CHARACTER", "LOCATION",
]);

/**
 * Classify a raw entity name into the correct category.
 * Respects AI suggestion for trusted types unless keyword evidence is strong.
 * Enforces strict separation: vehicles never props, weapons never props, etc.
 */
export function classifyEntity(name: string, aiSuggestedType?: string): EntityType {
  // If AI gave a trusted type, only override for very clear misclassifications
  if (aiSuggestedType && AI_TRUSTED_TYPES.has(aiSuggestedType)) {
    // Only override trusted AI types for vehicle/weapon (most safety-critical)
    if (isVehicleEntity(name) && aiSuggestedType !== "LOCATION") return "VEHICLE";
    if (isWeaponEntity(name)) return "WEAPON";
    // Otherwise trust the AI
    if (ENTITY_TYPES.includes(aiSuggestedType as EntityType)) {
      return aiSuggestedType as EntityType;
    }
  }

  // For non-trusted AI types (PROP, DEVICE, DOCUMENT, FOOD_OR_DRINK, etc.),
  // apply keyword reclassification
  if (isVehicleEntity(name)) return "VEHICLE";
  if (isWeaponEntity(name)) return "WEAPON";
  if (isLightEntity(name)) return "PRACTICAL_LIGHT_SOURCE";
  if (isDocumentEntity(name)) return "DOCUMENT";
  if (isDeviceEntity(name)) return "DEVICE";
  if (isFoodEntity(name)) return "FOOD_OR_DRINK";

  // Trust AI suggestion if it passed keyword filters
  if (aiSuggestedType && ENTITY_TYPES.includes(aiSuggestedType as EntityType)) {
    return aiSuggestedType as EntityType;
  }

  return "PROP"; // default fallback
}

// ─── Location normalization ──────────────────────────────────────

const HEADING_PREFIX_RE = /^(?:INT\.?\/EXT\.?|I\/E\.?|INT\.?|EXT\.?)\s*[-–—.\s]*/i;
const TIME_SUFFIX_RE = /\s*[-–—]\s*(?:DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|AFTERNOON|LATER|CONTINUOUS|MOMENTS LATER|SAME|SAME TIME|A MOMENT LATER|NEXT MORNING|NEXT DAY)\s*$/i;
const CONTINUITY_RE = /[-–—]\s*(CONTINUOUS|LATER|SAME TIME|MOMENTS LATER|A MOMENT LATER|SAME|NEXT MORNING|NEXT DAY)\s*$/i;

export interface ParsedHeading {
  int_ext: string;
  location: string;
  sublocation: string | null;
  time_of_day: string;
  continuity_marker: string | null;
  is_flashback: boolean;
  is_dream: boolean;
  is_montage: boolean;
}

/**
 * Parse a scene heading deterministically into structured data.
 * No AI involved — pure regex extraction.
 */
export function parseSceneHeading(heading: string): ParsedHeading {
  const normalized = normalizeApostrophes(heading).trim();

  // Extract INT/EXT
  const intExtMatch = normalized.match(/^(INT\.?\/EXT\.?|I\/E\.?|INT\.?|EXT\.?)/i);
  const int_ext = intExtMatch ? intExtMatch[1].replace(".", "").replace("/", "/").toUpperCase() : "";

  // Extract continuity marker before stripping time
  const contMatch = normalized.match(CONTINUITY_RE);
  const continuity_marker = contMatch ? contMatch[1].toUpperCase() : null;

  // Extract time of day
  const timeMatch = normalized.match(/[-–—]\s*(DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|AFTERNOON)\b/i);
  const time_of_day = timeMatch ? timeMatch[1].toUpperCase() : "";

  // Extract location (strip prefix and time suffix)
  let location = normalized
    .replace(HEADING_PREFIX_RE, "")
    .replace(TIME_SUFFIX_RE, "")
    .replace(CONTINUITY_RE, "")
    .trim();

  // Check for sublocation (dash-separated)
  let sublocation: string | null = null;
  const dashParts = location.split(/\s*[-–—]\s*/);
  if (dashParts.length >= 2) {
    location = dashParts[0].trim();
    sublocation = dashParts.slice(1).join(" - ").trim();
    // If sublocation is a vehicle, keep it in the location
    if (isVehicleEntity(sublocation)) {
      location = `${location} - ${sublocation}`;
      sublocation = null;
    }
  }

  // Flags
  const upperHeading = normalized.toUpperCase();
  const is_flashback = /FLASHBACK|FLASH\s*BACK/i.test(upperHeading);
  const is_dream = /DREAM|NIGHTMARE|VISION|HALLUCINATION/i.test(upperHeading);
  const is_montage = /MONTAGE/i.test(upperHeading);

  return {
    int_ext,
    location,
    sublocation,
    time_of_day,
    continuity_marker,
    is_flashback,
    is_dream,
    is_montage,
  };
}

/**
 * Build canonical location entities from parsed headings.
 * Groups sublocations under parent locations.
 */
export function canonicalizeLocations(headings: { heading: string; scene: number }[]): CanonicalEntity[] {
  const locationGroups = new Map<string, {
    canonical: string;
    sublocations: Set<string>;
    firstScene: number;
    aliases: Set<string>;
  }>();

  for (const { heading, scene } of headings) {
    const parsed = parseSceneHeading(heading);
    if (!parsed.location) continue;

    const key = normalizeKey(parsed.location)
      .replace(/\bHOUSE\b/g, "HOME")
      .replace(/\bLAB\b/g, "LABORATORY");

    const existing = locationGroups.get(key);
    if (existing) {
      existing.aliases.add(parsed.location);
      if (parsed.sublocation) existing.sublocations.add(parsed.sublocation);
      // Promote longer name as canonical
      if (parsed.location.length > existing.canonical.length) {
        existing.aliases.add(existing.canonical);
        existing.canonical = parsed.location;
      }
    } else {
      const subs = new Set<string>();
      if (parsed.sublocation) subs.add(parsed.sublocation);
      locationGroups.set(key, {
        canonical: parsed.location,
        sublocations: subs,
        firstScene: scene,
        aliases: new Set([parsed.location]),
      });
    }
  }

  return Array.from(locationGroups.values()).map((g) => ({
    entity_type: "LOCATION" as EntityType,
    canonical_name: g.canonical,
    aliases: Array.from(g.aliases).filter((a) => a !== g.canonical),
    first_appearance_scene: g.firstScene,
    confidence: 1.0,
    needs_review: false,
    review_note: null,
    metadata: {
      sublocations: Array.from(g.sublocations),
    },
  }));
}

// ─── Dialogue metrics ────────────────────────────────────────────

export interface DialogueMetrics {
  line_count: number;
  dialogue_line_count: number;
  dialogue_word_count: number;
  dialogue_density: number;
}

/**
 * Count dialogue vs action lines and compute dialogue density.
 * Uses the screenplay line classifier.
 */
export function computeDialogueMetrics(rawText: string): DialogueMetrics {
  const lines = rawText.split("\n");
  const totalLines = lines.filter((l) => l.trim()).length;
  let dialogueLines = 0;
  let dialogueWords = 0;
  let lastType = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Scene heading
    if (/^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)/i.test(trimmed)) {
      lastType = "heading";
      continue;
    }

    // Parenthetical
    if (/^\(.*\)$/.test(trimmed)) {
      lastType = "parenthetical";
      continue;
    }

    // Character cue
    const isAllCaps = /^[A-Z][A-Z\s'.()\-/]+$/.test(trimmed);
    const isShort = trimmed.length < 45;
    const hasLower = /[a-z]/.test(trimmed);
    if (isAllCaps && isShort && !hasLower) {
      lastType = "character";
      continue;
    }

    // Dialogue (after character cue or continuing dialogue)
    if (lastType === "character" || lastType === "dialogue" || lastType === "parenthetical") {
      dialogueLines++;
      dialogueWords += trimmed.split(/\s+/).length;
      lastType = "dialogue";
      continue;
    }

    lastType = "action";
  }

  return {
    line_count: totalLines,
    dialogue_line_count: dialogueLines,
    dialogue_word_count: dialogueWords,
    dialogue_density: totalLines > 0 ? Math.round((dialogueLines / totalLines) * 100) / 100 : 0,
  };
}

// ─── Character cue extraction from raw text ──────────────────────

const NON_CHARACTER_CUES = new Set([
  "CUT TO", "FADE IN", "FADE OUT", "FADE TO", "FADE TO BLACK",
  "DISSOLVE TO", "SMASH CUT TO", "MATCH CUT TO", "THE END",
  "CONTINUED", "MORE", "END FLASHBACK", "FLASHBACK", "QUICK FLASHES",
  "MONTAGE", "MONTAGE ENDS", "END MONTAGE", "INTERCUT", "BACK TO SCENE",
  "SUPER", "TITLE CARD", "CHYRON", "SERIES OF SHOTS",
  "END CREDITS", "TITLE SEQUENCE", "OPENING CREDITS",
]);

/**
 * Extract character names from raw screenplay text using ALL-CAPS cue detection.
 * Returns name + scene number pairs for canonicalization.
 */
export function extractCharacterCues(rawText: string, sceneNumber: number): { name: string; scene: number }[] {
  const results: { name: string; scene: number }[] = [];
  const lines = rawText.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 2 || trimmed.length > 40) continue;

    // Remove parenthetical extensions
    const withoutExt = trimmed.replace(/\s*\(.*?\)\s*/g, "").trim();
    if (!withoutExt || withoutExt.length < 2) continue;

    // Must be all uppercase
    if (!/^[A-Z][A-Z\s\-'\.]+$/.test(withoutExt)) continue;
    if (withoutExt.includes(".")) continue;

    const upper = withoutExt.toUpperCase();
    if (upper.startsWith("INT") || upper.startsWith("EXT")) continue;
    if (NON_CHARACTER_CUES.has(upper) || upper.endsWith(":")) continue;
    if (!withoutExt.includes(" ") && withoutExt.length <= 3) continue;

    results.push({ name: withoutExt, scene: sceneNumber });
  }

  return results;
}
