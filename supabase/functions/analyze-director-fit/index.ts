import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, isResponse } from "../_shared/auth.ts";
import { logCreditUsage } from "../_shared/credit-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════════════
// DIRECTOR STYLE ENGINE — All 35 directors with 8-axis style vectors
// Mirrors src/lib/director-styles.ts for server-side computation
// ═══════════════════════════════════════════════════════════════════

interface StyleVector {
  scale: number;
  structure: number;
  visual: number;
  darkness: number;
  dialogue: number;
  spectacle: number;
  genreFluidity: number;
  emotion: number;
}

interface VisualMandate {
  lighting: string;
  lens: string;
  texture: string;
  color: string;
  negativeHints: string;
}

interface DirectorProfile {
  id: string;
  name: string;
  vector: StyleVector;
  cluster: string;
  quadrant: string;
  emotionalDepth: string;
  visualMandate: VisualMandate;
}

const STYLE_AXES: (keyof StyleVector)[] = [
  "scale", "structure", "visual", "darkness",
  "dialogue", "spectacle", "genreFluidity", "emotion",
];

// Compact director data: [scale, structure, visual, darkness, dialogue, spectacle, genreFluidity, emotion]
const DIRECTOR_DATA: Array<[string, string, number[], string, string, string, VisualMandate]> = [
  ["spielberg", "Steven Spielberg", [9,2,7,4,6,9,4,9], "operatic-mythmakers", "epic-classical", "operatic",
    { lighting: "High-key with warm fill; golden-hour magic-hour preference", lens: "Spherical primes, 27-40mm; flare-forward", texture: "Clean digital with subtle halation; film-emulated warmth", color: "Warm amber midtones, desaturated shadows, vivid sky blues", negativeHints: "harsh neon, extreme desaturation, handheld shaky-cam, cold blue grading" }],
  ["scorsese", "Martin Scorsese", [6,3,8,7,8,5,5,8], "gritty-realists", "intimate-classical", "operatic",
    { lighting: "Street-level practicals; neon bar signs; smoky ambiance", lens: "Kinetic Steadicam; freeze frames; 28-50mm", texture: "35mm grain with era-authentic stocks; gritty urban density", color: "Little Italy reds, taxi-cab yellows, Irish green", negativeHints: "clean sterile environments, pastel softness, fantasy worlds" }],
  ["kubrick", "Stanley Kubrick", [7,4,10,8,4,6,6,3], "epic-formalists", "intimate-classical", "cool",
    { lighting: "Candlelight naturalism to fluorescent dread; one-point perspective", lens: "Ultra-wide Zeiss primes; symmetrical obsession", texture: "35mm with maximum sharpness; clinical clarity", color: "Cold institutional whites, military greens, blood-accent reds", negativeHints: "warm sentimentality, soft diffusion, handheld chaos" }],
  ["hitchcock", "Alfred Hitchcock", [6,2,9,7,5,5,4,6], "stylized-auteurs", "intimate-classical", "warm",
    { lighting: "High-contrast noir; expressionist shadows; suspense-motivated key", lens: "Vertigo zoom-dolly; voyeuristic telephoto; precise storyboarded compositions", texture: "Classic Technicolor sheen or crisp black-and-white", color: "Vertigo greens, Psycho monochrome, Rear Window Kodachrome", negativeHints: "handheld chaos, flat naturalism, washed-out color" }],
  ["coppola", "Francis Ford Coppola", [9,3,8,8,6,8,4,9], "operatic-mythmakers", "epic-classical", "operatic",
    { lighting: "Gordon Willis darkness; overhead pools of light; shadow-dominant", lens: "Classical 40-75mm; deep staging through doorways", texture: "Kodak 5247 warmth; rich shadow detail; painterly chiaroscuro", color: "Godfather amber-sepia, Apocalypse jungle greens, fire oranges", negativeHints: "bright even lighting, pastel cheerfulness, digital sharpness" }],
  ["nolan", "Christopher Nolan", [9,9,9,7,5,9,6,4], "epic-formalists", "epic-experimental", "cool",
    { lighting: "Natural light preference; IMAX daylight clarity; minimal artificial fill", lens: "IMAX 65mm and large-format; ultra-wide for architecture", texture: "IMAX film grain at native resolution; maximum latitude", color: "Cool steel blues, concrete grays, muted earth", negativeHints: "warm golden glow, soft diffusion, expressionist color" }],
  ["tarantino", "Quentin Tarantino", [6,8,9,6,10,6,8,8], "tonal-alchemists", "intimate-experimental", "operatic",
    { lighting: "Genre-referential; grindhouse practicals; noir key lighting", lens: "Low-angle wide 21mm; trunk shots; crash zooms; anamorphic", texture: "35mm grain with intentional print damage; retro warmth", color: "Blood reds, desert yellows, midnight blues; exploitation palette", negativeHints: "clean digital, understated naturalism, muted palette" }],
  ["cameron", "James Cameron", [10,2,8,4,4,10,3,8], "world-architects", "epic-classical", "operatic",
    { lighting: "Massive practical rigs; underwater-adapted; blue-shift environments", lens: "Anamorphic for scope; deep focus wide-angle 14-24mm; IMAX-ready", texture: "Ultra-clean digital; photorealistic CG integration; HDR", color: "Deep ocean blues, bioluminescent accents, cool steel grays", negativeHints: "soft focus, lo-fi grain, intimate shallow DOF" }],
  ["scott", "Ridley Scott", [8,2,9,7,4,8,5,5], "epic-formalists", "epic-classical", "warm",
    { lighting: "Atmospheric haze and smoke; shafts of light through particulate", lens: "Multiple cameras, long zooms 50-200mm; voyeuristic distance", texture: "Layered fog, rain, dust; tactile environmental density", color: "Desaturated earth with amber highlights; steel blue-gray industrial", negativeHints: "clean sterile spaces, bright even lighting, cartoonish saturation" }],
  ["fincher", "David Fincher", [6,3,10,9,6,4,4,2], "gritty-realists", "intimate-classical", "cool",
    { lighting: "Overhead fluorescent dread; green-tinged practicals; surgical precision", lens: "Locked-off tripod; obsessive compositing; 27-40mm", texture: "RED digital with heavy grade; crushed blacks; clinical sharpness", color: "Sickly greens, institutional beige, rain-gray; desaturated", negativeHints: "warm golden tones, natural sunlight, handheld energy, joy" }],
  ["kurosawa", "Akira Kurosawa", [8,3,8,6,5,7,4,8], "operatic-mythmakers", "epic-classical", "operatic",
    { lighting: "Weather as lighting (rain, wind, fog); natural extremes", lens: "Multi-camera telephoto 100-200mm; compressed depth; wipe transitions", texture: "High-contrast black-and-white; later bold Eastmancolor", color: "Storm grays, blood reds, ink blacks; samurai earth-and-sky", negativeHints: "clean studio environments, bright pastel, modern urban" }],
  ["bergman", "Ingmar Bergman", [3,4,8,9,9,1,3,7], "intimate-humanists", "intimate-classical", "warm",
    { lighting: "Nordic winter light; Sven Nykvist naturalism; faces as landscapes", lens: "Extreme close-ups on faces; 75-100mm portrait lenses", texture: "High-contrast black-and-white; stark grain; austerity", color: "Monochrome dominance; muted Scandinavian earth, cold sea gray", negativeHints: "spectacle, bright saturation, action sequences, fantasy" }],
  ["fellini", "Federico Fellini", [6,7,9,5,6,6,9,8], "stylized-auteurs", "epic-experimental", "operatic",
    { lighting: "Theatrical studio lighting; expressionist shadows; carnival spotlights", lens: "Wide-angle distortion 21-28mm; dream logic composition", texture: "Italian neorealist grain; later saturated Technicolor fantasy", color: "Circus primary reds, papal whites, Mediterranean azure", negativeHints: "naturalistic restraint, muted palette, documentary realism" }],
  ["wilder", "Billy Wilder", [5,2,7,6,9,2,6,6], "tonal-alchemists", "intimate-classical", "warm",
    { lighting: "Classic Hollywood three-point; noir venetian-blind shadows", lens: "Classical studio coverage; 50mm standard; invisible craft", texture: "Golden-age Hollywood polish; 35mm studio sheen", color: "Classic black-and-white; sunset boulevard golds, office grays", negativeHints: "shaky handheld, extreme angles, visual excess, jump cuts" }],
  ["welles", "Orson Welles", [6,8,10,7,7,5,7,8], "stylized-auteurs", "intimate-experimental", "operatic",
    { lighting: "Extreme chiaroscuro; ceilings visible; German Expressionist influence", lens: "Deep focus wide-angle 18-25mm; ceilings in frame; baroque; long takes", texture: "High-contrast 35mm; deep blacks; newsreel grain integration", color: "Noir monochrome; rich Shakespearean golds and deep crimsons", negativeHints: "flat lighting, eye-level coverage, clean modern aesthetics" }],
  ["leone", "Sergio Leone", [9,2,9,6,3,8,4,9], "operatic-mythmakers", "epic-classical", "operatic",
    { lighting: "Harsh desert sun; deep eye-socket shadows; noon-flat with dramatic rim", lens: "Extreme close-up eyes 150mm+ cutting to ultra-wide 18mm; Morricone-timed", texture: "Dusty Techniscope grain; sweat and grit; weathered landscapes", color: "Desert ochre, sunbleached bone, gunmetal blue", negativeHints: "lush green landscapes, clean urban, fast cutting, modern tech" }],
  ["jackson", "Peter Jackson", [10,2,8,4,6,10,3,9], "operatic-mythmakers", "epic-classical", "operatic",
    { lighting: "Natural New Zealand light augmented with massive HMI rigs", lens: "Wide anamorphic for landscapes; telephoto for intimate character moments", texture: "Clean digital with painterly color grading; miniature + CG blend", color: "Verdant greens, volcanic oranges, ethereal golds", negativeHints: "urban concrete, neon, clinical white, modern architecture" }],
  ["lucas", "George Lucas", [10,3,7,3,4,10,5,8], "world-architects", "epic-classical", "operatic",
    { lighting: "Theatrical three-point; strong rim for heroes; chiaroscuro for villains", lens: "Classic spherical primes; deep staging; symmetrical mythic framing", texture: "Originally 35mm grain; later ultra-clean digital; storybook clarity", color: "Primary red-blue-gold triadic palette; saturated heroics", negativeHints: "muted realism, desaturation, documentary shakiness" }],
  ["miyazaki", "Hayao Miyazaki", [7,3,9,4,5,6,7,9], "world-architects", "epic-classical", "operatic",
    { lighting: "Watercolor daylight; cloud-filtered sun; Ghibli glow", lens: "Sweeping aerial pans; gentle tracking; contemplative stillness", texture: "Hand-painted cel animation feel; watercolor washes; organic line work", color: "Lush forest greens, sky cerulean, sunset corals, earth browns", negativeHints: "photorealistic CG, dark urban grit, neon, desaturation, violence" }],
  ["villeneuve", "Denis Villeneuve", [9,4,9,8,4,9,4,3], "epic-formalists", "epic-classical", "cool",
    { lighting: "Monolithic light sources; desert god-rays; fog diffusion; Deakins/Fraser", lens: "Large-format IMAX; ultra-wide for scale; humans dwarfed by architecture", texture: "IMAX film or Alexa LF; minimal grain; vast negative space", color: "Desert amber, sandstorm orange, steel blue, ash gray", negativeHints: "warm intimate spaces, bright colors, handheld energy" }],
  ["pta", "Paul Thomas Anderson", [6,4,8,7,8,4,6,9], "intimate-humanists", "intimate-experimental", "operatic",
    { lighting: "70s naturalism; warm tungsten practicals; smoky interiors", lens: "Long Steadicam tracking; 40-50mm; Altman-esque ensemble staging", texture: "35mm or 65mm film; rich grain structure; period-authentic", color: "San Fernando amber, mahogany wood tones, 70s harvest gold", negativeHints: "cold blue grading, ultra-modern aesthetics, tight close-ups only" }],
  ["wes-anderson", "Wes Anderson", [5,3,10,3,7,4,7,6], "stylized-auteurs", "intimate-experimental", "warm",
    { lighting: "Flat even illumination; no dramatic shadows; storybook shadowless", lens: "Centered symmetrical framing; planimetric composition; whip pans; 40mm", texture: "Pastel matte finish; miniature model integration; dollhouse precision", color: "Curated pastel palette per film; obsessive color control", negativeHints: "asymmetry, handheld, gritty realism, dark shadows, chaos" }],
  ["burton", "Tim Burton", [6,2,9,6,5,6,6,6], "stylized-auteurs", "intimate-classical", "warm",
    { lighting: "German Expressionist shadows; Halloween moonlight; purple-tinged key", lens: "Wide-angle distortion 21-28mm; Dutch angles; gothic symmetry", texture: "High-contrast with crushed shadows; stop-motion tactility", color: "Black-and-white stripes, cemetery purple, ghost-pale skin", negativeHints: "naturalistic daylight, earth tones, realistic proportions" }],
  ["del-toro", "Guillermo del Toro", [7,3,9,7,5,7,6,8], "world-architects", "epic-classical", "operatic",
    { lighting: "Amber practicals in darkness; candlelight warmth vs cold moonlight", lens: "Fluid tracking through clockwork sets; 28-40mm; labyrinthine composition", texture: "Tactile creature surfaces; wet stone; aged wood; baroque mechanical", color: "Gothic amber, midnight blue, insect gold, blood crimson", negativeHints: "bright clean modern, minimalist spaces, harsh daylight" }],
  ["eastwood", "Clint Eastwood", [6,2,6,6,5,4,3,6], "gritty-realists", "intimate-classical", "warm",
    { lighting: "Available light; minimal rigging; naturalistic no-frills", lens: "Classical coverage; 50mm standard; first-take energy", texture: "Clean digital with natural color; no heavy grading", color: "Muted Americana: dusty browns, olive greens, overcast grays", negativeHints: "stylistic excess, heavy color grading, showy camera moves" }],
  ["polanski", "Roman Polanski", [4,2,8,8,6,3,4,3], "gritty-realists", "intimate-classical", "cool",
    { lighting: "Claustrophobic interior practicals; paranoia-inducing top-light", lens: "Wide-angle in tight spaces 25-28mm; distorted proximity; trapped framing", texture: "60s-70s film grain; European art-house clarity", color: "Apartment yellows, paranoia green, noir shadow-black", negativeHints: "wide open spaces, bright daylight, warm comfort, sweeping landscapes" }],
  ["coens", "Coen Brothers", [6,4,8,7,8,4,9,6], "tonal-alchemists", "intimate-experimental", "warm",
    { lighting: "Roger Deakins naturalism; single-source motivated; window light", lens: "Wide-angle with geometric precision; 27-32mm; clean compositions", texture: "Film grain with period accuracy; dusty landscapes; lived-in interiors", color: "Sepia Americana, snow whites, noir greens; Fargo ice-blue", negativeHints: "glossy fashion lighting, neon excess, expressionist angles" }],
  ["inarritu", "Alejandro González Iñárritu", [8,7,9,8,6,7,6,9], "new-wave-architects", "epic-experimental", "operatic",
    { lighting: "Natural light only; magic-hour extremes; fire and candlelight", lens: "Ultra-wide 12-18mm; Steadicam long-take; immersive POV", texture: "Raw 65mm or Alexa; no filtration; skin pores visible; brutal naturalism", color: "Cold wilderness blues, blood reds, fire amber", negativeHints: "studio lighting, clean symmetry, bright cheerful tones" }],
  ["spike-lee", "Spike Lee", [6,3,8,6,9,4,7,8], "genre-provocateurs", "intimate-classical", "operatic",
    { lighting: "Brooklyn summer heat haze; warm saturated streetlight", lens: "Double-dolly direct-to-camera; canted angles; 25-40mm", texture: "Vivid 35mm Kodak saturation; sweat-on-skin tactility", color: "Do The Right Thing reds, Brooklyn brownstone brown, primary urgency", negativeHints: "muted restraint, cool blue grading, suburban calm" }],
  ["gerwig", "Greta Gerwig", [5,3,7,3,8,3,6,8], "intimate-humanists", "intimate-classical", "operatic",
    { lighting: "Warm natural daylight; soft window bounce; golden-hour femininity", lens: "Handheld intimacy for indie; controlled classical for period; 35-50mm", texture: "Warm digital or 16mm for nostalgia; soft naturalistic grain", color: "Sacramento gold, Little Women rose, Barbie pink", negativeHints: "cold darkness, clinical precision, desaturation, heavy shadows" }],
  ["chazelle", "Damien Chazelle", [7,3,9,5,6,8,5,9], "operatic-mythmakers", "epic-classical", "operatic",
    { lighting: "Jazz-club spotlights; golden studio warmth; sweat-gleam rim light", lens: "Whiplash close-up intensity; La La Land sweeping crane; 35-85mm", texture: "CinemaScope film grain; 35mm warmth; Kodak nostalgia", color: "Twilight purple-blue, spotlight gold, obsession red", negativeHints: "flat naturalism, cold clinical, desaturated realism" }],
  ["peele", "Jordan Peele", [6,3,8,8,6,6,8,7], "genre-provocateurs", "intimate-experimental", "warm",
    { lighting: "Suburban normalcy inverted; uncanny overhead fluorescents; sunken-place darkness", lens: "Symmetrical dread framing; 35-50mm; slow push-ins; unsettling negative space", texture: "Clean digital with horror-grade color science; shadow detail preserved", color: "Suburbia pastels hiding deep reds; night-sky indigo", negativeHints: "warm golden comfort, chaotic handheld, bright saturation" }],
  ["bong", "Bong Joon-ho", [7,6,8,7,6,6,10,8], "tonal-alchemists", "epic-experimental", "operatic",
    { lighting: "Architectural lighting as class metaphor; overhead fluorescent vs warm incandescent", lens: "Precise symmetrical framing; 35-50mm; vertical composition for class hierarchy", texture: "Clean digital with surgical precision; transparency of craft", color: "Institutional greens, wealth-warm ambers, poverty-cold grays", negativeHints: "random handheld, expressionist excess, monochrome, warm nostalgia" }],
  ["waititi", "Taika Waititi", [6,3,7,4,8,6,9,8], "tonal-alchemists", "intimate-experimental", "operatic",
    { lighting: "Bright natural daylight; comic warmth; playful practical color gels", lens: "Handheld mockumentary when comedic; steady wides for spectacle; 35mm", texture: "Clean digital with indie warmth; New Zealand landscape naturalism", color: "Vibrant primaries, comic-book pops, lush greens", negativeHints: "desaturated bleakness, clinical precision, cold formalism" }],
  ["coogler", "Ryan Coogler", [8,3,8,5,6,8,5,8], "new-wave-architects", "epic-classical", "operatic",
    { lighting: "Rich warm practicals; motivated interior glow; Afrofuturist neon accents", lens: "Steadicam one-take sequences; 35-50mm; immersive proximity", texture: "Clean digital with cultural texture overlays", color: "Royal purples, vibrant golds, deep blacks; Afrofuturist palette", negativeHints: "washed-out pastels, cold clinical blue, static locked-off shots" }],
];

