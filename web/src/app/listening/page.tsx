"use client";

import * as React from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Settings2,
  Repeat,
  Repeat1,
  Shuffle,
  Trash2,
  Plus,
  Trophy,
  X,
  Eye,
  EyeOff,
  ChevronDown,
  Pencil,
  Check,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useCardStore, useListeningSessionStore, useSessionStore, useSettingsStore } from "@/lib/store";
import { speak as speakTTS, stopSpeech } from "@/lib/tts";
import { tokenize, pickCloze, adjustCloze, type Token } from "@/lib/cloze";
import { SessionSetup } from "@/components/session-setup";
import { collectTags } from "@/lib/session";
import type { Card as CardType } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ListeningPage() {
  const cards = useCardStore((s) => s.cards);
  const listeningConfig = useSessionStore((s) => s.listening);
  const setListeningConfig = useSessionStore((s) => s.setListening);
  const sessionIds = useListeningSessionStore((s) => s.sessionIds);
  const setSession = useListeningSessionStore((s) => s.setSession);
  const clearSession = useListeningSessionStore((s) => s.clearSession);

  // Always show setup screen when navigating to this page
  React.useEffect(() => { clearSession(); }, []);

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
        title="Listening"
        description="音声を繰り返し流す聞き流しモード。作業中の BGM 感覚で使えます。"
        cards={cards}
        config={listeningConfig}
        kind="listening"
        onChange={setListeningConfig}
        onStart={(session) => setSession(session.map((c) => c.id), listeningConfig.tag)}
      />
    );
  }

  return (
    <ListeningSession
      cards={sessionCards}
      mode={listeningConfig.listeningMode ?? "en_only"}
      repeat={listeningConfig.listeningRepeat ?? 3}
      delayBeforeEnglish={listeningConfig.delayBeforeEnglish ?? 0}
      initialHidePercent={listeningConfig.listeningHidePercent ?? 0}
      initialLoopPlaylist={listeningConfig.listeningLoopPlaylist ?? false}
      initialCardLoop={(listeningConfig.listeningCardLoop ?? false) || listeningConfig.listeningRepeat === "endless"}
      initialShuffle={listeningConfig.shuffle ?? false}
      hideMode={listeningConfig.listeningHideMode ?? "fixed"}
      onExit={() => {
        stopSpeech();
        clearSession();
      }}
    />
  );
}

type Phase = "idle" | "ja" | "wait" | "en";

function getProgressiveSchedule(totalPasses: number): number[] {
  if (totalPasses <= 1) return [0];
  return Array.from({ length: totalPasses }, (_, i) =>
    Math.round((i * 100) / (totalPasses - 1)),
  );
}

function getRevealSchedule(totalPasses: number): number[] {
  if (totalPasses <= 1) return [100];
  return Array.from({ length: totalPasses }, (_, i) =>
    Math.round(100 - (i * 100) / (totalPasses - 1)),
  );
}

