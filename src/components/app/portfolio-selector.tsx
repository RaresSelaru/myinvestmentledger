"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  createPortfolioAction,
  selectPortfolioAction,
} from "@/app/(platform)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Portfolio } from "@/lib/types";

export function PortfolioSelector({
  portfolios,
  activePortfolio,
  isLocked,
}: {
  portfolios: Portfolio[];
  activePortfolio: Portfolio;
  isLocked: boolean;
}) {
  const pathname = usePathname();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-14 min-w-0 justify-between gap-4 rounded-2xl bg-white px-4 shadow-[0_10px_28px_rgba(15,35,34,0.06)] sm:min-w-72"
        >
          <span className="min-w-0 text-left">
            <span className="block truncate font-medium">
              {activePortfolio.name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {activePortfolio.baseCurrency}
              {activePortfolio.tags.length ? ` · ${activePortfolio.tags.join(", ")}` : ""}
            </span>
          </span>
          <ChevronsUpDown className="size-4 text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,390px)] p-4">
        <PopoverHeader>
          <PopoverTitle>Portfolios</PopoverTitle>
        </PopoverHeader>

        {isLocked ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm">
            <p className="font-medium">Preview mode</p>
            <p className="mt-1 text-muted-foreground">
              Log in to create and switch real portfolios.
            </p>
            <Button asChild className="mt-3 w-full" size="sm">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {portfolios.map((portfolio) => (
                <form key={portfolio.id} action={selectPortfolioAction}>
                  <input type="hidden" name="portfolioId" value={portfolio.id} />
                  <input type="hidden" name="redirectTo" value={pathname} />
                  <button
                    type="submit"
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-left text-sm transition-colors hover:bg-accent/55",
                      portfolio.id === activePortfolio.id && "bg-accent/70 text-foreground"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{portfolio.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {portfolio.baseCurrency}
                        {portfolio.tags.length ? ` · ${portfolio.tags.join(", ")}` : ""}
                      </span>
                    </span>
                    {portfolio.id === activePortfolio.id ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : null}
                  </button>
                </form>
              ))}
            </div>

            <Separator />

            {showCreate ? (
              <form action={createPortfolioAction} className="space-y-3">
                <input type="hidden" name="redirectTo" value={pathname} />
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input name="name" placeholder="Long-term portfolio" required />
                </div>
                <div className="grid grid-cols-[1fr_112px] gap-2">
                  <div className="space-y-2">
                    <Label>Tags</Label>
                    <Input name="tags" placeholder="core, ETF" />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select name="baseCurrency" defaultValue="RON">
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RON">RON</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="submit" size="sm">
                    Create
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreate(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="size-4" aria-hidden="true" />
                New portfolio
              </Button>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
