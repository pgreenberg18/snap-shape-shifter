import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Aperture, Crosshair, Focus, ScanLine, Sun, Move, Sparkles, Lightbulb, Camera, Clapperboard, Users, Drama, Save, FolderOpen, Trash2, Film } from "lucide-react";
import { DIRECTORS, type DirectorProfile } from "@/lib/director-styles";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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

const PERFORMANCE_STYLES = [
  { value: "naturalistic", label: "Naturalistic", detail: "Grounded / Realistic" },
  { value: "heightened", label: "Heightened", detail: "Theatrical / Stylized" },
  { value: "improv", label: "Improvisational", detail: "Loose / Organic" },
  { value: "choreographed", label: "Choreographed", detail: "Precise / Blocked" },
];

const ACTION_INTENSITIES = [
  { value: "subtle", label: "Subtle", detail: "Micro-expressions" },
  { value: "moderate", label: "Moderate", detail: "Balanced energy" },
  { value: "intense", label: "Intense", detail: "High stakes" },
  { value: "explosive", label: "Explosive", detail: "Maximum impact" },
];

const EMOTION_SLIDERS = [
  { key: "intensity", label: "Intensity", color: "hsl(var(--primary))" },
  { key: "humor", label: "Humor", color: "hsl(45 90% 55%)" },
  { key: "sadness", label: "Sadness", color: "hsl(210 60% 55%)" },
  { key: "joy", label: "Joy", color: "hsl(35 95% 55%)" },
  { key: "anger", label: "Anger", color: "hsl(0 70% 55%)" },
  { key: "fear", label: "Fear", color: "hsl(270 50% 55%)" },
];

const CAMERA_REFINE_SLIDERS = [
  { key: "movementSpeed", label: "Movement Speed", min: 0, max: 100 },
  { key: "focusSoftness", label: "Focus Softness", min: 0, max: 100 },
];

/* ── Director Templates ── */
interface DirectorTemplate {
  id: string;
  label: string;
  subtitle: string;
  sensor: string;
  lens: string;
  focalLength: number;
  aperture: string;
  lightingSetup: string;
  colorTemp: number;
  rigging: string;
  shutterAngle: string;
  textures: string[];
  performanceStyle: string;
  actionIntensity: string;
  emotions: Record<string, number>;
  movementSpeed: number;
  focusSoftness: number;
}

