import type { Card } from "./types";
import type { SessionConfig } from "./store";

/** Distinct tags across the deck, sorted with counts. */
export function collectTags(
  cards: Card[],
): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of cards) {
    for (const t of c.tags) {
      const key = t.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name));
}

function passesFilter(card: Card, filter: SessionConfig["filter"]): boolean {
  const now = Date.now();
  switch (filter) {
    case "all":
      return true;
    case "due":
      return new Date(card.dueAt).getTime() <= now;
    case "unmastered":
      return card.mastery < 85;
    case "new":
      return card.reps === 0;
  }
}

/**
 * Filter and order the deck for a Quiz/Listening session:
 * - Match any selected list (or all)
 * - Match status filter
 * - Optionally shuffle
 * - Truncate to limit (unless endless)
 */
export function buildSession(
  cards: Card[],
  config: SessionConfig,
): Card[] {
  let pool = cards.filter((c) =>
    config.tags.length === 0 || c.tags.some((tag) => config.tags.includes(tag)),
  );
  pool = pool.filter((c) => passesFilter(c, config.filter));

  if (config.shuffle) {
    pool = [...pool];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
  }

  if (config.limit !== "endless") {
    pool = pool.slice(0, config.limit as number);
  }
  return pool;
}
