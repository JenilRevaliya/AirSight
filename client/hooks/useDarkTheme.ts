import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

export function useDarkTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("airsight:theme") as Theme) || "dark",
  );

  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const isDark = theme === "dark" || (theme === "system" && prefersDark);
    root.classList.toggle("dark", isDark);
    try {
      localStorage.setItem("airsight:theme", theme);
    } catch {}
  }, [theme]);

  return { theme, setTheme } as const;
}
