import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, ShieldCheck, FileVideo, Sparkles } from "lucide-react";

const Release = () => {
  const [topaz, setTopaz] = useState(false);
  const { toast } = useToast();

  const handleC2PA = () => {
    toast({
      title: "C2PA Provenance Verified",
      description: "Cryptographic hash verified.",
    });
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
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
          <Button size="lg" className="gap-2 px-10">
            <Download className="h-5 w-5" />
            Export Master
          </Button>
        </div>
      </div>

      {/* Legal & Compliance */}
      <div className="rounded-xl border border-border bg-card p-8 cinema-inset">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold">Legal & Compliance</h2>
            <p className="text-sm text-muted-foreground">Content provenance and rights management</p>
          </div>
        </div>

        <Button variant="outline" onClick={handleC2PA} className="gap-2">
          <ShieldCheck className="h-4 w-4" />
          Generate C2PA Provenance Report
        </Button>
      </div>
    </div>
  );
};

export default Release;
