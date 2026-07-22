"use client";

import * as React from "react";
import {
  ArrowRight,
  Volume2,
  Mic,
  MicOff,
  RotateCcw,
  Flag,
  Sparkles,
  AlertCircle,
  Settings2,
  Trophy,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useCardStore, useSessionStore, useSettingsStore } from "@/lib/store";
import { pickCloze, similarity, tokenize, type Token } from "@/lib/cloze";
import {
  karaokeMatch,
  type KaraokeState,
} from "@/lib/karaoke";
import { useLocalWhisper } from "@/lib/local-whisper";
import { speak as speakTTS, detectLang } from "@/lib/tts";
import { SessionSetup } from "@/components/session-setup";
import type { Card as CardType } from "@/lib/types";
import { cn } from "@/lib/utils";

type Verdict = "pending" | "correct" | "incorrect";

// Whisper often expands contractions; map them to their spoken form for matching
const CONTRACTION_EXPANSIONS: Record<string, string> = {
  "i'm": "i am", "i've": "i have", "i'll": "i will", "i'd": "i would",
  "you're": "you are", "you've": "you have", "you'll": "you will", "you'd": "you would",
  "he's": "he is", "he'll": "he will", "he'd": "he would",
  "she's": "she is", "she'll": "she will", "she'd": "she would",
  "it's": "it is", "it'll": "it will",
  "we're": "we are", "we've": "we have", "we'll": "we will", "we'd": "we would",
  "they're": "they are", "they've": "they have", "they'll": "they will", "they'd": "they would",
  "that's": "that is", "that'd": "that would",
  "there's": "there is", "there're": "there are",
  "what's": "what is", "what're": "what are", "what'll": "what will",
  "who's": "who is", "who've": "who have",
  "isn't": "is not", "aren't": "are not", "wasn't": "was not", "weren't": "were not",
  "don't": "do not", "doesn't": "does not", "didn't": "did not",
  "won't": "will not", "wouldn't": "would not",
  "can't": "cannot", "couldn't": "could not",
  "shouldn't": "should not", "shan't": "shall not",
  "haven't": "have not", "hasn't": "has not", "hadn't": "had not",
  "let's": "let us",
};

function playEffect(name: "correct" | "incorrect") {
  new Audio(`/${name}.mp3`).play().catch(() => {});
}

export default function QuizPage() {
  const cards = useCardStore((s) => s.cards);
  const quizConfig = useSessionStore((s) => s.quiz);
  const setQuiz = useSessionStore((s) => s.setQuiz);
  const [sessionIds, setSessionIds] = React.useState<string[] | null>(null);

  const sessionCards = React.useMemo(() => {
    if (!sessionIds) return [] as CardType[];
    const byId = new Map(cards.map((c) => [c.id, c]));
    return sessionIds
      .map((id) => byId.get(id))
      .filter((c): c is CardType => Boolean(c));
  }, [sessionIds, cards]);

  if (!sessionIds) {
    return (
      <SessionSetup
        title="Quiz"
        description="穴埋め問題を音声またはテキストで解答。話すたびに単語が緑に染まります。"
        cards={cards}
        config={quizConfig}
        onChange={setQuiz}
        onStart={(session) => setSessionIds(session.map((c) => c.id))}
      />
    );
  }

  return (
    <QuizSession
      cards={sessionCards}
      onExit={() => setSessionIds(null)}
    />
  );
}

