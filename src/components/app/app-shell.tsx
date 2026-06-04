"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowDownToLine,
  BarChart3,
  BriefcaseBusiness,
  Landmark,
  LogOut,
  Menu,
  Settings2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { WorkspaceData } from "@/lib/types";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/portfolio", label: "Portfolio", icon: BriefcaseBusiness },
  { href: "/transactions", label: "Transactions", icon: TableProperties },
  { href: "/imports", label: "Imports", icon: ArrowDownToLine },
  { href: "/strategy", label: "Strategy", icon: Settings2 },
];

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <nav className="grid gap-1">
      {navigation.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              active && "bg-sidebar-accent text-sidebar-accent-foreground"
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  workspace,
  children,
}: {
  workspace: WorkspaceData;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const brokerAccount =
    workspace.brokerAccounts[0]?.id ?? "no-broker-account";

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-sidebar px-4 py-5 lg:block">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Landmark className="size-4" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Investment Ledger
          </span>
        </Link>
        <div className="mt-8">
          <NavLinks pathname={pathname} />
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b bg-background/88 backdrop-blur-xl">
          <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-3 text-left">
                    <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                      <Landmark className="size-4" aria-hidden="true" />
                    </span>
                    Investment Ledger
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <NavLinks pathname={pathname} />
                </div>
              </SheetContent>
            </Sheet>

            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <Select value={workspace.activePortfolio.id}>
                <SelectTrigger className="h-8 w-[190px] bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workspace.portfolios.map((portfolio) => (
                    <SelectItem key={portfolio.id} value={portfolio.id}>
                      {portfolio.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={brokerAccount}>
                <SelectTrigger className="hidden h-8 w-[190px] bg-card sm:flex">
                  <SelectValue placeholder="Broker account" />
                </SelectTrigger>
                <SelectContent>
                  {workspace.brokerAccounts.length ? (
                    workspace.brokerAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-broker-account">
                      No broker account
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-9 gap-2 px-2"
                  aria-label="Open user menu"
                >
                  <Avatar className="size-7">
                    <AvatarFallback className="text-xs">
                      {initials(workspace.userEmail)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-40 truncate text-sm md:inline">
                    {workspace.userEmail}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <UserRound className="size-4" aria-hidden="true" />
                  <span className="truncate">{workspace.userEmail}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/strategy">Portfolio settings</Link>
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
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <Separator className="opacity-0" />
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
