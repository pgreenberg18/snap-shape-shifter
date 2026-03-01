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
    description: "Three-tab workflow: Fundamentals (script & format), Vision (director style & production bible), and Scene Breakdown (enriched scene data).",
    articleId: "dev-overview",
  },
  "nav-pre-production": {
    label: "Pre-Production",
    description: "Audition actors, design locations, select wardrobe and props, build storyboards, and cast voices.",
    articleId: "preprod-overview",
  },
  "nav-production": {
    label: "Production",
    description: "Build shots scene-by-scene with the Optics Suite, generate imagery, and monitor continuity via VICE.",
    articleId: "prod-overview",
  },
  "nav-post-production": {
    label: "Post-Production",
    description: "Multi-track timeline editing with VFX Fix-It Bay, Style Drift Detector, and Localization Suite.",
    articleId: "postprod-overview",
  },
  "nav-release": {
    label: "Release",
    description: "Export masters, run Topaz DI upscaling, Artifact Scanner QC, and generate C2PA provenance documentation.",
    articleId: "release-overview",
  },
  "nav-settings": {
    label: "Settings",
    description: "Configure version-specific integrations, providers, media library, and format specifications.",
    articleId: "settings",
  },
  "nav-help": {
    label: "Help Center",
    description: "Browse context-aware help articles for guidance on every phase, panel, button, and feature.",
  },
  "nav-versions": {
    label: "Versions",
    description: "Switch, duplicate, or archive versions. Each version carries independent data and settings.",
    articleId: "versions",
  },
  "nav-global-settings": {
    label: "Global Settings",
    description: "Manage admin controls, access permissions, NDA settings, and workspace-level configuration.",
    articleId: "settings",
  },
  "nav-credit-meter": {
    label: "Credit Meter",
    description: "Shows remaining AI credits. Click for usage history and threshold settings. Credits are consumed by analysis, image, video, and voice tasks.",
    articleId: "credits",
  },

  /* ── Development phase ── */
  "dev-film-details": {
    label: "Script & Film Details",
    description: "Set the film's title, version name, and writers. Upload your screenplay (.fdx, .txt, .pdf) and trigger AI analysis.",
    articleId: "upload-script",
  },
  "dev-format-specs": {
    label: "Format Specifications",
    description: "Choose resolution, frame rate, and aspect ratio from 20+ presets. Toggle 4K. Click 'Save Format' to persist (turns green on success).",
    articleId: "format-specs",
  },
  "dev-script-upload": {
    label: "Script Upload",
    description: "Upload .fdx, .txt, or .pdf screenplay files. Click 'Analyze Script' to run multi-pass AI analysis with per-scene retry logic.",
    articleId: "upload-script",
  },
  "dev-script-breakdown": {
    label: "Script Breakdown",
    description: "AI-generated scene-by-scene breakdown. All fields editable inline. Data saved to parsed_scenes table as single source of truth.",
    articleId: "script-analysis",
  },
  "dev-visual-summary": {
    label: "Visual Summary",
    description: "AI interpretation of the script's visual style and cinematic identity. Approve to proceed, or edit to refine.",
    articleId: "visual-summary",
  },
  "dev-content-safety": {
    label: "Ratings Classification",
    description: "MPAA-style content safety analysis. Auto-scans all scenes for violence, nudity, and language. Approve ratings to satisfy Vision lock gate.",
    articleId: "content-safety",
  },
  "dev-global-elements": {
    label: "Global Elements",
    description: "Auto-grouped characters, locations, props, wardrobe, and vehicles. Double-click to rename. Multi-select to link. Approve each category.",
    articleId: "global-elements",
  },
  "dev-ai-notes": {
    label: "AI Generation Notes",
    description: "Director's notes prepended to every AI prompt. Approve or write your own for consistent creative direction across all generation.",
    articleId: "visual-summary",
  },
  "dev-director-vision": {
    label: "Director's Vision",
    description: "Neural style engine matches your script to iconic director profiles. Produces the Style Contract governing all downstream generation.",
    articleId: "director-vision",
  },
  "dev-production-bible": {
    label: "Production Bible",
    description: "AI-generated reference document compiling creative direction, character summaries, and scene notes. Download as PDF. Approve to satisfy Vision lock.",
    articleId: "production-bible",
  },

  /* ── Pre-Production ── */
  "preprod-characters": {
    label: "Actors",
    description: "Audition AI headshots via 'Casting Call'. Rate, rank, and lock your cast. Generate consistency views. Upload reference photos.",
    articleId: "characters",
  },
  "preprod-locations": {
    label: "Locations",
    description: "Generate AI concept art for each location. Auto-grouped from Global Elements. Rate, lock, and approve designs.",
    articleId: "locations-props",
  },
  "preprod-props": {
    label: "Props",
    description: "Props auto-grouped by character ownership or location co-occurrence. Generate options, rate, and lock for downstream consistency.",
    articleId: "locations-props",
  },
  "preprod-wardrobe": {
    label: "Wardrobe",
    description: "Character-linked costumes with per-scene assignments. Generate fitting views from multiple angles. Lock for production.",
    articleId: "locations-props",
  },
  "preprod-vehicles": {
    label: "Picture Vehicles",
    description: "Design and lock picture vehicles identified from the script for consistent visual reference.",
    articleId: "locations-props",
  },
  "preprod-storyboards": {
    label: "Storyboards",
    description: "Build shot-by-shot visual sequences. Add frames, describe composition, generate AI artwork, and drag to reorder.",
    articleId: "storyboards",
  },
  "preprod-voice-casting": {
    label: "Voice Casting",
    description: "Preview AI voice options per character. Audition with sample dialogue. Lock your chosen voice for all dialogue generation.",
    articleId: "voice-casting",
  },

  /* ── Production ── */
  "prod-scene-navigator": {
    label: "Scene Navigator",
    description: "Browse all scenes with INT/EXT badges, time-of-day icons, and shot counts. Click to load. Drag edge to resize.",
    articleId: "scene-navigator",
  },
  "prod-script-workspace": {
    label: "Script Workspace",
    description: "Syntax-highlighted scene text. Highlight any passage and click 'Create Shot' to build a shot from that text.",
    articleId: "script-workspace",
  },
  "prod-shot-builder": {
    label: "Shot Builder",
    description: "Configure shot prompt, camera angle, and elements. Use 'Rehearsal' for quick previews or 'Roll Camera' for full-quality generation.",
    articleId: "shot-builder",
  },
  "prod-playback-monitor": {
    label: "Playback Monitor",
    description: "Cinematic viewport with camera HUD overlay. 5-slot Take Bin below for rating, circling, and managing generated takes.",
    articleId: "playback-monitor",
  },
  "prod-optics-suite": {
    label: "Optics Suite",
    description: "Master controls for camera (aspect, movement, height), lens (focal length, aperture, focus), and lighting (key, fill, rim, practicals).",
    articleId: "optics-suite",
  },
  "prod-shot-list": {
    label: "Shot List",
    description: "Color-coded shot chips for the current scene. Click to select. Add new shots with (+). Shows generation status per shot.",
    articleId: "shot-builder",
  },
  "prod-vice": {
    label: "VICE System",
    description: "Visual Integrity & Continuity Engine. Detects conflicts across shots, shows dependency graphs, and manages dirty-queue regeneration.",
    articleId: "vice",
  },

  /* ── Post-Production ── */
  "postprod-media-bin": {
    label: "Media Bin",
    description: "Shots organized by scene folders. Imported media in tabbed sections (Sound, Color, Score, FX). Drag items onto timeline tracks.",
    articleId: "media-bin",
  },
  "postprod-timeline": {
    label: "Timeline",
    description: "Multi-track NLE with drag, trim, undo/redo (100 steps), zoom (25%–400%), and FCPXML export. Double-click clips for VFX Fix-It Bay.",
    articleId: "timeline",
  },
  "postprod-vfx": {
    label: "VFX Fix-It Bay",
    description: "AI-powered inpainting. Paint a mask, type a surgical prompt, and apply. Use for artifact removal, set changes, and continuity fixes.",
    articleId: "vfx-fix-it",
  },
  "postprod-style-drift": {
    label: "Style Drift Detector",
    description: "Monitors shots against the Style Contract. Flags color, lighting, texture, and mood deviations with severity indicators.",
    articleId: "style-drift",
  },
  "postprod-localization": {
    label: "Localization Suite",
    description: "AI subtitles, translation, and dubbing. Export as SRT, VTT, or ASS. Preview subtitles overlaid on the monitor.",
    articleId: "localization",
  },

  /* ── Release ── */
  "release-export": {
    label: "Export Master Film",
    description: "Three modes: Auto (from format specs), Templates (YouTube 4K, Netflix ProRes, Theater DCP), and Custom (full codec control).",
    articleId: "export-master",
  },
  "release-topaz": {
    label: "Topaz DI Engine",
    description: "AI upscaling (2x/4x), noise reduction, sharpening, and frame rate conversion for final delivery enhancement.",
    articleId: "topaz-di",
  },
  "release-artifact-scanner": {
    label: "Artifact Scanner (Technical QC)",
    description: "Scans renders for compression artifacts, banding, frame drops, and quality issues. Grades as Pass / Warning / Fail.",
    articleId: "artifact-scanner",
  },
  "release-c2pa": {
    label: "C2PA Provenance",
    description: "Cryptographic chain-of-title ledger documenting AI generation lineage, authorship claims, and licensed API usage.",
    articleId: "c2pa-provenance",
  },
  "release-distribution": {
    label: "Distribution Packaging",
    description: "Festival bundle (ZIP), ProRes 422 HQ master, and direct upload to YouTube, Vimeo, and TikTok with OAuth.",
    articleId: "distribution",
  },
  "release-export-history": {
    label: "Finished Exports",
    description: "Session history of all exports with download links. Hover for download button. Clear All removes the list only.",
    articleId: "finished-exports",
  },

  /* ── Common UI buttons ── */
  "btn-analyze": {
    label: "Analyze Script",
    description: "Runs multi-pass AI analysis: scene parsing → enrichment (with retry) → global analysis → finalization. Progress shown as scrolling scene list.",
    articleId: "script-analysis",
  },
  "btn-generate": {
    label: "Generate",
    description: "Submits the current shot configuration for AI generation. Combines prompt, Optics Suite settings, and Style Contract.",
    articleId: "shot-builder",
  },
  "btn-lock": {
    label: "Lock Asset",
    description: "Locks this asset as the canonical reference for visual consistency. Changes after locking flag dependent shots for regeneration via VICE.",
    articleId: "locations-props",
  },
  "btn-lock-fundamentals": {
    label: "Lock Fundamentals",
    description: "Freezes all script, format, time period, and genre data. Unlocks the Vision tab. Cannot be undone within this version.",
    articleId: "dev-overview",
  },
  "btn-lock-vision": {
    label: "Lock Vision",
    description: "Freezes Director's Vision, Global Elements, Ratings, and Production Bible. Triggers Vision Propagation Pipeline enriching all scenes. Unlocks Scene Breakdown.",
    articleId: "dev-overview",
  },
  "btn-save-format": {
    label: "Save Format",
    description: "Persists format specifications (resolution, frame rate, aspect ratio) to the database. Turns green and shows 'Saved' on success.",
    articleId: "format-specs",
  },
  "btn-casting-call": {
    label: "Casting Call",
    description: "Generates 10 AI headshot candidates across multiple angles. Shows 'Casting…' during generation. Changes to 'Recast' if candidates already exist.",
    articleId: "characters",
  },
  "btn-cast-actor": {
    label: "Cast This Actor",
    description: "Locks the selected headshot as the character's canonical identity. All future generation references this image for visual consistency.",
    articleId: "characters",
  },
  "btn-approve": {
    label: "Approve",
    description: "Signs off on the current section. Button turns green and shows 'Approved' with a checkmark. Required for Vision lock gate.",
    articleId: "dev-overview",
  },
  "btn-rehearsal": {
    label: "Rehearsal",
    description: "Fast, low-quality preview generation for composition checks. Uses fewer credits than full generation.",
    articleId: "shot-builder",
  },
  "btn-roll-camera": {
    label: "Roll Camera",
    description: "Full-quality AI generation. Consumes standard credits. Results appear in the Playback Monitor's Take Bin.",
    articleId: "shot-builder",
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
