import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Aperture, Crosshair, Focus, ScanLine, Sun, Move, Sparkles } from "lucide-react";
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

const LIGHTING_SETUPS = [
  { value: "three-point", label: "Three-Point", detail: "Key / Fill / Back" },
  { value: "high-key", label: "High-Key", detail: "Bright / Low Contrast" },
  { value: "low-key", label: "Low-Key", detail: "Dark / High Contrast" },
  { value: "rembrandt", label: "Rembrandt", detail: "Triangle Shadow" },
  { value: "backlit", label: "Backlit", detail: "Rim / Silhouette" },
  { value: "chiaroscuro", label: "Chiaroscuro", detail: "Dramatic / Baroque" },
];

const RIGGING_OPTIONS = [
  { value: "static", label: "Static / Locked", detail: "Tripod" },
  { value: "handheld", label: "Handheld", detail: "Organic Shake" },
  { value: "steadicam", label: "Steadicam", detail: "Smooth Glide" },
  { value: "crane-sweep", label: "Crane Sweep", detail: "Vertical Arc" },
  { value: "dolly-push", label: "Dolly Push-in", detail: "Track Move" },
];

const SHUTTER_ANGLES = [
  { value: "45", label: "45°", detail: "Staccato" },
  { value: "180", label: "180°", detail: "Standard" },
  { value: "360", label: "360°", detail: "Blur" },
];

const TEXTURE_OPTIONS = [
  { value: "promist", label: "Pro-mist / Halation" },
  { value: "grain", label: "35mm Grain" },
  { value: "vhs", label: "VHS Degradation" },
];

type TriState = "auto" | "templates" | "custom";

interface OpticsSuitePanelProps {
  onAspectRatioChange: (ratio: number) => void;
}

