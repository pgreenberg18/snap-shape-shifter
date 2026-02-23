import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Users, ChevronRight, Lock } from "lucide-react";

interface Character {
  id: string;
  name: string;
  image_url: string | null;
  voice_description: string | null;
  voice_generation_seed: number | null;
}

interface CharacterSidebarProps {
  characters: Character[] | undefined;
  isLoading: boolean;
  selectedCharId: string | null;
  onSelect: (id: string) => void;
  showVoiceSeed?: boolean;
}

const CharacterSidebar = ({ characters, isLoading, selectedCharId, onSelect, showVoiceSeed }: CharacterSidebarProps) => (
  <aside className="w-[280px] min-w-[240px] border-r border-border bg-card flex flex-col">
    <div className="px-4 py-3 border-b border-border">
      <h2 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Characters
      </h2>
      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
        {characters?.length ?? 0} in cast
      </p>
    </div>
    <ScrollArea className="flex-1">
      {isLoading ? (
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-secondary animate-pulse" />
          ))}
        </div>
      ) : !characters?.length ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="font-display font-semibold">No characters yet</p>
          <p className="text-xs mt-1">Analyze a script in Development to populate the cast.</p>
        </div>
      ) : (
        <div className="py-1">
          {characters.map((char) => {
            const isActive = selectedCharId === char.id;
            const isLocked = showVoiceSeed ? !!char.voice_generation_seed : !!char.image_url;
            return (
              <button
                key={char.id}
                onClick={() => onSelect(char.id)}
                className={cn(
                  "w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-l-2",
                  isActive
                    ? "border-l-primary bg-primary/5"
                    : "border-l-transparent hover:bg-secondary/60"
                )}
              >
                <div
                  className={cn(
                    "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold font-display uppercase overflow-hidden",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  {char.image_url ? (
                    <img src={char.image_url} alt={char.name} className="h-full w-full object-cover" />
                  ) : (
                    char.name.charAt(0)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p
                      className={cn(
                        "text-sm font-display font-semibold truncate",
                        isActive ? "text-primary" : "text-foreground"
                      )}
                    >
                      {char.name}
                    </p>
                    {isLocked && (
                      <span className="shrink-0 flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                        <Lock className="h-2.5 w-2.5" />
                        Locked
                      </span>
                    )}
                  </div>
                  {char.voice_description && (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {char.voice_description}
                    </p>
                  )}
                </div>
                {isActive && (
                  <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </ScrollArea>
  </aside>
);

export default CharacterSidebar;
