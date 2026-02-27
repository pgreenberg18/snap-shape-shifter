import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Check } from "lucide-react";
import { useSetVersionProvider } from "@/hooks/useVersionProviders";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const SECTION_LABELS: Record<string, string> = {
  "script-analysis": "Script Analysis (LLM)",
  "image-generation": "Image Generation",
  "sound-stage": "Voice & Audio",
  "camera-cart": "Video Generation",
  "post-house": "Post-Production",
};

type Conflict = {
  section: string;
  providers: Array<{ id: string; provider_name: string }>;
};

interface Props {
  filmId: string;
  projectId: string;
  conflicts: Conflict[];
  open: boolean;
  onResolved: () => void;
}

const ProviderConflictDialog = ({ filmId, projectId, conflicts, open, onResolved }: Props) => {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [applyToAll, setApplyToAll] = useState(false);
  const setProvider = useSetVersionProvider();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const allResolved = conflicts.every((c) => selections[c.section]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (applyToAll) {
        // Get all versions (films) in this project
        const { data: allFilms, error: filmsErr } = await supabase
          .from("films")
          .select("id")
          .eq("project_id", projectId);
        if (filmsErr) throw filmsErr;

        const filmIds = allFilms?.map((f) => f.id) ?? [filmId];

        // Upsert selections for every version
        const upserts = filmIds.flatMap((fid) =>
          conflicts.map((c) => ({
            film_id: fid,
            section_id: c.section,
            provider_service_id: selections[c.section],
          }))
        );

        const { error } = await supabase
          .from("version_provider_selections")
          .upsert(upserts, { onConflict: "film_id,section_id" });
        if (error) throw error;

        toast({ title: "Providers applied to all versions", description: "All current and future generations will use the selected providers." });
      } else {
        await Promise.all(
          conflicts.map((c) =>
            setProvider.mutateAsync({
              filmId,
              sectionId: c.section,
              providerServiceId: selections[c.section],
            })
          )
        );
        toast({ title: "Providers selected", description: "All conflicts resolved. You may proceed." });
      }
      onResolved();
    } catch {
      toast({ title: "Error", description: "Failed to save selections.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl p-4 gap-3" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="space-y-1 pb-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
            Choose Integrations for This Version
          </DialogTitle>
          <DialogDescription className="text-xs">
            Select which provider to use for each category.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {conflicts.map((c) => (
            <div key={c.section} className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{SECTION_LABELS[c.section] || c.section}</p>
              <div className="space-y-0.5">
                {c.providers.map((p) => {
                  const isSelected = selections[c.section] === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelections((prev) => ({ ...prev, [c.section]: p.id }))}
                      className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? "border-green-500/60 bg-green-500/10 shadow-[0_0_8px_hsl(142_71%_45%/0.3)]"
                          : "border-border bg-secondary hover:border-primary/50 hover:shadow-[0_0_12px_hsl(var(--primary)/0.25)]"
                      }`}
                    >
                      {isSelected ? (
                        <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      ) : (
                        <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40 shrink-0" />
                      )}
                      <span className="text-xs flex-1">{p.provider_name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-3 pt-1 sm:justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id="apply-all-versions"
              checked={applyToAll}
              onCheckedChange={(checked) => setApplyToAll(checked === true)}
            />
            <Label htmlFor="apply-all-versions" className="text-[11px] text-muted-foreground cursor-pointer">
              Apply to all versions
            </Label>
          </div>
          <Button size="sm" onClick={handleSave} disabled={!allResolved || saving}>
            {saving ? "Saving…" : applyToAll ? "Confirm & Apply to All" : "Confirm Selections"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProviderConflictDialog;
