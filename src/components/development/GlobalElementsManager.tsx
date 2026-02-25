import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  MapPin, Users, Shirt, Box, Paintbrush, Link2, Unlink, ChevronDown,
  ChevronRight, Check, Merge, Tag, X, Plus, AlertCircle, CheckCircle2, ThumbsUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

/* ── Types ────────────────────────────────────────────────── */

export interface ElementGroup {
  id: string;
  parentName: string;
  variants: string[];
}

export interface CategoryData {
  ungrouped: string[];
  groups: ElementGroup[];
}

type CategoryKey = "locations" | "characters" | "wardrobe" | "props" | "visual_design";

interface CategoryMeta {
  key: CategoryKey;
  label: string;
  icon: React.ReactNode;
}

const CATEGORIES: CategoryMeta[] = [
  { key: "characters", label: "Characters", icon: <Users className="h-4 w-4" /> },
  { key: "locations", label: "Locations", icon: <MapPin className="h-4 w-4" /> },
  { key: "wardrobe", label: "Wardrobe", icon: <Shirt className="h-4 w-4" /> },
  { key: "props", label: "Props", icon: <Box className="h-4 w-4" /> },
  { key: "visual_design", label: "Visual Design", icon: <Paintbrush className="h-4 w-4" /> },
];

/* ── Helpers ───────────────────────────────────────────────── */

