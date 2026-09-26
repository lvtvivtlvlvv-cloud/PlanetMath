"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeType = "base" | "standart" | "standart-plus" | "clock" | "garden";

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProviderWrapper({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>("standart");
  const [mounted, setMounted] = useState(false);

  const applyThemeToDom = (newTheme: ThemeType) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const domTheme = newTheme === "standart-plus" ? "standart" : newTheme;
    root.setAttribute("data-theme", domTheme);

    if (domTheme === "clock" || domTheme === "standart" || domTheme === "garden") {
      root.setAttribute("data-mode", "dark");
      root.classList.add("dark");
    } else {
      root.setAttribute("data-mode", "light");
      root.classList.remove("dark");
    }
  };

  useEffect(() => {
    let savedTheme: ThemeType = "standart";
    try {
      const stored = localStorage.getItem("app-theme") as ThemeType;
      if (stored) {
        savedTheme = stored === "standart-plus" ? "standart" : stored;
      }
    } catch {
      savedTheme = "standart";
    }
    setThemeState(savedTheme);
    applyThemeToDom(savedTheme);
    setMounted(true);
  }, []);

  const setTheme = (newTheme: ThemeType) => {
    const normalized = newTheme === "standart-plus" ? "standart" : newTheme;
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