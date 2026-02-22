import { useEffect, useState, useRef, useCallback } from "react";
import { Upload, Type, CheckCircle, FileText, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";
import { useContentSafety, FILM_ID } from "@/hooks/useFilm";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ACCEPTED_TYPES = [".fdx", ".fountain", ".pdf"];

const Development = () => {
  const { data: safety } = useContentSafety();
  const [language, setLanguage] = useState(false);
  const [nudity, setNudity] = useState(false);
  const [violence, setViolence] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadFile = useCallback(async (file: File) => {
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPTED_TYPES.includes(ext)) {
      toast({ title: "Unsupported format", description: "Please upload .fdx, .fountain, or .pdf files.", variant: "destructive" });
      return;
    }
    setUploading(true);
    const path = `${FILM_ID}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("scripts").upload(path, file);
    setUploading(false);
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } else {
      setUploadedFile(file.name);
      toast({ title: "Script uploaded", description: file.name });
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  useEffect(() => {
    if (safety) {
      setLanguage(safety.language);
      setNudity(safety.nudity);
      setViolence(safety.violence);
    }
  }, [safety]);

  const updateSafety = async (field: string, value: boolean) => {
    if (!safety) return;
    await supabase.from("content_safety").update({ [field]: value }).eq("id", safety.id);
  };

  const handleToggle = (field: string, setter: (v: boolean) => void) => (val: boolean) => {
    setter(val);
    updateSafety(field, val);
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
      {/* Script Upload Dropzone */}
      <div>
        <h2 className="font-display text-2xl font-bold mb-4">Script Upload</h2>
        <input
          ref={fileInputRef}
          type="file"
          accept=".fdx,.fountain,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-16 transition-colors cursor-pointer backdrop-blur-md bg-[hsl(222_12%_16%_/_0.5)] ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
        >
          {uploadedFile ? (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-lg font-display font-semibold text-foreground flex items-center gap-2 justify-center">
                  <FileText className="h-5 w-5" /> {uploadedFile}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Click or drop to replace</p>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                <Type className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-lg font-display font-semibold text-foreground">
                  {uploading ? "Uploading…" : "Drop your screenplay here"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">.fdx, .fountain, .pdf — or click to browse</p>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-xs text-muted-foreground">
                <Upload className="h-3.5 w-3.5" />
                Upload Script
              </div>
            </>
          )}
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
                  <button key={t} className="rounded-lg border border-border bg-secondary p-4 text-sm font-medium text-foreground hover:border-primary/50 transition-colors text-center">
                    {t}
                  </button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="custom">
              <div className="space-y-5">
                <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
                  <Label htmlFor="language" className="text-sm font-medium cursor-pointer">Language</Label>
                  <Switch id="language" checked={language} onCheckedChange={handleToggle("language", setLanguage)} />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
                  <Label htmlFor="nudity" className="text-sm font-medium cursor-pointer">Nudity</Label>
                  <Switch id="nudity" checked={nudity} onCheckedChange={handleToggle("nudity", setNudity)} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
                    <Label htmlFor="violence" className="text-sm font-medium cursor-pointer">Violence</Label>
                    <Switch id="violence" checked={violence} onCheckedChange={handleToggle("violence", setViolence)} />
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
