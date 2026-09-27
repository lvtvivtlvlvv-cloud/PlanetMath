"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { format, addDays, isSameDay, getDay } from "date-fns";
import { ru } from "date-fns/locale";

export interface WeekDayItem {
  dayOfWeek: number;
  short: string;
  dateNumber: number;
  fullDateStr: string;
  isToday: boolean;
}

interface ClockDialProps {
  currentDate: Date;
  onSelectDate: (date: Date) => void;
  serverToday?: Date;
  // Для обратной совместимости
  days?: WeekDayItem[];
  selectedDayOfWeek?: number;
  onSelectDay?: (dayOfWeek: number) => void;
  onPrevWeek?: (weeks?: number) => void;
  onNextWeek?: (weeks?: number) => void;
  onScrubDay?: (targetDate: Date, dayOfWeek: number) => void;
}

const SHORT_WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

export function ClockDial({
  currentDate,
  onSelectDate,
  serverToday,
  days,
  selectedDayOfWeek,
  onScrubDay,
  onSelectDay,
}: ClockDialProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Вычисляем активную дату строго без UTC-смещений
  const activeDate = useMemo(() => {
    if (currentDate instanceof Date && !isNaN(currentDate.getTime())) {
      return currentDate;
    }
    if (days && selectedDayOfWeek) {
      const item = days.find((d) => d.dayOfWeek === selectedDayOfWeek) || days[0];
      if (item?.fullDateStr) {
        const [y, m, d] = item.fullDateStr.split("-").map(Number);
        return new Date(y, m - 1, d);
      }
    }
    return new Date();
  }, [currentDate, days, selectedDayOfWeek]);

  // Стабильная точка отсчета для жеста (НЕ МЕНЯЕТСЯ во время движения пальца)
  const dragAnchorDateRef = useRef<Date>(activeDate);

  // Непрерывное вещественное смещение в днях от dragAnchorDateRef
  const [floatOffset, setFloatOffset] = useState<number>(0);
  const floatOffsetRef = useRef<number>(0);
  const touchStartOffsetRef = useRef<number>(0);
  const currentVelocityRef = useRef<number>(0);
  const wasSpinningRef = useRef<boolean>(false);

  const isDraggingRef = useRef<boolean>(false);
  const hasMovedRef = useRef<boolean>(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const gestureLockRef = useRef<"horizontal" | "vertical" | null>(null);
  const touchHistoryRef = useRef<{ x: number; t: number }[]>([]);

  const animFrameRef = useRef<number | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const pendingTouchX = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const lastHapticDayRef = useRef<number>(0);

  // Синхронизация при внешнем выборе дня в покое
  useEffect(() => {
    if (!isDraggingRef.current && animFrameRef.current === null) {
      dragAnchorDateRef.current = activeDate;
      floatOffsetRef.current = 0;
      setFloatOffset(0);
      lastHapticDayRef.current = 0;
    }
  }, [activeDate]);

  const [containerWidth, setContainerWidth] = useState<number>(860);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const newWidth = containerRef.current.clientWidth;
        setContainerWidth((prev) => (Math.abs(prev - newWidth) > 4 ? newWidth : prev));
      }
    };
    updateSize();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(updateSize);
      ro.observe(containerRef.current);
      return () => ro.disconnect();
    }
  }, []);

  // Фиксация выбранной даты
  const commitSelection = useCallback(
    (offsetDays: number) => {
      const finalDate = addDays(dragAnchorDateRef.current, offsetDays);
      dragAnchorDateRef.current = finalDate;
      floatOffsetRef.current = 0;
      setFloatOffset(0);

      if (onSelectDate) {
        onSelectDate(finalDate);
      } else {
        const dow = getDay(finalDate) === 0 ? 7 : getDay(finalDate);
        if (onScrubDay) onScrubDay(finalDate, dow);
        else if (onSelectDay) onSelectDay(dow);
      }
    },
    [onSelectDate, onScrubDay, onSelectDay]
  );

  // 120 Hz пружина (Apple Spring Physics)
  const startSnapSpring = useCallback(
    (targetOffset: number) => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = performance.now();

      const springStep = (now: number) => {
        const dt = Math.min(32, Math.max(1, now - lastTimeRef.current)) / 16.667;
        lastTimeRef.current = now;

        const diff = targetOffset - floatOffsetRef.current;
        if (Math.abs(diff) < 0.002) {
          animFrameRef.current = null;
          currentVelocityRef.current = 0;
          commitSelection(targetOffset);
          return;
        }

        const decayFactor = 1 - Math.pow(0.72, dt);
        floatOffsetRef.current += diff * decayFactor;
        setFloatOffset(floatOffsetRef.current);

        const rounded = Math.round(floatOffsetRef.current);
        if (rounded !== lastHapticDayRef.current) {
          lastHapticDayRef.current = rounded;
          try {
            if (typeof navigator !== "undefined" && navigator.vibrate) {
              navigator.vibrate(5);
            }
          } catch {}
        }

        animFrameRef.current = requestAnimationFrame(springStep);
      };

      animFrameRef.current = requestAnimationFrame(springStep);
    },
    [commitSelection]
  );

  // 120 Hz инерция с поддержкой мультискроллинга и раскручивания
  const startInertia = useCallback(
    (initialVelocity: number) => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = performance.now();

      currentVelocityRef.current = Math.max(-2.8, Math.min(2.8, initialVelocity));
      const stopThreshold = 0.012;

      const inertiaStep = (now: number) => {
        const dt = Math.min(32, Math.max(1, now - lastTimeRef.current)) / 16.667;
        lastTimeRef.current = now;

        if (Math.abs(currentVelocityRef.current) > stopThreshold) {
          floatOffsetRef.current += currentVelocityRef.current * dt;
          // Плавное физическое затухание для долгого и приятного мультискроллинга
          currentVelocityRef.current *= Math.pow(0.972, dt);
          setFloatOffset(floatOffsetRef.current);

          const rounded = Math.round(floatOffsetRef.current);
          if (rounded !== lastHapticDayRef.current) {
            lastHapticDayRef.current = rounded;
            try {
              if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate(5);
              }
            } catch {}
          }

          animFrameRef.current = requestAnimationFrame(inertiaStep);
        } else {
          currentVelocityRef.current = 0;
          startSnapSpring(Math.round(floatOffsetRef.current));
        }
      };

      animFrameRef.current = requestAnimationFrame(inertiaStep);
    },
    [startSnapSpring]
  );

  // Клик по числу в 1 тап
  const handleDayTap = useCallback(
    (targetK: number) => {
      if (isDraggingRef.current || hasMovedRef.current) return;
      currentVelocityRef.current = 0;
      startSnapSpring(targetK);
    },
    [startSnapSpring]
  );

  // Колесико мыши
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 18) return;

      const target = Math.round(floatOffsetRef.current) + (delta > 0 ? 1 : -1);
      startSnapSpring(target);
    },
    [startSnapSpring]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // НАДЕЖНЫЙ ПЕРЕХВАТЧИК ТАЧ-СОБЫТИЙ: МУЛЬТИСКРОЛЛИНГ И МГНОВЕННАЯ ОСТАНОВКА
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      const wasAnimating = animFrameRef.current !== null || Math.abs(currentVelocityRef.current) > 0.03;
      wasSpinningRef.current = wasAnimating;

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }

      // Непрерывное сохранение текущего смещения в момент касания
      touchStartOffsetRef.current = floatOffsetRef.current;

      isDraggingRef.current = true;
      hasMovedRef.current = false;
      const clientX = e.touches[0].clientX;
      const clientY = e.touches[0].clientY;
      touchStartX.current = clientX;
      touchStartY.current = clientY;
      pendingTouchX.current = clientX;
      touchHistoryRef.current = [{ x: clientX, t: performance.now() }];
      gestureLockRef.current = null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      const clientX = e.touches[0].clientX;
      const clientY = e.touches[0].clientY;
      const diffX = clientX - touchStartX.current;
      const diffY = clientY - touchStartY.current;

      if (gestureLockRef.current === null) {
        if (Math.abs(diffY) > 8 && Math.abs(diffY) > Math.abs(diffX)) {
          gestureLockRef.current = "vertical";
          return;
        } else if (Math.abs(diffX) > 6) {
          gestureLockRef.current = "horizontal";
          hasMovedRef.current = true;
        }
      }

      if (gestureLockRef.current !== "horizontal") return;

      // Блокируем встроенный жест "Назад" в мобильном Safari и Chrome
      if (e.cancelable) {
        e.preventDefault();
      }

      pendingTouchX.current = clientX;
      const now = performance.now();
      touchHistoryRef.current.push({ x: clientX, t: now });
      touchHistoryRef.current = touchHistoryRef.current.filter((item) => now - item.t < 120);

      if (!dragRafRef.current) {
        dragRafRef.current = requestAnimationFrame(() => {
          if (pendingTouchX.current !== null && touchStartX.current !== null) {
            const moveDiff = pendingTouchX.current - touchStartX.current;
            const PX_PER_DAY = 52;
            const nextOffset = touchStartOffsetRef.current - moveDiff / PX_PER_DAY;

            floatOffsetRef.current = nextOffset;
            setFloatOffset(nextOffset);

            const currentRounded = Math.round(nextOffset);
            if (currentRounded !== lastHapticDayRef.current) {
              lastHapticDayRef.current = currentRounded;
              try {
                if (typeof navigator !== "undefined" && navigator.vibrate) {
                  navigator.vibrate(5);
                }
              } catch {}
            }
          }
          dragRafRef.current = null;
        });
      }
    };

    const onTouchEnd = () => {
      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }

      isDraggingRef.current = false;
      const wasSpinning = wasSpinningRef.current;
      wasSpinningRef.current = false;
      touchStartX.current = null;
      touchStartY.current = null;

      // ЛЕГКАЯ ОСТАНОВКА: при тапе по вращающемуся циферблату моментально тормозим и фиксируем ближайший день
      if (!hasMovedRef.current) {
        if (wasSpinning) {
          currentVelocityRef.current = 0;
          startSnapSpring(Math.round(floatOffsetRef.current));
        }
        gestureLockRef.current = null;
        return;
      }

      if (gestureLockRef.current !== "horizontal") {
        gestureLockRef.current = null;
        startSnapSpring(Math.round(floatOffsetRef.current));
        return;
      }

      gestureLockRef.current = null;

      const now = performance.now();
      const recentEvents = touchHistoryRef.current.filter((item) => now - item.t < 120);
      let releaseVelocity = 0;

      if (recentEvents.length >= 2) {
        const oldest = recentEvents[0];
        const latest = recentEvents[recentEvents.length - 1];
        const dt = latest.t - oldest.t;
        const dx = latest.x - oldest.x;

        if (dt > 12) {
          const pxPerMs = dx / dt;
          releaseVelocity = -(pxPerMs * 16.6) / 52;
        }
      }

      // МУЛЬТИСКРОЛЛИНГ: если человек повторно смахивает в ту же сторону — складываем накопленную скорость
      let finalVelocity = releaseVelocity;
      if (
        Math.abs(releaseVelocity) > 0.035 &&
        Math.abs(currentVelocityRef.current) > 0.04 &&
        Math.sign(releaseVelocity) === Math.sign(currentVelocityRef.current)
      ) {
        finalVelocity = releaseVelocity + currentVelocityRef.current * 0.82;
      }
      finalVelocity = Math.max(-2.8, Math.min(2.8, finalVelocity));

      if (Math.abs(finalVelocity) > 0.035) {
        startInertia(finalVelocity);
      } else {
        currentVelocityRef.current = 0;
        startSnapSpring(Math.round(floatOffsetRef.current));
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [startInertia, startSnapSpring]);

  // Текущая отображаемая дата в верхнем левом углу
  const focusedDate = useMemo(() => {
    return addDays(dragAnchorDateRef.current, Math.round(floatOffset));
  }, [floatOffset]);

  const focusedDateText = useMemo(() => {
    return format(focusedDate, "d MMMM", { locale: ru }).toUpperCase();
  }, [focusedDate]);

  const isFocusedToday = useMemo(() => {
    const today = serverToday || new Date();
    return isSameDay(focusedDate, today);
  }, [focusedDate, serverToday]);

  const earthSize = Math.max(620, Math.min(containerWidth * 1.15, 1100));
  const R = earthSize * 0.52;
  const ANGLE_STEP = 13.5;
  const horizonTopY = 82;

  // Вращение глобуса синхронно с направлением движения расписания
  const earthRotationAngle = useMemo(() => {
    const epochDays = Math.floor(dragAnchorDateRef.current.getTime() / (24 * 60 * 60 * 1000));
    return ((-epochDays - floatOffset) * 13.5) % 360;
  }, [floatOffset]);

  // Непрерывная дуга дат: 9 элементов вокруг центрального дня
  const visibleDays = useMemo(() => {
    const items = [];
    const centerK = Math.round(floatOffset);
    const today = serverToday || new Date();

    for (let k = centerK - 4; k <= centerK + 4; k++) {
      const d = addDays(dragAnchorDateRef.current, k);
      const dow = getDay(d) === 0 ? 7 : getDay(d);

      items.push({
        k,
        dateNumber: d.getDate(),
        short: SHORT_WEEKDAYS[dow - 1],
        isToday: isSameDay(d, today),
      });
    }
    return items;
  }, [floatOffset, serverToday]);

  return (
    <div
      ref={containerRef}
      style={{ touchAction: "pan-y", overscrollBehaviorX: "none" }}
      onClick={() => {
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
          currentVelocityRef.current = 0;
          startSnapSpring(Math.round(floatOffsetRef.current));
        }
      }}
      className="relative flex h-56 w-full select-none flex-col items-center justify-center overflow-hidden rounded-3xl border border-cyan-500/20 bg-[#06080D]/95 shadow-2xl backdrop-blur-md cursor-ew-resize"
    >
      {/* ЧИСЛО И МЕСЯЦ В ЛЕВОМ ВЕРХНЕМ УГЛУ */}
      <div className="absolute top-4 left-6 z-30 flex items-center gap-2.5 pointer-events-none">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xl sm:text-2xl font-black tracking-widest text-cyan-400 drop-shadow-[0_0_12px_rgba(56,189,248,0.75)]">
              {focusedDateText}
            </span>
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_#22D3EE]" />
          </div>
          {isFocusedToday && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 -mt-0.5">
              Сегодня
            </span>
          )}
        </div>
      </div>

      {/* ВРАЩАЮЩАЯСЯ ЗЕМЛЯ НА ЗАДНЕМ ПЛАНЕ */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
          style={{
            width: `${earthSize + 40}px`,
            height: `${earthSize + 40}px`,
            top: `${horizonTopY - 20}px`,
            background:
              "radial-gradient(circle, rgba(56, 189, 248, 0.35) 0%, rgba(14, 165, 233, 0.12) 45%, transparent 72%)",
          }}
        />

        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            width: `${earthSize}px`,
            height: `${earthSize}px`,
            top: `${horizonTopY}px`,
          }}
        >
          <div
            className="h-full w-full rounded-full border border-cyan-500/30 shadow-[inset_0_20px_70px_rgba(15,23,42,0.9),_0_0_40px_rgba(56,189,248,0.25)]"
            style={{
              background: "radial-gradient(circle at 50% 25%, #0e2038 0%, #081424 45%, #02060d 85%)",
              transform: `rotate(${earthRotationAngle}deg)`,
              backfaceVisibility: "hidden",
            }}
          >
            <svg className="h-full w-full" viewBox="0 0 540 540">
              <defs>
                <clipPath id="earthGlobeClip">
                  <circle cx="270" cy="270" r="268" />
                </clipPath>

                <linearGradient id="softLandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.36" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.24" />
                </linearGradient>

                {/* Subtle coast stroke used instead of software rasterized filter */}

                <linearGradient id="orbitDarkDim" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06080D" stopOpacity="0.94" />
                  <stop offset="35%" stopColor="#06080D" stopOpacity="0.82" />
                  <stop offset="65%" stopColor="#06080D" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#06080D" stopOpacity="0" />
                </linearGradient>
              </defs>

              <g clipPath="url(#earthGlobeClip)">
                <g stroke="rgba(56, 189, 248, 0.16)" strokeWidth="1" fill="none">
                  <circle cx="270" cy="270" r="225" strokeDasharray="3 5" />
                  <circle cx="270" cy="270" r="160" strokeDasharray="3 5" />
                  <circle cx="270" cy="270" r="90" strokeDasharray="3 5" />
                  <ellipse cx="270" cy="270" rx="268" ry="115" />
                  <ellipse cx="270" cy="270" rx="268" ry="195" />
                  <ellipse cx="270" cy="270" rx="115" ry="268" />
                  <ellipse cx="270" cy="270" rx="195" ry="268" />
                  <line x1="270" y1="2" x2="270" y2="538" stroke="rgba(56, 189, 248, 0.22)" />
                  <line x1="2" y1="270" x2="538" y2="270" stroke="rgba(56, 189, 248, 0.22)" />
                </g>

                <g
                  transform="translate(270 270) scale(1.35) translate(-270 -270)"
                  fill="url(#softLandGrad)"
                  stroke="rgba(56, 189, 248, 0.65)"
                  strokeWidth="0.85"
                >
                  <path d="M 235,130 Q 250,105 275,90 Q 320,78 375,78 Q 430,82 465,100 Q 475,125 460,150 Q 445,175 425,195 Q 410,215 395,245 Q 380,250 375,230 Q 365,260 355,245 Q 348,225 342,230 Q 332,225 328,195 Q 322,180 305,168 Q 285,165 270,160 Q 245,165 235,165 Q 225,150 235,130 Z" />
                  <path d="M 230,192 Q 260,186 285,190 Q 305,198 322,196 Q 324,215 325,235 Q 336,245 332,260 Q 320,290 305,325 Q 290,355 275,355 Q 260,355 250,325 Q 240,290 225,265 Q 208,245 212,225 Q 215,205 230,192 Z" />
                  <path d="M 75,115 Q 105,95 135,100 Q 155,90 170,105 Q 160,120 168,135 Q 175,150 165,175 Q 160,195 145,210 Q 135,225 125,245 Q 115,235 110,210 Q 95,190 90,165 Q 75,145 75,115 Z" />
                  <path d="M 132,255 Q 155,250 180,265 Q 210,285 210,310 Q 200,345 185,385 Q 175,415 168,420 Q 160,395 155,355 Q 145,310 135,280 Q 128,265 132,255 Z" />
                  <path d="M 188,72 Q 215,68 222,85 Q 220,105 208,110 Q 185,102 188,72 Z" />
                  <path d="M 432,335 Q 460,328 480,342 Q 488,360 480,380 Q 460,392 442,385 Q 425,372 425,352 Q 425,340 432,335 Z" />
                  <path d="M 238,126 Q 244,124 246,134 Q 242,144 238,140 Z" />
                  <path d="M 326,295 Q 332,292 331,310 Q 326,324 322,320 Z" />
                  <path d="M 458,140 Q 464,146 462,160 Q 456,165 456,150 Z" />
                  <ellipse cx="408" cy="272" rx="9" ry="3.5" transform="rotate(-15 408 272)" />
                  <ellipse cx="430" cy="285" rx="11" ry="4" transform="rotate(-10 430 285)" />
                  <path d="M 488,385 Q 492,400 486,415" strokeWidth="2" strokeLinecap="round" />
                </g>

                <rect x="0" y="0" width="540" height="250" fill="url(#orbitDarkDim)" />
              </g>
            </svg>
          </div>
        </div>

        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-full border-t-2 border-cyan-400/80 pointer-events-none"
          style={{
            width: `${earthSize + 4}px`,
            height: `${earthSize + 4}px`,
            top: `${horizonTopY - 2}px`,
            filter: "drop-shadow(0 0 12px rgba(34,211,238,0.85))",
          }}
        />
      </div>

      {/* 3D СТРЕЛКА КОМПАСА */}
      <div className="pointer-events-none absolute top-3.5 z-30 flex flex-col items-center">
        <svg
          width="28"
          height="32"
          viewBox="0 0 28 32"
          fill="none"
          className="drop-shadow-[0_0_14px_rgba(34,211,238,0.95)]"
        >
          <defs>
            <linearGradient id="compassLeftFacet" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="35%" stopColor="#E0F2FE" />
              <stop offset="100%" stopColor="#38BDF8" />
            </linearGradient>

            <linearGradient id="compassRightFacet" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0284C7" />
              <stop offset="60%" stopColor="#0369A1" />
              <stop offset="100%" stopColor="#082F49" />
            </linearGradient>
          </defs>

          <path
            d="M 14,29 L 2,4 L 14,11 Z"
            fill="url(#compassLeftFacet)"
            stroke="#BAE6FD"
            strokeWidth="0.6"
            strokeLinejoin="round"
          />

          <path
            d="M 14,29 L 26,4 L 14,11 Z"
            fill="url(#compassRightFacet)"
            stroke="#0284C7"
            strokeWidth="0.6"
            strokeLinejoin="round"
          />

          <line x1="14" y1="11" x2="14" y2="29" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
        </svg>
      </div>

      {/* ЧИСЛА ДАТ (120 Гц аппаратная интерполяция) */}
      <div className="relative h-28 w-full mt-1 z-30 pointer-events-auto">
        {visibleDays.map((item) => {
          const relativeOffset = item.k - floatOffset;
          const isCentered = Math.abs(relativeOffset) < 0.45;

          const angleDeg = relativeOffset * ANGLE_STEP;
          const angleRad = (angleDeg * Math.PI) / 180;

          const x = R * Math.sin(angleRad);
          const y = horizonTopY + R - R * Math.cos(angleRad) - 34;

          const scale = Math.max(0.72, 1.25 - Math.abs(relativeOffset) * 0.12);
          const opacity = Math.max(0, 1.0 - Math.abs(relativeOffset) * 0.22);

          return (
            <div
              key={item.k}
              onClick={(e) => {
                e.stopPropagation();
                handleDayTap(item.k);
              }}
              className="absolute left-1/2 cursor-pointer p-2"
              style={{
                top: `${y}px`,
                transform: `translate(calc(-50% + ${x}px), 0) rotate(${angleDeg}deg) scale(${scale})`,
                opacity,
                backfaceVisibility: "hidden",
              }}
            >
              <div className="flex flex-col items-center justify-center">
                <span
                  className={`font-mono text-2xl sm:text-3xl font-black leading-none drop-shadow-[0_4px_10px_rgba(0,0,0,0.95)] ${
                    isCentered
                      ? "text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.95)]"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {item.dateNumber < 10 ? `0${item.dateNumber}` : item.dateNumber}
                </span>

                <span
                  className={`text-[10px] font-extrabold uppercase tracking-wider mt-1 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] ${
                    isCentered
                      ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.7)]"
                      : "text-zinc-500"
                  }`}
                >
                  {item.short}
                </span>

                {item.isToday && (
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-400 ring-2 ring-cyan-400/40 shadow-[0_0_8px_#22D3EE]" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}