"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "playful";

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Bright", icon: "☀" },
  { value: "dark", label: "Dark", icon: "🌙" },
  { value: "playful", label: "Playful", icon: "🎨" },
];

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
    const stored = document.documentElement.getAttribute("data-theme") as Theme | null;
    const initial: Theme = stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(initial);
  }, []);

  if (!theme) return null;

  return (
    <div role="group" aria-label="Theme" className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => {
            applyTheme(opt.value);
            setTheme(opt.value);
          }}
          aria-pressed={theme === opt.value}
          title={opt.label}
          className={`flex h-7 w-7 items-center justify-center rounded text-xs ${
            theme === opt.value ? "bg-surface shadow-sm" : "opacity-60 hover:opacity-100"
          }`}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}
