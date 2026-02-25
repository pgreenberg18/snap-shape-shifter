import { useState, useCallback, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, FileText } from "lucide-react";
import { SHOT_COLORS } from "@/lib/shot-colors";

interface ShotHighlight {
  shotId: string;
  promptText: string;
  colorIndex: number; // index within scene → mod 3 for color
}

interface ScriptWorkspaceProps {
  scene: any;
  sceneText?: string;
  onCreateShot: (selectedText: string, characters: string[]) => void;
  height?: number;
  onResizeStart?: (e: React.MouseEvent) => void;
  shotHighlights?: ShotHighlight[];
}

/** Check if a line is a scene slugline (INT./EXT. heading) */
const isSlugline = (line: string) =>
  /^\s*(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/.test(line.trim().toUpperCase());

/**
 * Clamp the user's selection so it cannot include the slugline
 * or any whitespace before/after the scene body.
 */
function clampSelection(textEl: HTMLDivElement): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return "";

  const text = sel.toString().trim();
  if (!text) return "";

  // Check if the selection overlaps any element with data-slugline
  const range = sel.getRangeAt(0);
  const sluglines = textEl.querySelectorAll("[data-slugline]");
  for (const sl of sluglines) {
    if (range.intersectsNode(sl)) {
      // Remove the slugline text from the selection or reject entirely
      // Strategy: reject if selection is entirely within slugline
      const slRange = document.createRange();
      slRange.selectNodeContents(sl);
      if (
        range.compareBoundaryPoints(Range.START_TO_START, slRange) >= 0 &&
        range.compareBoundaryPoints(Range.END_TO_END, slRange) <= 0
      ) {
        return ""; // entirely inside slugline
      }
      // Partial overlap – trim the slugline portion
      const slugText = sl.textContent || "";
      return text.replace(slugText, "").trim();
    }
  }

  // Also strip leading/trailing blank lines
  return text.replace(/^\s+|\s+$/g, " ").trim();
}

/**
 * For a given line of text, find which shots reference it.
 * Returns an array of color indices (max 3).
 */
function getLineHighlights(
  lineText: string,
  shotHighlights: ShotHighlight[]
): number[] {
  if (!lineText.trim()) return [];
  const colors: number[] = [];
  for (const sh of shotHighlights) {
    if (!sh.promptText) continue;
    // Check if this line's text appears within the shot's selected text
    const normalizedLine = lineText.trim().toLowerCase();
    const normalizedPrompt = sh.promptText.toLowerCase();
    if (normalizedPrompt.includes(normalizedLine) && normalizedLine.length > 2) {
      colors.push(sh.colorIndex % SHOT_COLORS.length);
      if (colors.length >= 3) break;
    }
  }
  return [...new Set(colors)]; // dedupe
}

