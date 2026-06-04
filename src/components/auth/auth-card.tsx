import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/app/brand-mark";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Card className="border-border/70 bg-card/95 shadow-2xl shadow-black/20">
      <CardHeader className="space-y-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <BrandMark className="size-10" />
          <span className="text-sm font-semibold tracking-tight">
            My Investment Ledger
          </span>
        </Link>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="text-sm leading-6 text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
