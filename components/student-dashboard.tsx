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
  ChevronDown,
  ChevronUp,
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
  Search,
  ArrowUpDown,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
  Maximize2,
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
      attachments?: Array<{
        id: string;
        fileName: string;
        fileUrl: string;
        fileType: string;
      }>;
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
  const [isTabContentCollapsed, setIsTabContentCollapsed] = useState<boolean>(false);
  const [isHwFiltersCollapsed, setIsHwFiltersCollapsed] = useState<boolean>(false);
  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState<boolean>(false);
  const [collapsedHwIds, setCollapsedHwIds] = useState<Record<string, boolean>>({});

  // По умолчанию на вкладке ДЗ включается кнопка "Надо сдать" (не сданные ДЗ)
  const [hwStatusFilter, setHwStatusFilter] = useState<"ALL" | "NEED_SUBMIT" | "PENDING" | "GRADED">("NEED_SUBMIT");
  const [hwSort, setHwSort] = useState<"DEADLINE_NEAREST" | "DEADLINE_FURTHEST" | "DATE_NEWEST" | "DATE_OLDEST" | "STATUS" | "SUBJECT">("DEADLINE_NEAREST");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const handleTabClick = (tabId: "schedule" | "homework") => {
    if (activeTab === tabId) {
      // Клик по уже активной вкладке сворачивает / разворачивает её
      setIsTabContentCollapsed((prev) => !prev);
    } else {
      setActiveTab(tabId);
      setIsTabContentCollapsed(false);
      if (tabId === "homework") {
        setHwStatusFilter("NEED_SUBMIT");
      }
    }
  };

  const toggleHwCard = (id: string) => {
    setCollapsedHwIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const collapseAllHw = () => {
    const next: Record<string, boolean> = {};
    homeworks.forEach((h) => { next[h.id] = true; });
    setCollapsedHwIds(next);
  };

  const expandAllHw = () => {
    setCollapsedHwIds({});
  };
  const [viewCheckedHwModal, setViewCheckedHwModal] = useState<typeof homeworks[0] | null>(null);
  const [activeCheckedFileIdx, setActiveCheckedFileIdx] = useState<number>(0);
  const [checkedPageRotation, setCheckedPageRotation] = useState<number>(0);
  const [checkedZoom, setCheckedZoom] = useState<number>(1);

  const parseTeacherFeedback = (raw: string | null | undefined) => {
    if (!raw) {
      return {
        text: "",
        annotations: [] as any[],
        tasks: {} as Record<number, boolean | null>,
        canvasWidth: 800,
        canvasHeight: 1066,
        modifiedImageUrl: "",
      };
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          text: (parsed.text as string) || "",
          annotations: (parsed.annotations as any[]) || [],
          tasks: (parsed.tasks as Record<number, boolean | null>) || {},
          canvasWidth: (parsed.canvasWidth as number) || 800,
          canvasHeight: (parsed.canvasHeight as number) || 1066,
          modifiedImageUrl: (parsed.modifiedImageUrl as string) || "",
        };
      }
    } catch {}
    return {
      text: raw,
      annotations: [] as any[],
      tasks: {} as Record<number, boolean | null>,
      canvasWidth: 800,
      canvasHeight: 1066,
      modifiedImageUrl: "",
    };
  };

  const unsubmittedCount = useMemo(() => homeworks.filter((h) => !h.submission).length, [homeworks]);
  const pendingCount = useMemo(() => homeworks.filter((h) => h.submission && h.submission.grade === null).length, [homeworks]);
  const gradedCount = useMemo(() => homeworks.filter((h) => h.submission && h.submission.grade !== null).length, [homeworks]);

  const displayedHomeworks = useMemo(() => {
    let list = [...homeworks];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.description.toLowerCase().includes(q) ||
          h.subjectName.toLowerCase().includes(q)
      );
    }

    // Filter by subject
    if (selectedSubjectFilter !== "ALL") {
      list = list.filter(
        (h) => h.subjectName.trim().toLowerCase() === selectedSubjectFilter.trim().toLowerCase()
      );
    }

    // Filter by status
    if (hwStatusFilter === "NEED_SUBMIT") {
      list = list.filter((h) => !h.submission);
    } else if (hwStatusFilter === "PENDING") {
      list = list.filter((h) => h.submission && h.submission.grade === null);
    } else if (hwStatusFilter === "GRADED") {
      list = list.filter((h) => h.submission && h.submission.grade !== null);
    }

    // Sorting
    list.sort((a, b) => {
      if (hwSort === "DEADLINE_NEAREST") {
        return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
      }
      if (hwSort === "DEADLINE_FURTHEST") {
        return new Date(b.targetDate).getTime() - new Date(a.targetDate).getTime();
      }
      if (hwSort === "DATE_NEWEST") {
        return new Date(b.targetDate).getTime() - new Date(a.targetDate).getTime();
      }
      if (hwSort === "DATE_OLDEST") {
        return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
      }
      if (hwSort === "SUBJECT") {
        return a.subjectName.localeCompare(b.subjectName, "ru");
      }
      if (hwSort === "STATUS") {
        const getScore = (hw: typeof a) => {
          if (!hw.submission) return 0;
          if (hw.submission.grade === null) return 1;
          return 2;
        };
        return getScore(a) - getScore(b);
      }
      return 0;
    });

    return list;
  }, [homeworks, searchQuery, selectedSubjectFilter, hwStatusFilter, hwSort]);

  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    homeworks.forEach((h) => set.add(h.subjectName.trim()));
    return Array.from(set);
  }, [homeworks]);

  return (
    <div className="min-h-screen space-y-4 sm:space-y-6 p-3 sm:p-6 lg:p-8 max-w-5xl mx-auto pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))] pb-24 sm:pb-8">
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

      {/* СТУДЕНЧЕСКИЕ НАВИГАЦИОННЫЕ ВКЛАДКИ: РАСПИСАНИЕ И ДЗ С ВОЗМОЖНОСТЬЮ СВОРАЧИВАНИЯ */}
      <nav className="flex items-center justify-between gap-2 border-b border-zinc-200/40 pb-2 dark:border-zinc-800 py-1">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none py-0.5">
          {[
            {
              id: "schedule",
              label: "Расписание",
              icon: Calendar,
              badge: null,
            },
            {
              id: "homework",
              label: "Домашние задания",
              icon: BookOpen,
              badge: unsubmittedCount > 0 ? `${unsubmittedCount} сдать` : null,
              totalCount: homeworks.length,
            },
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

            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id as any)}
                className={`flex items-center gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold border whitespace-nowrap shrink-0 transition duration-200 select-none ${
                  isActive
                    ? activeClasses
                    : "border-transparent text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>{tab.label}</span>
                {tab.totalCount !== undefined && (
                  <span className="text-[11px] opacity-75 hidden sm:inline">
                    ({tab.totalCount})
                  </span>
                )}
                {tab.badge && (
                  <span className="rounded-full bg-rose-500 text-white px-2 py-0.5 text-[10px] font-black leading-none animate-pulse shadow-xs">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Кнопка сворачивания / разворачивания всей активной вкладки */}
        <button
          type="button"
          onClick={() => setIsTabContentCollapsed(!isTabContentCollapsed)}
          className={`flex items-center gap-1.5 rounded-xl border px-2.5 sm:px-3 py-1.5 text-xs font-bold transition duration-200 shrink-0 ${
            isTabContentCollapsed
              ? "bg-blue-600/30 text-blue-300 border-blue-500/50 shadow-xs"
              : "bg-white/5 border-zinc-700/60 text-zinc-400 hover:text-white hover:bg-white/10"
          }`}
          title={isTabContentCollapsed ? "Развернуть вкладку" : "Свернуть вкладку"}
        >
          {isTabContentCollapsed ? (
            <>
              <ChevronDown className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[11px]">Развернуть</span>
            </>
          ) : (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-[11px]">Свернуть</span>
            </>
          )}
        </button>
      </nav>

      {/* ЕСЛИ ВКЛАДКА СВЕРНУТА — АККУРАТНЫЙ МИНИ-БАР С КНОПКОЙ РАЗВЕРНУТЬ ОБРАТНО */}
      {isTabContentCollapsed && (
        <div className="glass-panel p-4 sm:p-5 rounded-3xl flex items-center justify-between gap-3 border border-dashed border-zinc-700/80 animate-fade-in shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-zinc-300">
              {activeTab === "schedule" ? (
                <Calendar className="h-5 w-5 text-emerald-400" />
              ) : (
                <BookOpen className="h-5 w-5 text-blue-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-xs sm:text-sm text-zinc-200 truncate">
                {activeTab === "schedule"
                  ? `Вкладка «Расписание» свернута`
                  : `Вкладка «Домашние задания» свернута`}
              </p>
              <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                {activeTab === "schedule"
                  ? `${activeDayLessons.length} уроков на ${activeDateFormatted}. Нажмите, чтобы открыть`
                  : unsubmittedCount > 0
                  ? `Осталось сдать заданий: ${unsubmittedCount}`
                  : `Все задания сданы (${homeworks.length} шт)`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsTabContentCollapsed(false)}
            className="flex items-center gap-1.5 rounded-2xl bg-blue-600 hover:bg-blue-700 px-3.5 sm:px-4 py-2 text-xs font-bold text-white shadow-md transition shrink-0"
          >
            <ChevronDown className="h-4 w-4" />
            <span>Развернуть</span>
          </button>
        </div>
      )}

      {!isTabContentCollapsed && activeTab === "schedule" && (
        <section className="space-y-4 animate-tab-enter">
        <div className="glass-panel flex items-center justify-between rounded-2xl p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-sm sm:text-base font-bold">Расписание:</span>
            <span className="rounded-lg bg-black/10 px-2.5 py-1 text-xs font-semibold dark:bg-white/10">
              {monthTitle}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCalendarCollapsed(!isCalendarCollapsed)}
              className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 hover:text-white px-2.5 py-1.5 rounded-xl hover:bg-white/5 border border-zinc-700/60 transition"
              title={isCalendarCollapsed ? "Развернуть дни недели" : "Свернуть дни недели"}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isCalendarCollapsed ? "Развернуть дни" : "Свернуть дни"}</span>
              {isCalendarCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </button>

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
        </div>

        <div className={theme === "garden" ? "space-y-0" : "space-y-4"}>
          {!isCalendarCollapsed && (
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
          )}

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

                                  {/* Student's submitted attachments preview */}
                                  {(sub as any)?.attachments && (sub as any).attachments.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {(sub as any).attachments.map((file: any) => (
                                        <AttachmentBadge key={file.id} file={file} />
                                      ))}
                                    </div>
                                  )}

                                  {/* Teacher feedback - cleanly parsed, NEVER raw JSON! */}
                                  {sub && (() => {
                                    const parsedFb = parseTeacherFeedback(sub.teacherComment);
                                    return (
                                      <div className="mt-2 space-y-2">
                                        {parsedFb.text ? (
                                          <div className={`rounded-xl p-2.5 text-xs ${
                                            isPlanet
                                              ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                                              : isGarden
                                              ? "bg-[#FEC868]/10 text-[#FEC868] border border-[#FEC868]/20"
                                              : "bg-emerald-500/10 text-emerald-300"
                                          }`}>
                                            <span className="font-bold">Комментарий учителя: </span>
                                            {parsedFb.text}
                                          </div>
                                        ) : null}

                                        {sub.grade !== null && sub.grade !== undefined && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setCheckedPageRotation(0);
                                              setActiveCheckedFileIdx(0);
                                              setViewCheckedHwModal(h);
                                            }}
                                            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition"
                                          >
                                            <Eye className="h-3.5 w-3.5" />
                                            <span>Посмотреть проверенную работу с исправлениями</span>
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })()}
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

      {/* ВКЛАДКА: ДОМАШНИЕ ЗАДАНИЯ (ДЗ) — ПО УМОЛЧАНИЮ ВКЛЮЧЕНА КНОПКА «НАДО СДАТЬ» С ВОЗМОЖНОСТЬЮ СВОРАЧИВАНИЯ */}
      {!isTabContentCollapsed && activeTab === "homework" && (
        <section className="space-y-4 sm:space-y-5 animate-tab-enter">
          {/* Верхняя карточка со сводкой и статусами */}
          <div className="glass-panel flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4 p-4 sm:p-6 rounded-3xl shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
                <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white">Домашние задания</h2>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Все выданные задания, проверка решений и оценки преподавателя
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end">
              {/* Фильтр по статусам: по умолчанию выбран "Надо сдать" (NEED_SUBMIT) */}
              <div className="flex flex-wrap items-center gap-1 bg-black/30 dark:bg-white/5 p-1 rounded-2xl border border-zinc-700/60 text-xs font-bold">
                {[
                  { id: "ALL", label: "Все", count: homeworks.length },
                  { id: "NEED_SUBMIT", label: "Надо сдать", count: unsubmittedCount },
                  { id: "PENDING", label: "На проверке", count: pendingCount },
                  { id: "GRADED", label: "Проверено", count: gradedCount },
                ].map((btn) => {
                  const isActive = hwStatusFilter === btn.id;
                  return (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => setHwStatusFilter(btn.id as any)}
                      className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl transition font-black text-xs ${
                        isActive
                          ? isGarden
                            ? "bg-[#FEC868] text-[#2C2114] shadow-xs"
                            : isPlanet
                            ? "bg-cyan-500 text-black shadow-xs"
                            : "bg-emerald-500 text-white shadow-xs"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <span>{btn.label}</span>
                      <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${isActive ? "bg-black/20" : "bg-white/10"}`}>
                        {btn.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Кнопка сворачивания фильтров и поиска для экономии места на мобильных */}
              <button
                type="button"
                onClick={() => setIsHwFiltersCollapsed(!isHwFiltersCollapsed)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-zinc-700/60 bg-white/5 text-xs font-bold text-zinc-300 hover:text-white transition"
                title="Свернуть / развернуть поиск и фильтры"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{isHwFiltersCollapsed ? "Поиск и фильтры" : "Скрыть фильтры"}</span>
                {isHwFiltersCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Сворачиваемая панель сортировки, поиска и фильтрации */}
          {!isHwFiltersCollapsed && (
            <div className="space-y-3">
              <div className="glass-panel p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shadow-xs">
                {/* Поиск */}
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Поиск по предмету или теме..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700/80 bg-black/20 pl-9 pr-8 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Выбор сортировки */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Сортировка:</span>
                  </span>
                  <select
                    value={hwSort}
                    onChange={(e) => setHwSort(e.target.value as any)}
                    className="w-full sm:w-auto rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-200 focus:border-zinc-500 focus:outline-none shadow-xs"
                  >
                    <option value="DEADLINE_NEAREST">Ближайший дедлайн</option>
                    <option value="DEADLINE_FURTHEST">Дальний дедлайн</option>
                    <option value="DATE_NEWEST">Сначала новые (по дате)</option>
                    <option value="DATE_OLDEST">Сначала старые (по дате)</option>
                    <option value="STATUS">Сначала не сданные</option>
                    <option value="SUBJECT">По предмету (А-Я)</option>
                  </select>
                </div>
              </div>

              {/* Фильтр по предметам */}
              {availableSubjects.length > 1 && (
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setSelectedSubjectFilter("ALL")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs whitespace-nowrap shrink-0 ${
                      selectedSubjectFilter === "ALL"
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "bg-zinc-800/60 text-zinc-400 hover:text-white"
                    }`}
                  >
                    Все предметы ({homeworks.length})
                  </button>
                  {availableSubjects.map((sub) => {
                    const count = homeworks.filter((h) => h.subjectName.trim().toLowerCase() === sub.toLowerCase()).length;
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => setSelectedSubjectFilter(sub)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                          selectedSubjectFilter === sub
                            ? "bg-white text-zinc-900 shadow-sm"
                            : "bg-zinc-800/60 text-zinc-400 hover:text-white"
                        }`}
                      >
                        <span>{sub}</span>
                        <span className="text-[10px] opacity-75">({count})</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Информационная строка со счетчиком и кнопками свернуть/развернуть все карточки */}
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1 pt-1">
            <span>
              Показано: <strong className="text-zinc-200">{displayedHomeworks.length}</strong> {displayedHomeworks.length === 1 ? "задание" : displayedHomeworks.length < 5 ? "задания" : "заданий"}
              {hwStatusFilter === "NEED_SUBMIT" && " (надо сдать)"}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={collapseAllHw}
                className="hover:text-white transition text-[11px] underline underline-offset-2"
              >
                Свернуть все
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={expandAllHw}
                className="hover:text-white transition text-[11px] underline underline-offset-2"
              >
                Развернуть все
              </button>
            </div>
          </div>

          {/* Список карточек ДЗ с возможностью сворачивания каждой карточки */}
          <div className="space-y-3 sm:space-y-4">
            {displayedHomeworks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-zinc-800 p-6 sm:p-10 text-center text-zinc-400">
                {hwStatusFilter === "NEED_SUBMIT" ? (
                  <>
                    <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12 mb-2 text-emerald-400" />
                    <p className="text-base sm:text-lg font-bold text-white">
                      Все домашние задания сданы!
                    </p>
                    <p className="text-xs mt-1 text-zinc-400 max-w-sm">
                      У вас нет долгов или не сданных работ. Вы можете проверить статус отправленных решений или архив всех заданий.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                      {gradedCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setHwStatusFilter("GRADED")}
                          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white transition shadow-xs"
                        >
                          Посмотреть проверенные ({gradedCount})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setHwStatusFilter("ALL")}
                        className="rounded-xl border border-zinc-700 bg-white/5 hover:bg-white/10 px-3.5 py-2 text-xs font-bold text-zinc-300 transition"
                      >
                        Показать все задания ({homeworks.length})
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <BookOpen className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm font-bold text-white">
                      Домашних заданий не найдено
                    </p>
                    <p className="text-xs mt-1 text-zinc-500">
                      Попробуйте сбросить фильтры или изменить поисковый запрос
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedSubjectFilter("ALL");
                        setHwStatusFilter("NEED_SUBMIT");
                      }}
                      className="mt-3 rounded-xl border border-zinc-700 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-300 hover:bg-white/10"
                    >
                      Сбросить фильтры
                    </button>
                  </>
                )}
              </div>
            ) : (
              displayedHomeworks.map((hw) => {
                const sub = hw.submission;
                const feedback = parseTeacherFeedback(sub?.teacherComment);
                const isGraded = sub && sub.grade !== null && sub.grade !== undefined;
                const dateParts = hw.targetDate.split("-");
                const dayStr = dateParts[2] || "16";
                const monthStr = dateParts[1] || "09";
                const isCardCollapsed = !!collapsedHwIds[hw.id];

                return (
                  <div
                    key={hw.id}
                    className="glass-panel rounded-3xl p-4 sm:p-6 shadow-sm space-y-3 sm:space-y-4 hover:border-zinc-600 transition"
                  >
                    {/* Шапка карточки ДЗ: клик сворачивает / разворачивает подробности */}
                    <div
                      onClick={() => toggleHwCard(hw.id)}
                      className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-3 cursor-pointer select-none group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-xs font-black shadow-xs">
                          <span>{dayStr}</span>
                          <span className="text-[9px] opacity-75 leading-none">{monthStr}</span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase tracking-wider text-blue-400 truncate">
                              {hw.subjectName}
                            </span>
                            <span className="text-[11px] text-zinc-400 hidden sm:inline">
                              • Срок: {hw.targetDate}
                            </span>
                          </div>
                          {isCardCollapsed ? (
                            <p className="text-xs font-bold text-zinc-200 truncate mt-0.5">
                              {hw.title}
                            </p>
                          ) : (
                            <span className="text-[11px] text-zinc-400 sm:hidden">
                              Срок: {hw.targetDate}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Правая часть шапки: статус и кнопка свернуть/развернуть */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isGraded ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 sm:px-3.5 py-1 text-xs font-black text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Оценка: {sub.grade}</span>
                          </span>
                        ) : sub ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 sm:px-3.5 py-1 text-xs font-black text-amber-300">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">На проверке</span>
                            <span className="sm:hidden">Сдано</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 border border-rose-500/40 px-2.5 sm:px-3.5 py-1 text-xs font-black text-rose-300">
                            <span>Не сдано</span>
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleHwCard(hw.id);
                          }}
                          className="p-1 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition"
                          title={isCardCollapsed ? "Развернуть задание" : "Свернуть задание"}
                        >
                          {isCardCollapsed ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronUp className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Разворачиваемое тело карточки ДЗ */}
                    {!isCardCollapsed && (
                      <div className="space-y-3 sm:space-y-4 pt-1 animate-fade-in">
                        {/* Название и инструкция */}
                        <div>
                          <h3 className="text-base sm:text-xl font-black text-white tracking-tight">
                            {hw.title}
                          </h3>
                          {hw.description && (
                            <p className="mt-1 text-xs sm:text-sm text-zinc-300 leading-relaxed">
                              {hw.description}
                            </p>
                          )}
                        </div>

                        {/* Прикрепленные учителем файлы */}
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
                                className="flex items-center justify-center gap-2 w-full sm:w-auto rounded-2xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-black text-white shadow-md transition"
                              >
                                <Eye className="h-4 w-4" />
                                <span>Посмотреть проверенную работу с исправлениями</span>
                              </button>
                            </div>
                          ) : sub ? (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2">
                              <span className="text-xs text-zinc-400">
                                Отправлено решение • Ожидает проверки
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveHwModal(hw);
                                  setSubmitText(sub.content || "");
                                }}
                                className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-700 px-3.5 py-1.5 text-xs font-bold text-zinc-200 hover:bg-white/5"
                              >
                                <span>Дополнить ответ</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2">
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
                                className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-black text-white shadow-md transition"
                              >
                                <Send className="h-3.5 w-3.5" />
                                <span>Сдать решение (прикрепить фото)</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
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
                onClick={() => setCheckedZoom((prev) => (prev === 1 ? 1.25 : prev === 1.25 ? 1.5 : 1))}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100 transition"
                title="Масштаб"
              >
                {checkedZoom > 1 ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
              </button>

              {parseTeacherFeedback(viewCheckedHwModal.submission?.teacherComment).modifiedImageUrl ? (
                <a
                  href={parseTeacherFeedback(viewCheckedHwModal.submission?.teacherComment).modifiedImageUrl}
                  download={`Проверенное_ДЗ_${viewCheckedHwModal.subjectName}.jpg`}
                  className="hidden sm:flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 shadow-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Скачать с пометками</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="hidden sm:flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 shadow-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Печать / PDF</span>
                </button>
              )}

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
          <div className="flex flex-1 overflow-hidden rounded-b-3xl bg-white flex-col md:flex-row">
            {/* Center: Actual checked homework with teacher's annotations or modified image */}
            {(() => {
              const feedback = parseTeacherFeedback(viewCheckedHwModal.submission?.teacherComment);
              const studentSubmittedImg =
                viewCheckedHwModal.submission?.attachments?.find((a: any) =>
                  a.fileType?.startsWith("image/") || a.fileUrl?.match(/\.(jpeg|jpg|png|webp|gif)/i)
                )?.fileUrl ||
                viewCheckedHwModal.submission?.attachments?.[0]?.fileUrl;

              return (
                <div className="flex-1 overflow-y-auto bg-[#2E3440] p-4 sm:p-6 flex flex-col items-center justify-start">
                  <div
                    className="relative w-full max-w-3xl overflow-hidden rounded-2xl shadow-2xl bg-white border border-zinc-700 transition-all duration-300 my-auto"
                    style={{
                      transform: `rotate(${checkedPageRotation}deg) scale(${checkedZoom})`,
                      transformOrigin: "center center",
                    }}
                  >
                    {/* 1. If teacher generated and saved a modified image composite, show it directly! */}
                    {feedback.modifiedImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={feedback.modifiedImageUrl}
                        alt="Проверенная работа с исправлениями учителя"
                        className="w-full h-auto object-contain block select-none"
                      />
                    ) : (
                      <div className="relative w-full aspect-[3/4] bg-[#FAF9F5] select-none overflow-hidden">
                        {/* Background: student photo or student answer sheet */}
                        {studentSubmittedImg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={studentSubmittedImg}
                            alt="Работа ученика"
                            className="w-full h-full object-contain pointer-events-none"
                          />
                        ) : (
                          <div className="absolute inset-0 p-8 sm:p-12 text-[#1E293B] font-serif leading-relaxed flex flex-col justify-between overflow-hidden">
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
                                ДЗ: {viewCheckedHwModal.subjectName} — {viewCheckedHwModal.title}
                              </div>
                            </div>

                            {/* Student text answer */}
                            <div className="relative z-0 space-y-3 text-xs sm:text-sm font-mono text-blue-950 my-auto">
                              {viewCheckedHwModal.submission?.content ? (
                                <div className="bg-white/60 p-5 rounded-2xl border border-blue-200 shadow-xs">
                                  <p className="font-bold text-blue-900 text-sm mb-1">Решение ученика:</p>
                                  <p className="font-sans leading-relaxed text-blue-950">{viewCheckedHwModal.submission.content}</p>
                                </div>
                              ) : (
                                <div className="bg-white/60 p-5 rounded-2xl border border-blue-200 shadow-xs">
                                  <p className="font-bold text-blue-900 text-sm mb-1">Выполненное задание:</p>
                                  <p className="font-sans leading-relaxed text-blue-950">
                                    {viewCheckedHwModal.description || `Задание по предмету «${viewCheckedHwModal.subjectName}» выполнено.`}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Footer */}
                            <div className="relative z-0 flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-3 border-t border-zinc-300">
                              <span>Работа проверена преподавателем</span>
                              <span>{viewCheckedHwModal.submission?.submittedAt ? `Сдано: ${String(viewCheckedHwModal.submission.submittedAt).slice(0, 10)}` : "Проверено"}</span>
                            </div>
                          </div>
                        )}

                        {/* 2. Dynamic SVG Layer for Teacher's Pencil Strokes */}
                        {feedback.annotations && feedback.annotations.length > 0 && (
                          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                            {feedback.annotations
                              .filter((item: any) => item.type === "stroke" && item.points?.length > 1)
                              .map((stroke: any) => {
                                const d = stroke.points
                                  .map((pt: any, idx: number) => `${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y}`)
                                  .join(" ");
                                return (
                                  <path
                                    key={stroke.id}
                                    d={d}
                                    fill="none"
                                    stroke={stroke.color || "#EF4444"}
                                    strokeWidth={stroke.width || 3}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                );
                              })}
                          </svg>
                        )}

                        {/* 3. Text Notes Layer */}
                        {feedback.annotations && feedback.annotations.length > 0 && (
                          <div className="absolute inset-0 pointer-events-none z-20">
                            {feedback.annotations
                              .filter((item: any) => item.type === "text" && item.text)
                              .map((textItem: any) => (
                                <div
                                  key={textItem.id}
                                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white/95 px-3 py-1 text-xs font-black shadow-md border"
                                  style={{
                                    left: `${textItem.x}%`,
                                    top: `${textItem.y}%`,
                                    color: textItem.color || "#EF4444",
                                    borderColor: textItem.color || "#EF4444",
                                  }}
                                >
                                  {textItem.text}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Right: Task Checklist & Feedback Sidebar */}
            {(() => {
              const feedback = parseTeacherFeedback(viewCheckedHwModal.submission?.teacherComment);
              const taskEntries = Object.entries(feedback.tasks || {});
              const gradeVal = viewCheckedHwModal.submission?.grade ?? 5;
              let gradeColor = "bg-emerald-600";
              let gradeText = "Отлично!";
              if (gradeVal === 4) {
                gradeColor = "bg-green-600";
                gradeText = "Хорошо!";
              } else if (gradeVal === 3) {
                gradeColor = "bg-amber-500";
                gradeText = "Удовлетворительно";
              } else if (gradeVal === 2) {
                gradeColor = "bg-rose-600";
                gradeText = "Неудовлетворительно";
              }

              return (
                <aside className="w-full md:w-80 shrink-0 border-t md:border-t-0 md:border-l border-zinc-200 bg-zinc-50/80 p-4 sm:p-5 flex flex-col justify-between overflow-y-auto max-h-[220px] md:max-h-none">
                  <div className="space-y-4 sm:space-y-5">
                    {/* 1. Выполнение заданий (если отмечены учителем) */}
                    {taskEntries.length > 0 && (
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900">
                          Выполнение заданий ({taskEntries.length} задач)
                        </h4>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          Отметки преподавателя по номерам:
                        </p>

                        <div className="mt-3 grid grid-cols-5 gap-1.5">
                          {taskEntries.map(([num, isOk]) => (
                            <div
                              key={num}
                              className={`flex h-9 items-center justify-center rounded-xl text-xs font-black shadow-xs ${
                                isOk === true
                                  ? "bg-emerald-500 text-white"
                                  : isOk === false
                                  ? "bg-rose-500 text-white"
                                  : "bg-zinc-200 text-zinc-600"
                              }`}
                            >
                              {num}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 2. Итоговая оценка */}
                    <div className="pt-3 sm:pt-4 border-t border-zinc-200 space-y-2">
                      <span className="text-xs font-black text-zinc-900 block">
                        Итоговая оценка учителя:
                      </span>

                      <div className="flex items-center gap-3">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${gradeColor} text-xl font-black text-white shadow-md`}>
                          {gradeVal}
                        </div>
                        <div>
                          <div className="text-xs font-extrabold text-zinc-900">
                            {gradeText}
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            Работа зачтена в электронный дневник
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3. Комментарий учителя */}
                    <div className="pt-3 sm:pt-4 border-t border-zinc-200">
                      <span className="text-xs font-black text-zinc-900 block mb-1">
                        Замечания преподавателя:
                      </span>
                      <div className="rounded-2xl border border-zinc-200 bg-white p-3.5 text-xs text-zinc-800 leading-relaxed shadow-xs">
                        {feedback.text || "Работа проверена преподавателем. Все требования выполнены."}
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
              );
            })()}
          </div>
        </div>
      )}

      {/* МОБИЛЬНАЯ НИЖНЯЯ ПАНЕЛЬ ДЛЯ ТЕЛЕФОНОВ И ПЛАНШЕТОВ */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/80 px-3 py-2 flex items-center justify-around shadow-[0_-8px_24px_rgba(0,0,0,0.6)]">
        <button
          type="button"
          onClick={() => {
            setActiveTab("schedule");
            setIsTabContentCollapsed(false);
          }}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition text-xs font-bold ${
            activeTab === "schedule" && !isTabContentCollapsed
              ? "text-emerald-400 bg-emerald-500/10"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Calendar className="h-4 w-4 mb-0.5" />
          <span className="text-[10px]">Расписание</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("homework");
            setIsTabContentCollapsed(false);
            setHwStatusFilter("NEED_SUBMIT");
          }}
          className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition text-xs font-bold ${
            activeTab === "homework" && !isTabContentCollapsed
              ? "text-blue-400 bg-blue-500/10"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <BookOpen className="h-4 w-4 mb-0.5" />
          <span className="text-[10px]">Домашние</span>
          {unsubmittedCount > 0 && (
            <span className="absolute -top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-[9px] font-black text-white flex items-center justify-center animate-pulse">
              {unsubmittedCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setIsTabContentCollapsed(!isTabContentCollapsed)}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-xl transition text-xs font-bold text-zinc-400 hover:text-white"
        >
          {isTabContentCollapsed ? (
            <>
              <ChevronDown className="h-4 w-4 mb-0.5 text-blue-400" />
              <span className="text-[10px] text-blue-400">Развернуть</span>
            </>
          ) : (
            <>
              <ChevronUp className="h-4 w-4 mb-0.5" />
              <span className="text-[10px]">Свернуть</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}