const ScriptWorkspace = ({
  scene,
  sceneText,
  onCreateShot,
  height,
  onResizeStart,
  shotHighlights = [],
}: ScriptWorkspaceProps) => {
  const [selection, setSelection] = useState("");
  const textRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = useCallback(() => {
    if (!textRef.current) return;
    const text = clampSelection(textRef.current);
    setSelection(text);
  }, []);

  const handleCreateShot = () => {
    if (!selection) return;
    const characters = [
      ...new Set(
        selection
          .match(/^([A-Z][A-Z\s'.\-]+)(?:\s*\(.*?\))?\s*$/gm)
          ?.map((c) => c.trim().replace(/\s*\(.*?\)\s*$/, "")) ?? []
      ),
    ];
    onCreateShot(selection, characters);
    setSelection("");
    window.getSelection()?.removeAllRanges();
  };

  // Format script text with screenplay styling + highlight underlines
  const formatScript = useCallback(
    (text: string) => {
      if (!text) return null;
      const lines = text.split("\n");
      return lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-4" />;

        // Detect slugline
        if (isSlugline(trimmed)) {
          return (
            <div
              key={i}
              data-slugline
              className="mt-4 mb-2 select-none cursor-default"
            >
              <span className="text-foreground font-bold text-[13px] uppercase tracking-wide select-none pointer-events-none opacity-60">
                {trimmed}
              </span>
            </div>
          );
        }

        // Get highlight colors for this line
        const highlights = getLineHighlights(trimmed, shotHighlights);

        // Character name
        if (
          /^[A-Z][A-Z\s'.\-]+(?:\s*\(.*?\))?\s*$/.test(trimmed) &&
          trimmed.length < 40
        ) {
          return (
            <ScriptLine key={i} highlights={highlights}>
              <div className="text-center mt-4 mb-1">
                <span className="text-foreground font-bold text-[13px]">
                  {trimmed}
                </span>
              </div>
            </ScriptLine>
          );
        }

        // Parenthetical
        if (/^\(.*\)$/.test(trimmed)) {
          return (
            <ScriptLine key={i} highlights={highlights}>
              <div className="text-center text-muted-foreground italic text-[12px] mb-1 px-[30%]">
                {trimmed}
              </div>
            </ScriptLine>
          );
        }

        // Dialogue (after character name)
        const prevNonEmpty = lines
          .slice(0, i)
          .reverse()
          .find((l) => l.trim());
        if (
          prevNonEmpty &&
          /^[A-Z][A-Z\s'.\-]+(?:\s*\(.*?\))?\s*$/.test(prevNonEmpty.trim())
        ) {
          return (
            <ScriptLine key={i} highlights={highlights}>
              <div className="text-foreground/90 text-[13px] leading-relaxed px-[15%] mb-1">
                {trimmed}
              </div>
            </ScriptLine>
          );
        }

        // Action lines
        return (
          <ScriptLine key={i} highlights={highlights}>
            <div className="text-foreground/80 text-[13px] leading-relaxed mb-1">
              {trimmed}
            </div>
          </ScriptLine>
        );
      });
    },
    [shotHighlights]
  );

  return (
    <div className="flex flex-col border-b border-border bg-card/50">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50">
        <FileText className="h-3.5 w-3.5 text-primary/70" />
        <span className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground">
          Script
        </span>
        <span className="text-[9px] font-mono text-muted-foreground/50 ml-1">
          Scene {scene?.scene_number ?? "—"}
        </span>
        {selection && (
          <Button
            size="sm"
            onClick={handleCreateShot}
            className="ml-auto h-7 text-[10px] font-display font-bold uppercase tracking-wider gap-1.5 cinema-inset active:translate-y-px"
          >
            <Plus className="h-3 w-3" /> Create Shot from Selection
          </Button>
        )}
      </div>

      {/* Script text */}
      <ScrollArea style={{ height: height ?? 192 }} className="min-h-[100px]">
        <div
          ref={textRef}
          onMouseUp={handleMouseUp}
          className="px-8 py-4 font-mono text-[13px] leading-relaxed select-text cursor-text"
          style={{ fontFamily: "'Courier Prime', 'Courier New', monospace" }}
        >
          {sceneText ? (
            formatScript(sceneText)
          ) : scene?.description ? (
            <p className="text-foreground/80">{scene.description}</p>
          ) : (
            <p className="text-muted-foreground/50 italic text-center py-8">
              No script text available for this scene.
            </p>
          )}
        </div>
      </ScrollArea>

      {/* Bottom resize handle */}
      {onResizeStart && (
        <div
          onMouseDown={onResizeStart}
          className="h-1.5 cursor-row-resize bg-border/30 hover:bg-primary/30 transition-colors shrink-0"
        />
      )}
    </div>
  );
};

/**
 * Wraps a script line and renders up to 3 colored underlines.
 * Line 1 (bottom), Line 2 (middle), Line 3 (top of text).
 */
const ScriptLine = ({
  children,
  highlights,
}: {
  children: React.ReactNode;
  highlights: number[];
}) => {
  if (highlights.length === 0) return <>{children}</>;

  return (
    <div className="relative">
      {children}
      {/* Underline bars – positioned relative to the text block */}
      <div className="absolute left-0 right-0 bottom-0 pointer-events-none" style={{ height: "6px" }}>
        {highlights.map((colorIdx, i) => {
          const color = SHOT_COLORS[colorIdx];
          // Position: 0 = bottom, 1 = middle of text area, 2 = top area
          const positionMap: Record<number, string> = {
            0: "100%",  // bottom edge
            1: "50%",   // middle
            2: "0%",    // top
          };
          return (
            <div
              key={colorIdx}
              className="absolute left-0 right-0"
              style={{
                bottom: i === 0 ? "0px" : undefined,
                top: i === 1 ? "-8px" : i === 2 ? "-16px" : undefined,
                height: "3px",
                backgroundColor: `hsl(${color.hsl})`,
                opacity: 0.7,
                borderRadius: "1px",
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export default ScriptWorkspace;
export type { ShotHighlight };
