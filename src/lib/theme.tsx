import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
type ThemeContextValue = { theme: Theme; setTheme: (theme: Theme) => void; toggleTheme: () => void };

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "leadmachine-theme";

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const next: Theme = saved === "dark" ? "dark" : "light";
    setThemeState(next);
    applyTheme(next);
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  };

  const value = useMemo(() => ({ theme, setTheme, toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark") }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
