import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";
import { getWorkspaceShellData } from "@/lib/data";

export default async function PlatformLayout({
  children,
}: {
  children: ReactNode;
}) {
  const workspace = await getWorkspaceShellData();

  return <AppShell workspace={workspace}>{children}</AppShell>;
}
