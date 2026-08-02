"use client";

import * as React from "react";
import {
  CalendarClock,
  Headphones,
  ListChecks,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Card as CardType } from "@/lib/types";
import { ALL_TAG, buildSession, collectTags } from "@/lib/session";
import type {
  ListeningMode,
  ListeningRepeat,
  SessionConfig,
  SessionFilter,
  SessionLimit,
} from "@/lib/store";
import { useSettingsStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const RATE_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5] as const;

const FILTERS: { value: SessionFilter; label: string; hint: string }[] = [
  { value: "all", label: "All", hint: "every card in the list" },
  { value: "due", label: "Due today", hint: "next-review date has passed" },
  { value: "unmastered", label: "Unmastered", hint: "mastery < 85%" },
  { value: "new", label: "New only", hint: "never attempted (reps = 0)" },
];

const LIMITS: SessionLimit[] = [5, 10, 20, 50, 100, "endless"];
const LISTENING_REPEATS: ListeningRepeat[] = [1, 2, 3, 5, 10, "endless"];

export function SessionSetup({
  title,
  description,
  cards,
  config,
  kind = "quiz",
  onChange,
  onStart,
}: {
  title: string;
  description: string;
  cards: CardType[];
  config: SessionConfig;
  kind?: "quiz" | "listening";
  onChange: (patch: Partial<SessionConfig>) => void;
  onStart: (session: CardType[]) => void;
}) {
  const { settings, update: updateSettings } = useSettingsStore();
  const tags = React.useMemo(() => collectTags(cards), [cards]);
  const preview = React.useMemo(
    () => buildSession(cards, config),
    [cards, config],
  );

  const canStart = preview.length > 0;

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          Setup
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground text-sm max-w-xl">{description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="h-4 w-4" /> 1. Choose list
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <TagChip
            active={config.tag === ALL_TAG}
            label="All cards"
            count={cards.length}
            onClick={() => onChange({ tag: ALL_TAG })}
          />
          {tags.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No tags yet. Add tags to your cards on the Manage page to organize them into lists.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <TagChip
                  key={t.name}
                  active={config.tag === t.name}
                  label={t.name}
                  count={t.count}
                  onClick={() => onChange({ tag: t.name })}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> 2. Filter
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => onChange({ filter: f.value })}
              className={cn(
                "text-left rounded-md border px-3 py-2 transition-colors",
                config.filter === f.value
                  ? "border-primary bg-primary/10"
                  : "hover:bg-accent",
              )}
            >
              <div className="text-sm font-medium">{f.label}</div>
              <div className="text-xs text-muted-foreground">{f.hint}</div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shuffle className="h-4 w-4" /> 3. How many & order
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-[1fr,minmax(0,1.4fr)] md:items-center">
            <Label className="text-sm font-medium">Limit</Label>
            <Select
              value={String(config.limit)}
              onValueChange={(v) =>
                v &&
                onChange({
                  limit:
                    v === "endless"
                      ? "endless"
                      : (Number(v) as Exclude<SessionLimit, "endless">),
                })
              }
            >
              <SelectTrigger className="max-w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIMITS.map((l) => (
                  <SelectItem key={String(l)} value={String(l)}>
                    {l === "endless" ? "Endless" : `${l} cards`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr,minmax(0,1.4fr)] md:items-center">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Shuffle</Label>
              <p className="text-xs text-muted-foreground">
                Off: due order (soonest first)
              </p>
            </div>
            <Switch
              checked={config.shuffle}
              onCheckedChange={(v) => onChange({ shuffle: v })}
            />
          </div>
          {kind === "listening" && (
            <div className="grid gap-2 md:grid-cols-[1fr,minmax(0,1.4fr)] md:items-center">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Playlist loop</Label>
                <p className="text-xs text-muted-foreground">
                  最後のカードが終わったら最初に戻る
                </p>
              </div>
              <Switch
                checked={config.listeningLoopPlaylist ?? false}
                onCheckedChange={(v) => onChange({ listeningLoopPlaylist: v })}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {kind === "listening" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Headphones className="h-4 w-4" /> 4. Playback
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 md:grid-cols-2">
              <ModeTile
                active={config.listeningMode !== "ja_en"}
                title="English only"
                desc="英文だけを流す聞き流し。反復リスニング向け。"
                onClick={() => onChange({ listeningMode: "en_only" })}
              />
              <ModeTile
                active={config.listeningMode === "ja_en"}
                title="Japanese → English"
                desc="日本語→英語の順で流す。瞬間英作文のトレーニング風。"
                onClick={() => onChange({ listeningMode: "ja_en" })}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-[1fr,minmax(0,1.4fr)] md:items-center">
              <Label className="text-sm font-medium">Repeat per card</Label>
              <Select
                value={String(config.listeningRepeat ?? 3)}
                onValueChange={(v) =>
                  v &&
                  onChange({ listeningRepeat: v === "endless" ? "endless" : (Number(v) as ListeningRepeat) })
                }
              >
                <SelectTrigger className="max-w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LISTENING_REPEATS.map((n) => (
                    <SelectItem key={String(n)} value={String(n)}>
                      {n === "endless" ? "Endless" : `${n}× per card`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {config.listeningMode === "ja_en" && (
              <>
                <div className="grid gap-2 md:grid-cols-[1fr,minmax(0,1.4fr)] md:items-start">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">日本語→英語の間隔</Label>
                    <p className="text-xs text-muted-foreground">
                      指定秒数の間、英語を隠してテスト
                    </p>
                  </div>
                  <Select
                    value={String(config.delayBeforeEnglish ?? 0)}
                    onValueChange={(v) => {
                      if (!v) return;
                      onChange({ delayBeforeEnglish: Number(v) });
                    }}
                  >
                    <SelectTrigger className="max-w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">なし</SelectItem>
                      <SelectItem value="3">3秒</SelectItem>
                      <SelectItem value="5">5秒</SelectItem>
                      <SelectItem value="8">8秒</SelectItem>
                      <SelectItem value="10">10秒</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <ModeTile
                    active={(config.jaPlayMode ?? "every") !== "first_only"}
                    title="毎回流す"
                    desc="リピートのたびに日本語→英語の順で再生。"
                    onClick={() => onChange({ jaPlayMode: "every" })}
                  />
                  <ModeTile
                    active={config.jaPlayMode === "first_only"}
                    title="最初の一回のみ"
                    desc="日本語は1回目だけ。2回目以降は英語のみ。"
                    onClick={() => onChange({ jaPlayMode: "first_only" })}
                  />
                </div>
              </>
            )}
            <div className="grid gap-2 md:grid-cols-[1fr,minmax(0,1.4fr)] md:items-center">
              <Label className="text-sm font-medium">再生速度</Label>
              <Select
                value={String(settings.ttsRate ?? 1.0)}
                onValueChange={(v) => v && updateSettings({ ttsRate: Number(v) })}
              >
                <SelectTrigger className="max-w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RATE_OPTIONS.map((r) => (
                    <SelectItem key={String(r)} value={String(r)}>
                      {r.toFixed(2)}×
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 md:grid-cols-[1fr,minmax(0,1.4fr)] md:items-center">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">英語を隠す</Label>
                <p className="text-xs text-muted-foreground">開始時に隠す単語の割合</p>
              </div>
              <Select
                value={
                  config.listeningHideMode === "progressive"
                    ? "progressive"
                    : config.listeningHideMode === "reveal"
                      ? "reveal"
                      : String(config.listeningHidePercent ?? 0)
                }
                onValueChange={(v) => {
                  if (!v) return;
                  if (v === "progressive") {
                    onChange({ listeningHideMode: "progressive" });
                  } else if (v === "reveal") {
                    onChange({ listeningHideMode: "reveal" });
                  } else {
                    onChange({ listeningHideMode: "fixed", listeningHidePercent: Number(v) });
                  }
                }}
              >
                <SelectTrigger className="max-w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">なし</SelectItem>
                  <SelectItem value="25">25%</SelectItem>
                  <SelectItem value="50">50%</SelectItem>
                  <SelectItem value="75">75%</SelectItem>
                  <SelectItem value="100">100%</SelectItem>
                  <SelectItem value="progressive">徐々に増やす</SelectItem>
                  <SelectItem value="reveal">徐々に見せる</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 md:grid-cols-[1fr,minmax(0,1.4fr)] md:items-center">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">カードループ</Label>
                <p className="text-xs text-muted-foreground">
                  1枚のカードを延々と繰り返す
                </p>
              </div>
              <Switch
                checked={config.listeningCardLoop ?? false}
                onCheckedChange={(v) => onChange({ listeningCardLoop: v })}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3">
        <div className="text-sm">
          <span className="font-medium">
            {config.limit === "endless" ? "∞" : preview.length}
          </span>
          <span className="text-muted-foreground">
            {" "}
            card{preview.length === 1 ? "" : "s"} in this session
          </span>
        </div>
        <Button
          size="lg"
          onClick={() => onStart(preview)}
          disabled={!canStart}
        >
          Start
        </Button>
      </div>
    </div>
  );
}

function ModeTile({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left rounded-md border px-3 py-3 transition-colors",
        active ? "border-primary bg-primary/10" : "hover:bg-accent",
      )}
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground mt-1">{desc}</div>
    </button>
  );
}

function TagChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "hover:bg-accent",
      )}
    >
      {label}
      <Badge variant={active ? "secondary" : "outline"}>{count}</Badge>
    </button>
  );
}
