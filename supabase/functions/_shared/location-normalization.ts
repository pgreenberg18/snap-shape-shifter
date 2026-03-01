const APOSTROPHE_RE = /[’‘`´]/g;
const HEADING_PREFIX_RE = /^(?:INT\.?\/EXT\.?|I\/E\.?|INT\.?|EXT\.?)\s*[-–—.\s]*/i;
const TIME_SUFFIX_RE = /\s*[-–—]\s*(?:DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|AFTERNOON|LATER|CONTINUOUS|MOMENTS LATER|SAME)\s*$/i;

const VEHICLE_TERM_RE = /\b(car|truck|van|bus|suv|sedan|pickup|motorcycle|bike|bicycle|taxi|cab|limo|limousine|convertible|coupe|tesla|miata|corvette|mustang|ferrari|porsche|mercedes|bmw|audi|toyota|honda|nissan|ford|chevy|chevrolet|jeep)\b/i;
const LOCATION_CONTEXT_RE = /\b(room|hall|hallway|corridor|office|lot|parking|street|road|highway|restaurant|bar|beach|bank|casino|home|house|hospital|university|school|lab|laboratory|orphanage|facility|station|apartment|kitchen|bedroom|bathroom|deck|lobby|entrance|exit|staircase|side door)\b/i;

export function normalizeApostrophes(value: string): string {
  return value.replace(APOSTROPHE_RE, "'").replace(/\s+/g, " ").trim();
}

export function normalizeLocationKey(value: string): string {
  return normalizeApostrophes(value)
    .toUpperCase()
    .replace(/\.\s+/g, " - ")
    .replace(/\bHOUSE\b/g, "HOME")
    .replace(/\bLAB\b/g, "LABORATORY")
    .replace(/\s+/g, " ")
    .trim();
}

function isPictureVehicleMatch(location: string, pictureVehicles: string[]): boolean {
  const locNorm = normalizeLocationKey(location);
  return pictureVehicles.some((vehicle) => {
    const v = normalizeLocationKey(vehicle);
    return v.length > 0 && (locNorm === v || locNorm.includes(v) || v.includes(locNorm));
  });
}

export function isLikelyVehicleLocation(value: string): boolean {
  const normalized = normalizeApostrophes(value);
  const upper = normalized.toUpperCase();

  const strippedPossessive = upper.replace(/^[A-Z0-9'\-]+['’]S\s+/, "").trim();
  const wordCount = strippedPossessive.split(/\s+/).filter(Boolean).length;

  if (VEHICLE_TERM_RE.test(strippedPossessive) && wordCount <= 4) {
    if (!LOCATION_CONTEXT_RE.test(strippedPossessive)) return true;
    if (/^(?:[A-Z0-9'\-]+\s+){0,2}(?:CAR|TRUCK|VAN|SUV|SEDAN|MOTORCYCLE|TESLA|MIATA|CORVETTE)\b/.test(strippedPossessive)) {
      return true;
    }
  }

  return false;
}

export function extractNormalizedLocations(rawLocation: string | null | undefined, pictureVehicles: string[] = []): string[] {
  if (!rawLocation) return [];

  const raw = normalizeApostrophes(rawLocation);
  const dedup = new Map<string, string>();

  for (const part of raw.split(/\s*\/\s*/)) {
    let cleaned = part
      .replace(HEADING_PREFIX_RE, "")
      .replace(TIME_SUFFIX_RE, "")
      .trim();

    if (!cleaned) continue;

    const dashParts = cleaned.split(/\s*[-–—]\s*/);
    if (dashParts.length >= 2) {
      const head = dashParts[0]?.trim();
      const tail = dashParts.slice(1).join(" - ").trim();
      if (head && tail && isLikelyVehicleLocation(tail) && LOCATION_CONTEXT_RE.test(head)) {
        cleaned = head;
      }
    }

    if (isLikelyVehicleLocation(cleaned)) continue;
    if (isPictureVehicleMatch(cleaned, pictureVehicles)) continue;

    const key = normalizeLocationKey(cleaned);
    const existing = dedup.get(key);
    if (!existing || cleaned.length > existing.length) {
      dedup.set(key, cleaned);
    }
  }

  return [...dedup.values()];
}
