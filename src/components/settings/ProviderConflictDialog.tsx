import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";
import { useSetVersionProvider } from "@/hooks/useVersionProviders";
import { useToast } from "@/hooks/use-toast";

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
  conflicts: Conflict[];
  open: boolean;
  onResolved: () => void;
}

const ProviderConflictDialog = ({ filmId, conflicts, open, onResolved }: Props) => {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const setProvider = useSetVersionProvider();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const allResolved = conflicts.every((c) => selections[c.section]);

  const handleSave = async () => {
    setSaving(true);
    try {
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
      onResolved();
    } catch {
      toast({ title: "Error", description: "Failed to save selections.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Choose Providers for This Version
          </DialogTitle>
          <DialogDescription>
            Multiple providers are configured for the categories below. Please select which one to use in this version before proceeding.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {conflicts.map((c) => (
            <div key={c.section} className="space-y-2">
              <p className="text-sm font-semibold">{SECTION_LABELS[c.section] || c.section}</p>
              <RadioGroup
                value={selections[c.section] || ""}
                onValueChange={(val) => setSelections((prev) => ({ ...prev, [c.section]: val }))}
                className="space-y-1.5"
              >
                {c.providers.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-secondary p-3">
                    <RadioGroupItem value={p.id} id={`conflict-${p.id}`} />
                    <Label htmlFor={`conflict-${p.id}`} className="text-sm cursor-pointer flex-1">
                      {p.provider_name}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={!allResolved || saving} className="w-full">
            {saving ? "Saving…" : "Confirm Selections"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProviderConflictDialog;
