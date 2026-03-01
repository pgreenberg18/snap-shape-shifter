import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Download, ShieldCheck, FileVideo, Sparkles, Smartphone, Image, Film,
  Loader2, Package, Upload, Lock, Monitor, Trash2, FolderDown, ChevronDown, Eye,
} from "lucide-react";
import { type ExportRecord, triggerDownload } from "@/components/release/ExportHistoryPanel";
import ArtifactScannerPanel from "@/components/release/ArtifactScannerPanel";
import TopazDIPanel from "@/components/release/TopazDIPanel";
import { useFilm } from "@/hooks/useFilm";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

/* ── Type icon map ── */
const TYPE_ICONS: Record<string, React.ReactNode> = {
  social: <Smartphone className="h-3 w-3" />,
  poster: <Image className="h-3 w-3" />,
  trailer: <Film className="h-3 w-3" />,
  filmfreeway: <Package className="h-3 w-3" />,
  prores: <FileVideo className="h-3 w-3" />,
  youtube: <FileVideo className="h-3 w-3" />,
  vimeo: <FileVideo className="h-3 w-3" />,
  tiktok: <Smartphone className="h-3 w-3" />,
  c2pa: <Lock className="h-3 w-3" />,
  master: <FileVideo className="h-3 w-3" />,
};