function buildDirectors(): DirectorProfile[] {
  return DIRECTOR_DATA.map(([id, name, v, cluster, quadrant, emotionalDepth, visualMandate]) => ({
    id,
    name,
    vector: {
      scale: v[0], structure: v[1], visual: v[2], darkness: v[3],
      dialogue: v[4], spectacle: v[5], genreFluidity: v[6], emotion: v[7],
    },
    cluster,
    quadrant,
    emotionalDepth,
    visualMandate,
  }));
}

const DIRECTORS = buildDirectors();

// ═══════════════════════════════════════════════════════
// STYLE VECTOR COMPUTATION — Script metadata → 8-axis vector
// ═══════════════════════════════════════════════════════

/** Map genre(s) + format + time period + visual summary → style vector */
function computeScriptVector(
  genres: string[],
  formatType: string | null,
  timePeriod: string | null,
  visualSummary: string | null,
): StyleVector {
  // Start with neutral baseline
  const v: StyleVector = { scale: 5, structure: 3, visual: 6, darkness: 5, dialogue: 5, spectacle: 5, genreFluidity: 3, emotion: 5 };

  // ── Genre influence (primary driver) ──
  const genreMap: Record<string, Partial<StyleVector>> = {
    "Action":       { scale: 8, darkness: 5, spectacle: 9, emotion: 7, visual: 7 },
    "Adventure":    { scale: 9, spectacle: 8, emotion: 8, genreFluidity: 4 },
    "Animation":    { visual: 8, spectacle: 7, emotion: 7, genreFluidity: 6 },
    "Biographical": { scale: 5, dialogue: 7, darkness: 5, emotion: 7, spectacle: 3 },
    "Comedy":       { darkness: 3, dialogue: 8, spectacle: 3, emotion: 7, genreFluidity: 6 },
    "Crime":        { darkness: 8, dialogue: 7, visual: 8, spectacle: 5, emotion: 6 },
    "Docu-drama":   { scale: 4, structure: 3, visual: 5, darkness: 6, spectacle: 2, emotion: 6 },
    "Drama":        { scale: 5, dialogue: 7, darkness: 6, emotion: 8, spectacle: 3 },
    "Documentary":  { scale: 4, visual: 4, spectacle: 1, dialogue: 5, emotion: 5 },
    "Fantasy":      { scale: 8, spectacle: 8, visual: 8, genreFluidity: 6, emotion: 7 },
    "Historical":   { scale: 7, visual: 7, darkness: 5, spectacle: 6, emotion: 6 },
    "Horror":       { darkness: 9, visual: 8, spectacle: 5, emotion: 7, genreFluidity: 5 },
    "Musical":      { spectacle: 8, emotion: 9, visual: 8, dialogue: 6, darkness: 3 },
    "Mystery":      { darkness: 7, dialogue: 7, visual: 7, structure: 5, spectacle: 3 },
    "Noir":         { darkness: 9, visual: 9, dialogue: 7, spectacle: 3, emotion: 5 },
    "Romance":      { darkness: 3, dialogue: 8, emotion: 9, spectacle: 3, visual: 6 },
    "Satire":       { darkness: 5, dialogue: 8, genreFluidity: 8, spectacle: 3, emotion: 5 },
    "Sci-Fi":       { scale: 8, visual: 8, spectacle: 8, genreFluidity: 5, darkness: 6 },
    "Supernatural": { darkness: 7, visual: 7, spectacle: 5, genreFluidity: 6 },
    "Thriller":     { darkness: 7, visual: 7, structure: 5, spectacle: 5, emotion: 6 },
    "War":          { scale: 8, darkness: 8, spectacle: 7, emotion: 7, visual: 7 },
    "Western":      { scale: 7, visual: 8, darkness: 6, spectacle: 6, dialogue: 4, emotion: 7 },
  };

  // Apply primary genre at 100%, secondary at 40%
  const primary = genreMap[genres[0]];
  if (primary) {
    for (const [k, val] of Object.entries(primary)) {
      v[k as keyof StyleVector] = val as number;
    }
  }
  if (genres[1]) {
    const secondary = genreMap[genres[1]];
    if (secondary) {
      for (const [k, val] of Object.entries(secondary)) {
        const key = k as keyof StyleVector;
        v[key] = Math.round((v[key] * 0.6 + (val as number) * 0.4) * 10) / 10;
      }
    }
  }

  // ── Format influence ──
  const formatLower = (formatType || "").toLowerCase();
  if (formatLower.includes("feature")) {
    v.scale = Math.min(10, v.scale + 1);
    v.spectacle = Math.min(10, v.spectacle + 1);
  } else if (formatLower.includes("short")) {
    v.scale = Math.max(0, v.scale - 2);
    v.spectacle = Math.max(0, v.spectacle - 1);
  } else if (formatLower.includes("tv") || formatLower.includes("series")) {
    v.dialogue = Math.min(10, v.dialogue + 1);
    v.structure = Math.min(10, v.structure + 1);
  }

  // ── Time period influence ──
  const periodLower = (timePeriod || "").toLowerCase();
  if (periodLower.includes("medieval") || periodLower.includes("ancient") || periodLower.includes("1800")) {
    v.visual = Math.min(10, v.visual + 1);
    v.spectacle = Math.min(10, v.spectacle + 1);
  } else if (periodLower.includes("future") || periodLower.includes("2100") || periodLower.includes("sci-fi")) {
    v.visual = Math.min(10, v.visual + 1);
    v.genreFluidity = Math.min(10, v.genreFluidity + 1);
  }

  // ── Visual summary keyword analysis ──
  if (visualSummary) {
    const vs = visualSummary.toLowerCase();
    if (vs.includes("intimate") || vs.includes("chamber") || vs.includes("claustrophobic")) v.scale = Math.max(0, v.scale - 2);
    if (vs.includes("epic") || vs.includes("sweeping") || vs.includes("vast")) v.scale = Math.min(10, v.scale + 2);
    if (vs.includes("dark") || vs.includes("bleak") || vs.includes("grim")) v.darkness = Math.min(10, v.darkness + 1);
    if (vs.includes("bright") || vs.includes("colorful") || vs.includes("vibrant")) v.darkness = Math.max(0, v.darkness - 1);
    if (vs.includes("nonlinear") || vs.includes("fragmented") || vs.includes("experimental")) v.structure = Math.min(10, v.structure + 2);
    if (vs.includes("operatic") || vs.includes("emotional") || vs.includes("passionate")) v.emotion = Math.min(10, v.emotion + 2);
    if (vs.includes("cold") || vs.includes("clinical") || vs.includes("detached")) v.emotion = Math.max(0, v.emotion - 2);
  }

  // Clamp all values
  for (const axis of STYLE_AXES) {
    v[axis] = Math.max(0, Math.min(10, Math.round(v[axis] * 10) / 10));
  }

  return v;
}

