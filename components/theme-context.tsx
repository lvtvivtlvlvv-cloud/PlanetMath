"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeType = "standart" | "planet" | "garden";

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType | string) => void;
  mounted: boolean;
}

const normalizeTheme = (t: string | null | undefined): ThemeType => {
  if (t === "planet" || t === "clock") return "planet";
  if (t === "garden") return "garden";
  return "standart";
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProviderWrapper({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>("standart");
  const [mounted, setMounted] = useState(false);

  const applyThemeToDom = (newTheme: ThemeType) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const domTheme = normalizeTheme(newTheme);
    root.setAttribute("data-theme", domTheme);

    // Все темы имеют темный режим
    root.setAttribute("data-mode", "dark");
    root.classList.add("dark");
  };

  useEffect(() => {
    let savedTheme: ThemeType = "standart";
    try {
      const stored = localStorage.getItem("app-theme");
      savedTheme = normalizeTheme(stored);
    } catch {
      savedTheme = "standart";
    }
    setThemeState(savedTheme);
    applyThemeToDom(savedTheme);
    setMounted(true);
  }, []);

  const setTheme = (newTheme: ThemeType | string) => {
    const normalized = normalizeTheme(newTheme);
    setThemeState(normalized);
    try {
      localStorage.setItem("app-theme", normalized);
    } catch {}
    applyThemeToDom(normalized);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within ThemeProviderWrapper");
  }
  return context;
}