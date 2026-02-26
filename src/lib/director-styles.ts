/**
 * Director Style Engine — Neural Processing Constants
 *
 * Contains all 35 directors with:
 *  - 8-axis numeric style vector (0–10)
 *  - Cluster assignment (Engine 1 taxonomy)
 *  - Quadrant placement (Engine 3 blending map)
 *  - Default visual mandates (lighting, lens, texture, color)
 *
 * These constants drive:
 *  1. Script → style vector matching
 *  2. Nearest-director suggestions
 *  3. Style contract gap-filling
 *  4. Blend interpolation
 */

// ── Types ──────────────────────────────────────────────

export interface StyleVector {
  scale: number;
  structure: number;
  visual: number;
  darkness: number;
  dialogue: number;
  spectacle: number;
  genreFluidity: number;
  emotion: number;
}

export type StyleAxis = keyof StyleVector;

export const STYLE_AXES: StyleAxis[] = [
  "scale", "structure", "visual", "darkness",
  "dialogue", "spectacle", "genreFluidity", "emotion",
];

export const STYLE_AXIS_LABELS: Record<StyleAxis, string> = {
  scale: "Scale",
  structure: "Structure Complexity",
  visual: "Visual Control",
  darkness: "Darkness",
  dialogue: "Dialogue Density",
  spectacle: "Spectacle Dependency",
  genreFluidity: "Genre Fluidity",
  emotion: "Emotional Temperature",
};

export type ClusterId =
  | "operatic-mythmakers"
  | "epic-formalists"
  | "stylized-auteurs"
  | "gritty-realists"
  | "tonal-alchemists"
  | "intimate-humanists"
  | "world-architects"
  | "genre-provocateurs"
  | "new-wave-architects";

export const CLUSTER_LABELS: Record<ClusterId, string> = {
  "operatic-mythmakers": "Operatic Mythmakers",
  "epic-formalists": "Epic Formalists",
  "stylized-auteurs": "Stylized Auteurs",
  "gritty-realists": "Gritty Realists",
  "tonal-alchemists": "Tonal Alchemists",
  "intimate-humanists": "Intimate Humanists",
  "world-architects": "World Architects",
  "genre-provocateurs": "Genre Provocateurs",
  "new-wave-architects": "New Wave Architects",
};

export type QuadrantId =
  | "epic-classical"
  | "epic-experimental"
  | "intimate-experimental"
  | "intimate-classical";

export const QUADRANT_LABELS: Record<QuadrantId, string> = {
  "epic-classical": "Epic + Classical",
  "epic-experimental": "Epic + Experimental",
  "intimate-experimental": "Intimate + Experimental",
  "intimate-classical": "Intimate + Classical",
};

export interface VisualMandate {
  lighting: string;
  lens: string;
  texture: string;
  color: string;
  negativeHints: string;
}

export interface DirectorProfile {
  id: string;
  name: string;
  vector: StyleVector;
  cluster: ClusterId;
  quadrant: QuadrantId;
  emotionalDepth: "cool" | "warm" | "operatic";
  visualMandate: VisualMandate;
}

// ── Utility ────────────────────────────────────────────

/** Euclidean distance between two style vectors */
export function styleDistance(a: StyleVector, b: StyleVector): number {
  let sum = 0;
  for (const axis of STYLE_AXES) {
    sum += (a[axis] - b[axis]) ** 2;
  }
  return Math.sqrt(sum);
}

/** Weighted blend of two style vectors */
export function blendVectors(
  a: StyleVector,
  b: StyleVector,
  weightA: number,
): StyleVector {
  const wB = 1 - weightA;
  const result = {} as StyleVector;
  for (const axis of STYLE_AXES) {
    result[axis] = Math.round((a[axis] * weightA + b[axis] * wB) * 10) / 10;
  }
  return result;
}

