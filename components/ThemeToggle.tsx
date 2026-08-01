"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // Private browsing / storage disabled — theme just won't persist across reloads.
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // Reads the data-theme attribute the blocking <script> in the root
    // layout already set from localStorage before paint — this can't be
    // read during SSR (no document/window), so it has to happen post-mount,
    // which is exactly what useEffect is for here (syncing from an external
    // system, not derived state).
    const stored = document.documentElement.getAttribute("data-theme") as Theme | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  }, []);

  if (!theme) return null;

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to bright theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Switch to bright theme" : "Switch to dark theme"}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-sm"
    >
      {theme === "dark" ? "☀" : "🌙"}
    </button>
  );
}
