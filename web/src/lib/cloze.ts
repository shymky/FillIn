export type Token = {
  raw: string;
  norm: string;
  isWord: boolean;
  hidden: boolean;
};

export function tokenize(sentence: string): Token[] {
  const tokens: Token[] = [];
  // \p{L} covers all Unicode letters (incl. é, ü, ñ …); ['’] covers both ' and '
  const re = /([\p{L}]+(?:['’][\p{L}]+)*)|(\s+)|([^\p{L}\s]+)/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sentence)) !== null) {
    const raw = m[0];
    const isWord = !!m[1];
    tokens.push({
      raw,
      norm: isWord ? raw.toLowerCase() : raw,
      isWord,
      hidden: false,
    });
  }
  return tokens;
}

export function pickCloze(tokens: Token[], rate: number): Token[] {
  const wordIdxs = tokens
    .map((t, i) => (t.isWord ? i : -1))
    .filter((i) => i !== -1);
  const n = Math.max(1, Math.round(wordIdxs.length * rate));
  const shuffled = [...wordIdxs].sort(() => Math.random() - 0.5).slice(0, n);
  const hidden = new Set(shuffled);
  return tokens.map((t, i) => ({ ...t, hidden: hidden.has(i) }));
}

/**
 * Adjusts an existing set of hidden tokens to a new hide rate,
 * preserving current hidden words when increasing (additive).
 */
export function adjustCloze(tokens: Token[], prevRate: number, newRate: number): Token[] {
  const wordIdxs = tokens.map((t, i) => (t.isWord ? i : -1)).filter((i) => i !== -1);
  const target = Math.round(wordIdxs.length * newRate);
  const hiddenIdxs = tokens.map((t, i) => (t.hidden ? i : -1)).filter((i) => i !== -1);

  if (newRate >= prevRate) {
    const toAdd = Math.max(0, target - hiddenIdxs.length);
    if (toAdd === 0) return tokens;
    const visible = wordIdxs.filter((i) => !tokens[i].hidden);
    const picks = new Set([...visible].sort(() => Math.random() - 0.5).slice(0, toAdd));
    return tokens.map((t, i) => ({ ...t, hidden: t.hidden || picks.has(i) }));
  } else {
    const toRemove = Math.max(0, hiddenIdxs.length - target);
    if (toRemove === 0) return tokens;
    const unhide = new Set([...hiddenIdxs].sort(() => Math.random() - 0.5).slice(0, toRemove));
    return tokens.map((t, i) => ({ ...t, hidden: t.hidden && !unhide.has(i) }));
  }
}

export function similarity(a: string, b: string): number {
  const A = a.toLowerCase().trim();
  const B = b.toLowerCase().trim();
  if (!A && !B) return 1;
  if (!A || !B) return 0;
  const dp = Array.from({ length: A.length + 1 }, () =>
    new Array(B.length + 1).fill(0),
  );
  for (let i = 0; i <= A.length; i++) dp[i][0] = i;
  for (let j = 0; j <= B.length; j++) dp[0][j] = j;
  for (let i = 1; i <= A.length; i++) {
    for (let j = 1; j <= B.length; j++) {
      dp[i][j] =
        A[i - 1] === B[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const dist = dp[A.length][B.length];
  const maxLen = Math.max(A.length, B.length);
  return 1 - dist / maxLen;
}
