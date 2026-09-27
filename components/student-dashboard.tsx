"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  getDay,
  isSameDay,
  parseISO,
} from "date-fns";
import { ru } from "date-fns/locale";
import { ThemeSwitcher } from "./theme-switcher";
import { ThemeCalendarStrip } from "./theme-calendar-strip";
import { useAppTheme } from "./theme-context";
import { logoutAction, submitHomeworkAction } from "@/app/student/actions";
import { AttachmentBadge } from "./attachment-badge";
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Paperclip,
  Clock,
  Send,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  Eye,
  RotateCw,
  Download,
  Check,
  Plus,
  Calendar,
} from "lucide-react";

const SHORT_WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

interface StudentDashboardProps {
  serverDate?: string;
  user: {
    id: string;
    fullName: string;
    login: string;
    className: string;
  };
  scheduleItems: Array<{
    id: string;
    dayOfWeek: number;
    lessonNumber: number;
    startTime: string;
    endTime: string;
    subjectName: string;
    room: string;
    teacherName: string;
  }>;
  homeworks: Array<{
    id: string;
    subjectName: string;
    targetDate: string;
    title: string;
    description: string;
    attachments: Array<{
      id: string;
      fileName: string;
      fileUrl: string;
      fileType: string;
      expiresAt: string | Date;
    }>;
    submission?: {
      id: string;
      content: string;
      submittedAt: string | Date;
      status: string;
      grade: number | null;
      teacherComment: string | null;
    } | null;
  }>;
}

