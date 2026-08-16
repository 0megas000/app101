import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "pwx-theme";

interface ThemeState {
  choice: ThemeChoice;
  /** What is actually on screen right now, with "system" resolved. */
  resolved: "light" | "dark";
  setChoice: (choice: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

function systemPrefers(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function readStored(): ThemeChoice | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === "light" || raw === "dark" || raw === "system" ? raw : null;
}

/**
 * `defaultChoice` differs by surface: the kiosk is a dark-first appliance,
 * while the admin dashboard is ordinary software and should respect the
 * operator's OS setting until they say otherwise.
 */
export function ThemeProvider({ children, defaultChoice = "system" }: { children: React.ReactNode; defaultChoice?: ThemeChoice }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(() => readStored() ?? defaultChoice);
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => systemPrefers());

  // Track the OS setting so "system" stays live rather than snapshotting.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setSystemTheme(mq.matches ? "light" : "dark");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved = choice === "system" ? systemTheme : choice;

  useEffect(() => {
    const root = document.documentElement;
    if (choice === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", choice);
  }, [choice]);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    if (next === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ choice, resolved, setChoice }), [choice, resolved, setChoice]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme used outside ThemeProvider");
  return ctx;
}

/** Three-way segmented control: light · system · dark. */
export function ThemeToggle({ compact }: { compact?: boolean }) {
  const { choice, setChoice } = useTheme();
  const options: { value: ThemeChoice; icon: string; label: string }[] = [
    { value: "light", icon: "☀", label: "Light" },
    { value: "system", icon: "◐", label: "Match system" },
    { value: "dark", icon: "☾", label: "Dark" },
  ];
  const shown = compact ? options.filter((o) => o.value !== "system") : options;

  return (
    <div className="theme-toggle" role="group" aria-label="Colour theme">
      {shown.map((o) => (
        <button
          key={o.value}
          aria-pressed={choice === o.value}
          aria-label={o.label}
          title={o.label}
          onClick={() => setChoice(o.value)}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}

/**
 * Applies the stored theme before React mounts, so a reload never flashes
 * the wrong palette. Inlined into index.html as a blocking script.
 */
export const THEME_BOOTSTRAP = `
try {
  var t = localStorage.getItem("${STORAGE_KEY}");
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
} catch (e) {}
`;
