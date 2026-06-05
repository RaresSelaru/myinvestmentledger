"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      aria-label="Toggle theme"
      onClick={() => {
        const isDark = document.documentElement.classList.contains("dark");
        setTheme(isDark ? "light" : "dark");
      }}
      className="text-muted-foreground hover:text-foreground"
    >
      <span className="relative flex size-4 items-center justify-center">
        <Sun
          className="absolute size-4 scale-100 rotate-0 opacity-100 transition-all duration-300 dark:scale-50 dark:rotate-90 dark:opacity-0"
          aria-hidden="true"
        />
        <Moon
          className="absolute size-4 scale-50 -rotate-90 opacity-0 transition-all duration-300 dark:scale-100 dark:rotate-0 dark:opacity-100"
          aria-hidden="true"
        />
      </span>
    </Button>
  );
}
