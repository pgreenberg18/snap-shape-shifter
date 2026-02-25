/**
 * Shot highlight color palette for script-to-viewport linking.
 * Max 3 shots can overlap the same script line.
 * Colors chosen to avoid yellow (used for keyword highlights elsewhere).
 */

export const SHOT_COLORS = [
  { id: "cyan",    hsl: "185 75% 55%", label: "Cyan"    },  // bottom line
  { id: "magenta", hsl: "320 70% 58%", label: "Magenta" },  // middle line
  { id: "orange",  hsl: "25 90% 58%",  label: "Orange"  },  // top line
] as const;

export type ShotColorId = (typeof SHOT_COLORS)[number]["id"];

/** Get the color for a shot based on its index within the scene (mod 3). */
export function getShotColor(indexInScene: number) {
  return SHOT_COLORS[indexInScene % SHOT_COLORS.length];
}

/** Get CSS border style for the viewer frame */
export function getShotBorderStyle(indexInScene: number): React.CSSProperties {
  const color = getShotColor(indexInScene);
  return {
    boxShadow: `inset 0 0 0 3px hsl(${color.hsl})`,
  };
}
