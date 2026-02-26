import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, isResponse } from "../_shared/auth.ts";
import { logCreditUsage } from "../_shared/credit-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════════════
// GENRE VISUAL PROFILES — 22 deterministic genre → visual spec maps
// Each genre defines a COMPLETE visual specification so that NO
// dimension is left for the AI to randomly choose.
// ═══════════════════════════════════════════════════════════════════

interface GenreProfile {
  lighting: { default: string; fill_ratio: string; color_temp: string };
  color: { palette: string; saturation: string; contrast: string };
  texture: { grain: string; skin: string };
  framing: { default_lens: string; portrait_style: string };
  wardrobe_tone: string;
  location_tone: string;
  prop_tone: string;
  vehicle_tone: string;
  negative: string;
}

const GENRE_PROFILES: Record<string, GenreProfile> = {
  "Action": {
    lighting: { default: "Hard directional light, dramatic rim light", fill_ratio: "1:4", color_temp: "neutral 5600K" },
    color: { palette: "steel blue, amber fire, gunmetal gray, high contrast", saturation: "medium", contrast: "high" },
    texture: { grain: "clean but gritty, ARRI Alexa texture", skin: "sharp detail, sweat, dirt, pores visible" },
    framing: { default_lens: "35mm", portrait_style: "strong jaw emphasis, heroic angle, intense eye contact, confident stance" },
    wardrobe_tone: "tactical, fitted, functional, leather and dark neutrals, utility wear",
    location_tone: "industrial, urban, expansive, dynamic, concrete and metal",
    prop_tone: "metallic, functional, military-grade, weathered, industrial",
    vehicle_tone: "aggressive, muscular, performance-oriented, dark paint, aftermarket modifications",
    negative: "soft focus, pastel colors, romantic lighting, delicate, fragile, cozy, domestic",
  },
  "Adventure": {
    lighting: { default: "Golden natural light, dramatic sky exposure", fill_ratio: "1:3", color_temp: "warm 5000K" },
    color: { palette: "earth tones, golden amber, deep sky blue, jungle green", saturation: "high", contrast: "medium-high" },
    texture: { grain: "clean digital, vivid color rendition", skin: "natural, sun-kissed, healthy glow" },
    framing: { default_lens: "24mm wide", portrait_style: "heroic framing, eyes to horizon, windswept, determined expression" },
    wardrobe_tone: "rugged outdoor wear, layered, earth colors, weathered leather, practical boots",
    location_tone: "epic landscapes, ancient ruins, lush jungles, sweeping vistas",
    prop_tone: "weathered maps, compass, rope, expedition gear, ancient artifacts",
    vehicle_tone: "rugged, expedition-ready, dusty, well-traveled, off-road capable",
    negative: "sterile offices, fluorescent lighting, modern minimalism, clean white spaces",
  },
  "Animation": {
    lighting: { default: "Stylized even lighting with bold shadows", fill_ratio: "1:2", color_temp: "neutral 5500K" },
    color: { palette: "vibrant primaries, bold accents, clean separation", saturation: "very high", contrast: "medium" },
    texture: { grain: "clean digital, smooth gradients", skin: "smooth, idealized, clear complexion" },
    framing: { default_lens: "50mm", portrait_style: "clean composition, expressive features, bright eyes, character appeal" },
    wardrobe_tone: "bold colors, character-defining silhouettes, distinctive accessories",
    location_tone: "vibrant, stylized, fantastical, richly detailed environments",
    prop_tone: "colorful, exaggerated proportions, character-appropriate",
    vehicle_tone: "stylized, character-matching, fantastical elements welcome",
    negative: "gritty realism, desaturated, muted tones, harsh violence, photorealistic skin pores",
  },
  "Biographical": {
    lighting: { default: "Naturalistic available-light look, period-accurate fixtures", fill_ratio: "1:3", color_temp: "mixed practical 4500K" },
    color: { palette: "period-authentic muted tones, documentary realism, warm neutrals", saturation: "medium-low", contrast: "medium" },
    texture: { grain: "subtle film grain, documentary texture", skin: "natural, unretouched, authentic imperfections" },
    framing: { default_lens: "50mm", portrait_style: "intimate, observational, natural light on face, thoughtful expression" },
    wardrobe_tone: "historically accurate, well-researched period clothing, authentic fabrics",
    location_tone: "real locations preferred, historical accuracy, lived-in spaces",
    prop_tone: "period-accurate, museum-quality, authentic wear patterns",
    vehicle_tone: "period-correct, factory original condition, era-appropriate colors",
    negative: "stylized lighting, fantasy elements, modern anachronisms, glamorized",
  },
  "Comedy": {
    lighting: { default: "Bright, even, flattering sitcom-style lighting", fill_ratio: "1:1.5", color_temp: "warm 4800K" },
    color: { palette: "warm brights, cheerful yellows, clean whites, pops of color", saturation: "medium-high", contrast: "low" },
    texture: { grain: "clean digital, crisp and clear", skin: "smooth, clear, flattering" },
    framing: { default_lens: "35mm", portrait_style: "approachable, open expression, slight smile, relaxed posture" },
    wardrobe_tone: "casual, colorful, personality-revealing, slightly exaggerated",
    location_tone: "bright, well-lit, inviting, slightly larger-than-life domestic/urban",
    prop_tone: "everyday objects, potential comedic contrast, bright clean",
    vehicle_tone: "character-appropriate, possibly humorous mismatch, everyday cars",
    negative: "dark shadows, desaturated, moody, threatening, horror elements, extreme violence",
  },
  "Crime": {
    lighting: { default: "Low-key dramatic with motivated practicals, neon accents", fill_ratio: "1:6", color_temp: "cool 6000K with warm practicals" },
    color: { palette: "midnight blue, sodium orange, cold steel, deep shadow", saturation: "low-medium", contrast: "very high" },
    texture: { grain: "heavy grain, gritty digital noise", skin: "textured, weathered, hard-lived" },
    framing: { default_lens: "28mm", portrait_style: "shadowed face, morally ambiguous gaze, tension in jaw, guarded expression" },
    wardrobe_tone: "street-level, dark layers, leather jackets, worn denim, understated menace",
    location_tone: "urban decay, neon-lit streets, dimly lit interiors, industrial",
    prop_tone: "utilitarian, worn, evidence-like, metallic finishes",
    vehicle_tone: "dark paint, tinted windows, unmarked, menacing, blacked out",
    negative: "bright pastel colors, sunny cheerful, clean suburban, romantic soft focus",
  },
  "Docu-drama": {
    lighting: { default: "Available-light documentary feel, handheld energy", fill_ratio: "1:3", color_temp: "mixed 5200K" },
    color: { palette: "desaturated realism, muted earth tones, raw documentary palette", saturation: "low", contrast: "medium" },
    texture: { grain: "documentary grain, 16mm texture, slight motion blur", skin: "raw, unretouched, authentic" },
    framing: { default_lens: "28mm", portrait_style: "candid, caught in the moment, observational, imperfect framing" },
    wardrobe_tone: "authentic everyday clothing, non-performative, lived-in",
    location_tone: "real locations, unpolished, documentary authenticity",
    prop_tone: "everyday objects, unart-directed, authentic clutter",
    vehicle_tone: "everyday, unpolished, real-world condition, no hero treatment",
    negative: "glamorous lighting, stylized composition, fantasy elements, over-designed",
  },
  "Drama": {
    lighting: { default: "Naturalistic with motivated sources, emotional key lighting", fill_ratio: "1:3", color_temp: "warm 4800K" },
    color: { palette: "rich earth tones, warm amber, deep shadow, subtle warmth", saturation: "medium", contrast: "medium" },
    texture: { grain: "subtle 35mm grain, cinematic texture", skin: "natural, honest detail, subtle imperfections" },
    framing: { default_lens: "50mm", portrait_style: "intimate, emotionally present, deep eye contact, vulnerable strength" },
    wardrobe_tone: "character-authentic, understated, reveals social context",
    location_tone: "lived-in spaces, emotional atmosphere, naturalistic detail",
    prop_tone: "personal objects, emotionally significant, well-used",
    vehicle_tone: "character-appropriate, reveals economic status, realistic condition",
    negative: "over-stylized, glossy, commercial lighting, fantasy elements",
  },
  "Documentary": {
    lighting: { default: "Purely available light, zero artificial enhancement", fill_ratio: "natural", color_temp: "ambient" },
    color: { palette: "raw reality, whatever the environment provides", saturation: "low", contrast: "medium" },
    texture: { grain: "heavy documentary grain, 16mm or digital sensor noise", skin: "completely raw, untouched" },
    framing: { default_lens: "24mm", portrait_style: "caught in the moment, eye-level, direct, unposed" },
    wardrobe_tone: "whatever the subject actually wears, zero art direction",
    location_tone: "real locations only, no set dressing, raw environments",
    prop_tone: "found objects, real-world, zero styling",
    vehicle_tone: "real vehicles, no hero treatment, as-found condition",
    negative: "staged, art-directed, stylized, glamorous, cinematic lighting, posed",
  },
  "Fantasy": {
    lighting: { default: "Magical diffused light, ethereal rim glow, dramatic atmosphere", fill_ratio: "1:3", color_temp: "cool 7000K with warm magic accents" },
    color: { palette: "deep jewel tones, ethereal blues, mystical purples, ancient gold", saturation: "high", contrast: "medium-high" },
    texture: { grain: "clean digital with soft diffusion", skin: "otherworldly, luminous, slightly idealized" },
    framing: { default_lens: "35mm", portrait_style: "regal bearing, mysterious depth in eyes, otherworldly beauty, commanding presence" },
    wardrobe_tone: "ornate, handcrafted, rich fabrics, cloaks, armor, ancient textiles",
    location_tone: "enchanted forests, ancient castles, magical realms, epic landscapes",
    prop_tone: "mystical artifacts, ancient tomes, ornate weaponry, enchanted objects",
    vehicle_tone: "fantastical mounts, enchanted vessels, ancient war machines",
    negative: "modern technology, smartphones, cars, fluorescent lights, office settings, contemporary clothing",
  },
  "Historical": {
    lighting: { default: "Period-accurate lighting: candle, gas lamp, or early electric", fill_ratio: "1:4", color_temp: "warm 3500K candlelight to 4500K" },
    color: { palette: "aged sepia tones, oil painting warmth, muted period colors", saturation: "low-medium", contrast: "medium" },
    texture: { grain: "35mm film grain, slight vignette, period texture", skin: "period-authentic, weathered by era, no modern grooming" },
    framing: { default_lens: "40mm", portrait_style: "formal bearing, period-appropriate posture, dignified, eyes reflecting the era" },
    wardrobe_tone: "meticulously period-accurate, handmade fabrics, era-specific silhouettes",
    location_tone: "historically accurate architecture, period furnishings, candlelit interiors",
    prop_tone: "antique, period-manufactured, authentic materials, museum quality",
    vehicle_tone: "period-accurate, horse-drawn or early motor, restored to era condition",
    negative: "modern materials, plastic, LED lighting, contemporary design, anachronistic details",
  },
  "Horror": {
    lighting: { default: "Low-key, single hard source, deep impenetrable shadows", fill_ratio: "1:8", color_temp: "cold 6500K with sickly green undertone" },
    color: { palette: "desaturated teal, sickly green, deep black, dried crimson accents", saturation: "low", contrast: "extreme" },
    texture: { grain: "heavy 16mm grain, halation on highlights, film damage artifacts", skin: "textured, pores visible, pallid, imperfections emphasized" },
    framing: { default_lens: "24mm wide", portrait_style: "slightly distorted, unsettling angle, cold empty eyes, vulnerability behind dread" },
    wardrobe_tone: "muted, worn, fraying, dark fabrics, stained, practical survival clothing",
    location_tone: "decayed, isolated, poorly lit, claustrophobic, abandoned, threatening",
    prop_tone: "weathered, ominous, rusted, decayed, organic horror elements",
    vehicle_tone: "abandoned, rusted, broken-down, isolated on empty roads, sinister",
    negative: "bright colors, clean modern spaces, glamorous, fashion photography, warm and inviting, cheerful",
  },
  "Musical": {
    lighting: { default: "Theatrical spotlight with colored gels, stage-inspired", fill_ratio: "1:2", color_temp: "warm theatrical 4000K with color accents" },
    color: { palette: "saturated theatrical colors, spotlight white, rich stage tones", saturation: "very high", contrast: "medium-high" },
    texture: { grain: "clean, glossy, polished", skin: "flawless, stage-ready, glowing under lights" },
    framing: { default_lens: "35mm", portrait_style: "theatrical expression, dynamic pose, performance energy, spotlight catchlights" },
    wardrobe_tone: "costumes, sequins, bold fabrics, performance wear, character-defining outfits",
    location_tone: "stages, grand interiors, streets transformed by performance, fantastical sets",
    prop_tone: "instruments, performance props, theatrical, oversized for stage visibility",
    vehicle_tone: "showpiece vehicles, polished, parade-ready, character statement pieces",
    negative: "drab, gray, mundane, documentary, gritty realism, muted tones",
  },
  "Mystery": {
    lighting: { default: "Pools of light in darkness, motivated sources only, strategic shadows", fill_ratio: "1:5", color_temp: "cool 5800K" },
    color: { palette: "fog gray, deep navy, aged paper, amber lamplight, muted olive", saturation: "low-medium", contrast: "high" },
    texture: { grain: "subtle grain, slightly desaturated", skin: "natural with deep shadows, mysterious, partially obscured" },
    framing: { default_lens: "50mm", portrait_style: "half-lit face, searching eyes, suspicious or contemplative, secrets behind expression" },
    wardrobe_tone: "layered, muted tones, trench coats, buttoned-up, concealing",
    location_tone: "fog-shrouded, dimly lit libraries, rain-slicked streets, enclosed spaces",
    prop_tone: "clue-like objects, magnifying details, old letters, keys, evidence",
    vehicle_tone: "understated, dark, anonymous, fog-shrouded, parked in shadows",
    negative: "bright sunshine, bold colors, wide open spaces, cheerful, transparent",
  },
  "Noir": {
    lighting: { default: "Extreme chiaroscuro, venetian blind shadows, single hard source", fill_ratio: "1:10", color_temp: "cool 6500K with warm practicals" },
    color: { palette: "black and white tones, deep shadow, silver highlights, cigarette amber", saturation: "very low (near monochrome)", contrast: "extreme" },
    texture: { grain: "heavy classic film grain, sharp contrast, deep blacks", skin: "high contrast, dramatic shadow play across face" },
    framing: { default_lens: "35mm", portrait_style: "half-shadow, venetian blind light across face, cigarette smoke, femme fatale elegance or hard-boiled stoicism" },
    wardrobe_tone: "sharp suits, fedoras, pencil skirts, fur stoles, 1940s tailoring",
    location_tone: "rain-slicked alleys, smoky bars, neon-lit offices, venetian blinds",
    prop_tone: "cigarettes, whiskey glasses, revolvers, typewriters, folded newspapers",
    vehicle_tone: "1940s sedans, polished chrome, dark paint, rain-beaded, noir streetscapes",
    negative: "bright colors, sunshine, modern technology, cheerful, clean, contemporary",
  },
  "Romance": {
    lighting: { default: "Soft, warm, flattering key light with gentle fill", fill_ratio: "1:2", color_temp: "warm golden 4200K" },
    color: { palette: "warm pastels, soft gold, blush pink, champagne, honey amber", saturation: "medium-high", contrast: "low" },
    texture: { grain: "clean digital, minimal grain, soft-focus edges", skin: "smooth, warm, flattering, soft-focus" },
    framing: { default_lens: "85mm", portrait_style: "soft bokeh, warm tones, inviting expression, gentle eye contact, romantic vulnerability" },
    wardrobe_tone: "fashionable, approachable, soft fabrics, flowing silhouettes, warm colors",
    location_tone: "sunlit cafes, garden paths, cozy apartments, scenic overlooks, golden hour",
    prop_tone: "flowers, letters, wine glasses, personal keepsakes, warm beverages",
    vehicle_tone: "charming, vintage convertibles, taxis in rain, scenic road trips",
    negative: "harsh shadows, desaturated, gritty, dirty, industrial, weapons, dark atmosphere, blood",
  },
  "Satire": {
    lighting: { default: "Slightly over-lit, institutional, uncomfortably even", fill_ratio: "1:1", color_temp: "cool fluorescent 5500K" },
    color: { palette: "hyperreal, slightly off colors, institutional beige, artificial green", saturation: "medium", contrast: "low-medium" },
    texture: { grain: "clean digital, almost too crisp", skin: "unflattering detail, every pore, no glamour" },
    framing: { default_lens: "28mm wide", portrait_style: "slightly unflattering, observational, deadpan expression, uncomfortable framing" },
    wardrobe_tone: "ill-fitting suits, corporate uniforms, slightly absurd, too-perfect or too-wrong",
    location_tone: "sterile offices, suburban sameness, institutional corridors, artificial spaces",
    prop_tone: "corporate items, bureaucratic tools, absurdly ordinary objects",
    vehicle_tone: "generic sedans, identical fleet vehicles, suburban minivans",
    negative: "heroic, glamorous, romantic, cinematic beauty, epic landscapes",
  },
  "Sci-Fi": {
    lighting: { default: "Futuristic cool-toned with colored accent lights, holographic glow", fill_ratio: "1:3", color_temp: "cold blue 7500K with neon accents" },
    color: { palette: "electric blue, cold white, neon cyan, obsidian black, chrome silver", saturation: "medium", contrast: "high" },
    texture: { grain: "clean, ultra-sharp digital, lens flares", skin: "clean, sharp, slightly futuristic grooming" },
    framing: { default_lens: "35mm", portrait_style: "futuristic framing, reflections in visor or glass, technological glow, forward-looking gaze" },
    wardrobe_tone: "futuristic, technical fabrics, jumpsuits, augmented accessories, clean lines",
    location_tone: "spaceship interiors, futuristic cities, labs, alien landscapes, sterile corridors",
    prop_tone: "holographic devices, futuristic tools, alien artifacts, chrome surfaces",
    vehicle_tone: "futuristic transports, sleek spacecraft, hover vehicles, technological",
    negative: "medieval, rustic, old-fashioned, candlelight, wooden, pastoral, historical",
  },
  "Supernatural": {
    lighting: { default: "Otherworldly motivated light, unexplained sources, ethereal rim", fill_ratio: "1:5", color_temp: "cool blue 6800K with warm unexplained accents" },
    color: { palette: "spectral blue, ghostly pale, deep purple shadow, eerie green", saturation: "low-medium", contrast: "high" },
    texture: { grain: "subtle grain with lens aberrations, halation", skin: "pale, slightly translucent quality, otherworldly" },
    framing: { default_lens: "35mm", portrait_style: "unsettling calm, eyes that know too much, slight tilt, between worlds" },
    wardrobe_tone: "period or contemporary but slightly wrong, anachronistic details, spectral",
    location_tone: "liminal spaces, old houses, graveyards, fog-bound, between-worlds feeling",
    prop_tone: "religious artifacts, old photographs, candles, mirrors, objects of ritual",
    vehicle_tone: "old, slightly anachronistic, parked in fog, headlights in darkness",
    negative: "bright sunshine, modern tech-forward, cheerful, colorful, clean contemporary",
  },
  "Thriller": {
    lighting: { default: "Tense motivated sources, pools of light, paranoid shadow", fill_ratio: "1:5", color_temp: "cool clinical 5800K" },
    color: { palette: "cold steel, washed out fluorescent, tension amber, paranoid green", saturation: "low", contrast: "high" },
    texture: { grain: "subtle grain, sharp clinical detail", skin: "stressed, tight, tension visible, slight sheen of sweat" },
    framing: { default_lens: "40mm", portrait_style: "tight framing, paranoid glancing eyes, hunted expression, cognitive intensity" },
    wardrobe_tone: "layers, coats, business attire under pressure, wrinkled, loosened ties",
    location_tone: "parking garages, empty corridors, surveillance rooms, rain-lashed windows",
    prop_tone: "phones, documents, keys, surveillance equipment, classified files",
    vehicle_tone: "anonymous sedans, pursuit vehicles, unmarked cars, rain-streaked",
    negative: "bright happy colors, pastoral, relaxed, spacious, tropical, peaceful",
  },
  "War": {
    lighting: { default: "Harsh overexposed daylight or dim bunker practicals", fill_ratio: "1:6", color_temp: "bleached 6000K daylight or warm 3500K bunker" },
    color: { palette: "olive drab, bleached sky, mud brown, blood-rust, smoke gray", saturation: "very low", contrast: "high" },
    texture: { grain: "heavy grain, war correspondent film stock, combat camera", skin: "dirty, sunburned, exhausted, scarred, unwashed" },
    framing: { default_lens: "28mm", portrait_style: "thousand-yard stare, dirt-caked face, exhaustion, determination under duress" },
    wardrobe_tone: "military uniforms, field gear, helmets, boots, mud-caked, combat-worn",
    location_tone: "trenches, bombed-out buildings, field camps, mud, smoke, devastation",
    prop_tone: "military equipment, maps, rations, dogtags, weathered gear",
    vehicle_tone: "military vehicles, tanks, jeeps, transport trucks, battle-damaged",
    negative: "clean, glamorous, bright colors, peaceful, modern luxury, romantic",
  },
  "Western": {
    lighting: { default: "Harsh overhead sunlight, deep hat shadows, golden dust-hour", fill_ratio: "1:5", color_temp: "warm dusty 5200K" },
    color: { palette: "desert ochre, weathered leather brown, sun-bleached blue, dusty amber", saturation: "medium", contrast: "high" },
    texture: { grain: "35mm film grain, dusty atmosphere, hot haze", skin: "sun-weathered, leathery, dust-covered, wind-burned" },
    framing: { default_lens: "28mm wide", portrait_style: "squinting against sun, hat shadow across eyes, weathered stoicism, frontier grit" },
    wardrobe_tone: "leather, denim, boots, spurs, hats, bandanas, gun belts, dust-covered",
    location_tone: "vast desert, frontier towns, saloons, canyons, prairie, dusty main streets",
    prop_tone: "revolvers, saddles, whiskey bottles, playing cards, wanted posters, rope",
    vehicle_tone: "horses, stagecoaches, wagons, early trains, dusty and trail-worn",
    negative: "modern technology, urban, neon, clean, futuristic, contemporary fashion",
  },
};

