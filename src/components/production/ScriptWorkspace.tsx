import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Plus, FileText } from "lucide-react";

interface ScriptWorkspaceProps {
  scene: any;
  sceneText?: string;
  onCreateShot: (selectedText: string, characters: string[]) => void;
  height?: number;
  onResizeStart?: (e: React.MouseEvent) => void;
}

const ScriptWorkspace = ({ scene, sceneText, onCreateShot, height, onResizeStart }: ScriptWorkspaceProps) => {
  const [selection, setSelection] = useState("");
  const textRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() || "";
    setSelection(text);
  }, []);

  const handleCreateShot = () => {
    if (!selection) return;
    // Extract character names from the selection (uppercase words before colons or at line starts)
    const characters = [...new Set(
      selection.match(/^([A-Z][A-Z\s'.\-]+)(?:\s*\(.*?\))?\s*$/gm)?.map(c => c.trim().replace(/\s*\(.*?\)\s*$/, "")) ?? []
    )];
    onCreateShot(selection, characters);
    setSelection("");
    window.getSelection()?.removeAllRanges();
  };

  // Format script text with screenplay styling
  const formatScript = (text: string) => {
    if (!text) return null;
    const lines = text.split("\n");
    return lines.map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={i} className="h-4" />;

      // Character name (all caps, possibly with parenthetical)
      if (/^[A-Z][A-Z\s'.\-]+(?:\s*\(.*?\))?\s*$/.test(trimmed) && trimmed.length < 40) {
        return (
          <div key={i} className="text-center mt-4 mb-1">
            <span className="text-foreground font-bold text-[13px]">{trimmed}</span>
          </div>
        );
      }

      // Parenthetical
      if (/^\(.*\)$/.test(trimmed)) {
        return (
          <div key={i} className="text-center text-muted-foreground italic text-[12px] mb-1 px-[30%]">
            {trimmed}
          </div>
        );
      }

      // Dialogue (indented lines after character name)
      const prevNonEmpty = lines.slice(0, i).reverse().find(l => l.trim());
      if (prevNonEmpty && /^[A-Z][A-Z\s'.\-]+(?:\s*\(.*?\))?\s*$/.test(prevNonEmpty.trim())) {
        return (
          <div key={i} className="text-foreground/90 text-[13px] leading-relaxed px-[15%] mb-1">
            {trimmed}
          </div>
        );
      }

      // Action lines
      return (
        <div key={i} className="text-foreground/80 text-[13px] leading-relaxed mb-1">
          {trimmed}
        </div>
      );
    });
  };

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

export default ScriptWorkspace;
