import type { Token } from "./cloze";
import { similarity } from "./cloze";

export type KaraokeState = "match" | "empty";

function normalize(w: string): string {
  return w.toLowerCase().replace(/[^a-z']/g, "");
}

/**
 * Given ordered tokens (words + whitespace + punctuation) and the current
 * live transcript, compute per-token karaoke state. Words are only marked as
 * matched left-to-right, so once the user misses a word, later words stay
 * empty until they catch up.
 *
 * A small forward window lets the algorithm tolerate ASR insertions
 * (e.g. filler words) and drop-outs by looking a few spoken words ahead.
 */
export function karaokeMatch(
  tokens: Token[],
  transcript: string,
): { states: KaraokeState[]; matchedCount: number; totalWords: number } {
  const spoken = transcript
    .toLowerCase()
    .replace(/[^a-z\s']/g, " ")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const states: KaraokeState[] = tokens.map(() => "empty");
  let spokenPtr = 0;
  let matched = 0;
  let totalWords = 0;

  const WINDOW = 3;
  const FUZZY = 0.72;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t.isWord) continue;
    totalWords++;
    const target = normalize(t.raw);
    if (!target) continue;

    const searchEnd = Math.min(spoken.length, spokenPtr + WINDOW);
    let found = -1;
    for (let j = spokenPtr; j < searchEnd; j++) {
      const w = spoken[j];
      if (w === target) {
        found = j;
        break;
      }
      if (target.length >= 3 && similarity(w, target) >= FUZZY) {
        found = j;
        break;
      }
    }

    if (found >= 0) {
      states[i] = "match";
      spokenPtr = found + 1;
      matched++;
    } else {
      // Once we miss, stop advancing to model true karaoke sequencing.
      break;
    }
  }

  return { states, matchedCount: matched, totalWords };
}