// Fallback for genres not in the dictionary
const DEFAULT_PROFILE = GENRE_PROFILES["Drama"];

// ═══════════════════════════════════════════════════
// RATING MODIFIERS — MPAA rating → visual treatment
// ═══════════════════════════════════════════════════

interface RatingModifier {
  skin_detail: string;
  violence_visual: string;
  lighting_intensity: string;
  color_boost: string;
  wardrobe_modifier: string;
  negative_additions: string;
}

const RATING_MODIFIERS: Record<string, RatingModifier> = {
  "G": {
    skin_detail: "minimal detail, idealized, smooth, clean complexion",
    violence_visual: "none",
    lighting_intensity: "reduce contrast 20%, softer shadows",
    color_boost: "increase saturation 15%, warmer tones, inviting",
    wardrobe_modifier: "conservative, fully covered, bright cheerful colors",
    negative_additions: "revealing clothing, scars, tattoos, blood, weapons, alcohol, cigarettes, violence, injury",
  },
  "PG": {
    skin_detail: "natural but soft, minimal blemishes",
    violence_visual: "implied only, no direct depiction",
    lighting_intensity: "standard, avoid extreme contrast",
    color_boost: "standard, slightly warm",
    wardrobe_modifier: "casual appropriate, family-friendly",
    negative_additions: "revealing clothing, graphic injury, heavy weapons, blood",
  },
  "PG-13": {
    skin_detail: "natural, realistic, subtle imperfections",
    violence_visual: "moderate, stylized, consequences shown",
    lighting_intensity: "standard",
    color_boost: "standard",
    wardrobe_modifier: "context appropriate, moderate",
    negative_additions: "nudity, graphic gore, extreme violence",
  },
  "R": {
    skin_detail: "hyper-realistic, authentic imperfections, pores and texture",
    violence_visual: "realistic, consequential, unflinching",
    lighting_intensity: "increase contrast 15%, deeper shadows",
    color_boost: "desaturate 10%, rawer tones",
    wardrobe_modifier: "unrestricted, authentic to character and situation",
    negative_additions: "",
  },
  "NR": {
    skin_detail: "unrestricted",
    violence_visual: "unrestricted",
    lighting_intensity: "unrestricted",
    color_boost: "unrestricted",
    wardrobe_modifier: "unrestricted",
    negative_additions: "",
  },
};