/** Euclidean distance */
function styleDistance(a: StyleVector, b: StyleVector): number {
  let sum = 0;
  for (const axis of STYLE_AXES) {
    sum += (a[axis] - b[axis]) ** 2;
  }
  return Math.sqrt(sum);
}

/** Determine quadrant */
function vectorToQuadrant(v: StyleVector): string {
  const intimacySpectacle = (v.scale + v.spectacle) / 2;
  const structureExperiment = (v.structure + v.genreFluidity) / 2;
  if (intimacySpectacle >= 5 && structureExperiment < 5) return "epic-classical";
  if (intimacySpectacle >= 5 && structureExperiment >= 5) return "epic-experimental";
  if (intimacySpectacle < 5 && structureExperiment >= 5) return "intimate-experimental";
  return "intimate-classical";
}

function emotionTier(score: number): string {
  if (score <= 4) return "cool";
  if (score <= 7) return "warm";
  return "operatic";
}

/** Weighted blend of two vectors */
function blendVectors(a: StyleVector, b: StyleVector, weightA: number): StyleVector {
  const wB = 1 - weightA;
  const result = {} as StyleVector;
  for (const axis of STYLE_AXES) {
    result[axis] = Math.round((a[axis] * weightA + b[axis] * wB) * 10) / 10;
  }
  return result;
}

