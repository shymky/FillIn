"use client";

import * as React from "react";
import {
  Download,
  Upload,
  Plus,
  Sparkles,
  Trash2,
  Search,
  Wand2,
  Tag as TagIcon,
  X,
  ListPlus,
  ClipboardList,
  GripVertical,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card as UICard,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useCardStore } from "@/lib/store";
import { cardsToCsv, csvToCards } from "@/lib/csv";
import { collectTags } from "@/lib/session";
import type { Card } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ManagePage() {
  const cards = useCardStore((s) => s.cards);
  const updateCard = useCardStore((s) => s.updateCard);
  const removeCard = useCardStore((s) => s.removeCard);
  const addCard = useCardStore((s) => s.addCard);
  const replaceAll = useCardStore((s) => s.replaceAll);
  const [query, setQuery] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [activeTag, setActiveTag] = React.useState<string | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [addToListOpen, setAddToListOpen] = React.useState(false);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);
  // Ref so the stable drop callback can always see the latest cards array
  const cardsRef = React.useRef(cards);
  React.useEffect(() => { cardsRef.current = cards; }, [cards]);
  const dragIdRef = React.useRef<string | null>(null);
  React.useEffect(() => { dragIdRef.current = dragId; }, [dragId]);

  // Stable callbacks — identity never changes, so React.memo on EditableRow works
  const onRowDragStart = React.useCallback((id: string) => setDragId(id), []);
  const onRowDragOver  = React.useCallback((id: string) =>
    // Only update state when the hovered row actually changed (prevents 60fps re-renders)
    setDragOverId((prev) => (prev === id ? prev : id)), []);
  const onRowDrop = React.useCallback((targetId: string) => {
    const currentDragId = dragIdRef.current;
    setDragId(null);
    setDragOverId(null);
    if (!currentDragId || currentDragId === targetId) return;
    const next = [...cardsRef.current];
    const from = next.findIndex((c) => c.id === currentDragId);
    const to   = next.findIndex((c) => c.id === targetId);
    if (from === -1 || to === -1) return;
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    replaceAll(next);
  }, [replaceAll]);
  const onRowDragEnd = React.useCallback(() => {
    setDragId(null);
    setDragOverId(null);
  }, []);

  const filtered = cards.filter((c) => {
    if (activeTag && !c.tags.includes(activeTag)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.targetWord?.toLowerCase().includes(q) ?? false) ||
      c.japanese.toLowerCase().includes(q) ||
      c.english.toLowerCase().includes(q) ||
      c.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  // Clear selection when filter changes
  React.useEffect(() => {
    setSelectedIds(new Set());
  }, [query, activeTag]);

  const allSelected =
    filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));
  const someSelected = filtered.some((c) => selectedIds.has(c.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)));
    }
  };

  const toggleOne = React.useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const bulkDelete = () => {
    for (const id of selectedIds) removeCard(id);
    toast.success(`Deleted ${selectedIds.size} cards`);
    setSelectedIds(new Set());
  };

  const bulkAddToList = (tagName: string) => {
    let count = 0;
    for (const id of selectedIds) {
      const c = cards.find((x) => x.id === id);
      if (!c || c.tags.includes(tagName)) continue;
      updateCard(id, { tags: [...c.tags, tagName] });
      count++;
    }
    toast.success(`Added ${count} cards to "${tagName}"`);
    setAddToListOpen(false);
  };

  const bulkRemoveFromList = () => {
    if (!activeTag) return;
    let count = 0;
    for (const id of selectedIds) {
      const c = cards.find((x) => x.id === id);
      if (!c || !c.tags.includes(activeTag)) continue;
      updateCard(id, { tags: c.tags.filter((t) => t !== activeTag) });
      count++;
    }
    toast.success(`Removed ${count} cards from "${activeTag}"`);
    setSelectedIds(new Set());
  };

  const exportCsv = () => {
    const blob = new Blob([cardsToCsv(cards)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fillin2-cards-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${cards.length} cards`);
  };

  const importCsv = async (file: File) => {
    const text = await file.text();
    const parsed = csvToCards(text);
    if (parsed.length === 0) {
      toast.error("No valid rows found");
      return;
    }
    replaceAll(parsed);
    toast.success(`Imported ${parsed.length} cards`);
  };

  const allTags = React.useMemo(() => collectTags(cards), [cards]);

  return (
    <>
      <PageHeader
        title="Manage"
        description="単語表を編集・追加・削除。CSVで一括入出力、AIで自動生成もできます。"
        actions={
          <>
            <AiGenerateDialog />
            <PasteTableDialog activeTag={activeTag} />
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importCsv(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const now = new Date().toISOString();
                addCard({
                  id: `new-${Date.now()}`,
                  english: "",
                  japanese: "",
                  targetWord: undefined,
                  tags: activeTag ? [activeTag] : [],
                  mastery: 0,
                  dueAt: now,
                  ease: 2.5,
                  reps: 0,
                  lapses: 0,
                  createdAt: now,
                  updatedAt: now,
                });
                toast.success("New card added");
              }}
            >
              <Plus className="h-4 w-4" />
              New
            </Button>
          </>
        }
      />

      <div className="p-4 md:p-8 space-y-6">
        <ListsPanel
          cards={cards}
          activeTag={activeTag}
          onSelect={setActiveTag}
        />

        <div className="flex items-center gap-2 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search English, 日本語, target word, tag..."
              className="pl-8"
            />
          </div>
          <Badge variant="secondary">
            {filtered.length} / {cards.length}
          </Badge>
          {activeTag && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setActiveTag(null)}
            >
              <X className="h-4 w-4" /> Clear filter
            </Button>
          )}
        </div>

        <PickListDialog
          open={addToListOpen}
          onOpenChange={setAddToListOpen}
          tags={allTags}
          onPick={bulkAddToList}
        />

        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[28px]" />
                  <TableHead className="w-[40px]">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected && !allSelected;
                      }}
                      onChange={toggleAll}
                      className="h-4 w-4 accent-primary cursor-pointer"
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="min-w-[280px]">English</TableHead>
                  <TableHead className="min-w-[220px]">日本語</TableHead>
                  <TableHead className="w-[160px]">Target word</TableHead>
                  <TableHead className="w-[140px]">Tags</TableHead>
                  <TableHead className="w-[100px]">Mastery</TableHead>
                  <TableHead className="w-[110px]">Due</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <EditableRow
                    key={c.id}
                    card={c}
                    update={updateCard}
                    remove={removeCard}
                    selected={selectedIds.has(c.id)}
                    onToggle={toggleOne}
                    draggable={true}
                    isDragging={dragId === c.id}
                    isDragOver={dragOverId === c.id}
                    onDragStart={onRowDragStart}
                    onDragOver={onRowDragOver}
                    onDrop={onRowDrop}
                    onDragEnd={onRowDragEnd}
                  />
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-muted-foreground py-8"
                    >
                      No cards match. Try removing filters or add a new one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Floating bulk action bar — fixed so table never shifts */}
      <div
        className={cn(
          "fixed bottom-6 left-1/2 -translate-x-1/2 z-40 transition-all duration-200",
          someSelected ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none",
        )}
      >
        <div className="flex items-center gap-1.5 rounded-full border bg-background shadow-xl px-4 py-2 text-sm">
          <span className="font-medium pr-1">{selectedIds.size} selected</span>
          <div className="h-4 border-l mx-0.5" />
          <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setAddToListOpen(true)}>
            <ListPlus className="h-4 w-4" /> Add to list
          </Button>
          {activeTag && (
            <Button size="sm" variant="ghost" className="rounded-full" onClick={bulkRemoveFromList}>
              <TagIcon className="h-4 w-4" /> Remove from &ldquo;{activeTag}&rdquo;
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full text-destructive hover:text-destructive"
            onClick={bulkDelete}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          <div className="h-4 border-l mx-0.5" />
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-full"
            onClick={() => setSelectedIds(new Set())}
            aria-label="Deselect"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </>
  );
}

const EditableRow = React.memo(function EditableRow({
  card,
  update,
  remove,
  selected,
  onToggle,
  draggable: isDraggable,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  card: Card;
  update: (id: string, patch: Partial<Card>) => void;
  remove: (id: string) => void;
  selected: boolean;
  onToggle: (id: string) => void;
  draggable: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDrop: (id: string) => void;
  onDragEnd: () => void;
}) {
  const id = card.id;
  return (
    <TableRow
      draggable={isDraggable}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(id); }}
      onDragOver={(e) => { e.preventDefault(); onDragOver(id); }}
      onDrop={(e) => { e.preventDefault(); onDrop(id); }}
      onDragEnd={onDragEnd}
      className={cn(
        selected && "bg-primary/5",
        isDragging && "opacity-40",
        isDragOver && "border-t-2 border-primary",
      )}
    >
      <TableCell className="w-[28px] px-1">
        {isDraggable && (
          <GripVertical className="h-4 w-4 text-muted-foreground/30 hover:text-muted-foreground cursor-grab" />
        )}
      </TableCell>
      <TableCell>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(id)}
          className="h-4 w-4 accent-primary cursor-pointer"
          aria-label="Select row"
        />
      </TableCell>
      <TableCell>
        <Input
          value={card.english}
          onChange={(e) => update(card.id, { english: e.target.value })}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <Input
          value={card.japanese}
          onChange={(e) => update(card.id, { japanese: e.target.value })}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <Input
          value={card.targetWord ?? ""}
          onChange={(e) =>
            update(card.id, { targetWord: e.target.value || undefined })
          }
          className="h-8"
          placeholder="optional"
        />
      </TableCell>
      <TableCell>
        <Input
          value={card.tags.join(", ")}
          onChange={(e) =>
            update(card.id, {
              tags: e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            })
          }
          className="h-8"
          placeholder="verb, food"
        />
      </TableCell>
      <TableCell className="text-right">
        <span className="tabular-nums text-sm font-medium">{card.mastery}</span>
        <span className="text-muted-foreground text-xs"> / 100</span>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground tabular-nums">
        {new Date(card.dueAt).toISOString().slice(0, 10)}
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => remove(card.id)}
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </TableCell>
    </TableRow>
  );
});

function PickListDialog({
  open,
  onOpenChange,
  tags,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tags: { name: string; count: number }[];
  onPick: (tagName: string) => void;
}) {
  const [newTag, setNewTag] = React.useState("");

  React.useEffect(() => {
    if (!open) setNewTag("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add selected cards to list</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="New list name…"
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTag.trim()) {
                  onPick(newTag.trim());
                }
              }}
            />
            <Button
              onClick={() => newTag.trim() && onPick(newTag.trim())}
              disabled={!newTag.trim()}
            >
              Add
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="divide-y rounded-md border max-h-60 overflow-y-auto">
              {tags.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-accent flex items-center justify-between text-sm"
                  onClick={() => onPick(t.name)}
                >
                  {t.name}
                  <Badge variant="outline">{t.count}</Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function parseBold(text: string): { english: string; targetWord?: string } {
  const match = text.match(/\*\*([^*]+)\*\*/);
  if (!match) return { english: text };
  return { english: text.replace(/\*\*/g, ""), targetWord: match[1] };
}

type ParsedRow = { english: string; japanese: string; targetWord?: string };

function parseTable(text: string): ParsedRow[] {
  const lines = text.trim().split("\n").filter((l) => l.trim());
  if (!lines.length) return [];

  const isMarkdown = lines.some((l) => l.includes("|"));

  if (isMarkdown) {
    return lines.flatMap((l) => {
      if (/^\s*\|[-:\s|]+\|\s*$/.test(l)) return []; // separator row
      const cells = l.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.length < 2) return [];
      const [engRaw, jaRaw] = cells;
      // Skip header
      if (/^(英語|english)/i.test(engRaw)) return [];
      const { english, targetWord } = parseBold(engRaw);
      if (!english || !jaRaw) return [];
      return [{ english, japanese: jaRaw, targetWord }];
    });
  }

  // TSV
  return lines.flatMap((l) => {
    const cells = l.split("\t");
    if (cells.length < 2) return [];
    const { english, targetWord } = parseBold(cells[0].trim());
    const japanese = cells[1].trim();
    if (!english || !japanese) return [];
    return [{ english, japanese, targetWord }];
  });
}

function PasteTableDialog({ activeTag }: { activeTag: string | null }) {
  const addCard = useCardStore((s) => s.addCard);
  const [open, setOpen] = React.useState(false);
  const [raw, setRaw] = React.useState("");
  const [tag, setTag] = React.useState("");

  React.useEffect(() => {
    if (open) setTag(activeTag ?? "");
  }, [open, activeTag]);

  const parsed = React.useMemo(() => parseTable(raw), [raw]);

  const commit = () => {
    const now = new Date().toISOString();
    const tags = tag.trim()
      ? tag
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    for (const row of [...parsed].reverse()) {
      addCard({
        id: `paste-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        english: row.english,
        japanese: row.japanese,
        targetWord: row.targetWord,
        tags,
        mastery: 0,
        dueAt: now,
        ease: 2.5,
        reps: 0,
        lapses: 0,
        createdAt: now,
        updatedAt: now,
      });
    }
    toast.success(`Added ${parsed.length} cards`);
    setRaw("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <ClipboardList className="h-4 w-4" />
        Paste table
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Paste table
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-0.5">
          <p className="text-xs text-muted-foreground">
            スプレッドシート（タブ区切り）またはマークダウン表をそのままペースト。英語・日本語の列順で認識。
            {" "}<code className="bg-muted px-1 rounded">**太字**</code>はターゲットワードとして自動抽出されます。
          </p>
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={7}
            placeholder={"English\t日本語\nI'm about to leave.\t今まさに出かけるところです。\n\n// またはマークダウン表をそのままペースト:\n| English | 日本語 |\n| --- | --- |\n| I'm **about to leave**. | 今まさに出かけるところです。 |"}
            className="font-mono text-xs"
          />
          <div className="flex items-center gap-3">
            <Label className="shrink-0 text-sm">Add to list</Label>
            <Input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="list name (optional, comma-separated)"
              className="h-8"
            />
          </div>
          {parsed.length > 0 && (
            <div className="rounded-md border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 text-xs text-muted-foreground">
                <span>Preview</span>
                <span>{parsed.length} rows</span>
              </div>
              <div className="max-h-40 overflow-y-auto divide-y">
                {parsed.slice(0, 100).map((r, i) => (
                  <div key={i} className="px-3 py-1.5 flex gap-3 text-xs">
                    <span className="flex-1 truncate">{r.english}</span>
                    <span className="flex-1 truncate text-muted-foreground">{r.japanese}</span>
                    {r.targetWord && (
                      <span className="text-primary shrink-0">[{r.targetWord}]</span>
                    )}
                  </div>
                ))}
                {parsed.length > 100 && (
                  <div className="px-3 py-1.5 text-xs text-muted-foreground">
                    … and {parsed.length - 100} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={commit} disabled={parsed.length === 0}>
            <Plus className="h-4 w-4" />
            Import {parsed.length > 0 ? `(${parsed.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AiGenerateDialog() {
  const addCard = useCardStore((s) => s.addCard);
  const [open, setOpen] = React.useState(false);
  const [prompt, setPrompt] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const run = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    // Mock generation until Ollama endpoint is wired up.
    await new Promise((r) => setTimeout(r, 900));
    const now = new Date().toISOString();
    const samples = [
      {
        english: "I would rather stay home than go out tonight.",
        japanese: "今夜は出かけるより家にいたい。",
        targetWord: "would rather",
        tags: ["grammar", "modal"],
      },
      {
        english: "She might have forgotten about the meeting.",
        japanese: "彼女はミーティングのことを忘れていたのかもしれない。",
        targetWord: "might have",
        tags: ["grammar", "modal"],
      },
      {
        english: "You should have told me earlier.",
        japanese: "もっと早く教えてくれればよかったのに。",
        targetWord: "should have",
        tags: ["grammar", "modal"],
      },
    ];
    for (const s of samples) {
      addCard({
        id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ...s,
        mastery: 0,
        dueAt: now,
        ease: 2.5,
        reps: 0,
        lapses: 0,
        createdAt: now,
        updatedAt: now,
      });
    }
    setBusy(false);
    setPrompt("");
    setOpen(false);
    toast.success(`Generated ${samples.length} cards (mock)`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="secondary" size="sm" />}>
        <Sparkles className="h-4 w-4" />
        AI generate
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            Generate cards with AI
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ai-prompt">Prompt</Label>
            <Textarea
              id="ai-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="e.g. 助動詞を使った表現、ネガティブな表現"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Uses local Ollama ({"llama3.2"}) once the backend is wired up. Now returns mock samples.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={run} disabled={busy || !prompt.trim()}>
            <Sparkles className="h-4 w-4" />
            {busy ? "Generating..." : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ListsPanel({
  cards,
  activeTag,
  onSelect,
}: {
  cards: Card[];
  activeTag: string | null;
  onSelect: (tag: string | null) => void;
}) {
  const tags = React.useMemo(() => collectTags(cards), [cards]);
  const [newName, setNewName] = React.useState("");
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [assignTag, setAssignTag] = React.useState<string>("");

  const createTag = () => {
    const name = newName.trim();
    if (!name) return;
    if (tags.some((t) => t.name === name)) {
      toast.info("That list already exists");
      return;
    }
    setAssignTag(name);
    setAssignOpen(true);
    setNewName("");
  };

  return (
    <UICard>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <TagIcon className="h-4 w-4" /> Lists
        </CardTitle>
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New list name"
            className="h-8 w-40"
            onKeyDown={(e) => e.key === "Enter" && createTag()}
          />
          <Button size="sm" variant="secondary" onClick={createTag}>
            <Plus className="h-4 w-4" />
            Create
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No lists yet. Create one above, then assign cards to it.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <ListChip
              active={activeTag === null}
              label="All"
              count={cards.length}
              onClick={() => onSelect(null)}
            />
            {tags.map((t) => (
              <ListChip
                key={t.name}
                active={activeTag === t.name}
                label={t.name}
                count={t.count}
                onClick={() => onSelect(activeTag === t.name ? null : t.name)}
              />
            ))}
          </div>
        )}
      </CardContent>

      <AssignDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        cards={cards}
        tagName={assignTag}
      />
    </UICard>
  );
}

function ListChip({
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
        "inline-flex items-center gap-2 rounded-full border pl-3 pr-2 py-1 text-sm transition-colors",
        active ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent",
      )}
    >
      {label}
      <Badge variant={active ? "secondary" : "outline"}>{count}</Badge>
    </button>
  );
}

function AssignDialog({
  open,
  onOpenChange,
  cards,
  tagName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cards: Card[];
  tagName: string;
}) {
  const updateCard = useCardStore((s) => s.updateCard);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [initialPicked, setInitialPicked] = React.useState<Set<string>>(new Set());
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setPicked(new Set());
      setInitialPicked(new Set());
      setQuery("");
      return;
    }
    const existing = new Set(
      cards.filter((c) => c.tags.includes(tagName)).map((c) => c.id),
    );
    setPicked(existing);
    setInitialPicked(existing);
  }, [open, cards, tagName]);

  const filtered = cards.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      c.english.toLowerCase().includes(q) ||
      c.japanese.toLowerCase().includes(q) ||
      (c.targetWord?.toLowerCase().includes(q) ?? false)
    );
  });

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const commit = () => {
    let added = 0;
    let removed = 0;
    for (const c of cards) {
      const wasIn = initialPicked.has(c.id);
      const isIn = picked.has(c.id);
      if (!wasIn && isIn) {
        updateCard(c.id, { tags: [...c.tags, tagName] });
        added++;
      } else if (wasIn && !isIn) {
        updateCard(c.id, { tags: c.tags.filter((t) => t !== tagName) });
        removed++;
      }
    }
    const parts: string[] = [];
    if (added) parts.push(`${added} added`);
    if (removed) parts.push(`${removed} removed`);
    toast.success(parts.length ? `${parts.join(", ")} in "${tagName}"` : "No changes");
    onOpenChange(false);
  };

  const allFiltered = filtered.length > 0 && filtered.every((c) => picked.has(c.id));
  const toggleAllFiltered = () => {
    if (allFiltered) {
      setPicked((prev) => {
        const next = new Set(prev);
        for (const c of filtered) next.delete(c.id);
        return next;
      });
    } else {
      setPicked((prev) => {
        const next = new Set(prev);
        for (const c of filtered) next.add(c.id);
        return next;
      });
    }
  };

  const changedCount = (() => {
    let n = 0;
    for (const c of cards) {
      if (initialPicked.has(c.id) !== picked.has(c.id)) n++;
    }
    return n;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage &ldquo;{tagName}&rdquo;</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cards…"
              className="flex-1"
            />
            <Button size="sm" variant="ghost" onClick={toggleAllFiltered}>
              {allFiltered ? "Deselect all" : "Select all"}
            </Button>
          </div>
          <div className="max-h-72 overflow-y-auto border rounded-md divide-y">
            {filtered.slice(0, 200).map((c) => {
              const isPicked = picked.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 flex items-start gap-3 hover:bg-accent",
                    isPicked && "bg-primary/10",
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0 rounded border-2",
                      isPicked
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/50",
                    )}
                  />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-medium">{c.english}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.japanese}
                    </p>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="p-4 text-sm text-center text-muted-foreground">
                No cards match.
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {picked.size} cards in this list
            {changedCount > 0 && ` · ${changedCount} change${changedCount > 1 ? "s" : ""} pending`}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={commit} disabled={changedCount === 0}>
            Save{changedCount > 0 ? ` (${changedCount})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