function QuizSession({
  cards: sessionCards,
  onExit,
}: {
  cards: CardType[];
  onExit: () => void;
}) {
  const cards = sessionCards;
  const settings = useSettingsStore((s) => s.settings);
  const [idx, setIdx] = React.useState(0);
  const card = cards[idx];
  const finished = idx >= cards.length;

  const [tokens, setTokens] = React.useState<Token[]>([]);
  const [answer, setAnswer] = React.useState("");
  const [verdict, setVerdict] = React.useState<Verdict>("pending");
  const [matchPct, setMatchPct] = React.useState<number | null>(null);
  const [autoGraded, setAutoGraded] = React.useState(false);
  // Indices of hidden tokens that have been spoken correctly (persists across recordings)
  const [matchedHiddenIndices, setMatchedHiddenIndices] = React.useState<Set<number>>(new Set());

  const {
    supported: sttSupported,
    isListening,
    transcript,
    previousTranscript,
    error: sttError,
    start: startSTT,
    stop: stopSTT,
    reset: resetSTT,
    lastElapsedMs,
  } = useLocalWhisper();

  // network系エラーは長い説明が出るのでバナーで表示、それ以外は短くトースト
  React.useEffect(() => {
    if (sttError && sttError.length < 80) toast.error(sttError);
  }, [sttError]);

  React.useEffect(() => {
    if (!card) return;
    setTokens(pickCloze(tokenize(card.english), settings.clozeRate));
    setAnswer("");
    setVerdict("pending");
    setMatchPct(null);
    setAutoGraded(false);
    setMatchedHiddenIndices(new Set());
    resetSTT();
  }, [card, settings.clozeRate, resetSTT]);

  // Indices of hidden tokens (used for per-word matching)
  const hiddenTokenIndices = React.useMemo(
    () => tokens.map((t, i) => (t.hidden ? i : -1)).filter((i) => i >= 0),
    [tokens],
  );

  const targetHidden = React.useMemo(
    () =>
      tokens
        .filter((t) => t.hidden)
        .map((t) => t.raw)
        .join(" "),
    [tokens],
  );

  // Karaoke live matching against the full sentence, driven by STT transcript.
  const karaoke = React.useMemo(
    () => karaokeMatch(tokens, transcript),
    [tokens, transcript],
  );

  // While recording, match hidden words independently from the transcript.
  React.useEffect(() => {
    if (!isListening || !transcript) return;
    const transcriptNorm = transcript.toLowerCase().replace(/[^a-z\s']/g, " ");
    const spoken = transcriptNorm.split(/\s+/).filter(Boolean);
    let changed = false;
    const next = new Set(matchedHiddenIndices);
    for (const idx of hiddenTokenIndices) {
      if (next.has(idx)) continue;
      const target = tokens[idx].norm;
      const expansion = CONTRACTION_EXPANSIONS[target];
      const found =
        spoken.some(
          (w) => w === target || (target.length >= 3 && similarity(w, target) >= 0.72),
        ) ||
        (expansion !== undefined && new RegExp(`\\b${expansion}\\b`).test(transcriptNorm));
      if (found) { next.add(idx); changed = true; }
    }
    if (changed) setMatchedHiddenIndices(next);
  }, [transcript, isListening, tokens, hiddenTokenIndices, matchedHiddenIndices]);

  // Auto-grade: all hidden words spoken correctly (even across multiple recordings).
  React.useEffect(() => {
    if (autoGraded || hiddenTokenIndices.length === 0) return;
    if (hiddenTokenIndices.every((i) => matchedHiddenIndices.has(i))) {
      setMatchPct(100);
      setVerdict("correct");
      setAutoGraded(true);
      toast.success("Nice — all words recognized 🎉");
      playEffect("correct");
      void speakTTS(card?.english ?? "", { voice: settings.ttsVoice, lang: detectLang(card?.english ?? "") });
      resetSTT();
    }
  }, [matchedHiddenIndices, hiddenTokenIndices, autoGraded, resetSTT, card, settings.ttsVoice]);

  const grade = (raw: string) => {
    const sim = similarity(raw, targetHidden);
    const pct = Math.round(sim * 100);
    setMatchPct(pct);
    const v = sim >= settings.pronunciationTolerance ? "correct" : "incorrect";
    setVerdict(v);
    playEffect(v);
    if (v === "correct") speak(card.english);
  };

  const speak = (text: string) => {
    void speakTTS(text, { voice: settings.ttsVoice, lang: detectLang(text) });
  };

  const toggleRecord = async () => {
    if (isListening) {
      stopSTT();
    } else {
      resetSTT();
      setAutoGraded(false);
      await startSTT();
    }
  };

  const giveUp = () => {
    setAnswer(targetHidden);
    setVerdict("incorrect");
    setMatchPct(0);
    playEffect("incorrect");
    speak(card?.english ?? "");
  };

  if (finished) {
    return (
      <div className="mx-auto max-w-lg p-4 md:p-10 space-y-6 text-center">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Trophy className="h-8 w-8" />
          </div>
        </div>
        <h2 className="text-3xl font-semibold">Quiz complete 🎉</h2>
        <p className="text-muted-foreground">
          {cards.length} cards done in this session.
        </p>
        <div className="flex gap-2 justify-center">
          <Button onClick={onExit} size="lg">
            <Settings2 className="h-4 w-4" />
            Change list
          </Button>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="p-8 text-center text-muted-foreground space-y-4">
        <p>No cards match the current filters.</p>
        <Button onClick={onExit} variant="outline">
          <Settings2 className="h-4 w-4" />
          Change setup
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Quiz"
        description="穴埋め問題を音声またはテキストで解答。話すたびに単語が緑に染まります。"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={onExit}>
              <Settings2 className="h-4 w-4" />
              Change list
            </Button>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              {settings.difficulty}
            </Badge>
            <Badge variant="outline">
              cloze {(settings.clozeRate * 100).toFixed(0)}%
            </Badge>
            <Badge variant="outline">
              tolerance {(settings.pronunciationTolerance * 100).toFixed(0)}%
            </Badge>
          </>
        }
      />

      <div className="mx-auto max-w-3xl p-4 md:p-8 space-y-6">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Card {idx + 1} / {cards.length}
          </span>
          <span className="flex gap-2">
            {card.targetWord && (
              <Badge variant="outline">{card.targetWord}</Badge>
            )}
            {card.tags.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </span>
        </div>

        {!sttSupported && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <div>
              このブラウザは AudioWorklet / getUserMedia 未対応です。テキスト入力での採点は可能です。
            </div>
          </div>
        )}
        {sttSupported && sttError && sttError.length >= 80 && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <div className="font-medium">音声認識に接続できません</div>
              <div className="text-xs leading-relaxed">{sttError}</div>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="py-8 md:py-10 space-y-6">
            <div className="text-sm text-muted-foreground leading-relaxed">
              {card.targetWord && (
                <span className="font-semibold text-foreground mr-2">{card.targetWord}</span>
              )}
              {card.japanese}
            </div>
            <ClozeText
              tokens={tokens}
              verdict={verdict}
              userAnswer={answer}
              karaokeStates={karaoke.states}
              matchedHiddenIndices={matchedHiddenIndices}
              onWordClick={speak}
            />

            <YouSaidPanel
              current={transcript}
              previous={previousTranscript}
              isListening={isListening}
            />

            <Separator />

            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type the missing words..."
                  className="text-base"
                  onKeyDown={(e) => e.key === "Enter" && grade(answer)}
                />
                <Button
                  onClick={() => grade(answer)}
                  disabled={!answer.trim()}
                >
                  Grade
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={isListening ? "destructive" : "secondary"}
                  size="sm"
                  onClick={toggleRecord}
                  disabled={!sttSupported}
                >
                  {isListening ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                  {isListening ? "Stop" : "Record"}
                </Button>
                {isListening && lastElapsedMs !== null && (
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    whisper {lastElapsedMs.toFixed(0)}ms
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    resetSTT();
                    toast.success("Voice buffer reset");
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => speak(card.english)}
                >
                  <Volume2 className="h-4 w-4" />
                  Play
                </Button>
              </div>
            </div>

            <MatchMeter
              matchPct={matchPct}
              verdict={verdict}
              threshold={settings.pronunciationTolerance}
              expected={targetHidden}
              liveMatched={matchedHiddenIndices.size}
              liveTotal={hiddenTokenIndices.length}
              live={isListening}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          {verdict !== "pending" && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setAnswer("");
                setVerdict("pending");
                setMatchPct(null);
                setAutoGraded(false);
                setMatchedHiddenIndices(new Set());
                resetSTT();
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Try Again
            </Button>
          )}
          <Button
            onClick={verdict === "pending" ? giveUp : () => setIdx((i) => i + 1)}
            variant={verdict === "pending" ? "outline" : "default"}
            className="gap-1"
            size="lg"
          >
            {verdict === "pending" ? (
              <>
                <Flag className="h-4 w-4" />
                Give up
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}

function YouSaidPanel({
  current,
  previous,
  isListening,
}: {
  current: string;
  previous: string;
  isListening: boolean;
}) {
  return (
    <div className="space-y-2 min-h-[4.5rem]">
      {(current || isListening) && (
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-2">
            You said
            {isListening && (
              <span className="inline-flex items-center gap-1 text-primary">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-70" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                listening
              </span>
            )}
          </div>
          <p className="text-xl md:text-2xl font-medium">
            {current || (
              <span className="text-muted-foreground">…</span>
            )}
          </p>
        </div>
      )}
      {previous && previous !== current && (
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
            Previous
          </div>
          <p className="text-sm text-muted-foreground">{previous}</p>
        </div>
      )}
    </div>
  );
}

function MatchMeter({
  matchPct,
  verdict,
  threshold,
  expected,
  liveMatched,
  liveTotal,
  live,
}: {
  matchPct: number | null;
  verdict: Verdict;
  threshold: number;
  expected: string;
  liveMatched: number;
  liveTotal: number;
  live: boolean;
}) {
  const showLive = live && liveTotal > 0 && matchPct === null;
  const livePct = liveTotal
    ? Math.round((liveMatched / liveTotal) * 100)
    : 0;

  if (matchPct === null && !showLive) return null;

  const pct = matchPct ?? livePct;
  const label = showLive
    ? `Live match ${pct}% (${liveMatched}/${liveTotal})`
    : verdict === "correct"
      ? `Correct 🎉 — Match ${pct}%`
      : `Not quite — Match ${pct}%`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span
          className={cn(
            "font-medium",
            showLive
              ? "text-muted-foreground"
              : verdict === "correct"
                ? "text-primary"
                : "text-destructive",
          )}
        >
          {label}
        </span>
        <span className="text-muted-foreground">
          threshold {(threshold * 100).toFixed(0)}%
        </span>
      </div>
      <Progress value={pct} />
      {matchPct !== null && (
        <p className="text-xs text-muted-foreground">
          Expected: <span className="font-medium">{expected}</span>
        </p>
      )}
    </div>
  );
}

function ClozeText({
  tokens,
  verdict,
  userAnswer,
  karaokeStates,
  matchedHiddenIndices,
  onWordClick,
}: {
  tokens: Token[];
  verdict: Verdict;
  userAnswer: string;
  karaokeStates: KaraokeState[];
  matchedHiddenIndices: Set<number>;
  onWordClick: (word: string) => void;
}) {
  const userWords = userAnswer.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hiddenWords = tokens.filter((t) => t.hidden);

  return (
    <p className="text-2xl md:text-3xl leading-relaxed tracking-tight font-medium">
      {tokens.map((t, i) => {
        if (!t.isWord) return <span key={i}>{t.raw}</span>;

        const karaokeHit = karaokeStates[i] === "match";

        if (!t.hidden) {
          return (
            <button
              key={i}
              onClick={() => onWordClick(t.raw)}
              className={cn(
                "hover:underline underline-offset-4 decoration-dashed transition-colors",
                karaokeHit ? "text-primary" : "text-muted-foreground/70",
              )}
            >
              {t.raw}
            </button>
          );
        }

        // Hidden word: matched if spoken correctly in any recording
        const voiceMatched = matchedHiddenIndices.has(i);
        const hiddenIdx = hiddenWords.indexOf(t);
        const user = userWords[hiddenIdx];
        const target = t.norm;

        let state: "empty" | "match" | "partial" | "miss" = "empty";
        if (voiceMatched) state = "match";
        else if (verdict !== "pending") {
          if (user === target) state = "match";
          else if (user && similarity(user, target) > 0.6) state = "partial";
          else state = user ? "miss" : "empty";
        }

        const isRevealed = voiceMatched || verdict !== "pending";
        const reveal = voiceMatched ? t.raw : verdict !== "pending" ? (user || t.raw) : null;

        const sharedClass = cn(
          "inline-block mx-0.5 min-w-[3ch] text-center rounded-md px-1.5 py-0.5 border transition-colors align-baseline",
          state === "match" && "bg-primary/15 text-primary border-primary/40",
          state === "partial" && "bg-orange-500/15 text-orange-700 border-orange-500/40 dark:text-orange-300",
          state === "miss" && "bg-destructive/15 text-destructive border-destructive/40",
          state === "empty" && "bg-muted text-muted-foreground border-transparent",
        );

        if (isRevealed) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => onWordClick(t.raw)}
              className={cn(sharedClass, "hover:opacity-70")}
            >
              {reveal}
            </button>
          );
        }

        return (
          <span key={i} className={sharedClass}>
            {"_".repeat(Math.max(3, t.raw.length))}
          </span>
        );
      })}
    </p>
  );
}
