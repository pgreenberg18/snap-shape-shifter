import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AudioWaveform, Mic, Languages, Sparkles, Palette, Scan, Zap, Music2, Loader2,
  Upload, Download, FileUp, Wand2, Film,
} from "lucide-react";
import { toast } from "sonner";

/* ── Tri-State Toggle ── */
type TriState = "auto" | "templates" | "custom";

function TriStateToggle({ value, onChange }: { value: TriState; onChange: (v: TriState) => void }) {
  const opts: { value: TriState; label: string }[] = [
    { value: "auto", label: "Auto" },
    { value: "templates", label: "Templates" },
    { value: "custom", label: "Custom" },
  ];
  return (
    <div className="flex rounded-lg border border-border/60 overflow-hidden">
      {opts.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors",
            value === o.value
              ? "bg-primary/15 text-primary"
              : "bg-secondary/50 text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Color Wheel (CSS-only) ── */
function ColorWheel({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="h-20 w-20 rounded-full border border-border/60"
        style={{
          background: "radial-gradient(circle at 40% 40%, hsl(0 0% 35%), hsl(0 0% 12%))",
          boxShadow: "inset 0 2px 8px hsl(0 0% 0% / 0.6), 0 1px 2px hsl(0 0% 0% / 0.3)",
        }}
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            background: "conic-gradient(from 0deg, hsl(0 70% 45% / 0.25), hsl(60 70% 45% / 0.25), hsl(120 70% 45% / 0.25), hsl(180 70% 45% / 0.25), hsl(240 70% 45% / 0.25), hsl(300 70% 45% / 0.25), hsl(360 70% 45% / 0.25))",
          }}
        />
      </div>
      <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}

/* ── Section Header ── */
function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className="h-3 w-3 text-primary/70" />
      <span className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}

/* ── Import Button ── */
function ImportButton({ accept, label, onFile }: { accept: string; label: string; onFile: (file: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) { onFile(f); e.target.value = ""; }
      }} />
      <Button
        variant="secondary"
        size="sm"
        onClick={() => ref.current?.click()}
        className="w-full text-[10px] font-mono gap-1.5 h-8 cinema-inset active:translate-y-px"
      >
        <Upload className="h-3 w-3" /> {label}
      </Button>
    </>
  );
}

/* ── LUT Button ── */
const LUT_PRESETS = ["Kodak 2383 Print", "Bleach Bypass", "Midnight Noir", "Teal & Orange"];

function LutButton({ name }: { name: string }) {
  return (
    <button className="rounded-lg border border-border/60 bg-secondary/60 px-3 py-2 text-[10px] font-mono text-foreground/80 hover:bg-secondary hover:text-foreground transition-colors text-left cinema-inset active:translate-y-px">
      {name}
    </button>
  );
}

/* ── Waveform Animation ── */
function WaveformAnimation() {
  return (
    <div className="flex items-center justify-center gap-[3px] h-8">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-primary/70"
          style={{
            animation: `waveform-bar 0.6s ease-in-out ${i * 0.05}s infinite alternate`,
            height: `${12 + Math.random() * 16}px`,
          }}
        />
      ))}
    </div>
  );
}

/* ── Score Preset Button ── */
const SCORE_PRESETS = [
  "Hans Zimmer-esque Brass",
  "Dark Synthwave / Cyberpunk",
  "Minimalist Noir Jazz",
  "Ethereal Fantasy Choir",
];

function ScorePresetButton({ name, selected, onClick }: { name: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2 text-[10px] font-mono transition-colors text-left cinema-inset active:translate-y-px",
        selected
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border/60 bg-secondary/60 text-foreground/80 hover:bg-secondary hover:text-foreground"
      )}
    >
      {name}
    </button>
  );
}

const LANGUAGES = [
  "Spanish", "French", "German", "Japanese", "Korean",
  "Mandarin", "Portuguese", "Italian", "Hindi", "Arabic",
];

const INSTRUMENTATIONS = ["Orchestral", "Electronic", "Acoustic", "Hybrid"];

const COLOR_FORMATS = [
  { ext: ".cube", label: "3D LUT (.cube)" },
  { ext: ".csp", label: "CDL (.csp)" },
  { ext: ".3dl", label: "3D LUT (.3dl)" },
  { ext: ".look", label: "ACES Look (.look)" },
  { ext: ".clf", label: "CLF (.clf)" },
];

