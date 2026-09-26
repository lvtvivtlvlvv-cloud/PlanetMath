"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeType = "base" | "standart-plus" | "clock" | "garden";

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProviderWrapper({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>("base");
  const [mounted, setMounted] = useState(false);

  const applyThemeToDom = (newTheme: ThemeType) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.setAttribute("data-theme", newTheme);

    if (newTheme === "clock" || newTheme === "standart-plus" || newTheme === "garden") {
      root.setAttribute("data-mode", "dark");
      root.classList.add("dark");
    } else {
      root.setAttribute("data-mode", "light");
      root.classList.remove("dark");
    }
  };

  useEffect(() => {
    let savedTheme: ThemeType = "base";
    try {
      savedTheme = (localStorage.getItem("app-theme") as ThemeType) || "base";
    } catch {
      savedTheme = "base";
    }
    setThemeState(savedTheme);
    applyThemeToDom(savedTheme);
    setMounted(true);
  }, []);

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem("app-theme", newTheme);
    } catch {}
    applyThemeToDom(newTheme);
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