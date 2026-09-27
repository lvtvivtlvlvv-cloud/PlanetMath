"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
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
import { GradingModal, SubmissionModalData } from "./grading-modal";
import {
  gradeSubmissionAction,
  createStudentAction,
  deleteStudentAction,
  createTeacherAction,
  deleteTeacherAction,
  createHomeworkAction,
  updateHomeworkAction,
  deleteHomeworkAction,
  saveScheduleBatchAction,
  addSingleLessonAction,
  deleteSingleLessonAction,
  logoutAction,
  EditableScheduleRow,
} from "@/app/admin/actions";
import { ThemeSwitcher } from "./theme-switcher";
import { ThemeCalendarStrip } from "./theme-calendar-strip";
import { useAppTheme } from "./theme-context";
import {
  LogOut,
  UserPlus,
  Plus,
  Save,
  Trash2,
  Calendar as CalendarIcon,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  Edit2,
  X,
  Paperclip,
  Copy,
  Check,
  BookOpen,
  GraduationCap,
} from "lucide-react";

export function formatTeacherName(fullName: string): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const surname = parts[0];
  const initials = parts
    .slice(1)
    .map((p) => (p[0] ? `${p[0].toUpperCase()}.` : ""))
    .join(" ");
  return `${surname} ${initials}`.trim();
}

export interface StudentItem {
  id: string;
  fullName: string;
  login: string;
  plainPassword: string;
  classId: string;
  className: string;
  grade: number;
  letter: string;
}

export interface TeacherItem {
  id: string;
  fullName: string;
  login: string;
  plainPassword: string;
}

interface AdminDashboardProps {
  serverDate?: string;
  classes: { id: string; name: string; grade: number; letter: string }[];
  scheduleItems: Array<EditableScheduleRow & { id: string }>;
  submissions: Array<{
    id: string;
    studentName: string;
    subjectName: string;
    homeworkTitle: string;
    content: string;
    submittedAt: string | Date;
    status: string;
    grade: number | null;
    teacherComment: string | null;
    attachments: Array<{
      id: string;
      fileName: string;
      fileUrl: string;
      fileType: string;
      expiresAt: string | Date;
    }>;
  }>;
  homeworks: Array<{
    id: string;
    classId: string;
    className: string;
    subjectName: string;
    title: string;
    description: string;
    targetDate: string;
    submissionsCount: number;
  }>;
  students: StudentItem[];
  teachers: TeacherItem[];
}

const SHORT_WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

