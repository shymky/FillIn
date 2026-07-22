"use client";

import * as React from "react";
import { Check, Palette, RefreshCcw, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useSettingsStore } from "@/lib/store";
import type { Difficulty } from "@/lib/types";

const TTS_VOICES = [
  "en-US-JennyNeural",
  "en-US-GuyNeural",
  "en-US-AriaNeural",
  "en-GB-SoniaNeural",
  "en-GB-RyanNeural",
];
const STT_LANGS = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "en-AU", label: "English (Australia)" },
];
const MODELS = ["llama3.2", "llama3.1", "qwen2.5", "mistral"];

const ACCENT_PRESETS: { name: string; light: string; dark: string }[] = [
  { name: "Forest", light: "#2F8459", dark: "#3FA26E" },
  { name: "Crimson", light: "#DA273C", dark: "#EA4657" },
  { name: "Ocean", light: "#0F6FB6", dark: "#3A99DC" },
  { name: "Amber", light: "#C77A0F", dark: "#E4A44C" },
  { name: "Violet", light: "#6B3FA0", dark: "#9A76CF" },
  { name: "Slate", light: "#334155", dark: "#94A3B8" },
];

function isValidHex(v: string) {
  return /^#[0-9a-f]{6}$/i.test(v);
}

export default function SettingsPage() {
  const { settings, update, reset } = useSettingsStore();
  const [karaoke, setKaraoke] = React.useState(true);

  return (
    <>
      <PageHeader
        title="Settings"
        description="発音の許容度、TTS 話者、Ollama モデルなどを調整。"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              reset();
              toast.success("Reset to defaults");
            }}
          >
            <RefreshCcw className="h-4 w-4" />
            Reset
          </Button>
        }
      />

      <div className="p-4 md:p-8 space-y-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <AccentPicker />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grading</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Row
              label="Pronunciation tolerance"
              hint={`${(settings.pronunciationTolerance * 100).toFixed(0)}% match required to accept`}
            >
              <Slider
                value={[settings.pronunciationTolerance * 100]}
                min={30}
                max={100}
                step={5}
                onValueChange={(v) => {
                  const n = Array.isArray(v) ? v[0] : v;
                  update({ pronunciationTolerance: n / 100 });
                }}
                className="max-w-sm"
              />
            </Row>
            <Row
              label="Cloze rate"
              hint={`Hides ~${(settings.clozeRate * 100).toFixed(0)}% of words per sentence`}
            >
              <Slider
                value={[settings.clozeRate * 100]}
                min={10}
                max={80}
                step={5}
                onValueChange={(v) => {
                  const n = Array.isArray(v) ? v[0] : v;
                  update({ clozeRate: n / 100 });
                }}
                className="max-w-sm"
              />
            </Row>
            <Row
              label="Difficulty"
              hint="Weights sentence selection & scoring bonuses"
            >
              <Select
                value={settings.difficulty}
                onValueChange={(v) => v && update({ difficulty: v as Difficulty })}
              >
                <SelectTrigger className="max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row
              label="Karaoke mode"
              hint="Highlight words dynamically while speaking"
            >
              <Switch checked={karaoke} onCheckedChange={setKaraoke} />
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Speech</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Row label="TTS voice" hint="edge-tts / SpeechSynthesis voice">
              <Select
                value={settings.ttsVoice}
                onValueChange={(v) => v && update({ ttsVoice: v })}
              >
                <SelectTrigger className="max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TTS_VOICES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row label="STT language" hint="Web Speech API recognition locale">
              <Select
                value={settings.sttLang}
                onValueChange={(v) => v && update({ sttLang: v })}
              >
                <SelectTrigger className="max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STT_LANGS.map((v) => (
                    <SelectItem key={v.value} value={v.value}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row
              label="Listening repeat"
              hint="How many times to repeat a sentence in Listening mode"
            >
              <Select
                value={String(settings.listeningRepeat)}
                onValueChange={(v) =>
                  v && update({
                    listeningRepeat: Number(v) as 1 | 2 | 3 | 5 | 10,
                  })
                }
              >
                <SelectTrigger className="max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 5, 10].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}× per sentence
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              AI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Row
              label="Ollama model"
              hint="Local model used for grading & card generation"
            >
              <Select
                value={settings.ollamaModel}
                onValueChange={(v) => v && update({ ollamaModel: v })}
              >
                <SelectTrigger className="max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row label="Ollama endpoint" hint="Base URL for local Ollama HTTP API">
              <Input
                defaultValue="http://localhost:11434"
                className="max-w-sm"
              />
            </Row>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-[1fr,minmax(0,1.4fr)] md:items-center">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function AccentPicker() {
  const accent = useSettingsStore((s) => s.settings.accentColor);
  const accentDark = useSettingsStore((s) => s.settings.accentColorDark);
  const update = useSettingsStore((s) => s.update);
  const [draft, setDraft] = React.useState(accent);
  const [draftDark, setDraftDark] = React.useState(accentDark);

  React.useEffect(() => setDraft(accent), [accent]);
  React.useEffect(() => setDraftDark(accentDark), [accentDark]);

  const applyLight = (v: string) => {
    setDraft(v);
    if (isValidHex(v)) update({ accentColor: v });
  };
  const applyDark = (v: string) => {
    setDraftDark(v);
    if (isValidHex(v)) update({ accentColorDark: v });
  };

  return (
    <div className="space-y-5">
      <Row label="Accent presets" hint="ワンクリックで light/dark をまとめて切替">
        <div className="flex flex-wrap gap-2">
          {ACCENT_PRESETS.map((p) => {
            const active =
              accent.toLowerCase() === p.light.toLowerCase() &&
              accentDark.toLowerCase() === p.dark.toLowerCase();
            return (
              <button
                key={p.name}
                type="button"
                onClick={() =>
                  update({ accentColor: p.light, accentColorDark: p.dark })
                }
                title={`${p.name} — ${p.light}`}
                className={cn(
                  "group relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition-transform",
                  active
                    ? "border-foreground scale-105"
                    : "border-border hover:scale-105",
                )}
                style={{ backgroundColor: p.light }}
                aria-label={p.name}
              >
                {active && (
                  <Check
                    className="h-4 w-4"
                    style={{
                      color:
                        p.name === "Slate" || p.name === "Violet"
                          ? "#FFF"
                          : "#FFF",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </Row>

      <Row label="Light mode" hint="通常テーマで使う色">
        <div className="flex items-center gap-2 max-w-sm">
          <input
            type="color"
            value={isValidHex(draft) ? draft : accent}
            onChange={(e) => applyLight(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-md border bg-background p-1"
          />
          <Input
            value={draft}
            onChange={(e) => applyLight(e.target.value)}
            className="h-9 font-mono uppercase"
            placeholder="#2F8459"
          />
        </div>
      </Row>

      <Row label="Dark mode" hint="ダークテーマで使う色(明るめ推奨)">
        <div className="flex items-center gap-2 max-w-sm">
          <input
            type="color"
            value={isValidHex(draftDark) ? draftDark : accentDark}
            onChange={(e) => applyDark(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-md border bg-background p-1"
          />
          <Input
            value={draftDark}
            onChange={(e) => applyDark(e.target.value)}
            className="h-9 font-mono uppercase"
            placeholder="#3FA26E"
          />
        </div>
      </Row>

      <Row label="Preview" hint="実際の primary ボタン/バッジがこの色になります">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Primary</Button>
          <Button size="sm" variant="secondary">
            Secondary
          </Button>
          <Button size="sm" variant="outline">
            Outline
          </Button>
          <span className="rounded-md bg-primary/15 px-2 py-1 text-xs font-medium text-primary">
            Highlight
          </span>
        </div>
      </Row>
    </div>
  );
}
