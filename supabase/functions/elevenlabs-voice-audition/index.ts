import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { requireAuth, isResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ── Voice pools by gender ── */
const MALE_VOICES = [
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George" },
  { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam" },
  { id: "bIHbv24MWmeRgasZH58o", name: "Will" },
  { id: "cjVigY5qzO86Huf0OWal", name: "Eric" },
  { id: "iP95p4xoKVk53GoZ742B", name: "Chris" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel" },
];

const FEMALE_VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily" },
  { id: "SAz9YHcvj6GT2YYXdXww", name: "River" },
];

function pickVoices(sex: string | null, count: number) {
  const pool =
    sex === "Female" ? FEMALE_VOICES :
    sex === "Male" ? MALE_VOICES :
    [...MALE_VOICES, ...FEMALE_VOICES];
  // Shuffle and pick
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireAuth(req);
    if (isResponse(auth)) return auth;

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ELEVENLABS_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { character_id, character_name, sex, sample_text } = await req.json();
    if (!character_id || !sample_text) {
      return new Response(
        JSON.stringify({ error: "character_id and sample_text are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const voices = pickVoices(sex, 5);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Delete previous auditions for this character
    await adminClient
      .from("character_voice_auditions")
      .delete()
      .eq("character_id", character_id);

    const results: Array<{
      voice_index: number;
      voice_id: string;
      voice_name: string;
      audio_url: string | null;
    }> = [];

    // Generate TTS for each voice in parallel
    const promises = voices.map(async (voice, index) => {
      try {
        const ttsResponse = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voice.id}?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: {
              "xi-api-key": ELEVENLABS_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: sample_text,
              model_id: "eleven_multilingual_v2",
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
                style: 0.4,
                use_speaker_boost: true,
              },
            }),
          }
        );

        if (!ttsResponse.ok) {
          const errText = await ttsResponse.text();
          console.error(`TTS failed for ${voice.name}: ${ttsResponse.status} ${errText}`);
          return { voice_index: index, voice_id: voice.id, voice_name: voice.name, audio_url: null };
        }

        const audioBuffer = await ttsResponse.arrayBuffer();
        const fileName = `${character_id}/${voice.id}-${Date.now()}.mp3`;

        const { error: uploadError } = await adminClient.storage
          .from("voice-samples")
          .upload(fileName, audioBuffer, {
            contentType: "audio/mpeg",
            upsert: true,
          });

        if (uploadError) {
          console.error(`Upload failed for ${voice.name}:`, uploadError);
          return { voice_index: index, voice_id: voice.id, voice_name: voice.name, audio_url: null };
        }

        const { data: publicUrl } = adminClient.storage
          .from("voice-samples")
          .getPublicUrl(fileName);

        // Persist to DB
        await adminClient.from("character_voice_auditions").insert({
          character_id,
          voice_index: index,
          voice_id: voice.id,
          voice_name: voice.name,
          audio_url: publicUrl.publicUrl,
          sample_text,
          selected: false,
        });

        return {
          voice_index: index,
          voice_id: voice.id,
          voice_name: voice.name,
          audio_url: publicUrl.publicUrl,
        };
      } catch (e) {
        console.error(`Voice ${voice.name} generation error:`, e);
        return { voice_index: index, voice_id: voice.id, voice_name: voice.name, audio_url: null };
      }
    });

    const settled = await Promise.all(promises);
    results.push(...settled);

    return new Response(
      JSON.stringify({ auditions: results.sort((a, b) => a.voice_index - b.voice_index) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Voice audition error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
