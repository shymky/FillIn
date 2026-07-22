"use client";

import * as React from "react";
import { Volume2, Search, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCardStore, useSettingsStore } from "@/lib/store";
import { collectTags } from "@/lib/session";
import { speak as speakTTS, detectLang } from "@/lib/tts";
import { cn } from "@/lib/utils";

export default function BrowsePage() {
  const cards = useCardStore((s) => s.cards);
  const settings = useSettingsStore((s) => s.settings);
  const [query, setQuery] = React.useState("");
  const [activeTag, setActiveTag] = React.useState<string | null>(null);

  const tags = React.useMemo(() => collectTags(cards).map((t) => t.name), [cards]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((c) => {
      if (activeTag && !c.tags.includes(activeTag)) return false;
      if (!q) return true;
      return (
        c.english.toLowerCase().includes(q) ||
        c.japanese.toLowerCase().includes(q) ||
        (c.targetWord?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [cards, query, activeTag]);

  const speak = (text: string) => {
    void speakTTS(text, { voice: settings.ttsVoice, lang: detectLang(text) });
  };

  return (
    <>
      <PageHeader
        title="Browse"
        description="登録済みの英文を一覧で確認。"
        actions={
          <Badge variant="secondary">{filtered.length} cards</Badge>
        }
      />

      <div className="mx-auto max-w-3xl p-4 md:p-8 space-y-4">
        {/* Filter bar */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search English / Japanese..."
              className="pl-9"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((name) => (
                <button
                  key={name}
                  onClick={() => setActiveTag(activeTag === name ? null : name)}
                  className={cn(
                    "px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors",
                    activeTag === name
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-transparent hover:border-border hover:text-foreground",
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Card list */}
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">No cards found.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border">
            {filtered.map((card) => (
              <li key={card.id} className="flex items-start gap-3 px-4 py-4 hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-base md:text-lg font-medium leading-snug">{card.english}</p>
                  <p className="text-sm text-muted-foreground">
                    {card.targetWord && (
                      <span className="font-semibold text-foreground mr-1.5">{card.targetWord}</span>
                    )}
                    {card.japanese}
                  </p>
                  {card.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {card.tags.map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px] py-0 h-4">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => speak(card.english)}
                  className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground"
                  aria-label="Play"
                >
                  <Volume2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
