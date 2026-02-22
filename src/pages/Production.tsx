import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Crosshair, Circle } from "lucide-react";

const Production = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [panSpeed, setPanSpeed] = useState(50);
  const [zoom, setZoom] = useState(30);

  const handleShootTake = useCallback(() => {
    setIsRecording(true);
    setTimeout(() => setIsRecording(false), 3000);
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Top 60% — Viewfinder */}
      <div className="relative flex-[6] bg-black flex items-center justify-center overflow-hidden">
        {/* Safe-action margin */}
        <div className="absolute inset-6 border border-white/10 rounded pointer-events-none" />
        <div className="absolute inset-12 border border-white/5 rounded pointer-events-none" />

        {/* Crosshairs */}
        <Crosshair className="h-12 w-12 text-white/20" />

        {/* HUD corners */}
        <div className="absolute top-4 left-4 text-[10px] font-mono text-white/30 space-y-0.5">
          <p>SC: 01 | TK: —</p>
          <p>24fps | 4096×2160</p>
        </div>
        <div className="absolute top-4 right-4 text-[10px] font-mono text-white/30">
          ISO 800 | f/2.8
        </div>
        <div className="absolute bottom-4 left-4 text-[10px] font-mono text-white/30">
          00:00:00:00
        </div>

        {/* REC indicator */}
        {isRecording && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 animate-pulse">
            <Circle className="h-3 w-3 fill-red-500 text-red-500" />
            <span className="text-xs font-mono font-bold text-red-500">REC</span>
          </div>
        )}
      </div>

      {/* Bottom 40% — Control Deck */}
      <div className="flex-[4] bg-card border-t border-border p-6 overflow-y-auto">
        <Tabs defaultValue="auto" className="w-full">
          <TabsList className="w-full max-w-md bg-secondary mb-6">
            <TabsTrigger value="auto" className="flex-1">Auto</TabsTrigger>
            <TabsTrigger value="templates" className="flex-1">Templates</TabsTrigger>
            <TabsTrigger value="custom" className="flex-1">Custom</TabsTrigger>
          </TabsList>

          <TabsContent value="auto">
            <div className="text-center py-8">
              <p className="font-display font-semibold">AI Camera Operator</p>
              <p className="text-sm text-muted-foreground mt-1">Camera movement will be auto-generated from scene description.</p>
            </div>
          </TabsContent>

          <TabsContent value="templates">
            <div className="grid grid-cols-4 gap-3">
              {["Dolly In", "Crane Up", "Steadicam Walk", "Whip Pan", "Push In", "Pull Out", "Dutch Tilt", "Orbit"].map((t) => (
                <button
                  key={t}
                  className="rounded-lg border border-border bg-secondary p-3 text-xs font-medium hover:border-primary/50 transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="custom">
            <div className="grid grid-cols-2 gap-6">
              {/* Skeuomorphic sliders */}
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Pan Speed — {panSpeed}%
                  </label>
                  <div className="relative h-3 rounded-full bg-gradient-to-r from-secondary to-accent overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${panSpeed}%`,
                        background: "linear-gradient(to right, hsl(51 100% 50% / 0.6), hsl(51 100% 50%))",
                      }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={panSpeed}
                      onChange={(e) => setPanSpeed(Number(e.target.value))}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer"
                    />
                  </div>
                  {/* Metallic grab handle indicator */}
                  <div className="flex justify-start" style={{ paddingLeft: `calc(${panSpeed}% - 8px)` }}>
                    <div className="h-5 w-4 rounded-sm bg-gradient-to-b from-gray-300 to-gray-500 border border-gray-400 shadow-md" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Zoom — {zoom}%
                  </label>
                  <div className="relative h-3 rounded-full bg-gradient-to-r from-secondary to-accent overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${zoom}%`,
                        background: "linear-gradient(to right, hsl(51 100% 50% / 0.6), hsl(51 100% 50%))",
                      }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <div className="flex justify-start" style={{ paddingLeft: `calc(${zoom}% - 8px)` }}>
                    <div className="h-5 w-4 rounded-sm bg-gradient-to-b from-gray-300 to-gray-500 border border-gray-400 shadow-md" />
                  </div>
                </div>
              </div>

              {/* JSON Prompt Injection */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Raw Prompt (JSON)
                </label>
                <Textarea
                  className="h-32 font-mono text-xs bg-secondary border-border resize-none"
                  placeholder='{"camera_motion": "dolly_in", "speed": 0.5, "easing": "ease-in-out"}'
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Shoot Take Button */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleShootTake}
            disabled={isRecording}
            className="relative rounded-full px-12 py-3.5 font-display font-bold text-white text-sm uppercase tracking-wider transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: isRecording
                ? "linear-gradient(180deg, #993D5C, #662244)"
                : "linear-gradient(180deg, #FF3366, #CC1144)",
              boxShadow: isRecording
                ? "inset 0 2px 6px hsl(0 0% 0% / 0.4)"
                : "inset 0 1px 0 hsl(0 0% 100% / 0.15), 0 4px 16px hsl(345 100% 40% / 0.4)",
            }}
          >
            {isRecording ? "● Recording…" : "⏺ Shoot Take"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Production;
