import { useState } from "react";
import { Upload, Type } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

const Development = () => {
  const [language, setLanguage] = useState(false);
  const [nudity, setNudity] = useState(false);
  const [violence, setViolence] = useState(false);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
      {/* Script Upload Dropzone */}
      <div>
        <h2 className="font-display text-2xl font-bold mb-4">Script Upload</h2>
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-border bg-[hsl(222_12%_16%_/_0.5)] backdrop-blur-md p-16 transition-colors hover:border-primary/50 cursor-pointer">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
            <Type className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-lg font-display font-semibold text-foreground">
              Drop your screenplay here
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              .fdx, .fountain, .pdf — or click to browse
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-xs text-muted-foreground">
            <Upload className="h-3.5 w-3.5" />
            Upload Script
          </div>
        </div>
      </div>

      {/* Content Safety Matrix */}
      <div>
        <h2 className="font-display text-2xl font-bold mb-4">Content Safety Matrix</h2>
        <div className="rounded-xl border border-border bg-card p-6 cinema-inset">
          <Tabs defaultValue="auto" className="w-full">
            <TabsList className="w-full bg-secondary mb-6">
              <TabsTrigger value="auto" className="flex-1">Auto</TabsTrigger>
              <TabsTrigger value="templates" className="flex-1">Templates</TabsTrigger>
              <TabsTrigger value="custom" className="flex-1">Custom</TabsTrigger>
            </TabsList>

            <TabsContent value="auto">
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <span className="text-2xl">🤖</span>
                </div>
                <p className="font-display font-semibold text-lg">AI Auto-Detection</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Content safety ratings will be automatically classified by AI based on your uploaded script.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="templates">
              <div className="grid grid-cols-3 gap-3">
                {["PG — Family Friendly", "PG-13 — Teen Audiences", "R — Mature Content"].map((t) => (
                  <button
                    key={t}
                    className="rounded-lg border border-border bg-secondary p-4 text-sm font-medium text-foreground hover:border-primary/50 transition-colors text-center"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="custom">
              <div className="space-y-5">
                <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
                  <Label htmlFor="language" className="text-sm font-medium cursor-pointer">
                    Language
                  </Label>
                  <Switch id="language" checked={language} onCheckedChange={setLanguage} />
                </div>

                <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
                  <Label htmlFor="nudity" className="text-sm font-medium cursor-pointer">
                    Nudity
                  </Label>
                  <Switch id="nudity" checked={nudity} onCheckedChange={setNudity} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
                    <Label htmlFor="violence" className="text-sm font-medium cursor-pointer">
                      Violence
                    </Label>
                    <Switch id="violence" checked={violence} onCheckedChange={setViolence} />
                  </div>
                  {violence && (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-amber-400 text-sm animate-fade-in">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>Violence flag enabled — content may be restricted on some platforms.</span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Development;
