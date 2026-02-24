import { useEffect, useState, useRef, useMemo } from "react";

interface SceneInfo {
  scene_number: number;
  heading: string;
  description?: string | null;
  characters?: string[] | null;
}

interface TypewriterSceneFeedProps {
  scenes: SceneInfo[];
}

const CHAR_DELAY = 18; // ms per character
const PAUSE_AFTER_SCENE = 1200; // ms to hold the finished scene
const WIPE_DURATION = 400; // ms for wipe-out animation

const TypewriterSceneFeed = ({ scenes }: TypewriterSceneFeedProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [phase, setPhase] = useState<"typing" | "hold" | "wipe" | "idle">("typing");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevLengthRef = useRef(0);

  // When new scenes arrive, jump to the latest one
  useEffect(() => {
    if (scenes.length > prevLengthRef.current && scenes.length > 0) {
      const newIdx = scenes.length - 1;
      setCurrentIndex(newIdx);
      setCharCount(0);
      setPhase("typing");
    }
    prevLengthRef.current = scenes.length;
  }, [scenes.length]);

  const currentScene = scenes[currentIndex];

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

  // Hold then wipe (only if there will be more scenes — otherwise just hold)
  useEffect(() => {
    if (phase !== "hold") return;
    const timer = setTimeout(() => {
      // Only wipe if there's a next scene queued (driven by new scenes arriving)
      setPhase("idle");
    }, PAUSE_AFTER_SCENE);
    return () => clearTimeout(timer);
  }, [phase]);

  // Trigger wipe when a new scene arrives while idle/hold
  useEffect(() => {
    if (phase === "wipe") {
      const timer = setTimeout(() => {
        setCharCount(0);
        setPhase("typing");
      }, WIPE_DURATION);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  if (!currentScene) return null;

  const displayedText = fullText.slice(0, charCount);
  const isWiping = phase === "wipe";

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
        {isWiping && (
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
          {currentIndex + 1} / {scenes.length}
        </div>
      </div>
    </div>
  );
};

export default TypewriterSceneFeed;
