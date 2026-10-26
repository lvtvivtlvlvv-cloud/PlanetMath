"use client";

import React from "react";
import { useAppTheme } from "./theme-context";
import { Globe, CalendarDays, Sun, Moon } from "lucide-react";

export function ThemeSwitcher() {
  const {
    colorMode,
    setColorMode,
    scheduleViewMode,
    setScheduleViewMode,
    mounted,
  } = useAppTheme();

  if (!mounted) {
    return (
      <div className="h-9 w-44 sm:w-56 rounded-xl bg-sky-500/10 border border-sky-500/20 animate-pulse shrink-0" />
    );
  }

  const isLight = colorMode === "light";

  return (
    <div
      className="flex items-center gap-1.5 sm:gap-2 select-none shrink-0 max-w-full"
      style={{
        marginRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      {/* 1. Переключатель вида расписания: Планета / Стандартное */}
      <div
        role="group"
        aria-label="Режим отображения расписания"
        className={`flex items-center rounded-xl p-0.5 border transition-colors ${
          isLight
            ? "bg-sky-100/80 border-sky-300/70 text-slate-700 shadow-xs"
            : "bg-[#090D16]/90 border-sky-500/25 text-zinc-300 shadow-inner"
        }`}
      >
        <button
          type="button"
          onClick={() => setScheduleViewMode("planet")}
          title="Режим расписания в виде планеты"
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
            scheduleViewMode === "planet"
              ? isLight
                ? "bg-sky-500 text-white shadow-sm"
                : "bg-sky-500/25 text-sky-300 border border-sky-400/40 shadow-[0_0_12px_rgba(56,189,248,0.25)]"
              : isLight
              ? "text-slate-600 hover:text-slate-900 hover:bg-sky-200/50"
              : "text-zinc-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Globe className="h-3.5 w-3.5 shrink-0" />
          <span>Планета</span>
        </button>

        <button
          type="button"
          onClick={() => setScheduleViewMode("standard")}
          title="Стандартный режим расписания (по дням недели)"
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
            scheduleViewMode === "standard"
              ? isLight
                ? "bg-sky-500 text-white shadow-sm"
                : "bg-sky-500/25 text-sky-300 border border-sky-400/40 shadow-[0_0_12px_rgba(56,189,248,0.25)]"
              : isLight
              ? "text-slate-600 hover:text-slate-900 hover:bg-sky-200/50"
              : "text-zinc-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span>Стандарт</span>
        </button>
      </div>

      {/* 2. Переключатель темы Planet: Тёмная / Светлая */}
      <div
        role="group"
        aria-label="Тема оформления Planet (Тёмная / Светлая)"
        className={`flex items-center rounded-xl p-0.5 border transition-colors ${
          isLight
            ? "bg-sky-100/80 border-sky-300/70 text-slate-700 shadow-xs"
            : "bg-[#090D16]/90 border-sky-500/25 text-zinc-300 shadow-inner"
        }`}
      >
        <button
          type="button"
          onClick={() => setColorMode("dark")}
          title="Тёмная тема Planet"
          className={`flex items-center gap-1 rounded-lg px-2 sm:px-2.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
            colorMode === "dark"
              ? "bg-sky-500/25 text-sky-300 border border-sky-400/40 shadow-[0_0_12px_rgba(56,189,248,0.25)]"
              : "text-slate-600 hover:text-slate-900 hover:bg-sky-200/50"
          }`}
        >
          <Moon className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden md:inline">Тёмная</span>
        </button>

        <button
          type="button"
          onClick={() => setColorMode("light")}
          title="Светлая тема Planet"
          className={`flex items-center gap-1 rounded-lg px-2 sm:px-2.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
            colorMode === "light"
              ? "bg-sky-500 text-white shadow-sm"
              : "text-zinc-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Sun className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden md:inline">Светлая</span>
        </button>
      </div>
    </div>
  );
}
