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
  const { scheduleViewMode, colorMode } = useAppTheme();
  const isLight = colorMode === "light";

  // Жест свайпа для переключения недель в стандартном режиме расписания
  const touchStartX = React.useRef<number | null>(null);
  const touchStartY = React.useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    if (Math.abs(dx) > 38 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      if (dx < 0) {
        if (onNextWeek) onNextWeek(1);
      } else {
        if (onPrevWeek) onPrevWeek(1);
      }
    }
  };

  // 1. РЕЖИМ ПЛАНЕТЫ: интерактивный планетарный циферблат с Землёй
  if (scheduleViewMode === "planet") {
    return (
      <ClockDial
        currentDate={currentDate || new Date()}
        onSelectDate={
          onSelectDate ||
          ((d) => onScrubDay && onScrubDay(d, d.getDay() === 0 ? 7 : d.getDay()))
        }
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

  // 2. СТАНДАРТНЫЙ РЕЖИМ РАСПИСАНИЯ (7 дней недели в стиле Planet Dark / Light)
  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="glass-panel rounded-2xl p-2 sm:p-2.5 shadow-sm select-none"
    >
      <div className="flex items-center justify-between gap-1.5 sm:gap-2">
        {days.map((w) => {
          const isSelected = selectedDayOfWeek === w.dayOfWeek;
          return (
            <button
              key={w.dayOfWeek}
              type="button"
              onClick={() => onSelectDay(w.dayOfWeek)}
              className={`planet-date-btn relative flex flex-1 flex-col items-center justify-center h-14 sm:h-16 rounded-xl transition-all ${
                isSelected
                  ? "selected-date font-bold"
                  : isLight
                  ? "text-slate-600 hover:text-slate-950"
                  : "text-sky-100/80 hover:text-white"
              }`}
            >
              <span className="font-mono text-base sm:text-lg font-bold leading-none tabular-nums">
                {w.dateNumber < 10 ? `0${w.dateNumber}` : w.dateNumber}
              </span>
              <span
                className={`text-[10px] sm:text-[11px] font-semibold uppercase mt-1 ${
                  isSelected
                    ? isLight
                      ? "text-white font-extrabold"
                      : "text-slate-950 font-extrabold"
                    : isLight
                    ? "text-slate-500"
                    : "text-zinc-400"
                }`}
              >
                {w.short}
              </span>
              {w.isToday && (
                <span
                  className={`absolute top-1.5 right-1.5 h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full ${
                    isSelected
                      ? isLight
                        ? "bg-white"
                        : "bg-slate-950"
                      : isLight
                      ? "bg-sky-600 shadow-[0_0_6px_#0284C7]"
                      : "bg-cyan-400 shadow-[0_0_6px_#22D3EE]"
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
