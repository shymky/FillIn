#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const csvPath = resolve(__dirname, "../../vocab.csv");
const outPath = resolve(__dirname, "../src/lib/seed-cards.ts");

function parseCsvLine(line) {
  const out = [];
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

const raw = readFileSync(csvPath, "utf8");
const lines = raw.replace(/\r\n/g, "\n").split("\n").filter(Boolean);
const header = parseCsvLine(lines[0]);
const idx = {
  japanese: header.indexOf("Japanese"),
  english: header.indexOf("English"),
  targetWord: header.indexOf("Target Word (Optional)"),
  proficiency: header.indexOf("Proficiency"),
};

const cards = lines.slice(1).map((line, i) => {
  const cols = parseCsvLine(line);
  return {
    id: `seed-${String(i + 1).padStart(4, "0")}`,
    english: (cols[idx.english] || "").trim(),
    japanese: (cols[idx.japanese] || "").trim(),
    targetWord: (cols[idx.targetWord] || "").trim() || undefined,
    proficiency: Number(cols[idx.proficiency] || 0) || 0,
  };
});

const banner = `// AUTO-GENERATED from vocab.csv by scripts/import-vocab.mjs. Do not edit by hand.\n`;
const body = `import type { RawSeed } from "./types";\n\nexport const seedRaw: RawSeed[] = ${JSON.stringify(
  cards,
  null,
  2,
)};\n`;

writeFileSync(outPath, banner + body, "utf8");
console.log(`Wrote ${cards.length} seed cards to ${outPath}`);