// ═══════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await requireAuth(req);
    if (isResponse(authResult)) return authResult;

    const { film_id, save } = await req.json();
    if (!film_id) {
      return new Response(
        JSON.stringify({ error: "film_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch film + analysis
    const [filmRes, analysisRes] = await Promise.all([
      supabase.from("films").select("*").eq("id", film_id).single(),
      supabase.from("script_analyses").select("visual_summary").eq("film_id", film_id).eq("status", "complete").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const film = filmRes.data;
    if (!film) {
      return new Response(
        JSON.stringify({ error: "Film not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const genres = (film.genres || []) as string[];
    const formatType = film.format_type;
    const timePeriod = film.time_period;
    const visualSummary = analysisRes.data?.visual_summary || null;

    // Compute script style vector
    const scriptVector = computeScriptVector(genres, formatType, timePeriod, visualSummary);
    const quadrant = vectorToQuadrant(scriptVector);
    const emotionalTier = emotionTier(scriptVector.emotion);

    // Find top 5 nearest directors
    const ranked = DIRECTORS
      .map((d) => ({ director: d, distance: styleDistance(scriptVector, d.vector) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);

    const top3 = ranked.slice(0, 3);
    const bestMatch = top3[0];

    // Optionally save the auto-match
    if (save && bestMatch) {
      const profileData = {
        film_id,
        primary_director_id: bestMatch.director.id,
        primary_director_name: bestMatch.director.name,
        secondary_director_id: top3.length > 1 ? top3[1].director.id : null,
        secondary_director_name: top3.length > 1 ? top3[1].director.name : null,
        blend_weight: 1.0,
        computed_vector: scriptVector,
        quadrant,
        cluster: bestMatch.director.cluster,
        emotional_depth: emotionalTier,
        auto_matched: true,
        match_distance: Math.round(bestMatch.distance * 1000) / 1000,
        visual_mandate: bestMatch.director.visualMandate,
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase
        .from("film_director_profiles")
        .select("id")
        .eq("film_id", film_id)
        .maybeSingle();

      if (existing) {
        await supabase.from("film_director_profiles").update(profileData).eq("id", existing.id);
      } else {
        await supabase.from("film_director_profiles").insert(profileData);
      }
    }

    await logCreditUsage({
      userId: authResult.userId,
      filmId: film_id,
      serviceName: "Director Engine",
      serviceCategory: "script-analysis",
      operation: "analyze-director-fit",
    });

    return new Response(
      JSON.stringify({
        script_vector: scriptVector,
        quadrant,
        emotional_tier: emotionalTier,
        matches: ranked.map((r) => ({
          director_id: r.director.id,
          director_name: r.director.name,
          distance: Math.round(r.distance * 1000) / 1000,
          cluster: r.director.cluster,
          quadrant: r.director.quadrant,
          emotional_depth: r.director.emotionalDepth,
          vector: r.director.vector,
          visual_mandate: r.director.visualMandate,
        })),
        recommended_blend: top3.length >= 2 ? {
          primary: { id: top3[0].director.id, name: top3[0].director.name, weight: 0.7 },
          secondary: { id: top3[1].director.id, name: top3[1].director.name, weight: 0.3 },
          blended_vector: blendVectors(top3[0].director.vector, top3[1].director.vector, 0.7),
        } : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("analyze-director-fit error:", err);
    return new Response(
      JSON.stringify({ error: "Director analysis failed", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
