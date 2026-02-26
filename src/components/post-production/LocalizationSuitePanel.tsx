import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Mic, Languages, Sparkles, Captions, Upload, Loader2, Check, AlertCircle,
  Type, Eye, Palette, MonitorPlay, Smartphone, Clapperboard,
} from "lucide-react";
import { toast } from "sonner";

/* ── Tri-State Toggle ── */
type TriState = "netflix" | "tiktok" | "theatrical";

function SubtitleTriState({ value, onChange }: { value: TriState; onChange: (v: TriState) => void }) {
  const opts: { value: TriState; label: string; icon: React.ElementType }[] = [
    { value: "netflix", label: "Netflix", icon: MonitorPlay },
    { value: "tiktok", label: "TikTok Trendy", icon: Smartphone },
    { value: "theatrical", label: "Theatrical", icon: Clapperboard },
  ];
  return (
    <div className="flex rounded-lg border border-border/60 overflow-hidden">
      {opts.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 px-2 py-2 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1",
            value === o.value
              ? "bg-primary/15 text-primary"
              : "bg-secondary/50 text-muted-foreground hover:text-foreground"
          )}
        >
          <o.icon className="h-3 w-3" />
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Section Header ── */
function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className="h-3 w-3 text-primary/70" />
      <span className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}

/* ── Subtitle Preview ── */
function SubtitlePreview({ style }: { style: TriState }) {
  const previewText = "The truth was hiding in plain sight.";

  const styleMap: Record<TriState, { className: string; bg: string; desc: string }> = {
    netflix: {
      className: "text-sm font-sans font-semibold text-white text-center",
      bg: "bg-black/70 px-3 py-1.5 rounded",
      desc: "White on translucent black. Timed Netflix guidelines, 42 chars/line max.",
    },
    tiktok: {
      className: "text-base font-black uppercase tracking-wide text-center",
      bg: "bg-gradient-to-r from-primary/80 to-accent/80 text-primary-foreground px-4 py-2 rounded-xl shadow-lg",
      desc: "Bold pop-on captions with gradient bg. Word-by-word highlight timing.",
    },
    theatrical: {
      className: "text-xs font-serif italic text-white/90 text-center tracking-wide",
      bg: "bg-transparent border-b border-white/20 px-4 py-2",
      desc: "Elegant serif, bottom-center, fade transitions. 2-line max.",
    },
  };

  const s = styleMap[style];

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <div className="aspect-video bg-gradient-to-br from-secondary to-background flex items-end justify-center pb-4 px-4 relative">
        <div className="absolute inset-0 bg-[url('/placeholder.svg')] bg-cover bg-center opacity-10" />
        <div className={cn(s.bg)}>
          <p className={s.className}>{previewText}</p>
        </div>
      </div>
      <div className="px-3 py-2 bg-secondary/40">
        <p className="text-[9px] font-mono text-muted-foreground leading-relaxed">{s.desc}</p>
      </div>
    </div>
  );
}

/* ── Confidence Badge ── */
function ConfidenceBadge({ value }: { value: number }) {
  const color = value >= 90 ? "text-green-400" : value >= 70 ? "text-yellow-400" : "text-red-400";
  return (
    <span className={cn("text-[9px] font-mono font-bold", color)}>
      {value}% conf.
    </span>
  );
}

const ADR_LANGUAGES = [
  "Spanish", "French", "German", "Japanese", "Korean",
  "Mandarin", "Portuguese", "Italian", "Hindi", "Arabic",
  "Thai", "Vietnamese", "Polish", "Turkish", "Dutch",
];

interface LocalizationSuitePanelProps {
  onFileImport?: (file: File, tab: string, category: string) => void;
}

