"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { useSettingsStore } from "@/lib/store";

export function pickReadableForeground(hex: string): string {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return "#FFFFFF";
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 0xff;
  const g = (int >> 8) & 0xff;
  const b = int & 0xff;
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const L = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  return L > 0.55 ? "#0E1712" : "#FFFFFF";
}

const VARS = [
  "--primary",
  "--ring",
  "--chart-1",
  "--sidebar-primary",
  "--sidebar-ring",
] as const;

export function AccentApplier() {
  const accent = useSettingsStore((s) => s.settings.accentColor);
  const accentDark = useSettingsStore((s) => s.settings.accentColorDark);
  const { resolvedTheme } = useTheme();

  React.useEffect(() => {
    const el = document.documentElement;
    const color = resolvedTheme === "dark" ? accentDark : accent;
    const fg = pickReadableForeground(color);
    for (const v of VARS) el.style.setProperty(v, color);
    el.style.setProperty("--primary-foreground", fg);
    el.style.setProperty("--sidebar-primary-foreground", fg);
  }, [accent, accentDark, resolvedTheme]);

  return null;
}
