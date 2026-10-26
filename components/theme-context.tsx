"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeType = "planet";
export type ColorMode = "dark" | "light";
export type ScheduleViewMode = "planet" | "standard";

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType | string) => void;
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  toggleColorMode: () => void;
  scheduleViewMode: ScheduleViewMode;
  setScheduleViewMode: (mode: ScheduleViewMode) => void;
  toggleScheduleViewMode: () => void;
  mounted: boolean;
}

const normalizeColorMode = (m: string | null | undefined): ColorMode => {
  return m === "light" ? "light" : "dark";
};

const normalizeScheduleViewMode = (v: string | null | undefined): ScheduleViewMode => {
  return v === "standard" ? "standard" : "planet";
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProviderWrapper({ children }: { children: React.ReactNode }) {
  const [colorMode, setColorModeState] = useState<ColorMode>("dark");
  const [scheduleViewMode, setScheduleViewModeState] = useState<ScheduleViewMode>("planet");
  const [mounted, setMounted] = useState(false);

  const applyToDom = (mode: ColorMode) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.setAttribute("data-theme", "planet");
    root.setAttribute("data-mode", mode);

    if (mode === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
    }
  };

  useEffect(() => {
    let savedMode: ColorMode = "dark";
    let savedScheduleView: ScheduleViewMode = "planet";
    try {
      savedMode = normalizeColorMode(localStorage.getItem("planet-color-mode"));
      savedScheduleView = normalizeScheduleViewMode(localStorage.getItem("planet-schedule-view"));
      localStorage.setItem("app-theme", "planet");
    } catch {}
    setColorModeState(savedMode);
    setScheduleViewModeState(savedScheduleView);
    applyToDom(savedMode);
    setMounted(true);
  }, []);

  const setColorMode = (newMode: ColorMode) => {
    const normalized = normalizeColorMode(newMode);
    setColorModeState(normalized);
    try {
      localStorage.setItem("planet-color-mode", normalized);
    } catch {}
    applyToDom(normalized);
  };

  const toggleColorMode = () => {
    setColorMode(colorMode === "dark" ? "light" : "dark");
  };

  const setScheduleViewMode = (newView: ScheduleViewMode) => {
    const normalized = normalizeScheduleViewMode(newView);
    setScheduleViewModeState(normalized);
    try {
      localStorage.setItem("planet-schedule-view", normalized);
    } catch {}
  };

  const toggleScheduleViewMode = () => {
    setScheduleViewMode(scheduleViewMode === "planet" ? "standard" : "planet");
  };

  const setTheme = () => {
    // Оставлена только тема planet
    try {
      localStorage.setItem("app-theme", "planet");
    } catch {}
    applyToDom(colorMode);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: "planet",
        setTheme,
        colorMode,
        setColorMode,
        toggleColorMode,
        scheduleViewMode,
        setScheduleViewMode,
        toggleScheduleViewMode,
        mounted,
      }}
    >
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