// ═══════════════════════════════════════════════════
// DAY/NIGHT → COLOR TEMPERATURE GRADE MAPPING
// ═══════════════════════════════════════════════════

const TIME_OF_DAY_GRADES: Record<string, string> = {
  "day": "Daylight 5600K, neutral white balance",
  "night": "Cool blue 4000K moonlight, warm 2800K practicals",
  "dawn": "Soft pink-orange 3500K, low-angle golden light",
  "dusk": "Deep amber 3200K, long shadows, warm sky",
  "morning": "Clean warm 5200K, fresh light quality",
  "evening": "Rich amber 4000K, settling warmth",
  "afternoon": "Harsh overhead 5800K, minimal shadow",
};

// ═══════════════════════════════════════════════════
// BLENDING ALGORITHM — Multi-genre weighted merge
// ═══════════════════════════════════════════════════

function blendGenreProfiles(genres: string[]): GenreProfile {
  if (!genres || genres.length === 0) return DEFAULT_PROFILE;
  if (genres.length === 1) return GENRE_PROFILES[genres[0]] || DEFAULT_PROFILE;

  const primary = GENRE_PROFILES[genres[0]] || DEFAULT_PROFILE;
  const secondary = GENRE_PROFILES[genres[1]] || DEFAULT_PROFILE;

  // Primary wins on structural properties (lighting, texture, framing)
  // Secondary contributes color influence and extends negatives
  return {
    lighting: primary.lighting,
    color: {
      palette: `${primary.color.palette}; secondary influence: ${secondary.color.palette}`,
      saturation: primary.color.saturation,
      contrast: primary.color.contrast,
    },
    texture: primary.texture,
    framing: primary.framing,
    wardrobe_tone: `${primary.wardrobe_tone}. Secondary influence: ${secondary.wardrobe_tone}`,
    location_tone: `${primary.location_tone}. Secondary influence: ${secondary.location_tone}`,
    prop_tone: `${primary.prop_tone}. ${secondary.prop_tone} elements`,
    vehicle_tone: `${primary.vehicle_tone}. ${secondary.vehicle_tone} influences`,
    // UNION all negatives — strictest combination
    negative: [...new Set([
      ...primary.negative.split(", "),
      ...secondary.negative.split(", "),
      // Third genre negatives if present
      ...(genres[2] ? (GENRE_PROFILES[genres[2]]?.negative || "").split(", ") : []),
    ])].join(", "),
  };
}