const OpticsSuitePanel = ({ onAspectRatioChange }: OpticsSuitePanelProps) => {
  const [mode, setMode] = useState<TriState>("custom");
  // Camera & Optics
  const [sensor, setSensor] = useState("arri-alexa-35");
  const [lens, setLens] = useState("spherical-prime");
  const [focalLength, setFocalLength] = useState([50]);
  const [aperture, setAperture] = useState("T/2.8");
  // Lighting
  const [lightingSetup, setLightingSetup] = useState("three-point");
  const [colorTemp, setColorTemp] = useState([4400]);
  // Camera Dynamics
  const [rigging, setRigging] = useState("static");
  const [shutterAngle, setShutterAngle] = useState("180");
  const [textures, setTextures] = useState<string[]>([]);

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

  const toggleTexture = useCallback((value: string) => {
    setTextures((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  }, []);

  const colorTempLabel = (k: number) => {
    if (k <= 3400) return "Tungsten";
    if (k <= 4000) return "Warm";
    if (k <= 4800) return "Neutral";
    if (k <= 5200) return "Daylight";
    return "Cool";
  };

  return (
    <div className="w-[300px] min-w-[280px] border-l border-border/50 bg-card flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-primary" />
          <h2 className="font-display text-xs font-bold uppercase tracking-[0.15em] text-foreground">
            Camera & Optics
          </h2>
        </div>
        <p className="text-[9px] text-muted-foreground/60 mt-0.5 tracking-wide">
          Master Control Deck
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
                className="w-full text-left rounded-lg border border-border/40 bg-secondary/20 hover:bg-primary/5 hover:border-primary/30 p-3 transition-all active:translate-y-px"
              >
                <p className="text-xs font-display font-semibold text-foreground">{tmpl}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Pre-configured sensor + lens package</p>
              </button>
            ))}
          </div>
        )}

        {mode === "custom" && (
          <div className="p-4 space-y-5">
            {/* ════════════════════════════════════════════
                SECTION 1: OPTIC & SENSOR SUITE
               ════════════════════════════════════════════ */}
            <SectionHeader label="Optic & Sensor Suite" />

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
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-lg font-bold text-primary tabular-nums">
                    {focalLength[0]}mm
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
                    {focalLabel(focalLength[0])}
                  </span>
                </div>
                <div className="relative">
                  <Slider
                    value={focalLength}
                    onValueChange={setFocalLength}
                    min={12}
                    max={200}
                    step={1}
                    className="fader-slider"
                  />
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
                <div className="flex items-center justify-center py-3">
                  <div className="relative">
                    <div className="h-16 w-16 rounded-full border-2 border-muted-foreground/20 flex items-center justify-center">
                      <div
                        className="rounded-full bg-primary/20 border border-primary/40 transition-all duration-500 ease-out"
                        style={{
                          width: `${Math.max(8, 56 * (1 - APERTURES.indexOf(aperture) / (APERTURES.length - 1)))}px`,
                          height: `${Math.max(8, 56 * (1 - APERTURES.indexOf(aperture) / (APERTURES.length - 1)))}px`,
                        }}
                      />
                    </div>
                    <div className="absolute -bottom-5 left-1/2 -translate-x-1/2">
                      <span className="text-[9px] font-mono font-bold text-primary tracking-wider">
                        {aperture}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </ControlGroup>

            {/* ════════════════════════════════════════════
                SECTION 2: LIGHTING ARCHITECTURE
               ════════════════════════════════════════════ */}
            <div className="pt-3 border-t border-border/30">
              <SectionHeader label="Lighting Architecture" />
            </div>

            {/* ── Lighting Setup ── */}
            <ControlGroup icon={Sun} label="Lighting Setup">
              <Select value={lightingSetup} onValueChange={setLightingSetup}>
                <SelectTrigger className="h-9 bg-background border-border/60 text-sm font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {LIGHTING_SETUPS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-semibold">{l.label}</span>
                        <span className="text-[9px] text-muted-foreground font-mono">{l.detail}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ControlGroup>

            {/* ── Color Temperature ── */}
            <ControlGroup icon={Sun} label="Color Temperature">
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-lg font-bold text-primary tabular-nums">
                    {colorTemp[0]}K
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
                    {colorTempLabel(colorTemp[0])}
                  </span>
                </div>
                <Slider
                  value={colorTemp}
                  onValueChange={setColorTemp}
                  min={2700}
                  max={6500}
                  step={100}
                  className="color-temp-slider"
                />
                <div className="flex justify-between">
                  <span className="text-[8px] font-mono text-orange-400/70">2700K Warm</span>
                  <span className="text-[8px] font-mono text-blue-400/70">6500K Cool</span>
                </div>
              </div>
            </ControlGroup>

            {/* ════════════════════════════════════════════
                SECTION 3: CAMERA DYNAMICS & POLISH
               ════════════════════════════════════════════ */}
            <div className="pt-3 border-t border-border/30">
              <SectionHeader label="Camera Dynamics & Polish" />
            </div>

            {/* ── Rigging & Movement ── */}
            <ControlGroup icon={Move} label="Rigging & Movement">
              <Select value={rigging} onValueChange={setRigging}>
                <SelectTrigger className="h-9 bg-background border-border/60 text-sm font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {RIGGING_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-semibold">{r.label}</span>
                        <span className="text-[9px] text-muted-foreground font-mono">{r.detail}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ControlGroup>

            {/* ── Shutter Angle / Motion Blur ── */}
            <ControlGroup icon={Aperture} label="Motion Blur / Shutter Angle">
              <div className="flex gap-1.5">
                {SHUTTER_ANGLES.map((sa) => (
                  <button
                    key={sa.value}
                    onClick={() => setShutterAngle(sa.value)}
                    className={cn(
                      "flex-1 py-2 px-1 rounded-md border text-center transition-all duration-150",
                      "shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_0_hsl(0_0%_100%/0.06)]",
                      "active:translate-y-px active:shadow-[0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(0,0,0,0.2)]",
                      shutterAngle === sa.value
                        ? "bg-primary/15 border-primary/50 shadow-[0_0_10px_-3px_hsl(var(--primary)/0.3),inset_0_1px_0_hsl(0_0%_100%/0.06)]"
                        : "bg-secondary/60 border-border/50 hover:border-border"
                    )}
                  >
                    <span className={cn(
                      "block text-xs font-mono font-bold",
                      shutterAngle === sa.value ? "text-primary" : "text-foreground"
                    )}>
                      {sa.label}
                    </span>
                    <span className={cn(
                      "block text-[8px] font-mono mt-0.5",
                      shutterAngle === sa.value ? "text-primary/70" : "text-muted-foreground"
                    )}>
                      {sa.detail}
                    </span>
                  </button>
                ))}
              </div>
            </ControlGroup>

            {/* ── Texture & Polish ── */}
            <ControlGroup icon={Sparkles} label="Texture & Polish">
              <div className="flex flex-col gap-1.5">
                {TEXTURE_OPTIONS.map((tex) => (
                  <button
                    key={tex.value}
                    onClick={() => toggleTexture(tex.value)}
                    className={cn(
                      "w-full py-2 px-3 rounded-md border text-left text-xs font-display font-semibold transition-all duration-150",
                      "shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_0_hsl(0_0%_100%/0.06)]",
                      "active:translate-y-px active:shadow-[0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(0,0,0,0.2)]",
                      textures.includes(tex.value)
                        ? "bg-primary/15 border-primary/50 text-primary shadow-[0_0_10px_-3px_hsl(var(--primary)/0.3),inset_0_1px_0_hsl(0_0%_100%/0.06)]"
                        : "bg-secondary/60 border-border/50 text-foreground hover:border-border"
                    )}
                  >
                    {tex.label}
                  </button>
                ))}
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
                <ReadoutRow label="Light" value={LIGHTING_SETUPS.find(l => l.value === lightingSetup)?.label ?? ""} />
                <ReadoutRow label="Kelvin" value={`${colorTemp[0]}K`} />
                <ReadoutRow label="Rig" value={RIGGING_OPTIONS.find(r => r.value === rigging)?.label ?? ""} />
                <ReadoutRow label="Shutter" value={`${shutterAngle}°`} />
                <ReadoutRow label="Texture" value={textures.length ? textures.map(t => TEXTURE_OPTIONS.find(o => o.value === t)?.label?.split("/")[0].trim() ?? t).join(", ") : "None"} />
              </div>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

/* ── Section Header ── */
const SectionHeader = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 mb-1">
    <div className="h-px flex-1 bg-primary/20" />
    <span className="text-[9px] font-display font-bold uppercase tracking-[0.2em] text-primary/70">
      {label}
    </span>
    <div className="h-px flex-1 bg-primary/20" />
  </div>
);

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