/* ── Collapsible Section wrapper ── */
function Section({
  icon: Icon,
  title,
  subtitle,
  defaultOpen = true,
  children,
  className,
  iconClassName,
  iconBg,
  ...props
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  iconClassName?: string;
  iconBg?: string;
  [key: string]: any;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} {...props}>
      <div className={cn("rounded-lg border border-border bg-card cinema-inset overflow-hidden", className)}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 w-full px-4 py-3 hover:bg-secondary/40 transition-colors text-left">
            <div className={cn("h-7 w-7 rounded-md flex items-center justify-center shrink-0", iconBg || "bg-primary/10")}>
              <Icon className={cn("h-3.5 w-3.5", iconClassName || "text-primary")} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-xs font-bold uppercase tracking-widest">{title}</h3>
              {subtitle && <p className="text-[9px] font-mono text-muted-foreground">{subtitle}</p>}
            </div>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200", open && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

const Release = () => {
  const [topaz, setTopaz] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const { toast } = useToast();
  const { data: film } = useFilm();

  /* Custom export state */
  const [customCodec, setCustomCodec] = useState("h264");
  const [customContainer, setCustomContainer] = useState("mp4");
  const [customBitrate, setCustomBitrate] = useState([25]);
  const [customWidth, setCustomWidth] = useState("1920");
  const [customHeight, setCustomHeight] = useState("1080");
  const [customFps, setCustomFps] = useState("24");
  const [customAudioCodec, setCustomAudioCodec] = useState("aac");
  const [customAudioBitrate, setCustomAudioBitrate] = useState([320]);
  const [customSampleRate, setCustomSampleRate] = useState("48000");
  const [customColorSpace, setCustomColorSpace] = useState("rec709");
  const [customPixelFormat, setCustomPixelFormat] = useState("yuv420p");
  const [customDeinterlace, setCustomDeinterlace] = useState(false);
  const [custom2Pass, setCustom2Pass] = useState(true);

  const EXPORT_LABELS: Record<string, { label: string; fileName: string }> = {
    master: { label: "Master Film Export", fileName: "master_export.mov" },
    social: { label: "Multi-Ratio Social Masters", fileName: "social_cutdowns.zip" },
    poster: { label: "Poster & EPK", fileName: "poster_epk.zip" },
    trailer: { label: "60s Trailer", fileName: "trailer_60s.mp4" },
    filmfreeway: { label: "Festival Package", fileName: "festival_package.zip" },
    prores: { label: "ProRes 422 HQ", fileName: "master_prores422hq.mov" },
    youtube: { label: "YouTube Upload", fileName: "youtube_upload.mp4" },
    vimeo: { label: "Vimeo Upload", fileName: "vimeo_upload.mp4" },
    tiktok: { label: "TikTok Upload", fileName: "tiktok_upload.mp4" },
    c2pa: { label: "C2PA Ledger PDF", fileName: "c2pa_provenance_ledger.pdf" },
  };

  const handleProcess = useCallback((id: string) => {
    setProcessing(id);
    setTimeout(() => {
      setProcessing(null);
      const meta = EXPORT_LABELS[id] || { label: id, fileName: `${id}_export.bin` };
      const record: ExportRecord = {
        id: crypto.randomUUID(),
        type: id,
        label: meta.label,
        timestamp: new Date(),
        fileName: meta.fileName,
      };
      setExports((prev) => [record, ...prev]);
      triggerDownload(record);
      toast({ title: "Export Complete", description: `${meta.label} saved — downloading now.` });
    }, 4000);
  }, [toast]);

  /* Processing button helper */
  const ProcBtn = ({ id, icon: Icon, label, variant = "secondary" }: { id: string; icon: React.ElementType; label: string; variant?: "secondary" | "outline" }) => (
    <Button
      variant={variant}
      size="sm"
      className="w-full text-[10px] font-mono gap-1.5 h-8 cinema-inset active:translate-y-px"
      disabled={processing === id}
      onClick={() => handleProcess(id)}
    >
      {processing === id ? (
        <><Loader2 className="h-3 w-3 animate-spin" /> Processing…</>
      ) : (
        <><Icon className="h-3 w-3" /> {label}</>
      )}
    </Button>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border bg-card px-6 py-3 flex items-baseline gap-3">
        <h1 className="font-display text-xl font-bold tracking-tight text-foreground whitespace-nowrap">Release</h1>
        <p className="text-xs text-muted-foreground truncate">Export masters, quality control, upscaling, and distribution packaging.</p>
      </div>
    <div className="flex flex-1 min-h-0">
      {/* ═══ LEFT — All Controls ═══ */}
      <ScrollArea className="flex-1 min-w-0">
        <div className="p-4 space-y-3">

          {/* ── Export Master Film ── */}
          <Section icon={FileVideo} title="Export Master Film" data-help-id="release-export">
            <div className="flex items-center justify-end mb-3">
              <Button size="sm" className="gap-1.5 h-7 px-4 text-[10px]" disabled={processing === "master"} onClick={() => handleProcess("master")}>
                {processing === "master" ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Exporting…</>
                ) : (
                  <><Download className="h-3 w-3" /> Export</>
                )}
              </Button>
            </div>

            {/* Format spec */}
            <div className="rounded-md border border-border bg-secondary/50 px-3 py-2 cinema-inset mb-3">
              <div className="flex items-center gap-4 text-[10px] font-mono flex-wrap">
                <span className="text-muted-foreground">Type: <span className="text-foreground/90 font-semibold">{(film as any)?.format_type || "—"}</span></span>
                <span className="text-muted-foreground">Res: <span className="text-foreground/90 font-semibold">{(film as any)?.frame_width && (film as any)?.frame_height ? `${(film as any).frame_width}×${(film as any).frame_height}` : "—"}</span></span>
                <span className="text-muted-foreground">FPS: <span className="text-foreground/90 font-semibold">{(film as any)?.frame_rate || "—"}</span></span>
              </div>
            </div>

            <Tabs defaultValue="auto" className="w-full">
              <TabsList className="w-full bg-secondary h-7 mb-2.5">
                <TabsTrigger value="auto" className="flex-1 text-[10px] h-6">Auto</TabsTrigger>
                <TabsTrigger value="templates" className="flex-1 text-[10px] h-6">Templates</TabsTrigger>
                <TabsTrigger value="custom" className="flex-1 text-[10px] h-6">Custom</TabsTrigger>
              </TabsList>

              <TabsContent value="auto">
                <div className="space-y-2">
                  <p className="text-[9px] text-muted-foreground font-mono mb-1.5">
                    Auto-configured from your format settings:
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-border bg-secondary/50 px-3 py-2.5 cinema-inset">
                    {[
                      { label: "Codec", value: (film as any)?.format_type === "Feature Film" || (film as any)?.format_type === "Short Film" ? "H.264 (High)" : "H.264 (Main)" },
                      { label: "Container", value: ".mp4" },
                      { label: "Resolution", value: (film as any)?.frame_width && (film as any)?.frame_height ? `${(film as any).frame_width}×${(film as any).frame_height}` : "1920×1080" },
                      { label: "Frame Rate", value: `${(film as any)?.frame_rate || 24} fps` },
                      { label: "Bitrate", value: ((film as any)?.frame_height ?? 1080) >= 2160 ? "50 Mbps" : ((film as any)?.frame_height ?? 1080) >= 1080 ? "25 Mbps" : "15 Mbps" },
                      { label: "Encoding", value: "2-Pass VBR" },
                      { label: "Color Space", value: "Rec. 709" },
                      { label: "Pixel Format", value: "yuv420p" },
                      { label: "Audio Codec", value: "AAC-LC" },
                      { label: "Audio Bitrate", value: "320 kbps" },
                      { label: "Sample Rate", value: "48.0 kHz" },
                      { label: "Channels", value: "Stereo (2.0)" },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between py-0.5">
                        <span className="text-[9px] font-mono text-muted-foreground">{label}</span>
                        <span className="text-[9px] font-mono text-foreground/90 font-semibold">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="templates">
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-md bg-secondary px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-primary" />
                      <Label htmlFor="topaz" className="text-[10px] font-medium cursor-pointer">Topaz 4K Upscale</Label>
                    </div>
                    <Switch id="topaz" checked={topaz} onCheckedChange={setTopaz} />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {["YouTube 4K", "Netflix ProRes", "Theater DCP"].map((t) => (
                      <button key={t} className="rounded-md border border-border bg-secondary px-2 py-2 text-[10px] font-medium hover:border-primary/50 transition-colors text-center">
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="custom">
                <div className="space-y-3">
                  {/* Video Settings */}
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1.5">Video</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[9px] text-muted-foreground mb-0.5 block">Codec</Label>
                        <Select value={customCodec} onValueChange={setCustomCodec}>
                          <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["h264", "h265", "prores_422", "prores_4444", "dnxhd", "vp9", "av1"].map(c => (
                              <SelectItem key={c} value={c} className="text-[10px]">{c.toUpperCase().replace("_", " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[9px] text-muted-foreground mb-0.5 block">Container</Label>
                        <Select value={customContainer} onValueChange={setCustomContainer}>
                          <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["mp4", "mov", "mkv", "mxf", "avi", "webm"].map(c => (
                              <SelectItem key={c} value={c} className="text-[10px]">.{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between">
                        <Label className="text-[9px] text-muted-foreground">Bitrate</Label>
                        <span className="text-[9px] font-mono text-foreground/80">{customBitrate[0]} Mbps</span>
                      </div>
                      <Slider value={customBitrate} onValueChange={setCustomBitrate} min={1} max={200} step={1} className="mt-1" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div>
                        <Label className="text-[9px] text-muted-foreground mb-0.5 block">Width</Label>
                        <Input value={customWidth} onChange={e => setCustomWidth(e.target.value)} className="h-7 text-[10px] font-mono" />
                      </div>
                      <div>
                        <Label className="text-[9px] text-muted-foreground mb-0.5 block">Height</Label>
                        <Input value={customHeight} onChange={e => setCustomHeight(e.target.value)} className="h-7 text-[10px] font-mono" />
                      </div>
                      <div>
                        <Label className="text-[9px] text-muted-foreground mb-0.5 block">FPS</Label>
                        <Select value={customFps} onValueChange={setCustomFps}>
                          <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["23.976", "24", "25", "29.97", "30", "48", "50", "59.94", "60"].map(f => (
                              <SelectItem key={f} value={f} className="text-[10px]">{f}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <Label className="text-[9px] text-muted-foreground mb-0.5 block">Color Space</Label>
                        <Select value={customColorSpace} onValueChange={setCustomColorSpace}>
                          <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["rec709", "rec2020", "dci_p3", "srgb", "aces_cg"].map(c => (
                              <SelectItem key={c} value={c} className="text-[10px]">{c.replace("_", " ").toUpperCase()}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[9px] text-muted-foreground mb-0.5 block">Pixel Format</Label>
                        <Select value={customPixelFormat} onValueChange={setCustomPixelFormat}>
                          <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["yuv420p", "yuv422p", "yuv444p", "yuv420p10le", "yuv422p10le", "rgb48"].map(p => (
                              <SelectItem key={p} value={p} className="text-[10px]">{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-4 mt-2">
                      <div className="flex items-center gap-1.5">
                        <Switch id="2pass" checked={custom2Pass} onCheckedChange={setCustom2Pass} />
                        <Label htmlFor="2pass" className="text-[9px] cursor-pointer">2-Pass Encode</Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Switch id="deinterlace" checked={customDeinterlace} onCheckedChange={setCustomDeinterlace} />
                        <Label htmlFor="deinterlace" className="text-[9px] cursor-pointer">Deinterlace</Label>
                      </div>
                    </div>
                  </div>

                  {/* Audio Settings */}
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1.5">Audio</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[9px] text-muted-foreground mb-0.5 block">Codec</Label>
                        <Select value={customAudioCodec} onValueChange={setCustomAudioCodec}>
                          <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["aac", "pcm_s24le", "pcm_s16le", "flac", "ac3", "eac3", "opus"].map(c => (
                              <SelectItem key={c} value={c} className="text-[10px]">{c.toUpperCase().replace("_", " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[9px] text-muted-foreground mb-0.5 block">Bitrate</Label>
                        <Select value={String(customAudioBitrate[0])} onValueChange={v => setCustomAudioBitrate([Number(v)])}>
                          <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["128", "192", "256", "320", "512", "1536"].map(b => (
                              <SelectItem key={b} value={b} className="text-[10px]">{b} kbps</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[9px] text-muted-foreground mb-0.5 block">Sample Rate</Label>
                        <Select value={customSampleRate} onValueChange={setCustomSampleRate}>
                          <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["44100", "48000", "96000"].map(s => (
                              <SelectItem key={s} value={s} className="text-[10px]">{(Number(s)/1000).toFixed(1)} kHz</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </Section>

          {/* ── Deliverables & Marketing ── */}
          <Section icon={Sparkles} title="Deliverables & Marketing">
            <div className="grid grid-cols-1 gap-2.5">
              <div className="rounded-md border border-border bg-secondary/50 p-3 cinema-inset">
                <p className="text-[10px] font-mono font-semibold mb-0.5">Multi-Ratio Social Masters</p>
                <p className="text-[9px] text-muted-foreground mb-2">Auto-reframe 16:9 → 9:16 via object tracking.</p>
                <ProcBtn id="social" icon={Smartphone} label="Generate Social Cutdowns" />
              </div>
              <div className="rounded-md border border-border bg-secondary/50 p-3 cinema-inset">
                <p className="text-[10px] font-mono font-semibold mb-0.5">Marketing Assets</p>
                <p className="text-[9px] text-muted-foreground mb-2">27×40 theatrical poster & Electronic Press Kit.</p>
                <ProcBtn id="poster" icon={Image} label="Generate Poster & EPK" />
              </div>
              <div className="rounded-md border border-border bg-secondary/50 p-3 cinema-inset">
                <p className="text-[10px] font-mono font-semibold mb-0.5">Trailer Engine</p>
                <p className="text-[9px] text-muted-foreground mb-2">Auto-cut 60s trailer from high-action beats.</p>
                <ProcBtn id="trailer" icon={Film} label="Generate 60s Trailer" />
              </div>
            </div>
          </Section>

          {/* ── Technical QC ── */}
          <div data-help-id="release-artifact-scanner"><ArtifactScannerPanel /></div>

          {/* ── Distribution Packaging ── */}
          <Section icon={Package} title="Distribution Packaging" data-help-id="release-distribution">
            <div className="space-y-2.5">
              <div className="rounded-md border border-border bg-secondary/50 p-3 cinema-inset">
                <p className="text-[9px] font-mono text-muted-foreground mb-1.5">Festival Package</p>
                <ProcBtn id="filmfreeway" icon={Download} label="Export Festival ZIP (Screener + Poster + Script)" />
              </div>
              <ProcBtn id="prores" icon={FileVideo} label="ProRes 422 HQ Export" />
              <div>
                <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1.5">Direct Upload</p>
                <div className="flex gap-1.5">
                  {[
                    { id: "youtube", label: "YouTube" },
                    { id: "vimeo", label: "Vimeo" },
                    { id: "tiktok", label: "TikTok" },
                  ].map((p) => (
                    <Button
                      key={p.id}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-[9px] font-mono gap-1 h-7 cinema-inset active:translate-y-px"
                      disabled={processing === p.id}
                      onClick={() => handleProcess(p.id)}
                    >
                      {processing === p.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <><Upload className="h-3 w-3" /> {p.label}</>
                      )}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* ── Topaz DI Engine ── */}
          <div data-help-id="release-topaz"><TopazDIPanel /></div>

          {/* ── C2PA Chain-of-Title & Provenance ── */}
          <Section
            icon={ShieldCheck}
            title="Chain-of-Title & Provenance"
            subtitle="C2PA Verified"
            iconBg="bg-[hsl(145_40%_20%/0.3)]"
            iconClassName="text-[hsl(145_50%_50%)]"
            className="border-[hsl(145_40%_30%/0.5)]"
            data-help-id="release-c2pa"
          >
            <div className="space-y-2.5">
              {[
                { label: "Director / Producer", value: "Paul Greenberg" },
                { label: "Entity", value: "Greenberg Direct, Inc." },
              ].map((field) => (
                <div key={field.label} className="rounded-md bg-secondary/50 border border-border/50 px-3 py-2 cinema-inset">
                  <p className="text-[8px] font-mono uppercase tracking-widest text-muted-foreground/60">{field.label}</p>
                  <p className="text-[11px] font-mono text-foreground/90">{field.value}</p>
                </div>
              ))}
              <p className="text-[9px] text-muted-foreground leading-relaxed">
                Cryptographic hashes, API licenses, timestamps, and per-frame provenance claims compiled into a legal PDF.
              </p>
              <Button
                size="sm"
                className="w-full text-[9px] font-mono gap-1.5 h-8 font-bold uppercase tracking-wider cinema-inset active:translate-y-px"
                disabled={processing === "c2pa"}
                onClick={() => handleProcess("c2pa")}
              >
                {processing === "c2pa" ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
                ) : (
                  <><Lock className="h-3.5 w-3.5" /> Generate C2PA Ledger PDF</>
                )}
              </Button>
            </div>
          </Section>

        </div>
      </ScrollArea>

      {/* ═══ RIGHT — Finished Exports ═══ */}
      <div data-help-id="release-export-history" className="w-64 shrink-0 border-l border-border bg-card flex flex-col">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <div className="flex items-center gap-1.5">
            <FolderDown className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-display font-bold uppercase tracking-wider">Finished Exports</span>
          </div>
          {exports.length > 0 && (
            <span className="h-4 min-w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-1">
              {exports.length}
            </span>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1.5">
            {exports.length === 0 ? (
              <div className="text-center py-10">
                <FolderDown className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-[10px] text-muted-foreground/50 font-mono">No exports yet.</p>
                <p className="text-[9px] text-muted-foreground/35 font-mono mt-0.5">Exported files will appear here.</p>
              </div>
            ) : (
              exports.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-2.5 py-2 group/export"
                >
                  <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    {TYPE_ICONS[record.type] ?? <FileVideo className="h-3 w-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-mono font-semibold truncate">{record.label}</p>
                    <p className="text-[8px] font-mono text-muted-foreground/50 truncate">
                      {record.fileName} · {format(record.timestamp, "h:mm a")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 opacity-0 group-hover/export:opacity-100 transition-opacity"
                    onClick={() => triggerDownload(record)}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {exports.length > 0 && (
          <div className="border-t border-border px-2 py-2">
            <Button variant="ghost" size="sm" className="w-full gap-1 text-[9px] text-muted-foreground h-7" onClick={() => setExports([])}>
              <Trash2 className="h-3 w-3" /> Clear All
            </Button>
          </div>
        )}
      </div>
    </div>
    </div>
  );
};

export default Release;