function deriveTemplate(d: DirectorProfile): DirectorTemplate {
  const v = d.vector;
  // Derive camera settings from visual mandate & style vector
  const lens = d.visualMandate.lens.toLowerCase().includes("anamorphic") ? "anamorphic-prime"
    : d.visualMandate.lens.toLowerCase().includes("zoom") ? "cine-zoom"
    : d.visualMandate.lens.toLowerCase().includes("vintage") ? "vintage-glass"
    : "spherical-prime";

  const sensor = d.visualMandate.texture.toLowerCase().includes("film") || d.visualMandate.texture.toLowerCase().includes("35mm") || d.visualMandate.texture.toLowerCase().includes("grain")
    ? "kodak-vision3"
    : d.visualMandate.texture.toLowerCase().includes("imax") ? "red-v-raptor"
    : "arri-alexa-35";

  // Focal length from lens description
  const focalMatch = d.visualMandate.lens.match(/(\d+)(?:–|-)?(\d+)?mm/);
  const focalLength = focalMatch ? Math.round((parseInt(focalMatch[1]) + parseInt(focalMatch[2] || focalMatch[1])) / 2) : 50;

  // Lighting setup from lighting description
  const ltg = d.visualMandate.lighting.toLowerCase();
  const lightingSetup = ltg.includes("chiaroscuro") || ltg.includes("dramatic") ? "chiaroscuro"
    : ltg.includes("high-key") || ltg.includes("bright") ? "high-key"
    : ltg.includes("low-key") || ltg.includes("dark") ? "low-key"
    : ltg.includes("backlit") || ltg.includes("rim") ? "backlit"
    : ltg.includes("rembrandt") ? "rembrandt"
    : "three-point";

  // Color temp from lighting/color description
  const colorDesc = (d.visualMandate.lighting + d.visualMandate.color).toLowerCase();
  const colorTemp = colorDesc.includes("tungsten") || colorDesc.includes("warm") || colorDesc.includes("amber") || colorDesc.includes("golden") ? 3400
    : colorDesc.includes("cool") || colorDesc.includes("steel") || colorDesc.includes("blue") ? 5600
    : 4400;

  // Rigging from lens/style
  const rigDesc = d.visualMandate.lens.toLowerCase();
  const rigging = rigDesc.includes("steadicam") ? "steadicam"
    : rigDesc.includes("handheld") ? "handheld"
    : rigDesc.includes("crane") ? "crane-sweep"
    : rigDesc.includes("dolly") || rigDesc.includes("track") ? "dolly-push"
    : "static";

  // Textures
  const textures: string[] = [];
  const texDesc = d.visualMandate.texture.toLowerCase();
  if (texDesc.includes("grain") || texDesc.includes("film") || texDesc.includes("celluloid")) textures.push("grain");
  if (texDesc.includes("halation") || texDesc.includes("diffusion") || d.visualMandate.lens.toLowerCase().includes("diffusion")) textures.push("promist");

  // Performance from emotional depth
  const performanceStyle = d.emotionalDepth === "operatic" ? "heightened"
    : d.emotionalDepth === "cool" ? "choreographed"
    : "naturalistic";

  // Action intensity from spectacle + darkness
  const intensityScore = (v.spectacle + v.darkness) / 2;
  const actionIntensity = intensityScore >= 8 ? "explosive"
    : intensityScore >= 6 ? "intense"
    : intensityScore >= 4 ? "moderate"
    : "subtle";

  // Emotions from style vector
  const emotions = {
    intensity: Math.round(v.emotion * 10),
    humor: v.genreFluidity >= 7 && v.darkness <= 4 ? 40 : 0,
    sadness: v.darkness >= 7 ? Math.round((v.darkness - 4) * 15) : 0,
    joy: v.emotion >= 7 && v.darkness <= 4 ? Math.round((v.emotion - 4) * 15) : 0,
    anger: v.darkness >= 6 && v.spectacle >= 6 ? 30 : 0,
    fear: v.darkness >= 7 ? Math.round((v.darkness - 5) * 15) : 0,
  };

  // Camera refinement
  const movementSpeed = rigging === "static" ? 0 : rigging === "handheld" ? 60 : rigging === "steadicam" ? 40 : 50;
  const focusSoftness = lens === "vintage-glass" ? 40 : d.visualMandate.lens.toLowerCase().includes("diffusion") ? 30 : 0;

  return {
    id: d.id,
    label: `${d.name.split(" ").pop()} ${rigging === "static" ? "Static" : rigging === "steadicam" ? "Glide" : rigging === "handheld" ? "Shaky" : rigging === "crane-sweep" ? "Sweep" : "Push"}`,
    subtitle: d.name,
    sensor, lens, focalLength: Math.max(12, Math.min(200, focalLength)), aperture: v.visual >= 8 ? "T/2" : "T/2.8",
    lightingSetup, colorTemp, rigging, shutterAngle: v.spectacle >= 8 ? "180" : v.visual >= 9 ? "45" : "180",
    textures, performanceStyle, actionIntensity, emotions, movementSpeed, focusSoftness,
  };
}

const DIRECTOR_TEMPLATES: DirectorTemplate[] = DIRECTORS.map(deriveTemplate);

interface OpticsSuitePanelProps {
  onAspectRatioChange: (ratio: number) => void;
  filmId?: string;
}

/* ── Preset types ── */
interface LightsSettings {
  lightingSetup: string;
  colorTemp: number;
}
interface CameraSettings {
  sensor: string;
  lens: string;
  focalLength: number;
  aperture: string;
  rigging: string;
  shutterAngle: string;
  textures: string[];
}

