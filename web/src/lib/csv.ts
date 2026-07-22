import type { Card } from "./types";

function escape(v: string) {
  const s = v ?? "";
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function cardsToCsv(cards: Card[]): string {
  const header = [
    "id",
    "english",
    "japanese",
    "targetWord",
    "tags",
    "mastery",
    "dueAt",
    "ease",
    "reps",
    "lapses",
  ];
  const rows = cards.map((c) =>
    [
      c.id,
      c.english,
      c.japanese,
      c.targetWord ?? "",
      c.tags.join("|"),
      String(c.mastery),
      c.dueAt,
      String(c.ease),
      String(c.reps),
      String(c.lapses),
    ]
      .map(escape)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function csvToCards(text: string): Card[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]);
  const at = (row: string[], name: string) => {
    const i = header.indexOf(name);
    return i === -1 ? "" : row[i] ?? "";
  };
  const now = new Date().toISOString();

  const isLegacyVocab =
    header.includes("Japanese") && header.includes("English");

  return lines
    .slice(1)
    .filter((l) => l.trim())
    .map((line, i) => {
      const cols = parseCsvLine(line);
      if (isLegacyVocab) {
        return {
          id: `imported-${Date.now()}-${i}`,
          english: at(cols, "English").trim(),
          japanese: at(cols, "Japanese").trim(),
          targetWord: at(cols, "Target Word (Optional)").trim() || undefined,
          tags: [],
          mastery: Number(at(cols, "Proficiency") || 0) || 0,
          dueAt: now,
          ease: 2.5,
          reps: 0,
          lapses: 0,
          createdAt: now,
          updatedAt: now,
        };
      }
      return {
        id: at(cols, "id") || `imported-${Date.now()}-${i}`,
        english: at(cols, "english"),
        japanese: at(cols, "japanese"),
        targetWord: at(cols, "targetWord") || undefined,
        tags: (at(cols, "tags") || "").split("|").filter(Boolean),
        mastery: Number(at(cols, "mastery") || 0),
        dueAt: at(cols, "dueAt") || now,
        ease: Number(at(cols, "ease") || 2.5),
        reps: Number(at(cols, "reps") || 0),
        lapses: Number(at(cols, "lapses") || 0),
        createdAt: now,
        updatedAt: now,
      };
    });
}
