import { useState, useEffect, createContext, useContext, ReactNode, Fragment } from "react";
import { useLocation } from "react-router-dom";
import { HelpCircle, Search, X, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/* ── Simple content renderer ──
   Supports: **bold**, *italic*, [text](url), bullet points (• or -),
   numbered lists (1. 2. 3.), section headings (lines ending with no period
   that start with **), and paragraph breaks (\n\n).
*/
function renderContent(raw: string) {
  const paragraphs = raw.split("\n\n");

  return (
    <div className="space-y-4">
      {paragraphs.map((para, pi) => {
        const lines = para.split("\n");
        const elements: React.ReactNode[] = [];
        let listBuffer: { type: "ul" | "ol"; items: React.ReactNode[] } | null = null;

        const flushList = () => {
          if (listBuffer) {
            const Tag = listBuffer.type === "ol" ? "ol" : "ul";
            elements.push(
              <Tag
                key={`list-${pi}-${elements.length}`}
                className={cn(
                  "space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground",
                  listBuffer.type === "ol" ? "list-decimal" : "list-disc"
                )}
              >
                {listBuffer.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </Tag>
            );
            listBuffer = null;
          }
        };

        for (let li = 0; li < lines.length; li++) {
          const line = lines[li];
          const trimmed = line.trim();
          if (!trimmed) continue;

          // Bullet lines
          const bulletMatch = trimmed.match(/^[•\-–]\s+(.+)/);
          if (bulletMatch) {
            if (!listBuffer || listBuffer.type !== "ul") {
              flushList();
              listBuffer = { type: "ul", items: [] };
            }
            listBuffer.items.push(inlineFormat(bulletMatch[1]));
            continue;
          }

          // Numbered list lines
          const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
          if (numMatch) {
            if (!listBuffer || listBuffer.type !== "ol") {
              flushList();
              listBuffer = { type: "ol", items: [] };
            }
            listBuffer.items.push(inlineFormat(numMatch[2]));
            continue;
          }

          // Flush any pending list before rendering a non-list line
          flushList();

          // Section heading: starts with ** and the bold segment is the whole line or near-whole line
          const headingMatch = trimmed.match(/^\*\*(.+?)\*\*$/);
          if (headingMatch) {
            elements.push(
              <h4
                key={`h-${pi}-${li}`}
                className="font-display text-sm font-bold text-foreground tracking-wide pt-1"
              >
                {headingMatch[1]}
              </h4>
            );
            continue;
          }

          // Regular line
          elements.push(
            <p
              key={`p-${pi}-${li}`}
              className="text-sm leading-relaxed text-muted-foreground"
            >
              {inlineFormat(trimmed)}
            </p>
          );
        }
        flushList();

        return <Fragment key={pi}>{elements}</Fragment>;
      })}
    </div>
  );
}

/** Parses inline formatting: **bold**, *italic*, [text](url) */
function inlineFormat(text: string): React.ReactNode {
  // Regex matches: [link](url), **bold**, *italic*
  const regex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2] && match[3]) {
      // Link
      parts.push(
        <a
          key={`l-${match.index}`}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline inline-flex items-center gap-0.5"
        >
          {match[2]}
          <ExternalLink className="h-3 w-3 opacity-60 shrink-0" />
        </a>
      );
    } else if (match[4]) {
      // Bold
      parts.push(
        <strong key={`b-${match.index}`} className="font-semibold text-foreground">
          {match[4]}
        </strong>
      );
    } else if (match[5]) {
      // Italic
      parts.push(
        <em key={`i-${match.index}`} className="italic">
          {match[5]}
        </em>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

/* ── Help content database ── */
interface HelpArticle {
  id: string;
  title: string;
  context: string[];
  content: string;
  category: string;
}

export const HELP_ARTICLES: HelpArticle[] = [
  /* ═══════════════════════════════════════════
     GENERAL / PROJECTS
     ═══════════════════════════════════════════ */
  {
    id: "getting-started",
    title: "Getting Started",
    context: ["projects", "home"],
    category: "General",
    content:
      "Welcome to **Virtual Film Studio** — your AI-powered cinematic production pipeline.\n\n" +
      "**Creating a Project**\n" +
      "Click *New Project* on the Projects dashboard. Enter a title and an optional description. Each project acts as a top-level container for your entire film.\n\n" +
      "**Workflow Overview**\n" +
      "Every project flows through five sequential phases:\n" +
      "1. **Development** — Upload and analyze your screenplay, set format specifications, and review AI breakdowns.\n" +
      "2. **Pre-Production** — Cast characters, design locations, select wardrobe and props, and build storyboards.\n" +
      "3. **Production** — Build shots scene by scene with camera, lighting, and lens controls, then generate imagery.\n" +
      "4. **Post-Production** — Arrange clips on a multi-track timeline; add VFX fixes, color grading, sound, and music.\n" +
      "5. **Release** — Export master files, generate marketing assets, package for festivals, and produce C2PA provenance documentation.\n\n" +
      "**Tips**\n" +
      "• Work through the phases in order — each phase builds on locked assets from the previous one.\n" +
      "• Use the **Help** panel (?) on any page for context-specific guidance.\n" +
      "• Credits are consumed by AI generation tasks. Monitor your balance in the header bar.",
  },
  {
    id: "versions",
    title: "Managing Versions",
    context: ["projects", "versions"],
    category: "General",
    content:
      "Versions let you branch and iterate without losing previous work.\n\n" +
      "**Creating Versions**\n" +
      "From the project's version list, click *New Version* or duplicate an existing one. Duplicating copies all characters, shots, analysis data, and timeline clips.\n\n" +
      "**Version Names**\n" +
      "Each version has a unique name within its project (e.g., *Director's Cut*, *Festival Edit*). Rename by clicking the version name on its card.\n\n" +
      "**Archiving and Deleting**\n" +
      "Archive versions you are not actively editing — they are hidden from the main list but can be restored at any time. Deleting permanently removes all associated data.\n\n" +
      "**Version Settings**\n" +
      "Access per-version settings (format, integrations, provider selections) from the Settings icon on each version card or via the sidebar *Settings* link.",
  },
  {
    id: "settings",
    title: "Settings & Integrations",
    context: ["settings"],
    category: "Settings",
    content:
      "Configure external service integrations used across your production pipeline.\n\n" +
      "**Integration Sections**\n" +
      "Integrations are organized by function:\n" +
      "• **Script Analysis** — AI services for screenplay parsing and scene breakdown.\n" +
      "• **Image Generation** — Services for headshots, storyboards, and shot generation.\n" +
      "• **Video Generation** — AI video synthesis for takes and animations.\n" +
      "• **Audio & Voice** — Text-to-speech, voice cloning, and sound effect generation.\n\n" +
      "**Adding API Keys**\n" +
      "Click on an integration provider, paste your API key, and verify the connection. Keys are encrypted and stored securely.\n\n" +
      "**Provider Selection**\n" +
      "When multiple providers are available for a section, select your preferred default. This choice is version-specific, so different versions can use different services.\n\n" +
      "**Troubleshooting**\n" +
      "• If verification fails, double-check your key and ensure it has the required scopes.\n" +
      "• Some providers require specific plan tiers for certain features.",
  },

  /* ═══════════════════════════════════════════
     DEVELOPMENT
     ═══════════════════════════════════════════ */
  {
    id: "dev-overview",
    title: "Development Phase Overview",
    context: ["development"],
    category: "Development",
    content:
      "The Development phase is where your project takes shape. Here you define your film's metadata, upload the screenplay, and run AI analysis.\n\n" +
      "**Key Panels**\n" +
      "• **Film Details** — Title, version name, writers, genres, and time period.\n" +
      "• **Format Specifications** — Resolution, frame rate, and aspect ratio (16:9, 2.39:1, 9:16, etc.).\n" +
      "• **Script Upload & Analysis** — Upload *.fdx* or *.txt* files, then analyze to extract scenes.\n" +
      "• **Scene Breakdown** — AI-generated breakdown with headings, characters, locations, wardrobe, and props.\n" +
      "• **Visual Summary** — AI interpretation of the script's visual style and tone.\n" +
      "• **Content Safety** — Flag violence, nudity, and language for generation guardrails.\n" +
      "• **Global Elements** — Cross-cutting themes, motifs, and tone extracted by AI.\n" +
      "• **AI Generation Notes** — Director's notes that influence all downstream AI generation.\n\n" +
      "**Workflow**\n" +
      "1. Fill in film details and format specifications.\n" +
      "2. Upload your screenplay.\n" +
      "3. Click *Analyze* and wait for the AI breakdown.\n" +
      "4. Review each section — approve, edit, or regenerate.\n" +
      "5. Lock the script to proceed to Pre-Production.",
  },
  {
    id: "upload-script",
    title: "Uploading a Screenplay",
    context: ["development"],
    category: "Development",
    content:
      "**Supported Formats**\n" +
      "• **Final Draft (.fdx)** — Industry standard; preserves scene headings and character cues.\n" +
      "• **Plain Text (.txt)** — Should follow standard screenplay formatting conventions.\n\n" +
      "**How to Upload**\n" +
      "1. Navigate to the Development phase.\n" +
      "2. Locate the *Script Upload* panel.\n" +
      "3. Drag and drop your file, or click to browse.\n" +
      "4. The file name and size will appear, confirming the upload.\n\n" +
      "**After Upload**\n" +
      "Click the *Analyze Script* button. The AI will parse scene headings, extract characters, identify locations, catalog wardrobe and props, and generate a visual summary.\n\n" +
      "**Re-uploading**\n" +
      "You can upload a new script at any time before locking. This replaces the previous upload and all analysis data. After locking, the script cannot be changed.",
  },
  {
    id: "script-analysis",
    title: "Script Analysis & Breakdown",
    context: ["development"],
    category: "Development",
    content:
      "After uploading, the AI performs a comprehensive multi-pass analysis:\n\n" +
      "**Pass 1 — Scene Parsing**\n" +
      "Extracts individual scenes with headings (INT/EXT, location, time of day), character appearances, dialogue blocks, and action lines.\n\n" +
      "**Pass 2 — Scene Enrichment**\n" +
      "For each scene, the AI identifies: key objects and props, wardrobe descriptions, mood and tone, sound cues, VFX requirements, stunts, picture vehicles, animals, and extras.\n\n" +
      "**Pass 3 — Global Analysis**\n" +
      "Cross-references all scenes to produce: character arc summaries, location frequency, global themes, visual motifs, and content safety recommendations.\n\n" +
      "**Reviewing Results**\n" +
      "Each scene card displays extracted data. Click to expand details. Use the approval checkboxes to sign off on each scene's breakdown. Rejected scenes can be re-analyzed.\n\n" +
      "**Progress Tracking**\n" +
      "The analysis progress bar shows enrichment status. The *Analyzing…* badge in the sidebar remains visible until all passes are complete.",
  },
  {
    id: "format-specs",
    title: "Format Specifications",
    context: ["development"],
    category: "Development",
    content:
      "Format settings determine the technical specifications for all generated assets.\n\n" +
      "**Presets**\n" +
      "Choose from 20+ industry-standard presets:\n" +
      "• Feature Film (1920×1080, 24 fps, 16:9)\n" +
      "• Short Film, Music Video, Commercial\n" +
      "• TikTok / Instagram Reel (1080×1920, 30 fps, 9:16)\n" +
      "• IMAX (4096×2160), YouTube 4K, and more.\n\n" +
      "**4K Resolution Toggle**\n" +
      "For eligible presets, enable 4K to double the resolution (e.g., 3840×2160). *Note:* 4K increases generation cost and processing time.\n\n" +
      "**Custom Overrides**\n" +
      "Manually set width, height, and frame rate after selecting a preset. Custom values persist unless you re-select a preset.\n\n" +
      "**Impact**\n" +
      "These settings flow into Production (shot generation dimensions), Post-Production (timeline frame rate), and Release (export defaults).",
  },
  {
    id: "content-safety",
    title: "Content Safety Controls",
    context: ["development"],
    category: "Development",
    content:
      "Content safety flags inform AI generation boundaries for your project.\n\n" +
      "**Flags**\n" +
      "• **Violence** — Controls depiction of physical conflict, blood, and weapons.\n" +
      "• **Nudity** — Controls exposure levels in character generation.\n" +
      "• **Language** — Controls profanity and mature dialogue in voice generation.\n\n" +
      "**Modes**\n" +
      "• **Auto** — The AI determines appropriate levels from the script context.\n" +
      "• **Manual** — You explicitly set each flag on or off.\n\n" +
      "**AI Safety Analysis**\n" +
      "Run the analyzer to receive AI-recommended [MPAA ratings](https://www.motionpictures.org/film-ratings/) based on script content. Review recommendations and override as needed.\n\n" +
      "**How It Works**\n" +
      "When enabled, safety flags are injected into all downstream generation prompts as negative constraints, preventing the AI from producing content outside your boundaries.",
  },
  {
    id: "global-elements",
    title: "Global Elements & AI Notes",
    context: ["development"],
    category: "Development",
    content:
      "**Global Elements**\n" +
      "Cross-cutting story attributes extracted by AI analysis:\n" +
      "• Time period and historical context\n" +
      "• Visual motifs and recurring imagery\n" +
      "• Dominant color palettes and lighting moods\n" +
      "• Thematic threads across scenes\n" +
      "• Tonal arc (comedy, drama, thriller beats)\n\n" +
      "Review these carefully — they influence consistency across all generated imagery.\n\n" +
      "**AI Generation Notes**\n" +
      "Director's notes that are prepended to every AI generation prompt throughout the pipeline. Use them to establish:\n" +
      "• Visual style references (e.g., *inspired by Roger Deakins' cinematography*)\n" +
      "• Color palette preferences\n" +
      "• Mood and atmosphere direction\n" +
      "• Any overarching creative constraints\n\n" +
      "Approve the AI-suggested notes or write your own. These notes are version-specific.",
  },

  /* ═══════════════════════════════════════════
     PRE-PRODUCTION
     ═══════════════════════════════════════════ */
  {
    id: "preprod-overview",
    title: "Pre-Production Phase Overview",
    context: ["pre-production"],
    category: "Pre-Production",
    content:
      "Pre-Production is your casting and design studio. Here you finalize the visual identity of every element before shooting begins.\n\n" +
      "**Sidebar Panels**\n" +
      "• **Characters** — Cast and audition AI-generated headshots.\n" +
      "• **Locations** — Design and approve location concepts.\n" +
      "• **Props & Wardrobe** — Browse and lock key objects and costume designs.\n" +
      "• **Storyboards** — Build shot-by-shot visual sequences per scene.\n" +
      "• **Voice Casting** — Preview and select AI voice options per character.\n\n" +
      "**Workflow**\n" +
      "1. Start with **Characters** — generate audition options, rate, rank, and lock your cast.\n" +
      "2. Move to **Locations** and **Props** to establish the visual world.\n" +
      "3. Build **Storyboards** to plan shot composition.\n" +
      "4. Cast **Voices** for dialogue generation.\n\n" +
      "**Locking Assets**\n" +
      "Locked assets become the reference identity used in Production. Changes after locking require regeneration of dependent shots.",
  },
  {
    id: "characters",
    title: "Character Casting & Auditions",
    context: ["pre-production"],
    category: "Pre-Production",
    content:
      "**Generating Headshots**\n" +
      "Select a character from the sidebar. Click *Generate Options* to produce AI headshot variations. Each generation creates multiple options across sections (Close-up, Profile, Full Body).\n\n" +
      "**Rating & Ranking**\n" +
      "Rate each headshot 1–3 stars. Use drag-and-drop to rank your favorites within each section. The ranking influences which reference the AI prioritizes.\n\n" +
      "**Locking a Character**\n" +
      "Once satisfied, click *Lock* on your chosen headshot. This becomes the character's canonical identity — all future generation (storyboards, shots, video) will reference this locked image for visual consistency.\n\n" +
      "**Editing Character Details**\n" +
      "Update name, description, age range, sex, and other attributes from the character detail panel. Changes to locked characters flag them as *dirty* for regeneration.\n\n" +
      "**Reference Images**\n" +
      "Upload your own reference photo as an alternative to AI generation. This is useful for real actors or specific visual targets.",
  },
  {
    id: "locations-props",
    title: "Locations, Props & Wardrobe",
    context: ["pre-production"],
    category: "Pre-Production",
    content:
      "**Locations**\n" +
      "Locations are extracted from script scene headings. For each location:\n" +
      "• Generate AI concept art options.\n" +
      "• Rate and select your preferred design.\n" +
      "• Lock the chosen concept as the canonical location reference.\n\n" +
      "**Props & Key Objects**\n" +
      "Props identified during script analysis appear in a categorized list. Generate visual options for critical props and lock your selections.\n\n" +
      "**Wardrobe**\n" +
      "Wardrobe items are linked to specific characters. Each entry includes:\n" +
      "• A description extracted from the script.\n" +
      "• AI-generated costume concept options.\n" +
      "• Per-scene assignment controls — toggle which scenes each item is worn in.\n" +
      "• Lock status for downstream consistency.\n\n" +
      "**Asset Identity Registry**\n" +
      "All locked assets are registered in the Asset Identity Registry with internal reference codes. This ensures consistent visual identity across all generation tasks.",
  },
  {
    id: "storyboards",
    title: "Storyboard Builder",
    context: ["pre-production"],
    category: "Pre-Production",
    content:
      "**Creating Storyboard Frames**\n" +
      "Select a scene from the navigator, then add frames to build a shot-by-shot visual plan.\n\n" +
      "**Frame Options**\n" +
      "• Describe the shot composition in the prompt field.\n" +
      "• Select the camera angle, shot size, and movement.\n" +
      "• Generate AI storyboard artwork for each frame.\n\n" +
      "**Reordering**\n" +
      "Drag frames to reorder the sequence. The storyboard order informs the suggested shot order in Production.\n\n" +
      "**Annotations**\n" +
      "Add text notes to individual frames for camera directions, actor blocking, or VFX callouts.\n\n" +
      "**Export**\n" +
      "Export the storyboard as a PDF contact sheet for offline review.",
  },
  {
    id: "voice-casting",
    title: "Voice Casting",
    context: ["pre-production"],
    category: "Pre-Production",
    content:
      "**Previewing Voices**\n" +
      "Select a character and browse available AI voice options. Click *Preview* to hear a sample line read in each voice.\n\n" +
      "**Voice Parameters**\n" +
      "• **Voice Description** — A text prompt guiding the voice synthesis.\n" +
      "• **Generation Seed** — A numeric seed for reproducible voice characteristics.\n\n" +
      "**Selecting a Voice**\n" +
      "Lock your chosen voice per character. The locked voice is used for all dialogue generation in Post-Production.\n\n" +
      "**Custom Voice Upload**\n" +
      "Upload a reference audio clip to clone a specific voice (subject to service provider capabilities).",
  },

  /* ═══════════════════════════════════════════
     PRODUCTION
     ═══════════════════════════════════════════ */
  {
    id: "prod-overview",
    title: "Production Phase Overview",
    context: ["production"],
    category: "Production",
    content:
      "Production is your virtual soundstage — a three-pane cinematic workspace.\n\n" +
      "**Left Pane — Scene Navigator**\n" +
      "Browse all scenes from the script breakdown. Each scene displays INT/EXT badges, time-of-day icons, and real-time shot counts. Click a scene to load it.\n\n" +
      "**Center Pane — Working Area**\n" +
      "Contains three sub-panels:\n" +
      "• **Script Workspace** — The scene's raw text. Highlight text to create new shot objects.\n" +
      "• **Shot Builder** — Configure the selected shot's prompt, camera angle, and generation settings.\n" +
      "• **Playback Monitor** — Preview generated imagery with a professional camera HUD overlay.\n\n" +
      "**Right Pane — Optics Suite**\n" +
      "The Master Control Deck for camera, lighting, and lens settings that apply to all generation.\n\n" +
      "**Workflow**\n" +
      "1. Select a scene from the navigator.\n" +
      "2. Highlight script text to create shots.\n" +
      "3. Configure each shot in the builder.\n" +
      "4. Set camera and lighting in the Optics Suite.\n" +
      "5. Generate takes and review in the monitor.\n" +
      "6. Rate and circle your best take.",
  },
  {
    id: "scene-navigator",
    title: "Scene Navigator",
    context: ["production"],
    category: "Production",
    content:
      "**Scene List**\n" +
      "All scenes from the locked script appear in order. Each card shows:\n" +
      "• Scene number and heading\n" +
      "• INT/EXT badge\n" +
      "• Time of day (DAY, NIGHT, DUSK, etc.)\n" +
      "• Shot count indicator\n\n" +
      "**Selecting a Scene**\n" +
      "Click a scene to load it into the center workspace. The script text, characters, and location data populate automatically.\n\n" +
      "**Resizing**\n" +
      "Drag the right edge of the navigator to resize its width. The width persists across sessions.\n\n" +
      "**Scene Status**\n" +
      "Scenes with completed shots show a filled indicator. Empty scenes show no count badge.",
  },
  {
    id: "script-workspace",
    title: "Script Workspace & Shot Creation",
    context: ["production"],
    category: "Production",
    content:
      "**Reading the Script**\n" +
      "The scene's raw text is displayed in a scrollable pane. Resize the pane height by dragging the bottom edge.\n\n" +
      "**Creating Shots**\n" +
      "Highlight any portion of the script text, then click *Create Shot*. A new shot object is created with the selected text as its prompt basis.\n\n" +
      "**Shot Objects**\n" +
      "Each shot contains:\n" +
      "• **Prompt text** — Describes what the AI should generate.\n" +
      "• **Camera angle** — Selected from presets or entered as a custom value.\n" +
      "• **Scene elements** — Auto-populated characters, location, props, and wardrobe.\n\n" +
      "**Editing Shots**\n" +
      "Select a shot from the Shot Stack (below the monitor) to load it into the Shot Builder for editing.",
  },
  {
    id: "shot-builder",
    title: "Shot Builder",
    context: ["production"],
    category: "Production",
    content:
      "**Prompt Text**\n" +
      "The main text field describing the shot. Be descriptive about composition, action, and mood. The prompt is combined with Optics Suite settings and AI Generation Notes for the final generation.\n\n" +
      "**Camera Angle**\n" +
      "Select from presets: Wide, Medium, Close-Up, Over-the-Shoulder, POV, Bird's Eye, Low Angle, Dutch Angle, and more — or type a custom angle description.\n\n" +
      "**Scene Elements**\n" +
      "Automatically populated from the parsed scene data:\n" +
      "• Location name\n" +
      "• Characters present\n" +
      "• Key props\n" +
      "• Wardrobe items\n\n" +
      "**Generation Controls**\n" +
      "• **Rehearsal** — Fast, low-quality preview generation for composition checks.\n" +
      "• **Roll Camera** — Full-quality generation that consumes credits.\n\n" +
      "Generated results appear in the Playback Monitor's Take Bin.",
  },
  {
    id: "playback-monitor",
    title: "Playback Monitor & Take Bin",
    context: ["production"],
    category: "Production",
    content:
      "**The Monitor**\n" +
      "A cinematic viewport displaying generated imagery with a professional camera HUD overlay showing aspect ratio, scene/shot information, and safe zones.\n\n" +
      "**Take Bin**\n" +
      "A 5-slot filmstrip below the monitor. Each generation fills the next empty slot.\n" +
      "• Click a take to preview it in the monitor.\n" +
      "• Rate takes 1–3 stars.\n" +
      "• Circle your preferred take (only one can be circled per shot).\n" +
      "• Delete takes to free slots for regeneration.\n\n" +
      "**Aspect Ratio**\n" +
      "The monitor respects the aspect ratio set in the Optics Suite (16:9, 2.39:1, etc.). A badge in the scene header shows the current ratio.\n\n" +
      "**Shot Stack**\n" +
      "Below the monitor, all shots for the current scene are listed. Click to select; use the *+* button to add new shots.",
  },
  {
    id: "optics-suite",
    title: "Optics Suite (Master Control Deck)",
    context: ["production"],
    category: "Production",
    content:
      "The right-side panel houses professional camera and lighting controls.\n\n" +
      "**Camera Settings**\n" +
      "• **Aspect Ratio** — 16:9, 2.39:1 (anamorphic), 4:3, 1:1, 9:16.\n" +
      "• **Shot Size** — Extreme Wide to Extreme Close-Up.\n" +
      "• **Camera Movement** — Static, Pan, Tilt, Dolly, Crane, Steadicam, Handheld.\n" +
      "• **Camera Height** — Ground level to overhead.\n\n" +
      "**Lens Settings**\n" +
      "• **Focal Length** — 14 mm ultra-wide to 200 mm telephoto.\n" +
      "• **Aperture (f-stop)** — Controls depth of field.\n" +
      "• **Focus Distance** — Near, mid, far, or rack focus.\n\n" +
      "**Lighting**\n" +
      "• **Key Light** — Direction, intensity, and color temperature.\n" +
      "• **Fill Light** — Ratio relative to key.\n" +
      "• **Backlight / Rim** — Edge separation control.\n" +
      "• **Practical Lights** — In-scene light sources.\n" +
      "• **Time of Day** — Affects natural lighting simulation.\n\n" +
      "**Presets**\n" +
      "Save and load custom preset combinations. Presets are version-specific.",
  },

  /* ═══════════════════════════════════════════
     POST-PRODUCTION
     ═══════════════════════════════════════════ */
  {
    id: "postprod-overview",
    title: "Post-Production Phase Overview",
    context: ["post-production"],
    category: "Post-Production",
    content:
      "Post-Production is your non-linear editing suite with a multi-track timeline, media bin, and specialized processing modules.\n\n" +
      "**Layout**\n" +
      "• **Left Panel** — Media Bin with all generated shots organized by scene, plus imported media tabs.\n" +
      "• **Center Top** — Playback monitor for previewing your edit.\n" +
      "• **Center Bottom** — Multi-track timeline with zoom, scrubber, and undo/redo.\n" +
      "• **Right Sidebar** — Processing modules: Sound, Color, Score, and FX.\n\n" +
      "**Getting Started**\n" +
      "1. Expand scene folders in the Media Bin to see your shots.\n" +
      "2. Drag shots onto video tracks in the timeline.\n" +
      "3. Arrange, trim, and layer clips.\n" +
      "4. Add audio, effects, and color grading from the right sidebar.\n" +
      "5. Use the **VFX Fix-It Bay** for targeted inpainting on video clips.",
  },
  {
    id: "timeline",
    title: "Timeline & Track Management",
    context: ["post-production"],
    category: "Post-Production",
    content:
      "**Tracks**\n" +
      "The timeline includes default tracks:\n" +
      "• **Video 1** (slate blue clips)\n" +
      "• **Dialogue** (dark teal)\n" +
      "• **Foley** (dark teal)\n" +
      "• **Effects** (deep purple)\n" +
      "• **Music** (dark teal)\n\n" +
      "**Adding & Removing Tracks**\n" +
      "Use the *Add Track* dropdown to add Video or Audio tracks. Delete tracks via the trash icon (hover to reveal). Deleting removes all clips on that track.\n\n" +
      "**Clip Operations**\n" +
      "• **Drag** — Move clips horizontally on a track or between tracks.\n" +
      "• **Trim** — Hover over clip edges to reveal trim handles; drag to adjust in/out points.\n" +
      "• **Double-click** — Opens the VFX Fix-It Bay for video clips.\n\n" +
      "**Zoom & Scrubber**\n" +
      "Use the zoom slider to scale the timeline view (25%–400%). Drag the scrubber/playhead to navigate to any point.\n\n" +
      "**Undo / Redo**\n" +
      "Up to 100 steps of undo history. Use **⌘Z** / **⌘⇧Z** or the toolbar buttons.\n\n" +
      "**FCPXML Export**\n" +
      "Export your timeline as [Final Cut Pro XML](https://support.apple.com/guide/final-cut-pro/intro-to-xml-vere731ed3d/mac) for finishing in professional NLE software.",
  },
  {
    id: "media-bin",
    title: "Media Bin & Shot Browser",
    context: ["post-production"],
    category: "Post-Production",
    content:
      "**Scene Folders**\n" +
      "Shots are organized into collapsible scene folders. Each folder shows the scene number and shot count. Click to expand and see thumbnails.\n\n" +
      "**Shot Thumbnails**\n" +
      "Each shot displays:\n" +
      "• Scene/Shot/Take label (e.g., *SC1 / SH2 / T1*)\n" +
      "• Video preview (if generated)\n" +
      "• Camera angle or prompt text\n\n" +
      "**Trim Before Placing**\n" +
      "Click a shot to select it and reveal trim handles on the thumbnail. Drag the left/right edges to set in/out points before dragging to the timeline.\n\n" +
      "**Dragging to Timeline**\n" +
      "Grab any shot and drop it onto a timeline track. A new clip is created at the drop position.\n\n" +
      "**Imported Media**\n" +
      "Files imported via the sidebar modules (Sound, Color, Score, FX) appear in categorized tabs below the shot browser.",
  },
  {
    id: "vfx-fix-it",
    title: "VFX Fix-It Bay",
    context: ["post-production"],
    category: "Post-Production",
    content:
      "**Accessing**\n" +
      "Double-click any video clip on the timeline to open the VFX Fix-It Bay modal.\n\n" +
      "**Manual Masking**\n" +
      "Use the brush tool to paint a red mask over the area you want to fix. Adjust brush size for precision.\n\n" +
      "**Surgical Prompt**\n" +
      "Type a description of what should replace the masked area (e.g., *remove boom mic from top of frame* or *replace background with sunset*).\n\n" +
      "**Lock Original**\n" +
      "Enable *Lock as reference* to keep the rest of the frame identical while only modifying the masked region.\n\n" +
      "**Processing**\n" +
      "Click *Apply Fix* to run AI inpainting. The result replaces the clip's content. You can undo to revert.\n\n" +
      "**Use Cases**\n" +
      "• Remove unwanted artifacts from AI generation.\n" +
      "• Fix continuity errors between shots.\n" +
      "• Add or modify set elements.\n" +
      "• Clean up edge artifacts.",
  },
  {
    id: "sound-module",
    title: "Sound Module (Audio / Foley / ADR)",
    context: ["post-production"],
    category: "Post-Production",
    content:
      "**Tri-State Modes**\n" +
      "• **Auto** — AI automatically generates ambient audio, foley, and dialogue based on scene analysis.\n" +
      "• **Templates** — Choose from preset sound design packages (Urban, Forest, Interior, Sci-Fi, etc.).\n" +
      "• **Custom** — Full manual control over every audio parameter.\n\n" +
      "**Importing Audio**\n" +
      "Click *Import* to add external audio files (*.wav*, *.mp3*, *.aiff*, *.flac*). Files appear in the Imported Media tab and can be dragged to audio tracks.\n\n" +
      "**Foley Generation**\n" +
      "AI generates footsteps, door sounds, and object interactions based on script action lines.\n\n" +
      "**ADR (Automated Dialogue Replacement)**\n" +
      "Regenerate character dialogue lines with your locked voice cast. Adjust timing and emotion.",
  },
  {
    id: "color-module",
    title: "Color Module (Grading & LUTs)",
    context: ["post-production"],
    category: "Post-Production",
    content:
      "**Tri-State Modes**\n" +
      "• **Auto** — AI applies a cohesive color grade based on mood and time of day.\n" +
      "• **Templates** — Industry-standard looks: Film Noir, Teal & Orange, Bleach Bypass, etc.\n" +
      "• **Custom** — Manual color wheel adjustments, curves, and LUT application.\n\n" +
      "**Supported LUT Formats**\n" +
      "• 3D LUTs: *.cube*, *.3dl*\n" +
      "• CDL: *.csp*\n" +
      "• ACES Look: *.look*\n" +
      "• CLF: *.clf*\n\n" +
      "**Importing LUTs**\n" +
      "Drag and drop or browse to import LUT files. They appear in the Color tab of Imported Media for easy application.\n\n" +
      "**Application**\n" +
      "Color grades apply globally or per-clip. Use the timeline selection to target specific clips.",
  },
  {
    id: "score-module",
    title: "Score Module (AI Composer)",
    context: ["post-production"],
    category: "Post-Production",
    content:
      "**AI Music Generation**\n" +
      "Describe the mood, tempo, and instrumentation for each scene. The AI composer generates original score cues.\n\n" +
      "**Tri-State Modes**\n" +
      "• **Auto** — AI scores the entire film based on emotional beats detected in the script.\n" +
      "• **Templates** — Pre-composed genre packages (Orchestral Drama, Electronic Thriller, Acoustic Indie).\n" +
      "• **Custom** — Specify BPM, key, instruments, and style per cue.\n\n" +
      "**Insert to Timeline**\n" +
      "Generated music clips can be inserted directly onto the Music track via the *Insert* button.\n\n" +
      "**Importing Music**\n" +
      "Import your own music files to use alongside or instead of AI-generated score.",
  },
  {
    id: "fx-module",
    title: "FX Module (Visual Effects)",
    context: ["post-production"],
    category: "Post-Production",
    content:
      "**Supported Formats**\n" +
      "Import visual effect elements:\n" +
      "• EXR sequences (multi-layer compositing)\n" +
      "• DPX film scans\n" +
      "• MOV overlays with alpha\n" +
      "• PNG sequences\n\n" +
      "**Tri-State Modes**\n" +
      "• **Auto** — AI applies effects identified during script analysis (fire, rain, explosions, etc.).\n" +
      "• **Templates** — Pre-built effect packages: Weather, Particles, Light Leaks, Lens Flares.\n" +
      "• **Custom** — Layer and composite imported VFX elements manually.\n\n" +
      "**VFX vs. Fix-It Bay**\n" +
      "The FX module is for *additive* effects (overlays, compositing). The VFX Fix-It Bay is for *corrective* work (inpainting, removal, replacement).",
  },

  /* ═══════════════════════════════════════════
     RELEASE
     ═══════════════════════════════════════════ */
  {
    id: "release-overview",
    title: "Release Phase Overview",
    context: ["release"],
    category: "Release",
    content:
      "The Release phase is your finishing and distribution hub. Export your film in any format, generate marketing materials, and package for festivals.\n\n" +
      "**Sections**\n" +
      "• **Export Master Film** — Primary export with Auto, Templates, and Custom encoding options.\n" +
      "• **Deliverables & Marketing** — Social cutdowns, posters, EPK, and trailer generation.\n" +
      "• **Distribution Packaging** — Festival bundles, ProRes masters, and direct platform uploads.\n" +
      "• **C2PA Provenance** — Cryptographic chain-of-title documentation.\n" +
      "• **Finished Exports** — Right sidebar listing all completed export files.\n\n" +
      "**Workflow**\n" +
      "1. Review format settings (shown in the spec bar).\n" +
      "2. Choose Auto, Template, or Custom export settings.\n" +
      "3. Click *Export* to generate the master file.\n" +
      "4. Generate marketing assets as needed.\n" +
      "5. Package for distribution or upload directly.\n" +
      "6. Generate C2PA ledger for legal provenance.",
  },
  {
    id: "export-master",
    title: "Export Settings (Auto / Templates / Custom)",
    context: ["release"],
    category: "Release",
    content:
      "**Auto Mode**\n" +
      "Displays all settings auto-configured from your Development format specifications:\n" +
      "• Codec, container, resolution, and frame rate\n" +
      "• Bitrate (calculated from resolution), encoding method\n" +
      "• Color space and pixel format\n" +
      "• Audio codec, bitrate, sample rate, and channels\n\n" +
      "**Templates Mode**\n" +
      "Quick-select optimized presets:\n" +
      "• **YouTube 4K** — H.264 High, 3840×2160, 40 Mbps\n" +
      "• **Netflix ProRes** — ProRes 422 HQ, 1920×1080\n" +
      "• **Theater DCP** — JPEG2000 in MXF container\n" +
      "• *Topaz 4K Upscale* toggle — AI upscaling to 4K from lower resolutions.\n\n" +
      "**Custom Mode**\n" +
      "Full manual control over every encoding parameter:\n" +
      "• **Video:** Codec (H.264, H.265, ProRes 422/4444, DNxHD, VP9, AV1), Container (.mp4, .mov, .mkv, .mxf, .avi, .webm)\n" +
      "• Bitrate slider (1–200 Mbps), width, height, and FPS\n" +
      "• Color space (Rec. 709, Rec. 2020, DCI-P3, sRGB, ACES CG)\n" +
      "• Pixel format (yuv420p through rgb48)\n" +
      "• 2-pass encode and deinterlace toggles\n" +
      "• **Audio:** Codec (AAC, PCM, FLAC, AC3, EAC3, Opus), bitrate, and sample rate",
  },
  {
    id: "deliverables",
    title: "Marketing & Deliverables",
    context: ["release"],
    category: "Release",
    content:
      "**Multi-Ratio Social Masters**\n" +
      "Automatically reframe your 16:9 master into 9:16 (Stories/Reels), 1:1 (Posts), and 4:5 (Feed) using AI object tracking to keep subjects centered.\n\n" +
      "**Poster & EPK**\n" +
      "Generate a 27×40-inch theatrical poster and an Electronic Press Kit including:\n" +
      "• Key art variations\n" +
      "• Behind-the-scenes stills\n" +
      "• Synopsis and credits sheet\n" +
      "• Technical specifications document\n\n" +
      "**Trailer Engine**\n" +
      "AI cuts a 60-second trailer by identifying high-action and emotional beats from your timeline. Includes auto-generated title cards and music.",
  },
  {
    id: "distribution",
    title: "Distribution & Direct Upload",
    context: ["release"],
    category: "Release",
    content:
      "**Festival Package**\n" +
      "One-click export of a complete festival submission bundle:\n" +
      "• Screener file (watermarked)\n" +
      "• Poster and key art\n" +
      "• Script PDF\n" +
      "• Synopsis and director's statement\n\n" +
      "Packaged as a single ZIP for [FilmFreeway](https://filmfreeway.com/) or Withoutabox upload.\n\n" +
      "**ProRes 422 HQ Export**\n" +
      "Broadcast-quality master in Apple ProRes 422 HQ codec — required by many distributors and post houses.\n\n" +
      "**Direct Platform Upload**\n" +
      "One-click authenticated upload to:\n" +
      "• **YouTube** — Uploads with metadata, thumbnail, and privacy settings.\n" +
      "• **Vimeo** — Staff-pick quality, review link generation.\n" +
      "• **TikTok** — Auto-formatted for vertical video.\n\n" +
      "*Note:* Platform uploads require OAuth connection via **Settings → Integrations**.",
  },
  {
    id: "c2pa-provenance",
    title: "C2PA Chain-of-Title & Provenance",
    context: ["release"],
    category: "Release",
    content:
      "**What Is C2PA?**\n" +
      "The [Coalition for Content Provenance and Authenticity (C2PA)](https://c2pa.org/) standard provides cryptographic proof of content origin and editing history.\n\n" +
      "**What's Included**\n" +
      "The generated ledger PDF contains:\n" +
      "• Director/Producer identification\n" +
      "• Production entity and copyright notice\n" +
      "• Cryptographic hash of the master file\n" +
      "• Per-frame provenance claims\n" +
      "• AI service API licenses and usage timestamps\n" +
      "• Complete editing history chain\n" +
      "• Digital signature and verification QR code\n\n" +
      "**Why It Matters**\n" +
      "For AI-generated content, C2PA provenance:\n" +
      "• Establishes legal authorship and copyright claims.\n" +
      "• Documents that all AI usage was properly licensed.\n" +
      "• Provides a verifiable chain of custody for distributors.\n" +
      "• Meets emerging regulatory requirements for AI-generated media.\n\n" +
      "**Generating the Ledger**\n" +
      "Click *Generate C2PA Ledger PDF* to compile all provenance data into a signed document.",
  },
  {
    id: "finished-exports",
    title: "Finished Exports Panel",
    context: ["release"],
    category: "Release",
    content:
      "**Location**\n" +
      "The right sidebar of the Release page lists all completed export files.\n\n" +
      "**File Information**\n" +
      "Each entry shows:\n" +
      "• Export type icon and label\n" +
      "• File name\n" +
      "• Timestamp of completion\n\n" +
      "**Re-downloading**\n" +
      "Hover over any export entry to reveal the download button. Click to re-download the file.\n\n" +
      "**Clearing History**\n" +
      "Use *Clear All* at the bottom to remove all export entries. This only clears the list display — already-downloaded files remain on your device.\n\n" +
      "**Session Scope**\n" +
      "Export history is maintained for the current session. Refreshing the page resets the list.",
  },
];

/* ── Context for route-awareness ── */
interface HelpContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  openArticle: (articleId: string) => void;
  pendingArticleId: string | null;
  clearPendingArticle: () => void;
}

const HelpContext = createContext<HelpContextType>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
  openArticle: () => {},
  pendingArticleId: null,
  clearPendingArticle: () => {},
});

