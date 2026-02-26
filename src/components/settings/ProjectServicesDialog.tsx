import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  ScrollText, Image, AudioLines, Camera, Clapperboard, Check, Minus, Plug, ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const SECTION_ORDER = [
  "script-analysis",
  "image-generation",
  "sound-stage",
  "camera-cart",
  "post-house",
] as const;

const SECTION_META: Record<string, { title: string; icon: React.ReactNode }> = {
  "script-analysis": { title: "Script Analysis (LLM)", icon: <ScrollText className="h-4 w-4" /> },
  "image-generation": { title: "Image Generation", icon: <Image className="h-4 w-4" /> },
  "sound-stage": { title: "Voice & Audio", icon: <AudioLines className="h-4 w-4" /> },
  "camera-cart": { title: "Video Generation", icon: <Camera className="h-4 w-4" /> },
  "post-house": { title: "Post-Production", icon: <Clapperboard className="h-4 w-4" /> },
};

const LEGACY_MAP: Record<string, string> = { "writers-room": "script-analysis" };

interface Props {
  projectId: string;
  versions: Array<{ id: string; version_name: string | null; version_number: number; is_archived: boolean }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ProjectServicesDialog = ({ projectId, versions, open, onOpenChange }: Props) => {
  const navigate = useNavigate();
  // Global integrations (verified ones)
  const { data: integrations } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("integrations").select("*").order("section_id");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // All version_provider_selections for this project's versions
  const filmIds = versions.map((v) => v.id);
  const { data: selections } = useQuery({
    queryKey: ["project-provider-selections", projectId],
    queryFn: async () => {
      if (!filmIds.length) return [];
      const { data, error } = await supabase
        .from("version_provider_selections")
        .select("*")
        .in("film_id", filmIds);
      if (error) throw error;
      return data;
    },
    enabled: open && filmIds.length > 0,
  });

  // Group integrations by section
  const bySection: Record<string, Array<{ id: string; provider_name: string; is_verified: boolean }>> = {};
  for (const int of integrations || []) {
    const section = LEGACY_MAP[int.section_id] || int.section_id;
    (bySection[section] ??= []).push(int);
  }

  // Map selections: filmId → sectionId → providerServiceId
  const selectionMap: Record<string, Record<string, string>> = {};
  for (const s of selections || []) {
    (selectionMap[s.film_id] ??= {})[s.section_id] = s.provider_service_id;
  }

  // Build lookup: provider id → name
  const providerNames: Record<string, string> = {};
  for (const int of integrations || []) {
    providerNames[int.id] = int.provider_name;
  }

  const activeVersions = versions.filter((v) => !v.is_archived);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5 text-primary" />
            Project Services Overview
          </DialogTitle>
          <DialogDescription>
            Global API services configured in the app, and which provider each version in this project is using.
          </DialogDescription>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-fit gap-1.5"
            onClick={() => {
              onOpenChange(false);
              navigate("/settings");
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Manage Providers
          </Button>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {SECTION_ORDER.map((sectionId) => {
            const meta = SECTION_META[sectionId];
            const providers = bySection[sectionId] || [];
            if (!meta) return null;

            return (
              <div key={sectionId} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  {meta.icon}
                  <h3 className="text-sm font-display font-semibold">{meta.title}</h3>
                </div>

                {/* Global providers list */}
                {providers.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No providers configured</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {providers.map((p) => (
                      <span
                        key={p.id}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${
                          p.is_verified
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border bg-secondary text-muted-foreground"
                        }`}
                      >
                        {p.is_verified ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {p.provider_name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Per-version assignments */}
                {providers.length > 0 && activeVersions.length > 0 && (
                  <div className="mt-2 rounded-lg bg-secondary/50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Version Assignments
                    </p>
                    <div className="space-y-1.5">
                      {activeVersions.map((v) => {
                        const selectedId = selectionMap[v.id]?.[sectionId];
                        const selectedName = selectedId ? providerNames[selectedId] : null;
                        const verifiedProviders = providers.filter((p) => p.is_verified);
                        const autoSelected = verifiedProviders.length === 1 ? verifiedProviders[0].provider_name : null;

                        return (
                          <div key={v.id} className="flex items-center justify-between text-xs">
                            <span className="text-foreground font-medium truncate max-w-[200px]">
                              {v.version_name || `Version ${v.version_number}`}
                            </span>
                            {selectedName ? (
                              <span className="text-primary flex items-center gap-1">
                                <Check className="h-3 w-3" /> {selectedName}
                              </span>
                            ) : autoSelected ? (
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Check className="h-3 w-3" /> {autoSelected} (auto)
                              </span>
                            ) : verifiedProviders.length > 1 ? (
                              <span className="text-yellow-500 text-[11px]">⚠ Not selected</span>
                            ) : (
                              <span className="text-muted-foreground/60">—</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectServicesDialog;
