import type { Card } from "./types";
import { seedRaw } from "./seed-cards";

const now = new Date();
const daysFromNow = (n: number) =>
  new Date(now.getTime() + n * 24 * 60 * 60 * 1000).toISOString();

// Deterministic pseudo-random from a string so seed data stays stable across
// reloads while giving each card a varied due date / mastery for demo feel.
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}

export const mockCards: Card[] = seedRaw.map((r) => {
  const rand = hash(r.id);
  const mastery = Math.round(r.proficiency > 0 ? r.proficiency : rand * 100);
  const dueOffset = mastery >= 85 ? 7 + rand * 14 : mastery >= 60 ? 1 + rand * 4 : rand * 2 - 1;
  return {
    id: r.id,
    english: r.english,
    japanese: r.japanese,
    targetWord: r.targetWord,
    tags: [],
    mastery,
    dueAt: daysFromNow(dueOffset),
    ease: 2.5,
    reps: mastery >= 60 ? 3 : mastery >= 30 ? 1 : 0,
    lapses: 0,
    createdAt: daysFromNow(-30),
    updatedAt: daysFromNow(-1),
  };
});
