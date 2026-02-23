import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Aperture, Crosshair, Focus, ScanLine, ChevronDown } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/* ── Constants ── */
const SENSORS = [
  { value: "arri-alexa-35", label: "ARRI Alexa 35", detail: "4.6K / 17 stops" },
  { value: "red-v-raptor", label: "RED V-Raptor", detail: "8K VV / DSMC3" },
  { value: "sony-venice-2", label: "Sony Venice 2", detail: "8.6K / Dual ISO" },
  { value: "kodak-vision3", label: "35mm Kodak Vision3", detail: "Film Stock / 500T" },
];

const LENSES = [
  { value: "spherical-prime", label: "Spherical Prime", detail: "Sharp / Neutral" },
  { value: "anamorphic-prime", label: "Anamorphic Prime", detail: "2.39:1 / Flares" },
  { value: "cine-zoom", label: "Cine Zoom", detail: "Variable FL" },
  { value: "vintage-glass", label: "Vintage Glass", detail: "Character / Soft" },
];

const APERTURES = [
  "T/1.2", "T/1.4", "T/2", "T/2.8", "T/4", "T/5.6", "T/8", "T/11", "T/16", "T/22",
];

const FOCAL_TICKS = [
  { mm: 12, label: "12" },
  { mm: 24, label: "24" },
  { mm: 35, label: "35" },
  { mm: 50, label: "50" },
  { mm: 85, label: "85" },
  { mm: 135, label: "135" },
  { mm: 200, label: "200" },
];

type TriState = "auto" | "templates" | "custom";

interface OpticsSuitePanelProps {
  onAspectRatioChange: (ratio: number) => void;
}

