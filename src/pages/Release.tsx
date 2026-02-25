import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Download, ShieldCheck, FileVideo, Sparkles, Smartphone, Image, Film, Loader2, Package, Upload, Lock } from "lucide-react";
import ExportHistoryPanel, { type ExportRecord, triggerDownload } from "@/components/release/ExportHistoryPanel";

const Release = () => {
  const [topaz, setTopaz] = useState(false);
  const [tagline, setTagline] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const { toast } = useToast();

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


  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
      {/* Top bar with Export History */}
      <div className="flex items-center justify-between">
        <div />
        <ExportHistoryPanel exports={exports} onClear={() => setExports([])} />
      </div>
      {/* Export Master Film */}
      <div className="rounded-xl border border-border bg-card p-8 cinema-inset">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileVideo className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold">Export Master Film</h2>
            <p className="text-sm text-muted-foreground">Final render and distribution</p>
          </div>
        </div>

        <Tabs defaultValue="auto" className="w-full">
          <TabsList className="w-full bg-secondary mb-6">
            <TabsTrigger value="auto" className="flex-1">Auto</TabsTrigger>
            <TabsTrigger value="templates" className="flex-1">Templates</TabsTrigger>
            <TabsTrigger value="custom" className="flex-1">Custom</TabsTrigger>
          </TabsList>

          <TabsContent value="auto">
            <div className="text-center py-8">
              <p className="font-display font-semibold">AI-Optimized Export</p>
              <p className="text-sm text-muted-foreground mt-1">
                Best codec, bitrate, and resolution will be auto-selected.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="templates">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <Label htmlFor="topaz" className="text-sm font-medium cursor-pointer">
                    Topaz 4K Cinematic Upscale
                  </Label>
                </div>
                <Switch id="topaz" checked={topaz} onCheckedChange={setTopaz} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {["YouTube 4K", "Netflix ProRes", "Theater DCP"].map((t) => (
                  <button
                    key={t}
                    className="rounded-lg border border-border bg-secondary p-4 text-sm font-medium hover:border-primary/50 transition-colors text-center"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="custom">
            <div className="text-center py-8">
              <p className="font-display font-semibold">Custom Export Settings</p>
              <p className="text-sm text-muted-foreground mt-1">
                Configure codec, resolution, bitrate, and container format.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-center">
          <Button size="lg" className="gap-2 px-10" disabled={processing === "master"} onClick={() => handleProcess("master")}>
            {processing === "master" ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Exporting…</>
            ) : (
              <><Download className="h-5 w-5" /> Export Master</>
            )}
          </Button>
        </div>
      </div>

      {/* removed old Legal & Compliance — replaced by bottom section */}

      {/* Auto-Deliverables & Marketing */}
      <div className="rounded-xl border border-border bg-card p-8 cinema-inset">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold">Auto-Deliverables & Marketing</h2>
            <p className="text-sm text-muted-foreground">Automated assets for distribution and promotion</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1 — Multi-Ratio Social Masters */}
          <div className="rounded-xl border border-border bg-secondary/50 p-5 flex flex-col cinema-inset">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-display text-sm font-bold mb-1">Multi-Ratio Social Masters</h3>
            <p className="text-[11px] text-muted-foreground mb-4 flex-1">
              Auto-reframe 16:9 master to 9:16 vertical using object tracking.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="w-full text-[10px] font-mono gap-1.5 h-9 cinema-inset active:translate-y-px"
              disabled={processing === "social"}
              onClick={() => handleProcess("social")}
            >
              {processing === "social" ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…</>
              ) : (
                <><Smartphone className="h-3.5 w-3.5" /> Generate Social Cutdowns</>
              )}
            </Button>
          </div>

          {/* Card 2 — Marketing Assets */}
          <div className="rounded-xl border border-border bg-secondary/50 p-5 flex flex-col cinema-inset">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
              <Image className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-display text-sm font-bold mb-1">Marketing Assets</h3>
            <p className="text-[11px] text-muted-foreground mb-3 flex-1">
              Generate 27×40 theatrical poster and Electronic Press Kit (EPK).
            </p>
            <Input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Tagline…"
              className="h-8 text-[10px] font-mono bg-background border-border/60 placeholder:text-muted-foreground/40 mb-3 cinema-inset"
            />
            <Button
              variant="secondary"
              size="sm"
              className="w-full text-[10px] font-mono gap-1.5 h-9 cinema-inset active:translate-y-px"
              disabled={processing === "poster"}
              onClick={() => handleProcess("poster")}
            >
              {processing === "poster" ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…</>
              ) : (
                <><Image className="h-3.5 w-3.5" /> Generate Poster & EPK</>
              )}
            </Button>
          </div>

          {/* Card 3 — Trailer Engine */}
          <div className="rounded-xl border border-border bg-secondary/50 p-5 flex flex-col cinema-inset">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
              <Film className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-display text-sm font-bold mb-1">Trailer Engine</h3>
            <p className="text-[11px] text-muted-foreground mb-4 flex-1">
              Auto-cut a 60-second trailer based on high-action structural beats.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="w-full text-[10px] font-mono gap-1.5 h-9 cinema-inset active:translate-y-px"
              disabled={processing === "trailer"}
              onClick={() => handleProcess("trailer")}
            >
              {processing === "trailer" ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…</>
              ) : (
                <><Film className="h-3.5 w-3.5" /> Generate 60s Trailer</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Distribution & Legal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left — Distribution Packaging */}
        <div className="rounded-xl border border-border bg-card p-6 cinema-inset space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold">Distribution Packaging</h3>
              <p className="text-[11px] text-muted-foreground">Festival & aggregator delivery</p>
            </div>
          </div>

          <div className="space-y-3">
            {/* FilmFreeway Packager */}
            <div className="rounded-lg border border-border bg-secondary/50 p-4 cinema-inset">
              <p className="text-[10px] font-mono text-muted-foreground mb-2">SACRED HEIST Festival Package</p>
              <Button
                variant="secondary"
                size="sm"
                className="w-full text-[10px] font-mono gap-1.5 h-9 cinema-inset active:translate-y-px"
                disabled={processing === "filmfreeway"}
                onClick={() => handleProcess("filmfreeway")}
              >
                {processing === "filmfreeway" ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Packaging…</>
                ) : (
                  <><Download className="h-3.5 w-3.5" /> Export Festival ZIP (Screener + Poster + Script)</>
                )}
              </Button>
            </div>

            {/* ProRes Export */}
            <Button
              variant="secondary"
              size="sm"
              className="w-full text-[10px] font-mono gap-1.5 h-9 cinema-inset active:translate-y-px"
              disabled={processing === "prores"}
              onClick={() => handleProcess("prores")}
            >
              {processing === "prores" ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Encoding…</>
              ) : (
                <><FileVideo className="h-3.5 w-3.5" /> ProRes 422 HQ Export</>
              )}
            </Button>

            {/* Direct OAuth Uploads */}
            <div>
              <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-2">Direct Upload</p>
              <div className="flex gap-2">
                {[
                  { id: "youtube", label: "YouTube" },
                  { id: "vimeo", label: "Vimeo" },
                  { id: "tiktok", label: "TikTok" },
                ].map((p) => (
                  <Button
                    key={p.id}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-[10px] font-mono gap-1 h-8 cinema-inset active:translate-y-px"
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
        </div>

        {/* Right — C2PA Legal Provenance Ledger */}
        <div className="rounded-xl border bg-card p-6 cinema-inset space-y-4" style={{ borderColor: "hsl(145 40% 30% / 0.5)" }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: "hsl(145 40% 20% / 0.3)" }}>
              <ShieldCheck className="h-5 w-5" style={{ color: "hsl(145 50% 50%)" }} />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold">Chain-of-Title & Provenance</h3>
              <p className="text-[11px] font-mono" style={{ color: "hsl(145 40% 55%)" }}>C2PA Verified</p>
            </div>
          </div>

          {/* Metadata fields */}
          <div className="space-y-2">
            {[
              { label: "Director / Producer", value: "Paul Greenberg" },
              { label: "Entity", value: "Greenberg Direct, Inc." },
            ].map((field) => (
              <div key={field.label} className="rounded-lg bg-secondary/50 border border-border/50 px-4 py-2.5 cinema-inset">
                <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">{field.label}</p>
                <p className="text-xs font-mono text-foreground/90 mt-0.5">{field.value}</p>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Compiles cryptographic hashes, API licenses, timestamps, and per-frame generative provenance claims into a legal PDF.
          </p>

          <Button
            size="sm"
            className="w-full text-[10px] font-mono gap-2 h-10 font-bold uppercase tracking-wider cinema-inset active:translate-y-px"
            disabled={processing === "c2pa"}
            onClick={() => handleProcess("c2pa")}
          >
            {processing === "c2pa" ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating Ledger…</>
            ) : (
              <><Lock className="h-4 w-4" /> Generate C2PA Ledger PDF</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Release;