const OpticsSuitePanel = ({ onAspectRatioChange, filmId }: OpticsSuitePanelProps) => {
  const queryClient = useQueryClient();

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
  // Action
  const [performanceStyle, setPerformanceStyle] = useState("naturalistic");
  const [actionIntensity, setActionIntensity] = useState("moderate");
  // Emotion sliders
  const [emotions, setEmotions] = useState<Record<string, number>>({
    intensity: 50, humor: 0, sadness: 0, joy: 0, anger: 0, fear: 0,
  });
  // Camera refinement sliders
  const [movementSpeed, setMovementSpeed] = useState([30]);
  const [focusSoftness, setFocusSoftness] = useState([0]);

  // Collapsible states
  const [lightsOpen, setLightsOpen] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(true);
  const [actionOpen, setActionOpen] = useState(true);
  const [dirTemplateOpen, setDirTemplateOpen] = useState(false);

  // ── Matched director profile ──
  const { data: directorProfile } = useQuery({
    queryKey: ["director-profile", filmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("film_director_profiles")
        .select("primary_director_id, primary_director_name, secondary_director_id, secondary_director_name")
        .eq("film_id", filmId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!filmId,
  });

  const applyDirectorTemplate = useCallback((t: DirectorTemplate) => {
    setSensor(t.sensor);
    setLens(t.lens);
    setFocalLength([t.focalLength]);
    setAperture(t.aperture);
    setLightingSetup(t.lightingSetup);
    setColorTemp([t.colorTemp]);
    setRigging(t.rigging);
    setShutterAngle(t.shutterAngle);
    setTextures(t.textures);
    setPerformanceStyle(t.performanceStyle);
    setActionIntensity(t.actionIntensity);
    setEmotions(t.emotions);
    setMovementSpeed([t.movementSpeed]);
    setFocusSoftness([t.focusSoftness]);
    setDirTemplateOpen(false);
    toast.success(`Applied "${t.label}" template`);
  }, []);

  // ── Preset queries ──
  const { data: lightsPresets = [] } = useQuery({
    queryKey: ["production-presets", filmId, "lights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_presets")
        .select("*")
        .eq("film_id", filmId!)
        .eq("category", "lights")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!filmId,
  });

  const { data: cameraPresets = [] } = useQuery({
    queryKey: ["production-presets", filmId, "camera"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_presets")
        .select("*")
        .eq("film_id", filmId!)
        .eq("category", "camera")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!filmId,
  });

  const savePreset = useMutation({
    mutationFn: async ({ category, name, settings }: { category: string; name: string; settings: any }) => {
      const { error } = await supabase
        .from("production_presets")
        .insert({ film_id: filmId!, category, name, settings });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["production-presets", filmId, vars.category] });
      toast.success("Preset saved");
    },
    onError: () => toast.error("Failed to save preset"),
  });

  const deletePreset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("production_presets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-presets", filmId] });
      toast.success("Preset deleted");
    },
  });

  const getLightsSettings = useCallback((): LightsSettings => ({
    lightingSetup,
    colorTemp: colorTemp[0],
  }), [lightingSetup, colorTemp]);

  const getCameraSettings = useCallback((): CameraSettings => ({
    sensor, lens, focalLength: focalLength[0], aperture, rigging, shutterAngle, textures,
  }), [sensor, lens, focalLength, aperture, rigging, shutterAngle, textures]);

  const loadLightsPreset = useCallback((settings: LightsSettings) => {
    setLightingSetup(settings.lightingSetup);
    setColorTemp([settings.colorTemp]);
    toast.success("Lights preset loaded");
  }, []);

  const loadCameraPreset = useCallback((settings: CameraSettings) => {
    setSensor(settings.sensor);
    setLens(settings.lens);
    setFocalLength([settings.focalLength]);
    setAperture(settings.aperture);
    setRigging(settings.rigging);
    setShutterAngle(settings.shutterAngle);
    setTextures(settings.textures || []);
    toast.success("Camera preset loaded");
  }, []);

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
    <div className="flex-1 min-h-0 border-t border-border/50 flex flex-col overflow-hidden pro-panel specular-edge" style={{ borderRadius: 0 }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-primary" />
          <h2 className="font-display text-xs font-bold uppercase tracking-[0.15em] text-foreground flex-1">
            Master Control Deck
          </h2>
          <Popover open={dirTemplateOpen} onOpenChange={setDirTemplateOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[10px] font-display uppercase tracking-wider border-primary/30 hover:border-primary/60">
                <Film className="h-3 w-3" />
                Director Templates
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0 bg-popover border-border" align="end" side="bottom">
              <div className="p-3 border-b border-border/50">
                <p className="text-xs font-display font-semibold text-foreground">Apply Director Style</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Auto-presets all camera, lighting & performance sliders</p>
              </div>
              <ScrollArea className="max-h-64">
                <div className="p-1.5 space-y-0.5">
                  {DIRECTOR_TEMPLATES.map((t) => {
                    const isMatched = directorProfile?.primary_director_id === t.id || directorProfile?.secondary_director_id === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => applyDirectorTemplate(t)}
                        className={cn(
                          "w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-secondary/60",
                          isMatched && "bg-primary/10 border border-primary/30"
                        )}
                      >
                        <Film className={cn("h-3.5 w-3.5 shrink-0", isMatched ? "text-primary" : "text-muted-foreground")} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-display font-semibold text-foreground truncate">{t.label}</span>
                            {isMatched && <span className="text-[8px] font-mono text-primary uppercase tracking-wider">matched</span>}
                          </div>
                          <span className="text-[10px] text-muted-foreground">{t.subtitle}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="divide-y divide-border/40">
          {/* ═══════════════════════════════════════
              LIGHTS
             ═══════════════════════════════════════ */}
          <Collapsible open={lightsOpen} onOpenChange={setLightsOpen}>
            <CollapsibleTrigger className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-secondary/40 transition-colors">
              <Lightbulb className={cn("h-4 w-4 transition-colors", lightsOpen ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("font-display text-sm font-bold uppercase tracking-wider flex-1 text-left", lightsOpen ? "text-foreground" : "text-muted-foreground")}>
                Lights
              </span>
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", lightsOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pb-1">
                {/* Preset bar */}
                {filmId && (
                  <PresetBar
                    category="lights"
                    presets={lightsPresets}
                    onSave={(name) => savePreset.mutate({ category: "lights", name, settings: getLightsSettings() })}
                    onLoad={(preset) => loadLightsPreset(preset.settings as unknown as LightsSettings)}
                    onDelete={(id) => deletePreset.mutate(id)}
                  />
                )}

                <SubCollapsible icon={Sun} label="Lighting Setup">
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
                </SubCollapsible>

                <SubCollapsible icon={Sun} label="Color Temperature">
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
                </SubCollapsible>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ═══════════════════════════════════════
              CAMERA
             ═══════════════════════════════════════ */}
          <Collapsible open={cameraOpen} onOpenChange={setCameraOpen}>
            <CollapsibleTrigger className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-secondary/40 transition-colors">
              <Camera className={cn("h-4 w-4 transition-colors", cameraOpen ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("font-display text-sm font-bold uppercase tracking-wider flex-1 text-left", cameraOpen ? "text-foreground" : "text-muted-foreground")}>
                Camera
              </span>
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", cameraOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pb-1">
                {/* Preset bar */}
                {filmId && (
                  <PresetBar
                    category="camera"
                    presets={cameraPresets}
                    onSave={(name) => savePreset.mutate({ category: "camera", name, settings: getCameraSettings() })}
                    onLoad={(preset) => loadCameraPreset(preset.settings as unknown as CameraSettings)}
                    onDelete={(id) => deletePreset.mutate(id)}
                  />
                )}

                <SubCollapsible icon={ScanLine} label="Sensor Profile">
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
                </SubCollapsible>

                <SubCollapsible icon={Focus} label="Lens Type">
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
                </SubCollapsible>

                <SubCollapsible icon={Crosshair} label="Focal Length">
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
                </SubCollapsible>

                <SubCollapsible icon={Aperture} label="Aperture (T-Stop)">
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
                    <div className="flex items-center justify-center py-2">
                      <div className="relative">
                        <div className="h-14 w-14 rounded-full border-2 border-muted-foreground/20 flex items-center justify-center">
                          <div
                            className="rounded-full bg-primary/20 border border-primary/40 transition-all duration-500 ease-out"
                            style={{
                              width: `${Math.max(6, 48 * (1 - APERTURES.indexOf(aperture) / (APERTURES.length - 1)))}px`,
                              height: `${Math.max(6, 48 * (1 - APERTURES.indexOf(aperture) / (APERTURES.length - 1)))}px`,
                            }}
                          />
                        </div>
                        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
                          <span className="text-[9px] font-mono font-bold text-primary tracking-wider">
                            {aperture}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </SubCollapsible>

                <SubCollapsible icon={Move} label="Rigging & Movement">
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
                </SubCollapsible>

                <SubCollapsible icon={Aperture} label="Motion Blur / Shutter Angle">
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
                </SubCollapsible>

                <SubCollapsible icon={Sparkles} label="Texture & Polish">
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
                </SubCollapsible>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ═══════════════════════════════════════
              ACTION
             ═══════════════════════════════════════ */}
          <Collapsible open={actionOpen} onOpenChange={setActionOpen}>
            <CollapsibleTrigger className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-secondary/40 transition-colors">
              <Clapperboard className={cn("h-4 w-4 transition-colors", actionOpen ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("font-display text-sm font-bold uppercase tracking-wider flex-1 text-left", actionOpen ? "text-foreground" : "text-muted-foreground")}>
                Action
              </span>
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", actionOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pb-1">
                <SubCollapsible icon={Drama} label="Performance Style">
                  <Select value={performanceStyle} onValueChange={setPerformanceStyle}>
                    <SelectTrigger className="h-9 bg-background border-border/60 text-sm font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border z-50">
                      {PERFORMANCE_STYLES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          <div className="flex items-center gap-2">
                            <span className="font-display font-semibold">{p.label}</span>
                            <span className="text-[9px] text-muted-foreground font-mono">{p.detail}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SubCollapsible>

                <SubCollapsible icon={Users} label="Action Intensity">
                  <div className="flex flex-col gap-1.5">
                    {ACTION_INTENSITIES.map((ai) => (
                      <button
                        key={ai.value}
                        onClick={() => setActionIntensity(ai.value)}
                        className={cn(
                          "w-full py-2 px-3 rounded-md border text-left transition-all duration-150",
                          "shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_0_hsl(0_0%_100%/0.06)]",
                          "active:translate-y-px",
                          actionIntensity === ai.value
                            ? "bg-primary/15 border-primary/50 shadow-[0_0_10px_-3px_hsl(var(--primary)/0.3)]"
                            : "bg-secondary/60 border-border/50 hover:border-border"
                        )}
                      >
                        <span className={cn(
                          "text-xs font-display font-semibold",
                          actionIntensity === ai.value ? "text-primary" : "text-foreground"
                        )}>
                          {ai.label}
                        </span>
                        <span className={cn(
                          "block text-[9px] font-mono mt-0.5",
                          actionIntensity === ai.value ? "text-primary/70" : "text-muted-foreground"
                        )}>
                          {ai.detail}
                        </span>
                      </button>
                    ))}
                  </div>
                </SubCollapsible>

                <SubCollapsible icon={Drama} label="Emotional Sliders">
                  <div className="space-y-3">
                    <p className="text-[9px] text-muted-foreground/60 font-mono">
                      Fine-tune the emotional register of this take.
                    </p>
                    {EMOTION_SLIDERS.map((em) => (
                      <div key={em.key} className="space-y-1">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[10px] font-display font-semibold text-foreground/80">{em.label}</span>
                          <span className="text-[9px] font-mono tabular-nums" style={{ color: em.color }}>
                            {emotions[em.key]}%
                          </span>
                        </div>
                        <Slider
                          value={[emotions[em.key]]}
                          onValueChange={([v]) => setEmotions((prev) => ({ ...prev, [em.key]: v }))}
                          min={0}
                          max={100}
                          step={5}
                          className="emotion-slider"
                        />
                      </div>
                    ))}
                  </div>
                </SubCollapsible>

                <SubCollapsible icon={Move} label="Camera Refinement">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] font-display font-semibold text-foreground/80">Movement Speed</span>
                        <span className="text-[9px] font-mono tabular-nums text-primary">{movementSpeed[0]}%</span>
                      </div>
                      <Slider value={movementSpeed} onValueChange={setMovementSpeed} min={0} max={100} step={5} />
                      <div className="flex justify-between">
                        <span className="text-[8px] font-mono text-muted-foreground/50">Static</span>
                        <span className="text-[8px] font-mono text-muted-foreground/50">Frantic</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] font-display font-semibold text-foreground/80">Focus Softness</span>
                        <span className="text-[9px] font-mono tabular-nums text-primary">{focusSoftness[0]}%</span>
                      </div>
                      <Slider value={focusSoftness} onValueChange={setFocusSoftness} min={0} max={100} step={5} />
                      <div className="flex justify-between">
                        <span className="text-[8px] font-mono text-muted-foreground/50">Razor Sharp</span>
                        <span className="text-[8px] font-mono text-muted-foreground/50">Dreamy Soft</span>
                      </div>
                    </div>
                  </div>
                </SubCollapsible>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Readout Footer */}
        <div className="p-4 border-t border-border/40">
          <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
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
              <ReadoutRow label="Perform." value={PERFORMANCE_STYLES.find(p => p.value === performanceStyle)?.label ?? ""} />
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

/* ── Preset Bar ── */
const PresetBar = ({
  category,
  presets,
  onSave,
  onLoad,
  onDelete,
}: {
  category: string;
  presets: any[];
  onSave: (name: string) => void;
  onLoad: (preset: any) => void;
  onDelete: (id: string) => void;
}) => {
  const [saveName, setSaveName] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);

  const handleSave = () => {
    if (!saveName.trim()) return;
    onSave(saveName.trim());
    setSaveName("");
    setSaveOpen(false);
  };

  return (
    <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border/20">
      <span className="text-[8px] font-mono uppercase tracking-widest text-muted-foreground/60 mr-auto">
        Presets
      </span>

      {/* Load */}
      <Popover open={loadOpen} onOpenChange={setLoadOpen}>
        <PopoverTrigger asChild>
          <button
            className="h-6 w-6 rounded flex items-center justify-center hover:bg-secondary/60 transition-colors"
            title={`Load ${category} preset`}
          >
            <FolderOpen className="h-3 w-3 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" side="left" align="start">
          <div className="p-2 border-b border-border/40">
            <p className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground">
              Load {category} preset
            </p>
          </div>
          {presets.length === 0 ? (
            <div className="p-3 text-center text-xs text-muted-foreground">No saved presets</div>
          ) : (
            <ScrollArea className="max-h-48">
              <div className="p-1">
                {presets.map((p) => (
                  <div key={p.id} className="flex items-center gap-1 group">
                    <button
                      onClick={() => { onLoad(p); setLoadOpen(false); }}
                      className="flex-1 text-left px-2 py-1.5 rounded text-xs font-display font-semibold text-foreground hover:bg-secondary/60 transition-colors truncate"
                    >
                      {p.name}
                    </button>
                    <button
                      onClick={() => onDelete(p.id)}
                      className="h-6 w-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </PopoverContent>
      </Popover>

      {/* Save */}
      <Popover open={saveOpen} onOpenChange={setSaveOpen}>
        <PopoverTrigger asChild>
          <button
            className="h-6 w-6 rounded flex items-center justify-center hover:bg-secondary/60 transition-colors"
            title={`Save ${category} preset`}
          >
            <Save className="h-3 w-3 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" side="left" align="start">
          <p className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Save {category} preset
          </p>
          <div className="flex gap-1.5">
            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Preset name…"
              className="h-8 text-xs"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            <Button size="sm" className="h-8 px-2.5 text-xs" onClick={handleSave} disabled={!saveName.trim()}>
              Save
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

/* ── Sub-collapsible for individual settings ── */
const SubCollapsible = ({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center gap-1.5 px-4 py-2 hover:bg-secondary/30 transition-colors">
        <Icon className={cn("h-3 w-3 transition-colors", open ? "text-primary/70" : "text-muted-foreground/50")} />
        <span className={cn("text-[10px] font-display font-bold uppercase tracking-[0.12em] flex-1 text-left", open ? "text-foreground" : "text-muted-foreground")}>
          {label}
        </span>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground/50 transition-transform duration-200", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-3 pt-1">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

/* ── Readout Row ── */
const ReadoutRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between">
    <span className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground/60">{label}</span>
    <span className="text-[9px] font-mono font-bold text-foreground">{value}</span>
  </div>
);

export default OpticsSuitePanel;