// ═══════════════════════════════════════════════════
// CONTENT SAFETY → MPAA RATING DERIVATION
// ═══════════════════════════════════════════════════

function deriveSafetyLevel(safety: { violence: boolean; nudity: boolean; language: boolean } | null): string {
  if (!safety) return "PG";
  const count = [safety.violence, safety.nudity, safety.language].filter(Boolean).length;
  if (count >= 2) return "R";
  if (safety.violence || safety.nudity) return "PG-13";
  if (safety.language) return "PG-13";
  return "PG";
}

// ═══════════════════════════════════════════════════
// CHARACTER ARCHETYPE → PORTRAIT DIRECTIVE
// ═══════════════════════════════════════════════════

function buildCharacterDirective(
  charName: string,
  sex: string | null,
  isChild: boolean,
  description: string | null,
  genreProfile: GenreProfile,
  rating: string,
  genres: string[],
): string {
  const isFemale = (sex || "").toLowerCase() === "female";
  const isMale = (sex || "").toLowerCase() === "male";
  const ratingMod = RATING_MODIFIERS[rating] || RATING_MODIFIERS["PG-13"];

  let directive = genreProfile.framing.portrait_style;

  // Genre × gender × role archetype modifiers
  if (genres.includes("Romance") || genres.includes("Romantic Comedy")) {
    if (isFemale) {
      directive += ". Warm, approachable expression. Soft catchlights in eyes. Natural makeup look. Hair styled but effortless. Magazine-quality but relatable.";
    } else if (isMale) {
      directive += ". Warm but slightly guarded smile. Charming without trying. Soft natural light on face. Approachable masculinity.";
    }
  } else if (genres.includes("Horror")) {
    if (isFemale) {
      directive += ". Vulnerable but determined expression. Minimal makeup, natural skin. Slightly disheveled. Cold ambient light. Survival instinct in eyes.";
    } else if (isMale) {
      directive += ". Haunted eyes, barely suppressed dread. Unshaven, dark circles. Cold blue light rimming face. Tension in jaw.";
    }
  } else if (genres.includes("Action")) {
    if (isFemale) {
      directive += ". Confident, steely gaze. Athletic build emphasis. Practical hair. Strong jawline lighting. Battle-ready posture.";
    } else if (isMale) {
      directive += ". Hard, focused stare. Strong neck and jaw. Tactical readiness. Slight forward lean. Controlled intensity.";
    }
  } else if (genres.includes("Noir") || genres.includes("Crime")) {
    if (isFemale) {
      directive += ". Mysterious half-shadow. Red lips, smoky eyes. Dramatic side lighting. Venetian blind shadows. Femme fatale elegance.";
    } else if (isMale) {
      directive += ". Hard-boiled stoicism. Hat shadow across brow. Cigarette-era jawline. World-weary eyes. Trench coat collar up.";
    }
  } else if (genres.includes("Sci-Fi")) {
    directive += ". Futuristic grooming. Holographic or technological light reflection. Forward-looking clarity in eyes. Clean precise features.";
  } else if (genres.includes("Fantasy")) {
    directive += ". Otherworldly quality. Ethereal light on skin. Regal or mystical bearing. Ancient wisdom or wild courage in eyes.";
  } else if (genres.includes("War")) {
    directive += ". Exhaustion and resolve. Dirt on face. Harsh daylight or dim bunker light. Thousand-yard stare softened by humanity.";
  } else if (genres.includes("Western")) {
    directive += ". Squinting against sun. Weathered, sun-lined face. Hat shadow. Frontier stoicism. Dust in the creases.";
  }

  // Rating modifier for skin/wardrobe
  directive += `. Skin detail: ${ratingMod.skin_detail}. Wardrobe direction: ${ratingMod.wardrobe_modifier}.`;

  // Child override
  if (isChild) {
    directive += " IMPORTANT: This is a child character. Age-appropriate portrayal only. Innocent, natural expression. No mature styling.";
  }

  return directive;
}

