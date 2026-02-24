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

const CHAR_DELAY = 16; // ms per character
const PAUSE_AFTER_SCENE = 1400; // ms to hold the finished scene
const WIPE_DURATION = 350; // ms for wipe-out animation

const TypewriterSceneFeed = ({ scenes }: TypewriterSceneFeedProps) => {
  // Queue tracks which scene index we're currently DISPLAYING
  const [displayIndex, setDisplayIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [phase, setPhase] = useState<"typing" | "hold" | "wipe">("typing");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track how many scenes we've already shown so we never skip one
  const shownUpToRef = useRef(0);

  const currentScene = scenes[displayIndex] ?? null;
  const totalAvailable = scenes.length;

  // Build the full text block for the current scene
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

  // Advance to next scene in queue
  const advanceToNext = useCallback(() => {
    const nextIdx = displayIndex + 1;
    if (nextIdx < totalAvailable) {
      setDisplayIndex(nextIdx);
      setCharCount(0);
      setPhase("typing");
      shownUpToRef.current = nextIdx;
    }
    // If no next scene yet, stay idle — the effect below will pick up new arrivals
  }, [displayIndex, totalAvailable]);

  // When new scenes arrive, if we're idle (finished current + no next), start next
  useEffect(() => {
    if (totalAvailable === 0) return;
    // If we haven't started yet
    if (shownUpToRef.current === 0 && totalAvailable > 0) {
      shownUpToRef.current = 0;
      setDisplayIndex(0);
      setCharCount(0);
      setPhase("typing");
      return;
    }
    // If we finished current scene and more are available
    if (phase === "hold" || phase === "wipe") return; // let the cycle handle it
    if (displayIndex < totalAvailable - 1 && phase === "typing" && charCount === 0) return; // already advancing
  }, [totalAvailable]);

  // Typing effect
  useEffect(() => {
    if (phase !== "typing" || !fullText) return;

    intervalRef.current = setInterval(() => {
      setCharCount((prev) => {
        if (prev >= fullText.length) {
          clearInterval(intervalRef.current!);
          setPhase("hold");
          return prev;
        }
        return prev + 1;
      });
    }, CHAR_DELAY);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phase, fullText]);

  // Hold → then wipe if there's a next scene, otherwise stay visible
  useEffect(() => {
    if (phase !== "hold") return;
    const hasNext = displayIndex + 1 < totalAvailable;
    if (!hasNext) {
      // No next scene yet — wait for new scenes to arrive
      // We'll re-check when totalAvailable changes
      return;
    }
    const timer = setTimeout(() => {
      setPhase("wipe");
    }, PAUSE_AFTER_SCENE);
    return () => clearTimeout(timer);
  }, [phase, displayIndex, totalAvailable]);

  // When holding and new scenes arrive, trigger wipe
  useEffect(() => {
    if (phase !== "hold") return;
    if (displayIndex + 1 < totalAvailable) {
      const timer = setTimeout(() => {
        setPhase("wipe");
      }, PAUSE_AFTER_SCENE);
      return () => clearTimeout(timer);
    }
  }, [phase, totalAvailable, displayIndex]);

  // Wipe → advance
  useEffect(() => {
    if (phase !== "wipe") return;
    const timer = setTimeout(() => {
      advanceToNext();
    }, WIPE_DURATION);
    return () => clearTimeout(timer);
  }, [phase, advanceToNext]);

  if (!currentScene) return null;

  const displayedText = fullText.slice(0, charCount);

  return (
    <div className="ml-9 mt-3 relative overflow-hidden rounded-md">
      <div
        className="relative p-4 rounded-md border border-border/50"
        style={{
          backgroundColor: "hsl(var(--card))",
          minHeight: "80px",
        }}
      >
        {/* Wipe overlay */}
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

        {/* Scene counter */}
        <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground tabular-nums">
          Scene {displayIndex + 1} / {totalAvailable}
        </div>
      </div>
    </div>
  );
};

export default TypewriterSceneFeed;
