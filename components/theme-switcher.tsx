"use client";

import React from "react";
import { useAppTheme } from "./theme-context";
import { Globe, CalendarDays, Sun, Moon } from "lucide-react";

export function ThemeSwitcher() {
  const {
    colorMode,
    toggleColorMode,
    scheduleViewMode,
    setScheduleViewMode,
    mounted,
  } = useAppTheme();

  if (!mounted) {
    return (
      <div className="h-8 w-36 sm:w-44 rounded-lg bg-slate-500/10 animate-pulse shrink-0" />
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
      {/* 1. Компактный сегментированный переключатель вида расписания: Планета / Стандарт */}
      <div
        role="group"
        aria-label="Режим отображения расписания"
        className={`inline-flex items-center rounded-lg p-0.5 transition-colors ${
          isLight
            ? "bg-slate-200/75 text-slate-600"
            : "bg-white/[0.06] text-zinc-400"
        }`}
      >
        <button
          type="button"
          onClick={() => setScheduleViewMode("planet")}
          title="Режим расписания: Планета (орбита дней)"
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
            scheduleViewMode === "planet"
              ? isLight
                ? "bg-white text-sky-600 shadow-xs"
                : "bg-sky-500/20 text-sky-300 shadow-xs"
              : isLight
              ? "text-slate-600 hover:text-slate-900"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Globe className="h-3.5 w-3.5 shrink-0" />
          <span>Планета</span>
        </button>

        <button
          type="button"
          onClick={() => setScheduleViewMode("standard")}
          title="Режим расписания: Стандарт (сетка дней)"
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
            scheduleViewMode === "standard"
              ? isLight
                ? "bg-white text-sky-600 shadow-xs"
                : "bg-sky-500/20 text-sky-300 shadow-xs"
              : isLight
              ? "text-slate-600 hover:text-slate-900"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span>Стандарт</span>
        </button>
      </div>

      {/* 2. Компактная кнопка-иконка переключения Светлой / Тёмной цветовой схемы Planet */}
      <button
        type="button"
        onClick={toggleColorMode}
        title={isLight ? "Включить тёмную тему Planet" : "Включить светлую тему Planet"}
        aria-label={isLight ? "Включить тёмную тему Planet" : "Включить светлую тему Planet"}
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors shrink-0 ${
          isLight
            ? "bg-slate-200/75 text-slate-700 hover:bg-slate-300/70 hover:text-slate-950"
            : "bg-white/[0.06] text-zinc-300 hover:bg-white/10 hover:text-white"
        }`}
      >
        {isLight ? (
          <Moon className="h-4 w-4 text-slate-700" />
        ) : (
          <Sun className="h-4 w-4 text-amber-300" />
        )}
      </button>
    </div>
  );
}