function ListeningSession({
  cards,
  mode,
  repeat,
  delayBeforeEnglish,
  initialHidePercent = 0,
  initialLoopPlaylist = false,
  initialCardLoop = false,
  initialShuffle = false,
  hideMode = "fixed",
  onExit,
}: {
  cards: CardType[];
  mode: "en_only" | "ja_en";
  repeat: number | "endless";
  delayBeforeEnglish: number;
  initialHidePercent?: number;
  initialLoopPlaylist?: boolean;
  initialCardLoop?: boolean;
  initialShuffle?: boolean;
  hideMode?: "fixed" | "progressive" | "reveal";
  onExit: () => void;
}) {
  const { settings, update: updateSettings } = useSettingsStore();
  const removeCard = useCardStore((s) => s.removeCard);
  const updateCard = useCardStore((s) => s.updateCard);
  const allCards = useCardStore((s) => s.cards);
  const allTags = React.useMemo(() => collectTags(allCards), [allCards]);
  const [idx, setIdx] = React.useState(0);
  const [pass, setPass] = React.useState(1);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [playing, setPlaying] = React.useState(true);
  const [cardLoop, setCardLoop] = React.useState(initialCardLoop);
  const [playlistLoop, setPlaylistLoop] = React.useState(initialLoopPlaylist);
  const [restartNonce, setRestartNonce] = React.useState(0);
  const [hidePercent, setHidePercent] = React.useState(initialHidePercent > 0 ? initialHidePercent : 50);
  const [hideEnabled, setHideEnabled] = React.useState(initialHidePercent > 0);
  const [localCards, setLocalCards] = React.useState(cards);
  const [isShuffled, setIsShuffled] = React.useState(initialShuffle);

  // Sync card updates (edits, deletions) from the global store into localCards
  React.useEffect(() => {
    const byId = new Map(cards.map((c) => [c.id, c]));
    setLocalCards((prev) => {
      const next = prev.filter((c) => byId.has(c.id)).map((c) => byId.get(c.id)!);
      return next.length === prev.length && next.every((c, i) => c === prev[i]) ? prev : next;
    });
  }, [cards]);

  const playingRef = React.useRef(playing);
  React.useEffect(() => { playingRef.current = playing; }, [playing]);
  const cardLoopRef = React.useRef(false);
  React.useEffect(() => { cardLoopRef.current = cardLoop; }, [cardLoop]);
  const playlistLoopRef = React.useRef(initialLoopPlaylist);
  React.useEffect(() => { playlistLoopRef.current = playlistLoop; }, [playlistLoop]);
  const cardsLengthRef = React.useRef(localCards.length);
  React.useEffect(() => { cardsLengthRef.current = localCards.length; }, [localCards.length]);

  const card = localCards[idx];
  const finished = idx >= localCards.length;
  const ttsVoice = settings.ttsVoice;
  const ttsRate = settings.ttsRate ?? 1.0;
  const effectiveRepeat = repeat === "endless" ? 1 : repeat;
  const ttsRateRef = React.useRef(ttsRate);
  React.useEffect(() => { ttsRateRef.current = ttsRate; }, [ttsRate]);
  // Ref so the audio effect always reads the latest card text without card being a dep
  const cardRef = React.useRef(card);
  cardRef.current = card;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    const currentCard = cardRef.current;
    if (!playing || !currentCard || finished) return;
    let cancelled = false;
    const englishText = currentCard.english;
    const japaneseText = currentCard.japanese;

    async function run() {
      for (let p = 1; p <= effectiveRepeat; p++) {
        if (cancelled || !playingRef.current) return;
        setPass(p);
        if (mode === "ja_en" && japaneseText.trim()) {
          setPhase("ja");
          await speakTTS(japaneseText, { lang: "ja", playbackRate: ttsRate });
          if (cancelled || !playingRef.current) return;
          if (delayBeforeEnglish > 0) {
            setPhase("wait");
            await sleep(delayBeforeEnglish * 1000);
          } else {
            await sleep(200);
          }
          if (cancelled || !playingRef.current) return;
        }
        setPhase("en");
        await speakTTS(englishText, { voice: ttsVoice, lang: "en", playbackRate: ttsRate });
        if (cancelled || !playingRef.current) return;
        if (p < effectiveRepeat) await sleep(400);
      }
      if (!cancelled && playingRef.current) {
        setPhase("idle");
        setPass(1);
        if (cardLoopRef.current || repeat === "endless") {
          setRestartNonce((n) => n + 1);
        } else {
          const nextIdx = (playlistLoopRef.current && idx + 1 >= cardsLengthRef.current) ? 0 : idx + 1;
          if (nextIdx === idx) {
            setRestartNonce((n) => n + 1);
          } else {
            setIdx(nextIdx);
          }
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
      stopSpeech();
    };
  }, [idx, playing, mode, repeat, ttsVoice, ttsRate, restartNonce, finished, delayBeforeEnglish]); // card intentionally omitted — edits must not restart audio

  const togglePlay = () => {
    if (playing) {
      stopSpeech();
      setPlaying(false);
    } else {
      setPlaying(true);
    }
  };

  const skipTo = (nextIdx: number) => {
    stopSpeech();
    setPass(1);
    setPhase("idle");
    setIdx(Math.max(0, Math.min(cardsLengthRef.current, nextIdx)));
  };

  const toggleShuffle = React.useCallback(() => {
    if (!isShuffled) {
      setLocalCards((prev) => {
        const before = prev.slice(0, idx + 1);
        const remaining = [...prev.slice(idx + 1)];
        for (let i = remaining.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
        }
        return [...before, ...remaining];
      });
      setIsShuffled(true);
    } else {
      setLocalCards((prev) => {
        const playedIds = new Set(prev.slice(0, idx + 1).map((c) => c.id));
        const played = prev.slice(0, idx + 1);
        const remaining = cards.filter((c) => !playedIds.has(c.id));
        return [...played, ...remaining];
      });
      setIsShuffled(false);
    }
  }, [isShuffled, idx, cards]);

  const restartCard = () => {
    stopSpeech();
    setPass(1);
    setPhase("idle");
    setPlaying(true);
    setRestartNonce((n) => n + 1);
  };

  React.useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (e.key === "c" || e.key === "C") { e.preventDefault(); setHideEnabled((v) => !v); return; }
      if (e.key === "r" || e.key === "R") { e.preventDefault(); setCardLoop((v) => !v); return; }
      if (e.key === "<") {
        e.preventDefault();
        const cur = RATE_OPTIONS.findIndex((r) => r === ttsRateRef.current);
        const next = cur === -1 ? RATE_OPTIONS.findIndex((r) => r === 1.0) : Math.min(RATE_OPTIONS.length - 1, cur + 1);
        updateSettings({ ttsRate: RATE_OPTIONS[next] });
        return;
      }
      if (e.key === ">") {
        e.preventDefault();
        const cur = RATE_OPTIONS.findIndex((r) => r === ttsRateRef.current);
        const next = cur === -1 ? RATE_OPTIONS.findIndex((r) => r === 1.0) : Math.max(0, cur - 1);
        updateSettings({ ttsRate: RATE_OPTIONS[next] });
        return;
      }
      if (e.key === "1") { e.preventDefault(); setHidePercent(HIDE_OPTIONS[0]); setHideEnabled(true); return; }
      if (e.key === "2") { e.preventDefault(); setHidePercent(HIDE_OPTIONS[1]); setHideEnabled(true); return; }
      if (e.key === "3") { e.preventDefault(); setHidePercent(HIDE_OPTIONS[2]); setHideEnabled(true); return; }
      if (e.key === "4") { e.preventDefault(); setHidePercent(HIDE_OPTIONS[3]); setHideEnabled(true); return; }
      if (e.key === "e" || e.key === "E") { e.preventDefault(); toggleShuffle(); return; }
      if (e.key === " ")                  { e.preventDefault(); if (playingRef.current) { stopSpeech(); setPlaying(false); } else { setPlaying(true); } }
      if (e.key === "a" || e.key === "A") { e.preventDefault(); skipTo(idx - 1); }
      if (e.key === "s" || e.key === "S") { e.preventDefault(); restartCard(); }
      if (e.key === "d" || e.key === "D") { e.preventDefault(); skipTo(idx + 1); }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [idx, toggleShuffle]);

  if (finished) {
    return (
      <div className="mx-auto max-w-lg p-4 md:p-10 space-y-6 text-center">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Trophy className="h-8 w-8" />
          </div>
        </div>
        <h2 className="text-3xl font-semibold">Session done 🎧</h2>
        <p className="text-muted-foreground">
          {localCards.length} card{localCards.length === 1 ? "" : "s"} played.
        </p>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => skipTo(0)} variant="outline" size="lg">
            <Repeat className="h-4 w-4" />
            Replay list
          </Button>
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
        title="Listening"
        description={
          mode === "ja_en"
            ? "日本語→英語の順で流します。"
            : "英文を繰り返し流します。"
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={onExit}>
              <Settings2 className="h-4 w-4" />
              Change list
            </Button>
            <Badge variant="outline">
              <Shuffle className="h-3 w-3" /> {mode === "ja_en" ? "JA → EN" : "EN only"}
            </Badge>
            <Badge variant="outline">×{repeat === "endless" ? "∞" : repeat}</Badge>
          </>
        }
      />

      <div className="mx-auto max-w-3xl p-4 md:p-8 space-y-6">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Card {idx + 1} / {localCards.length}
          </span>
          <span>
            Pass {Math.min(pass, effectiveRepeat)} / {repeat === "endless" ? "∞" : repeat}
          </span>
        </div>

        <Card>
          <CardContent className="relative py-10 md:py-14 space-y-8 min-h-[22rem] flex flex-col justify-between">
            <NowPlaying
              phase={phase}
              card={card}
              mode={mode}
              hidePercent={
                (hideMode === "progressive" || hideMode === "reveal") && repeat !== "endless"
                  ? (hideMode === "progressive" ? getProgressiveSchedule : getRevealSchedule)(effectiveRepeat)[
                      Math.min(pass - 1, effectiveRepeat - 1)
                    ]
                  : hidePercent
              }
              hideEnabled={(hideMode === "progressive" || hideMode === "reveal") || hideEnabled}
              onUpdate={(patch) => updateCard(card.id, patch)}
            />

            <div className="space-y-2">
              <Progress value={(Math.min(pass, effectiveRepeat) / effectiveRepeat) * 100} />
              <p className="text-xs text-center text-muted-foreground">
                {phase === "ja"
                  ? "Playing Japanese…"
                  : phase === "en"
                    ? "Playing English…"
                    : phase === "wait"
                      ? "英語を考えてみて…"
                      : playing
                        ? "Loading…"
                        : "Paused"}
              </p>
            </div>

            <div className="flex items-center justify-center gap-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleShuffle}
                aria-label={isShuffled ? "シャッフル解除" : "残りをシャッフル"}
                title={isShuffled ? "シャッフル解除 (E)" : "残りをシャッフル (E)"}
                className={cn(isShuffled && "text-primary bg-primary/10")}
              >
                <Shuffle className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => skipTo(idx - 1)}
                  disabled={idx === 0}
                  aria-label="Previous"
                >
                  <SkipBack className="h-5 w-5" />
                </Button>
                <button
                  onClick={togglePlay}
                  aria-label={playing ? "Pause" : "Play"}
                  className="flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform"
                >
                  {playing ? (
                    <Pause className="h-7 w-7" />
                  ) : (
                    <Play className="h-7 w-7 translate-x-0.5" />
                  )}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => skipTo(idx + 1)}
                  aria-label="Next"
                >
                  <SkipForward className="h-5 w-5" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCardLoop((v) => !v)}
                aria-label={cardLoop ? "音声ループ ON" : "音声ループ OFF"}
                title={cardLoop ? "クリック: ループ解除 (R)" : "クリック: 音声をループ (R)"}
                className={cn(cardLoop && "text-primary bg-primary/10")}
              >
                <Repeat1 className="h-4 w-4" />
              </Button>
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              {(hideMode === "progressive" || hideMode === "reveal") ? (
                <Badge variant="outline" className="text-xs tabular-nums">
                  Pass {Math.min(pass, effectiveRepeat)}: {
                    repeat !== "endless"
                      ? (hideMode === "progressive" ? getProgressiveSchedule : getRevealSchedule)(effectiveRepeat)[
                          Math.min(pass - 1, effectiveRepeat - 1)
                        ]
                      : hideMode === "progressive" ? 100 : 0
                  }% hidden
                </Badge>
              ) : (
                <HideSelector
                  percent={hidePercent}
                  enabled={hideEnabled}
                  onChangePercent={setHidePercent}
                  onToggle={() => setHideEnabled((v) => !v)}
                />
              )}
              <RateSelector rate={ttsRate} onChange={(r) => updateSettings({ ttsRate: r })} />
            </div>
          </CardContent>
        </Card>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPlaylistLoop((v) => !v)}
          className={cn("gap-1.5 text-xs -ml-2", playlistLoop ? "text-primary" : "text-muted-foreground")}
          aria-label={playlistLoop ? "プレイリストループ ON" : "プレイリストループ OFF"}
        >
          <Repeat className="h-3.5 w-3.5" />
          Playlist loop
        </Button>

        <div className="space-y-3">
          <CardTagEditor
            card={card}
            allTags={allTags}
            updateCard={updateCard}
          />
          <RemoveCardDialog
            cardEnglish={card.english}
            onConfirm={() => {
              stopSpeech();
              removeCard(card.id);
              toast.info("Card removed from deck");
              setPass(1);
              setPhase("idle");
            }}
          />
        </div>
      </div>
    </>
  );
}

