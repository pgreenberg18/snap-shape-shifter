/**
 * Parse plain-text screenplay into typed paragraphs.
 *
 * Uses a simple state machine:
 *   - After a CHARACTER cue, subsequent lines are DIALOGUE
 *     unless they are parentheticals like "(continuing)"
 *   - ALL-CAPS short lines are CHARACTER cues
 *   - Lines starting with INT./EXT. are scene headings
 *   - Lines like "CUT TO:" are transitions
 *   - Everything else is action/description
 */

export interface ScriptParagraph {
  type: string;
  text: string;
}

/**
 * Classify an array of screenplay lines into typed paragraphs.
 * Works with both full scenes and isolated blocks.
 */
export function classifyScreenplayLines(lines: string[]): ScriptParagraph[] {
  const result: ScriptParagraph[] = [];
  let lastType = "";

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // Scene heading
    if (/^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)/i.test(trimmed)) {
      result.push({ type: "Scene Heading", text: trimmed });
      lastType = "Scene Heading";
      continue;
    }

    // Transition
    if (/^(CUT TO:|FADE OUT\.?|FADE IN:?|DISSOLVE TO:|SMASH CUT|MATCH CUT|INTERCUT|END CREDITS|TITLE CARD)/i.test(trimmed)) {
      result.push({ type: "Transition", text: trimmed });
      lastType = "Transition";
      continue;
    }

    // Parenthetical — line wrapped in parens, typically after a character cue
    if (/^\(.*\)$/.test(trimmed)) {
      result.push({ type: "Parenthetical", text: trimmed });
      lastType = "Parenthetical";
      continue;
    }

    // Character cue — ALL CAPS, short, may include (V.O.), (O.S.), (CONT'D), etc.
    // Must NOT look like action text (which can also be caps but tends to be longer
    // or contain lowercase). We require at least 2 chars and no lowercase letters.
    const isAllCaps = /^[A-Z][A-Z\s'.()\-/]+$/.test(trimmed);
    const isShort = trimmed.length < 45;
    const hasLower = /[a-z]/.test(trimmed);
    if (isAllCaps && isShort && !hasLower) {
      result.push({ type: "Character", text: trimmed });
      lastType = "Character";
      continue;
    }

    // If the previous line was a Character cue or Dialogue or Parenthetical,
    // this line is dialogue (unless it matched one of the above patterns)
    if (lastType === "Character" || lastType === "Dialogue" || lastType === "Parenthetical") {
      result.push({ type: "Dialogue", text: trimmed });
      lastType = "Dialogue";
      continue;
    }

    // Default: Action
    result.push({ type: "Action", text: trimmed });
    lastType = "Action";
  }

  return result;
}

/**
 * Extract a single scene from plain text given a heading string,
 * then classify each line. Returns typed paragraphs.
 */
export function parseSceneFromPlainText(
  fullText: string,
  heading: string | undefined | null
): ScriptParagraph[] {
  if (!heading) return [{ type: "Action", text: fullText }];

  const headingPattern = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startMatch = fullText.match(new RegExp(`^(.*${headingPattern}.*)$`, "mi"));
  if (!startMatch || startMatch.index === undefined) {
    return [{ type: "Action", text: fullText }];
  }

  const sIdx = startMatch.index;
  const afterHeading = fullText.substring(sIdx + startMatch[0].length);
  const nextScene = afterHeading.match(/\n\s*((?:INT\.|EXT\.|INT\.\/EXT\.|I\/E\.).+)/i);
  const eIdx = nextScene?.index !== undefined
    ? sIdx + startMatch[0].length + nextScene.index
    : fullText.length;

  const sceneText = fullText.substring(sIdx, eIdx).trim();
  const lines = sceneText.split("\n");
  return classifyScreenplayLines(lines);
}