const OpticsSuitePanel = ({ onAspectRatioChange }: OpticsSuitePanelProps) => {
  const [mode, setMode] = useState<TriState>("custom");
  const [sensor, setSensor] = useState("arri-alexa-35");
  const [lens, setLens] = useState("spherical-prime");
  const [focalLength, setFocalLength] = useState([50]);
  const [aperture, setAperture] = useState("T/2.8");

  // Crucial logic hook: anamorphic squeeze
  useEffect(() => {
    if (lens === "anamorphic-prime") {
      onAspectRatioChange(2.39);
    } else {
      onAspectRatioChange(16 / 9);
    }
  }, [lens, onAspectRatioChange]);

  const focalLabel = useCallback((mm: number) => {
    if (mm <= 18) return "Ultra-wide";
    if (mm <= 28) return "Wide";
    if (mm <= 40) return "Moderate";
    if (mm <= 60) return "Normal";
    if (mm <= 100) return "Portrait";
    return "Telephoto";
  }, []);

  return (
    <div className="w-[300px] min-w-[280px] border-l border-border/50 bg-[hsl(var(--card))] flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 bg-[hsl(var(--card))]">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-primary" />
          <h2 className="font-display text-xs font-bold uppercase tracking-[0.15em] text-foreground">
            Camera & Optics
          </h2>
        </div>
        <p className="text-[9px] text-muted-foreground/60 mt-0.5 tracking-wide">
          Optic & Sensor Suite
        </p>
      </div>

      {/* Tri-State Toggle */}
      <div className="px-4 py-3 border-b border-border/50">
        <div className="flex rounded-lg bg-secondary/80 p-0.5 border border-border/50">
          {(["auto", "templates", "custom"] as TriState[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 py-1.5 text-[10px] font-display font-bold uppercase tracking-widest rounded-md transition-all duration-200",
                mode === m
                  ? "bg-primary text-primary-foreground shadow-[0_0_12px_-2px_hsl(var(--primary)/0.4)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {mode === "auto" && (
          <div className="p-4 space-y-3">
            <div className="rounded-lg border border-border/40 bg-secondary/30 p-4 text-center">
              <Aperture className="h-8 w-8 text-primary/40 mx-auto mb-2" />
              <p className="text-xs font-display font-semibold text-foreground">Auto Mode</p>
              <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                Camera settings will be automatically determined from the scene's visual design notes and AI generation templates.
              </p>
            </div>
          </div>
        )}

        {mode === "templates" && (
          <div className="p-4 space-y-3">
            <div className="rounded-lg border border-border/40 bg-secondary/30 p-4 text-center">
              <ScanLine className="h-8 w-8 text-primary/40 mx-auto mb-2" />
              <p className="text-xs font-display font-semibold text-foreground">Templates</p>
              <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                Select from preset camera packages: Documentary Vérité, Blockbuster Widescreen, Indie Handheld, Music Video.
              </p>
            </div>
            {["Documentary Vérité", "Blockbuster Widescreen", "Indie Handheld", "Music Video"].map((tmpl) => (
              <button
                key={tmpl}
                className="w-full text-left rounded-lg border border-border/40 bg-secondary/20 hover:bg-primary/5 hover:border-primary/30 p-3 transition-all"
              >
                <p className="text-xs font-display font-semibold text-foreground">{tmpl}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Pre-configured sensor + lens package</p>
              </button>
            ))}
          </div>
        )}

        {mode === "custom" && (
          <div className="p-4 space-y-5">
            {/* ── Sensor Profile ── */}
            <ControlGroup icon={ScanLine} label="Sensor Profile">
              <Select value={sensor} onValueChange={setSensor}>
                <SelectTrigger className="h-9 bg-background border-border/60 text-sm font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {SENSORS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-semibold">{s.label}</span>
                        <span className="text-[9px] text-muted-foreground font-mono">{s.detail}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ControlGroup>

            {/* ── Lens Type ── */}
            <ControlGroup icon={Focus} label="Lens Type">
              <Select value={lens} onValueChange={setLens}>
                <SelectTrigger className="h-9 bg-background border-border/60 text-sm font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {LENSES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-semibold">{l.label}</span>
                        <span className="text-[9px] text-muted-foreground font-mono">{l.detail}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lens === "anamorphic-prime" && (
                <div className="mt-1.5 flex items-center gap-1.5 px-2 py-1 rounded bg-primary/10 border border-primary/20">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-[9px] font-mono font-bold text-primary tracking-wider">
                    ANAMORPHIC SQUEEZE → 2.39:1
                  </span>
                </div>
              )}
            </ControlGroup>

            {/* ── Focal Length ── */}
            <ControlGroup icon={Crosshair} label="Focal Length">
              <div className="space-y-3">
                {/* Value display */}
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-lg font-bold text-primary tabular-nums">
                    {focalLength[0]}mm
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
                    {focalLabel(focalLength[0])}
                  </span>
                </div>

                {/* Slider */}
                <div className="relative">
                  <Slider
                    value={focalLength}
                    onValueChange={setFocalLength}
                    min={12}
                    max={200}
                    step={1}
                    className="fader-slider"
                  />
                  {/* Tick marks */}
                  <div className="relative h-4 mt-1">
                    {FOCAL_TICKS.map((tick) => {
                      const pct = ((tick.mm - 12) / (200 - 12)) * 100;
                      return (
                        <button
                          key={tick.mm}
                          onClick={() => setFocalLength([tick.mm])}
                          className="absolute -translate-x-1/2 flex flex-col items-center group"
                          style={{ left: `${pct}%` }}
                        >
                          <div className={cn(
                            "w-px h-2 transition-colors",
                            focalLength[0] === tick.mm ? "bg-primary" : "bg-muted-foreground/30 group-hover:bg-muted-foreground"
                          )} />
                          <span className={cn(
                            "text-[8px] font-mono mt-0.5 transition-colors",
                            focalLength[0] === tick.mm ? "text-primary font-bold" : "text-muted-foreground/50 group-hover:text-muted-foreground"
                          )}>
                            {tick.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </ControlGroup>

            {/* ── Aperture (T-Stop) ── */}
            <ControlGroup icon={Aperture} label="Aperture (T-Stop)">
              <div className="space-y-2">
                <Select value={aperture} onValueChange={setAperture}>
                  <SelectTrigger className="h-9 bg-background border-border/60 text-sm font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50">
                    {APERTURES.map((a) => (
                      <SelectItem key={a} value={a}>
                        <span className="font-mono font-bold">{a}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Aperture visualization — iris blades */}
                <div className="flex items-center justify-center py-3">
                  <div className="relative">
                    {/* Outer ring */}
                    <div className="h-16 w-16 rounded-full border-2 border-muted-foreground/20 flex items-center justify-center">
                      {/* Iris opening */}
                      <div
                        className="rounded-full bg-primary/20 border border-primary/40 transition-all duration-500 ease-out"
                        style={{
                          width: `${Math.max(8, 56 * (1 - APERTURES.indexOf(aperture) / (APERTURES.length - 1)))}px`,
                          height: `${Math.max(8, 56 * (1 - APERTURES.indexOf(aperture) / (APERTURES.length - 1)))}px`,
                        }}
                      />
                    </div>
                    {/* Label */}
                    <div className="absolute -bottom-5 left-1/2 -translate-x-1/2">
                      <span className="text-[9px] font-mono font-bold text-primary tracking-wider">
                        {aperture}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </ControlGroup>

            {/* ── Readout Footer ── */}
            <div className="rounded-lg border border-border/40 bg-secondary/20 p-3 mt-2">
              <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Active Configuration
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <ReadoutRow label="Sensor" value={SENSORS.find(s => s.value === sensor)?.label ?? sensor} />
                <ReadoutRow label="Lens" value={LENSES.find(l => l.value === lens)?.label ?? lens} />
                <ReadoutRow label="Focal" value={`${focalLength[0]}mm`} />
                <ReadoutRow label="T-Stop" value={aperture} />
                <ReadoutRow label="Aspect" value={lens === "anamorphic-prime" ? "2.39:1" : "16:9"} />
              </div>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

/* ── Control Group wrapper ── */
const ControlGroup = ({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-1.5">
      <Icon className="h-3 w-3 text-primary/70" />
      <span className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
    </div>
    {children}
  </div>
);

/* ── Readout Row ── */
const ReadoutRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between">
    <span className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground/60">{label}</span>
    <span className="text-[9px] font-mono font-bold text-foreground">{value}</span>
  </div>
);

export default OpticsSuitePanel;
