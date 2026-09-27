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

  // 1. ТЕМА CLOCK: планетарный циферблат с Землёй
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

  // 2. ТЕМА GARDEN: органические вкладки, физически и визуально сливающиеся с таблицей
  if (theme === "garden") {
    return (
      <div className="relative z-10 flex items-end justify-between px-2 pt-2 bg-[#121913] rounded-t-[36px] sm:rounded-t-[44px] border-t border-x border-[#283829]/60">
        {days.map((w) => {
          const isSelected = selectedDayOfWeek === w.dayOfWeek;
          return (
            <button
              key={w.dayOfWeek}
              type="button"
              onClick={() => onSelectDay(w.dayOfWeek)}
              className={`relative flex flex-1 flex-col items-center justify-center transition-all ${
                isSelected
                  ? "garden-active-tab bg-[#FEC868] text-[#473C33] h-16 sm:h-18 font-black z-20 rounded-t-[26px] sm:rounded-t-[32px] -mb-[1px] shadow-sm"
                  : "text-[#abc270]/70 hover:text-[#f8f6f0] h-14 pb-1 rounded-t-2xl hover:bg-white/5"
              }`}
            >
              <span className="text-base sm:text-lg font-black leading-none">
                {w.dateNumber}
              </span>
              <span className="text-[10px] sm:text-[11px] uppercase font-bold mt-1">
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

  // 3. ТЕМА «СТАНДАРТ» (Единая обновленная тема)
  return (
    <div className="glass-panel rounded-2xl p-2 sm:p-2.5 shadow-md">
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
