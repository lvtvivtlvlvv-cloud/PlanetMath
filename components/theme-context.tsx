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
  viewMode: ScheduleViewMode;
  setViewMode: (mode: ScheduleViewMode) => void;
  mounted: boolean;
}

const normalizeColorMode = (m: string | null | undefined): ColorMode => {
  return m === "light" ? "light" : "dark";
};

const normalizeScheduleViewMode = (v: string | null | undefined): ScheduleViewMode => {
  if (v === "standard" || v === "calendar" || v === "classic") return "standard";
  return "planet";
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProviderWrapper({ children }: { children: React.ReactNode }) {
  const [colorMode, setColorModeState] = useState<ColorMode>("dark");
  const [scheduleViewMode, setScheduleViewModeState] = useState<ScheduleViewMode>("planet");
  const [mounted, setMounted] = useState(false);

  const applyToDom = (mode: ColorMode) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.setAttribute("data-theme", mode === "dark" ? "planet-dark" : "planet-light");
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
        viewMode: scheduleViewMode,
        setViewMode: setScheduleViewMode,
        mounted,
      }}
    >
      <div
        className={`min-h-screen w-full transition-colors duration-300 planet-ambient-bg ${
          colorMode === "light" ? "text-slate-900" : "text-zinc-100"
        }`}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAppTheme must be used inside ThemeProviderWrapper");
  return ctx;
}