export const useHelp = () => useContext(HelpContext);

export const HelpProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingArticleId, setPendingArticleId] = useState<string | null>(null);
  return (
    <HelpContext.Provider
      value={{
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen((p) => !p),
        openArticle: (id: string) => {
          setPendingArticleId(id);
          setIsOpen(true);
        },
        pendingArticleId,
        clearPendingArticle: () => setPendingArticleId(null),
      }}
    >
      {children}
    </HelpContext.Provider>
  );
};


export type { HelpArticle };

/* ── Help Panel Component ── */
const HelpPanel = () => {
  const { isOpen, close, pendingArticleId, clearPendingArticle } = useHelp();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);

  // Auto-select article when opened via contextual help
  useEffect(() => {
    if (pendingArticleId && isOpen) {
      const found = HELP_ARTICLES.find((a) => a.id === pendingArticleId);
      if (found) {
        setSelectedArticle(found);
      }
      clearPendingArticle();
    }
  }, [pendingArticleId, isOpen, clearPendingArticle]);

  const routeKeywords = location.pathname
    .split("/")
    .filter(Boolean)
    .map((s) => s.toLowerCase());

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
                {renderContent(selectedArticle.content)}
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
                              {a.content.replace(/\*\*/g, "").replace(/\*/g, "").slice(0, 80)}…
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
                              {a.content.replace(/\*\*/g, "").replace(/\*/g, "").slice(0, 80)}…
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
