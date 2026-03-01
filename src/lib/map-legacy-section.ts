/**
 * Maps a legacy section_id + provider_name to the correct new granular section.
 * The old "sound-stage" held voice, music, and SFX; "post-house" held lipsync, upscale, editing, dubbing.
 */
export function mapLegacySection(sectionId: string, providerName: string): string {
  if (sectionId === "writers-room") return "script-analysis";

  if (sectionId === "sound-stage") {
    const lower = providerName.toLowerCase();
    if (lower.includes("lyria") || lower.includes("suno") || lower.includes("udio") || lower.includes("music")) return "music-stage";
    if (lower.includes("sfx") || lower.includes("sound effect") || lower.includes("epidemic") || lower.includes("artlist")) return "sfx-stage";
    return "voice-stage";
  }

  if (sectionId === "post-house") {
    const lower = providerName.toLowerCase();
    if (lower.includes("topaz") || lower.includes("upscal")) return "post-upscale";
    if (lower.includes("descript") || lower.includes("kapwing") || lower.includes("editing")) return "post-editing";
    if (lower.includes("dubbing") || lower.includes("adr") || lower.includes("isolat") || lower.includes("elevenlabs")) return "post-dubbing";
    return "post-lipsync";
  }

  return sectionId;
}
