"use client";

import React from "react";
import { useAppTheme } from "./theme-context";
import { ClockDial, WeekDayItem } from "./clock-dial";

interface ThemeCalendarStripProps {
  currentDate?: Date;
  onSelectDate?: (date: Date) => void;
  serverToday?: Date;
  days: WeekDayItem[];
  selectedDayOfWeek: number;
  onSelectDay: (dayOfWeek: number) => void;
  onPrevWeek?: (weeks?: number) => void;
  onNextWeek?: (weeks?: number) => void;
  onScrubDay?: (targetDate: Date, dayOfWeek: number) => void;
}

export function ThemeCalendarStrip({
  currentDate,
  onSelectDate,
  serverToday,
  days,
  selectedDayOfWeek,
  onSelectDay,
  onPrevWeek,
  onNextWeek,
  onScrubDay,
}: ThemeCalendarStripProps) {
  const { theme } = useAppTheme();

  // 1. ТЕМА CLOCK: планетарный циферблат
  if (theme === "clock") {
    return (
      <ClockDial
        currentDate={currentDate || new Date()}
        onSelectDate={onSelectDate || ((d) => onScrubDay && onScrubDay(d, d.getDay() === 0 ? 7 : d.getDay()))}
        serverToday={serverToday}
        days={days}
        selectedDayOfWeek={selectedDayOfWeek}
        onSelectDay={onSelectDay}
        onPrevWeek={onPrevWeek}
        onNextWeek={onNextWeek}
        onScrubDay={onScrubDay}
      />
    );
  }

  // 2. ТЕМА GARDEN: ультра-скругление (28px)
  if (theme === "garden") {
    return (
      <div className="flex items-end justify-between px-3 pt-3">
        {days.map((w) => {
          const isSelected = selectedDayOfWeek === w.dayOfWeek;
          return (
            <button
              key={w.dayOfWeek}
              type="button"
              onClick={() => onSelectDay(w.dayOfWeek)}
              className={`relative flex flex-1 flex-col items-center justify-center transition-all ${
                isSelected
                  ? "garden-active-tab bg-[#FEC868] text-[#473C33] h-16 font-black z-10"
                  : "text-zinc-400 hover:text-zinc-200 h-14 pb-1"
              }`}
            >
              <span className="text-base sm:text-lg font-black leading-none">
                {w.dateNumber}
              </span>
              <span className="text-[10px] uppercase font-bold mt-1">
                {w.short}
              </span>
              {w.isToday && !isSelected && (
                <span className="h-1.5 w-1.5 rounded-full bg-[#FEC868] mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // 3. ТЕМА СТАНДАРТ (STANDART / STANDART +)
  if (theme === "standart" || theme === "standart-plus") {
    return (
      <div className="glass-panel rounded-2xl p-2 sm:p-2.5">
        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
          {days.map((w) => {
            const isSelected = selectedDayOfWeek === w.dayOfWeek;
            return (
              <button
                key={w.dayOfWeek}
                type="button"
                onClick={() => onSelectDay(w.dayOfWeek)}
                className={`standart-date-btn relative flex flex-1 flex-col items-center justify-center h-14 sm:h-16 rounded-xl transition-all ${
                  isSelected ? "selected-date font-bold" : "text-emerald-100/70"
                }`}
              >
                <span className="text-base sm:text-lg font-bold leading-none">
                  {w.dateNumber}
                </span>
                <span
                  className={`text-[10px] sm:text-[11px] font-semibold uppercase mt-1 ${
                    isSelected ? "text-emerald-950 font-extrabold" : "text-zinc-400"
                  }`}
                >
                  {w.short}
                </span>
                {w.isToday && (
                  <span
                    className={`absolute top-1.5 right-1.5 h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full ${
                      isSelected
                        ? "bg-emerald-950"
                        : "bg-emerald-400 shadow-[0_0_6px_#10B981]"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // 4. БАЗОВАЯ ТЕМА
  return (
    <div className="flex items-center justify-between gap-1.5 px-2 py-2">
      {days.map((w) => {
        const isSelected = selectedDayOfWeek === w.dayOfWeek;
        const isToday = w.isToday;

        let colorClasses = "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60";
        if (isSelected) {
          colorClasses = "bg-emerald-600 text-white shadow-sm dark:bg-emerald-600";
        } else if (isToday) {
          colorClasses =
            "bg-zinc-200 text-zinc-900 border border-zinc-300/80 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700";
        }

        return (
          <button
            key={w.dayOfWeek}
            type="button"
            onClick={() => onSelectDay(w.dayOfWeek)}
            className={`flex flex-1 flex-col items-center justify-center h-16 rounded-xl transition-colors duration-150 ${colorClasses}`}
          >
            <span className="text-base sm:text-lg font-bold leading-none">
              {w.dateNumber}
            </span>
            <span
              className={`text-[11px] mt-1 font-medium uppercase ${
                isSelected
                  ? "text-emerald-100"
                  : isToday
                  ? "text-zinc-700 dark:text-zinc-300 font-semibold"
                  : "text-zinc-400"
              }`}
            >
              {w.short}
            </span>
          </button>
        );
      })}
    </div>
  );
}