function buildInitialData(raw: any): Record<CategoryKey, CategoryData> {
  const extract = (keys: string[]): string[] => {
    const items: string[] = [];
    for (const k of keys) {
      const val = raw?.[k];
      if (Array.isArray(val)) items.push(...val);
      else if (typeof val === "string" && val) items.push(val);
    }
    return [...new Set(items)];
  };

  const charNames = extract(["recurring_characters", "characters"]).map((c) => {
    // Strip descriptions: "JOHN - a middle-aged teacher" → "JOHN", "HOWARD WELLS (40s)" → "HOWARD WELLS"
    let name = c.replace(/\s*\(.*?\)\s*/g, "").replace(/\s*\([^)]*$/g, "").trim();
    const dashIdx = name.indexOf(" - ");
    const colonIdx = name.indexOf(": ");
    const commaIdx = name.indexOf(", ");
    const cutIdx = [dashIdx, colonIdx, commaIdx].filter((i) => i > 0).sort((a, b) => a - b)[0];
    return cutIdx ? name.substring(0, cutIdx).trim() : name.trim();
  });

  // Strip location descriptions and INT/EXT prefixes, time of day — keep only the slugline location name
  const locationNames = extract(["recurring_locations"]).map((loc) => {
    // Remove descriptors after " – " or " - "
    let name = loc.replace(/\s*[–—-]\s+.*$/, "").trim();
    // Strip INT./EXT./I/E. prefixes
    name = name.replace(/^(?:INT\.?\/EXT\.?|I\/E\.?|INT\.?|EXT\.?)\s*[-–—.\s]*/i, "").trim();
    // Strip time of day suffixes
    name = name.replace(/\s*[-–—]\s*(?:DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|AFTERNOON|LATER|CONTINUOUS|MOMENTS LATER)\s*$/i, "").trim();
    return name;
  }).filter(Boolean);

  // Auto-group wardrobe by character name
  const wardrobeItems = extract(["recurring_wardrobe"]);
  const wardrobeGroups: ElementGroup[] = [];
  const wardrobeUngrouped: string[] = [];
  const wardrobeByChar = new Map<string, string[]>();

  for (const item of wardrobeItems) {
    // Try to extract character name: "JOHN - blue suit", "JOHN: casual wear", "John's lab coat"
    const dashMatch = item.match(/^([A-Z][A-Za-z'\s]+?)\s*[-–—:]\s+(.+)$/);
    const possessiveMatch = item.match(/^([A-Z][A-Za-z'\s]+?)'s\s+(.+)$/i);
    const charName = dashMatch?.[1]?.trim() || possessiveMatch?.[1]?.trim().toUpperCase();
    if (charName && charName.length > 1) {
      const normalized = charName.toUpperCase();
      if (!wardrobeByChar.has(normalized)) wardrobeByChar.set(normalized, []);
      wardrobeByChar.get(normalized)!.push(item);
    } else {
      wardrobeUngrouped.push(item);
    }
  }
  for (const [charName, items] of wardrobeByChar) {
    if (items.length >= 1) {
      wardrobeGroups.push({ id: uid(), parentName: charName.charAt(0) + charName.slice(1).toLowerCase(), variants: items });
    } else {
      wardrobeUngrouped.push(...items);
    }
  }

  // Auto-group locations by shared root (e.g., "Hospital Room" + "Hospital Hallway" → "Hospital")
  const uniqueLocations = [...new Set(locationNames)];
  const locationGroups: ElementGroup[] = [];
  const locationUngrouped: string[] = [];
  const locationUsed = new Set<string>();

  // Extract root words and find clusters
  const getLocationRoot = (name: string): string[] => {
    // Split into significant words, ignoring common suffixes
    const COMMON_SUFFIXES = new Set(["room", "hallway", "corridor", "lobby", "entrance", "exit", "office", "floor", "wing", "ward", "lot", "area", "yard", "driveway", "porch", "balcony", "rooftop", "roof", "basement", "attic", "garage", "garden", "backyard", "front", "back", "side", "interior", "exterior", "upper", "lower", "main", "parking", "waiting", "living", "dining", "bed", "bath", "kitchen", "bedroom", "bathroom"]);
    return name.split(/[\s/]+/).map(w => w.toUpperCase()).filter(w => w.length > 2 && !COMMON_SUFFIXES.has(w.toLowerCase()));
  };

  // Group locations that share a significant root word
  for (let i = 0; i < uniqueLocations.length; i++) {
    if (locationUsed.has(uniqueLocations[i])) continue;
    const rootsI = getLocationRoot(uniqueLocations[i]);
    const cluster: string[] = [uniqueLocations[i]];

    for (let j = i + 1; j < uniqueLocations.length; j++) {
      if (locationUsed.has(uniqueLocations[j])) continue;
      const rootsJ = getLocationRoot(uniqueLocations[j]);
      // Check if they share a significant root word (at least 4 chars to avoid false matches)
      const shared = rootsI.find(r => r.length >= 4 && rootsJ.includes(r));
      if (shared) {
        cluster.push(uniqueLocations[j]);
        locationUsed.add(uniqueLocations[j]);
      }
    }

    if (cluster.length >= 2) {
      // Find the best parent name (shortest shared root word)
      const allRoots = cluster.flatMap(getLocationRoot);
      const rootCounts = new Map<string, number>();
      for (const r of allRoots) if (r.length >= 4) rootCounts.set(r, (rootCounts.get(r) || 0) + 1);
      const bestRoot = [...rootCounts.entries()]
        .filter(([, count]) => count >= cluster.length)
        .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0]?.[0];
      const parentName = bestRoot
        ? bestRoot.charAt(0) + bestRoot.slice(1).toLowerCase()
        : cluster[0];
      locationGroups.push({ id: uid(), parentName, variants: cluster });
      locationUsed.add(uniqueLocations[i]);
    } else {
      locationUngrouped.push(uniqueLocations[i]);
    }
  }

  return {
    locations: { ungrouped: locationUngrouped, groups: locationGroups },
    characters: { ungrouped: [...new Set(charNames)], groups: [] },
    wardrobe: { ungrouped: wardrobeUngrouped, groups: wardrobeGroups },
    props: { ungrouped: extract(["recurring_props"]), groups: [] },
    visual_design: { ungrouped: extract(["visual_motifs"]), groups: [] },
  };
}

let _uid = 0;
const uid = () => `grp_${++_uid}_${Date.now()}`;

/* ── Main Component ───────────────────────────────────────── */

interface Props {
  data: any;
  analysisId?: string;
  onAllReviewedChange?: (allReviewed: boolean) => void;
}

export default function GlobalElementsManager({ data, analysisId, onAllReviewedChange }: Props) {
  const managed = data?._managed;
  const [categories, setCategories] = useState<Record<CategoryKey, CategoryData>>(() =>
    managed?.categories || buildInitialData(data),
  );
  const [signatureStyle, setSignatureStyle] = useState<string>(data?.signature_style || "");
  const [expandedCategory, setExpandedCategory] = useState<CategoryKey | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<CategoryKey | null>(null);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeParentName, setMergeParentName] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [addingTo, setAddingTo] = useState<CategoryKey | null>(null);
  const [newItemText, setNewItemText] = useState("");
  const [reviewStatus, setReviewStatus] = useState<Record<CategoryKey, "unreviewed" | "needs_review" | "completed">>(
    managed?.reviewStatus || {
      characters: "unreviewed",
      locations: "unreviewed",
      wardrobe: "unreviewed",
      props: "unreviewed",
      visual_design: "unreviewed",
    },
  );
  const initialMount = useRef(true);

  // Notify parent when all sections are reviewed
  useEffect(() => {
    const allCompleted = CATEGORIES.every(({ key }) => {
      const cat = categories[key];
      const hasContent = cat.ungrouped.length > 0 || cat.groups.length > 0;
      return !hasContent || reviewStatus[key] === "completed";
    });
    onAllReviewedChange?.(allCompleted);
  }, [reviewStatus, categories, onAllReviewedChange]);

  // Persist managed state to DB
  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }
    if (!analysisId) return;
    const timeout = setTimeout(async () => {
      const updatedGlobal = { ...data, _managed: { categories, reviewStatus } };
      await supabase
        .from("script_analyses")
        .update({ global_elements: updatedGlobal as any })
        .eq("id", analysisId);
    }, 500);
    return () => clearTimeout(timeout);
  }, [categories, reviewStatus, analysisId]);

  /* selection */
  const toggleSelect = useCallback((item: string, category: CategoryKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item)) {
        next.delete(item);
      } else {
        if (activeCategory && activeCategory !== category) return prev;
        next.add(item);
      }
      if (next.size === 0) setActiveCategory(null);
      else setActiveCategory(category);
      return next;
    });
  }, [activeCategory]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setActiveCategory(null);
  }, []);

  /* merge flow */
  const openMerge = useCallback(() => {
    if (selected.size < 2 || !activeCategory) return;
    const items = Array.from(selected);
    setMergeParentName(items[0]);
    setMergeDialogOpen(true);
  }, [selected, activeCategory]);

  const confirmMerge = useCallback(() => {
    if (!activeCategory || !mergeParentName.trim()) return;
    const items = Array.from(selected);

    setCategories((prev) => {
      const cat = { ...prev[activeCategory] };
      const newGroup: ElementGroup = {
        id: uid(),
        parentName: mergeParentName.trim(),
        variants: items,
      };
      cat.ungrouped = cat.ungrouped.filter((u) => !selected.has(u));
      cat.groups = cat.groups.map((g) => ({
        ...g,
        variants: g.variants.filter((v) => !selected.has(v)),
      })).filter((g) => g.variants.length > 0);
      cat.groups = [...cat.groups, newGroup];
      return { ...prev, [activeCategory]: cat };
    });

    clearSelection();
    setMergeDialogOpen(false);
  }, [activeCategory, mergeParentName, selected, clearSelection]);

  /* unlink */
  const unlinkGroup = useCallback((category: CategoryKey, groupId: string) => {
    setCategories((prev) => {
      const cat = { ...prev[category] };
      const group = cat.groups.find((g) => g.id === groupId);
      if (!group) return prev;
      cat.ungrouped = [...cat.ungrouped, ...group.variants];
      cat.groups = cat.groups.filter((g) => g.id !== groupId);
      return { ...prev, [category]: cat };
    });
  }, []);

  /* delete item */
  const deleteItem = useCallback((category: CategoryKey, item: string) => {
    setCategories((prev) => {
      const cat = { ...prev[category] };
      cat.ungrouped = cat.ungrouped.filter((u) => u !== item);
      return { ...prev, [category]: cat };
    });
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(item);
      if (next.size === 0) setActiveCategory(null);
      return next;
    });
  }, []);

  /* add item */
  const addItem = useCallback((category: CategoryKey) => {
    if (!newItemText.trim()) return;
    setCategories((prev) => {
      const cat = { ...prev[category] };
      cat.ungrouped = [...cat.ungrouped, newItemText.trim()];
      return { ...prev, [category]: cat };
    });
    setNewItemText("");
    setAddingTo(null);
  }, [newItemText]);

  const toggleGroupExpand = useCallback((id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const hasItems = (cat: CategoryData) => cat.ungrouped.length > 0 || cat.groups.length > 0;

  return (
    <div className="space-y-3">
      {CATEGORIES.map(({ key, label, icon }) => {
        const cat = categories[key];
        const showSection = hasItems(cat) || key === expandedCategory;
        if (!showSection && !hasItems(cat)) return null;
        const isExpanded = expandedCategory === key;

        return (
          <div key={key} className="rounded-lg border border-border bg-card/50 overflow-hidden">
            {/* Section header */}
            <button
              onClick={() => setExpandedCategory(isExpanded ? null : key)}
              className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <span className="text-primary">{icon}</span>
              <span className="font-display text-sm font-semibold">{label}</span>
              <span className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {cat.groups.length > 0 && `${cat.groups.length} grouped · `}
                  {cat.ungrouped.length} item{cat.ungrouped.length !== 1 ? "s" : ""}
                </span>
                {hasItems(cat) && (
                  reviewStatus[key] === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : reviewStatus[key] === "needs_review" ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  )
                )}
              </span>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-3">
                {/* Merge action bar */}
                {selected.size >= 2 && activeCategory === key && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 border border-primary/20">
                    <Merge className="h-4 w-4 text-primary" />
                    <span className="text-xs text-primary font-medium">
                      {selected.size} items selected
                    </span>
                    <Button size="sm" variant="default" className="ml-auto gap-1.5 h-7 text-xs" onClick={openMerge}>
                      <Link2 className="h-3 w-3" />
                      Link Together
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={clearSelection}>
                      <X className="h-3 w-3" />
                      Cancel
                    </Button>
                  </div>
                )}

                {/* Grouped items */}
                {[...cat.groups].sort((a, b) => a.parentName.localeCompare(b.parentName)).map((group) => {
                  const isOpen = expandedGroups.has(group.id);
                  return (
                    <div key={group.id} className="rounded-md border border-primary/20 bg-primary/5 overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2">
                        <button onClick={() => toggleGroupExpand(group.id)} className="flex items-center gap-1.5 flex-1 text-left">
                          {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-primary" /> : <ChevronRight className="h-3.5 w-3.5 text-primary" />}
                          <Tag className="h-3.5 w-3.5 text-primary" />
                          <span className="text-sm font-semibold text-foreground">{group.parentName}</span>
                          <span className="text-xs text-muted-foreground ml-1">({group.variants.length} linked)</span>
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-muted-foreground hover:text-destructive gap-1"
                          onClick={() => unlinkGroup(key, group.id)}
                        >
                          <Unlink className="h-3 w-3" />
                          Unlink
                        </Button>
                      </div>
                      {isOpen && (
                        <div className="px-3 pb-2 flex flex-wrap gap-1.5 border-t border-primary/10 pt-2">
                          {[...group.variants].sort((a, b) => a.localeCompare(b)).map((v, i) => {
                            const isSelected = selected.has(v) && activeCategory === key;
                            const isDisabled = activeCategory !== null && activeCategory !== key;
                            return (
                              <span
                                key={i}
                                className={cn(
                                  "text-xs rounded-full px-2.5 py-0.5 border transition-all select-none inline-flex items-center gap-1 cursor-pointer",
                                  isSelected
                                    ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/30"
                                    : "bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:bg-accent",
                                  isDisabled && "opacity-40",
                                )}
                              >
                                <button
                                  disabled={isDisabled}
                                  onClick={() => toggleSelect(v, key)}
                                  className="cursor-pointer"
                                >
                                  {isSelected && <Check className="inline h-3 w-3 mr-0.5" />}
                                  {v}
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Ungrouped items – selectable & deletable chips */}
                {cat.ungrouped.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {[...cat.ungrouped].sort((a, b) => a.localeCompare(b)).map((item, i) => {
                      const isSelected = selected.has(item) && activeCategory === key;
                      const isDisabled = activeCategory !== null && activeCategory !== key;
                      return (
                        <span
                          key={i}
                          className={cn(
                            "text-xs rounded-full px-2.5 py-1 border transition-all select-none inline-flex items-center gap-1",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/30"
                              : "bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:bg-accent",
                            isDisabled && "opacity-40",
                          )}
                        >
                          <button
                            disabled={isDisabled}
                            onClick={() => toggleSelect(item, key)}
                            className="cursor-pointer"
                          >
                            {isSelected && <Check className="inline h-3 w-3 mr-0.5" />}
                            {item}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteItem(key, item); }}
                            className="ml-0.5 opacity-50 hover:opacity-100 hover:text-destructive transition-opacity"
                            title="Remove"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Add item */}
                {addingTo === key ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={newItemText}
                      onChange={(e) => setNewItemText(e.target.value)}
                      placeholder={`Add ${label.toLowerCase()} item...`}
                      className="h-8 text-xs bg-background flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addItem(key);
                        if (e.key === "Escape") { setAddingTo(null); setNewItemText(""); }
                      }}
                    />
                    <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => addItem(key)}>
                      Add
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAddingTo(null); setNewItemText(""); }}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground gap-1"
                    onClick={() => { setAddingTo(key); setNewItemText(""); }}
                  >
                    <Plus className="h-3 w-3" />
                    Add {label.toLowerCase()}
                  </Button>
                )}

                {cat.ungrouped.length > 1 && selected.size === 0 && addingTo !== key && (
                  <p className="text-xs text-muted-foreground italic">
                    Click items to select, then link similar ones together
                  </p>
                )}

                {/* Review status buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-border mt-3">
                  <span className="text-xs text-muted-foreground mr-auto">Review Status:</span>
                  <Button
                    size="sm"
                    variant={reviewStatus[key] === "needs_review" ? "default" : "outline"}
                    className={cn("h-7 text-xs gap-1.5", reviewStatus[key] === "needs_review" ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : "opacity-60")}
                    onClick={() => setReviewStatus(prev => ({ ...prev, [key]: prev[key] === "needs_review" ? "unreviewed" : "needs_review" }))}
                  >
                    <AlertCircle className="h-3 w-3" />
                    Still Needs Review
                  </Button>
                  <Button
                    size="sm"
                    variant={reviewStatus[key] === "completed" ? "default" : "outline"}
                    className={cn("h-7 text-xs gap-1.5", reviewStatus[key] === "completed" ? "bg-green-600 hover:bg-green-700 text-white" : "opacity-60")}
                    onClick={() => setReviewStatus(prev => ({ ...prev, [key]: prev[key] === "completed" ? "unreviewed" : "completed" }))}
                  >
                    <ThumbsUp className="h-3 w-3" />
                    Approved
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}


      {/* Merge dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Link Elements Together</DialogTitle>
            <DialogDescription>
              These items will be grouped under a single parent name. You can unlink them later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Parent Name</label>
              <Input
                value={mergeParentName}
                onChange={(e) => setMergeParentName(e.target.value)}
                placeholder="e.g. Wells Home"
                className="bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Items being linked</label>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(selected).map((item) => (
                  <span key={item} className="text-xs bg-secondary text-muted-foreground rounded-full px-2.5 py-0.5 border border-border">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setMergeDialogOpen(false); clearSelection(); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={confirmMerge} disabled={!mergeParentName.trim()} className="gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                Link Together
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
