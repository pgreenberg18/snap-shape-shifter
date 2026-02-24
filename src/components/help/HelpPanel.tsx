import { useState, createContext, useContext, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { HelpCircle, Search, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/* ── Help content database ── */
interface HelpArticle {
  id: string;
  title: string;
  context: string[]; // route keywords that make this article relevant
  content: string;
  category: string;
}

const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    context: ["projects", "home"],
    category: "General",
    content:
      "Welcome to Virtual Film Studio! Start by creating a new project. Each project can have multiple versions so you can iterate on your film. Click 'New Project' to begin.",
  },
  {
    id: "upload-script",
    title: "Uploading a Screenplay",
    context: ["development"],
    category: "Development",
    content:
      "In the Development phase, fill in your film details (title, version, writers) then upload your screenplay file (.fdx or .txt). After uploading, click the 'Analyze' button to extract scenes, characters, locations, and wardrobe from the script.",
  },
  {
    id: "script-analysis",
    title: "Script Analysis & Breakdown",
    context: ["development"],
    category: "Development",
    content:
      "Once analysis is complete you'll see a full scene breakdown with visual summaries, content ratings, and AI generation notes. Review and approve each section before locking the script. Locking prevents further changes and unlocks downstream phases.",
  },
  {
    id: "pre-production",
    title: "Pre-Production Phase",
    context: ["pre-production"],
    category: "Pre-Production",
    content:
      "Pre-Production is where you cast characters (audition headshots), design locations, choose props and wardrobe, and build storyboards. Use the sidebar panels to manage each asset category. Lock your choices before moving to Production.",
  },
  {
    id: "characters",
    title: "Character Casting & Auditions",
    context: ["pre-production"],
    category: "Pre-Production",
    content:
      "Generate AI headshot options for each character. Rate and rank them, then lock your final casting choice. The locked headshot becomes the character's identity reference used throughout all downstream generation.",
  },
  {
    id: "production",
    title: "Production Phase",
    context: ["production"],
    category: "Production",
    content:
      "Production is your virtual soundstage. Configure camera settings, lighting, and lens options in the Optics Suite. Generate shots scene-by-scene using AI. Review each shot in the viewport before approving.",
  },
  {
    id: "post-production",
    title: "Post-Production Phase",
    context: ["post-production"],
    category: "Post-Production",
    content:
      "Arrange your approved shots on the timeline. Add VFX fixes, color grading notes, and audio layers. The timeline supports drag-and-drop clip arrangement across multiple tracks.",
  },
  {
    id: "release",
    title: "Release Phase",
    context: ["release"],
    category: "Release",
    content:
      "Prepare your film for distribution. Review the final cut, add credits and metadata, then export or publish your completed project.",
  },
  {
    id: "versions",
    title: "Managing Versions",
    context: ["projects", "versions"],
    category: "General",
    content:
      "Each project can have multiple versions. Duplicate a version to branch your work — all characters, shots, and analysis data are copied. You can rename or delete versions from the version cards. Version names must be unique within a project.",
  },
  {
    id: "settings",
    title: "Settings & Integrations",
    context: ["settings"],
    category: "Settings",
    content:
      "Configure API integrations for AI services used in script analysis, image generation, video generation, and audio. Each integration section shows which services are available and lets you add API keys.",
  },
  {
    id: "content-safety",
    title: "Content Safety Controls",
    context: ["development"],
    category: "Development",
    content:
      "Content safety flags (violence, nudity, language) are set per-version. These flags inform AI generation to stay within your desired content boundaries. Run the content safety analysis after script breakdown to get AI-recommended ratings.",
  },
  {
    id: "global-elements",
    title: "Global Elements",
    context: ["development"],
    category: "Development",
    content:
      "Global elements are cross-cutting story attributes extracted by AI: time period, visual motifs, recurring themes, and tone. Review these to ensure AI generation stays consistent across all scenes.",
  },
];

/* ── Context for route-awareness ── */
interface HelpContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const HelpContext = createContext<HelpContextType>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
});

export const useHelp = () => useContext(HelpContext);

export const HelpProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <HelpContext.Provider
      value={{
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen((p) => !p),
      }}
    >
      {children}
    </HelpContext.Provider>
  );
};

/* ── Help Panel Component ── */
const HelpPanel = () => {
  const { isOpen, close } = useHelp();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);

  // Determine current context from route
  const routeKeywords = location.pathname
    .split("/")
    .filter(Boolean)
    .map((s) => s.toLowerCase());

  // Filter and sort articles: context-relevant first, then search
  const filtered = HELP_ARTICLES.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      a.content.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    const aRelevant = a.context.some((c) => routeKeywords.includes(c));
    const bRelevant = b.context.some((c) => routeKeywords.includes(c));
    if (aRelevant && !bRelevant) return -1;
    if (!aRelevant && bRelevant) return 1;
    return 0;
  });

  const contextArticles = filtered.filter((a) =>
    a.context.some((c) => routeKeywords.includes(c))
  );
  const otherArticles = filtered.filter(
    (a) => !a.context.some((c) => routeKeywords.includes(c))
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-background/60 backdrop-blur-sm" onClick={close} />

      {/* Panel */}
      <div className="relative ml-auto flex h-full w-[420px] max-w-[90vw] flex-col border-l border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold">Help Center</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={close}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="border-b border-border px-6 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedArticle(null);
              }}
              placeholder="Search help topics…"
              className="pl-9 bg-background"
            />
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            {selectedArticle ? (
              <div className="space-y-4">
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  ← Back to topics
                </button>
                <div>
                  <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    {selectedArticle.category}
                  </span>
                  <h3 className="font-display text-lg font-bold mt-2">
                    {selectedArticle.title}
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {selectedArticle.content}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {contextArticles.length > 0 && (
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-3">
                      Relevant to this page
                    </h3>
                    <div className="space-y-1">
                      {contextArticles.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => setSelectedArticle(a)}
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent"
                        >
                          <div>
                            <p className="text-sm font-medium text-foreground">{a.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {a.content.slice(0, 80)}…
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {otherArticles.length > 0 && (
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      {contextArticles.length > 0 ? "Other topics" : "All topics"}
                    </h3>
                    <div className="space-y-1">
                      {otherArticles.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => setSelectedArticle(a)}
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent"
                        >
                          <div>
                            <p className="text-sm font-medium text-foreground">{a.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {a.content.slice(0, 80)}…
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {filtered.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    No articles match your search.
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default HelpPanel;
