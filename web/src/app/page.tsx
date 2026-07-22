"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Headphones,
  LibraryBig,
  Repeat,
  Flame,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useCardStore } from "@/lib/store";

export default function HomePage() {
  const cards = useCardStore((s) => s.cards);
  const now = Date.now();
  const due = cards.filter((c) => new Date(c.dueAt).getTime() <= now).length;
  const total = cards.length;
  const mastered = cards.filter((c) => c.mastery >= 85).length;
  const avgMastery = Math.round(
    cards.reduce((a, c) => a + c.mastery, 0) / Math.max(total, 1),
  );

  const recent = [...cards]
    .sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 4);

  const [greet, setGreet] = React.useState("");
  React.useEffect(() => {
    const h = new Date().getHours();
    setGreet(
      h < 5
        ? "Still up?"
        : h < 12
          ? "Good morning"
          : h < 18
            ? "Good afternoon"
            : "Good evening",
    );
  }, []);

  return (
    <div className="p-4 md:p-10 space-y-8 max-w-6xl mx-auto w-full">
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          fillin²
        </div>
        <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">
          {greet || "Welcome back"}.
        </h1>
        <p className="text-muted-foreground max-w-xl">
          {due > 0
            ? `${due} 枚のカードが今日の復習を待っています。`
            : "今日の復習は完了しています 🎉 新しいカードを追加するか、Quizで練習しましょう。"}
        </p>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            render={<Link href={due > 0 ? "/review" : "/quiz"} />}
            nativeButton={false}
            size="lg"
          >
            {due > 0 ? "Start today's review" : "Start a quick quiz"}
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button render={<Link href="/manage" />} nativeButton={false} variant="outline" size="lg">
            <LibraryBig className="h-4 w-4" />
            Manage vocabulary
          </Button>
        </div>
      </section>

      <section className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard
          icon={<Target className="h-4 w-4" />}
          label="Due today"
          value={due}
          hint={`${total} total cards`}
        />
        <StatCard
          icon={<Flame className="h-4 w-4" />}
          label="Streak"
          value="7d"
          hint="keep it going"
        />
        <StatCard
          icon={<Sparkles className="h-4 w-4" />}
          label="Avg mastery"
          value={`${avgMastery}%`}
        />
        <StatCard
          icon={<Target className="h-4 w-4" />}
          label="Mastered"
          value={mastered}
          hint={`${Math.round((mastered / Math.max(total, 1)) * 100)}% of deck`}
        />
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <QuickTile
          href="/quiz"
          icon={<BookOpen className="h-5 w-5" />}
          title="Quiz"
          desc="穴埋め問題を音声/テキストで解く"
        />
        <QuickTile
          href="/listening"
          icon={<Headphones className="h-5 w-5" />}
          title="Listening"
          desc="音声を聞いて書き取り。設定回数だけ繰り返し再生"
        />
        <QuickTile
          href="/review"
          icon={<Repeat className="h-5 w-5" />}
          title="Review"
          desc="スペース反復で今日やるべきカードを消化"
        />
      </section>

      <section>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Recently practiced</CardTitle>
            <Button
              render={<Link href="/manage" />}
              nativeButton={false}
              variant="ghost"
              size="sm"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recent.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No cards yet. Import a CSV or add one in Manage.
              </p>
            )}
            {recent.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-medium">{c.english}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.japanese}
                  </p>
                </div>
                {c.targetWord && (
                  <Badge variant="outline" className="hidden sm:inline-flex">
                    {c.targetWord}
                  </Badge>
                )}
                <div className="flex items-center gap-2 shrink-0">
                  <Progress value={c.mastery} className="h-1.5 w-16" />
                  <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                    {c.mastery}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="py-4 space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="text-2xl md:text-3xl font-semibold tabular-nums">
          {value}
        </div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function QuickTile({
  href,
  icon,
  title,
  desc,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border p-5 hover:bg-accent transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <span className="font-medium">{title}</span>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{desc}</p>
    </Link>
  );
}
