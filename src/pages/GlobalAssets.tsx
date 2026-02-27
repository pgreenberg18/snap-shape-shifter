import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFilmId, useShots } from "@/hooks/useFilm";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, User, MapPin, Package, RefreshCw, AlertTriangle, Pencil, Trash2 } from "lucide-react";

const ASSET_ICONS = {
  actor: User,
  prop: Package,
  location: MapPin,
} as const;

const ASSET_LABELS = {
  actor: "Actor",
  prop: "Prop",
  location: "Location",
} as const;

type AssetType = "actor" | "prop" | "location";

const useAssetRegistry = (filmId: string | undefined) =>
  useQuery({
    queryKey: ["asset-registry", filmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_identity_registry")
        .select("*")
        .eq("film_id", filmId!)
        .order("asset_type")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

const GlobalAssets = () => {
  const filmId = useFilmId();
  const { data: assets, isLoading } = useAssetRegistry(filmId);
  const { data: shots } = useShots();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const dirtyCount = assets?.filter((a) => a.is_dirty).length ?? 0;
  const totalLinkedShots = shots?.length ?? 0;

  const markCleanMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("asset_identity_registry")
        .update({ is_dirty: false })
        .eq("film_id", filmId!)
        .eq("is_dirty", true);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-registry"] });
      toast({ title: "Regeneration queued", description: "All dirty assets marked for re-rendering." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("asset_identity_registry")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-registry"] });
      toast({ title: "Asset removed" });
    },
  });

  const groupedAssets = {
    actor: assets?.filter((a) => a.asset_type === "actor") ?? [],
    prop: assets?.filter((a) => a.asset_type === "prop") ?? [],
    location: assets?.filter((a) => a.asset_type === "location") ?? [],
  };

  return (
    <ScrollArea className="h-full">
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">Global Assets</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Manage swappable identities. Change an actor, prop, or location and regenerate the entire film.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Add Asset
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Global Asset</DialogTitle>
            </DialogHeader>
            <AddAssetForm filmId={filmId!} onSuccess={() => { setAddOpen(false); queryClient.invalidateQueries({ queryKey: ["asset-registry"] }); }} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Ripple Update Banner */}
      {dirtyCount > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="font-display font-semibold text-sm text-foreground">
                {dirtyCount} asset{dirtyCount > 1 ? "s" : ""} changed. {totalLinkedShots} shots are now out of sync.
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click "Regenerate Style" to reskin the film with updated assets.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            onClick={() => markCleanMutation.mutate()}
            disabled={markCleanMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 ${markCleanMutation.isPending ? "animate-spin" : ""}`} />
            Regenerate Style
          </Button>
        </div>
      )}

      {/* Asset Groups */}
      {(["actor", "prop", "location"] as AssetType[]).map((type) => {
        const items = groupedAssets[type];
        const Icon = ASSET_ICONS[type];
        return (
          <div key={type} className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              <h3 className="font-display text-xs font-bold uppercase tracking-widest">{ASSET_LABELS[type]}s</h3>
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                {items.length}
              </span>
            </div>

            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No {type}s registered yet. Add one to enable swappable identities.
              </div>
            ) : (
              <div className="grid gap-3">
                {items.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    onEdit={() => setEditingId(asset.id)}
                    onDelete={() => deleteMutation.mutate(asset.id)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Edit Dialog */}
      {editingId && (
        <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Asset</DialogTitle>
            </DialogHeader>
            <EditAssetForm
              assetId={editingId}
              onSuccess={() => {
                setEditingId(null);
                queryClient.invalidateQueries({ queryKey: ["asset-registry"] });
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </div>
    </ScrollArea>
  );
};

/* ── Asset Card ── */
const AssetCard = ({
  asset,
  onEdit,
  onDelete,
}: {
  asset: any;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const Icon = ASSET_ICONS[asset.asset_type as AssetType] ?? Package;

  return (
    <div
      className={`rounded-xl border bg-card p-4 flex items-center justify-between transition-colors ${
        asset.is_dirty ? "border-amber-500/40 bg-amber-500/5" : "border-border"
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-display font-semibold text-[11px]">{asset.display_name}</p>
            <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
              {`{{${asset.internal_ref_code}}}`}
            </span>
            {asset.is_dirty && (
              <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                DIRTY
              </span>
            )}
          </div>
          {asset.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{asset.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

/* ── Add Asset Form ── */
const AddAssetForm = ({ onSuccess, filmId }: { onSuccess: () => void; filmId: string }) => {
  const [type, setType] = useState<AssetType>("actor");
  const [name, setName] = useState("");
  const [refCode, setRefCode] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !refCode) return;
    setLoading(true);
    const { error } = await supabase
      .from("asset_identity_registry")
      .insert({
        film_id: filmId!,
        asset_type: type,
        display_name: name,
        internal_ref_code: refCode.toUpperCase().replace(/\s+/g, "_"),
        description: description || null,
      });
    setLoading(false);
    if (error) {
      toast({ title: "Failed to add asset", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Asset added", description: `${name} registered as {{${refCode.toUpperCase().replace(/\s+/g, "_")}}}` });
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as AssetType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="actor">Actor</SelectItem>
            <SelectItem value="prop">Prop</SelectItem>
            <SelectItem value="location">Location</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Display Name</Label>
        <Input placeholder="e.g. John Smith" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>Reference Code (used in prompts)</Label>
        <Input
          placeholder="e.g. HERO_ACTOR_1"
          value={refCode}
          onChange={(e) => setRefCode(e.target.value)}
          className="font-mono"
          required
        />
        <p className="text-xs text-muted-foreground">
          This becomes {`{{${refCode.toUpperCase().replace(/\s+/g, "_") || "REF_CODE"}}}`} in all prompts
        </p>
      </div>
      <div className="space-y-2">
        <Label>Description (optional)</Label>
        <Input placeholder="Visual description for AI reference" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Adding…" : "Add Asset"}
      </Button>
    </form>
  );
};

/* ── Edit Asset Form (marks as dirty on change) ── */
const EditAssetForm = ({ assetId, onSuccess }: { assetId: string; onSuccess: () => void }) => {
  const { data: asset } = useQuery({
    queryKey: ["asset", assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_identity_registry")
        .select("*")
        .eq("id", assetId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  if (asset && !initialized) {
    setName(asset.display_name);
    setDescription(asset.description || "");
    setImageUrl(asset.reference_image_url || "");
    setInitialized(true);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const changed =
      name !== asset?.display_name ||
      description !== (asset?.description || "") ||
      imageUrl !== (asset?.reference_image_url || "");

    const { error } = await supabase
      .from("asset_identity_registry")
      .update({
        display_name: name,
        description: description || null,
        reference_image_url: imageUrl || null,
        is_dirty: changed ? true : asset?.is_dirty,
      })
      .eq("id", assetId);

    setLoading(false);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      if (changed) {
        toast({
          title: "Asset updated — Ripple triggered",
          description: "Linked shots are now out of sync. Use 'Regenerate Style' to update.",
        });
      }
      onSuccess();
    }
  };

  if (!asset) return <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg bg-secondary p-3 text-center">
        <span className="font-mono text-sm text-primary">{`{{${asset.internal_ref_code}}}`}</span>
        <p className="text-xs text-muted-foreground mt-0.5">{ASSET_LABELS[asset.asset_type as AssetType]}</p>
      </div>
      <div className="space-y-2">
        <Label>Display Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>Reference Image URL</Label>
        <Input placeholder="https://..." value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Input placeholder="Visual description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Saving…" : "Save & Flag as Changed"}
      </Button>
    </form>
  );
};

export default GlobalAssets;
