export interface Film {
  id: string;
  title: string;
  credits: number;
  timePeriod: string;
}

export interface Character {
  id: string;
  filmId: string;
  name: string;
  imageUrl: string;
  voiceDescription: string;
  voiceGenerationSeed: number;
}

export interface Shot {
  id: string;
  filmId: string;
  sceneNumber: number;
  cameraAngle: string;
  promptText: string;
  videoUrl: string | null;
}

export const mockFilm: Film = {
  id: "film-001",
  title: "Neon Rain",
  credits: 1450,
  timePeriod: "2087",
};

export const mockCharacters: Character[] = [
  {
    id: "char-001",
    filmId: "film-001",
    name: "Kira Tanaka",
    imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face",
    voiceDescription: "Low, calm, with a slight digital reverb",
    voiceGenerationSeed: 42,
  },
  {
    id: "char-002",
    filmId: "film-001",
    name: "Marcus Cole",
    imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",
    voiceDescription: "Deep baritone, authoritative, gravelly",
    voiceGenerationSeed: 77,
  },
  {
    id: "char-003",
    filmId: "film-001",
    name: "Ava Lumen",
    imageUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face",
    voiceDescription: "Warm, melodic, youthful energy",
    voiceGenerationSeed: 19,
  },
];

export const mockShots: Shot[] = [
  {
    id: "shot-001",
    filmId: "film-001",
    sceneNumber: 1,
    cameraAngle: "Wide establishing",
    promptText: "Rain-soaked neon cityscape at night, towering holographic billboards reflecting off wet streets, drone-level wide shot",
    videoUrl: null,
  },
  {
    id: "shot-002",
    filmId: "film-001",
    sceneNumber: 1,
    cameraAngle: "Medium close-up",
    promptText: "Kira walking through a crowded market, neon signs casting colored light on her face, handheld camera feel",
    videoUrl: null,
  },
  {
    id: "shot-003",
    filmId: "film-001",
    sceneNumber: 2,
    cameraAngle: "Over-the-shoulder",
    promptText: "Marcus in a dark control room, banks of monitors glowing, looking at surveillance footage, shallow depth of field",
    videoUrl: null,
  },
];
