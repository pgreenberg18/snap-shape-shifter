import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Wand2, Paintbrush, Eraser, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useFilmId } from "@/hooks/useFilm";
import type { Tables } from "@/integrations/supabase/types";

type Clip = Tables<"post_production_clips">;

interface VfxFixItBayProps {
  clip: Clip | null;
  onClose: () => void;
}

const MASK_COLOR = "rgba(220, 38, 38, 0.35)";
const BRUSH_SIZE = 24;

const VfxFixItBay = ({ clip, onClose }: VfxFixItBayProps) => {
  const filmId = useFilmId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const isPainting = useRef(false);
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const [prompt, setPrompt] = useState("");
  const [useLockedAsset, setUseLockedAsset] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [hasMask, setHasMask] = useState(false);

  // Fetch locked assets from registry
  const { data: assets = [] } = useQuery({
    queryKey: ["asset-registry", filmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_identity_registry")
        .select("*")
        .eq("film_id", filmId!)
        .order("display_name");
      if (error) throw error;
      return data;
    },
    enabled: !!filmId && !!clip,
  });

  // Initialize canvases
  useEffect(() => {
    if (!clip) return;
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!canvas || !maskCanvas) return;

    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;

    const w = rect.width;
    const h = rect.height;
    canvas.width = w;
    canvas.height = h;
    maskCanvas.width = w;
    maskCanvas.height = h;

    // Draw a dark frame placeholder
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, w, h);

      // Simulated frame content — grid pattern
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // Center label
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`Frame — ${clip.label}`, w / 2, h / 2);
    }
  }, [clip]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const paint = useCallback((x: number, y: number) => {
    const ctx = maskCanvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.fillStyle = MASK_COLOR;
    ctx.beginPath();
    ctx.arc(x, y, BRUSH_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
    setHasMask(true);
  }, [tool]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isPainting.current = true;
    const { x, y } = getPos(e);
    paint(x, y);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPainting.current) return;
    const { x, y } = getPos(e);
    paint(x, y);
  };

  const handleMouseUp = () => { isPainting.current = false; };

  const clearMask = () => {
    const ctx = maskCanvasRef.current?.getContext("2d");
    if (!ctx || !maskCanvasRef.current) return;
    ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    setHasMask(false);
  };

  const handleRegenerate = () => {
    setIsRegenerating(true);
    // Simulate processing
    setTimeout(() => setIsRegenerating(false), 4000);
  };

  return (
    <Dialog open={!!clip} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[90vw] w-[1200px] h-[85vh] p-0 gap-0 flex flex-col bg-card border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Wand2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-sm font-bold text-foreground">
                VFX Fix-It Bay
              </h2>
              <p className="text-[10px] font-mono text-muted-foreground">
                {clip?.label} · Targeted Inpainting
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Tool toggles */}
            <div className="flex rounded-lg border border-border/60 overflow-hidden">
              <button
                onClick={() => setTool("brush")}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors",
                  tool === "brush"
                    ? "bg-primary/15 text-primary"
                    : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                )}
              >
                <Paintbrush className="h-3 w-3" /> Mask
              </button>
              <button
                onClick={() => setTool("eraser")}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors border-l border-border/60",
                  tool === "eraser"
                    ? "bg-primary/15 text-primary"
                    : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                )}
              >
                <Eraser className="h-3 w-3" /> Erase
              </button>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 text-muted-foreground" onClick={clearMask}>
              <RotateCcw className="h-3 w-3" /> Clear
            </Button>
          </div>
        </div>

        {/* Canvas area */}
        <div className="flex-1 min-h-0 relative bg-black flex items-center justify-center p-4">
          <div className="relative w-full h-full max-w-5xl" style={{ aspectRatio: "16/9" }}>
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full rounded-lg"
            />
            <canvas
              ref={maskCanvasRef}
              className={cn(
                "absolute inset-0 w-full h-full rounded-lg z-10",
                tool === "brush" ? "cursor-crosshair" : "cursor-cell"
              )}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
            {/* Regeneration scanning animation */}
            {isRegenerating && (
              <div className="absolute inset-0 z-20 rounded-lg overflow-hidden">
                <div className="absolute inset-0 bg-black/40" />
                <div className="absolute inset-0 animate-scan-line">
                  <div className="w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_20px_4px_hsl(var(--primary)/0.4)]" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex items-center gap-3 bg-card/90 backdrop-blur-sm border border-border rounded-xl px-5 py-3">
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    <div>
                      <p className="text-xs font-display font-bold text-foreground">Regenerating Region…</p>
                      <p className="text-[10px] font-mono text-muted-foreground">AI inpainting in progress</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom control bar */}
        <div className="border-t border-border bg-secondary/20 px-6 py-4 space-y-3">
          {/* Prompt input */}
          <div className="flex items-center gap-3">
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the fix (e.g., normal human hand with 5 fingers)"
              className="flex-1 h-10 bg-background border-border/60 text-sm font-mono placeholder:text-muted-foreground/40"
            />
            <Button
              onClick={handleRegenerate}
              disabled={isRegenerating || (!hasMask && !prompt)}
              className={cn(
                "h-10 px-6 font-display font-bold text-sm uppercase tracking-wider gap-2",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                "shadow-[0_0_16px_-4px_hsl(51_100%_50%/0.3)] hover:shadow-[0_0_24px_-4px_hsl(51_100%_50%/0.45)]",
                isRegenerating && "animate-pulse"
              )}
            >
              {isRegenerating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
              ) : (
                <><Wand2 className="h-4 w-4" /> Regenerate Region</>
              )}
            </Button>
          </div>

          {/* Asset toggle row */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={useLockedAsset}
                onCheckedChange={setUseLockedAsset}
                id="asset-mode"
              />
              <Label htmlFor="asset-mode" className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground cursor-pointer">
                {useLockedAsset ? "Use Locked Asset" : "Use Custom Text"}
              </Label>
            </div>

            {useLockedAsset && (
              <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
                <SelectTrigger className="w-72 h-8 bg-background border-border/60 text-xs font-mono">
                  <SelectValue placeholder="Select locked asset…" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {assets.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      <span className="text-muted-foreground">No assets registered</span>
                    </SelectItem>
                  ) : (
                    assets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-display font-semibold">{asset.display_name}</span>
                          <span className="text-[9px] text-muted-foreground font-mono">{asset.asset_type} · {asset.internal_ref_code}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VfxFixItBay;
