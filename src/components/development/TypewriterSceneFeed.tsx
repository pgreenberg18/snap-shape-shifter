import { useEffect, useState, useRef, useMemo, useCallback } from "react";

interface SceneInfo {
  scene_number: number;
  heading: string;
  description?: string | null;
  characters?: string[] | null;
}

interface TypewriterSceneFeedProps {
  scenes: SceneInfo[];
}

const TARGET_TYPE_MS = 900;
const MIN_CHAR_DELAY = 1;
const PAUSE_AFTER_SCENE = 200;
const WIPE_DURATION = 100;

const TypewriterSceneFeed = ({ scenes }: TypewriterSceneFeedProps) => {
  // Use scene_number as the stable key, not array index
  const [currentSceneNumber, setCurrentSceneNumber] = useState<number | null>(null);
  const [charCount, setCharCount] = useState(0);
  const [phase, setPhase] = useState<"typing" | "hold" | "wipe">("typing");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shownScenesRef = useRef<Set<number>>(new Set());

  // Sorted unique scene numbers
  const sortedScenes = useMemo(
    () => [...scenes].sort((a, b) => a.scene_number - b.scene_number),
    [scenes],
  );

  const currentScene = useMemo(
    () => sortedScenes.find((s) => s.scene_number === currentSceneNumber) ?? null,
    [sortedScenes, currentSceneNumber],
  );

  // Find the next scene we haven't shown yet
  const findNextUnshown = useCallback((): SceneInfo | null => {
    for (const s of sortedScenes) {
      if (!shownScenesRef.current.has(s.scene_number)) {
        return s;
      }
    }
    return null;
  }, [sortedScenes]);

  // Bootstrap: pick the first unshown scene when data arrives
  useEffect(() => {
    if (currentSceneNumber !== null) return;
    const next = findNextUnshown();
    if (next) {
      shownScenesRef.current.add(next.scene_number);
      setCurrentSceneNumber(next.scene_number);
      setCharCount(0);
      setPhase("typing");
    }
  }, [sortedScenes, currentSceneNumber, findNextUnshown]);

  const fullText = useMemo(() => {
    if (!currentScene) return "";
    const lines: string[] = [];
    lines.push(`SCENE ${currentScene.scene_number}`);
    lines.push(currentScene.heading);
    if (currentScene.description) {
      lines.push("");
      lines.push(currentScene.description);
    }
    if (currentScene.characters && currentScene.characters.length > 0) {
      lines.push("");
      lines.push(`Characters: ${currentScene.characters.join(", ")}`);
    }
    return lines.join("\n");
  }, [currentScene]);

  // Advance to next unshown scene
  const advanceToNext = useCallback(() => {
    const next = findNextUnshown();
    if (next) {
      shownScenesRef.current.add(next.scene_number);
      setCurrentSceneNumber(next.scene_number);
      setCharCount(0);
      setPhase("typing");
    }
    // else stay idle — new scenes will trigger via the effect above
  }, [findNextUnshown]);

  // Typing effect — dynamic speed so each scene finishes in ~1.75s
  useEffect(() => {
    if (phase !== "typing" || !fullText) return;
    const charDelay = Math.max(MIN_CHAR_DELAY, Math.floor(TARGET_TYPE_MS / fullText.length));
    intervalRef.current = setInterval(() => {
      setCharCount((prev) => {
        if (prev >= fullText.length) {
          clearInterval(intervalRef.current!);
          setPhase("hold");
          return prev;
        }
        return prev + 1;
      });
    }, charDelay);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phase, fullText]);

  // Hold → wipe when there's a next unshown scene
  useEffect(() => {
    if (phase !== "hold") return;
    const next = findNextUnshown();
    if (!next) return; // wait for more scenes
    const timer = setTimeout(() => setPhase("wipe"), PAUSE_AFTER_SCENE);
    return () => clearTimeout(timer);
  }, [phase, findNextUnshown, sortedScenes]);

  // Wipe → advance
  useEffect(() => {
    if (phase !== "wipe") return;
    const timer = setTimeout(() => advanceToNext(), WIPE_DURATION);
    return () => clearTimeout(timer);
  }, [phase, advanceToNext]);

  if (!currentScene) return null;

  const displayedText = fullText.slice(0, charCount);
  const shownCount = shownScenesRef.current.size;

  return (
    <div className="ml-9 mt-3 relative overflow-hidden rounded-md">
      <div
        className="relative p-4 rounded-md border border-border/50 overflow-hidden"
        style={{ backgroundColor: "hsl(var(--card))", height: "calc(14px * 1.625 * 6 + 32px)" }}
      >
        {phase === "wipe" && (
          <div
            className="absolute inset-0 z-10 rounded-md"
            style={{
              background: "hsl(var(--card))",
              animation: `wipeIn ${WIPE_DURATION}ms ease-in-out forwards`,
            }}
          />
        )}
        <pre
          className="whitespace-pre-wrap text-xs leading-relaxed"
          style={{
            fontFamily: "'Courier Prime', 'Courier New', Courier, monospace",
            color: "hsl(var(--foreground))",
          }}
        >
          {displayedText}
          {phase === "typing" && (
            <span
              className="inline-block w-[2px] h-[14px] ml-[1px] align-middle"
              style={{
                backgroundColor: "hsl(var(--primary))",
                animation: "cursorBlink 0.6s step-end infinite",
              }}
            />
          )}
        </pre>
        <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground tabular-nums">
          Scene {currentScene.scene_number} / {sortedScenes.length}
        </div>
      </div>
    </div>
  );
};

export default TypewriterSceneFeed;
