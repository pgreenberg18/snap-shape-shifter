import { useState } from "react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Sparkles, Film, Gauge, Scan } from "lucide-react";

const MODELS = [
  { value: "proteus", label: "Proteus", detail: "Best for AI-generated video — fine-grained artifact control" },
  { value: "astra", label: "Astra (GenAI)", detail: "Fixes AI-specific melting/distortion artifacts" },
  { value: "iris", label: "Iris", detail: "Human face specialist — facial recovery & detail" },
  { value: "gaia", label: "Gaia", detail: "High-contrast CGI & Sci-Fi edge preservation" },
  { value: "starlight", label: "Starlight", detail: "Diffusion-based low-light de-noising" },
  { value: "rhea-xl", label: "Rhea XL", detail: "Best 4K upscale for fabric & skin textures" },
];

const INTERPOLATION_MODELS = [
  { value: "apollo", label: "Apollo", detail: "Smooth motion — ideal for 24fps" },
  { value: "chronos", label: "Chronos", detail: "Fast action — ideal for 60fps" },
];

export default function TopazDIPanel() {
  // Model
  const [model, setModel] = useState("proteus");
  // Enhancement sliders
  const [recoverDetail, setRecoverDetail] = useState([40]);
  const [sharpen, setSharpen] = useState([15]);
  const [reduceNoise, setReduceNoise] = useState([20]);
  const [dehalo, setDehalo] = useState([10]);
  const [antiAlias, setAntiAlias] = useState([25]);
  const [recoverOriginal, setRecoverOriginal] = useState([15]);
  // Grain
  const [grainAmount, setGrainAmount] = useState([2.5]);
  const [grainSize, setGrainSize] = useState("small");
  // Frame interpolation
  const [interpEnabled, setInterpEnabled] = useState(false);
  const [interpModel, setInterpModel] = useState("apollo");
  const [targetFps, setTargetFps] = useState("24");
  const [motionBlur, setMotionBlur] = useState(false);

  // Sections
  const [enhanceOpen, setEnhanceOpen] = useState(true);
  const [grainOpen, setGrainOpen] = useState(false);
  const [interpOpen, setInterpOpen] = useState(false);

  const SliderRow = ({ label, value, onChange, min = 0, max = 100, step = 1, unit = "%" }: {
    label: string; value: number[]; onChange: (v: number[]) => void; min?: number; max?: number; step?: number; unit?: string;
  }) => (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline">
        <span className="text-[10px] font-display font-semibold text-foreground/80">{label}</span>
        <span className="text-[9px] font-mono tabular-nums text-primary">{value[0]}{unit}</span>
      </div>
      <Slider value={value} onValueChange={onChange} min={min} max={max} step={step} />
    </div>
  );

  return (
    <div className="rounded-lg border border-border bg-card cinema-inset">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <div>
          <h3 className="font-display text-sm font-bold">Topaz DI Engine</h3>
          <p className="text-[9px] font-mono text-muted-foreground">4K Upscale & Enhancement</p>
        </div>
      </div>

      {/* Model Selection */}
      <div className="px-4 py-3 border-b border-border/40">
        <Label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1.5 block">
          Enhancement Model
        </Label>
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger className="h-9 text-sm font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                <div>
                  <span className="font-display font-semibold">{m.label}</span>
                  <span className="text-[9px] text-muted-foreground font-mono ml-2">{m.detail}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Enhancement Sliders */}
      <Collapsible open={enhanceOpen} onOpenChange={setEnhanceOpen}>
        <CollapsibleTrigger className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-secondary/40 transition-colors">
          <Scan className={cn("h-3.5 w-3.5 transition-colors", enhanceOpen ? "text-primary" : "text-muted-foreground")} />
          <span className={cn("text-[10px] font-display font-bold uppercase tracking-wider flex-1 text-left", enhanceOpen ? "text-foreground" : "text-muted-foreground")}>
            Enhancement Sliders
          </span>
          <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform duration-200", enhanceOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-3 space-y-3">
            <SliderRow label="Recover Detail" value={recoverDetail} onChange={setRecoverDetail} />
            <SliderRow label="Sharpen" value={sharpen} onChange={setSharpen} />
            <SliderRow label="Reduce Noise" value={reduceNoise} onChange={setReduceNoise} />
            <SliderRow label="De-halo" value={dehalo} onChange={setDehalo} />
            <SliderRow label="Anti-Aliasing" value={antiAlias} onChange={setAntiAlias} />
            <SliderRow label="Recover Original" value={recoverOriginal} onChange={setRecoverOriginal} />
            <p className="text-[8px] text-muted-foreground/50 font-mono leading-relaxed">
              Tip: If characters look waxy, increase "Recover Detail" to 40%. Use "De-halo" for backlit scenes.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Cinematic Grain */}
      <Collapsible open={grainOpen} onOpenChange={setGrainOpen}>
        <CollapsibleTrigger className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-secondary/40 transition-colors border-t border-border/30">
          <Film className={cn("h-3.5 w-3.5 transition-colors", grainOpen ? "text-primary" : "text-muted-foreground")} />
          <span className={cn("text-[10px] font-display font-bold uppercase tracking-wider flex-1 text-left", grainOpen ? "text-foreground" : "text-muted-foreground")}>
            Cinematic Grain
          </span>
          <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform duration-200", grainOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-3 space-y-3">
            <SliderRow label="Grain Amount" value={grainAmount} onChange={setGrainAmount} min={0} max={10} step={0.5} unit="" />
            <div className="flex justify-between text-[8px] font-mono text-muted-foreground/50 -mt-1">
              <span>Clean (0)</span>
              <span>Heavy 16mm (10)</span>
            </div>
            <div>
              <Label className="text-[10px] font-display font-semibold text-foreground/80 mb-1 block">Grain Size</Label>
              <div className="flex gap-1.5">
                {[
                  { value: "small", label: "Small", detail: "Modern 35mm" },
                  { value: "medium", label: "Medium", detail: "Classic 35mm" },
                  { value: "large", label: "Large", detail: "Vintage 70s" },
                ].map((g) => (
                  <button
                    key={g.value}
                    onClick={() => setGrainSize(g.value)}
                    className={cn(
                      "flex-1 py-2 px-1 rounded-md border text-center transition-all duration-150",
                      "cinema-inset active:translate-y-px",
                      grainSize === g.value
                        ? "bg-primary/15 border-primary/50"
                        : "bg-secondary/60 border-border/50 hover:border-border"
                    )}
                  >
                    <span className={cn(
                      "block text-[10px] font-display font-semibold",
                      grainSize === g.value ? "text-primary" : "text-foreground"
                    )}>
                      {g.label}
                    </span>
                    <span className={cn(
                      "block text-[8px] font-mono mt-0.5",
                      grainSize === g.value ? "text-primary/70" : "text-muted-foreground"
                    )}>
                      {g.detail}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Frame Interpolation */}
      <Collapsible open={interpOpen} onOpenChange={setInterpOpen}>
        <CollapsibleTrigger className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-secondary/40 transition-colors border-t border-border/30">
          <Gauge className={cn("h-3.5 w-3.5 transition-colors", interpOpen ? "text-primary" : "text-muted-foreground")} />
          <span className={cn("text-[10px] font-display font-bold uppercase tracking-wider flex-1 text-left", interpOpen ? "text-foreground" : "text-muted-foreground")}>
            Frame Interpolation
          </span>
          <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform duration-200", interpOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-3 space-y-3">
            <div className="flex items-center justify-between rounded-md bg-secondary/50 border border-border/50 px-3 py-2 cinema-inset">
              <div className="flex items-center gap-2">
                <Switch id="interp" checked={interpEnabled} onCheckedChange={setInterpEnabled} />
                <Label htmlFor="interp" className="text-[10px] cursor-pointer">Enable Frame Interpolation</Label>
              </div>
            </div>

            {interpEnabled && (
              <>
                <div>
                  <Label className="text-[9px] font-mono text-muted-foreground mb-1 block">Interpolation Model</Label>
                  <Select value={interpModel} onValueChange={setInterpModel}>
                    <SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INTERPOLATION_MODELS.map((m) => (
                        <SelectItem key={m.value} value={m.value} className="text-[10px]">
                          <span className="font-display font-semibold">{m.label}</span>
                          <span className="text-[9px] text-muted-foreground ml-2">{m.detail}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[9px] font-mono text-muted-foreground mb-1 block">Target FPS</Label>
                  <Select value={targetFps} onValueChange={setTargetFps}>
                    <SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["23.976", "24", "25", "30", "48", "60"].map((f) => (
                        <SelectItem key={f} value={f} className="text-[10px]">{f} fps</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="mblur" checked={motionBlur} onCheckedChange={setMotionBlur} />
                  <Label htmlFor="mblur" className="text-[9px] cursor-pointer">Motion Blur Compensation</Label>
                </div>
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
