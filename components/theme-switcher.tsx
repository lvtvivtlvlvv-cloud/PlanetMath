"use client";

import React from "react";
import { useAppTheme } from "./theme-context";
import { Globe, CalendarDays, Sun, Moon } from "lucide-react";

interface ThemeSwitcherProps {
  modeOnly?: boolean;
}

export function ThemeSwitcher({ modeOnly = false }: ThemeSwitcherProps) {
  const {
    colorMode,
    toggleColorMode,
    scheduleViewMode,
    setScheduleViewMode,
    mounted,
  } = useAppTheme();

  if (!mounted) {
    return (
      <div
        className={`h-8 ${
          modeOnly ? "w-9" : "w-32 sm:w-44"
        } rounded-xl bg-slate-500/10 animate-pulse shrink-0`}
      />
    );
  }

  const isLight = colorMode === "light";

  // На странице входа показываем только компактный переключатель Светлой / Тёмной темы
  if (modeOnly) {
    return (
      <button
        type="button"
        onClick={toggleColorMode}
        title={isLight ? "Включить тёмную тему" : "Включить светлую тему"}
        aria-label={isLight ? "Включить тёмную тему" : "Включить светлую тему"}
        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer select-none ${
          isLight
            ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950 shadow-xs"
            : "border-white/10 bg-[#111726]/90 text-zinc-200 hover:bg-white/10 hover:text-white shadow-md"
        }`}
      >
        {isLight ? (
          <>
            <Moon className="h-3.5 w-3.5 text-slate-700 shrink-0" />
            <span>Тёмная</span>
          </>
        ) : (
          <>
            <Sun className="h-3.5 w-3.5 text-amber-300 shrink-0" />
            <span>Светлая</span>
          </>
        )}
      </button>
    );
  }

  // Единый компактный контрол в одной вкладке: [Планета | Стандарт | ☀️/🌙]
  return (
    <div
      role="group"
      aria-label="Параметры отображения и темы"
      className={`inline-flex items-center rounded-xl border p-0.5 select-none shrink-0 transition-colors ${
        isLight
          ? "border-slate-200 bg-slate-100/90 text-slate-600 shadow-2xs"
          : "border-white/10 bg-[#111726]/90 text-zinc-400"
      }`}
    >
      <button
        type="button"
        onClick={() => setScheduleViewMode("planet")}
        title="Вид расписания: Планета"
        aria-label="Вид расписания: Планета"
        className={`flex items-center gap-1 rounded-lg px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
          scheduleViewMode === "planet"
            ? isLight
              ? "bg-white text-sky-600 shadow-2xs"
              : "bg-sky-500/20 text-sky-300 shadow-2xs"
            : isLight
            ? "text-slate-500 hover:text-slate-900"
            : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        <Globe className="h-3.5 w-3.5 shrink-0" />
        <span className={scheduleViewMode === "planet" ? "inline" : "hidden sm:inline"}>
          Планета
        </span>
      </button>

      <button
        type="button"
        onClick={() => setScheduleViewMode("standard")}
        title="Вид расписания: Стандарт"
        aria-label="Вид расписания: Стандарт"
        className={`flex items-center gap-1 rounded-lg px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
          scheduleViewMode === "standard"
            ? isLight
              ? "bg-white text-sky-600 shadow-2xs"
              : "bg-sky-500/20 text-sky-300 shadow-2xs"
            : isLight
            ? "text-slate-500 hover:text-slate-900"
            : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
        <span className={scheduleViewMode === "standard" ? "inline" : "hidden sm:inline"}>
          Стандарт
        </span>
      </button>

      <div
        className={`mx-0.5 h-4 w-px shrink-0 ${
          isLight ? "bg-slate-200" : "bg-white/10"
        }`}
      />

      <button
        type="button"
        onClick={toggleColorMode}
        title={isLight ? "Включить тёмную тему" : "Включить светлую тему"}
        aria-label={isLight ? "Включить тёмную тему" : "Включить светлую тему"}
        className={`flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg transition-colors shrink-0 cursor-pointer ${
          isLight
            ? "text-slate-600 hover:bg-white hover:text-slate-950"
            : "text-zinc-300 hover:bg-white/10 hover:text-white"
        }`}
      >
        {isLight ? (
          <Moon className="h-3.5 w-3.5 text-slate-700" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-amber-300" />
        )}
      </button>
    </div>
  );
}