/** Find the N nearest directors to a target vector */
export function nearestDirectors(
  target: StyleVector,
  n = 3,
): Array<{ director: DirectorProfile; distance: number }> {
  return DIRECTORS
    .map((d) => ({ director: d, distance: styleDistance(target, d.vector) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, n);
}

/** Determine quadrant from a style vector */
export function vectorToQuadrant(v: StyleVector): QuadrantId {
  const intimacySpectacle = (v.scale + v.spectacle) / 2;
  const structureExperiment = (v.structure + v.genreFluidity) / 2;
  const isEpic = intimacySpectacle >= 5;
  const isExperimental = structureExperiment >= 5;
  if (isEpic && !isExperimental) return "epic-classical";
  if (isEpic && isExperimental) return "epic-experimental";
  if (!isEpic && isExperimental) return "intimate-experimental";
  return "intimate-classical";
}

/** Determine emotional depth tier from emotion score */
export function emotionTier(score: number): "cool" | "warm" | "operatic" {
  if (score <= 4) return "cool";
  if (score <= 7) return "warm";
  return "operatic";
}

// ── Director Profiles ──────────────────────────────────

export const DIRECTORS: DirectorProfile[] = [
  // ─── Quadrant I: Epic + Classical ───
  {
    id: "spielberg",
    name: "Steven Spielberg",
    vector: { scale: 9, structure: 2, visual: 7, darkness: 4, dialogue: 6, spectacle: 9, genreFluidity: 4, emotion: 9 },
    cluster: "operatic-mythmakers",
    quadrant: "epic-classical",
    emotionalDepth: "operatic",
    visualMandate: {
      lighting: "High-key with warm fill; golden-hour magic-hour preference; motivated practical sources",
      lens: "Spherical primes, 27–40mm; Janusz Kamiński diffusion; flare-forward shooting",
      texture: "Clean digital with subtle halation; film-emulated warmth; Alexa sensor profile",
      color: "Warm amber midtones, desaturated shadows, vivid sky blues; sentimental golden palette",
      negativeHints: "harsh neon, extreme desaturation, handheld shaky-cam, cold blue grading",
    },
  },
  {
    id: "cameron",
    name: "James Cameron",
    vector: { scale: 10, structure: 2, visual: 8, darkness: 4, dialogue: 4, spectacle: 10, genreFluidity: 3, emotion: 8 },
    cluster: "world-architects",
    quadrant: "epic-classical",
    emotionalDepth: "operatic",
    visualMandate: {
      lighting: "Massive practical rigs; underwater-adapted lighting; blue-shift environments",
      lens: "Anamorphic for scope; deep focus wide-angle (14–24mm); IMAX-ready framing",
      texture: "Ultra-clean digital; photorealistic CG integration; high dynamic range",
      color: "Deep ocean blues, bioluminescent accents, cool steel grays; tech-organic palette",
      negativeHints: "soft focus, lo-fi grain, intimate shallow DOF, muted earth tones",
    },
  },
  {
    id: "jackson",
    name: "Peter Jackson",
    vector: { scale: 10, structure: 2, visual: 8, darkness: 4, dialogue: 6, spectacle: 10, genreFluidity: 3, emotion: 9 },
    cluster: "operatic-mythmakers",
    quadrant: "epic-classical",
    emotionalDepth: "operatic",
    visualMandate: {
      lighting: "Natural New Zealand light augmented with massive HMI rigs; mythic golden tones",
      lens: "Wide anamorphic for landscapes (14–21mm); telephoto for intimate character moments",
      texture: "Clean digital with painterly color grading; miniature + CG blend aesthetic",
      color: "Verdant greens, volcanic oranges, ethereal golds; Tolkien earth-tone palette",
      negativeHints: "urban concrete, neon, clinical white, modern architecture",
    },
  },
  {
    id: "lucas",
    name: "George Lucas",
    vector: { scale: 10, structure: 3, visual: 7, darkness: 3, dialogue: 4, spectacle: 10, genreFluidity: 5, emotion: 8 },
    cluster: "world-architects",
    quadrant: "epic-classical",
    emotionalDepth: "operatic",
    visualMandate: {
      lighting: "Theatrical three-point; strong rim lighting for heroes; chiaroscuro for villains",
      lens: "Classic spherical primes; deep staging; symmetrical mythic framing",
      texture: "Originally 35mm grain; later ultra-clean digital; storybook clarity",
      color: "Primary red-blue-gold triadic palette; saturated comic-book heroics; binary moral coding",
      negativeHints: "muted realism, desaturation, documentary shakiness, moral ambiguity in color",
    },
  },
  {
    id: "scott",
    name: "Ridley Scott",
    vector: { scale: 8, structure: 2, visual: 9, darkness: 7, dialogue: 4, spectacle: 8, genreFluidity: 5, emotion: 5 },
    cluster: "epic-formalists",
    quadrant: "epic-classical",
    emotionalDepth: "warm",
    visualMandate: {
      lighting: "Atmospheric haze and smoke; shafts of light through particulate; industrial practicals",
      lens: "Multiple cameras, long zooms (50–200mm); voyeuristic distance; Ridleygram storyboards",
      texture: "Layered fog, rain, dust; tactile environmental density; lived-in grunge",
      color: "Desaturated earth with amber highlights; steel blue-gray industrial palette; period ochre",
      negativeHints: "clean sterile spaces, bright even lighting, cartoonish saturation",
    },
  },
  {
    id: "coogler",
    name: "Ryan Coogler",
    vector: { scale: 8, structure: 3, visual: 8, darkness: 5, dialogue: 6, spectacle: 8, genreFluidity: 5, emotion: 8 },
    cluster: "new-wave-architects",
    quadrant: "epic-classical",
    emotionalDepth: "operatic",
    visualMandate: {
      lighting: "Rich warm practicals; motivated interior glow; Afrofuturist neon accents",
      lens: "Steadicam one-take sequences; 35–50mm character-centric; immersive proximity",
      texture: "Clean digital with cultural texture overlays; vibranium-sleek surfaces",
      color: "Royal purples, vibrant golds, deep blacks; culturally rooted Afrofuturist palette",
      negativeHints: "washed-out pastels, cold clinical blue, static locked-off shots",
    },
  },

  // ─── Quadrant II: Epic + Experimental ───
  {
    id: "nolan",
    name: "Christopher Nolan",
    vector: { scale: 9, structure: 9, visual: 9, darkness: 7, dialogue: 5, spectacle: 9, genreFluidity: 6, emotion: 4 },
    cluster: "epic-formalists",
    quadrant: "epic-experimental",
    emotionalDepth: "cool",
    visualMandate: {
      lighting: "Natural light preference; IMAX daylight clarity; minimal artificial fill",
      lens: "IMAX 65mm and large-format; ultra-wide for architecture; practical in-camera effects",
      texture: "IMAX film grain at native resolution; no digital cleanup; maximum latitude",
      color: "Cool steel blues, concrete grays, muted earth; cerebral desaturated palette",
      negativeHints: "warm golden glow, soft diffusion, handheld chaos, expressionist color",
    },
  },
  {
    id: "inarritu",
    name: "Alejandro González Iñárritu",
    vector: { scale: 8, structure: 7, visual: 9, darkness: 8, dialogue: 6, spectacle: 7, genreFluidity: 6, emotion: 9 },
    cluster: "new-wave-architects",
    quadrant: "epic-experimental",
    emotionalDepth: "operatic",
    visualMandate: {
      lighting: "Natural light only (Lubezki influence); magic-hour extremes; fire and candlelight",
      lens: "Ultra-wide 12–18mm; Steadicam long-take; immersive POV; distorted proximity",
      texture: "Raw 65mm or Alexa; no filtration; skin pores visible; brutal naturalism",
      color: "Cold wilderness blues, blood reds, fire amber; survival-instinct palette",
      negativeHints: "studio lighting, clean symmetry, bright cheerful tones, static composition",
    },
  },
  {
    id: "fellini",
    name: "Federico Fellini",
    vector: { scale: 6, structure: 7, visual: 9, darkness: 5, dialogue: 6, spectacle: 6, genreFluidity: 9, emotion: 8 },
    cluster: "stylized-auteurs",
    quadrant: "epic-experimental",
    emotionalDepth: "operatic",
    visualMandate: {
      lighting: "Theatrical studio lighting; expressionist shadows; carnival spotlights",
      lens: "Wide-angle distortion (21–28mm); Cinecittà soundstage framing; dream logic composition",
      texture: "Black-and-white Italian neorealist grain; later saturated Technicolor fantasy",
      color: "Circus primary reds, papal whites, Mediterranean azure; baroque excess palette",
      negativeHints: "naturalistic restraint, muted palette, documentary realism, minimalism",
    },
  },
  {
    id: "bong",
    name: "Bong Joon-ho",
    vector: { scale: 7, structure: 6, visual: 8, darkness: 7, dialogue: 6, spectacle: 6, genreFluidity: 10, emotion: 8 },
    cluster: "tonal-alchemists",
    quadrant: "epic-experimental",
    emotionalDepth: "operatic",
    visualMandate: {
      lighting: "Architectural lighting as class metaphor; overhead fluorescent vs warm incandescent divide",
      lens: "Precise symmetrical framing; 35–50mm; vertical composition for class hierarchy",
      texture: "Clean digital with surgical precision; no stylistic excess; transparency of craft",
      color: "Institutional greens, wealth-warm ambers, poverty-cold grays; socioeconomic color coding",
      negativeHints: "random handheld, expressionist excess, monochrome, nostalgic warmth",
    },
  },

  // ─── Quadrant III: Intimate + Experimental ───
  {
    id: "tarantino",
    name: "Quentin Tarantino",
    vector: { scale: 6, structure: 8, visual: 9, darkness: 6, dialogue: 10, spectacle: 6, genreFluidity: 8, emotion: 8 },
    cluster: "tonal-alchemists",
    quadrant: "intimate-experimental",
    emotionalDepth: "operatic",
    visualMandate: {
      lighting: "Genre-referential; grindhouse practicals; noir key lighting; exploitation high-contrast",
      lens: "Low-angle wide (21mm); trunk shots; crash zooms; anamorphic Panavision",
      texture: "35mm grain with intentional print damage; retro celluloid warmth; chapter-card cuts",
      color: "Blood reds, desert yellows, midnight blues; exploitation cinema palette with pop accents",
      negativeHints: "clean digital, understated naturalism, muted palette, restrained framing",
    },
  },
  {
    id: "coens",
    name: "Coen Brothers",
    vector: { scale: 6, structure: 4, visual: 8, darkness: 7, dialogue: 8, spectacle: 4, genreFluidity: 9, emotion: 6 },
    cluster: "tonal-alchemists",
    quadrant: "intimate-experimental",
    emotionalDepth: "warm",
    visualMandate: {
      lighting: "Roger Deakins naturalism; single-source motivated; window light with deep falloff",
      lens: "Wide-angle with geometric precision; 27–32mm; Deakins' clean compositions",
      texture: "Film grain with period accuracy; dusty landscapes; lived-in interiors",
      color: "Sepia Americana, snow whites, noir greens; Fargo ice-blue vs Lebowski warm brown",
      negativeHints: "glossy fashion lighting, neon excess, shaky handheld, expressionist angles",
    },
  },
  {
    id: "pta",
    name: "Paul Thomas Anderson",
    vector: { scale: 6, structure: 4, visual: 8, darkness: 7, dialogue: 8, spectacle: 4, genreFluidity: 6, emotion: 9 },
    cluster: "intimate-humanists",
    quadrant: "intimate-experimental",
    emotionalDepth: "operatic",
    visualMandate: {
      lighting: "70s naturalism; warm tungsten practicals; smoky interiors; Robert Elswit glow",
      lens: "Long Steadicam tracking; 40–50mm; Altman-esque ensemble staging; deep focus",
      texture: "35mm or 65mm film; rich grain structure; period-authentic print quality",
      color: "San Fernando amber, mahogany wood tones, 70s harvest gold; nostalgic warmth",
      negativeHints: "cold blue grading, ultra-modern aesthetics, clean digital, tight close-ups only",
    },
  },
  {
    id: "wes-anderson",
    name: "Wes Anderson",
    vector: { scale: 5, structure: 3, visual: 10, darkness: 3, dialogue: 7, spectacle: 4, genreFluidity: 7, emotion: 6 },
    cluster: "stylized-auteurs",
    quadrant: "intimate-experimental",
    emotionalDepth: "warm",
    visualMandate: {
      lighting: "Flat even illumination; no dramatic shadows; storybook shadowless quality",
      lens: "Centered symmetrical framing; planimetric composition; whip pans; 40mm prime",
      texture: "Pastel matte finish; miniature model integration; dollhouse precision",
      color: "Curated pastel palette per film; Mendl's pink, Moonrise khaki, Budapest lilac; obsessive color control",
      negativeHints: "asymmetry, handheld, gritty realism, desaturation, dark shadows, chaos",
    },
  },
  {
    id: "peele",
    name: "Jordan Peele",
    vector: { scale: 6, structure: 3, visual: 8, darkness: 8, dialogue: 6, spectacle: 6, genreFluidity: 8, emotion: 7 },
    cluster: "genre-provocateurs",
    quadrant: "intimate-experimental",
    emotionalDepth: "warm",
    visualMandate: {
      lighting: "Suburban normalcy inverted; uncanny overhead fluorescents; sunken-place darkness",
      lens: "Symmetrical dread framing; 35–50mm; slow push-ins; unsettling negative space",
      texture: "Clean digital with horror-grade color science; shadow detail preserved for reveals",
      color: "Suburbia pastels hiding deep reds; night-sky indigo; hidden-threat earth tones",
      negativeHints: "warm golden comfort, chaotic handheld, bright saturation, expressionist excess",
    },
  },
  {
    id: "waititi",
    name: "Taika Waititi",
    vector: { scale: 6, structure: 3, visual: 7, darkness: 4, dialogue: 8, spectacle: 6, genreFluidity: 9, emotion: 8 },
    cluster: "tonal-alchemists",
    quadrant: "intimate-experimental",
    emotionalDepth: "operatic",
    visualMandate: {
      lighting: "Bright natural daylight; comic warmth; playful practical color gels",
      lens: "Handheld mockumentary when comedic; steady wides for spectacle; 35mm",
      texture: "Clean digital with indie warmth; New Zealand landscape naturalism",
      color: "Vibrant primaries, comic-book pops, lush greens; playful saturated palette",
      negativeHints: "desaturated bleakness, clinical precision, cold formalism, heavy shadows",
    },
  },

  // ─── Quadrant IV: Intimate + Classical ───
  {
    id: "kubrick",
    name: "Stanley Kubrick",
    vector: { scale: 7, structure: 4, visual: 10, darkness: 8, dialogue: 4, spectacle: 6, genreFluidity: 6, emotion: 3 },
    cluster: "epic-formalists",
    quadrant: "intimate-classical",
    emotionalDepth: "cool",
    visualMandate: {
      lighting: "Candlelight naturalism (Barry Lyndon) to fluorescent dread (Clockwork); one-point perspective",
      lens: "Ultra-wide Zeiss primes (9.8mm); NASA f/0.7 for candlelight; symmetrical obsession",
      texture: "35mm with maximum sharpness; later clean digital precision; clinical clarity",
      color: "Cold institutional whites, military greens, blood-accent reds; controlled monochromatic palettes",
      negativeHints: "warm sentimentality, soft diffusion, handheld chaos, saturated happy tones",
    },
  },
  {
    id: "scorsese",
    name: "Martin Scorsese",
    vector: { scale: 6, structure: 3, visual: 8, darkness: 7, dialogue: 8, spectacle: 5, genreFluidity: 5, emotion: 8 },
    cluster: "gritty-realists",
    quadrant: "intimate-classical",
    emotionalDepth: "operatic",
    visualMandate: {
      lighting: "Street-level practicals; neon bar signs; smoky pool-hall ambiance; motivated sources",
      lens: "Kinetic Steadicam; freeze frames; speed ramps; 28–50mm; Copacabana tracking",
      texture: "35mm grain with era-authentic stocks; gritty urban density; period newsprint quality",
      color: "Little Italy reds, taxi-cab yellows, Irish green; ethnic-neighborhood saturated palette",
      negativeHints: "clean sterile environments, pastel softness, fantasy worlds, flat even lighting",
    },
  },
  {
    id: "hitchcock",
    name: "Alfred Hitchcock",
    vector: { scale: 6, structure: 2, visual: 9, darkness: 7, dialogue: 5, spectacle: 5, genreFluidity: 4, emotion: 6 },
    cluster: "stylized-auteurs",
    quadrant: "intimate-classical",
    emotionalDepth: "warm",
    visualMandate: {
      lighting: "High-contrast noir; expressionist shadows; suspense-motivated key lighting",
      lens: "Vertigo zoom-dolly; voyeuristic telephoto; precise storyboarded compositions",
      texture: "Classic Technicolor sheen or crisp black-and-white; studio-era polish",
      color: "Vertigo greens, Psycho monochrome, Rear Window warm Kodachrome; suspense-coded palette",
      negativeHints: "handheld chaos, improvised framing, flat naturalism, washed-out color",
    },
  },
  {
    id: "coppola",
    name: "Francis Ford Coppola",
    vector: { scale: 9, structure: 3, visual: 8, darkness: 8, dialogue: 6, spectacle: 8, genreFluidity: 4, emotion: 9 },
    cluster: "operatic-mythmakers",
    quadrant: "epic-classical",
    emotionalDepth: "operatic",
    visualMandate: {
      lighting: "Gordon Willis darkness; overhead pools of light; shadow-dominant interiors",
      lens: "Classical 40–75mm; deep staging through doorways; opera-house framing",
      texture: "Kodak 5247 warmth; rich shadow detail; painterly chiaroscuro",
      color: "Godfather amber-sepia, Apocalypse jungle greens, fire oranges; operatic earth palette",
      negativeHints: "bright even lighting, pastel cheerfulness, modern clean aesthetics, digital sharpness",
    },
  },
  {
    id: "fincher",
    name: "David Fincher",
    vector: { scale: 6, structure: 3, visual: 10, darkness: 9, dialogue: 6, spectacle: 4, genreFluidity: 4, emotion: 2 },
    cluster: "gritty-realists",
    quadrant: "intimate-classical",
    emotionalDepth: "cool",
    visualMandate: {
      lighting: "Overhead fluorescent dread; green-tinged practicals; surgical precision; no visible source",
      lens: "Locked-off tripod; obsessive digital compositing; 27–40mm Harris Savides / Jeff Cronenweth",
      texture: "RED digital with heavy grade; crushed blacks; eliminated warmth; clinical sharpness",
      color: "Sickly greens, institutional beige, rain-gray; desaturated oppressive palette",
      negativeHints: "warm golden tones, natural sunlight, handheld energy, saturated colors, joy",
    },
  },
  {
    id: "kurosawa",
    name: "Akira Kurosawa",
    vector: { scale: 8, structure: 3, visual: 8, darkness: 6, dialogue: 5, spectacle: 7, genreFluidity: 4, emotion: 8 },
    cluster: "operatic-mythmakers",
    quadrant: "epic-classical",
    emotionalDepth: "operatic",
    visualMandate: {
      lighting: "Weather as lighting (rain, wind, fog); natural extremes; storm-lit battlefields",
      lens: "Multi-camera telephoto (100–200mm); compressed depth; wipe transitions; axial cuts",
      texture: "High-contrast black-and-white; later bold Eastmancolor; weather-battered grain",
      color: "Storm grays, blood reds, ink blacks; samurai earth-and-sky palette",
      negativeHints: "clean studio environments, bright pastel, static calm, modern urban settings",
    },
  },
  {
    id: "bergman",
    name: "Ingmar Bergman",
    vector: { scale: 3, structure: 4, visual: 8, darkness: 9, dialogue: 9, spectacle: 1, genreFluidity: 3, emotion: 7 },
    cluster: "intimate-humanists",
    quadrant: "intimate-classical",
    emotionalDepth: "warm",
    visualMandate: {
      lighting: "Nordic winter light; Sven Nykvist naturalism; faces as landscapes; soft window light",
      lens: "Extreme close-ups on faces; 75–100mm portrait lenses; theater-derived blocking",
      texture: "High-contrast black-and-white; stark grain; Fårö island austerity",
      color: "Monochrome dominance; when color: muted Scandinavian earth, cold sea gray, bone white",
      negativeHints: "spectacle, bright saturation, action sequences, wide establishing shots, fantasy",
    },
  },
  {
    id: "wilder",
    name: "Billy Wilder",
    vector: { scale: 5, structure: 2, visual: 7, darkness: 6, dialogue: 9, spectacle: 2, genreFluidity: 6, emotion: 6 },
    cluster: "tonal-alchemists",
    quadrant: "intimate-classical",
    emotionalDepth: "warm",
    visualMandate: {
      lighting: "Classic Hollywood three-point; noir venetian-blind shadows; comedy flat-light",
      lens: "Classical studio coverage; 50mm standard; master-shot editing; invisible craft",
      texture: "Golden-age Hollywood polish; 35mm studio sheen; seamless continuity",
      color: "Classic black-and-white; when color: Billy's sunset boulevard golds, office grays",
      negativeHints: "shaky handheld, extreme angles, visual excess, gritty realism, jump cuts",
    },
  },
  {
    id: "welles",
    name: "Orson Welles",
    vector: { scale: 6, structure: 8, visual: 10, darkness: 7, dialogue: 7, spectacle: 5, genreFluidity: 7, emotion: 8 },
    cluster: "stylized-auteurs",
    quadrant: "intimate-experimental",
    emotionalDepth: "operatic",
    visualMandate: {
      lighting: "Extreme chiaroscuro; ceilings visible; low-angle deep shadows; German Expressionist influence",
      lens: "Deep focus wide-angle (18–25mm); ceilings in frame; baroque composition; long takes",
      texture: "High-contrast 35mm; deep blacks; newsreel grain integration; optical printing",
      color: "Noir monochrome; when color: rich Shakespearean golds and deep crimsons",
      negativeHints: "flat lighting, eye-level coverage, clean modern aesthetics, naturalistic restraint",
    },
  },
  {
    id: "leone",
    name: "Sergio Leone",
    vector: { scale: 9, structure: 2, visual: 9, darkness: 6, dialogue: 3, spectacle: 8, genreFluidity: 4, emotion: 9 },
    cluster: "operatic-mythmakers",
    quadrant: "epic-classical",
    emotionalDepth: "operatic",
    visualMandate: {
      lighting: "Harsh desert sun; deep eye-socket shadows; noon-flat with dramatic rim",
      lens: "Extreme close-up eyes (150mm+) cutting to ultra-wide vistas (18mm); Morricone-timed editing",
      texture: "Dusty Techniscope grain; sweat and grit on skin; weathered landscapes",
      color: "Desert ochre, sunbleached bone, gunmetal blue; spaghetti-western earth palette",
      negativeHints: "lush green landscapes, clean urban settings, fast cutting, modern technology",
    },
  },
  {
    id: "miyazaki",
    name: "Hayao Miyazaki",
    vector: { scale: 7, structure: 3, visual: 9, darkness: 4, dialogue: 5, spectacle: 6, genreFluidity: 7, emotion: 9 },
    cluster: "world-architects",
    quadrant: "epic-classical",
    emotionalDepth: "operatic",
    visualMandate: {
      lighting: "Watercolor daylight; cloud-filtered sun; environmental light as character; Ghibli glow",
      lens: "Sweeping aerial pans; gentle tracking; 35mm equivalent; contemplative stillness",
      texture: "Hand-painted cel animation feel; watercolor washes; organic line work",
      color: "Lush forest greens, sky cerulean, sunset corals, earth browns; Ghibli nature palette",
      negativeHints: "photorealistic CG, dark urban grit, neon, desaturation, harsh shadows, violence",
    },
  },
  {
    id: "villeneuve",
    name: "Denis Villeneuve",
    vector: { scale: 9, structure: 4, visual: 9, darkness: 8, dialogue: 4, spectacle: 9, genreFluidity: 4, emotion: 3 },
    cluster: "epic-formalists",
    quadrant: "epic-classical",
    emotionalDepth: "cool",
    visualMandate: {
      lighting: "Monolithic light sources; desert god-rays; fog diffusion; Deakins/Fraser collaboration",
      lens: "Large-format IMAX; ultra-wide for scale; human figures dwarfed by architecture; 35–65mm",
      texture: "IMAX film or Alexa LF; minimal grain; vast negative space; clean brutal clarity",
      color: "Desert amber, sandstorm orange, steel blue, ash gray; monumental earth palette",
      negativeHints: "warm intimate spaces, bright colors, handheld energy, dialogue-heavy scenes",
    },
  },
  {
    id: "burton",
    name: "Tim Burton",
    vector: { scale: 6, structure: 2, visual: 9, darkness: 6, dialogue: 5, spectacle: 6, genreFluidity: 6, emotion: 6 },
    cluster: "stylized-auteurs",
    quadrant: "intimate-classical",
    emotionalDepth: "warm",
    visualMandate: {
      lighting: "German Expressionist shadows; Halloween moonlight; purple-tinged key lights",
      lens: "Wide-angle distortion (21–28mm); Dutch angles; gothic symmetry; spiral compositions",
      texture: "High-contrast with crushed shadows; stop-motion tactility; striped patterns",
      color: "Black-and-white stripes, cemetery purple, ghost-pale skin, blood red accents; gothic palette",
      negativeHints: "naturalistic daylight, earth tones, realistic proportions, clean modern spaces",
    },
  },
  {
    id: "del-toro",
    name: "Guillermo del Toro",
    vector: { scale: 7, structure: 3, visual: 9, darkness: 7, dialogue: 5, spectacle: 7, genreFluidity: 6, emotion: 8 },
    cluster: "world-architects",
    quadrant: "epic-classical",
    emotionalDepth: "operatic",
    visualMandate: {
      lighting: "Amber practicals in darkness; candlelight warmth vs cold moonlight; fairy-tale contrast",
      lens: "Fluid tracking through clockwork sets; 28–40mm; labyrinthine composition",
      texture: "Tactile creature surfaces; wet stone; aged wood; baroque mechanical detail",
      color: "Gothic amber, midnight blue, insect gold, blood crimson; dark fairy-tale palette",
      negativeHints: "bright clean modern, minimalist spaces, harsh daylight, sterile environments",
    },
  },
  {
    id: "eastwood",
    name: "Clint Eastwood",
    vector: { scale: 6, structure: 2, visual: 6, darkness: 6, dialogue: 5, spectacle: 4, genreFluidity: 3, emotion: 6 },
    cluster: "gritty-realists",
    quadrant: "intimate-classical",
    emotionalDepth: "warm",
    visualMandate: {
      lighting: "Available light; minimal rigging; naturalistic no-frills; single setup preference",
      lens: "Classical coverage; 50mm standard; no-fuss composition; first-take energy",
      texture: "Clean digital with natural color; no heavy grading; straightforward clarity",
      color: "Muted Americana: dusty browns, olive greens, overcast grays; understated palette",
      negativeHints: "stylistic excess, heavy color grading, showy camera moves, visual gimmicks",
    },
  },
  {
    id: "polanski",
    name: "Roman Polanski",
    vector: { scale: 4, structure: 2, visual: 8, darkness: 8, dialogue: 6, spectacle: 3, genreFluidity: 4, emotion: 3 },
    cluster: "gritty-realists",
    quadrant: "intimate-classical",
    emotionalDepth: "cool",
    visualMandate: {
      lighting: "Claustrophobic interior practicals; paranoia-inducing top-light; apartment dread",
      lens: "Wide-angle in tight spaces (25–28mm); distorted proximity; trapped framing",
      texture: "60s–70s film grain; European art-house clarity; psychological sharpness",
      color: "Apartment yellows, paranoia green, noir shadow-black; claustrophobic muted palette",
      negativeHints: "wide open spaces, bright daylight, warm comfort, sweeping landscapes",
    },
  },
  {
    id: "spike-lee",
    name: "Spike Lee",
    vector: { scale: 6, structure: 3, visual: 8, darkness: 6, dialogue: 9, spectacle: 4, genreFluidity: 7, emotion: 8 },
    cluster: "genre-provocateurs",
    quadrant: "intimate-classical",
    emotionalDepth: "operatic",
    visualMandate: {
      lighting: "Brooklyn summer heat haze; warm saturated streetlight; confrontational direct light",
      lens: "Double-dolly direct-to-camera; canted angles; 25–40mm; fourth-wall breaks",
      texture: "Vivid 35mm Kodak saturation; sweat-on-skin tactility; street-level energy",
      color: "Do The Right Thing reds, Brooklyn brownstone brown, protest-sign primary; urgent saturated palette",
      negativeHints: "muted restraint, cool blue grading, static locked shots, suburban calm",
    },
  },
  {
    id: "gerwig",
    name: "Greta Gerwig",
    vector: { scale: 5, structure: 3, visual: 7, darkness: 3, dialogue: 8, spectacle: 3, genreFluidity: 6, emotion: 8 },
    cluster: "intimate-humanists",
    quadrant: "intimate-classical",
    emotionalDepth: "operatic",
    visualMandate: {
      lighting: "Warm natural daylight; soft window bounce; golden-hour femininity; memoir glow",
      lens: "Handheld intimacy for indie; controlled classical for period; 35–50mm; observational",
      texture: "Warm digital or 16mm for nostalgia; soft naturalistic grain; diary-entry quality",
      color: "Sacramento gold, Little Women rose, Barbie pink; warm nostalgic memory palette",
      negativeHints: "cold darkness, clinical precision, desaturation, heavy shadows, violence",
    },
  },
  {
    id: "chazelle",
    name: "Damien Chazelle",
    vector: { scale: 7, structure: 3, visual: 9, darkness: 5, dialogue: 6, spectacle: 8, genreFluidity: 5, emotion: 9 },
    cluster: "operatic-mythmakers",
    quadrant: "epic-classical",
    emotionalDepth: "operatic",
    visualMandate: {
      lighting: "Jazz-club spotlights; golden studio warmth; sweat-gleam rim light; performance lighting",
      lens: "Whiplash close-up intensity; La La Land sweeping crane; 35–85mm; musical staging",
      texture: "CinemaScope film grain; 35mm warmth; Kodak nostalgia; Linus Sandgren romanticism",
      color: "Twilight purple-blue, spotlight gold, obsession red; musical-dream palette",
      negativeHints: "flat naturalism, cold clinical, desaturated realism, static wide shots",
    },
  },
];

export const DIRECTOR_CATALOG = DIRECTORS;

/** Lookup a director by ID */
export function getDirector(id: string): DirectorProfile | undefined {
  return DIRECTOR_CATALOG.find((d) => d.id === id);
}

/** Get all directors in a specific cluster */
export function getClusterDirectors(cluster: ClusterId): DirectorProfile[] {
  return DIRECTOR_CATALOG.filter((d) => d.cluster === cluster);
}

/** Get all directors in a specific quadrant */
export function getQuadrantDirectors(quadrant: QuadrantId): DirectorProfile[] {
  return DIRECTOR_CATALOG.filter((d) => d.quadrant === quadrant);
}
