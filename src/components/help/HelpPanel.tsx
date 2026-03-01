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
      "1. **Development** — Upload and analyze your screenplay across three gated tabs: Fundamentals, Vision, and Scene Breakdown.\n" +
      "2. **Pre-Production** — Audition actors, design locations, select wardrobe and props, build storyboards, and cast voices.\n" +
      "3. **Production** — Build shots scene by scene with camera, lighting, and lens controls, then generate imagery via the VICE continuity engine.\n" +
      "4. **Post-Production** — Arrange clips on a multi-track timeline; use the VFX Fix-It Bay, Style Drift Detector, and Localization Suite.\n" +
      "5. **Release** — Export masters, run Topaz DI upscaling, generate marketing assets, and produce C2PA provenance documentation.\n\n" +
      "**Tips**\n" +
      "• Work through the phases in order — each phase builds on locked assets from the previous one.\n" +
      "• Right-click any element with a help badge to see a contextual tooltip and link to the full article.\n" +
      "• Use the **Help** panel (?) on any page for context-specific guidance.\n" +
      "• Credits are consumed by AI generation tasks. Monitor your balance in the header credit meter.",
  },
  {
    id: "versions",
    title: "Managing Versions",
    context: ["projects", "versions"],
    category: "General",
    content:
      "Versions let you branch and iterate without losing previous work.\n\n" +
      "**Creating Versions**\n" +
      "From the project's version list, click *New Version* or duplicate an existing one. Duplicating copies all characters, shots, analysis data, style contracts, and timeline clips.\n\n" +
      "**Version Names**\n" +
      "Each version has a unique name within its project (e.g., *Director's Cut*, *Festival Edit*). Rename by clicking the version name on its card.\n\n" +
      "**Archiving and Deleting**\n" +
      "Archive versions you are not actively editing — they are hidden from the main list but can be restored at any time. Deleting permanently removes all associated data.\n\n" +
      "**Version Settings**\n" +
      "Access per-version settings (format, integrations, provider selections) from the Settings icon on each version card or via the sidebar *Settings* link.\n\n" +
      "**Buttons & Controls**\n" +
      "• *New Version* — Creates a blank version within the current project.\n" +
      "• *Duplicate* (clone icon) — Deep-copies all data from the selected version into a new one.\n" +
      "• *Archive* (archive icon) — Hides the version from the main list; retrievable via the Archived filter.\n" +
      "• *Delete* (trash icon) — Permanently removes the version and all its data. Cannot be undone.",
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
      "• **Script Analysis** — AI services for screenplay parsing and scene enrichment.\n" +
      "• **Image Generation** — Services for headshots, storyboards, and shot generation.\n" +
      "• **Video Generation** — AI video synthesis for takes and animations.\n" +
      "• **Audio & Voice** — Text-to-speech, voice cloning, and sound effect generation.\n\n" +
      "**Adding API Keys**\n" +
      "Click on an integration provider, paste your API key, and verify the connection. Keys are encrypted and stored securely.\n\n" +
      "**Provider Selection**\n" +
      "When multiple providers are available for a section, select your preferred default. This choice is version-specific, so different versions can use different services.\n\n" +
      "**Buttons & Controls**\n" +
      "• *Add Key* — Opens a secure input field to paste and verify an API key.\n" +
      "• *Verify* — Tests the connection against the provider's API.\n" +
      "• *Set Default* — Marks this provider as the active choice for its section.\n" +
      "• *Remove* — Deletes the stored API key (requires confirmation).\n\n" +
      "**Media Library**\n" +
      "Access all generated and imported assets organized by project, version, and sub-category. Bulk-select at the folder level for batch operations. Each media item includes a context link that navigates directly to the relevant phase.\n\n" +
      "**Exports Panel**\n" +
      "Download a comprehensive Instructions & Help Guide text file, or use the in-app searchable editor to modify help articles inline.",
  },

  /* ═══════════════════════════════════════════
     DEVELOPMENT — FUNDAMENTALS
     ═══════════════════════════════════════════ */
  {
    id: "dev-overview",
    title: "Development Phase Overview",
    context: ["development"],
    category: "Development",
    content:
      "The Development phase is where your project takes shape, organized into **three gated tabs**:\n\n" +
      "**Tab 1 — Fundamentals**\n" +
      "Define the film's metadata, upload the screenplay, run AI analysis, set format specifications, and configure time period and genre. Once everything is reviewed, click *Lock Fundamentals* to proceed.\n\n" +
      "**Tab 2 — Vision**\n" +
      "Unlocked after Fundamentals are locked. Review Global Elements (auto-grouped characters, props, locations), approve Ratings Classification, analyze Director's Vision, and generate the Production Bible. Lock Vision to proceed.\n\n" +
      "**Tab 3 — Scene Breakdown**\n" +
      "Unlocked after Vision is locked. Browse every scene with enriched metadata: characters, locations, props, wardrobe, mood, visual design, cinematic elements, VFX, SFX, and more. Edit any field inline.\n\n" +
      "**Gating Rules**\n" +
      "• Vision tab is disabled until Fundamentals are locked.\n" +
      "• Scene Breakdown tab is disabled until Vision is locked.\n" +
      "• Locking is permanent per version — to iterate, create a new version.\n\n" +
      "**Key Buttons**\n" +
      "• *Save Details* — Saves title, version name, and writers to the database.\n" +
      "• *Analyze Script* — Runs multi-pass AI analysis on the uploaded screenplay.\n" +
      "• *Lock Fundamentals* — Freezes all Fundamentals data and unlocks the Vision tab.\n" +
      "• *Lock Vision* — Freezes Vision data and unlocks Scene Breakdown. Only enabled when Global Elements, Ratings, Director's Vision, and Production Bible are all approved.",
  },
  {
    id: "upload-script",
    title: "Uploading & Analyzing a Screenplay",
    context: ["development"],
    category: "Development",
    content:
      "**Supported Formats**\n" +
      "• **Final Draft (.fdx)** — Industry standard; preserves scene headings and character cues.\n" +
      "• **Plain Text (.txt)** — Should follow standard screenplay formatting conventions.\n" +
      "• **PDF (.pdf)** — Position-aware classification preserves original line breaks and indentation.\n\n" +
      "**How to Upload**\n" +
      "1. Navigate to Development → Fundamentals tab.\n" +
      "2. Open the *Script* collapsible section.\n" +
      "3. Drag and drop your file, or click to browse.\n" +
      "4. The file name and size will appear, confirming the upload.\n\n" +
      "**Buttons**\n" +
      "• *Upload* — Selects a file from your device.\n" +
      "• *Analyze Script* — Triggers multi-pass AI analysis (scene parsing → enrichment → global analysis).\n" +
      "• *View Script* — Opens a floating, draggable script viewer showing the raw screenplay text.\n" +
      "• *Re-analyze* — Clears previous analysis and runs again from scratch.\n\n" +
      "**Analysis Progress**\n" +
      "During analysis, a scrolling scene list shows each scene being processed in real time with a pulsing animation. The progress bar stays at 29% until the finalization step explicitly marks analysis as complete.\n\n" +
      "**Re-uploading**\n" +
      "You can upload a new script at any time before locking Fundamentals. This replaces the previous upload and all analysis data.",
  },
  {
    id: "script-analysis",
    title: "Script Analysis Engine",
    context: ["development"],
    category: "Development",
    content:
      "After uploading, the AI performs a comprehensive multi-pass analysis:\n\n" +
      "**Pass 1 — Scene Parsing**\n" +
      "Extracts individual scenes with headings (INT/EXT, location, time of day), character appearances, dialogue blocks, and action lines. Uses a state-machine classifier that identifies Scene Headings, Transitions, Characters, Parentheticals, Dialogue, and Action lines.\n\n" +
      "**Pass 2 — Scene Enrichment**\n" +
      "For each scene, the AI identifies: key objects and props, wardrobe descriptions, mood and tone, sound cues, VFX requirements, stunts, picture vehicles, animals, extras, visual design (color palette, lighting style, camera suggestions), and cinematic elements.\n\n" +
      "**Pass 3 — Global Analysis & Finalization**\n" +
      "Cross-references all scenes to produce: character arc summaries, location frequency, global themes, visual motifs, and content safety recommendations. The finalize step transitions status to 'complete'.\n\n" +
      "**Retry System**\n" +
      "Each scene enrichment uses a robust retry system (up to 4 retries with 3-second delay) to handle transient API errors. Unenriched scenes fall back to regex-based extraction for characters (ALL-CAPS cues) and locations (headings).\n\n" +
      "**Reviewing Results**\n" +
      "Each scene card in the Scene Breakdown tab displays extracted data. Click to expand details. All fields are editable inline. The parsed_scenes table is the single source of truth — edits persist and are never overwritten.",
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
      "**Buttons**\n" +
      "• *Preset dropdown* — Select from industry-standard format presets.\n" +
      "• *4K toggle* — Doubles the selected preset's resolution.\n" +
      "• *Save Format* — Persists the current format settings to the database. Turns green and shows 'Saved' on success.\n\n" +
      "**Impact**\n" +
      "These settings flow into Production (shot generation dimensions), Post-Production (timeline frame rate), and Release (export defaults).",
  },
  {
    id: "content-safety",
    title: "Ratings Classification (Content Safety)",
    context: ["development"],
    category: "Development",
    content:
      "Content safety flags inform AI generation boundaries for your project. Located in the Vision tab.\n\n" +
      "**Auto Mode (MPAA)**\n" +
      "The AI scans all scenes against MPAA guidelines and recommends ratings. During analysis, a scrolling list shows every scene being scanned in real time.\n\n" +
      "**Flags**\n" +
      "• **Violence** — Controls depiction of physical conflict, blood, and weapons.\n" +
      "• **Nudity** — Controls exposure levels in character generation.\n" +
      "• **Language** — Controls profanity and mature dialogue in voice generation.\n\n" +
      "**Modes**\n" +
      "• **Auto** — AI determines appropriate levels from script context and displays MPAA-style rating with justification.\n" +
      "• **Templates** — Pre-configured safety profiles (G, PG, PG-13, R, NC-17).\n" +
      "• **Custom** — Explicitly toggle each flag on or off.\n\n" +
      "**Buttons**\n" +
      "• *Re-analyze* — Clears current ratings and re-runs the AI content scanner.\n" +
      "• *Approve* — Signs off on the current ratings. Turns green and shows 'Approved' when confirmed.\n" +
      "• Flag toggles — Click each flag chip (Violence / Nudity / Language) to enable or disable.\n\n" +
      "**How It Works**\n" +
      "When enabled, safety flags are injected into all downstream generation prompts as negative constraints, preventing the AI from producing content outside your boundaries.",
  },
  {
    id: "global-elements",
    title: "Global Elements Manager",
    context: ["development"],
    category: "Development",
    content:
      "Located in the Vision tab, Global Elements displays all cross-cutting story elements extracted from the screenplay, organized by category.\n\n" +
      "**Categories**\n" +
      "• **Characters** — Auto-grouped by canonical name. Aliases, title variants, and name fragments are merged into single character groups.\n" +
      "• **Locations** — Extracted from scene headings. Related locations are auto-grouped (e.g., 'Wells' Home — Kitchen' groups under 'Wells' Home').\n" +
      "• **Props** — Auto-grouped by character ownership (e.g., 'Rachel's Phone' groups under Rachel) or by location co-occurrence.\n" +
      "• **Wardrobe** — Costume descriptions linked to characters.\n" +
      "• **Vehicles** — Picture vehicles identified in the script.\n\n" +
      "**Interactions**\n" +
      "• *Single click* — Selects an item (blue highlight).\n" +
      "• *Double click* — Enters inline rename mode. Press Enter to save. The rename propagates across all database tables.\n" +
      "• *Multi-select* (click multiple items) — Enables the merge bar.\n" +
      "• *Drag and drop* — Reorder items within groups or move items between groups.\n\n" +
      "**Buttons**\n" +
      "• *Link Together* — Merges selected items into a group with a shared parent name.\n" +
      "• *Unlink* — Removes an item from its group back to ungrouped.\n" +
      "• *Add custom item* (+) — Creates a new element in the selected category.\n" +
      "• *Still Needs Review* (amber) — Marks the category as needing attention.\n" +
      "• *Approve* — Signs off on the category. Turns green and shows 'Approved' with a checkmark.\n\n" +
      "**Auto-Grouping Logic**\n" +
      "Characters are canonicalized by stripping metadata (titles, ages, descriptions) and merging name variants. Props are auto-assigned to characters via explicit ownership detection (e.g., 'Rachel's Phone') or scene co-occurrence (≥2 shared scenes or ≥34% overlap).",
  },
  {
    id: "director-vision",
    title: "Director's Vision",
    context: ["development"],
    category: "Development",
    content:
      "Located in the Vision tab. The Director's Vision uses a neural style engine to analyze your script's tone, pacing, and visual density, then matches against iconic director profiles.\n\n" +
      "**What It Produces**\n" +
      "• **Primary Director Match** — The closest directorial style to your screenplay.\n" +
      "• **Secondary Director** — An optional blend influence.\n" +
      "• **Blend Weight** — How much the secondary director influences the final style (0–100%).\n" +
      "• **Visual DNA** — A concise description of the film's visual identity.\n" +
      "• **Style Quadrant** — Classifies the style on axes of naturalism vs. stylization, restraint vs. expressiveness.\n" +
      "• **Visual Mandate** — Detailed camera, lighting, color, and texture directives.\n\n" +
      "**Buttons**\n" +
      "• *Analyze Style* — Runs the director-fit AI analysis. Displays a loading animation showing the neural style engine at work.\n" +
      "• *Approve* — Locks the director profile. Turns green and shows 'Approved'.\n" +
      "• *Re-analyze* — Clears and re-runs the style analysis.\n\n" +
      "**Impact**\n" +
      "The locked Director's Vision generates the **Style Contract** — a comprehensive document that governs all downstream AI generation (color mandates, lens philosophy, lighting doctrine, texture rules).",
  },
  {
    id: "production-bible",
    title: "Production Bible",
    context: ["development"],
    category: "Development",
    content:
      "Located in the Vision tab, rendered immediately after the Director's Vision is confirmed.\n\n" +
      "**What It Contains**\n" +
      "The Production Bible is an AI-generated reference document compiling:\n" +
      "• Film overview and creative direction\n" +
      "• Character summaries and relationships\n" +
      "• Location breakdowns\n" +
      "• Visual style mandates from the Director's Vision\n" +
      "• Scene-by-scene production notes\n" +
      "• Sound and lighting rules\n\n" +
      "**Buttons**\n" +
      "• *Generate Production Bible* — Creates or regenerates the bible from current film data.\n" +
      "• *Download PDF* — Exports the production bible as a formatted PDF document.\n" +
      "• *Approve* — Signs off on the bible content. Required before Vision can be locked.\n\n" +
      "**Vision Propagation Pipeline**\n" +
      "When Vision is locked, an automated pipeline enriches every scene with Production Bible details. The UI displays real-time progress listing recently processed scenes, and automatically navigates to the Scene Breakdown tab upon completion.",
  },
  {
    id: "scene-breakdown",
    title: "Scene Breakdown Tab",
    context: ["development"],
    category: "Development",
    content:
      "The third tab in Development, unlocked after Vision is locked.\n\n" +
      "**Scene Cards**\n" +
      "Each scene displays a comprehensive breakdown:\n" +
      "• **Heading** — INT/EXT, location, time of day.\n" +
      "• **Characters** — Who appears in the scene.\n" +
      "• **Mood** — Emotional tone detected by AI.\n" +
      "• **Key Objects** — Important props.\n" +
      "• **Wardrobe** — Character costumes.\n" +
      "• **Visual Design** — Color palette, lighting style, camera suggestions, weather, and texture.\n" +
      "• **Cinematic Elements** — Shot suggestions, transitions, and pacing notes.\n" +
      "• **VFX / SFX** — Visual and sound effects requirements.\n" +
      "• **Stunts, Animals, Vehicles** — Special requirements.\n\n" +
      "**Editing**\n" +
      "All fields are editable inline. Changes save directly to the parsed_scenes table (single source of truth). Visual design fields are populated via AI enrichment that infers details from scene mood and context.\n\n" +
      "**Buttons**\n" +
      "• *Expand/Collapse* — Toggle scene detail view.\n" +
      "• *Edit* (pencil icon) — Enter edit mode for any field.\n" +
      "• Scene number navigation — Jump to specific scenes.",
  },
  {
    id: "visual-summary",
    title: "Visual Summary & AI Generation Notes",
    context: ["development"],
    category: "Development",
    content:
      "**Visual Summary**\n" +
      "Located in the Fundamentals tab. An AI-generated interpretation of the script's visual style, tone, and cinematic identity. Provides a high-level creative brief for the entire film.\n\n" +
      "**Buttons**\n" +
      "• *Approve* — Signs off on the visual summary. Turns green when confirmed.\n" +
      "• *Edit* — Modify the AI-generated summary text.\n\n" +
      "**AI Generation Notes**\n" +
      "Director's notes that are prepended to every AI generation prompt throughout the pipeline. Use them to establish:\n" +
      "• Visual style references (e.g., *inspired by Roger Deakins' cinematography*)\n" +
      "• Color palette preferences\n" +
      "• Mood and atmosphere direction\n" +
      "• Overarching creative constraints\n\n" +
      "**Buttons**\n" +
      "• *Approve Notes* — Accept the AI-suggested generation notes.\n" +
      "• *Edit* — Write or modify your own notes.\n" +
      "• *Reset* — Revert to AI-generated suggestions.\n\n" +
      "These notes are version-specific and influence all downstream generation.",
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
      "**Tabs**\n" +
      "• **Actors** — Audition AI-generated headshots, generate consistency views, and lock your cast.\n" +
      "• **Locations** — Design and approve location concepts with AI-generated artwork.\n" +
      "• **Props** — Browse, generate, and lock key objects identified from the script.\n" +
      "• **Wardrobe** — Manage costume designs with per-scene assignments and fitting views.\n" +
      "• **Vehicles** — Design picture vehicles for visual consistency.\n" +
      "• **Storyboards** — Build shot-by-shot visual sequences per scene.\n" +
      "• **Voice Casting** — Preview and select AI voice options per character.\n\n" +
      "**Tab Status Indicators**\n" +
      "Each tab shows a colored dot:\n" +
      "• 🔴 Red — No assets generated yet.\n" +
      "• 🟡 Amber — Assets generated but none approved/locked.\n" +
      "• 🟢 Green — At least one asset approved or locked.\n\n" +
      "**Workflow**\n" +
      "1. Start with **Actors** — generate audition options, rate, rank, and lock your cast.\n" +
      "2. Move to **Locations** and **Props** to establish the visual world.\n" +
      "3. Design **Wardrobe** with character-linked fittings.\n" +
      "4. Build **Storyboards** to plan shot composition.\n" +
      "5. Cast **Voices** for dialogue generation.\n\n" +
      "**Locking Assets**\n" +
      "Locked assets become the reference identity used in Production. Changes after locking require regeneration of dependent shots.",
  },
  {
    id: "characters",
    title: "Actor Casting & Auditions",
    context: ["pre-production"],
    category: "Pre-Production",
    content:
      "**Character Sidebar**\n" +
      "Lists all characters extracted from the script. Click a character to load their audition workspace. Shows approval status and headshot thumbnail.\n\n" +
      "**Buttons**\n" +
      "• *Casting Call* — Generates 10 AI headshot candidates across multiple sections (Close-up, Profile, Full Body). Shows 'Casting…' while generating.\n" +
      "• *Recast* — Regenerates headshot options for a character who already has candidates.\n" +
      "• *Upload Reference* — Upload your own reference photo instead of AI generation. The system analyzes the image for context.\n" +
      "• *Cast This Actor* — Locks a specific headshot as the character's canonical identity. The button turns green when active.\n" +
      "• *Consistency Views* — Generates the locked character from multiple angles (front, 3/4, profile, back) for reference.\n" +
      "• *Suggest Casting* (in sidebar) — Auto-selects the character and triggers a Casting Call.\n\n" +
      "**Audition Cards**\n" +
      "• Rate each headshot 1–3 stars by clicking star icons.\n" +
      "• Drag cards to reorder within sections.\n" +
      "• Lock icon indicates the cast selection.\n\n" +
      "**Character Details**\n" +
      "Edit name, description, age range (min/max), sex, height, build, and voice description. Toggle *Is Child* for age-appropriate generation. Changes to locked characters flag them for regeneration.\n\n" +
      "**Reference Images**\n" +
      "Upload your own reference photo as an alternative to AI generation. The system runs an analysis on the uploaded image and incorporates it into the character's visual identity.",
  },
  {
    id: "locations-props",
    title: "Locations, Props, Wardrobe & Vehicles",
    context: ["pre-production"],
    category: "Pre-Production",
    content:
      "**Locations Tab**\n" +
      "Locations are extracted from script scene headings and auto-grouped by the Global Elements Manager. For each location:\n" +
      "• Generate AI concept art options (3 variations per generation).\n" +
      "• Rate and select your preferred design.\n" +
      "• Lock the chosen concept as the canonical location reference.\n" +
      "• View the location description extracted from the first action block following the scene heading.\n\n" +
      "**Props Tab**\n" +
      "Props identified during script analysis appear in a categorized list. Auto-grouped by character ownership or location co-occurrence.\n" +
      "• Generate visual options for critical props.\n" +
      "• Lock your selections for downstream consistency.\n\n" +
      "**Wardrobe Tab**\n" +
      "Wardrobe items are linked to specific characters. Each entry includes:\n" +
      "• A description extracted from the script.\n" +
      "• AI-generated costume concept options.\n" +
      "• Per-scene assignment controls — toggle which scenes each item is worn in.\n" +
      "• Fitting views — multi-angle renders of the costume on the character.\n" +
      "• Lock status for downstream consistency.\n\n" +
      "**Vehicles Tab**\n" +
      "Picture vehicles identified from the script. Generate and lock visual references.\n\n" +
      "**Common Buttons**\n" +
      "• *Generate Options* — Creates 3 AI concept variations.\n" +
      "• *Lock* (lock icon) — Locks the selected option as canonical reference.\n" +
      "• *Unlock* — Reverts a locked asset to allow re-selection.\n" +
      "• *Group/Ungroup* — Organize related items into groups via drag and drop.\n\n" +
      "**Asset Identity Registry**\n" +
      "All locked assets are registered with internal reference codes ensuring consistent visual identity across all generation tasks.",
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
      "**Buttons**\n" +
      "• *Add Frame* (+) — Creates a new empty storyboard frame.\n" +
      "• *Generate* — Creates AI artwork for the selected frame.\n" +
      "• *Delete* (trash) — Removes a frame from the sequence.\n" +
      "• *Reorder* — Drag frames to change sequence order.\n\n" +
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
      "• **Generation Seed** — A numeric seed for reproducible voice characteristics.\n" +
      "• **Sample Text** — The dialogue line used for audition previews.\n\n" +
      "**Buttons**\n" +
      "• *Audition Voices* — Generates multiple AI voice samples for the character.\n" +
      "• *Preview* (play icon) — Plays the voice sample audio.\n" +
      "• *Select* — Locks the chosen voice per character for all dialogue generation.\n" +
      "• *Upload Reference* — Upload a reference audio clip to clone a specific voice.\n\n" +
      "**Impact**\n" +
      "The locked voice is used for all dialogue generation in Post-Production and any voice-over work.",
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
      "Production is your virtual soundstage — a multi-pane cinematic workspace.\n\n" +
      "**Left Pane — Scene Navigator**\n" +
      "Browse all scenes from the script breakdown. Each scene displays INT/EXT badges, time-of-day icons, and real-time shot counts. Click a scene to load it.\n\n" +
      "**Center Pane — Working Area**\n" +
      "Contains sub-panels:\n" +
      "• **Script Workspace** — The scene's raw text with syntax highlighting. Highlight text to create new shot objects.\n" +
      "• **Optics Suite** — Camera, lighting, and lens master controls.\n" +
      "• **Shot Builder** — Configure the selected shot's prompt, camera angle, and generation settings.\n" +
      "• **Playback Monitor** — Preview generated imagery with a professional camera HUD overlay.\n" +
      "• **Shot List** — All shots for the current scene with status and generation controls.\n\n" +
      "**VICE System**\n" +
      "The Visual Integrity & Continuity Engine monitors all shots for visual consistency conflicts across scenes. Shows dependency graphs and dirty-queue management.\n\n" +
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
      "• INT/EXT badge with color coding\n" +
      "• Time of day (DAY, NIGHT, DUSK, etc.)\n" +
      "• Shot count indicator\n\n" +
      "**Interactions**\n" +
      "• *Click* — Loads the scene into the center workspace.\n" +
      "• *Drag edge* — Resize the navigator width (persists across sessions).\n\n" +
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
      "The scene's raw text is displayed with syntax-aware formatting. Character names, dialogue, and action lines are visually distinct.\n\n" +
      "**Creating Shots**\n" +
      "Highlight any portion of the script text, then click *Create Shot*. A new shot object is created with the selected text as its prompt basis.\n\n" +
      "**Shot Objects**\n" +
      "Each shot contains:\n" +
      "• **Prompt text** — Describes what the AI should generate.\n" +
      "• **Camera angle** — Selected from presets or entered as a custom value.\n" +
      "• **Anchor text** — The script passage this shot is based on.\n\n" +
      "**Buttons**\n" +
      "• *Create Shot* — Appears after text selection. Creates a shot from the highlighted text.\n" +
      "• *View Script* — Opens the draggable script viewer popup.\n" +
      "• *Anchor Picker* — Select or change which script passage a shot references.",
  },
  {
    id: "shot-builder",
    title: "Shot Builder & Generation",
    context: ["production"],
    category: "Production",
    content:
      "**Prompt Text**\n" +
      "The main text field describing the shot. Be descriptive about composition, action, and mood. The prompt is combined with Optics Suite settings and the Style Contract for final generation.\n\n" +
      "**Camera Angle**\n" +
      "Select from presets: Wide, Medium, Close-Up, Over-the-Shoulder, POV, Bird's Eye, Low Angle, Dutch Angle, and more — or type a custom angle description.\n\n" +
      "**Buttons**\n" +
      "• *Rehearsal* — Fast, low-quality preview generation for composition checks. Uses fewer credits.\n" +
      "• *Roll Camera* — Full-quality generation that consumes standard credits.\n" +
      "• *Delete Shot* (trash) — Removes the shot and all its takes.\n" +
      "• *Diff Overlay* — Compare two takes side-by-side to spot differences.\n\n" +
      "**Shot Description Pane**\n" +
      "Below the shot builder, shows auto-populated scene elements: location, characters present, key props, and wardrobe items. These inform the generation prompt automatically.\n\n" +
      "**Generation Results**\n" +
      "Generated takes appear in the Playback Monitor's Take Bin (5 slots per shot).",
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
      "• *Click a take* — Preview it in the monitor.\n" +
      "• *Star rating* — Rate takes 1–3 stars.\n" +
      "• *Circle* (check icon) — Mark your preferred take (only one per shot).\n" +
      "• *Delete* (X) — Remove a take to free the slot.\n\n" +
      "**Aspect Ratio**\n" +
      "The monitor respects the aspect ratio set in the Optics Suite. A badge in the scene header shows the current ratio.\n\n" +
      "**Shot Stack**\n" +
      "Below the monitor, all shots for the current scene are listed as color-coded chips. Click to select; use the *+* button to add new shots.",
  },
  {
    id: "optics-suite",
    title: "Optics Suite (Master Control Deck)",
    context: ["production"],
    category: "Production",
    content:
      "The Optics Suite houses professional camera and lighting controls that apply to all generation.\n\n" +
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
      "**Buttons**\n" +
      "• *Save Preset* — Save the current settings combination as a named preset.\n" +
      "• *Load Preset* — Apply a previously saved preset.\n" +
      "• *Reset* — Return all settings to defaults.\n\n" +
      "**Presets**\n" +
      "Save and load custom preset combinations. Presets are version-specific.",
  },
  {
    id: "vice",
    title: "VICE — Visual Integrity & Continuity Engine",
    context: ["production"],
    category: "Production",
    content:
      "**What Is VICE?**\n" +
      "The Visual Integrity & Continuity Engine monitors all shots across your film for visual consistency conflicts — wardrobe changes between scenes, prop mismatches, lighting discontinuities, and character appearance drift.\n\n" +
      "**VICE Panel**\n" +
      "Shows detected conflicts with severity levels:\n" +
      "• 🔴 Critical — Visible continuity break that audiences would notice.\n" +
      "• 🟡 Warning — Potential issue worth reviewing.\n" +
      "• 🟢 Clear — No conflicts detected.\n\n" +
      "**Dependency Graph**\n" +
      "Visualizes how shots depend on shared assets (characters, locations, props). When an asset changes, the graph highlights which shots need regeneration.\n\n" +
      "**Dirty Queue**\n" +
      "When a dependency changes (e.g., a character's look is updated), affected shots are added to the dirty queue. Process the queue to regenerate shots with updated references.\n\n" +
      "**Buttons**\n" +
      "• *Run Check* — Manually triggers a continuity scan across all shots.\n" +
      "• *Resolve* — Marks a conflict as addressed.\n" +
      "• *Regenerate* — Re-generates a dirty shot with updated references.\n" +
      "• *View Dependencies* — Opens the visual dependency graph.",
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
      "• **Left Panel** — Media Bin with all generated shots organized by scene, plus imported media tabs (Sound, Color, Score, FX).\n" +
      "• **Center Top** — Playback monitor for previewing your edit.\n" +
      "• **Center Bottom** — Multi-track timeline with zoom, scrubber, and undo/redo.\n" +
      "• **Right Sidebar** — Processing modules: Sound, Color, Score, FX, and Localization.\n\n" +
      "**Key Features**\n" +
      "• **Style Drift Detector** — Monitors visual consistency across your edit and flags shots deviating from the Style Contract.\n" +
      "• **VFX Fix-It Bay** — AI-powered inpainting for targeted corrections on video clips.\n" +
      "• **Localization Suite** — Subtitle, dubbing, and language adaptation tools.\n\n" +
      "**Getting Started**\n" +
      "1. Expand scene folders in the Media Bin to see your shots.\n" +
      "2. Drag shots onto video tracks in the timeline.\n" +
      "3. Arrange, trim, and layer clips.\n" +
      "4. Add audio, effects, and color grading from the right sidebar.\n" +
      "5. Use the VFX Fix-It Bay for targeted inpainting on video clips.",
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
      "**Buttons & Controls**\n" +
      "• *Add Track* (+ dropdown) — Add Video or Audio tracks.\n" +
      "• *Delete Track* (trash icon on hover) — Removes the track and all its clips.\n" +
      "• *Undo* (⌘Z) — Reverts the last action (up to 100 steps).\n" +
      "• *Redo* (⌘⇧Z) — Re-applies an undone action.\n" +
      "• *Zoom In/Out* — Scale the timeline view (25%–400%).\n" +
      "• *Export FCPXML* — Exports the timeline for Final Cut Pro.\n\n" +
      "**Clip Operations**\n" +
      "• **Drag** — Move clips horizontally on a track or between tracks.\n" +
      "• **Trim** — Hover over clip edges to reveal trim handles; drag to adjust in/out points.\n" +
      "• **Double-click** — Opens the VFX Fix-It Bay for video clips.\n\n" +
      "**Scrubber**\n" +
      "Drag the playhead to navigate to any point in the timeline.",
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
      "• Color-coded by shot type\n\n" +
      "**Buttons**\n" +
      "• *Expand/Collapse* (folder icons) — Toggle scene folder visibility.\n" +
      "• *Drag to timeline* — Grab any shot and drop onto a timeline track.\n\n" +
      "**Imported Media Tabs**\n" +
      "Files imported via sidebar modules appear in categorized tabs: Sound, Color, Score, FX. Each tab has an *Import* button for adding external files.",
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
      "**Buttons**\n" +
      "• *Brush Size* slider — Adjust the masking brush diameter.\n" +
      "• *Clear Mask* — Removes all painted mask regions.\n" +
      "• *Lock as Reference* — Keep the rest of the frame identical while modifying only the masked region.\n" +
      "• *Apply Fix* — Run AI inpainting on the masked area. Consumes credits.\n" +
      "• *Undo* — Revert the last fix.\n" +
      "• *Close* (X) — Exit the Fix-It Bay.\n\n" +
      "**Use Cases**\n" +
      "• Remove unwanted artifacts from AI generation.\n" +
      "• Fix continuity errors between shots.\n" +
      "• Add or modify set elements.\n" +
      "• Clean up edge artifacts.",
  },
  {
    id: "style-drift",
    title: "Style Drift Detector",
    context: ["post-production"],
    category: "Post-Production",
    content:
      "**What It Does**\n" +
      "Monitors all shots in your edit against the Style Contract established during the Vision phase. Flags shots whose visual characteristics deviate from the contract's mandates.\n\n" +
      "**Drift Indicators**\n" +
      "• 🟢 Consistent — Shot matches the style contract.\n" +
      "• 🟡 Minor drift — Slight deviation detected.\n" +
      "• 🔴 Significant drift — Shot noticeably deviates from the established style.\n\n" +
      "**What It Checks**\n" +
      "• Color palette compliance\n" +
      "• Lighting consistency\n" +
      "• Texture and grain matching\n" +
      "• Lens characteristics\n" +
      "• Overall mood alignment\n\n" +
      "**Actions**\n" +
      "• Review flagged shots and decide whether to regenerate or accept the variation.\n" +
      "• Use the VFX Fix-It Bay or color grading to bring drifted shots back into compliance.",
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
      "**Buttons**\n" +
      "• *Import* — Add external audio files (*.wav*, *.mp3*, *.aiff*, *.flac*).\n" +
      "• *Generate* — Create AI-generated sound for the current scene.\n" +
      "• *Insert to Timeline* — Place generated audio on the appropriate track.\n" +
      "• *Preview* (play) — Audition audio before inserting.\n\n" +
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
      "• **Auto** — AI applies a cohesive color grade based on mood, time of day, and the Style Contract.\n" +
      "• **Templates** — Industry-standard looks: Film Noir, Teal & Orange, Bleach Bypass, etc.\n" +
      "• **Custom** — Manual color wheel adjustments, curves, and LUT application.\n\n" +
      "**Supported LUT Formats**\n" +
      "• 3D LUTs: *.cube*, *.3dl*\n" +
      "• CDL: *.csp*\n" +
      "• ACES Look: *.look*\n" +
      "• CLF: *.clf*\n\n" +
      "**Buttons**\n" +
      "• *Import LUT* — Drag-and-drop or browse to import LUT files.\n" +
      "• *Apply* — Apply the selected grade globally or per-clip.\n" +
      "• *Preview* — Preview the grade before applying.\n" +
      "• *Reset* — Remove applied color grading.",
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
      "**Buttons**\n" +
      "• *Generate Score* — Creates AI-composed music for the selected scene.\n" +
      "• *Insert to Timeline* — Places the generated music on the Music track.\n" +
      "• *Import Music* — Add your own music files.\n" +
      "• *Preview* (play) — Audition before inserting.",
  },
  {
    id: "fx-module",
    title: "FX Module (Visual Effects)",
    context: ["post-production"],
    category: "Post-Production",
    content:
      "**Supported Import Formats**\n" +
      "• EXR sequences (multi-layer compositing)\n" +
      "• DPX film scans\n" +
      "• MOV overlays with alpha\n" +
      "• PNG sequences\n\n" +
      "**Tri-State Modes**\n" +
      "• **Auto** — AI applies effects identified during script analysis (fire, rain, explosions, etc.).\n" +
      "• **Templates** — Pre-built effect packages: Weather, Particles, Light Leaks, Lens Flares.\n" +
      "• **Custom** — Layer and composite imported VFX elements manually.\n\n" +
      "**Buttons**\n" +
      "• *Import* — Add external VFX element files.\n" +
      "• *Generate* — Create AI-generated effects.\n" +
      "• *Apply* — Layer the effect onto the selected clip.\n" +
      "• *Preview* — See the effect before committing.\n\n" +
      "**VFX vs. Fix-It Bay**\n" +
      "The FX module is for *additive* effects (overlays, compositing). The VFX Fix-It Bay is for *corrective* work (inpainting, removal, replacement).",
  },
  {
    id: "localization",
    title: "Localization Suite",
    context: ["post-production"],
    category: "Post-Production",
    content:
      "**What It Does**\n" +
      "Provides subtitle, dubbing, and language adaptation tools for international distribution.\n\n" +
      "**Features**\n" +
      "• **Subtitle Generation** — AI-generated subtitles with timing synchronization.\n" +
      "• **Translation** — Translate subtitles into multiple languages.\n" +
      "• **Dubbing** — AI voice dubbing using locked character voices.\n" +
      "• **Export Formats** — SRT, VTT, ASS, and embedded subtitle tracks.\n\n" +
      "**Buttons**\n" +
      "• *Generate Subtitles* — Creates time-coded subtitles from dialogue.\n" +
      "• *Translate* — Converts subtitles to the selected target language.\n" +
      "• *Export* — Downloads subtitle files in the chosen format.\n" +
      "• *Preview* — Shows subtitles overlaid on the playback monitor.",
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
      "The Release phase is your finishing and distribution hub.\n\n" +
      "**Sections**\n" +
      "• **Export Master Film** — Primary export with Auto, Templates, and Custom encoding options.\n" +
      "• **Technical QC (Artifact Scanner)** — AI-powered scan for compression artifacts, banding, and quality issues.\n" +
      "• **Topaz DI Engine** — AI upscaling and enhancement for final delivery.\n" +
      "• **Distribution Packaging** — Festival bundles, ProRes masters, and direct platform uploads.\n" +
      "• **C2PA Provenance** — Cryptographic chain-of-title documentation.\n" +
      "• **Finished Exports** — Right sidebar listing all completed export files.\n\n" +
      "**Workflow**\n" +
      "1. Review format settings (shown in the spec bar at the top).\n" +
      "2. Choose Auto, Template, or Custom export settings.\n" +
      "3. Click *Export* to generate the master file.\n" +
      "4. Run the Artifact Scanner to verify quality.\n" +
      "5. Optionally upscale with Topaz DI.\n" +
      "6. Package for distribution or upload directly.\n" +
      "7. Generate C2PA ledger for legal provenance.",
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
      "• 2-pass encode and deinterlace toggles\n" +
      "• **Audio:** Codec (AAC, PCM, FLAC, AC3, EAC3, Opus), bitrate, and sample rate\n\n" +
      "**Buttons**\n" +
      "• *Export* — Starts the rendering process. Shows progress while encoding.\n" +
      "• *Cancel* — Stops an in-progress export.\n" +
      "• *Preset dropdown* — Select from template presets.",
  },
  {
    id: "artifact-scanner",
    title: "Technical QC — Artifact Scanner",
    context: ["release"],
    category: "Release",
    content:
      "**What It Does**\n" +
      "Scans rendered output for compression artifacts, color banding, frame drops, and quality issues before final delivery.\n\n" +
      "**Scan Results**\n" +
      "• Frame-by-frame quality scores\n" +
      "• Detected artifacts with timestamps\n" +
      "• Overall quality grade (Pass / Warning / Fail)\n\n" +
      "**Buttons**\n" +
      "• *Run Scan* — Starts the quality analysis on the latest export.\n" +
      "• *View Details* — Expands each detected issue with frame references.\n" +
      "• *Re-export* — Navigate back to export settings to re-render with higher quality settings.",
  },
  {
    id: "topaz-di",
    title: "Topaz DI Engine",
    context: ["release"],
    category: "Release",
    content:
      "**What It Does**\n" +
      "AI-powered upscaling and enhancement for final delivery. Can upscale from HD to 4K or enhance existing 4K footage.\n\n" +
      "**Features**\n" +
      "• Resolution upscaling (2x, 4x)\n" +
      "• Noise reduction and grain management\n" +
      "• Sharpening and detail enhancement\n" +
      "• Frame rate conversion\n\n" +
      "**Buttons**\n" +
      "• *Process* — Starts the Topaz DI enhancement pipeline.\n" +
      "• *Settings* — Configure upscaling parameters.\n" +
      "• *Preview* — See a before/after comparison on a sample frame.\n" +
      "• *Apply to Export* — Integrate DI processing into the export workflow.",
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
      "Generate a 27×40-inch theatrical poster and an Electronic Press Kit including key art, behind-the-scenes stills, synopsis, and credits sheet.\n\n" +
      "**Trailer Engine**\n" +
      "AI cuts a 60-second trailer by identifying high-action and emotional beats from your timeline. Includes auto-generated title cards and music.\n\n" +
      "**Buttons**\n" +
      "• *Generate Social Masters* — Creates all social format versions.\n" +
      "• *Generate Poster* — Creates theatrical poster artwork.\n" +
      "• *Generate Trailer* — AI-cuts a trailer from your timeline.\n" +
      "• *Download* — Saves any generated deliverable to your device.",
  },
  {
    id: "distribution",
    title: "Distribution & Direct Upload",
    context: ["release"],
    category: "Release",
    content:
      "**Festival Package**\n" +
      "One-click export of a complete festival submission bundle (screener, poster, key art, script PDF, synopsis, director's statement) as a ZIP.\n\n" +
      "**ProRes 422 HQ Export**\n" +
      "Broadcast-quality master in Apple ProRes 422 HQ codec — required by many distributors.\n\n" +
      "**Direct Platform Upload**\n" +
      "Authenticated upload to YouTube, Vimeo, and TikTok with metadata and privacy settings.\n\n" +
      "**Buttons**\n" +
      "• *Package for Festival* — Creates the complete submission bundle.\n" +
      "• *Export ProRes* — Renders a ProRes 422 HQ master.\n" +
      "• *Upload to YouTube* — Uploads with metadata (requires OAuth in Settings → Integrations).\n" +
      "• *Upload to Vimeo* — Uploads with review link generation.\n" +
      "• *Upload to TikTok* — Auto-formatted for vertical video.",
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
      "For AI-generated content, C2PA provenance establishes legal authorship, documents licensed AI usage, provides a verifiable chain of custody, and meets emerging regulatory requirements.\n\n" +
      "**Buttons**\n" +
      "• *Generate C2PA Ledger PDF* — Compiles all provenance data into a signed document.\n" +
      "• *Download* — Saves the generated ledger.\n" +
      "• *Verify* — Validates the cryptographic signatures.",
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
      "**Buttons**\n" +
      "• *Download* (hover to reveal) — Re-download the exported file.\n" +
      "• *Preview* (eye icon) — Preview the export in a viewer.\n" +
      "• *Clear All* — Removes all export entries from the list (already-downloaded files remain on your device).\n\n" +
      "**Session Scope**\n" +
      "Export history is maintained for the current session. Refreshing the page resets the list.",
  },

  /* ═══════════════════════════════════════════
     CREDIT SYSTEM
     ═══════════════════════════════════════════ */
  {
    id: "credits",
    title: "Credit System & Usage",
    context: ["projects", "settings"],
    category: "General",
    content:
      "**What Are Credits?**\n" +
      "Credits are consumed by AI generation tasks throughout the pipeline — script analysis, headshot generation, shot rendering, voice synthesis, music composition, and more.\n\n" +
      "**Credit Meter**\n" +
      "The header bar shows your remaining credit balance. Click it for usage history and threshold settings.\n\n" +
      "**Usage Settings**\n" +
      "• **Warning Threshold** — Get a notification when credits drop below this level.\n" +
      "• **Cutoff Threshold** — Block generation when credits drop below this level.\n" +
      "• **Warning Period** — How frequently warning notifications appear.\n\n" +
      "**Cost by Operation**\n" +
      "• Script analysis — 1 credit per scene enrichment\n" +
      "• Headshot generation — 1 credit per batch of 10\n" +
      "• Shot generation (Rehearsal) — 0.5 credits\n" +
      "• Shot generation (Roll Camera) — 1 credit\n" +
      "• Voice synthesis — 1 credit per sample\n" +
      "• VFX Fix-It — 1 credit per application\n\n" +
      "**Buttons**\n" +
      "• *Credit Meter* (header) — Opens usage history.\n" +
      "• *Configure Thresholds* — Set warning and cutoff levels.",
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
