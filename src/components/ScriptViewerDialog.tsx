import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollText, Loader2 } from "lucide-react";

/* ── Types ── */
export interface ScriptParagraph {
  type: string;
  text: string;
}

export interface ScriptScene {
  sceneNum: number;
  heading: string;
  paragraphs: ScriptParagraph[];
}

interface ScriptViewerState {
  open: boolean;
  title: string;
  description?: string;
  scenes: ScriptScene[];
  loading: boolean;
  highlightTerms: string[];
}

interface ScriptViewerContextType {
  openScriptViewer: (opts: {
    title: string;
    description?: string;
    scenes?: ScriptScene[];
    highlightTerms?: string[];
  }) => void;
  setScriptViewerScenes: (scenes: ScriptScene[]) => void;
  setScriptViewerLoading: (loading: boolean) => void;
  closeScriptViewer: () => void;
}

const ScriptViewerContext = createContext<ScriptViewerContextType>({
  openScriptViewer: () => {},
  setScriptViewerScenes: () => {},
  setScriptViewerLoading: () => {},
  closeScriptViewer: () => {},
});

export const useScriptViewer = () => useContext(ScriptViewerContext);

/* ── Highlight helper ── */
const highlightTerms = (text: string, terms: string[]): React.ReactNode => {
  if (!terms.length || !text) return text;
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <span key={i} style={{ backgroundColor: "#FACC15", color: "#000", padding: "0 2px", borderRadius: "2px" }}>
        {part}
      </span>
    ) : (
      part
    )
  );
};

/* ── Paragraph renderer ── */
const SceneParagraph = ({
  p,
  index,
  sceneNum,
  terms,
}: {
  p: ScriptParagraph;
  index: number;
  sceneNum?: number;
  terms: string[];
}) => {
  const hl = (text: string) => highlightTerms(text, terms);
  switch (p.type) {
    case "Scene Heading":
      return (
        <p style={{ textTransform: "uppercase", fontWeight: "bold", marginTop: index === 0 ? 0 : 24, marginBottom: 12 }}>
          {sceneNum !== undefined && <span>{sceneNum}</span>}
          <span style={{ marginLeft: sceneNum !== undefined ? 24 : 0 }}>{hl(p.text)}</span>
        </p>
      );
    case "Character":
      return (
        <p style={{ textTransform: "uppercase", textAlign: "left", paddingLeft: "37%", marginTop: 18, marginBottom: 0 }}>
          {p.text}
        </p>
      );
    case "Parenthetical":
      return (
        <p style={{ paddingLeft: "28%", fontStyle: "italic", marginTop: 0, marginBottom: 0 }}>
          {hl(p.text)}
        </p>
      );
    case "Dialogue":
      return (
        <p style={{ paddingLeft: "17%", paddingRight: "17%", marginTop: 0, marginBottom: 0 }}>
          {hl(p.text)}
        </p>
      );
    case "Transition":
      return (
        <p style={{ textAlign: "right", textTransform: "uppercase", marginTop: 18, marginBottom: 12 }}>
          {p.text}
        </p>
      );
    default:
      return (
        <p style={{ marginTop: 12, marginBottom: 0 }}>
          {hl(p.text)}
        </p>
      );
  }
};

/* ── Provider + Dialog ── */
export const ScriptViewerProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<ScriptViewerState>({
    open: false,
    title: "",
    scenes: [],
    loading: false,
    highlightTerms: [],
  });

  const openScriptViewer = useCallback(
    (opts: { title: string; description?: string; scenes?: ScriptScene[]; highlightTerms?: string[] }) => {
      setState({
        open: true,
        title: opts.title,
        description: opts.description,
        scenes: opts.scenes ?? [],
        loading: !opts.scenes || opts.scenes.length === 0,
        highlightTerms: opts.highlightTerms ?? [],
      });
    },
    []
  );

  const setScriptViewerScenes = useCallback((scenes: ScriptScene[]) => {
    setState((prev) => ({ ...prev, scenes, loading: false }));
  }, []);

  const setScriptViewerLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, loading }));
  }, []);

  const closeScriptViewer = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  return (
    <ScriptViewerContext.Provider
      value={{ openScriptViewer, setScriptViewerScenes, setScriptViewerLoading, closeScriptViewer }}
    >
      {children}

      <Dialog open={state.open} onOpenChange={(open) => !open && closeScriptViewer()}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ScrollText className="h-4 w-4" />
              {state.title}
            </DialogTitle>
            {state.description && (
              <DialogDescription className="text-xs">{state.description}</DialogDescription>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-auto px-6 pb-6">
            {state.loading ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground py-20">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading script…
              </div>
            ) : state.scenes.length === 0 ? (
              <div className="flex items-center justify-center text-muted-foreground py-20">
                No script content found.
              </div>
            ) : (
              <div className="space-y-8">
                {state.scenes.map((scene, si) => (
                  <div
                    key={si}
                    className="mx-auto bg-white text-black shadow-lg"
                    style={{
                      fontFamily: "'Courier Prime', 'Courier New', Courier, monospace",
                      fontSize: "12px",
                      lineHeight: "1.0",
                      padding: "72px 60px 72px 90px",
                      maxWidth: "612px",
                      minHeight: "400px",
                    }}
                  >
                    {scene.paragraphs.map((p, i) => (
                      <SceneParagraph
                        key={i}
                        p={p}
                        index={i}
                        sceneNum={scene.sceneNum}
                        terms={state.highlightTerms}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </ScriptViewerContext.Provider>
  );
};
