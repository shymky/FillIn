"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Headphones,
  Home,
  LibraryBig,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Repeat,
  ScrollText,
  Settings as SettingsIcon,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { useUiStore } from "@/lib/store";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/quiz", label: "Quiz", icon: BookOpen },
  { href: "/listening", label: "Listening", icon: Headphones },
  { href: "/browse", label: "Browse", icon: ScrollText },
  { href: "/manage", label: "Manage", icon: LibraryBig },
  { href: "/review", label: "Review", icon: Repeat },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "hidden md:flex md:flex-col md:border-r md:bg-sidebar md:text-sidebar-foreground transition-[width] duration-200 sticky top-0 h-screen shrink-0",
        collapsed ? "md:w-14" : "md:w-60",
      )}
    >
      <div
        className={cn(
          "flex items-center border-b h-14 px-3 gap-2",
          collapsed && "justify-center px-0",
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        {!collapsed && (
          <span className="font-semibold tracking-tight">fillin²</span>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {items.map((it) => {
          const active = isActive(pathname, it.href);
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              title={collapsed ? it.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md text-sm transition-colors",
                collapsed ? "justify-center h-9 w-9 mx-auto" : "px-3 py-2",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && it.label}
            </Link>
          );
        })}
      </nav>

      <div
        className={cn(
          "border-t p-2 flex items-center gap-1",
          collapsed ? "flex-col" : "justify-between",
        )}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
        <ThemeToggle />
      </div>
    </aside>
  );
}

export function MobileHeader() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="flex md:hidden items-center justify-between border-b px-3 h-14">
      <div className="flex items-center gap-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" />}>
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="border-b h-14 px-4 flex-row items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Sparkles className="h-4 w-4" />
              </div>
              <SheetTitle className="font-semibold tracking-tight">
                fillin²
              </SheetTitle>
            </SheetHeader>
            <nav className="p-2 space-y-1">
              {items.map((it) => {
                const active = isActive(pathname, it.href);
                const Icon = it.icon;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {it.label}
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <span className="font-semibold tracking-tight">fillin²</span>
        </div>
      </div>
      <ThemeToggle />
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const bottomItems = items.filter((i) => i.href !== "/settings" && i.href !== "/");
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur">
      <ul className="grid grid-cols-5" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {bottomItems.map((it) => {
          const active = isActive(pathname, it.href);
          const Icon = it.icon;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px]",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

