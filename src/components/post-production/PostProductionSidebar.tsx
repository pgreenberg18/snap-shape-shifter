import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AudioWaveform, Mic, Languages, Sparkles, Palette, Scan, Zap,
} from "lucide-react";

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

/* ── LUT Button ── */
const LUT_PRESETS = ["Kodak 2383 Print", "Bleach Bypass", "Midnight Noir", "Teal & Orange"];

function LutButton({ name }: { name: string }) {
  return (
    <button className="rounded-lg border border-border/60 bg-secondary/60 px-3 py-2 text-[10px] font-mono text-foreground/80 hover:bg-secondary hover:text-foreground transition-colors text-left cinema-inset active:translate-y-px">
      {name}
    </button>
  );
}

const LANGUAGES = [
  "Spanish", "French", "German", "Japanese", "Korean",
  "Mandarin", "Portuguese", "Italian", "Hindi", "Arabic",
];

type Tab = "audio" | "lustre";

const PostProductionSidebar = () => {
  const [tab, setTab] = useState<Tab>("audio");
  const [triState, setTriState] = useState<TriState>("auto");
  const [sfxPrompt, setSfxPrompt] = useState("");
  const [lutPrompt, setLutPrompt] = useState("");
  const [selectedLang, setSelectedLang] = useState("");

  return (
    <div className="w-72 shrink-0 border-l border-border bg-card flex flex-col h-full">
      {/* Tab switcher */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setTab("audio")}
          className={cn(
            "flex-1 px-3 py-2.5 text-[10px] font-display font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5",
            tab === "audio"
              ? "text-primary border-b-2 border-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <AudioWaveform className="h-3 w-3" /> Audio
        </button>
        <button
          onClick={() => setTab("lustre")}
          className={cn(
            "flex-1 px-3 py-2.5 text-[10px] font-display font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5",
            tab === "lustre"
              ? "text-primary border-b-2 border-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Palette className="h-3 w-3" /> Lustre
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {tab === "audio" ? (
          <>
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
        ) : (
          <>
            {/* Tri-State Toggle */}
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
                {/* Color Wheels */}
                <div>
                  <SectionHeader icon={Palette} label="Color Wheels" />
                  <div className="flex justify-between px-2">
                    <ColorWheel label="Lift" />
                    <ColorWheel label="Gamma" />
                    <ColorWheel label="Gain" />
                  </div>
                </div>

                {/* Prompt-to-LUT */}
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
          </>
        )}
      </div>
    </div>
  );
};

export default PostProductionSidebar;
