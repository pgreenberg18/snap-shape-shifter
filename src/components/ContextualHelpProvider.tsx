import { useState, useEffect, useCallback, useRef } from "react";
import { HelpCircle, ExternalLink } from "lucide-react";
import { useHelp } from "@/components/help/HelpPanel";
import { cn } from "@/lib/utils";

/* ── Contextual help registry ──
   Maps data-help-id values to a short description + the help article id for "Learn more".
*/
interface ContextualEntry {
  label: string;
  description: string;
  articleId?: string; // links to HELP_ARTICLES id
}

const CONTEXTUAL_HELP: Record<string, ContextualEntry> = {
  /* ── Sidebar navigation ── */
  "nav-development": {
    label: "Development",
    description: "Upload your screenplay, set format specs, and run AI-powered script analysis.",
    articleId: "dev-overview",
  },
  "nav-pre-production": {
    label: "Pre-Production",
    description: "Cast characters, design locations, select wardrobe and props, and build storyboards.",
    articleId: "preprod-overview",
  },
  "nav-production": {
    label: "Production",
    description: "Build shots scene-by-scene with camera, lighting, and lens controls, then generate imagery.",
    articleId: "prod-overview",
  },
  "nav-post-production": {
    label: "Post-Production",
    description: "Arrange clips on a multi-track timeline; add VFX fixes, color grading, sound, and music.",
    articleId: "postprod-overview",
  },
  "nav-release": {
    label: "Release",
    description: "Export master files, generate marketing assets, and produce provenance documentation.",
    articleId: "release-overview",
  },
  "nav-settings": {
    label: "Settings",
    description: "Configure version-specific integrations, providers, and format specifications.",
    articleId: "settings",
  },
  "nav-help": {
    label: "Help Center",
    description: "Browse context-aware help articles for guidance on every phase and feature.",
  },
  "nav-versions": {
    label: "Versions",
    description: "Go back to the project version list to switch, duplicate, or archive versions.",
    articleId: "versions",
  },
  "nav-global-settings": {
    label: "Global Settings",
    description: "Manage admin controls, access permissions, and workspace-level configuration.",
    articleId: "settings",
  },
  "nav-credit-meter": {
    label: "Credit Meter",
    description: "Shows your remaining AI generation credits. Credits are consumed by analysis, image, and video tasks.",
  },

  /* ── Development phase ── */
  "dev-film-details": {
    label: "Film Details",
    description: "Set the film's title, version name, writers, genres, and time period.",
    articleId: "dev-overview",
  },
  "dev-format-specs": {
    label: "Format Specifications",
    description: "Choose resolution, frame rate, and aspect ratio from industry-standard presets.",
    articleId: "format-specs",
  },
  "dev-script-upload": {
    label: "Script Upload",
    description: "Upload .fdx, .fountain, or .txt screenplay files for AI analysis.",
    articleId: "upload-script",
  },
  "dev-script-breakdown": {
    label: "Script Breakdown",
    description: "AI-generated scene-by-scene breakdown with characters, locations, props, and mood.",
    articleId: "script-analysis",
  },
  "dev-visual-summary": {
    label: "Visual Summary",
    description: "AI interpretation of the script's visual style, tone, and cinematic identity.",
    articleId: "dev-overview",
  },
  "dev-content-safety": {
    label: "Content Safety",
    description: "Flag violence, nudity, and language to set generation guardrails.",
    articleId: "content-safety",
  },
  "dev-global-elements": {
    label: "Global Elements",
    description: "Cross-cutting themes, motifs, and tonal threads extracted from the screenplay.",
    articleId: "global-elements",
  },
  "dev-ai-notes": {
    label: "AI Generation Notes",
    description: "Director's notes prepended to every AI prompt for consistent creative direction.",
    articleId: "global-elements",
  },
  "dev-director-vision": {
    label: "Director Vision",
    description: "AI-matched director profile that shapes the film's visual DNA and style contract.",
    articleId: "dev-overview",
  },

  /* ── Pre-Production ── */
  "preprod-characters": {
    label: "Characters",
    description: "Cast and audition AI-generated headshots. Rate, rank, and lock your cast.",
    articleId: "characters",
  },
  "preprod-locations": {
    label: "Locations",
    description: "Design and approve AI-generated location concepts for each scene.",
    articleId: "locations-props",
  },
  "preprod-props": {
    label: "Props",
    description: "Browse and lock key objects and props identified from the script.",
    articleId: "locations-props",
  },
  "preprod-wardrobe": {
    label: "Wardrobe",
    description: "Manage costume designs linked to characters and per-scene assignments.",
    articleId: "locations-props",
  },
  "preprod-vehicles": {
    label: "Picture Vehicles",
    description: "Manage vehicle assets identified from the script for visual consistency.",
    articleId: "locations-props",
  },
  "preprod-storyboards": {
    label: "Storyboards",
    description: "Build shot-by-shot visual sequences with AI-generated storyboard artwork.",
    articleId: "storyboards",
  },
  "preprod-voice-casting": {
    label: "Voice Casting",
    description: "Preview and select AI voice options for each character.",
    articleId: "voice-casting",
  },

  /* ── Production ── */
  "prod-scene-navigator": {
    label: "Scene Navigator",
    description: "Browse all scenes from the script breakdown. Click a scene to load it.",
    articleId: "scene-navigator",
  },
  "prod-script-workspace": {
    label: "Script Workspace",
    description: "The scene's raw text. Highlight text to create new shot objects.",
    articleId: "script-workspace",
  },
  "prod-shot-builder": {
    label: "Shot Builder",
    description: "Configure the selected shot's prompt, camera angle, and generation settings.",
    articleId: "shot-builder",
  },
  "prod-playback-monitor": {
    label: "Playback Monitor",
    description: "Preview generated imagery with a professional camera HUD overlay.",
    articleId: "playback-monitor",
  },
  "prod-optics-suite": {
    label: "Optics Suite",
    description: "Master controls for camera, lighting, and lens settings applied to all generation.",
    articleId: "optics-suite",
  },
  "prod-shot-list": {
    label: "Shot List",
    description: "All shots created for the current scene with status indicators.",
    articleId: "shot-builder",
  },
  "prod-vice": {
    label: "VICE System",
    description: "Visual Integrity & Continuity Engine — detects conflicts across shots and scenes.",
    articleId: "vice",
  },

  /* ── Post-Production ── */
  "postprod-timeline": {
    label: "Timeline",
    description: "Multi-track timeline for arranging clips, audio, and effects.",
    articleId: "postprod-overview",
  },
  "postprod-vfx": {
    label: "VFX Fix-It Bay",
    description: "AI-powered visual effects repair and enhancement tools.",
    articleId: "postprod-overview",
  },
  "postprod-style-drift": {
    label: "Style Drift Detector",
    description: "Monitors visual consistency across your edit and flags style deviations.",
    articleId: "postprod-overview",
  },
  "postprod-localization": {
    label: "Localization Suite",
    description: "Subtitle, dubbing, and language adaptation tools.",
    articleId: "postprod-overview",
  },

  /* ── Release ── */
  "release-export": {
    label: "Export",
    description: "Render master files in various formats and resolutions.",
    articleId: "release-overview",
  },
  "release-topaz": {
    label: "Topaz DI",
    description: "AI upscaling and enhancement for final delivery.",
    articleId: "release-overview",
  },
  "release-artifact-scanner": {
    label: "Artifact Scanner",
    description: "Scans rendered output for compression artifacts and quality issues.",
    articleId: "release-overview",
  },

  /* ── Common UI ── */
  "btn-analyze": {
    label: "Analyze Script",
    description: "Run multi-pass AI analysis to extract scenes, characters, locations, and visual elements.",
    articleId: "script-analysis",
  },
  "btn-generate": {
    label: "Generate",
    description: "Submit the current shot configuration for AI image or video generation.",
    articleId: "shot-builder",
  },
  "btn-lock": {
    label: "Lock Asset",
    description: "Locks this asset as the canonical reference for visual consistency downstream.",
    articleId: "locations-props",
  },
};

