"use client";

import React from "react";
import { useAppTheme } from "./theme-context";
import { Globe, CalendarDays, Sun, Moon } from "lucide-react";
import { Button, SegmentedControl } from "./ui-kit";

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
        className={`h-9 ${
          modeOnly ? "w-24" : "w-36 sm:w-48"
        } rounded-xl bg-slate-500/10 animate-pulse shrink-0`}
      />
    );
  }

  const isLight = colorMode === "light";

  if (modeOnly) {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={toggleColorMode}
        title={isLight ? "Включить тёмную тему" : "Включить светлую тему"}
        aria-label={isLight ? "Включить тёмную тему" : "Включить светлую тему"}
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
      </Button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Параметры отображения и темы"
      className={`inline-flex items-center gap-1 rounded-xl border p-1 select-none shrink-0 transition-colors duration-200 ${
        isLight
          ? "border-slate-200/90 bg-slate-100/90 text-slate-600 shadow-2xs"
          : "border-slate-800 bg-slate-900/90 text-slate-400"
      }`}
    >
      <SegmentedControl
        size="sm"
        value={scheduleViewMode}
        onChange={(v) => setScheduleViewMode(v)}
        className="border-0 bg-transparent p-0"
        options={[
          {
            value: "planet",
            icon: <Globe className="h-3.5 w-3.5" />,
            label: (
              <span className={scheduleViewMode === "planet" ? "inline" : "hidden sm:inline"}>
                Планета
              </span>
            ),
            title: "Вид расписания: Планета",
          },
          {
            value: "standard",
            icon: <CalendarDays className="h-3.5 w-3.5" />,
            label: (
              <span className={scheduleViewMode === "standard" ? "inline" : "hidden sm:inline"}>
                Стандарт
              </span>
            ),
            title: "Вид расписания: Стандарт",
          },
        ]}
      />

      <div
        className={`mx-0.5 h-4 w-px shrink-0 ${
          isLight ? "bg-slate-200" : "bg-slate-800"
        }`}
      />

      <Button
        variant="ghost"
        size="icon"
        onClick={toggleColorMode}
        title={isLight ? "Включить тёмную тему" : "Включить светлую тему"}
        aria-label={isLight ? "Включить тёмную тему" : "Включить светлую тему"}
        className="h-7 w-7 rounded-lg"
      >
        {isLight ? (
          <Moon className="h-3.5 w-3.5 text-slate-700" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-amber-300" />
        )}
      </Button>
    </div>
  );
}
