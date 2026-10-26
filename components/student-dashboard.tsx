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
import { DatePicker } from "./date-picker";
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
  Eye,
  RotateCw,
  Download,
  Calendar,
  Search,
  ArrowUpDown,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
  GraduationCap,
} from "lucide-react";
import { EgeStudentView, StudentEgeAssignmentItem } from "./ege-student-view";
import { Button, Input, Textarea, Select, Card, SegmentedControl, Modal } from "./ui-kit";

const SHORT_WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

interface StudentDashboardProps {
  serverDate?: string;
  user: {
    id: string;
    fullName: string;
    login: string;
    className: string;
    examTrack?: string | null;
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
  egeItems?: StudentEgeAssignmentItem[];
}

export function StudentDashboard({
  user,
  scheduleItems,
  homeworks,
  egeItems = [],
  serverDate,
}: StudentDashboardProps) {
  const { colorMode, scheduleViewMode } = useAppTheme();
  const isLight = colorMode === "light";
  const isPlanetSchedule = scheduleViewMode === "planet";

  const hostToday = useMemo(() => {
    return serverDate ? parseISO(serverDate) : new Date();
  }, [serverDate]);

  const [currentDate, setCurrentDate] = useState<Date>(hostToday);

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

  const monday = useMemo(() => {
    return startOfWeek(currentDate, { weekStartsOn: 1 });
  }, [currentDate]);

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

  const scheduleTouchStartX = useRef<number | null>(null);
  const scheduleTouchStartY = useRef<number | null>(null);

  const handleScheduleTouchStart = (e: React.TouchEvent) => {
    if (isPlanetSchedule) return;
    scheduleTouchStartX.current = e.touches[0].clientX;
    scheduleTouchStartY.current = e.touches[0].clientY;
  };

  const handleScheduleTouchEnd = (e: React.TouchEvent) => {
    if (isPlanetSchedule || scheduleTouchStartX.current === null || scheduleTouchStartY.current === null) return;
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

  const roomColorClass = "theme-room-text";

  const [activeTab, setActiveTab] = useState<"schedule" | "homework" | "ege">("schedule");
  const [isTabContentCollapsed, setIsTabContentCollapsed] = useState<boolean>(false);
  const [isHwFiltersCollapsed, setIsHwFiltersCollapsed] = useState<boolean>(false);
  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState<boolean>(false);
  const [collapsedHwIds, setCollapsedHwIds] = useState<Record<string, boolean>>({});

  const pendingEgeCount = useMemo(() => {
    return egeItems.filter((i) => i.status === "ASSIGNED").length;
  }, [egeItems]);

  const [hwStatusFilter, setHwStatusFilter] = useState<"ALL" | "NEED_SUBMIT" | "PENDING" | "GRADED">("NEED_SUBMIT");
  const [hwSort, setHwSort] = useState<
    "DEADLINE_NEAREST" | "DEADLINE_FURTHEST" | "DATE_NEWEST" | "DATE_OLDEST" | "STATUS" | "SUBJECT"
  >("DEADLINE_NEAREST");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const handleTabClick = (tabId: "schedule" | "homework" | "ege") => {
    if (activeTab === tabId) {
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
    homeworks.forEach((h) => {
      next[h.id] = true;
    });
    setCollapsedHwIds(next);
  };

  const expandAllHw = () => {
    setCollapsedHwIds({});
  };

  const [viewCheckedHwModal, setViewCheckedHwModal] = useState<typeof homeworks[0] | null>(null);
  const [, setActiveCheckedFileIdx] = useState<number>(0);
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
  const pendingCount = useMemo(
    () => homeworks.filter((h) => h.submission && h.submission.grade === null).length,
    [homeworks]
  );
  const gradedCount = useMemo(
    () => homeworks.filter((h) => h.submission && h.submission.grade !== null).length,
    [homeworks]
  );

  const displayedHomeworks = useMemo(() => {
    let list = [...homeworks];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.description.toLowerCase().includes(q) ||
          h.subjectName.toLowerCase().includes(q)
      );
    }

    if (selectedSubjectFilter !== "ALL") {
      list = list.filter(
        (h) => h.subjectName.trim().toLowerCase() === selectedSubjectFilter.trim().toLowerCase()
      );
    }

    if (hwStatusFilter === "NEED_SUBMIT") {
      list = list.filter((h) => !h.submission);
    } else if (hwStatusFilter === "PENDING") {
      list = list.filter((h) => h.submission && h.submission.grade === null);
    } else if (hwStatusFilter === "GRADED") {
      list = list.filter((h) => h.submission && h.submission.grade !== null);
    }

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
    <div className="min-h-screen w-full max-w-5xl mx-auto overflow-x-hidden space-y-4 sm:space-y-5 p-3 sm:p-6 lg:p-8 pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))]">
      {/* ШАПКА УЧЕНИКА С ПОЛНЫМ ОТОБРАЖЕНИЕМ ЗАГОЛОВКА И ФИО */}
      <header
        className={`flex flex-col gap-1.5 border-b pb-3.5 ${
          isLight ? "border-slate-200/80" : "border-zinc-800/80"
        }`}
      >
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <h1 className="text-base sm:text-2xl font-bold tracking-tight whitespace-nowrap">
            Электронный Дневник
          </h1>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <ThemeSwitcher />
            <form action={logoutAction}>
              <Button
                type="submit"
                variant="secondary"
                size="icon"
                title="Выйти из аккаунта"
                aria-label="Выйти из аккаунта"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>

        <p
          className={`text-xs flex items-center flex-wrap gap-1.5 leading-snug ${
            isLight ? "text-slate-500" : "text-zinc-400"
          }`}
        >
          <span>
            {user.fullName} •{" "}
            <span className={`font-semibold ${isLight ? "text-slate-800" : "text-zinc-100"}`}>
              {user.className}
            </span>
          </span>
          {user.examTrack && (
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border ${
                user.examTrack === "Профиль"
                  ? isLight
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : "bg-purple-500/20 text-purple-300 border-purple-500/40"
                  : isLight
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-amber-500/20 text-amber-300 border-amber-500/40"
              }`}
            >
              {user.examTrack}
            </span>
          )}
        </p>
      </header>

      {/* ВЕРХНИЕ ВКЛАДКИ В ОСНОВНОМ ПОТОКЕ НА ВСЕХ УСТРОЙСТВАХ (КАК У УЧИТЕЛЯ) */}
      <nav
        className={`flex items-center justify-between gap-2 overflow-x-auto no-scrollbar whitespace-nowrap px-3 -mx-3 sm:mx-0 sm:px-0 border-b pb-2.5 pt-0.5 ${
          isLight ? "border-slate-200/80" : "border-zinc-800/80"
        }`}
      >
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
            {
              id: "ege",
              label: "Задания ЕГЭ",
              icon: GraduationCap,
              badge: pendingEgeCount > 0 ? `${pendingEgeCount} сдать` : null,
              totalCount: egeItems.length,
            },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id as any)}
                className={`flex items-center gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-bold border whitespace-nowrap shrink-0 transition duration-200 select-none cursor-pointer ${
                  isActive
                    ? isLight
                      ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                      : "bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-[0_0_16px_rgba(56,189,248,0.2)]"
                    : isLight
                    ? "bg-slate-100 border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
                    : "border-transparent text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span>{tab.label}</span>
                {tab.totalCount !== undefined && (
                  <span className="text-[11px] opacity-75">({tab.totalCount})</span>
                )}
                {tab.badge && (
                  <span className="rounded-full bg-rose-500 text-white px-2 py-0.5 text-[10px] font-black leading-none shadow-2xs">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <Button
          type="button"
          variant={isTabContentCollapsed ? "primary" : "secondary"}
          size="sm"
          onClick={() => setIsTabContentCollapsed(!isTabContentCollapsed)}
          title={isTabContentCollapsed ? "Развернуть вкладку" : "Свернуть вкладку"}
        >
          {isTabContentCollapsed ? (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              <span>Развернуть</span>
            </>
          ) : (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              <span>Свернуть</span>
            </>
          )}
        </Button>
      </nav>

      {/* ЕСЛИ ВКЛАДКА СВЕРНУТА */}
      {isTabContentCollapsed && (
        <Card padding="md" className="flex items-center justify-between gap-3 border-dashed animate-fade-in">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${
                isLight ? "bg-sky-50 border-sky-200 text-sky-600" : "bg-slate-800 border-slate-700 text-slate-300"
              }`}
            >
              {activeTab === "schedule" ? (
                <Calendar className="h-5 w-5" />
              ) : (
                <BookOpen className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-xs sm:text-sm truncate">
                {activeTab === "schedule"
                  ? `Вкладка «Расписание» свернута`
                  : `Вкладка «Домашние задания» свернута`}
              </p>
              <p className={`text-[11px] mt-0.5 truncate ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                {activeTab === "schedule"
                  ? `${activeDayLessons.length} уроков на ${activeDateFormatted}. Нажмите, чтобы открыть`
                  : unsubmittedCount > 0
                  ? `Осталось сдать заданий: ${unsubmittedCount}`
                  : `Все задания сданы (${homeworks.length} шт)`}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setIsTabContentCollapsed(false)}
          >
            <ChevronDown className="h-4 w-4" />
            <span>Развернуть</span>
          </Button>
        </Card>
      )}

      {!isTabContentCollapsed && activeTab === "schedule" && (
        <section className="space-y-3.5 animate-tab-enter">
          <Card padding="sm" className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs sm:text-sm font-bold">Расписание:</span>
              <span
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                  isLight
                    ? "bg-slate-100 text-slate-700 border-slate-200/80"
                    : "bg-slate-800 text-slate-200 border-slate-700"
                }`}
              >
                {monthTitle}
              </span>
              <div className="w-40 sm:w-48">
                <DatePicker
                  compact
                  value={format(currentDate, "yyyy-MM-dd")}
                  onChange={(iso) => {
                    if (iso) {
                      setCurrentDate(parseISO(iso));
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsCalendarCollapsed(!isCalendarCollapsed)}
                title={isCalendarCollapsed ? "Развернуть дни недели" : "Свернуть дни недели"}
              >
                <Calendar className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {isCalendarCollapsed ? "Развернуть дни" : "Свернуть дни"}
                </span>
                {isCalendarCollapsed ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronUp className="h-3 w-3" />
                )}
              </Button>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={() => handlePrevWeek(1)}
                  title="Предыдущая неделя"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={() => handleNextWeek(1)}
                  title="Следующая неделя"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>

          <div className="space-y-3.5">
            <div
              className={`grid transition-all duration-200 ease-out ${
                isCalendarCollapsed
                  ? "grid-rows-[0fr] opacity-0 scale-95 pointer-events-none"
                  : "grid-rows-[1fr] opacity-100 scale-100"
              }`}
            >
              <div className="overflow-hidden">
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
            </div>

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
              } space-y-2.5`}
            >
              {/* ПОДПИСЬ ТЕКУЩЕЙ ВЫБРАННОЙ ДАТЫ */}
              <div className="flex items-center justify-between gap-2 px-1">
                <span
                  className={`font-bold text-xs sm:text-sm tracking-wide ${
                    isLight ? "text-slate-700" : "text-cyan-400"
                  }`}
                >
                  {selectedDayOfWeek === 7
                    ? `Воскресенье, ${activeDateFormatted} — Выходной день`
                    : `Уроки на ${activeDateFormatted} (${SHORT_WEEKDAYS[selectedDayOfWeek - 1].toUpperCase()})`}
                </span>
              </div>

              <div className="space-y-2.5">
                {activeDayLessons.length === 0 ? (
                  <div
                    className={`flex flex-col items-center justify-center py-8 px-6 text-center text-sm rounded-2xl border ${
                      isLight
                        ? "border-slate-200 text-slate-600 bg-white shadow-2xs"
                        : "border-cyan-500/20 text-zinc-300 bg-slate-900/40"
                    }`}
                  >
                    {selectedDayOfWeek === 7 ? (
                      <>
                        <span className={`text-sm font-bold ${isLight ? "text-slate-800" : "text-cyan-300"}`}>
                          Воскресенье — выходной
                        </span>
                        <span className={`text-xs mt-1 ${isLight ? "text-slate-500" : "text-zinc-400"}`}>
                          В этот день занятий нет, уроки начнутся в понедельник
                        </span>
                      </>
                    ) : (
                      <span className="text-xs sm:text-sm font-medium">В этот день занятий нет</span>
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
                            className={`font-mono text-xs sm:text-sm font-bold tabular-nums ${
                              isLight ? "text-slate-800" : "text-zinc-100"
                            }`}
                          >
                            {l.startTime}
                          </span>
                          <span
                            className={`font-mono text-xs sm:text-sm font-medium tabular-nums ${
                              isLight ? "text-slate-400" : "text-zinc-400"
                            }`}
                          >
                            {l.endTime}
                          </span>
                        </div>

                        <div className="group flex-1 min-w-0 p-3.5 sm:p-4 transition-all duration-200 glass-panel glass-interactive rounded-2xl">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className={`text-xs font-black ${roomColorClass}`}>
                                {l.room.toLowerCase().startsWith("каб") ? l.room : `каб. ${l.room}`}
                              </div>
                              <div className={`mt-0.5 text-xs ${isLight ? "text-slate-500" : "text-zinc-400"}`}>
                                {l.teacherName}
                              </div>
                            </div>
                          </div>

                          <div
                            className={`mt-2 text-sm sm:text-base font-black ${
                              isLight ? "text-slate-900" : "text-white"
                            }`}
                          >
                            {l.subjectName}
                          </div>

                          {attachedHw.length > 0 && (
                            <div
                              className={`mt-3 space-y-2 border-t pt-2.5 ${
                                isLight ? "border-slate-100" : "border-zinc-700/60"
                              }`}
                            >
                              {attachedHw.map((h) => {
                                const sub = h.submission;
                                return (
                                  <div
                                    key={h.id}
                                    className={`p-3 rounded-xl border ${
                                      isLight
                                        ? "bg-slate-50/80 border-slate-200/90"
                                        : "bg-[#090D15]/80 border-cyan-500/25"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <div className={`flex items-center gap-1.5 font-bold text-xs ${roomColorClass}`}>
                                          <BookOpen className="h-3.5 w-3.5" />
                                          <span>ДЗ: {h.title}</span>
                                        </div>
                                        <p className={`mt-1 text-xs ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
                                          {h.description}
                                        </p>
                                      </div>

                                      {sub?.grade ? (
                                        <span
                                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold border ${
                                            isLight
                                              ? "bg-sky-50 text-sky-700 border-sky-200"
                                              : "bg-cyan-500/20 text-cyan-300 border-cyan-400/40"
                                          }`}
                                        >
                                          {sub.grade}
                                        </span>
                                      ) : sub ? (
                                        <span
                                          className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold border ${
                                            isLight
                                              ? "bg-amber-50 text-amber-700 border-amber-200"
                                              : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                          }`}
                                        >
                                          <Clock className="h-3 w-3" />
                                          Сдано
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => setActiveHwModal(h)}
                                          className="theme-btn px-3 py-1 text-xs font-bold cursor-pointer"
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

                                    {(sub as any)?.attachments && (sub as any).attachments.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        {(sub as any).attachments.map((file: any) => (
                                          <AttachmentBadge key={file.id} file={file} />
                                        ))}
                                      </div>
                                    )}

                                    {sub &&
                                      (() => {
                                        const parsedFb = parseTeacherFeedback(sub.teacherComment);
                                        return (
                                          <div className="mt-2 space-y-2">
                                            {parsedFb.text ? (
                                              <div
                                                className={`rounded-xl p-2.5 text-xs border ${
                                                  isLight
                                                    ? "bg-sky-50 text-sky-900 border-sky-200"
                                                    : "bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
                                                }`}
                                              >
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
                                                className="flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
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

      {/* ВКЛАДКА: ДОМАШНИЕ ЗАДАНИЯ (ДЗ) */}
      {!isTabContentCollapsed && activeTab === "homework" && (
        <section className="space-y-4 animate-tab-enter">
          <Card padding="md" className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500 animate-pulse" />
                <h2 className="text-lg sm:text-xl font-black tracking-tight">Домашние задания</h2>
              </div>
              <p className={`text-xs mt-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                Все выданные задания, проверка решений и оценки преподавателя
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end">
              <div className="overflow-x-auto no-scrollbar">
                <SegmentedControl
                  size="sm"
                  value={hwStatusFilter}
                  onChange={setHwStatusFilter}
                  options={[
                    { value: "ALL", label: "Все", badge: homeworks.length },
                    { value: "NEED_SUBMIT", label: "Надо сдать", badge: unsubmittedCount },
                    { value: "PENDING", label: "На проверке", badge: pendingCount },
                    { value: "GRADED", label: "Проверено", badge: gradedCount },
                  ]}
                />
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsHwFiltersCollapsed(!isHwFiltersCollapsed)}
                title="Свернуть / развернуть поиск и фильтры"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {isHwFiltersCollapsed ? "Поиск и фильтры" : "Скрыть фильтры"}
                </span>
                {isHwFiltersCollapsed ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronUp className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </Card>

          {!isHwFiltersCollapsed && (
            <div className="space-y-3">
              <Card padding="sm" className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                <div className="flex-1 min-w-[180px]">
                  <Input
                    type="text"
                    placeholder="Поиск по предмету или теме..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    icon={<Search className="h-4 w-4" />}
                    rightElement={
                      searchQuery ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSearchQuery("")}
                          className="h-6 w-6"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      ) : undefined
                    }
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs font-bold flex items-center gap-1 shrink-0 ${
                      isLight ? "text-slate-500" : "text-slate-400"
                    }`}
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Сортировка:</span>
                  </span>
                  <div className="w-full sm:w-56">
                    <Select
                      value={hwSort}
                      onValueChange={(v) => setHwSort(v as any)}
                      options={[
                        { value: "DEADLINE_NEAREST", label: "Ближайший дедлайн" },
                        { value: "DEADLINE_FURTHEST", label: "Дальний дедлайн" },
                        { value: "DATE_NEWEST", label: "Сначала новые (по дате)" },
                        { value: "DATE_OLDEST", label: "Сначала старые (по дате)" },
                        { value: "STATUS", label: "Сначала не сданные" },
                        { value: "SUBJECT", label: "По предмету (А-Я)" },
                      ]}
                    />
                  </div>
                </div>
              </Card>

              {availableSubjects.length > 1 && (
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 no-scrollbar">
                  <Button
                    variant={selectedSubjectFilter === "ALL" ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setSelectedSubjectFilter("ALL")}
                  >
                    Все предметы ({homeworks.length})
                  </Button>
                  {availableSubjects.map((sub) => {
                    const count = homeworks.filter(
                      (h) => h.subjectName.trim().toLowerCase() === sub.toLowerCase()
                    ).length;
                    const isActive = selectedSubjectFilter === sub;
                    return (
                      <Button
                        key={sub}
                        variant={isActive ? "primary" : "secondary"}
                        size="sm"
                        onClick={() => setSelectedSubjectFilter(sub)}
                      >
                        <span>{sub}</span>
                        <span className="text-[10px] opacity-75">({count})</span>
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div
            className={`flex items-center justify-between text-xs px-1 pt-1 ${
              isLight ? "text-slate-500" : "text-zinc-400"
            }`}
          >
            <span>
              Показано:{" "}
              <strong className={isLight ? "text-slate-800" : "text-zinc-200"}>
                {displayedHomeworks.length}
              </strong>{" "}
              {displayedHomeworks.length === 1
                ? "задание"
                : displayedHomeworks.length < 5
                ? "задания"
                : "заданий"}
              {hwStatusFilter === "NEED_SUBMIT" && " (надо сдать)"}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={collapseAllHw}
                className="hover:underline text-[11px] underline-offset-2 cursor-pointer"
              >
                Свернуть все
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={expandAllHw}
                className="hover:underline text-[11px] underline-offset-2 cursor-pointer"
              >
                Развернуть все
              </button>
            </div>
          </div>

          <div
            key={`${hwStatusFilter}-${selectedSubjectFilter}-${hwSort}`}
            className="space-y-3 sm:space-y-4 animate-tab-enter"
          >
            {displayedHomeworks.length === 0 ? (
              <div
                className={`flex flex-col items-center justify-center rounded-2xl border border-dashed p-6 sm:p-8 text-center ${
                  isLight ? "border-slate-300 bg-white text-slate-500" : "border-zinc-800 text-zinc-400"
                }`}
              >
                {hwStatusFilter === "NEED_SUBMIT" ? (
                  <>
                    <CheckCircle2 className="h-9 w-9 mb-2 text-emerald-500" />
                    <p className={`text-sm sm:text-base font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                      Все домашние задания сданы!
                    </p>
                    <p className="text-xs mt-1 max-w-sm">
                      У вас нет долгов или не сданных работ. Вы можете проверить статус отправленных решений или архив всех заданий.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                      {gradedCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setHwStatusFilter("GRADED")}
                          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white transition shadow-xs cursor-pointer"
                        >
                          Посмотреть проверенные ({gradedCount})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setHwStatusFilter("ALL")}
                        className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                          isLight
                            ? "border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700"
                            : "border-zinc-700 bg-white/5 hover:bg-white/10 text-zinc-300"
                        }`}
                      >
                        Показать все задания ({homeworks.length})
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <BookOpen className="h-8 w-8 mb-2 opacity-50" />
                    <p className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                      Домашних заданий не найдено
                    </p>
                    <p className="text-xs mt-1">
                      Попробуйте сбросить фильтры или изменить поисковый запрос
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedSubjectFilter("ALL");
                        setHwStatusFilter("NEED_SUBMIT");
                      }}
                      className={`mt-3 rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer ${
                        isLight
                          ? "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                          : "border-zinc-700 bg-white/5 text-zinc-300 hover:bg-white/10"
                      }`}
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
                    className="glass-panel rounded-2xl p-4 sm:p-5 space-y-3 sm:space-y-4 transition"
                  >
                    <div
                      onClick={() => toggleHwCard(hw.id)}
                      className={`flex items-center justify-between gap-2 border-b pb-3 cursor-pointer select-none group ${
                        isLight ? "border-slate-100" : "border-zinc-800/80"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl border font-mono text-xs font-black ${
                            isLight
                              ? "bg-sky-50 border-sky-200 text-sky-700"
                              : "bg-blue-500/10 border-blue-500/30 text-blue-400"
                          }`}
                        >
                          <span>{dayStr}</span>
                          <span className="text-[9px] opacity-75 leading-none">{monthStr}</span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-black uppercase tracking-wider truncate ${
                                isLight ? "text-sky-600" : "text-blue-400"
                              }`}
                            >
                              {hw.subjectName}
                            </span>
                            <span className={`text-[11px] hidden sm:inline ${isLight ? "text-slate-400" : "text-zinc-400"}`}>
                              • Срок: {hw.targetDate}
                            </span>
                          </div>
                          {isCardCollapsed ? (
                            <p className="text-xs font-bold truncate mt-0.5">{hw.title}</p>
                          ) : (
                            <span className={`text-[11px] sm:hidden ${isLight ? "text-slate-400" : "text-zinc-400"}`}>
                              Срок: {hw.targetDate}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isGraded ? (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 sm:px-3 py-1 text-xs font-black ${
                              isLight
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                            }`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Оценка: {sub.grade}</span>
                          </span>
                        ) : sub ? (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 sm:px-3 py-1 text-xs font-black ${
                              isLight
                                ? "bg-amber-50 border-amber-200 text-amber-700"
                                : "bg-amber-500/20 border-amber-500/40 text-amber-300"
                            }`}
                          >
                            <Clock className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">На проверке</span>
                            <span className="sm:hidden">Сдано</span>
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 sm:px-3 py-1 text-xs font-black ${
                              isLight
                                ? "bg-rose-50 border-rose-200 text-rose-700"
                                : "bg-rose-500/20 border-rose-500/40 text-rose-300"
                            }`}
                          >
                            <span>Не сдано</span>
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleHwCard(hw.id);
                          }}
                          className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
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

                    {!isCardCollapsed && (
                      <div className="space-y-3 sm:space-y-4 pt-1 animate-fade-in">
                        <div>
                          <h3 className="text-base sm:text-lg font-black tracking-tight">{hw.title}</h3>
                          {hw.description && (
                            <p
                              className={`mt-1 text-xs sm:text-sm leading-relaxed ${
                                isLight ? "text-slate-600" : "text-zinc-300"
                              }`}
                            >
                              {hw.description}
                            </p>
                          )}
                        </div>

                        {hw.attachments && hw.attachments.length > 0 && (
                          <div className="space-y-1.5">
                            <span className={`text-[11px] font-bold block ${isLight ? "text-slate-500" : "text-zinc-400"}`}>
                              Прикрепленные материалы к уроку:
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {hw.attachments.map((att) => (
                                <AttachmentBadge key={att.id} file={att} />
                              ))}
                            </div>
                          </div>
                        )}

                        <div
                          className={`pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t ${
                            isLight ? "border-slate-100" : "border-zinc-800/80"
                          }`}
                        >
                          {isGraded ? (
                            <div className="flex-1 space-y-2">
                              {feedback.text && (
                                <div
                                  className={`text-xs border rounded-xl p-3 ${
                                    isLight
                                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                                      : "text-zinc-200 bg-emerald-950/40 border-emerald-500/25"
                                  }`}
                                >
                                  <span
                                    className={`font-black block mb-0.5 ${
                                      isLight ? "text-emerald-700" : "text-emerald-400"
                                    }`}
                                  >
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
                                className="flex items-center justify-center gap-2 w-full sm:w-auto rounded-xl bg-sky-600 hover:bg-sky-700 px-4 py-2 text-xs font-black text-white shadow-xs transition cursor-pointer"
                              >
                                <Eye className="h-4 w-4" />
                                <span>Посмотреть проверенную работу с исправлениями</span>
                              </button>
                            </div>
                          ) : sub ? (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2">
                              <span className={`text-xs ${isLight ? "text-slate-500" : "text-zinc-400"}`}>
                                Отправлено решение • Ожидает проверки
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveHwModal(hw);
                                  setSubmitText(sub.content || "");
                                }}
                                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-bold cursor-pointer ${
                                  isLight
                                    ? "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                                    : "border-zinc-700 text-zinc-200 hover:bg-white/5"
                                }`}
                              >
                                <span>Дополнить ответ</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2">
                              <span className={`text-xs ${isLight ? "text-slate-500" : "text-zinc-400"}`}>
                                Срок сдачи: {hw.targetDate}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveHwModal(hw);
                                  setSubmitText("");
                                  setSubmitFiles([]);
                                }}
                                className="flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 px-4 py-2 text-xs font-black text-white shadow-xs transition cursor-pointer"
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

      {/* ВКЛАДКА: ЗАДАНИЯ И ТРЕНИРОВОЧНЫЕ РАБОТЫ ЕГЭ */}
      {!isTabContentCollapsed && activeTab === "ege" && (
        <section className="space-y-4 sm:space-y-5 animate-tab-enter">
          <EgeStudentView studentId={user.id} items={egeItems} />
        </section>
      )}

      {/* Модальное окно сдачи ДЗ (через единый <Modal /> дизайн-системы) */}
      <Modal
        isOpen={Boolean(activeHwModal)}
        onClose={() => setActiveHwModal(null)}
        title="Сдача домашнего задания"
        subtitle={activeHwModal ? `${activeHwModal.subjectName}: ${activeHwModal.title}` : ""}
        icon={<Send className="w-4 h-4" />}
        maxWidth="lg"
      >
        {activeHwModal && (
          <form onSubmit={handleSubmitSolution} className="space-y-4 text-xs sm:text-sm">
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Ваш ответ или комментарий:
              </label>
              <Textarea
                rows={3}
                required
                value={submitText}
                onChange={(e) => setSubmitText(e.target.value)}
                placeholder="Опишите выполненное задание..."
              />
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Прикрепить фото или файл:
              </label>
              <div>
                <label
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border h-10 px-3.5 text-xs font-medium transition-colors duration-200 ${
                    isLight
                      ? "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                      : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  }`}
                >
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
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium ${
                        isLight ? "bg-slate-100 text-slate-700" : "bg-slate-800 text-slate-200"
                      }`}
                    >
                      <span className="max-w-[140px] truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setSubmitFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setActiveHwModal(null)}>
                Отмена
              </Button>
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                <Send className="h-3.5 w-3.5" />
                <span>{isSubmitting ? "Отправка..." : "Отправить"}</span>
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Модальное окно просмотра проверенной работы (через единый <Modal /> дизайн-системы) */}
      <Modal
        isOpen={Boolean(viewCheckedHwModal)}
        onClose={() => setViewCheckedHwModal(null)}
        maxWidth="6xl"
        title={viewCheckedHwModal?.title || "Проверенная работа"}
        subtitle={viewCheckedHwModal ? `${viewCheckedHwModal.subjectName} • Проверено учителем` : ""}
        icon={<BookOpen className="w-4 h-4" />}
        bodyClassName={`flex flex-1 min-h-0 overflow-hidden flex-col md:flex-row ${
          isLight ? "bg-slate-100/90" : "bg-slate-950"
        }`}
        headerActions={
          viewCheckedHwModal ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setCheckedPageRotation((prev) => (prev + 90) % 360)}
                title="Повернуть лист на 90°"
              >
                <RotateCw className="h-4 w-4" />
              </Button>

              <Button
                variant="secondary"
                size="icon"
                onClick={() => setCheckedZoom((prev) => (prev === 1 ? 1.25 : prev === 1.25 ? 1.5 : 1))}
                title="Масштаб"
              >
                {checkedZoom > 1 ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
              </Button>

              {parseTeacherFeedback(viewCheckedHwModal.submission?.teacherComment).modifiedImageUrl ? (
                <a
                  href={parseTeacherFeedback(viewCheckedHwModal.submission?.teacherComment).modifiedImageUrl}
                  download={`Проверенное_ДЗ_${viewCheckedHwModal.subjectName}.jpg`}
                  className={`hidden sm:inline-flex items-center gap-1.5 rounded-xl border h-8 px-3 text-xs font-medium transition ${
                    isLight
                      ? "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                      : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  }`}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Скачать с пометками</span>
                </a>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.print()}
                  className="hidden sm:inline-flex"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Печать / PDF</span>
                </Button>
              )}
            </div>
          ) : null
        }
      >
        {viewCheckedHwModal && (
          <>
            {(() => {
              const feedback = parseTeacherFeedback(viewCheckedHwModal.submission?.teacherComment);
              const studentSubmittedImg =
                viewCheckedHwModal.submission?.attachments?.find(
                  (a: any) =>
                    a.fileType?.startsWith("image/") || a.fileUrl?.match(/\.(jpeg|jpg|png|webp|gif)/i)
                )?.fileUrl || viewCheckedHwModal.submission?.attachments?.[0]?.fileUrl;

              return (
                <div
                  className={`flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center justify-start ${
                    isLight ? "bg-slate-100/90" : "bg-[#2E3440]"
                  }`}
                >
                  <div
                    className={`relative w-full max-w-3xl overflow-hidden rounded-2xl shadow-xl bg-white border transition-all duration-300 my-auto ${
                      isLight ? "border-slate-200" : "border-slate-700"
                    }`}
                    style={{
                      transform: `rotate(${checkedPageRotation}deg) scale(${checkedZoom})`,
                      transformOrigin: "center center",
                    }}
                  >
                    {feedback.modifiedImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={feedback.modifiedImageUrl}
                        alt="Проверенная работа с исправлениями учителя"
                        style={{ filter: "none" }}
                        className="w-full h-auto object-contain block select-none"
                      />
                    ) : (
                      <div className="relative w-full aspect-[3/4] bg-[#FAF9F5] select-none overflow-hidden">
                        {studentSubmittedImg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={studentSubmittedImg}
                            alt="Работа ученика"
                            style={{ filter: "none" }}
                            className="w-full h-full object-contain pointer-events-none"
                          />
                        ) : (
                          <div className="absolute inset-0 p-8 sm:p-12 text-[#1E293B] font-serif leading-relaxed flex flex-col justify-between overflow-hidden">
                            <div
                              className="absolute inset-0 opacity-25 pointer-events-none"
                              style={{
                                backgroundImage:
                                  "linear-gradient(to right, #94A3B8 1px, transparent 1px), linear-gradient(to bottom, #94A3B8 1px, transparent 1px)",
                                backgroundSize: "20px 20px",
                              }}
                            />

                            <div className="relative z-0 space-y-1.5 border-b border-blue-400/40 pb-2">
                              <div className="flex items-center justify-between font-mono text-xs font-bold text-blue-900">
                                <span>{user.fullName}</span>
                                <span>{viewCheckedHwModal.targetDate}</span>
                              </div>
                              <div className="text-center font-mono text-sm sm:text-base font-extrabold text-blue-950">
                                ДЗ: {viewCheckedHwModal.subjectName} — {viewCheckedHwModal.title}
                              </div>
                            </div>

                            <div className="relative z-0 space-y-3 text-xs sm:text-sm font-mono text-blue-950 my-auto">
                              {viewCheckedHwModal.submission?.content ? (
                                <div className="bg-white/60 p-5 rounded-2xl border border-blue-200 shadow-xs">
                                  <p className="font-bold text-blue-900 text-sm mb-1">Решение ученика:</p>
                                  <p className="font-sans leading-relaxed text-blue-950">
                                    {viewCheckedHwModal.submission.content}
                                  </p>
                                </div>
                              ) : (
                                <div className="bg-white/60 p-5 rounded-2xl border border-blue-200 shadow-xs">
                                  <p className="font-bold text-blue-900 text-sm mb-1">Выполненное задание:</p>
                                  <p className="font-sans leading-relaxed text-blue-950">
                                    {viewCheckedHwModal.description ||
                                      `Задание по предмету «${viewCheckedHwModal.subjectName}» выполнено.`}
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="relative z-0 flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-3 border-t border-zinc-300">
                              <span>Работа проверена преподавателем</span>
                              <span>
                                {viewCheckedHwModal.submission?.submittedAt
                                  ? `Сдано: ${String(viewCheckedHwModal.submission.submittedAt).slice(0, 10)}`
                                  : "Проверено"}
                              </span>
                            </div>
                          </div>
                        )}

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
                <aside
                  className={`w-full md:w-80 shrink-0 border-t md:border-t-0 md:border-l p-4 sm:p-5 flex flex-col justify-between overflow-y-auto max-h-[240px] md:max-h-none ${
                    isLight
                      ? "bg-white border-slate-200 text-slate-900"
                      : "bg-slate-900 border-slate-800 text-slate-100"
                  }`}
                >
                  <div className="space-y-4 sm:space-y-5">
                    {taskEntries.length > 0 && (
                      <div>
                        <h4
                          className={`text-xs font-black uppercase tracking-wider ${
                            isLight ? "text-slate-800" : "text-slate-200"
                          }`}
                        >
                          Выполнение заданий ({taskEntries.length} задач)
                        </h4>
                        <p className={`text-[11px] mt-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                          Отметки преподавателя по номерам:
                        </p>

                        <div className="mt-3 grid grid-cols-5 gap-1.5">
                          {taskEntries.map(([num, isOk]) => (
                            <div
                              key={num}
                              className={`flex h-9 items-center justify-center rounded-xl text-xs font-black shadow-2xs ${
                                isOk === true
                                  ? "bg-emerald-500 text-white"
                                  : isOk === false
                                  ? "bg-rose-500 text-white"
                                  : isLight
                                  ? "bg-slate-100 text-slate-600 border border-slate-200"
                                  : "bg-slate-800 text-slate-400 border border-slate-700"
                              }`}
                            >
                              {num}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div
                      className={`pt-3 sm:pt-4 border-t space-y-2 ${
                        isLight ? "border-slate-200" : "border-slate-800"
                      }`}
                    >
                      <span
                        className={`text-xs font-black block ${
                          isLight ? "text-slate-800" : "text-slate-200"
                        }`}
                      >
                        Итоговая оценка учителя:
                      </span>

                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${gradeColor} text-xl font-black text-white shadow-md`}
                        >
                          {gradeVal}
                        </div>
                        <div>
                          <div
                            className={`text-xs font-extrabold ${
                              isLight ? "text-slate-900" : "text-slate-100"
                            }`}
                          >
                            {gradeText}
                          </div>
                          <div className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                            Работа зачтена в электронный дневник
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`pt-3 sm:pt-4 border-t ${
                        isLight ? "border-slate-200" : "border-slate-800"
                      }`}
                    >
                      <span
                        className={`text-xs font-black block mb-1 ${
                          isLight ? "text-slate-800" : "text-slate-200"
                        }`}
                      >
                        Замечания преподавателя:
                      </span>
                      <div
                        className={`rounded-2xl border p-3.5 text-xs leading-relaxed shadow-2xs ${
                          isLight
                            ? "border-slate-200 bg-slate-50 text-slate-800"
                            : "border-slate-800 bg-slate-800/50 text-slate-200"
                        }`}
                      >
                        {feedback.text || "Работа проверена преподавателем. Все требования выполнены."}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`pt-4 border-t ${
                      isLight ? "border-slate-200" : "border-slate-800"
                    }`}
                  >
                    <Button
                      variant="primary"
                      size="full"
                      onClick={() => setViewCheckedHwModal(null)}
                    >
                      Закрыть просмотр
                    </Button>
                  </div>
                </aside>
              );
            })()}
          </>
        )}
      </Modal>
    </div>
  );
}