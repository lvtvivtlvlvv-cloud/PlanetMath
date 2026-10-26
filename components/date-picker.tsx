"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  isValid,
} from "date-fns";
import { ru } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useAppTheme } from "./theme-context";

export interface DatePickerProps {
  value?: string; // "YYYY-MM-DD"
  defaultValue?: string; // "YYYY-MM-DD"
  onChange?: (dateStr: string, dateObj: Date) => void;
  name?: string;
  required?: boolean;
  placeholder?: string;
  allowClear?: boolean;
  className?: string;
  compact?: boolean;
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function parseDateSafe(str?: string): Date | null {
  if (!str) return null;
  try {
    const d = parseISO(str);
    if (isValid(d)) return d;
  } catch {}
  return null;
}

export function DatePicker({
  value,
  defaultValue,
  onChange,
  name,
  required = false,
  placeholder = "Выберите дату",
  allowClear = false,
  className = "",
  compact = false,
}: DatePickerProps) {
  const { colorMode } = useAppTheme();
  const isLight = colorMode === "light";

  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<string>(defaultValue || "");
  const activeValue = isControlled ? value || "" : internalValue;

  const selectedDate = useMemo(() => parseDateSafe(activeValue), [activeValue]);

  const [viewMonth, setViewMonth] = useState<Date>(() => selectedDate || new Date());

  // Двухфазное состояние для строго симметричной плавной анимации открытия и закрытия (180ms)
  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [popoverCoords, setPopoverCoords] = useState<{
    top: number;
    left: number;
    width: number;
    transformOrigin: string;
  }>({
    top: 0,
    left: 0,
    width: 312,
    transformOrigin: "top left",
  });

  useEffect(() => {
    setMounted(true);
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (selectedDate) {
      setViewMonth(selectedDate);
    }
  }, [selectedDate]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof window === "undefined") return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popWidth = Math.min(320, vw - 24);
    const popHeight = 360;

    let left = rect.left;
    if (left + popWidth > vw - 12) {
      left = Math.max(12, vw - popWidth - 12);
    }
    if (left < 12) left = 12;

    const spaceBelow = vh - rect.bottom;
    const openUpward = spaceBelow < popHeight && rect.top > popHeight;

    const top = openUpward ? Math.max(12, rect.top - popHeight - 8) : rect.bottom + 8;

    setPopoverCoords({
      top,
      left,
      width: popWidth,
      transformOrigin: openUpward ? "bottom center" : "top center",
    });
  }, []);

  const openCalendar = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (selectedDate) {
      setViewMonth(selectedDate);
    }
    updatePosition();
    setIsRendered(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });
  }, [selectedDate, updatePosition]);

  const closeCalendar = useCallback(() => {
    setIsVisible(false);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setIsRendered(false);
    }, 180);
  }, []);

  const toggleCalendar = useCallback(() => {
    if (isRendered && isVisible) {
      closeCalendar();
    } else {
      openCalendar();
    }
  }, [isRendered, isVisible, closeCalendar, openCalendar]);

  useEffect(() => {
    if (!isRendered) return;

    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        closeCalendar();
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCalendar();
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside, { passive: true });
    document.addEventListener("keydown", handleKey);
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [isRendered, closeCalendar, updatePosition]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [viewMonth]);

  const handleSelectDay = (day: Date) => {
    const formatted = format(day, "yyyy-MM-dd");
    if (!isControlled) {
      setInternalValue(formatted);
    }
    if (onChange) {
      onChange(formatted, day);
    }
    closeCalendar();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isControlled) {
      setInternalValue("");
    }
    if (onChange) {
      onChange("", new Date());
    }
    closeCalendar();
  };

  const displayLabel = useMemo(() => {
    if (!selectedDate) return placeholder;
    return format(selectedDate, compact ? "d MMM yyyy" : "d MMMM yyyy", { locale: ru });
  }, [selectedDate, placeholder, compact]);

  const monthHeading = useMemo(() => {
    const raw = format(viewMonth, "LLLL yyyy", { locale: ru });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [viewMonth]);

  return (
    <div className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={activeValue} required={required} />}

      <button
        ref={triggerRef}
        type="button"
        onClick={toggleCalendar}
        className={`w-full ${
          compact ? "h-9 px-3" : "h-10 px-3.5"
        } rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer select-none outline-none ${
          isLight
            ? "bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 focus:border-sky-500 text-slate-800 shadow-2xs"
            : "bg-slate-900/80 hover:bg-slate-900 border-white/15 hover:border-cyan-400/50 focus:border-cyan-400 text-zinc-100 shadow-sm backdrop-blur-md"
        } ${isVisible ? (isLight ? "border-sky-500 ring-2 ring-sky-500/15" : "border-cyan-400 ring-2 ring-cyan-400/20") : ""}`}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          <CalendarIcon
            className={`h-4 w-4 shrink-0 ${
              isLight ? "text-sky-600" : "text-cyan-400"
            }`}
          />
          <span
            className={`truncate ${
              selectedDate
                ? isLight
                  ? "text-slate-800 font-bold"
                  : "text-zinc-100 font-bold"
                : isLight
                ? "text-slate-400 font-medium"
                : "text-zinc-500 font-medium"
            }`}
          >
            {displayLabel}
          </span>
        </div>

        {allowClear && selectedDate && (
          <span
            role="button"
            tabIndex={-1}
            onClick={handleClear}
            className={`p-0.5 rounded-md transition ${
              isLight
                ? "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                : "text-zinc-400 hover:text-white hover:bg-white/10"
            }`}
            title="Очистить дату"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      {mounted &&
        isRendered &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: `${popoverCoords.top}px`,
              left: `${popoverCoords.left}px`,
              width: `${popoverCoords.width}px`,
              transformOrigin: popoverCoords.transformOrigin,
              zIndex: 9999,
            }}
            className={`rounded-2xl p-3.5 sm:p-4 backdrop-blur-md border transition-all duration-[180ms] ease-out select-none ${
              isLight
                ? "bg-white/85 border-slate-200/90 shadow-[0_20px_50px_rgba(15,23,42,0.14)] text-slate-900"
                : "bg-slate-900/85 border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.7)] text-slate-100"
            } ${
              isVisible
                ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
            }`}
          >
            {/* Шапка календаря: Месяц, Год и стрелки */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <button
                type="button"
                onClick={() => setViewMonth((prev) => subMonths(prev, 1))}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border transition cursor-pointer ${
                  isLight
                    ? "border-slate-200/80 bg-white/80 text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                    : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/15 hover:text-white"
                }`}
                title="Предыдущий месяц"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div
                className={`text-sm sm:text-base font-extrabold tracking-tight ${
                  isLight ? "text-slate-900" : "text-white"
                }`}
              >
                {monthHeading}
              </div>

              <button
                type="button"
                onClick={() => setViewMonth((prev) => addMonths(prev, 1))}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border transition cursor-pointer ${
                  isLight
                    ? "border-slate-200/80 bg-white/80 text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                    : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/15 hover:text-white"
                }`}
                title="Следующий месяц"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Дни недели */}
            <div className="grid grid-cols-7 gap-1 mb-1.5">
              {WEEKDAYS.map((dayName, idx) => (
                <div
                  key={dayName}
                  className={`text-center text-[11px] font-bold uppercase tracking-wider py-1 ${
                    idx >= 5
                      ? isLight
                        ? "text-sky-600"
                        : "text-cyan-400"
                      : isLight
                      ? "text-slate-400"
                      : "text-slate-400"
                  }`}
                >
                  {dayName}
                </div>
              ))}
            </div>

            {/* Сетка чисел месяца: крупные числа и увеличенная область клика */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const inCurrentMonth = isSameMonth(day, viewMonth);
                const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                const isCurrentToday = isToday(day);

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => handleSelectDay(day)}
                    className={`relative min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-base sm:text-lg font-semibold tabular-nums transition-all cursor-pointer ${
                      isSelected
                        ? isLight
                          ? "bg-sky-600 text-white font-bold shadow-sm"
                          : "bg-sky-500 text-white font-bold shadow-[0_0_14px_rgba(14,165,233,0.45)]"
                        : isCurrentToday
                        ? isLight
                          ? "bg-sky-50 text-sky-700 border border-sky-300 font-bold"
                          : "bg-cyan-500/15 text-cyan-300 border border-cyan-400/40 font-bold"
                        : inCurrentMonth
                        ? isLight
                          ? "text-slate-800 hover:bg-slate-100/90 hover:text-slate-950"
                          : "text-slate-100 hover:bg-white/10 hover:text-white"
                        : isLight
                        ? "text-slate-300 hover:bg-slate-100/60 hover:text-slate-500"
                        : "text-slate-600 hover:bg-white/5 hover:text-slate-400"
                    }`}
                  >
                    <span>{day.getDate()}</span>
                    {isCurrentToday && !isSelected && (
                      <span
                        className={`absolute bottom-1 h-1 w-1 rounded-full ${
                          isLight ? "bg-sky-600" : "bg-cyan-400"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Нижняя панель быстрого выбора */}
            <div
              className={`mt-3 pt-2.5 border-t flex items-center justify-between gap-2 ${
                isLight ? "border-slate-200/80" : "border-white/10"
              }`}
            >
              <button
                type="button"
                onClick={() => handleSelectDay(new Date())}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  isLight
                    ? "bg-sky-50 text-sky-700 hover:bg-sky-100"
                    : "bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25"
                }`}
              >
                Сегодня
              </button>

              <button
                type="button"
                onClick={closeCalendar}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  isLight
                    ? "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    : "text-slate-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                Закрыть
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
export default DatePicker;
