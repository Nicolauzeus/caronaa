import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";
const STORAGE_KEY = "caronaa-theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch { /* Storage can be unavailable. */ }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const sync = () => setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    applyTheme(getInitialTheme());
    sync();

    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        applyTheme(getInitialTheme());
        sync();
      }
    };
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onSystemTheme = () => {
      try {
        if (window.localStorage.getItem(STORAGE_KEY)) return;
      } catch { /* Follow system theme if storage is unavailable. */ }
      applyTheme(getInitialTheme());
      sync();
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("storage", onStorage);
    media?.addEventListener?.("change", onSystemTheme);
    return () => {
      observer.disconnect();
      window.removeEventListener("storage", onStorage);
      media?.removeEventListener?.("change", onSystemTheme);
    };
  }, []);

  function toggleTheme() {
    const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
    applyTheme(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* Keep the current display. */ }
    setTheme(next);
  }

  return (
    <Button type="button" variant="outline" size="icon" className={className}
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo noturno"}
      title={theme === "dark" ? "Modo claro" : "Modo noturno"}>
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </Button>
  );
}