const HIDE_OPTIONS = [25, 50, 75, 100] as const;

function HideSelector({
  percent,
  enabled,
  onChangePercent,
  onToggle,
}: {
  percent: number;
  enabled: boolean;
  onChangePercent: (p: number) => void;
  onToggle: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handle = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handle);
    return () => document.removeEventListener("pointerdown", handle);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center rounded-md border overflow-hidden">
        <button
          type="button"
          className={cn(
            "h-7 px-2 text-xs flex items-center gap-1 hover:bg-muted transition-colors tabular-nums",
            enabled ? "text-foreground" : "text-muted-foreground",
          )}
          onClick={() => setOpen((v) => !v)}
          aria-label="Hide percentage"
        >
          {percent}%
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
        <div className="w-px h-4 bg-border" />
        <button
          type="button"
          className={cn(
            "h-7 px-2 flex items-center hover:bg-muted transition-colors",
            enabled ? "text-primary" : "text-muted-foreground",
          )}
          onClick={onToggle}
          aria-label={enabled ? "Show English" : "Hide English"}
        >
          {enabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
      {open && (
        <div className="absolute bottom-8 left-0 z-50 rounded-md border bg-popover shadow-md overflow-hidden min-w-[5rem]">
          {HIDE_OPTIONS.map((p) => (
            <button
              key={p}
              type="button"
              className={cn(
                "w-full text-left px-3 py-1.5 text-sm hover:bg-accent tabular-nums",
                percent === p && "text-primary font-medium",
              )}
              onClick={() => { onChangePercent(p); setOpen(false); }}
            >
              {p}%
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const RATE_OPTIONS = [1.5, 1.25, 1.0, 0.75, 0.5] as const;

function RateSelector({ rate, onChange }: { rate: number; onChange: (r: number) => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handle = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handle);
    return () => document.removeEventListener("pointerdown", handle);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-muted-foreground tabular-nums"
        onClick={() => setOpen((v) => !v)}
        aria-label="Playback rate"
      >
        {rate.toFixed(2)}×
      </Button>
      {open && (
        <div className="absolute bottom-8 right-0 z-50 rounded-md border bg-popover shadow-md overflow-hidden min-w-[4.5rem]">
          {RATE_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              className={cn(
                "w-full text-right px-3 py-1.5 text-sm hover:bg-accent tabular-nums",
                rate === r && "text-primary font-medium",
              )}
              onClick={() => { onChange(r); setOpen(false); }}
            >
              {r.toFixed(2)}×
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RemoveCardDialog({
  cardEnglish,
  onConfirm,
}: {
  cardEnglish: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <Trash2 className="h-4 w-4" />
          Remove card
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>このカードを削除しますか？</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground line-clamp-2">
            &ldquo;{cardEnglish}&rdquo;
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NowPlaying({
  phase,
  card,
  mode,
  hidePercent = 50,
  hideEnabled = false,
  onUpdate,
}: {
  phase: Phase;
  card: CardType;
  mode: "en_only" | "ja_en";
  hidePercent?: number;
  hideEnabled?: boolean;
  onUpdate?: (patch: Partial<CardType>) => void;
}) {
  const [editingEn, setEditingEn] = React.useState(false);
  const [editValue, setEditValue] = React.useState("");
  const [displayEnglish, setDisplayEnglish] = React.useState(card.english);
  const [jaValue, setJaValue] = React.useState(card.japanese || "");

  // Reset all edit state when card changes (not on content updates)
  React.useEffect(() => {
    setEditingEn(false);
    setEditValue("");
    setDisplayEnglish(card.english);
    setJaValue(card.japanese || "");
  }, [card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cache hidden-word selection per card.id with the percent they were generated at.
  // On percent increase, new words are added additively (existing blanks preserved).
  // On percent decrease, some hidden words are randomly revealed.
  const tokenCacheRef = React.useRef<Map<string, { tokens: Token[]; percent: number; source: string }>>(new Map());

  const tokens = React.useMemo(() => {
    const cached = tokenCacheRef.current.get(card.id);
    if (!cached || cached.source !== displayEnglish) {
      const t = pickCloze(tokenize(displayEnglish), hidePercent / 100);
      tokenCacheRef.current.set(card.id, { tokens: t, percent: hidePercent, source: displayEnglish });
      return t;
    }
    if (cached.percent === hidePercent) return cached.tokens;
    const adjusted = adjustCloze(cached.tokens, cached.percent / 100, hidePercent / 100);
    tokenCacheRef.current.set(card.id, { tokens: adjusted, percent: hidePercent, source: displayEnglish });
    return adjusted;
  }, [card.id, displayEnglish, hidePercent]);

  const enClass = cn(
    "text-2xl md:text-3xl font-semibold transition-all duration-300 leading-normal w-full text-center",
    phase === "en" ? "text-primary" : "text-foreground/70",
  );

  return (
    <div className="text-center space-y-4 min-h-[8rem] flex flex-col justify-center">
      {mode === "ja_en" && (
        <EditableField
          value={jaValue}
          onChange={setJaValue}
          onBlur={() => { if (jaValue !== card.japanese) onUpdate?.({ japanese: jaValue }); }}
          className={cn(
            "text-2xl font-medium transition-all duration-300",
            phase === "ja" ? "text-primary" : "text-muted-foreground",
          )}
        />
      )}
      <div className="relative group/en">
        {editingEn ? (
          <>
            <EditableField
              value={editValue}
              onChange={setEditValue}
              className={cn(enClass, "text-primary")}
              autoFocus
            />
            <button
              type="button"
              onClick={() => {
                if (editValue !== displayEnglish) {
                  onUpdate?.({ english: editValue });
                  setDisplayEnglish(editValue);
                }
                setEditingEn(false);
              }}
              className="absolute -top-1 -right-1 p-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              aria-label="編集完了"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <p className={enClass}>
              {tokens.map((t, i) => {
                if (!t.hidden || !hideEnabled) return <span key={i}>{t.raw}</span>;
                return (
                  <span
                    key={i}
                    className="select-none"
                    style={{
                      color: "transparent",
                      textDecoration: "underline",
                      textDecorationColor: "var(--color-muted-foreground)",
                      textUnderlineOffset: "3px",
                      opacity: 0.5,
                    }}
                  >
                    {t.raw}
                  </span>
                );
              })}
            </p>
            <button
              type="button"
              onClick={() => { setEditValue(displayEnglish); setEditingEn(true); }}
              className="absolute -top-1 -right-1 p-1 rounded-full text-muted-foreground opacity-0 group-hover/en:opacity-100 hover:bg-muted transition-all"
              aria-label="英文を編集"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
      {mode === "en_only" && card.japanese && (
        <EditableField
          value={jaValue}
          onChange={setJaValue}
          onBlur={() => { if (jaValue !== card.japanese) onUpdate?.({ japanese: jaValue }); }}
          className="text-sm text-muted-foreground"
        />
      )}
      {card.targetWord !== undefined && (
        <div className="flex justify-center">
          <Badge variant="outline">{card.targetWord || "—"}</Badge>
        </div>
      )}
    </div>
  );
}

function EditableField({
  value,
  onChange,
  onBlur,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  className?: string;
  autoFocus?: boolean;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      rows={1}
      autoFocus={autoFocus}
      className={cn(
        "w-full bg-transparent text-center resize-none overflow-hidden leading-normal",
        "rounded px-2 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:bg-muted/20",
        className,
      )}
    />
  );
}

function CardTagEditor({
  card,
  allTags,
  updateCard,
}: {
  card: CardType;
  allTags: { name: string; count: number }[];
  updateCard: (id: string, patch: Partial<CardType>) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const available = allTags.filter((t) => !card.tags.includes(t.name));

  React.useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const remove = (tag: string) =>
    updateCard(card.id, { tags: card.tags.filter((t) => t !== tag) });

  const add = (tag: string) => {
    updateCard(card.id, { tags: [...card.tags, tag] });
    setOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground shrink-0 text-xs">Lists:</span>
      {card.tags.length === 0 && (
        <span className="text-muted-foreground italic text-xs">なし</span>
      )}
      {card.tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="flex items-center gap-1 pr-1 text-xs">
          {tag}
          <button
            type="button"
            onClick={() => remove(tag)}
            className="rounded hover:bg-destructive/20 hover:text-destructive p-0.5"
            aria-label={`Remove from ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <div ref={containerRef} className="relative">
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 rounded-full"
          onClick={() => setOpen((v) => !v)}
          aria-label="Add to list"
          disabled={available.length === 0}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        {open && available.length > 0 && (
          <div className="absolute bottom-8 left-0 z-50 min-w-[8rem] rounded-md border bg-popover shadow-md overflow-hidden">
            {available.map((t) => (
              <button
                key={t.name}
                type="button"
                className="w-full text-left px-3 py-1.5 hover:bg-accent text-sm"
                onClick={() => add(t.name)}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