export function AdminDashboard({
  classes,
  scheduleItems,
  submissions,
  homeworks,
  students,
  teachers,
  serverDate,
}: AdminDashboardProps) {
  const { theme } = useAppTheme();
  const [activeTab, setActiveTab] = useState<"schedule" | "homeworks" | "submissions" | "students" | "teachers">("schedule");
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || "");
  const [scheduleMode, setScheduleMode] = useState<"calendar" | "excel">("calendar");

  // Синхронизация времени с хостом компьютера (2026 год)
  const hostToday = useMemo(() => {
    return serverDate ? parseISO(serverDate) : new Date();
  }, [serverDate]);

  const [currentDate, setCurrentDate] = useState<Date>(hostToday);

  // Периодическое фоновое обновление времени с компьютера
  useEffect(() => {
    const syncWithHost = async () => {
      try {
        const res = await fetch("/api/server-time");
        if (res.ok) {
          const data = await res.json();
          if (data.serverTime) {
            const hostNow = parseISO(data.serverTime);
            // Если дата сменилась на компьютере — обновляем
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

  // Понедельник текущей отображаемой недели
  const monday = useMemo(() => {
    return startOfWeek(currentDate, { weekStartsOn: 1 });
  }, [currentDate]);

  // День недели в школьном формате: 1 (Пн) .. 7 (Вс)
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

  // Выбор конкретной даты
  const handleSelectDate = (date: Date) => {
    setCurrentDate(date);
  };

  const monthTitle = useMemo(() => {
    const formatted = format(monday, "LLLL yyyy", { locale: ru });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }, [monday]);

  // Дни текущей недели (7 дней)
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
      .filter((i) => i.classId === selectedClassId && Number(i.dayOfWeek) === selectedDayOfWeek)
      .sort((a, b) => a.lessonNumber - b.lessonNumber);
  }, [scheduleItems, selectedClassId, selectedDayOfWeek]);

  const [editableRows, setEditableRows] = useState<EditableScheduleRow[]>(
    scheduleItems.filter((i) => i.classId === (classes[0]?.id || ""))
  );
  const [scheduleSavedMsg, setScheduleSavedMsg] = useState(false);

  const handleClassChange = (newClassId: string) => {
    setSelectedClassId(newClassId);
    setEditableRows(scheduleItems.filter((i) => i.classId === newClassId));
    setScheduleSavedMsg(false);
  };

  const addTableRow = () => {
    const defaultTeacher = teachers[0] ? formatTeacherName(teachers[0].fullName) : "Учитель";
    setEditableRows((prev) => [
      ...prev,
      {
        classId: selectedClassId,
        dayOfWeek: 1,
        lessonNumber: (prev.length % 7) + 1,
        startTime: "08:30",
        endTime: "09:15",
        subjectName: "",
        room: "101",
        teacherName: defaultTeacher,
      },
    ]);
  };

  const updateTableRow = (idx: number, field: keyof EditableScheduleRow, val: any) => {
    setEditableRows((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const deleteTableRow = (idx: number) => {
    setEditableRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveScheduleBatch = async () => {
    await saveScheduleBatchAction(selectedClassId, editableRows);
    setScheduleSavedMsg(true);
    setTimeout(() => setScheduleSavedMsg(false), 3000);
  };

  const [isAddLessonOpen, setIsAddLessonOpen] = useState(false);
  const [lessonDayOfWeek, setLessonDayOfWeek] = useState(1);
  const [isHwModalOpen, setIsHwModalOpen] = useState(false);
  const [hwPreset, setHwPreset] = useState<{ subjectName: string; targetDate: string } | null>(null);
  const [hwFiles, setHwFiles] = useState<File[]>([]);
  const [hwLoading, setHwLoading] = useState(false);
  const [editingHw, setEditingHw] = useState<typeof homeworks[0] | null>(null);
  const [activeModalData, setActiveModalData] = useState<SubmissionModalData | null>(null);

  const [studentSelectedClassId, setStudentSelectedClassId] = useState<string>(classes[0]?.id || "");
  const [studentSortOrder, setStudentSortOrder] = useState<"asc" | "desc">("asc");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const currentClassStudents = useMemo(() => {
    const list = students.filter((s) => s.classId === studentSelectedClassId);
    list.sort((a, b) => {
      const surA = a.fullName.trim().split(/\s+/)[0] || "";
      const surB = b.fullName.trim().split(/\s+/)[0] || "";
      const cmp = surA.localeCompare(surB, "ru");
      return studentSortOrder === "asc" ? cmp : -cmp;
    });
    return list;
  }, [students, studentSelectedClassId, studentSortOrder]);

  const [subSubjectFilter, setSubSubjectFilter] = useState<string>("ALL");
  const [subStatusFilter, setSubStatusFilter] = useState<"ALL" | "PENDING" | "GRADED">("ALL");
  const [subSortDateOrder, setSubSortDateOrder] = useState<"desc" | "asc">("desc");

  const filteredSubmissions = useMemo(() => {
    let res = [...submissions];
    if (subSubjectFilter !== "ALL") {
      res = res.filter((s) => s.subjectName === subSubjectFilter);
    }
    if (subStatusFilter === "PENDING") {
      res = res.filter((s) => s.grade === null);
    } else if (subStatusFilter === "GRADED") {
      res = res.filter((s) => s.grade !== null);
    }

    res.sort((a, b) => {
      const aPending = a.grade === null ? 0 : 1;
      const bPending = b.grade === null ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;

      const tA = new Date(a.submittedAt).getTime();
      const tB = new Date(b.submittedAt).getTime();
      return subSortDateOrder === "desc" ? tB - tA : tA - tB;
    });

    return res;
  }, [submissions, subSubjectFilter, subStatusFilter, subSortDateOrder]);

  const sortedHomeworks = useMemo(() => {
    return [...homeworks].sort((a, b) => {
      const aActive = a.submissionsCount === 0 ? 0 : 1;
      const bActive = b.submissionsCount === 0 ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return new Date(b.targetDate).getTime() - new Date(a.targetDate).getTime();
    });
  }, [homeworks]);

  const uniqueSubjects = useMemo(() => {
    return Array.from(new Set(submissions.map((s) => s.subjectName)));
  }, [submissions]);

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

  return (
    <div className="min-h-screen space-y-6 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
      <header className="flex flex-col gap-3 sm:gap-4 border-b border-zinc-200/40 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Панель Учителя</h1>
          <p className="text-xs text-zinc-400 mt-0.5">2026–2027 учебный год</p>
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

      {/* НАВИГАЦИОННЫЕ ВКЛАДКИ С ГОРИЗОНТАЛЬНЫМ СКРОЛЛОМ НА МОБИЛЬНЫХ */}
      <nav className="flex items-center gap-2 border-b border-zinc-200/40 pb-2 dark:border-zinc-800 overflow-x-auto scrollbar-none py-1 -mx-2 px-2 sm:mx-0 sm:px-0 sm:flex-wrap">
        {[
          { id: "schedule", label: "Расписание" },
          { id: "homeworks", label: "Выданные ДЗ" },
          { id: "submissions", label: `Проверка работ (${submissions.length})` },
          { id: "students", label: "Ученики" },
          { id: "teachers", label: `Учителя (${teachers.length})` },
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
              className={`rounded-xl px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold border whitespace-nowrap shrink-0 transition-[color,background-color,border-color,box-shadow] duration-200 outline-none focus:outline-none min-h-[38px] ${
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

      {/* КОНТЕНТ ВКЛАДОК */}
      <div key={activeTab} className="animate-tab-enter">
        {activeTab === "schedule" && (
          <section className="space-y-4">
            <div className="glass-panel flex flex-col gap-4 rounded-2xl p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-base font-bold">Расписание занятий:</span>
                <span className="rounded-lg bg-black/10 px-2.5 py-1 text-xs font-semibold dark:bg-white/10">
                  {monthTitle}
                </span>
                <select
                  value={selectedClassId}
                  onChange={(e) => handleClassChange(e.target.value)}
                  className="h-9 rounded-lg border border-zinc-700 bg-transparent px-3 text-xs font-semibold focus:outline-none"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id} className="text-zinc-900">Класс: {c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
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

                <button
                  type="button"
                  onClick={() => setScheduleMode(scheduleMode === "calendar" ? "excel" : "calendar")}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium hover:bg-white/5"
                >
                  {scheduleMode === "calendar" ? <TableIcon className="h-3.5 w-3.5" /> : <CalendarIcon className="h-3.5 w-3.5" />}
                  <span>{scheduleMode === "calendar" ? "Табличный режим" : "Вид календаря"}</span>
                </button>

                {scheduleMode === "excel" && (
                  <>
                    <button
                      type="button"
                      onClick={addTableRow}
                      className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Строка</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveScheduleBatch}
                      className="theme-btn flex items-center gap-1 px-3 py-1.5 text-xs font-semibold"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>Сохранить</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {scheduleSavedMsg && (
              <p className="text-xs font-semibold text-cyan-400">✓ Изменения расписания сохранены</p>
            )}

            {scheduleMode === "calendar" ? (
              <div className={isGarden ? "space-y-0" : "space-y-4"}>
                {/* Циферблат стабилен в DOM */}
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

                {/* Блок уроков */}
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
                      : "space-y-4 pt-1"
                  }`}
                >
                  <div className="flex justify-between items-center mb-4">
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

                    {selectedDayOfWeek !== 7 && (
                      <button
                        type="button"
                        onClick={() => {
                          setLessonDayOfWeek(selectedDayOfWeek);
                          setIsAddLessonOpen(true);
                        }}
                        className={
                          isGarden
                            ? "rounded-full px-4 py-2 text-xs font-black bg-[#FEC868] text-[#382C1E] hover:bg-[#FFE29A] shadow-md flex items-center gap-1.5 transition"
                            : "theme-btn flex items-center gap-1.5 px-4 py-2 text-xs font-bold shadow-md"
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Добавить занятие</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-3 min-h-[380px]">
                    {activeDayLessons.length === 0 ? (
                      <div
                        className={`flex h-64 flex-col items-center justify-center p-8 text-center text-sm ${
                          isGarden
                            ? "rounded-[34px] border-2 border-dashed border-[#2D412F] text-[#ABC270] bg-[#111A12]/80"
                            : isPlanet
                            ? "rounded-3xl border border-cyan-500/20 text-cyan-300/80 bg-cyan-950/10"
                            : "rounded-3xl border border-dashed border-zinc-800 text-zinc-400"
                        }`}
                      >
                        {selectedDayOfWeek === 7 ? (
                          <>
                            <span className={`text-base font-bold ${isGarden ? "text-[#FEC868]" : "text-cyan-300"}`}>Воскресенье — выходной</span>
                            <span className={`text-xs mt-1 ${isGarden ? "text-[#ABC270]" : "text-zinc-400"}`}>Занятий нет, учебный процесс возобновится в понедельник</span>
                          </>
                        ) : (
                          <span>Уроков в этот день нет</span>
                        )}
                      </div>
                    ) : (
                      activeDayLessons.map((l) => {
                        const targetDayStr = format(currentDate, "yyyy-MM-dd");
                        const attachedHw = homeworks.filter(
                          (h) =>
                            h.classId === selectedClassId &&
                            h.targetDate === targetDayStr &&
                            h.subjectName.trim().toLowerCase() === l.subjectName.trim().toLowerCase()
                        );

                        return (
                          <div key={l.id} className="flex items-stretch gap-3 sm:gap-4">
                            <div className="flex w-12 sm:w-14 flex-col justify-between py-1 text-right shrink-0">
                              <span
                                className={`text-xs sm:text-sm font-bold ${
                                  isGarden ? "text-[#ABC270] font-black" : "text-zinc-100"
                                }`}
                              >
                                {l.startTime}
                              </span>
                              <span
                                className={`text-xs sm:text-sm font-medium ${
                                  isGarden ? "text-[#ABC270]/60 font-semibold" : "text-zinc-400"
                                }`}
                              >
                                {l.endTime}
                              </span>
                            </div>

                            <div
                              className={`group flex-1 p-4 sm:p-5 shadow-sm transition-all duration-200 ${
                                isGarden
                                  ? "bg-[#18261A] hover:bg-[#253928] text-white border border-[#2D412F] hover:border-[#ABC270]/70 hover:shadow-[0_8px_24px_rgba(0,0,0,0.45),_0_0_16px_rgba(171,194,112,0.18)] hover:-translate-y-0.5 rounded-[28px] sm:rounded-[36px]"
                                  : "glass-panel glass-interactive rounded-2xl sm:rounded-3xl"
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className={`text-xs font-semibold ${roomColorClass}`}>
                                    {l.room.toLowerCase().startsWith("каб") ? l.room : `каб. ${l.room}`}
                                  </div>
                                  <div className="mt-0.5 text-xs text-zinc-400">
                                    {l.teacherName ? formatTeacherName(l.teacherName) : "Преподаватель не указан"}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setHwPreset({ subjectName: l.subjectName, targetDate: targetDayStr });
                                      setIsHwModalOpen(true);
                                    }}
                                    className="rounded-lg bg-white/10 px-2 py-0.5 text-[11px] font-medium hover:bg-white/20 text-zinc-200"
                                  >
                                    + ДЗ
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (confirm("Удалить урок из расписания?")) {
                                        await deleteSingleLessonAction(l.id!);
                                      }
                                    }}
                                    className="rounded p-1 text-red-400 hover:bg-red-950/40"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="mt-4 text-sm sm:text-base font-bold text-white">
                                {l.subjectName}
                              </div>

                              {attachedHw.length > 0 && (
                                <div className="mt-3 space-y-1.5 border-t border-zinc-700/60 pt-2">
                                  {attachedHw.map((h) => (
                                    <div
                                      key={h.id}
                                      className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs ${hwBadgeClass}`}
                                    >
                                      <BookOpen className="h-3.5 w-3.5 shrink-0" />
                                      <span className="truncate font-medium">ДЗ: {h.title}</span>
                                    </div>
                                  ))}
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
            ) : (
              <div className="glass-panel overflow-x-auto rounded-2xl shadow-sm">
                <table className="w-full min-w-[700px] text-left text-xs">
                  <thead className="border-b border-zinc-800 font-semibold text-zinc-400">
                    <tr>
                      <th className="p-2 w-20">День</th>
                      <th className="p-2 w-14 text-center">№</th>
                      <th className="p-2 w-32">Время</th>
                      <th className="p-2">Предмет</th>
                      <th className="p-2 w-24">Кабинет</th>
                      <th className="p-2">ФИО Учителя</th>
                      <th className="p-2 w-10 text-center">X</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {editableRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-zinc-400">
                          Строк нет. Нажмите «+ Строка» для добавления занятия.
                        </td>
                      </tr>
                    ) : (
                      editableRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-white/5">
                          <td className="p-1">
                            <select
                              value={row.dayOfWeek}
                              onChange={(e) => updateTableRow(idx, "dayOfWeek", Number(e.target.value))}
                              className="w-full rounded border border-transparent bg-transparent p-1 font-semibold focus:border-zinc-400"
                            >
                              <option value={1} className="text-zinc-900">Пн</option>
                              <option value={2} className="text-zinc-900">Вт</option>
                              <option value={3} className="text-zinc-900">Ср</option>
                              <option value={4} className="text-zinc-900">Чт</option>
                              <option value={5} className="text-zinc-900">Пт</option>
                              <option value={6} className="text-zinc-900">Сб</option>
                              <option value={7} className="text-zinc-900">Вс</option>
                            </select>
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              min={1}
                              max={8}
                              value={row.lessonNumber}
                              onChange={(e) => updateTableRow(idx, "lessonNumber", Number(e.target.value))}
                              className="w-full rounded border border-transparent bg-transparent p-1 text-center font-mono focus:border-zinc-400"
                            />
                          </td>
                          <td className="p-1">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={row.startTime}
                                onChange={(e) => updateTableRow(idx, "startTime", e.target.value)}
                                className="w-12 rounded border border-transparent bg-transparent p-1 text-center focus:border-zinc-400"
                              />
                              <span>-</span>
                              <input
                                type="text"
                                value={row.endTime}
                                onChange={(e) => updateTableRow(idx, "endTime", e.target.value)}
                                className="w-12 rounded border border-transparent bg-transparent p-1 text-center focus:border-zinc-400"
                              />
                            </div>
                          </td>
                          <td className="p-1">
                            <input
                              type="text"
                              placeholder="Предмет"
                              value={row.subjectName}
                              onChange={(e) => updateTableRow(idx, "subjectName", e.target.value)}
                              className="w-full rounded border border-transparent bg-transparent p-1 font-medium focus:border-zinc-400"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="text"
                              placeholder="Каб."
                              value={row.room}
                              onChange={(e) => updateTableRow(idx, "room", e.target.value)}
                              className="w-full rounded border border-transparent bg-transparent p-1 focus:border-zinc-400"
                            />
                          </td>
                          <td className="p-1">
                            <select
                              value={row.teacherName}
                              onChange={(e) => updateTableRow(idx, "teacherName", e.target.value)}
                              className="w-full rounded border border-transparent bg-transparent p-1 focus:border-zinc-400"
                            >
                              {teachers.map((t) => {
                                const formatted = formatTeacherName(t.fullName);
                                return (
                                  <option key={t.id} value={formatted} className="text-zinc-900">
                                    {formatted}
                                  </option>
                                );
                              })}
                            </select>
                          </td>
                          <td className="p-1 text-center">
                            <button
                              type="button"
                              onClick={() => deleteTableRow(idx)}
                              className="rounded p-1 text-red-400 hover:bg-red-950/40"
                            >
                              <Trash2 className="h-3.5 w-3.5 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === "homeworks" && (
          <section className="space-y-4">
            <div className="glass-panel flex items-center justify-between rounded-2xl p-4 shadow-sm">
              <div>
                <h2 className="text-base font-bold">Выданные домашние задания</h2>
                <p className="text-xs text-zinc-500">Редактирование доступно до момента первой сдачи учениками</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHwPreset(null);
                  setIsHwModalOpen(true);
                }}
                className="theme-btn flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Создать задание</span>
              </button>
            </div>

            <div className="glass-panel overflow-x-auto rounded-2xl shadow-sm">
              <table className="w-full min-w-[700px] text-left text-xs">
                <thead className="border-b border-zinc-800 uppercase text-zinc-500">
                  <tr>
                    <th className="p-3">Класс</th>
                    <th className="p-3">Предмет</th>
                    <th className="p-3">Тема / Описание</th>
                    <th className="p-3">Срок сдачи</th>
                    <th className="p-3">Сдано</th>
                    <th className="p-3 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {sortedHomeworks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-zinc-400">Нет выданных заданий</td>
                    </tr>
                  ) : (
                    sortedHomeworks.map((hw) => (
                      <tr key={hw.id} className="hover:bg-white/5">
                        <td className="p-3 font-bold">{hw.className}</td>
                        <td className="p-3 font-medium">{hw.subjectName}</td>
                        <td className="p-3">
                          <span className="font-semibold">{hw.title}</span>
                          <span className="block truncate max-w-xs text-zinc-400">{hw.description}</span>
                        </td>
                        <td className="p-3">{hw.targetDate}</td>
                        <td className="p-3">
                          <span
                            className={`inline-block rounded px-2 py-0.5 font-semibold ${
                              hw.submissionsCount > 0
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                : "bg-white/10 text-zinc-400"
                            }`}
                          >
                            {hw.submissionsCount}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {hw.submissionsCount === 0 ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingHw(hw)}
                                className="rounded p-1 text-zinc-400 hover:text-white"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (confirm("Удалить это ДЗ?")) await deleteHomeworkAction(hw.id);
                                }}
                                className="rounded p-1 text-red-400 hover:bg-red-950/40"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-zinc-400">Заблокировано</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === "submissions" && (
          <section className="space-y-4">
            <div className="glass-panel flex flex-col gap-3 rounded-2xl p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold">Проверка сданных работ</h2>
                <p className="text-xs text-zinc-500">Фильтрация по предметам, статусам и датам сдачи</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={subSubjectFilter}
                  onChange={(e) => setSubSubjectFilter(e.target.value)}
                  className="h-8 rounded-lg border border-zinc-700 bg-transparent px-2"
                >
                  <option value="ALL" className="text-zinc-900">Все предметы</option>
                  {uniqueSubjects.map((s) => (
                    <option key={s} value={s} className="text-zinc-900">{s}</option>
                  ))}
                </select>

                <select
                  value={subStatusFilter}
                  onChange={(e) => setSubStatusFilter(e.target.value as any)}
                  className="h-8 rounded-lg border border-zinc-700 bg-transparent px-2"
                >
                  <option value="ALL" className="text-zinc-900">Все статусы</option>
                  <option value="PENDING" className="text-zinc-900">Ожидают проверки</option>
                  <option value="GRADED" className="text-zinc-900">Проверено</option>
                </select>

                <button
                  type="button"
                  onClick={() => setSubSortDateOrder(subSortDateOrder === "desc" ? "asc" : "desc")}
                  className="h-8 rounded-lg border border-zinc-700 px-2 hover:bg-white/5"
                >
                  Дата: {subSortDateOrder === "desc" ? "Новые сначала" : "Старые сначала"}
                </button>
              </div>
            </div>

            <div className="glass-panel overflow-x-auto rounded-2xl shadow-sm">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-400">
                  <tr>
                    <th className="p-3">Ученик</th>
                    <th className="p-3">Предмет / Задание</th>
                    <th className="p-3">Дата сдачи</th>
                    <th className="p-3">Статус / Оценка</th>
                    <th className="p-3 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-zinc-400">Работ не найдено</td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-white/5">
                        <td className="p-3 font-medium">{sub.studentName}</td>
                        <td className="p-3">
                          <span className="font-semibold">{sub.subjectName}</span>
                          <span className="block text-xs text-zinc-500">{sub.homeworkTitle}</span>
                        </td>
                        <td className="p-3 text-xs text-zinc-500">
                          {new Date(sub.submittedAt).toLocaleString("ru-RU")}
                        </td>
                        <td className="p-3">
                          {sub.grade ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold text-cyan-300 border border-cyan-400/40 shadow-[0_0_10px_rgba(56,189,248,0.4)]">
                              {sub.grade}
                            </span>
                          ) : (
                            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400 font-semibold">
                              Ожидает
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => setActiveModalData(sub as any)}
                            className="theme-btn px-3 py-1.5 text-xs font-semibold"
                          >
                            Проверить
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === "students" && (
          <section className="space-y-6">
            <div className="glass-panel rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <UserPlus className="h-4 w-4" />
                <h2>Регистрация нового ученика</h2>
              </div>
              <form
                action={async (fd) => {
                  await createStudentAction(fd);
                  (document.getElementById("create-student-form") as HTMLFormElement)?.reset();
                }}
                id="create-student-form"
                className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4"
              >
                <div className="sm:col-span-2">
                  <input
                    name="fullName"
                    required
                    placeholder="ФИО ученика (например: Артищев Иван Петрович)"
                    className="h-9 w-full rounded-lg border border-zinc-700 bg-transparent px-3 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <input
                    name="grade"
                    type="number"
                    min="1"
                    max="11"
                    required
                    placeholder="Класс (1-11)"
                    className="h-9 w-full rounded-lg border border-zinc-700 bg-transparent px-3 text-xs focus:outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    name="letter"
                    required
                    maxLength={1}
                    placeholder="Буква"
                    className="h-9 w-16 rounded-lg border border-zinc-700 bg-transparent px-3 text-xs uppercase focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="theme-btn flex-1 px-3 py-1.5 text-xs font-bold"
                  >
                    Создать
                  </button>
                </div>
              </form>
            </div>

            <div className="glass-panel rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="font-bold text-sm">Журнал учащихся</h3>
                    <p className="text-xs text-zinc-500">Ученики выбранного класса</p>
                  </div>
                  <select
                    value={studentSelectedClassId}
                    onChange={(e) => setStudentSelectedClassId(e.target.value)}
                    className="h-8 rounded-lg border border-zinc-700 bg-transparent px-2.5 text-xs font-bold focus:outline-none"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id} className="text-zinc-900">Класс {c.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setStudentSortOrder(studentSortOrder === "asc" ? "desc" : "asc")}
                  className="h-8 rounded border border-zinc-700 px-2 text-xs hover:bg-white/5"
                >
                  Фамилия: {studentSortOrder === "asc" ? "↑ По возрастанию" : "↓ По убыванию"}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-xs">
                  <thead className="border-b border-zinc-800 uppercase text-zinc-500">
                    <tr>
                      <th className="p-2.5 w-12 text-center">№</th>
                      <th className="p-2.5">ФИО Ученика</th>
                      <th className="p-2.5">Логин</th>
                      <th className="p-2.5">Пароль</th>
                      <th className="p-2.5 w-28 text-center">Копировать</th>
                      <th className="p-2.5 w-12 text-center">Удалить</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {currentClassStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-zinc-400">
                          В этом классе пока нет зарегистрированных учеников
                        </td>
                      </tr>
                    ) : (
                      currentClassStudents.map((st, idx) => (
                        <tr key={st.id} className="hover:bg-white/5">
                          <td className="p-2.5 text-center font-bold text-zinc-500">{idx + 1}</td>
                          <td className="p-2.5 font-semibold">{st.fullName}</td>
                          <td className="p-2.5 font-mono text-zinc-400">{st.login}</td>
                          <td className="p-2.5 font-mono text-zinc-400">{st.plainPassword}</td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => copyToClipboard(`Логин: ${st.login} | Пароль: ${st.plainPassword}`, st.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-medium hover:bg-white/20 text-zinc-200"
                            >
                              {copiedId === st.id ? <Check className="h-3 w-3 text-cyan-400" /> : <Copy className="h-3 w-3" />}
                              <span>{copiedId === st.id ? "Скопировано" : "Копия"}</span>
                            </button>
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm(`Удалить ученика ${st.fullName}?`)) {
                                  await deleteStudentAction(st.id);
                                }
                              }}
                              className="rounded p-1 text-red-400 hover:bg-red-950/40"
                            >
                              <Trash2 className="h-3.5 w-3.5 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeTab === "teachers" && (
          <section className="space-y-6">
            <div className="glass-panel rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <GraduationCap className="h-4 w-4" />
                <h2>Добавить нового учителя</h2>
              </div>
              <form
                action={async (fd) => {
                  await createTeacherAction(fd);
                  (document.getElementById("create-teacher-form") as HTMLFormElement)?.reset();
                }}
                id="create-teacher-form"
                className="mt-3 flex flex-col gap-3 sm:flex-row"
              >
                <input
                  name="fullName"
                  required
                  placeholder="ФИО Учителя (например: Смирнова Анна Павловна)"
                  className="h-9 flex-1 rounded-lg border border-zinc-700 bg-transparent px-3 text-xs focus:outline-none"
                />
                <button
                  type="submit"
                  className="theme-btn px-4 py-1.5 text-xs font-bold"
                >
                  Зарегистрировать учителя
                </button>
              </form>
            </div>

            <div className="glass-panel rounded-2xl p-4 shadow-sm space-y-3">
              <h3 className="font-bold text-sm">Список учителей и администраторов</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-xs">
                  <thead className="border-b border-zinc-800 uppercase text-zinc-500">
                    <tr>
                      <th className="p-2.5 w-12 text-center">№</th>
                      <th className="p-2.5">ФИО</th>
                      <th className="p-2.5">Сокращение</th>
                      <th className="p-2.5">Логин</th>
                      <th className="p-2.5">Пароль</th>
                      <th className="p-2.5 w-28 text-center">Копировать</th>
                      <th className="p-2.5 w-12 text-center">Удалить</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {teachers.map((t, idx) => (
                      <tr key={t.id} className="hover:bg-white/5">
                        <td className="p-2.5 text-center font-bold text-zinc-500">{idx + 1}</td>
                        <td className="p-2.5 font-semibold">{t.fullName}</td>
                        <td className="p-2.5 text-zinc-400">{formatTeacherName(t.fullName)}</td>
                        <td className="p-2.5 font-mono text-zinc-400">{t.login}</td>
                        <td className="p-2.5 font-mono text-zinc-400">{t.plainPassword}</td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(`Логин: ${t.login} | Пароль: ${t.plainPassword}`, t.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-medium hover:bg-white/20 text-zinc-200"
                          >
                            {copiedId === t.id ? <Check className="h-3 w-3 text-cyan-400" /> : <Copy className="h-3 w-3" />}
                            <span>{copiedId === t.id ? "Скопировано" : "Копия"}</span>
                          </button>
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm(`Удалить учителя ${t.fullName}?`)) {
                                try {
                                  await deleteTeacherAction(t.id);
                                } catch (err: any) {
                                  alert(err.message);
                                }
                              }
                            }}
                            className="rounded p-1 text-red-400 hover:bg-red-950/40"
                          >
                            <Trash2 className="h-3.5 w-3.5 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>

      {isAddLessonOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-sm rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-sm">Добавить занятие</h3>
              <button onClick={() => setIsAddLessonOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                await addSingleLessonAction({
                  classId: selectedClassId,
                  dayOfWeek: Number(fd.get("dayOfWeek")),
                  lessonNumber: Number(fd.get("lessonNumber")),
                  startTime: fd.get("startTime") as string,
                  endTime: fd.get("endTime") as string,
                  subjectName: fd.get("subjectName") as string,
                  room: fd.get("room") as string,
                  teacherName: fd.get("teacherName") as string,
                });
                setIsAddLessonOpen(false);
              }}
              className="mt-4 space-y-3 text-xs"
            >
              <input type="hidden" name="dayOfWeek" value={lessonDayOfWeek} />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-zinc-400 font-medium">№ Урока</label>
                  <input name="lessonNumber" type="number" min={1} max={8} defaultValue={1} required className="mt-1 h-8 w-full rounded border border-zinc-700 bg-transparent px-2" />
                </div>
                <div>
                  <label className="text-zinc-400 font-medium">Начало</label>
                  <input name="startTime" defaultValue="08:30" required className="mt-1 h-8 w-full rounded border border-zinc-700 bg-transparent px-2" />
                </div>
                <div>
                  <label className="text-zinc-400 font-medium">Конец</label>
                  <input name="endTime" defaultValue="09:15" required className="mt-1 h-8 w-full rounded border border-zinc-700 bg-transparent px-2" />
                </div>
              </div>
              <div>
                <label className="text-zinc-400 font-medium">Предмет</label>
                <input name="subjectName" required placeholder="Алгебра" className="mt-1 h-8 w-full rounded border border-zinc-700 bg-transparent px-2" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-zinc-400 font-medium">Кабинет</label>
                  <input name="room" defaultValue="101" required className="mt-1 h-8 w-full rounded border border-zinc-700 bg-transparent px-2" />
                </div>
                <div>
                  <label className="text-zinc-400 font-medium">Преподаватель</label>
                  <select
                    name="teacherName"
                    required
                    className="mt-1 h-8 w-full rounded border border-zinc-700 bg-transparent px-2 font-medium"
                  >
                    {teachers.map((t) => {
                      const formatted = formatTeacherName(t.fullName);
                      return (
                        <option key={t.id} value={formatted} className="text-zinc-900">
                          {formatted}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              <button type="submit" className="theme-btn w-full py-2 font-bold mt-2">
                Сохранить
              </button>
            </form>
          </div>
        </div>
      )}

      {isHwModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold">Выдать домашнее задание</h3>
              <button onClick={() => { setIsHwModalOpen(false); setHwPreset(null); setHwFiles([]); }}><X className="h-4 w-4" /></button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setHwLoading(true);
                try {
                  const fd = new FormData(e.currentTarget);
                  let attachments: any[] = [];
                  if (hwFiles.length > 0) {
                    const uploadFd = new FormData();
                    hwFiles.forEach((f) => uploadFd.append("files", f));
                    const res = await fetch("/api/upload", { method: "POST", body: uploadFd });
                    const data = await res.json();
                    if (data.files) attachments = data.files;
                  }

                  await createHomeworkAction({
                    classId: selectedClassId,
                    subjectName: fd.get("subjectName") as string,
                    targetDate: fd.get("targetDate") as string,
                    title: fd.get("title") as string,
                    description: fd.get("description") as string,
                    attachments,
                  });

                  setIsHwModalOpen(false);
                  setHwFiles([]);
                  setHwPreset(null);
                } finally {
                  setHwLoading(false);
                }
              }}
              className="mt-4 space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-medium text-zinc-400">Предмет</label>
                  <input
                    name="subjectName"
                    defaultValue={hwPreset?.subjectName || ""}
                    required
                    className="mt-1 h-8 w-full rounded border border-zinc-700 bg-transparent px-2"
                  />
                </div>
                <div>
                  <label className="font-medium text-zinc-400">Срок сдачи</label>
                  <input
                    name="targetDate"
                    type="date"
                    defaultValue={hwPreset?.targetDate || ""}
                    required
                    className="mt-1 h-8 w-full rounded border border-zinc-700 bg-transparent px-2"
                  />
                </div>
              </div>
              <div>
                <label className="font-medium text-zinc-400">Тема задания</label>
                <input name="title" required placeholder="Параграф 5, упр. 12" className="mt-1 h-8 w-full rounded border border-zinc-700 bg-transparent px-2" />
              </div>
              <div>
                <label className="font-medium text-zinc-400">Описание задания</label>
                <textarea name="description" rows={3} placeholder="Инструкции..." className="mt-1 w-full rounded border border-zinc-700 bg-transparent p-2" />
              </div>

              <div>
                <label className="font-medium text-zinc-400">Файлы</label>
                <div className="mt-1 flex items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-1 rounded border border-zinc-700 px-2.5 py-1 text-xs hover:bg-white/5">
                    <Paperclip className="h-3.5 w-3.5" />
                    <span>Выбрать файлы</span>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          setHwFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                {hwFiles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {hwFiles.map((file, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-medium"
                      >
                        <span className="max-w-[150px] truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setHwFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="rounded p-0.5 text-zinc-400 hover:text-red-400"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={hwLoading}
                className="theme-btn w-full py-2 font-bold disabled:opacity-50 mt-2"
              >
                {hwLoading ? "Сохранение..." : "Опубликовать"}
              </button>
            </form>
          </div>
        </div>
      )}

      {editingHw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold">Редактирование ДЗ</h3>
              <button onClick={() => setEditingHw(null)}><X className="h-4 w-4" /></button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                await updateHomeworkAction({
                  homeworkId: editingHw.id,
                  title: fd.get("title") as string,
                  description: fd.get("description") as string,
                  subjectName: fd.get("subjectName") as string,
                  targetDate: fd.get("targetDate") as string,
                });
                setEditingHw(null);
              }}
              className="mt-4 space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-medium text-zinc-400">Предмет</label>
                  <input
                    name="subjectName"
                    defaultValue={editingHw.subjectName}
                    required
                    className="mt-1 h-8 w-full rounded border border-zinc-700 bg-transparent px-2"
                  />
                </div>
                <div>
                  <label className="font-medium text-zinc-400">Срок сдачи</label>
                  <input
                    name="targetDate"
                    type="date"
                    defaultValue={editingHw.targetDate}
                    required
                    className="mt-1 h-8 w-full rounded border border-zinc-700 bg-transparent px-2"
                  />
                </div>
              </div>
              <div>
                <label className="font-medium text-zinc-400">Тема</label>
                <input
                  name="title"
                  defaultValue={editingHw.title}
                  required
                  className="mt-1 h-8 w-full rounded border border-zinc-700 bg-transparent px-2"
                />
              </div>
              <div>
                <label className="font-medium text-zinc-400">Инструкция</label>
                <textarea
                  name="description"
                  defaultValue={editingHw.description}
                  rows={3}
                  className="mt-1 w-full rounded border border-zinc-700 bg-transparent p-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingHw(null)}
                  className="rounded px-3 py-1.5 hover:bg-white/10"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="theme-btn px-4 py-1.5 font-bold"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <GradingModal
        isOpen={Boolean(activeModalData)}
        onClose={() => setActiveModalData(null)}
        submission={activeModalData}
        onSaveGrade={async (id, grade, comment) => {
          await gradeSubmissionAction(id, grade, comment);
        }}
      />
    </div>
  );
}