const LocalizationSuitePanel = ({ onFileImport }: LocalizationSuitePanelProps) => {
  /* ── ADR State ── */
  const [adrLang, setAdrLang] = useState("");
  const [adrProcessing, setAdrProcessing] = useState(false);
  const [adrProgress, setAdrProgress] = useState(0);
  const [adrComplete, setAdrComplete] = useState(false);
  const adrIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Whisper State ── */
  const [whisperProcessing, setWhisperProcessing] = useState(false);
  const [whisperProgress, setWhisperProgress] = useState(0);
  const [whisperComplete, setWhisperComplete] = useState(false);
  const [whisperSegments, setWhisperSegments] = useState<{ time: string; text: string; confidence: number }[]>([]);
  const whisperIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Subtitle Styling State ── */
  const [subtitleStyle, setSubtitleStyle] = useState<TriState>("netflix");
  const [fontSize, setFontSize] = useState([16]);
  const [lineSpacing, setLineSpacing] = useState([1.4]);
  const [outlineWeight, setOutlineWeight] = useState([2]);

  /* ── ADR Handlers ── */
  const handleAdrDub = () => {
    if (!adrLang) {
      toast.error("Select a target language first");
      return;
    }
    setAdrProcessing(true);
    setAdrProgress(0);
    setAdrComplete(false);

    adrIntervalRef.current = setInterval(() => {
      setAdrProgress((p) => {
        if (p >= 100) {
          clearInterval(adrIntervalRef.current!);
          setAdrProcessing(false);
          setAdrComplete(true);
          toast.success(`Visual ADR complete — ${adrLang} dub generated with lip-sync`);
          return 100;
        }
        return p + Math.random() * 8;
      });
    }, 200);
  };

  /* ── Whisper Handlers ── */
  const handleWhisperCaption = () => {
    setWhisperProcessing(true);
    setWhisperProgress(0);
    setWhisperComplete(false);
    setWhisperSegments([]);

    const mockSegments = [
      { time: "00:00:02.400", text: "You don't understand what's happening.", confidence: 97 },
      { time: "00:00:05.100", text: "None of this was supposed to be real.", confidence: 94 },
      { time: "00:00:08.800", text: "But here we are.", confidence: 99 },
      { time: "00:00:11.300", text: "And there's no going back.", confidence: 91 },
      { time: "00:00:14.700", text: "[ambient noise]", confidence: 62 },
      { time: "00:00:17.200", text: "Tell me something I don't know.", confidence: 96 },
    ];

    whisperIntervalRef.current = setInterval(() => {
      setWhisperProgress((p) => {
        if (p >= 100) {
          clearInterval(whisperIntervalRef.current!);
          setWhisperProcessing(false);
          setWhisperComplete(true);
          setWhisperSegments(mockSegments);
          toast.success("Whisper transcription complete — 6 segments extracted");
          return 100;
        }
        return p + Math.random() * 6;
      });
    }, 150);
  };

  const handleFileImport = (file: File) => {
    onFileImport?.(file, "locale", "Localization");
    toast.success(`Imported "${file.name}" to Localization`);
  };

  const importRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-5">
      {/* ═══ VISUAL ADR / DUBBING ═══ */}
      <div>
        <SectionHeader icon={Mic} label="AI Visual ADR" />
        <p className="text-[9px] font-mono text-muted-foreground/60 mb-2 leading-relaxed">
          AI-driven dubbing with automatic lip-sync alignment. Preserves original performance emotion across languages.
        </p>

        <Select value={adrLang} onValueChange={setAdrLang}>
          <SelectTrigger className="h-8 bg-background border-border/60 text-[10px] font-mono mb-2 cinema-inset">
            <SelectValue placeholder="Target language…" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border z-50">
            {ADR_LANGUAGES.map((l) => (
              <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {adrProcessing && (
          <div className="space-y-1.5 mb-2">
            <Progress value={Math.min(adrProgress, 100)} className="h-1.5" />
            <div className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="text-[9px] font-mono text-primary/70">
                {adrProgress < 30 ? "Analyzing dialogue timing…" :
                 adrProgress < 60 ? "Generating target language audio…" :
                 adrProgress < 85 ? "Aligning lip movements…" :
                 "Finalizing visual ADR…"}
              </span>
            </div>
          </div>
        )}

        {adrComplete && (
          <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-md bg-green-500/10 border border-green-500/20">
            <Check className="h-3 w-3 text-green-400" />
            <span className="text-[9px] font-mono text-green-400">{adrLang} dub ready — lip-sync verified</span>
          </div>
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={handleAdrDub}
          disabled={adrProcessing}
          className="w-full text-[10px] font-mono gap-1.5 h-8 cinema-inset active:translate-y-px"
        >
          {adrProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
          {adrProcessing ? "Processing…" : "Translate & Sync Lip Movements"}
        </Button>
      </div>

      {/* ═══ WHISPER AUTO-CAPTIONING ═══ */}
      <div className="border-t border-border/40 pt-4">
        <SectionHeader icon={Captions} label="Whisper Auto-Caption" />
        <p className="text-[9px] font-mono text-muted-foreground/60 mb-2 leading-relaxed">
          Extract word-level timestamps and confidence scores from your audio track using Whisper.
        </p>

        {/* Import SRT/VTT */}
        <div className="mb-2">
          <input
            ref={importRef}
            type="file"
            accept=".srt,.vtt,.ass,.ssa,.sub,.sbv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) { handleFileImport(f); e.target.value = ""; }
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => importRef.current?.click()}
            className="w-full text-[10px] font-mono gap-1.5 h-7 text-muted-foreground hover:text-foreground justify-start"
          >
            <Upload className="h-3 w-3" /> Import SRT / VTT / ASS
          </Button>
        </div>

        {whisperProcessing && (
          <div className="space-y-1.5 mb-2">
            <Progress value={Math.min(whisperProgress, 100)} className="h-1.5" />
            <div className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="text-[9px] font-mono text-primary/70">
                {whisperProgress < 25 ? "Loading Whisper model…" :
                 whisperProgress < 50 ? "Decoding audio stream…" :
                 whisperProgress < 80 ? "Segmenting & timestamping…" :
                 "Computing confidence scores…"}
              </span>
            </div>
          </div>
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={handleWhisperCaption}
          disabled={whisperProcessing}
          className="w-full text-[10px] font-mono gap-1.5 h-8 cinema-inset active:translate-y-px"
        >
          {whisperProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {whisperProcessing ? "Transcribing…" : "Auto-Caption with Whisper"}
        </Button>

        {/* Transcript Results */}
        {whisperComplete && whisperSegments.length > 0 && (
          <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
            {whisperSegments.map((seg, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md bg-secondary/40 px-2 py-1.5 border border-border/40">
                <span className="text-[8px] font-mono text-primary/60 whitespace-nowrap pt-0.5">{seg.time}</span>
                <span className="text-[10px] font-mono text-foreground/80 flex-1 leading-snug">{seg.text}</span>
                <ConfidenceBadge value={seg.confidence} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ SUBTITLE STYLING ═══ */}
      <div className="border-t border-border/40 pt-4">
        <SectionHeader icon={Type} label="Subtitle Styling" />
        <SubtitleTriState value={subtitleStyle} onChange={setSubtitleStyle} />

        {/* Live Preview */}
        <div className="mt-3">
          <SubtitlePreview style={subtitleStyle} />
        </div>

        {/* Refinement Sliders */}
        <div className="mt-3 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-mono text-muted-foreground">Font Size</span>
              <span className="text-[9px] font-mono text-foreground">{fontSize[0]}px</span>
            </div>
            <Slider value={fontSize} onValueChange={setFontSize} min={10} max={32} step={1} className="w-full" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-mono text-muted-foreground">Line Spacing</span>
              <span className="text-[9px] font-mono text-foreground">{lineSpacing[0].toFixed(1)}×</span>
            </div>
            <Slider value={lineSpacing} onValueChange={setLineSpacing} min={1.0} max={2.5} step={0.1} className="w-full" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-mono text-muted-foreground">Outline Weight</span>
              <span className="text-[9px] font-mono text-foreground">{outlineWeight[0]}px</span>
            </div>
            <Slider value={outlineWeight} onValueChange={setOutlineWeight} min={0} max={6} step={0.5} className="w-full" />
          </div>
        </div>

        {/* Style-specific details */}
        <div className="mt-3 rounded-md bg-secondary/30 border border-border/40 px-3 py-2">
          {subtitleStyle === "netflix" && (
            <div className="space-y-1">
              <p className="text-[9px] font-mono text-foreground/70"><Eye className="h-2.5 w-2.5 inline mr-1 text-primary/60" />Netflix Timed Text — 42 chars/line, 2 lines max</p>
              <p className="text-[9px] font-mono text-muted-foreground/50">Sans-serif, white on semi-opaque black. Reading speed: 17 chars/sec.</p>
            </div>
          )}
          {subtitleStyle === "tiktok" && (
            <div className="space-y-1">
              <p className="text-[9px] font-mono text-foreground/70"><Palette className="h-2.5 w-2.5 inline mr-1 text-primary/60" />TikTok Trendy — Bold pop-on, word-by-word highlight</p>
              <p className="text-[9px] font-mono text-muted-foreground/50">Gradient backgrounds, oversized bold text, center screen. Auto-emphasis on keywords.</p>
            </div>
          )}
          {subtitleStyle === "theatrical" && (
            <div className="space-y-1">
              <p className="text-[9px] font-mono text-foreground/70"><Clapperboard className="h-2.5 w-2.5 inline mr-1 text-primary/60" />Classic Theatrical — Serif italic, fade transitions</p>
              <p className="text-[9px] font-mono text-muted-foreground/50">Bottom-center placement, subtle underline, cinematic fade in/out at 0.3s.</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ EXPORT CAPTIONS ═══ */}
      <div className="border-t border-border/40 pt-4">
        <SectionHeader icon={Captions} label="Export Captions" />
        <div className="grid grid-cols-2 gap-1.5">
          {[".srt", ".vtt", ".ass", ".dfxp"].map((fmt) => (
            <Button
              key={fmt}
              variant="ghost"
              size="sm"
              className="text-[10px] font-mono h-7 text-muted-foreground hover:text-foreground"
              onClick={() => toast.info(`Export ${fmt} — coming soon`)}
            >
              Export {fmt.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LocalizationSuitePanel;
