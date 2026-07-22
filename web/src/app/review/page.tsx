"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, Flame, Target, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCardStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function ReviewPage() {
  const cards = useCardStore((s) => s.cards);
  const now = Date.now();

  const dueToday = cards.filter((c) => new Date(c.dueAt).getTime() <= now);
  const upcoming = cards
    .filter((c) => new Date(c.dueAt).getTime() > now)
    .sort(
      (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
    )
    .slice(0, 10);

  const avgMastery = Math.round(
    cards.reduce((a, c) => a + c.mastery, 0) / Math.max(cards.length, 1),
  );

  const buckets = [
    { label: "New (0-24)", min: 0, max: 24, color: "bg-destructive" },
    { label: "Learning (25-59)", min: 25, max: 59, color: "bg-orange-500" },
    { label: "Reviewing (60-84)", min: 60, max: 84, color: "bg-yellow-500" },
    { label: "Mastered (85-100)", min: 85, max: 100, color: "bg-primary" },
  ];
  const distribution = buckets.map((b) => ({
    ...b,
    count: cards.filter((c) => c.mastery >= b.min && c.mastery <= b.max).length,
  }));
  const total = Math.max(cards.length, 1);

  return (
    <>
      <PageHeader
        title="Review"
        description="スペース反復。今日やるべきカードと進捗を確認。"
        actions={
          <Button render={<Link href="/quiz" />} nativeButton={false} size="sm">
            Start review →
          </Button>
        }
      />

      <div className="p-4 md:p-8 space-y-6">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <StatCard
            icon={<CalendarClock className="h-4 w-4" />}
            label="Due today"
            value={dueToday.length}
            hint={`${cards.length} total`}
          />
          <StatCard
            icon={<Target className="h-4 w-4" />}
            label="Avg mastery"
            value={`${avgMastery}%`}
            hint="across all cards"
          />
          <StatCard
            icon={<Flame className="h-4 w-4" />}
            label="Streak"
            value="7d"
            hint="mock value"
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Reviewed"
            value="128"
            hint="last 7 days"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mastery distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {distribution.map((d) => (
                <div
                  key={d.label}
                  className={cn("h-full", d.color)}
                  style={{ width: `${(d.count / total) * 100}%` }}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {distribution.map((d) => (
                <div key={d.label} className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", d.color)} />
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="ml-auto font-medium tabular-nums">
                    {d.count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="flex items-center justify-between flex-row">
              <CardTitle className="text-base">Due now</CardTitle>
              <Badge variant="destructive">{dueToday.length}</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <QueueTable rows={dueToday} emptyLabel="All caught up 🎉" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between flex-row">
              <CardTitle className="text-base">Upcoming</CardTitle>
              <Badge variant="secondary">{upcoming.length}</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <QueueTable rows={upcoming} emptyLabel="Nothing scheduled." />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
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
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function QueueTable({
  rows,
  emptyLabel,
}: {
  rows: import("@/lib/types").Card[];
  emptyLabel: string;
}) {
  if (rows.length === 0)
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Card</TableHead>
          <TableHead className="hidden md:table-cell">Meaning</TableHead>
          <TableHead className="w-[140px]">Mastery</TableHead>
          <TableHead className="w-[110px]">Due</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium max-w-[240px] truncate">
              {c.targetWord || c.english}
            </TableCell>
            <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
              {c.japanese}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Progress value={c.mastery} className="h-1.5 w-16" />
                <span className="text-xs tabular-nums text-muted-foreground">
                  {c.mastery}
                </span>
              </div>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground tabular-nums">
              {new Date(c.dueAt).toISOString().slice(0, 10)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
