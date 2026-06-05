"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  BarChart3,
  BriefcaseBusiness,
  LockKeyhole,
  LogOut,
  Menu,
  Settings2,
  SlidersHorizontal,
  TableProperties,
  UserRound,
} from "lucide-react";
import { signOutAction } from "@/app/(platform)/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BrandMark } from "@/components/app/brand-mark";
import { PortfolioSelector } from "@/components/app/portfolio-selector";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { cn } from "@/lib/utils";
import type { WorkspaceShellData } from "@/lib/types";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/portfolio", label: "Portfolio", icon: BriefcaseBusiness },
  { href: "/transactions", label: "Activity", icon: TableProperties },
  { href: "/imports", label: "Imports", icon: ArrowDownToLine },
  { href: "/strategy", label: "Strategy", icon: SlidersHorizontal },
  { href: "/settings", label: "Settings", icon: Settings2 },
];
const navigationHrefs = navigation.map((item) => item.href);

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: (href: string) => void;
}) {
  return (
    <nav className="grid gap-2">
      {navigation.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={true}
            onNavigate={() => onNavigate?.(item.href)}
            className={cn(
              "group flex h-12 items-center gap-3 rounded-2xl px-4 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              active &&
                "bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_12px_28px_rgba(20,130,72,0.08)]"
            )}
          >
            <Icon
              className={cn(
                "size-[1.125rem] transition-colors group-hover:text-primary",
                active && "text-primary"
              )}
              aria-hidden="true"
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function PreviewBanner() {
  return (
    <div className="border-b border-primary/15 bg-primary/10 px-4 py-3 text-sm sm:px-6 lg:px-9">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-foreground">
          <LockKeyhole className="size-4 text-primary" aria-hidden="true" />
          Preview mode. Log in to import files, create portfolios, and save changes.
        </span>
        <Button asChild size="sm">
          <Link href="/login">Log in</Link>
        </Button>
      </div>
    </div>
  );
}

export function AppShell({
  workspace,
  children,
}: {
  workspace: WorkspaceShellData;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);
  const pendingPath =
    optimisticPath && optimisticPath !== pathname ? optimisticPath : null;
  const visiblePathname = pendingPath ?? pathname;

  useEffect(() => {
    let cancelled = false;

    function warmRoutes() {
      for (const href of navigationHrefs) {
        if (!cancelled && href !== pathname) {
          router.prefetch(href, {
            kind: "full",
            onInvalidate: warmRoutes,
          } as Parameters<typeof router.prefetch>[1]);
        }
      }
    }

    const timeout = window.setTimeout(warmRoutes, 250);
    const onFocus = () => warmRoutes();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        warmRoutes();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [pathname, router]);

  function handleNavigate(href: string) {
    if (href !== pathname) {
      setOptimisticPath(href);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-[19rem] border-r border-sidebar-border bg-sidebar px-6 py-7 lg:block">
        <Link
          href="/dashboard"
          prefetch={true}
          onNavigate={() => handleNavigate("/dashboard")}
          className="flex items-center gap-3.5"
        >
          <BrandMark />
          <span className="min-w-0">
            <span className="block text-base font-semibold tracking-tight">
              My Investment Ledger
            </span>
            <span className="block text-xs text-muted-foreground">
              Portfolio cockpit
            </span>
          </span>
        </Link>
        <div className="mt-10">
          <NavLinks pathname={visiblePathname} onNavigate={handleNavigate} />
        </div>
      </aside>

      <div className="lg:pl-[19rem]">
        <header className="sticky top-0 z-30 border-b border-border/70 bg-card/82 backdrop-blur-xl">
          <div className="flex min-h-24 items-center gap-3 px-4 sm:px-6 lg:px-9">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className="lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 bg-sidebar">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-3 text-left">
                    <BrandMark />
                    My Investment Ledger
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <NavLinks pathname={visiblePathname} onNavigate={handleNavigate} />
                </div>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <PortfolioSelector
                portfolios={workspace.portfolios}
                activePortfolio={workspace.activePortfolio}
                isLocked={workspace.isLocked}
              />
            </div>

            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-12 gap-2 rounded-2xl px-2.5 text-foreground"
                  aria-label="Open user menu"
                >
                  <Avatar className="size-10">
                    <AvatarFallback className="text-xs">
                      {initials(workspace.userEmail)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-44 truncate text-sm md:inline">
                    {workspace.isLocked ? "Preview" : workspace.userEmail}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <UserRound className="size-4" aria-hidden="true" />
                  <span className="truncate">
                    {workspace.isLocked ? "Preview mode" : workspace.userEmail}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {workspace.isLocked ? (
                  <DropdownMenuItem asChild>
                    <Link href="/login">Log in</Link>
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/settings">Settings</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <form action={signOutAction}>
                      <DropdownMenuItem asChild>
                        <button className="w-full" type="submit">
                          <LogOut className="size-4" aria-hidden="true" />
                          Log out
                        </button>
                      </DropdownMenuItem>
                    </form>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {pendingPath ? (
            <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-primary/10">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
            </div>
          ) : null}
          {workspace.isLocked ? <PreviewBanner /> : null}
        </header>
        <Separator className="opacity-0" />
        <main className="px-4 py-8 sm:px-6 lg:px-9">{children}</main>
      </div>
    </div>
  );
}