export function StudentDashboard({ user, scheduleItems, homeworks, serverDate }: StudentDashboardProps) {
  const { theme } = useAppTheme();

  // Синхронизация времени с хостом компьютера (2026 год)
  const hostToday = useMemo(() => {
    return serverDate ? parseISO(serverDate) : new Date();
  }, [serverDate]);

  const [currentDate, setCurrentDate] = useState<Date>(hostToday);

  // Периодическая проверка системного времени компьютера
  useEffect(() => {
    const syncWithHost = async () => {
      try {
        const res = await fetch("/api/server-time");
        if (res.ok) {
          const data = await res.json();
          if (data.serverTime) {
            const hostNow = parseISO(data.serverTime);
            if (!isSameDay(hostNow, hostToday)) {
              setCurrentDate(hostNow);
            }
          }
        }
      } catch {}
    };
    const timer = setInterval(syncWithHost, 60000);
    return () => clearInterval(timer);
  }, [hostToday]);

  const [weekAnimDirection, setWeekAnimDirection] = useState<"left" | "right" | null>(null);

  // Понедельник текущей недели
  const monday = useMemo(() => {
    return startOfWeek(currentDate, { weekStartsOn: 1 });
  }, [currentDate]);

  // День недели: 1 (Пн) .. 7 (Вс)
  const selectedDayOfWeek = useMemo(() => {
    const dow = getDay(currentDate);
    return dow === 0 ? 7 : dow;
  }, [currentDate]);

  const handlePrevWeek = (weeks = 1) => {
    setWeekAnimDirection("left");
    setCurrentDate((prev) => subWeeks(prev, weeks));
  };

  const handleNextWeek = (weeks = 1) => {
    setWeekAnimDirection("right");
    setCurrentDate((prev) => addWeeks(prev, weeks));
  };

  // Свайп для переключения недель на карточке расписания в темах standart и garden
  const scheduleTouchStartX = useRef<number | null>(null);
  const scheduleTouchStartY = useRef<number | null>(null);

  const handleScheduleTouchStart = (e: React.TouchEvent) => {
    if (isPlanet) return;
    scheduleTouchStartX.current = e.touches[0].clientX;
    scheduleTouchStartY.current = e.touches[0].clientY;
  };

  const handleScheduleTouchEnd = (e: React.TouchEvent) => {
    if (isPlanet || scheduleTouchStartX.current === null || scheduleTouchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - scheduleTouchStartX.current;
    const dy = e.changedTouches[0].clientY - scheduleTouchStartY.current;
    scheduleTouchStartX.current = null;
    scheduleTouchStartY.current = null;

    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0) {
        handleNextWeek(1);
      } else {
        handlePrevWeek(1);
      }
    }
  };

  const handleSelectDate = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  const monthTitle = useMemo(() => {
    const formatted = format(monday, "LLLL yyyy", { locale: ru });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }, [monday]);

  const weekDayDates = useMemo(() => {
    return [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const d = addDays(monday, i);
      const dayOfWeek = i + 1;
      return {
        dayOfWeek,
        short: SHORT_WEEKDAYS[i],
        dateNumber: d.getDate(),
        fullDateStr: format(d, "yyyy-MM-dd"),
        isToday: isSameDay(d, hostToday),
      };
    });
  }, [monday, hostToday]);

  const activeDateFormatted = useMemo(() => {
    return format(currentDate, "d MMMM", { locale: ru });
  }, [currentDate]);

  const activeDayLessons = useMemo(() => {
    return scheduleItems
      .filter((i) => Number(i.dayOfWeek) === selectedDayOfWeek)
      .sort((a, b) => a.lessonNumber - b.lessonNumber);
  }, [scheduleItems, selectedDayOfWeek]);

  const [activeHwModal, setActiveHwModal] = useState<typeof homeworks[0] | null>(null);
  const [submitText, setSubmitText] = useState("");
  const [submitFiles, setSubmitFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitSolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHwModal) return;
    setIsSubmitting(true);
    try {
      let attachments: any[] = [];
      if (submitFiles.length > 0) {
        const uploadFd = new FormData();
        submitFiles.forEach((f) => uploadFd.append("files", f));
        const res = await fetch("/api/upload", { method: "POST", body: uploadFd });
        const data = await res.json();
        if (data.files) attachments = data.files;
      }

      await submitHomeworkAction({
        homeworkId: activeHwModal.id,
        studentId: user.id,
        content: submitText,
        attachments,
      });

      setActiveHwModal(null);
      setSubmitText("");
      setSubmitFiles([]);
    } catch (err: any) {
      alert(err.message || "Ошибка отправки работы");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPlanet = theme === "planet";
  const isGarden = theme === "garden";

  const roomColorClass =
    isPlanet
      ? "theme-room-text"
      : isGarden
      ? "text-[#FEC868]"
      : "text-emerald-400";

  const hwBadgeClass =
    isPlanet
      ? "theme-hw-chip"
      : isGarden
      ? "bg-[#1B291D] text-[#FEC868] border border-[#FEC868]/40 rounded-full px-3 py-1 font-bold"
      : "bg-emerald-950/50 text-emerald-300 border border-emerald-500/20";

  // Табы студента: Расписание vs Домашние задания
  const [activeTab, setActiveTab] = useState<"schedule" | "homework">("schedule");
  const [hwFilterMode, setHwFilterMode] = useState<"day" | "all">("day");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>("ALL");
  const [viewCheckedHwModal, setViewCheckedHwModal] = useState<typeof homeworks[0] | null>(null);
  const [checkedPageRotation, setCheckedPageRotation] = useState<number>(0);

  const parseTeacherFeedback = (raw: string | null | undefined) => {
    if (!raw) return { text: "", annotations: [], tasks: {} as Record<number, boolean | null> };
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && ("text" in parsed || "annotations" in parsed || "tasks" in parsed)) {
        return {
          text: (parsed.text as string) || "",
          annotations: (parsed.annotations as any[]) || [],
          tasks: (parsed.tasks as Record<number, boolean | null>) || {},
        };
      }
    } catch {}
    return { text: raw, annotations: [], tasks: {} as Record<number, boolean | null> };
  };

  const targetDayStr = useMemo(() => format(currentDate, "yyyy-MM-dd"), [currentDate]);

  const displayedHomeworks = useMemo(() => {
    let list = [...homeworks];
    if (hwFilterMode === "day") {
      list = list.filter((h) => h.targetDate === targetDayStr);
    }
    if (selectedSubjectFilter !== "ALL") {
      list = list.filter(
        (h) => h.subjectName.trim().toLowerCase() === selectedSubjectFilter.trim().toLowerCase()
      );
    }
    return list;
  }, [homeworks, hwFilterMode, targetDayStr, selectedSubjectFilter]);

  const homeworksForTodayCount = useMemo(() => {
    return homeworks.filter((h) => h.targetDate === targetDayStr).length;
  }, [homeworks, targetDayStr]);

  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    homeworks.forEach((h) => set.add(h.subjectName.trim()));
    return Array.from(set);
  }, [homeworks]);

  return (
    <div className="min-h-screen space-y-6 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
      <header className="flex flex-col gap-3 sm:gap-4 border-b border-zinc-200/40 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Электронный Дневник</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {user.fullName} • Класс: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{user.className}</span>
          </p>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3 shrink-0 w-full sm:w-auto">
          <ThemeSwitcher />
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl border border-red-200/80 bg-red-50/70 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400 min-h-[36px] shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Выйти</span>
            </button>
          </form>
        </div>
      </header>

      {/* СТУДЕНЧЕСКИЕ НАВИГАЦИОННЫЕ ВКЛАДКИ: РАСПИСАНИЕ И ДЗ */}
      <nav className="flex items-center gap-2 border-b border-zinc-200/40 pb-2 dark:border-zinc-800 overflow-x-auto scrollbar-none py-1 -mx-2 px-2 sm:mx-0 sm:px-0">
        {[
          { id: "schedule", label: "Расписание" },
          { id: "homework", label: `Домашние задания (${homeworks.length})` },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          let activeClasses = "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 shadow-md";
          if (isPlanet) {
            activeClasses = "bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-[0_0_16px_rgba(56,189,248,0.25)] backdrop-blur-md";
          } else if (theme === "standart") {
            activeClasses = "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_16px_rgba(16,185,129,0.2)] backdrop-blur-md";
          } else if (isGarden) {
            activeClasses = "bg-[#FEC868]/20 text-[#FEC868] border-[#FEC868]/40 shadow-[0_0_16px_rgba(254,200,104,0.2)]";
          }

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-bold border whitespace-nowrap shrink-0 transition duration-200 ${
                isActive
                  ? activeClasses
                  : "border-transparent text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {activeTab === "schedule" && (
        <section className="space-y-4 animate-tab-enter">
        <div className="glass-panel flex items-center justify-between rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold">Расписание:</span>
            <span className="rounded-lg bg-black/10 px-2.5 py-1 text-xs font-semibold dark:bg-white/10">
              {monthTitle}
            </span>
          </div>

          <div className="flex items-center rounded-lg border border-zinc-700">
            <button
              type="button"
              onClick={() => handlePrevWeek(1)}
              className="p-1.5 hover:bg-white/5"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleNextWeek(1)}
              className="p-1.5 hover:bg-white/5"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className={theme === "garden" ? "space-y-0" : "space-y-4"}>
          <ThemeCalendarStrip
            currentDate={currentDate}
            onSelectDate={handleSelectDate}
            serverToday={hostToday}
            days={weekDayDates}
            selectedDayOfWeek={selectedDayOfWeek}
            onSelectDay={(dow) => {
              const target = addDays(monday, dow - 1);
              setCurrentDate(target);
            }}
            onPrevWeek={handlePrevWeek}
            onNextWeek={handleNextWeek}
            onScrubDay={(targetDate) => setCurrentDate(targetDate)}
          />

          <div
            key={monday.toISOString()}
            onTouchStart={handleScheduleTouchStart}
            onTouchEnd={handleScheduleTouchEnd}
            className={`${
              weekAnimDirection === "right"
                ? "animate-week-right"
                : weekAnimDirection === "left"
                ? "animate-week-left"
                : ""
            } ${
              isGarden
                ? "rounded-b-[40px] sm:rounded-b-[50px] bg-[#141E15] p-5 sm:p-7 shadow-2xl text-[#F8F6F0] border-b-2 border-x-2 border-t-0 border-[#2D3E2F] relative z-0 -mt-1"
                : "space-y-3 pt-1"
            }`}
          >
            {/* ПОДПИСЬ ТЕКУЩЕЙ ВЫБРАННОЙ ДАТЫ (без разделительной полосы) */}
            <div className="mb-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span
                  className={`font-bold text-sm tracking-wide ${
                    isGarden
                      ? "text-[#F8F6F0] font-extrabold flex items-center gap-2"
                      : isPlanet
                      ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.4)]"
                      : "text-emerald-400 font-bold"
                  }`}
                >
                  {isGarden && <span className="h-2.5 w-2.5 rounded-full bg-[#FEC868] shadow-[0_0_8px_#FEC868] shrink-0" />}
                  {selectedDayOfWeek === 7
                    ? `Воскресенье, ${activeDateFormatted} — Выходной день`
                    : `Уроки на ${activeDateFormatted} (${SHORT_WEEKDAYS[selectedDayOfWeek - 1].toUpperCase()})`}
                </span>
                {isGarden && (
                  <span className="text-[11px] font-bold text-[#ABC270] uppercase tracking-wider px-3.5 py-0.5 rounded-full bg-[#1C2B1D] border border-[#2E4230]">
                    {selectedDayOfWeek === 7 ? "Выходной" : SHORT_WEEKDAYS[selectedDayOfWeek - 1].toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3 min-h-[380px]">
              {activeDayLessons.length === 0 ? (
                <div
                  className={`flex h-64 flex-col items-center justify-center p-8 text-center text-sm ${
                    isGarden
                      ? "rounded-[34px] border-2 border-dashed border-[#FEC868]/50 text-[#FEC868] bg-[#FEC868]/10"
                      : isPlanet
                      ? "rounded-3xl border border-cyan-500/20 text-cyan-300/80 bg-cyan-950/10"
                      : "rounded-3xl border border-dashed border-zinc-800 text-zinc-400"
                  }`}
                >
                  {selectedDayOfWeek === 7 ? (
                    <>
                      <span className={`text-base font-bold ${isGarden ? "text-[#FEC868]" : "text-cyan-300"}`}>
                        Воскресенье — выходной
                      </span>
                      <span className={`text-xs mt-1 ${isGarden ? "text-[#ABC270]" : "text-zinc-400"}`}>
                        В этот день занятий нет, уроки начнутся в понедельник
                      </span>
                    </>
                  ) : (
                    <span>В этот день занятий нет</span>
                  )}
                </div>
              ) : (
                activeDayLessons.map((l) => {
                  const targetDayStr = format(currentDate, "yyyy-MM-dd");
                  const attachedHw = homeworks.filter(
                    (h) =>
                      h.targetDate === targetDayStr &&
                      h.subjectName.trim().toLowerCase() === l.subjectName.trim().toLowerCase()
                  );

                  return (
                    <div key={l.id} className="flex items-stretch gap-3 sm:gap-4">
                      <div className="flex w-12 sm:w-14 flex-col justify-between py-1 text-right shrink-0">
                        <span
                          className={`text-xs sm:text-sm font-bold ${
                            isGarden ? "text-[#FEC868] font-black" : "text-zinc-100"
                          }`}
                        >
                          {l.startTime}
                        </span>
                        <span
                          className={`text-xs sm:text-sm font-medium ${
                            isGarden ? "text-[#FEC868]/75 font-bold" : "text-zinc-400"
                          }`}
                        >
                          {l.endTime}
                        </span>
                      </div>

                      <div
                        className={`group flex-1 p-4 sm:p-5 shadow-sm transition-all duration-200 ${
                          isGarden
                            ? "bg-[#FEC868] text-[#2C2114] border border-[#DEAC4E] shadow-[0_4px_16px_rgba(254,200,104,0.25)] hover:bg-[#FFD782] hover:border-[#F2C063] hover:shadow-[0_8px_24px_rgba(254,200,104,0.4)] hover:-translate-y-0.5 rounded-[28px] sm:rounded-[36px]"
                            : "glass-panel glass-interactive rounded-2xl sm:rounded-3xl"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className={`text-xs font-black ${isGarden ? "text-[#1C4222]" : roomColorClass}`}>
                              {l.room.toLowerCase().startsWith("каб") ? l.room : `каб. ${l.room}`}
                            </div>
                            <div className={`mt-0.5 text-xs ${isGarden ? "text-[#5A452C] font-semibold" : "text-zinc-400"}`}>
                              {l.teacherName}
                            </div>
                          </div>
                        </div>

                        <div className={`mt-3 text-sm sm:text-base font-black ${isGarden ? "text-[#241A0E]" : "text-white"}`}>
                          {l.subjectName}
                        </div>

                        {attachedHw.length > 0 && (
                          <div className={`mt-3 space-y-2 border-t pt-2 ${isGarden ? "border-[#DEAC4A]/60" : "border-zinc-700/60"}`}>
                            {attachedHw.map((h) => {
                              const sub = h.submission;
                              return (
                                <div
                                  key={h.id}
                                  className={`p-3.5 ${
                                    isGarden
                                      ? "rounded-[22px] bg-[#FCE5A2] border border-[#DEAC4A]/70 text-[#2B1F12] shadow-xs"
                                      : isPlanet
                                      ? "rounded-xl bg-[#090D15]/80 border border-cyan-500/25"
                                      : "rounded-xl border border-zinc-700/60 bg-black/20"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className={`flex items-center gap-1.5 font-bold text-xs ${isGarden ? "text-[#1C4222]" : roomColorClass}`}>
                                        <BookOpen className="h-3.5 w-3.5" />
                                        <span>ДЗ: {h.title}</span>
                                      </div>
                                      <p className={`mt-1 text-xs ${isGarden ? "text-[#523E25]" : "text-zinc-400"}`}>{h.description}</p>
                                    </div>

                                    {sub?.grade ? (
                                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold text-cyan-300 border border-cyan-400/40 shadow-[0_0_10px_rgba(56,189,248,0.4)]">
                                        {sub.grade}
                                      </span>
                                    ) : sub ? (
                                      <span className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
                                        <Clock className="h-3 w-3" />
                                        Сдано
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setActiveHwModal(h)}
                                        className={
                                          isGarden
                                            ? "rounded-full px-4 py-1.5 text-xs font-black bg-[#2E5A36] text-[#F8F6F0] hover:bg-[#3B6F45] border border-[#447A4E]/60 shadow-md transition"
                                            : "theme-btn px-3 py-1 text-xs font-bold"
                                        }
                                      >
                                        Сдать
                                      </button>
                                    )}
                                  </div>

                                  {h.attachments.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {h.attachments.map((file) => (
                                        <AttachmentBadge key={file.id} file={file} />
                                      ))}
                                    </div>
                                  )}

                                  {sub?.teacherComment && (
                                    <div className={`mt-2 rounded-xl p-2.5 text-xs ${
                                      isPlanet
                                        ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                                        : isGarden
                                        ? "bg-[#FEC868]/10 text-[#FEC868] border border-[#FEC868]/20"
                                        : "bg-emerald-500/10 text-emerald-300"
                                    }`}>
                                      <span className="font-semibold">Комментарий учителя: </span>
                                      {sub.teacherComment}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ВКЛАДКА: ДОМАШНИЕ ЗАДАНИЯ (ДЗ) */}
      {activeTab === "homework" && (
        <section className="space-y-5 animate-tab-enter">
          {/* Верхняя карточка с переключателем режима: На выбранный день vs Все ДЗ */}
          <div className="glass-panel flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-5 rounded-3xl shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">Домашние задания</h2>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Все выданные задания, прикрепленные PDF-файлы и проверенные работы с оценками
              </p>
            </div>

            {/* Переключатель: На день vs Все задания */}
            <div className="flex items-center gap-1.5 bg-black/25 dark:bg-white/5 p-1 rounded-2xl border border-zinc-700/60 text-xs font-bold shrink-0">
              <button
                type="button"
                onClick={() => setHwFilterMode("day")}
                className={`px-3.5 py-1.5 rounded-xl transition ${
                  hwFilterMode === "day"
                    ? isGarden
                      ? "bg-[#FEC868] text-[#2C2114] shadow-xs font-black"
                      : isPlanet
                      ? "bg-cyan-500 text-black shadow-xs font-black"
                      : "bg-emerald-500 text-white shadow-xs font-black"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                На день ({homeworksForTodayCount})
              </button>
              <button
                type="button"
                onClick={() => setHwFilterMode("all")}
                className={`px-3.5 py-1.5 rounded-xl transition ${
                  hwFilterMode === "all"
                    ? isGarden
                      ? "bg-[#FEC868] text-[#2C2114] shadow-xs font-black"
                      : isPlanet
                      ? "bg-cyan-500 text-black shadow-xs font-black"
                      : "bg-emerald-500 text-white shadow-xs font-black"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Все задания ({homeworks.length})
              </button>
            </div>
          </div>

          {/* Интерактивная полоса дней недели при режиме «На день» */}
          {hwFilterMode === "day" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1 text-xs">
                <span className="font-extrabold text-zinc-300">
                  Выбранный день: <span className="text-blue-400 font-black">{activeDateFormatted}</span>
                </span>
                <span className="text-zinc-500 text-[11px]">
                  Нажимайте на даты ниже для просмотра ДЗ на день
                </span>
              </div>
              <ThemeCalendarStrip
                currentDate={currentDate}
                onSelectDate={handleSelectDate}
                serverToday={hostToday}
                days={weekDayDates}
                selectedDayOfWeek={selectedDayOfWeek}
                onSelectDay={(dow) => {
                  const target = addDays(monday, dow - 1);
                  setCurrentDate(target);
                }}
                onPrevWeek={handlePrevWeek}
                onNextWeek={handleNextWeek}
                onScrubDay={(targetDate) => setCurrentDate(targetDate)}
              />
            </div>
          )}

          {/* Фильтр по предметам */}
          {availableSubjects.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedSubjectFilter("ALL")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-xs whitespace-nowrap ${
                  selectedSubjectFilter === "ALL"
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "bg-zinc-800/60 text-zinc-400 hover:text-white"
                }`}
              >
                Все предметы
              </button>
              {availableSubjects.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setSelectedSubjectFilter(sub)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-xs whitespace-nowrap ${
                    selectedSubjectFilter === sub
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "bg-zinc-800/60 text-zinc-400 hover:text-white"
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}

          {/* Список карточек ДЗ */}
          <div className="space-y-4">
            {displayedHomeworks.length === 0 ? (
              <div className="flex h-56 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-zinc-800 p-8 text-center text-zinc-400">
                <BookOpen className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm font-bold">
                  {hwFilterMode === "day"
                    ? `На ${activeDateFormatted} домашних заданий нет`
                    : "Домашних заданий не найдено"}
                </p>
                <p className="text-xs mt-1 text-zinc-500">
                  {hwFilterMode === "day"
                    ? "Выберите другой день в календаре выше или переключитесь на «Все задания»"
                    : "Учитель еще не добавил новые домашние работы"}
                </p>
              </div>
            ) : (
              displayedHomeworks.map((hw) => {
                const sub = hw.submission;
                const feedback = parseTeacherFeedback(sub?.teacherComment);
                const isGraded = sub && sub.grade !== null && sub.grade !== undefined;
                const dateParts = hw.targetDate.split("-");
                const dayStr = dateParts[2] || "16";
                const monthStr = dateParts[1] || "09";

                return (
                  <div
                    key={hw.id}
                    className="glass-panel rounded-3xl p-5 sm:p-6 shadow-sm space-y-4 hover:border-zinc-600 transition"
                  >
                    {/* Шапка карточки ДЗ */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-xs font-black shadow-xs">
                          <span>{dayStr}</span>
                          <span className="text-[9px] opacity-75 leading-none">{monthStr}</span>
                        </div>

                        <div>
                          <span className="text-xs font-black uppercase tracking-wider text-blue-400">
                            {hw.subjectName}
                          </span>
                          <div className="text-[11px] text-zinc-400">
                            Срок сдачи: {hw.targetDate}
                          </div>
                        </div>
                      </div>

                      {/* Статус выполнения ДЗ */}
                      <div>
                        {isGraded ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3.5 py-1 text-xs font-black text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Проверено • Оценка: {sub.grade}</span>
                          </span>
                        ) : sub ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 px-3.5 py-1 text-xs font-black text-amber-300">
                            <Clock className="h-3.5 w-3.5" />
                            <span>Сдано • Ожидает проверки</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 border border-zinc-700 px-3.5 py-1 text-xs font-bold text-zinc-400">
                            <span>Не сдано</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Название и инструкция */}
                    <div>
                      <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                        {hw.title}
                      </h3>
                      {hw.description && (
                        <p className="mt-1 text-xs sm:text-sm text-zinc-300 leading-relaxed">
                          {hw.description}
                        </p>
                      )}
                    </div>

                    {/* Прикрепленные учителем файлы PDF */}
                    {hw.attachments && hw.attachments.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-zinc-400 block">
                          Прикрепленные материалы к уроку:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {hw.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={att.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 transition"
                            >
                              <FileText className="h-3.5 w-3.5 text-rose-400" />
                              <span className="font-semibold max-w-[200px] truncate">{att.fileName}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Нижняя панель действий */}
                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-zinc-800/80">
                      {isGraded ? (
                        <div className="flex-1 space-y-2">
                          {feedback.text && (
                            <div className="text-xs text-zinc-200 bg-emerald-950/40 border border-emerald-500/25 rounded-2xl p-3">
                              <span className="font-black text-emerald-400 block mb-0.5">
                                Отзыв учителя:
                              </span>
                              {feedback.text}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setCheckedPageRotation(0);
                              setViewCheckedHwModal(hw);
                            }}
                            className="flex items-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-black text-white shadow-md transition"
                          >
                            <Eye className="h-4 w-4" />
                            <span>Посмотреть проверенную работу с исправлениями</span>
                          </button>
                        </div>
                      ) : sub ? (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs text-zinc-400">
                            Отправлено решение • Ожидает проверки
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveHwModal(hw);
                              setSubmitText(sub.content || "");
                            }}
                            className="flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3.5 py-1.5 text-xs font-bold text-zinc-200 hover:bg-white/5"
                          >
                            <span>Дополнить ответ</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs text-zinc-400">
                            Срок сдачи: {hw.targetDate}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveHwModal(hw);
                              setSubmitText("");
                              setSubmitFiles([]);
                            }}
                            className="flex items-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-black text-white shadow-md transition"
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span>Сдать решение (прикрепить фото)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* Модальное окно сдачи ДЗ */}
      {activeHwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-bold text-base">Сдача домашнего задания</h3>
                <p className="text-xs text-zinc-400">{activeHwModal.subjectName}: {activeHwModal.title}</p>
              </div>
              <button onClick={() => setActiveHwModal(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSolution} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="font-medium text-zinc-400">Ваш ответ или комментарий:</label>
                <textarea
                  rows={4}
                  required
                  value={submitText}
                  onChange={(e) => setSubmitText(e.target.value)}
                  placeholder="Опишите выполненное задание..."
                  className="mt-1 w-full rounded-2xl border border-zinc-700 bg-transparent p-3 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="font-medium text-zinc-400">Прикрепить фото или файл:</label>
                <div className="mt-1">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-white/5">
                    <Paperclip className="h-3.5 w-3.5" />
                    <span>Выбрать файлы</span>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          setSubmitFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                {submitFiles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {submitFiles.map((file, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-medium"
                      >
                        <span className="max-w-[140px] truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setSubmitFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-zinc-400 hover:text-red-400"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveHwModal(null)}
                  className="rounded-lg px-4 py-2 font-medium hover:bg-white/10"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="theme-btn flex items-center gap-1.5 px-5 py-2 font-bold disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{isSubmitting ? "Отправка..." : "Отправить"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно просмотра проверенной работы с пометками учителя (как на фото 1) */}
      {viewCheckedHwModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-900/90 p-2 sm:p-4 backdrop-blur-md overflow-hidden text-zinc-900 font-sans">
          {/* Header */}
          <div className="flex h-14 w-full items-center justify-between rounded-t-3xl bg-white px-4 sm:px-6 border-b border-zinc-200 shadow-sm shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-bold text-xs shrink-0">
                ДЗ
              </span>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-extrabold text-zinc-900 truncate">
                  {viewCheckedHwModal.title}
                </h3>
                <p className="text-[11px] font-semibold text-zinc-500">
                  {viewCheckedHwModal.subjectName} • Проверено учителем
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCheckedPageRotation((prev) => (prev + 90) % 360)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100 transition"
                title="Повернуть лист на 90°"
              >
                <RotateCw className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="hidden sm:flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 shadow-xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Печать / PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setViewCheckedHwModal(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Body: Center Viewport + Right Grading Sidebar */}
          <div className="flex flex-1 overflow-hidden rounded-b-3xl bg-white">
            {/* Center: Student handwritten notebook sheet with teacher's red annotations */}
            <div className="flex-1 overflow-y-auto bg-[#2E3440] p-4 sm:p-6 flex flex-col items-center justify-start">
              <div
                className="relative w-full max-w-3xl overflow-hidden rounded-2xl shadow-2xl bg-white border border-zinc-700 transition-transform duration-300 my-auto"
                style={{
                  transform: `rotate(${checkedPageRotation}deg)`,
                  transformOrigin: "center center",
                }}
              >
                {/* 1. Underlying Handwritten Notebook Page */}
                <div className="relative w-full aspect-[3/4] bg-[#FAF9F5] select-none p-6 sm:p-10 font-serif leading-relaxed flex flex-col justify-between overflow-hidden">
                  {/* Notebook Squared Grid Background */}
                  <div
                    className="absolute inset-0 opacity-25 pointer-events-none"
                    style={{
                      backgroundImage:
                        "linear-gradient(to right, #94A3B8 1px, transparent 1px), linear-gradient(to bottom, #94A3B8 1px, transparent 1px)",
                      backgroundSize: "20px 20px",
                    }}
                  />

                  {/* Header */}
                  <div className="relative z-0 space-y-1.5 border-b border-blue-400/40 pb-2">
                    <div className="flex items-center justify-between font-mono text-xs font-bold text-blue-900">
                      <span>{user.fullName}</span>
                      <span>{viewCheckedHwModal.targetDate}</span>
                    </div>
                    <div className="text-center font-mono text-sm sm:text-base font-extrabold text-blue-950">
                      ДЗ. {viewCheckedHwModal.title} — все типы задания № 2
                    </div>
                  </div>

                  {/* Mathematical solutions written in blue pen */}
                  <div className="relative z-0 space-y-4 text-xs sm:text-sm font-mono text-blue-950">
                    <div>
                      <p className="font-bold text-blue-900">
                        1. Даны векторы a&#773;(11; 0) и b&#773;(1; -5). Найдите длину a&#773; - 3b&#773;.
                      </p>
                      <p className="pl-4 mt-0.5 text-blue-800">
                        (11; 0) - 3(1; -5) = (8; 15) &rArr; |a&#773; - 3b&#773;| = &radic;(64 + 225) = 17.
                      </p>
                    </div>

                    <div>
                      <p className="font-bold text-blue-900">
                        2. Найдите длину вектора a&#773;(-5; 12).
                      </p>
                      <p className="pl-4 mt-0.5 text-blue-800">
                        |a&#773;| = &radic;(25 + 144) = &radic;169 = 13.
                      </p>
                    </div>

                    <div>
                      <p className="font-bold text-blue-900">
                        3. Даны векторы a&#773;(-15; -3), b&#773;(-3; 4) и c&#773;(0; 4).
                      </p>
                      <p className="pl-4 mt-0.5 text-blue-800">
                        2a&#773; - 3b&#773; + c&#773; = (-30; -6) + (9; -12) + (0; 4) = (-21; -14).
                      </p>
                    </div>

                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-blue-900">
                          4. Скалярное произведение a&#773; &bull; b&#773;:
                        </p>
                        <p className="pl-4 mt-0.5 text-blue-800">
                          a&#773;(5; 4), b&#773;(1; 3) &rArr; 5 + 12 = 17.
                        </p>
                        <p className="pl-4 text-blue-800">
                          cos(&alpha;) = 17 / (&radic;41 &bull; &radic;10) &asymp; 0.84.
                        </p>
                      </div>

                      <div className="w-28 h-24 border border-zinc-400 bg-white/80 rounded p-1 flex items-center justify-center relative">
                        <div className="w-full h-px bg-zinc-400 absolute" />
                        <div className="h-full w-px bg-zinc-400 absolute" />
                        <svg className="w-full h-full absolute inset-0">
                          <line x1="56" y1="48" x2="85" y2="24" stroke="#1E40AF" strokeWidth="2" />
                          <line x1="56" y1="48" x2="75" y2="35" stroke="#0284C7" strokeWidth="1.5" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="relative z-0 text-right text-[11px] font-mono text-zinc-500 pt-3 border-t border-zinc-300">
                    Работа выполнена самостоятельно • Стр. 1 из 1
                  </div>

                  {/* 2. Teacher's Red Ink Marks Overlay */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                    {/* Checkmarks in red pen */}
                    <path d="M 40 140 L 48 152 L 72 130" fill="none" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M 40 220 L 48 232 L 72 210" fill="none" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M 40 300 L 48 312 L 72 290" fill="none" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M 40 380 L 48 392 L 72 370" fill="none" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    {/* Red wavy underline on coordinate note */}
                    <path d="M 280 375 Q 290 370 300 375 T 320 375 T 340 375" fill="none" stroke="#EF4444" strokeWidth="2" />
                  </svg>

                  {/* 3. Teacher's Red Text Annotation Marker */}
                  <div className="absolute top-16 right-8 z-20 rounded-xl bg-white/95 px-3 py-1.5 text-xs font-black text-red-600 shadow-md border border-red-500">
                    ✓ Отлично! Все вычисления верны
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Task Checklist & Feedback Sidebar */}
            <aside className="w-72 sm:w-80 shrink-0 border-l border-zinc-200 bg-zinc-50/80 p-5 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-5">
                {/* 1. Выполнение заданий 1..14 */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900">
                    Выполнение заданий (14 задач)
                  </h4>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Зеленым отмечены правильно решенные задачи:
                  </p>

                  <div className="mt-3 grid grid-cols-5 gap-1.5">
                    {Array.from({ length: 14 }).map((_, i) => {
                      const num = i + 1;
                      const isError = num === 6; // Matching Image 1 mock
                      return (
                        <div
                          key={num}
                          className={`flex h-9 items-center justify-center rounded-xl text-xs font-black shadow-xs ${
                            isError
                              ? "bg-rose-500 text-white"
                              : "bg-emerald-500 text-white"
                          }`}
                        >
                          {num}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-zinc-400 px-1">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" /> Верно (13)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-rose-500" /> Ошибка (1)
                    </span>
                  </div>
                </div>

                {/* 2. Итоговая оценка */}
                <div className="pt-4 border-t border-zinc-200 space-y-2">
                  <span className="text-xs font-black text-zinc-900 block">
                    Итоговая оценка учителя:
                  </span>

                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-xl font-black text-white shadow-md">
                      {viewCheckedHwModal.submission?.grade || 5}
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-emerald-700">
                        Отлично!
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        Работа зачтена в электронный журнал
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Комментарий учителя */}
                <div className="pt-4 border-t border-zinc-200">
                  <span className="text-xs font-black text-zinc-900 block mb-1">
                    Замечания преподавателя:
                  </span>
                  <div className="rounded-2xl border border-zinc-200 bg-white p-3 text-xs text-zinc-800 leading-relaxed shadow-xs">
                    {parseTeacherFeedback(viewCheckedHwModal.submission?.teacherComment).text ||
                      "Все верно, отличная работа! Но аккуратнее оформляйте чертежи к задачам на векторы."}
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <div className="pt-4 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setViewCheckedHwModal(null)}
                  className="w-full rounded-xl bg-zinc-900 py-2.5 text-xs font-black text-white hover:bg-zinc-800 transition"
                >
                  Закрыть просмотр
                </button>
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}