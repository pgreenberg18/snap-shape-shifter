import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFilmId } from "@/hooks/useFilm";
import { supabase } from "@/integrations/supabase/client";

/* ── Types ── */
export type CharacterTier = "LEAD" | "STRONG_SUPPORT" | "FEATURE" | "UNDER_5" | "BACKGROUND";

export interface CharacterRanking {
  name: string;
  nameNormalized: string;
  rank: number;
  score: number;
  tier: CharacterTier;
  wordsSpoken: number;
  dialogueScenes: number;
  appearanceScenes: number;
  pages: number;
  firstPage: number;
  lastPage: number;
  pageDensity: number;
  /** Actual scene numbers (1-indexed) this character appears in */
  sceneNumbers: number[];
}

/* ── Core algorithm ── */
function computeRankings(scenes: any[]): CharacterRanking[] {
  if (!scenes || scenes.length === 0) return [];

  const totalScenes = scenes.length;
  // Approximate pages: ~1 scene per page (rough heuristic)
  const totalPages = Math.max(totalScenes, 1);

  // Accumulate per-character metrics
  const stats = new Map<
    string,
    {
      name: string;
      words: number;
      dialogueLines: number;
      dialogueScenes: Set<number>;
      appearanceScenes: Set<number>;
      pages: Set<number>;
      firstPage: number;
      lastPage: number;
      sceneDominance: number;
    }
  >();

  const getOrCreate = (raw: string) => {
    const key = raw.toUpperCase().replace(/\s*\(.*?\)\s*/g, "").trim();
    if (!key || key.length < 2) return null;
    // Skip crowd labels
    if (/^(COP|WAITER|WAITRESS|OFFICER|GUARD|NURSE|DOCTOR|DRIVER|PATRON|CUSTOMER|BYSTANDER)\s*#?\d*$/i.test(key)) return null;
    if (!stats.has(key)) {
      stats.set(key, {
        name: raw.replace(/\s*\(.*?\)\s*/g, "").trim(),
        words: 0,
        dialogueLines: 0,
        dialogueScenes: new Set(),
        appearanceScenes: new Set(),
        pages: new Set(),
        firstPage: Infinity,
        lastPage: -1,
        sceneDominance: 0,
      });
    }
    return stats.get(key)!;
  };

  for (let si = 0; si < scenes.length; si++) {
    const scene = scenes[si];
    const page = scene.page ? parseInt(scene.page, 10) : si + 1;

    // Characters appearing in this scene
    const sceneCharWords = new Map<string, number>();

    if (Array.isArray(scene.characters)) {
      for (const c of scene.characters) {
        const charName = typeof c === "string" ? c : c?.name;
        if (!charName) continue;
        const s = getOrCreate(charName);
        if (!s) continue;

        s.appearanceScenes.add(si);
        s.pages.add(page);
        s.firstPage = Math.min(s.firstPage, page);
        s.lastPage = Math.max(s.lastPage, page);

        // Count dialogue words from character description fields
        const dialogue = typeof c === "string" ? "" : (c?.key_expressions || "") + " " + (c?.emotional_tone || "") + " " + (c?.physical_behavior || "");
        const wordCount = dialogue.split(/\s+/).filter(Boolean).length;

        if (wordCount > 0 || (typeof c !== "string" && c?.emotional_tone)) {
          s.dialogueScenes.add(si);
          s.dialogueLines += 1;
          s.words += wordCount;
        }

        sceneCharWords.set(s.name.toUpperCase(), (sceneCharWords.get(s.name.toUpperCase()) || 0) + wordCount);
      }
    }

    // Scene dominance: mark top 2 speakers
    const sorted = [...sceneCharWords.entries()].sort((a, b) => b[1] - a[1]);
    for (let i = 0; i < Math.min(2, sorted.length); i++) {
      const s = stats.get(sorted[i][0]);
      if (s) s.sceneDominance++;
    }
  }

  if (stats.size === 0) return [];

  // Compute raw arrays for normalization
  const entries = [...stats.values()];

  const maxWords = Math.max(...entries.map((e) => e.words), 1);
  const maxDScenes = Math.max(...entries.map((e) => e.dialogueScenes.size), 1);
  const maxAScenes = Math.max(...entries.map((e) => e.appearanceScenes.size), 1);
  const maxPages = Math.max(...entries.map((e) => e.pages.size), 1);
  const maxDominance = Math.max(...entries.map((e) => e.sceneDominance), 1);

  const norm = (x: number, max: number) => max > 0 ? x / max : 0;
  const logNorm = (x: number, max: number) => max > 0 ? Math.log1p(x) / Math.log1p(max) : 0;

  const rankings: CharacterRanking[] = entries.map((e) => {
    // Dialogue Volume (log-scaled words to reduce monologue inflation)
    const DV = 0.6 * logNorm(e.words, maxWords) + 0.4 * norm(e.dialogueScenes.size, maxDScenes);
    // Appearance Frequency
    const AF = 0.7 * norm(e.appearanceScenes.size, maxAScenes) + 0.3 * norm(e.pages.size, maxPages);
    // Page Spread
    const span = e.lastPage >= e.firstPage ? (e.lastPage - e.firstPage) / totalPages : 0;
    const density = e.pages.size / totalPages;
    const PS = 0.6 * density + 0.4 * span;
    // Salience Bonus
    const SB = norm(e.sceneDominance, maxDominance);

    const score = 0.50 * DV + 0.30 * AF + 0.15 * PS + 0.05 * SB;

    // Convert scene indices to 1-indexed scene numbers
    const sceneNumbers = [...e.appearanceScenes].map((si) => {
      const scene = scenes[si];
      return scene?.scene_number ? parseInt(scene.scene_number, 10) : si + 1;
    }).sort((a, b) => a - b);

    return {
      name: e.name.charAt(0).toUpperCase() + e.name.slice(1).toLowerCase(),
      nameNormalized: e.name.toUpperCase(),
      rank: 0,
      score,
      tier: "BACKGROUND" as CharacterTier,
      wordsSpoken: e.words,
      dialogueScenes: e.dialogueScenes.size,
      appearanceScenes: e.appearanceScenes.size,
      pages: e.pages.size,
      firstPage: e.firstPage === Infinity ? 0 : e.firstPage,
      lastPage: e.lastPage === -1 ? 0 : e.lastPage,
      pageDensity: density,
      sceneNumbers,
    };
  });

  // Sort by score descending with tie-breakers
  rankings.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.dialogueScenes !== a.dialogueScenes) return b.dialogueScenes - a.dialogueScenes;
    if (b.appearanceScenes !== a.appearanceScenes) return b.appearanceScenes - a.appearanceScenes;
    if (a.firstPage !== b.firstPage) return a.firstPage - b.firstPage;
    return b.pageDensity - a.pageDensity;
  });

  // Assign ranks
  rankings.forEach((r, i) => { r.rank = i + 1; });

  // Apply 5-tier grouping with guardrails
  const LEAD_COUNT = 2;
  const STRONG_SUPPORT_COUNT = 6;
  const FEATURE_COUNT = 10;

  const tierByRank = (rank: number): CharacterTier => {
    if (rank <= LEAD_COUNT) return "LEAD";
    if (rank <= LEAD_COUNT + STRONG_SUPPORT_COUNT) return "STRONG_SUPPORT";
    if (rank <= LEAD_COUNT + STRONG_SUPPORT_COUNT + FEATURE_COUNT) return "FEATURE";
    return "UNDER_5";
  };

  const tierOrder: CharacterTier[] = ["BACKGROUND", "UNDER_5", "FEATURE", "STRONG_SUPPORT", "LEAD"];
  const bumpUp = (t: CharacterTier): CharacterTier => {
    const i = tierOrder.indexOf(t);
    return i < tierOrder.length - 1 ? tierOrder[i + 1] : t;
  };
  const capAtFeature = (t: CharacterTier): CharacterTier =>
    t === "LEAD" || t === "STRONG_SUPPORT" ? "FEATURE" : t;

  for (const r of rankings) {
    // BACKGROUND: no dialogue at all
    if (r.wordsSpoken <= 0 || r.dialogueScenes <= 0) {
      r.tier = "BACKGROUND";
      continue;
    }

    let tier = tierByRank(r.rank);

    // Guardrail A: one-scene monologue cap (top 8)
    if (r.rank <= 8 && r.dialogueScenes <= 1 && r.appearanceScenes <= 1) {
      tier = capAtFeature(tier);
    }

    // Guardrail B: recurring-but-quiet bump
    if (totalScenes > 0 && totalPages > 0) {
      const recurringByScenes = r.appearanceScenes / totalScenes >= 0.12;
      const recurringByPages = r.pages / totalPages >= 0.10;
      if ((tier === "UNDER_5" || tier === "FEATURE") && (recurringByScenes || recurringByPages)) {
        tier = bumpUp(tier);
      }
    }

    r.tier = tier;
  }

  return rankings;
}

/* ── Hook ── */
export function useCharacterRanking() {
  const filmId = useFilmId();

  const { data: analysis } = useQuery({
    queryKey: ["script-analysis-ranking", filmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("script_analyses")
        .select("scene_breakdown")
        .eq("film_id", filmId!)
        .eq("status", "complete")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!filmId,
  });

  const rankings = useMemo(() => {
    if (!analysis?.scene_breakdown || !Array.isArray(analysis.scene_breakdown)) return [];
    return computeRankings(analysis.scene_breakdown as any[]);
  }, [analysis?.scene_breakdown]);

  return rankings;
}