// ═══════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await requireAuth(req);
    if (isResponse(authResult)) return authResult;

    const { film_id } = await req.json();
    if (!film_id) {
      return new Response(
        JSON.stringify({ error: "film_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Parallel fetches ──
    const [filmRes, safetyRes, analysisRes, scenesRes, charsRes, directorRes] = await Promise.all([
      supabase.from("films").select("*").eq("id", film_id).single(),
      supabase.from("content_safety").select("*").eq("film_id", film_id).maybeSingle(),
      supabase.from("script_analyses").select("*").eq("film_id", film_id).eq("status", "complete").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("parsed_scenes").select("*").eq("film_id", film_id).order("scene_number"),
      supabase.from("characters").select("*").eq("film_id", film_id),
      supabase.from("film_director_profiles").select("*").eq("film_id", film_id).maybeSingle(),
    ]);

    const film = filmRes.data;
    if (!film) {
      return new Response(
        JSON.stringify({ error: "Film not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const safety = safetyRes.data;
    const analysis = analysisRes.data;
    const scenes = scenesRes.data || [];
    const characters = charsRes.data || [];
    const directorProfile = directorRes.data;

    // ── Derive core values ──
    const genres: string[] = (film.genres || []) as string[];
    const rating = deriveSafetyLevel(safety);
    const ratingMod = RATING_MODIFIERS[rating] || RATING_MODIFIERS["PG-13"];
    const genreProfile = blendGenreProfiles(genres);
    const timePeriod = film.time_period || "";

    // ── Extract visual design from analysis ──
    const globalElements: any = analysis?.global_elements || {};
    const visualDesign = globalElements.visual_design || {};
    const aiGenNotes: any[] = analysis?.ai_generation_notes || [];

    // ── Director Visual Mandate (from Engine match) ──
    const dm = directorProfile?.visual_mandate as { lighting?: string; lens?: string; texture?: string; color?: string; negativeHints?: string } | null;

    // ── Build Visual DNA ──
    const visualDnaParts = [
      analysis?.visual_summary || "",
      globalElements.signature_style || "",
      dm?.color ? `Director color signature: ${dm.color}.` : "",
      dm?.lighting ? `Director lighting signature: ${dm.lighting}.` : "",
    ];
    const visualDna = visualDnaParts.filter(Boolean).join(" ");

    // ── Build Color Mandate ──
    const colorMandate = {
      genre_palette: genreProfile.color.palette,
      genre_saturation: genreProfile.color.saturation,
      genre_contrast: genreProfile.color.contrast,
      script_palette: visualDesign.color_palette || [],
      rating_color_boost: ratingMod.color_boost,
      director_color: dm?.color || null,
    };

    // ── Build Lighting Doctrine ──
    const lightingDoctrine = {
      genre_default: genreProfile.lighting.default,
      genre_fill_ratio: genreProfile.lighting.fill_ratio,
      genre_color_temp: genreProfile.lighting.color_temp,
      script_lighting: visualDesign.lighting_language || [],
      rating_intensity: ratingMod.lighting_intensity,
      director_lighting: dm?.lighting || null,
    };

    // ── Build Lens Philosophy ──
    let lensNotes = "";
    for (const note of aiGenNotes) {
      if (typeof note === "object" && note.topic && /camera|lens|framing|cinematograph/i.test(note.topic)) {
        lensNotes += (note.body || "") + " ";
      }
    }
    const lensPhilosophy = {
      genre_default_lens: genreProfile.framing.default_lens,
      genre_portrait_style: genreProfile.framing.portrait_style,
      ai_notes: lensNotes.trim(),
      director_lens: dm?.lens || null,
    };

    // ── Build Texture Mandate ──
    const textureMandate = {
      genre_grain: genreProfile.texture.grain,
      genre_skin: genreProfile.texture.skin,
      rating_skin_detail: ratingMod.skin_detail,
      director_texture: dm?.texture || null,
    };

    // ── Build Temporal Rules ──
    const temporalRules = {
      anchor_period: timePeriod,
      // Reuse blacklist logic from compile-generation-payload
      temporal_analysis: globalElements.temporal_analysis || null,
    };

    // ── Build Content Guardrails ──
    const contentGuardrails = {
      safety_level: rating,
      violence: safety?.violence || false,
      nudity: safety?.nudity || false,
      language: safety?.language || false,
      rating_violence_visual: ratingMod.violence_visual,
      rating_wardrobe: ratingMod.wardrobe_modifier,
    };

    // ── Build Genre Visual Profile (full blended profile for downstream) ──
    const genreVisualProfile = {
      primary_genre: genres[0] || "Drama",
      all_genres: genres,
      blended_profile: genreProfile,
    };

    // ── Build Character Directives ──
    const characterDirectives: Record<string, string> = {};
    for (const char of characters) {
      characterDirectives[char.name] = buildCharacterDirective(
        char.name,
        char.sex,
        char.is_child || false,
        char.description,
        genreProfile,
        rating,
        genres,
      );
    }

    // ── Build Negative Prompt Base ──
    const negativeParts = [
      "morphed faces, low quality, watermark, text, 3d render, plastic",
      dm?.negativeHints || "",
      genreProfile.negative,
      ratingMod.negative_additions,
    ].filter(Boolean);
    const negativePromptBase = [...new Set(negativeParts.join(", ").split(", ").map(s => s.trim()).filter(Boolean))].join(", ");

    // ── Build World Rules from AI generation notes ──
    const worldRulesParts: string[] = [];
    for (const note of aiGenNotes) {
      if (typeof note === "object" && note.topic && note.body) {
        worldRulesParts.push(`**${note.topic}:** ${note.body}`);
      }
    }
    const worldRules = worldRulesParts.join("\n\n");

    // ── Source hash for drift detection ──
    const sourceHash = [
      genres.join(","),
      rating,
      timePeriod,
      analysis?.visual_summary?.substring(0, 50) || "",
      characters.length.toString(),
    ].join("|");

    // ── Upsert the contract ──
    const { data: existing } = await supabase
      .from("film_style_contracts")
      .select("id, version")
      .eq("film_id", film_id)
      .maybeSingle();

    const contractData = {
      film_id,
      version: existing ? (existing.version || 0) + 1 : 1,
      visual_dna: visualDna,
      color_mandate: colorMandate,
      lighting_doctrine: lightingDoctrine,
      lens_philosophy: lensPhilosophy,
      texture_mandate: textureMandate,
      temporal_rules: temporalRules,
      content_guardrails: contentGuardrails,
      genre_visual_profile: genreVisualProfile,
      world_rules: worldRules,
      negative_prompt_base: negativePromptBase,
      character_directives: characterDirectives,
      source_hash: sourceHash,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase.from("film_style_contracts").update(contractData).eq("id", existing.id);
    } else {
      await supabase.from("film_style_contracts").insert(contractData);
    }

    // ── Build Scene Style Overrides ──
    if (scenes.length > 0) {
      // Delete existing overrides for re-compilation
      await supabase.from("scene_style_overrides").delete().eq("film_id", film_id);

      const overrides = scenes.map((scene: any) => {
        const cin = scene.cinematic_elements || {};
        const dayNight = (scene.day_night || "day").toLowerCase().trim();
        const todGrade = TIME_OF_DAY_GRADES[dayNight] || TIME_OF_DAY_GRADES["day"];

        // Build color shift based on mood + day/night
        const mood = (scene.mood || "").toLowerCase();
        const colorShift: Record<string, any> = {};
        if (mood.includes("tense") || mood.includes("paranoid") || mood.includes("anxious")) {
          colorShift.desaturate = 15;
          colorShift.push_cool = true;
        } else if (mood.includes("romantic") || mood.includes("intimate") || mood.includes("warm")) {
          colorShift.push_warm = true;
          colorShift.saturate = 10;
        } else if (mood.includes("melanchol") || mood.includes("sad") || mood.includes("grief")) {
          colorShift.desaturate = 20;
          colorShift.push_cool = true;
        } else if (mood.includes("joy") || mood.includes("celebrat") || mood.includes("triumph")) {
          colorShift.saturate = 15;
          colorShift.push_warm = true;
        }

        return {
          film_id,
          scene_number: scene.scene_number,
          mood_override: scene.mood || null,
          lighting_override: cin.camera_feel || null,
          color_shift: colorShift,
          environment_texture: scene.environment_details || null,
          time_of_day_grade: todGrade,
          camera_feel: cin.camera_feel || null,
          custom_negative: null,
          shot_suggestions: cin.shot_suggestions || [],
        };
      });

      // Batch insert
      const batchSize = 50;
      for (let i = 0; i < overrides.length; i += batchSize) {
        await supabase.from("scene_style_overrides").insert(overrides.slice(i, i + batchSize));
      }
    }

    console.log(`Style contract compiled for film ${film_id}: v${contractData.version}, ${genres.join("+")} / ${rating}, ${scenes.length} scene overrides`);

    await logCreditUsage({
      userId: authResult.userId,
      filmId: film_id,
      serviceName: "Style Engine",
      serviceCategory: "script-analysis",
      operation: "compile-style-contract",
    });

    return new Response(
      JSON.stringify({
        success: true,
        version: contractData.version,
        genres: genres,
        rating: rating,
        scene_overrides_count: scenes.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("compile-style-contract error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to compile style contract", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