/* ── Provider Component ── */
const ContextualHelpProvider = () => {
  const { openArticle } = useHelp();
  const [popup, setPopup] = useState<{
    x: number;
    y: number;
    entry: ContextualEntry;
  } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      // Walk up from target to find nearest data-help-id
      let el = e.target as HTMLElement | null;
      while (el) {
        const helpId = el.getAttribute("data-help-id");
        if (helpId && CONTEXTUAL_HELP[helpId]) {
          // Only show if the element is NOT multi-selected (for merge context menu)
          if (el.getAttribute("data-multi-selected") === "true") return;
          e.preventDefault();
          e.stopPropagation();
          setPopup({
            x: e.clientX,
            y: e.clientY,
            entry: CONTEXTUAL_HELP[helpId],
          });
          return;
        }
        el = el.parentElement;
      }
      // No help id found — let browser default happen
    },
    []
  );

  const dismiss = useCallback(() => setPopup(null), []);

  useEffect(() => {
    document.addEventListener("contextmenu", handleContextMenu, true);
    document.addEventListener("click", dismiss);
    document.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu, true);
      document.removeEventListener("click", dismiss);
      document.removeEventListener("scroll", dismiss, true);
    };
  }, [handleContextMenu, dismiss]);

  // Clamp popup position so it doesn't overflow viewport
  const clampedX = popup
    ? Math.min(popup.x, window.innerWidth - 280)
    : 0;
  const clampedY = popup
    ? Math.min(popup.y, window.innerHeight - 120)
    : 0;

  if (!popup) return null;

  return (
    <div
      ref={popupRef}
      className="fixed z-[100] w-[260px] rounded-lg border bg-popover p-3 text-popover-foreground animate-in fade-in-0 zoom-in-95 duration-150"
      style={{
        left: clampedX,
        top: clampedY,
        boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start gap-2">
        <HelpCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground leading-tight">
            {popup.entry.label}
          </p>
          <p className="text-[11px] leading-relaxed text-muted-foreground mt-1">
            {popup.entry.description}
          </p>
          {popup.entry.articleId && (
            <button
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                openArticle(popup.entry.articleId!);
                setPopup(null);
              }}
            >
              Learn more
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContextualHelpProvider;
export { CONTEXTUAL_HELP };