type Tab = "sound" | "color" | "score" | "fx";

interface PostProductionSidebarProps {
  onInsertMusicClip?: (label: string) => void;
  onFileImport?: (file: File, tab: string, category: string) => void;
}

const PostProductionSidebar = ({ onInsertMusicClip, onFileImport }: PostProductionSidebarProps) => {
  const [tab, setTab] = useState<Tab>("sound");
  const [triState, setTriState] = useState<TriState>("auto");
  const [composerTriState, setComposerTriState] = useState<TriState>("auto");
  const [sfxPrompt, setSfxPrompt] = useState("");
  const [lutPrompt, setLutPrompt] = useState("");
  const [selectedLang, setSelectedLang] = useState("");
  const [composerPrompt, setComposerPrompt] = useState("");
  const [bpm, setBpm] = useState([100]);
  const [instrumentation, setInstrumentation] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [fxPrompt, setFxPrompt] = useState("");

  const handleSynthesize = () => {
    setIsSynthesizing(true);
    setTimeout(() => {
      setIsSynthesizing(false);
      const label = selectedPreset || composerPrompt || "AI Score";
      onInsertMusicClip?.(label);
    }, 3500);
  };

  const handleFileImport = (file: File, category: string) => {
    const importTab = tab;
    onFileImport?.(file, importTab, category);
    toast.success(`Imported "${file.name}" to ${category}`);
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "sound", label: "Sound", icon: AudioWaveform },
    { id: "score", label: "Score", icon: Music2 },
    { id: "fx", label: "FX", icon: Wand2 },
    { id: "color", label: "Color", icon: Palette },
  ];

  return (
    <div className="w-72 shrink-0 border-l border-border bg-card flex flex-col h-full">
      {/* Tab switcher */}
      <div className="flex border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 px-2 py-2.5 text-[9px] font-display font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1",
              tab === t.id
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="h-3 w-3" /> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* ═══ SOUND TAB ═══ */}
        {tab === "sound" && (
          <>
            {/* Import Audio */}
            <div>
              <SectionHeader icon={Upload} label="Import Audio" />
              <ImportButton
                accept="audio/*,.wav,.mp3,.aac,.flac,.ogg,.aiff"
                label="Import Audio File"
                onFile={(f) => handleFileImport(f, "Sound")}
              />
            </div>

            {/* Auto-Foley */}
            <div>
              <SectionHeader icon={Zap} label="Auto-Foley" />
              <Button
                variant="secondary"
                size="sm"
                className="w-full text-[10px] font-mono gap-1.5 h-8 cinema-inset active:translate-y-px"
              >
                <Scan className="h-3 w-3" /> Analyze Scene & Generate Foley Track
              </Button>
            </div>

            {/* Custom SFX */}
            <div>
              <SectionHeader icon={AudioWaveform} label="Custom SFX" />
              <Input
                value={sfxPrompt}
                onChange={(e) => setSfxPrompt(e.target.value)}
                placeholder="Describe sound: e.g., heavy wet footsteps on gravel"
                className="h-8 text-[10px] font-mono bg-background border-border/60 placeholder:text-muted-foreground/40 mb-2 cinema-inset"
              />
              <Button
                variant="secondary"
                size="sm"
                className="w-full text-[10px] font-mono gap-1.5 h-8 cinema-inset active:translate-y-px"
              >
                <Sparkles className="h-3 w-3" /> Generate & Place on Timeline
              </Button>
            </div>

            {/* Visual ADR / Dubbing */}
            <div>
              <SectionHeader icon={Mic} label="Visual ADR / Dubbing" />
              <Select value={selectedLang} onValueChange={setSelectedLang}>
                <SelectTrigger className="h-8 bg-background border-border/60 text-[10px] font-mono mb-2 cinema-inset">
                  <SelectValue placeholder="Target language…" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="secondary"
                size="sm"
                className="w-full text-[10px] font-mono gap-1.5 h-8 cinema-inset active:translate-y-px"
              >
                <Languages className="h-3 w-3" /> Translate & Sync Lip Movements
              </Button>
            </div>
          </>
        )}

        {/* ═══ COLOR TAB ═══ */}
        {tab === "color" && (
          <>
            <TriStateToggle value={triState} onChange={setTriState} />

            {triState === "auto" && (
              <div>
                <SectionHeader icon={Sparkles} label="Automated Grading" />
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full text-[10px] font-mono gap-1.5 h-8 cinema-inset active:translate-y-px"
                >
                  <Scan className="h-3 w-3" /> Smart Match Sequence
                </Button>
                <p className="text-[9px] text-muted-foreground/60 mt-2 font-mono">
                  Unify color & exposure across disparate AI-generated takes.
                </p>
              </div>
            )}

            {triState === "templates" && (
              <div>
                <SectionHeader icon={Palette} label="LUT Presets" />
                <div className="grid grid-cols-1 gap-2">
                  {LUT_PRESETS.map((name) => (
                    <LutButton key={name} name={name} />
                  ))}
                </div>
              </div>
            )}

            {triState === "custom" && (
              <>
                <div>
                  <SectionHeader icon={Palette} label="Color Wheels" />
                  <div className="flex justify-between px-2">
                    <ColorWheel label="Lift" />
                    <ColorWheel label="Gamma" />
                    <ColorWheel label="Gain" />
                  </div>
                </div>
                <div>
                  <SectionHeader icon={Sparkles} label="Prompt-to-LUT" />
                  <Input
                    value={lutPrompt}
                    onChange={(e) => setLutPrompt(e.target.value)}
                    placeholder="Hazy 1970s Polaroid"
                    className="h-8 text-[10px] font-mono bg-background border-border/60 placeholder:text-muted-foreground/40 mb-2 cinema-inset"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full text-[10px] font-mono gap-1.5 h-8 cinema-inset active:translate-y-px"
                  >
                    <Sparkles className="h-3 w-3" /> Generate LUT
                  </Button>
                </div>
              </>
            )}

            {/* Import / Export — always visible */}
            <div className="border-t border-border/40 pt-4 space-y-2">
              <SectionHeader icon={FileUp} label="Import / Export" />
              <ImportButton
                accept=".cube,.3dl,.csp,.look,.clf,.lut,.cdl,.cc,.icc"
                label="Import LUT / CDL / CLF"
                onFile={(f) => handleFileImport(f, "Color")}
              />
              <ImportButton
                accept=".icc,.icm"
                label="Import ICC Profile"
                onFile={(f) => handleFileImport(f, "Color")}
              />
              <div className="grid grid-cols-1 gap-1.5 mt-2">
                {COLOR_FORMATS.map((fmt) => (
                  <Button
                    key={fmt.ext}
                    variant="ghost"
                    size="sm"
                    className="w-full text-[10px] font-mono gap-1.5 h-7 justify-start text-muted-foreground hover:text-foreground"
                  >
                    <Download className="h-3 w-3" /> Save as {fmt.label}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ═══ SCORE TAB ═══ */}
        {tab === "score" && (
          <>
            {/* Import */}
            <div>
              <SectionHeader icon={Upload} label="Import Score / Music" />
              <ImportButton
                accept="audio/*,.wav,.mp3,.aac,.flac,.ogg,.aiff,.mid,.midi"
                label="Import Audio / MIDI"
                onFile={(f) => handleFileImport(f, "Score")}
              />
            </div>

            <TriStateToggle value={composerTriState} onChange={setComposerTriState} />

            {composerTriState === "auto" && (
              <div>
                <SectionHeader icon={Sparkles} label="Auto-Score" />
                <Button
                  variant="secondary"
                  size="sm"
                  className={cn(
                    "w-full text-[10px] font-mono gap-1.5 h-9 cinema-inset active:translate-y-px",
                    "shadow-[0_0_12px_-3px_hsl(var(--primary)/0.25)] hover:shadow-[0_0_18px_-3px_hsl(var(--primary)/0.4)]"
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Analyze Scene Emotion & Auto-Score
                </Button>
                <p className="text-[9px] text-muted-foreground/60 mt-2 font-mono leading-relaxed">
                  Reads emotional metadata from the script breakdown to set key, tempo, and mood automatically.
                </p>
              </div>
            )}

            {composerTriState === "templates" && (
              <div>
                <SectionHeader icon={Music2} label="Score Presets" />
                <div className="grid grid-cols-1 gap-2">
                  {SCORE_PRESETS.map((name) => (
                    <ScorePresetButton
                      key={name}
                      name={name}
                      selected={selectedPreset === name}
                      onClick={() => setSelectedPreset(selectedPreset === name ? "" : name)}
                    />
                  ))}
                </div>
              </div>
            )}

            {composerTriState === "custom" && (
              <>
                <div>
                  <SectionHeader icon={Music2} label="Composer Prompt" />
                  <Input
                    value={composerPrompt}
                    onChange={(e) => setComposerPrompt(e.target.value)}
                    placeholder="Tense, building strings that crescendo at 15 seconds"
                    className="h-8 text-[10px] font-mono bg-background border-border/60 placeholder:text-muted-foreground/40 cinema-inset"
                  />
                </div>

                <div>
                  <SectionHeader icon={Zap} label={`BPM / Pacing — ${bpm[0]}`} />
                  <div className="px-1">
                    <Slider
                      value={bpm}
                      onValueChange={setBpm}
                      min={60}
                      max={180}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-[8px] font-mono text-muted-foreground/50">60</span>
                      <span className="text-[8px] font-mono text-muted-foreground/50">180</span>
                    </div>
                  </div>
                </div>

                <div>
                  <SectionHeader icon={AudioWaveform} label="Instrumentation Focus" />
                  <Select value={instrumentation} onValueChange={setInstrumentation}>
                    <SelectTrigger className="h-8 bg-background border-border/60 text-[10px] font-mono cinema-inset">
                      <SelectValue placeholder="Select focus…" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border z-50">
                      {INSTRUMENTATIONS.map((i) => (
                        <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </>
        )}

        {/* ═══ FX TAB ═══ */}
        {tab === "fx" && (
          <>
            {/* Import VFX / Overlay */}
            <div>
              <SectionHeader icon={Upload} label="Import VFX / Overlay" />
              <ImportButton
                accept="video/*,image/*,.exr,.dpx,.tga,.png,.tiff,.mov,.mp4,.webm"
                label="Import VFX Asset"
                onFile={(f) => handleFileImport(f, "FX")}
              />
              <p className="text-[9px] text-muted-foreground/60 mt-1.5 font-mono">
                EXR, DPX, PNG sequences, MOV (ProRes), and common video formats.
              </p>
            </div>

            {/* Generative FX */}
            <div>
              <SectionHeader icon={Sparkles} label="Generative FX" />
              <Input
                value={fxPrompt}
                onChange={(e) => setFxPrompt(e.target.value)}
                placeholder="Rain particles with volumetric mist"
                className="h-8 text-[10px] font-mono bg-background border-border/60 placeholder:text-muted-foreground/40 mb-2 cinema-inset"
              />
              <Button
                variant="secondary"
                size="sm"
                className="w-full text-[10px] font-mono gap-1.5 h-8 cinema-inset active:translate-y-px"
              >
                <Sparkles className="h-3 w-3" /> Generate FX Layer
              </Button>
            </div>

            {/* Common Effects */}
            <div>
              <SectionHeader icon={Film} label="Quick Effects" />
              <div className="grid grid-cols-1 gap-2">
                {["Film Grain / Noise", "Lens Flare", "Light Leak", "Camera Shake", "Chromatic Aberration", "Vignette"].map((fx) => (
                  <button
                    key={fx}
                    className="rounded-lg border border-border/60 bg-secondary/60 px-3 py-2 text-[10px] font-mono text-foreground/80 hover:bg-secondary hover:text-foreground transition-colors text-left cinema-inset active:translate-y-px"
                  >
                    {fx}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Synthesize button — score tab only */}
      {tab === "score" && (
        <div className="border-t border-border p-4">
          {isSynthesizing ? (
            <div className="space-y-2">
              <WaveformAnimation />
              <p className="text-[9px] font-mono text-center text-primary/70 animate-pulse">Synthesizing score…</p>
            </div>
          ) : (
            <Button
              onClick={handleSynthesize}
              className={cn(
                "w-full h-10 font-display font-bold text-[11px] uppercase tracking-wider gap-2",
                "shadow-[0_0_16px_-4px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_24px_-4px_hsl(var(--primary)/0.45)]",
                "cinema-inset active:translate-y-px"
              )}
            >
              <Music2 className="h-4 w-4" /> Synthesize Score & Place on Timeline
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default PostProductionSidebar;
