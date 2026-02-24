import { useFilmId, useIntegrations } from "@/hooks/useFilm";
import { useVersionProviderSelections, useSetVersionProvider } from "@/hooks/useVersionProviders";
import { Settings, Check, AlertTriangle } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const LEGACY_MAP: Record<string, string> = { "writers-room": "script-analysis" };

const SECTION_LABELS: Record<string, string> = {
  "script-analysis": "Script Analysis (LLM)",
  "image-generation": "Image Generation",
  "sound-stage": "Voice & Audio",
  "camera-cart": "Video Generation",
  "post-house": "Post-Production",
};

const SECTION_ORDER = ["script-analysis", "image-generation", "sound-stage", "camera-cart", "post-house"];

const VersionSettings = () => {
  const filmId = useFilmId();
  const { data: integrations, isLoading: intLoading } = useIntegrations();
  const { data: selections, isLoading: selLoading } = useVersionProviderSelections();
  const setProvider = useSetVersionProvider();
  const { toast } = useToast();

  if (intLoading || selLoading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Loading…</div>;
  }

  // Group verified global integrations by section
  const bySection: Record<string, Array<{ id: string; provider_name: string; section_id: string }>> = {};
  for (const int of integrations || []) {
    if (!int.is_verified) continue;
    const section = LEGACY_MAP[int.section_id] || int.section_id;
    (bySection[section] ??= []).push({ ...int, section_id: section });
  }

  // Map current selections
  const selectionMap: Record<string, string> = {};
  for (const s of selections || []) {
    selectionMap[s.section_id] = s.provider_service_id;
  }

  const handleSelect = (sectionId: string, providerServiceId: string) => {
    if (!filmId) return;
    setProvider.mutate(
      { filmId, sectionId, providerServiceId },
      { onSuccess: () => toast({ title: "Provider selected", description: `Provider set for this version.` }) }
    );
  };

  const hasAnyProviders = Object.keys(bySection).length > 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl font-bold">Version Providers</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Select which AI provider to use for each category in this version. Providers are configured in the global app settings.
        </p>
      </div>

      {!hasAnyProviders ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-2">
          <AlertTriangle className="h-8 w-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">
            No verified providers found. Add and verify API keys in the global Settings on the home page first.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {SECTION_ORDER.map((sectionId) => {
            const providers = bySection[sectionId];
            if (!providers || providers.length === 0) return null;

            const currentSelection = selectionMap[sectionId];
            const needsSelection = providers.length > 1 && !currentSelection;

            return (
              <div
                key={sectionId}
                className={`rounded-xl border bg-card p-5 space-y-3 ${
                  needsSelection ? "border-yellow-500/40 bg-yellow-500/5" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-display font-semibold">
                    {SECTION_LABELS[sectionId] || sectionId}
                  </h3>
                  {needsSelection && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-yellow-500 font-medium">
                      <AlertTriangle className="h-3 w-3" /> Selection required
                    </span>
                  )}
                  {providers.length === 1 && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-green-500">
                      <Check className="h-3 w-3" /> Auto-selected
                    </span>
                  )}
                </div>

                {providers.length === 1 ? (
                  <p className="text-xs text-muted-foreground">
                    Using <strong>{providers[0].provider_name}</strong>
                  </p>
                ) : (
                  <RadioGroup
                    value={currentSelection || ""}
                    onValueChange={(val) => handleSelect(sectionId, val)}
                    className="space-y-2"
                  >
                    {providers.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-secondary p-3">
                        <RadioGroupItem value={p.id} id={`prov-${p.id}`} />
                        <Label htmlFor={`prov-${p.id}`} className="text-sm cursor-pointer flex-1">
                          {p.provider_name}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VersionSettings;
