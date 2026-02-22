import { useParams } from "react-router-dom";
import { Camera, Wand2, Image, Type, Volume2 } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import TriStateTabs from "@/components/TriStateTabs";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

const templatePresets = [
  { name: "Wes Anderson", desc: "Symmetrical, pastel palette" },
  { name: "Roger Deakins", desc: "Natural light, wide angles" },
  { name: "Wong Kar-wai", desc: "Neon-soaked, handheld" },
  { name: "Kubrick", desc: "One-point perspective, cold" },
];

const Workspace = () => {
  const { filmId } = useParams();

  return (
    <AppLayout>
      <div className="flex h-full flex-col lg:flex-row">
        {/* Viewport / Canvas */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-3 border-b border-border px-6 py-3">
            <Camera className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-semibold">Shot Composer</h2>
            <span className="ml-auto text-xs text-muted-foreground">Film #{filmId}</span>
          </div>

          <div className="flex flex-1 items-center justify-center bg-background p-8">
            <div className="flex aspect-video w-full max-w-3xl flex-col items-center justify-center rounded-lg border-2 border-dashed border-border cinema-inset">
              <Image className="h-12 w-12 text-muted-foreground/20" />
              <p className="mt-3 font-display text-sm text-muted-foreground">
                Compose your shot using the controls →
              </p>
              <p className="text-xs text-muted-foreground/50 mt-1">16:9 • 1920×1080</p>
            </div>
          </div>

          {/* Timeline strip */}
          <div className="flex h-16 items-center gap-2 border-t border-border bg-card px-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-8 flex-1 rounded-sm bg-secondary border border-border transition-colors hover:border-primary/40 cursor-pointer"
              />
            ))}
          </div>
        </div>

        {/* Control Panel */}
        <div className="w-full border-l border-border bg-card lg:w-96">
          <div className="border-b border-border px-6 py-3">
            <h3 className="font-display text-sm font-semibold">Shot Controls</h3>
          </div>

          <div className="p-6">
            <TriStateTabs
              autoContent={
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Describe your vision and let AI compose the perfect shot.
                  </p>
                  <Textarea
                    placeholder="A sweeping crane shot of a 1920s ballroom, golden chandeliers, couples dancing..."
                    className="min-h-[120px] resize-none bg-secondary border-border"
                  />
                  <Button className="w-full gap-2 cinema-shadow">
                    <Wand2 className="h-4 w-4" />
                    Generate Shot
                  </Button>
                </div>
              }
              templatesContent={
                <div className="grid grid-cols-2 gap-3">
                  {templatePresets.map((preset) => (
                    <button
                      key={preset.name}
                      className="rounded-lg border border-border bg-secondary p-3 text-left transition-all hover:border-primary/40 hover:cinema-glow cinema-inset"
                    >
                      <p className="font-display text-sm font-medium text-foreground">{preset.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{preset.desc}</p>
                    </button>
                  ))}
                </div>
              }
              customContent={
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <Camera className="h-3.5 w-3.5" /> Focal Length
                    </label>
                    <Slider defaultValue={[50]} max={200} min={12} step={1} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>12mm</span><span>200mm</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <Type className="h-3.5 w-3.5" /> Prompt
                    </label>
                    <Textarea
                      placeholder="Raw prompt for fine-grained control..."
                      className="min-h-[80px] resize-none bg-secondary border-border font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <Volume2 className="h-3.5 w-3.5" /> Ambient Audio
                    </label>
                    <Slider defaultValue={[70]} max={100} min={0} step={1} />
                  </div>

                  <Button variant="outline" className="w-full cinema-shadow">
                    Render Shot
                  </Button>
                </div>
              }
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Workspace;
