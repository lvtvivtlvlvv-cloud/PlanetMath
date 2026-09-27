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

  // 1. ТЕМА PLANET: планетарный циферблат с Землёй
  if (theme === "planet") {
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

  // 2. ТЕМА GARDEN: органические сверхскругленные дни, физически соединяющиеся с таблицей
  if (theme === "garden") {
    return (
      <div className="relative z-10 w-full rounded-t-[40px] sm:rounded-t-[50px] bg-[#141E15] border-t-2 border-x-2 border-[#2D3E2F] px-2.5 sm:px-4 pt-3.5 pb-2.5 shadow-xl">
        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
          {days.map((w) => {
            const isSelected = selectedDayOfWeek === w.dayOfWeek;
            return (
              <button
                key={w.dayOfWeek}
                type="button"
                onClick={() => onSelectDay(w.dayOfWeek)}
                className={`relative flex flex-1 flex-col items-center justify-center py-2.5 sm:py-3 rounded-[22px] sm:rounded-[28px] transition-all duration-200 select-none ${
                  isSelected
                    ? "bg-[#FEC868] text-[#382C1E] shadow-[0_6px_20px_rgba(254,200,104,0.4)] font-black scale-[1.04] z-20"
                    : "text-[#ABC270]/80 hover:text-[#F8F6F0] hover:bg-white/5 font-semibold"
                }`}
              >
                <span className="text-base sm:text-lg font-black leading-none">
                  {w.dateNumber}
                </span>
                <span
                  className={`text-[10px] sm:text-[11px] uppercase font-bold mt-1 tracking-wider ${
                    isSelected ? "text-[#382C1E]" : "text-[#ABC270]/60"
                  }`}
                >
                  {w.short}
                </span>
                {w.isToday && !isSelected && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#FEC868] mt-1 shadow-[0_0_6px_#FEC868]" />
                )}
                {isSelected && (
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-x-[6px] border-x-transparent border-t-[7px] border-t-[#FEC868] z-30" />
                )}
              </button>
            );
          })}
        </div>
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
