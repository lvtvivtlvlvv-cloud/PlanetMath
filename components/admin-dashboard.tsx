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
  updateStudentTrackAction,
  saveScheduleBatchAction,
  addSingleLessonAction,
  deleteSingleLessonAction,
  logoutAction,
  EditableScheduleRow,
} from "@/app/admin/actions";
import { ThemeSwitcher } from "./theme-switcher";
import { ThemeCalendarStrip } from "./theme-calendar-strip";
import { useAppTheme } from "./theme-context";
import { HomeworkCheckingStudio, StudentSubmissionItem, AnnotationItem } from "./homework-checking-studio";
import { HomeworkJournalView, HomeworkCardItem } from "./homework-journal-view";
import { EgeTaskBankView, EgeTaskItem, EgeAssignmentRecord } from "./ege-task-bank-view";
import { DatePicker } from "./date-picker";
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
  PenTool,
} from "lucide-react";
import { Button, Input, Textarea, Select, Card, SegmentedControl, Modal } from "./ui-kit";

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

function getAvatarColor(name: string): string {
  const colors = [
    "#EF4444", "#F97316", "#F59E0B", "#10B981", "#14B8A6",
    "#06B6D4", "#3B82F6", "#6366F1", "#8B5CF6", "#D946EF", "#EC4899"
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function parseTeacherComment(raw: string | null | undefined) {
  if (!raw) return { text: "", annotations: [], tasks: {}, modifiedImageUrl: "" };
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      ("text" in parsed || "annotations" in parsed || "tasks" in parsed || "modifiedImageUrl" in parsed)
    ) {
      return {
        text: parsed.text || "",
        annotations: parsed.annotations || [],
        tasks: parsed.tasks || {},
        modifiedImageUrl: parsed.modifiedImageUrl || "",
      };
    }
  } catch {}
  return { text: raw, annotations: [], tasks: {}, modifiedImageUrl: "" };
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
  examTrack?: string | null;
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
    homeworkId: string;
    studentId: string;
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
    targetTrack?: string | null;
    targetDate: string;
    submissionsCount: number;
    attachments?: Array<{
      id: string;
      fileName: string;
      fileUrl: string;
      fileType: string;
      fileSize?: number;
      expiresAt?: string | Date;
    }>;
  }>;
  students: StudentItem[];
  teachers: TeacherItem[];
  egeTasks?: EgeTaskItem[];
  egeAssignments?: EgeAssignmentRecord[];
}

const SHORT_WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

export function AdminDashboard({
  classes,
  scheduleItems,
  submissions,
  homeworks,
  students,
  teachers,
  egeTasks = [],
  egeAssignments = [],
  serverDate,
}: AdminDashboardProps) {
  const { colorMode, scheduleViewMode } = useAppTheme();
  const isLight = colorMode === "light";
  const isPlanetSchedule = scheduleViewMode === "planet";
  const [activeTab, setActiveTab] = useState<
    "schedule" | "journal" | "homeworks" | "submissions" | "ege" | "students" | "teachers"
  >("schedule");
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || "");
  const [scheduleMode, setScheduleMode] = useState<"calendar" | "excel">("calendar");

  const [checkingHomeworkData, setCheckingHomeworkData] = useState<any | null>(null);
  const [isCheckingStudioOpen, setIsCheckingStudioOpen] = useState(false);
  const [studioSubmissionsList, setStudioSubmissionsList] = useState<StudentSubmissionItem[]>([]);

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

  const handleSelectDate = (date: Date) => {
    setCurrentDate(date);
  };

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
  const [modalTargetTrack, setModalTargetTrack] = useState<"ALL" | "База" | "Профиль">("ALL");
  const [hwPreset, setHwPreset] = useState<{ subjectName: string; targetDate: string } | null>(null);
  const [hwFiles, setHwFiles] = useState<File[]>([]);
  const [hwLoading, setHwLoading] = useState(false);
  const [editingHw, setEditingHw] = useState<typeof homeworks[0] | null>(null);
  const [activeModalData, setActiveModalData] = useState<SubmissionModalData | null>(null);

  const [studentSelectedClassId, setStudentSelectedClassId] = useState<string>(classes[0]?.id || "");
  const [studentTrackFilter, setStudentTrackFilter] = useState<"ALL" | "База" | "Профиль">("ALL");
  const [updatingStudentId, setUpdatingStudentId] = useState<string | null>(null);
  const [studentSortOrder, setStudentSortOrder] = useState<"asc" | "desc">("asc");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = (text: string) => {
    setNotice(text);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 3500);
  };

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const currentClassStudents = useMemo(() => {
    let list = students.filter((s) => s.classId === studentSelectedClassId);
    if (studentTrackFilter !== "ALL") {
      list = list.filter((s) => (s.examTrack || "База") === studentTrackFilter);
    }
    list.sort((a, b) => {
      const surA = a.fullName.trim().split(/\s+/)[0] || "";
      const surB = b.fullName.trim().split(/\s+/)[0] || "";
      const cmp = surA.localeCompare(surB, "ru");
      return studentSortOrder === "asc" ? cmp : -cmp;
    });
    return list;
  }, [students, studentSelectedClassId, studentSortOrder, studentTrackFilter]);

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

  const roomColorClass = "theme-room-text";
  const hwBadgeClass = "theme-hw-chip";

  const journalHomeworks: HomeworkCardItem[] = useMemo(() => {
    return homeworks
      .filter((h) => !selectedClassId || h.classId === selectedClassId)
      .map((h) => ({
        id: h.id,
        classId: h.classId,
        className: h.className,
        subjectName: h.subjectName,
        title: h.title,
        description: h.description,
        targetDate: h.targetDate,
        targetTrack: h.targetTrack || null,
        submissionsCount: h.submissionsCount || 0,
        attachments: h.attachments?.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          fileUrl: a.fileUrl,
          fileType: a.fileType,
          fileSize: typeof a.fileSize === "number" ? a.fileSize : 89000,
        })),
      }));
  }, [homeworks, selectedClassId]);

  const openCheckingStudio = (hw: any) => {
    // Сдачи строго этого задания: раньше сравнение шло по названию/предмету/дате
    // и в проверку попадали работы по другим ДЗ.
    const realSubsForHw = submissions.filter((s) => s.homeworkId === hw.id);

    if (realSubsForHw.length === 0) {
      showNotice("По этому заданию пока нет сданных работ.");
      return;
    }

    const studentSubs: StudentSubmissionItem[] = realSubsForHw.map((s) => {
      const parsed = parseTeacherComment(s.teacherComment);
      return {
        id: s.id,
        studentId: s.studentId,
        studentName: s.studentName,
        avatarColor: getAvatarColor(s.studentName),
        initials:
          s.studentName
            .split(" ")
            .slice(0, 2)
            .map((p) => p[0])
            .join("")
            .toUpperCase() || "УЧ",
        submittedAt:
          typeof s.submittedAt === "string"
            ? s.submittedAt
            : format(new Date(s.submittedAt), "dd.MM.yyyy, HH:mm"),
        pagesCount: s.attachments?.length || 1,
        pageImages: (s.attachments || []).map((a) => a.fileUrl),
        status: (s.status === "GRADED" ? "GRADED" : "PENDING") as "GRADED" | "PENDING",
        grade: s.grade,
        teacherComment: parsed.text,
        annotations: parsed.annotations,
        tasksCompleted: parsed.tasks,
        content: s.content,
        modifiedImageUrl: parsed.modifiedImageUrl,
      };
    });

    const totalTasks = studentSubs.reduce(
      (max, sub) => Math.max(max, Object.keys(sub.tasksCompleted || {}).length),
      0
    );

    setCheckingHomeworkData({
      id: hw.id,
      title: hw.title,
      subjectName: hw.subjectName,
      targetDate: hw.targetDate,
      totalTasks,
      className: hw.className || "—",
    });
    setStudioSubmissionsList(studentSubs);
    setIsCheckingStudioOpen(true);
  };

  const handleSaveStudioGrade = async (
    submissionId: string,
    grade: number,
    comment: string,
    annotations: AnnotationItem[],
    tasksCompleted: { [taskNum: number]: boolean | null },
    modifiedImageUrl?: string
  ) => {
    if (submissions.some((s) => s.id === submissionId)) {
      await gradeSubmissionAction(
        submissionId,
        grade,
        comment,
        JSON.stringify(annotations),
        JSON.stringify(tasksCompleted),
        800,
        1066,
        modifiedImageUrl
      );
    }
    setStudioSubmissionsList((prev) =>
      prev.map((s) =>
        s.id === submissionId
          ? {
              ...s,
              status: "GRADED",
              grade,
              teacherComment: comment,
              annotations,
              tasksCompleted,
              modifiedImageUrl,
            }
          : s
      )
    );
  };

  const selectClass = isLight
    ? "rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 focus:outline-none focus:border-sky-500 shadow-2xs"
    : "rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs font-semibold text-zinc-100 focus:outline-none focus:border-cyan-500";

  return (
    <div className="min-h-screen w-full max-w-5xl mx-auto overflow-x-hidden space-y-5 p-3 sm:p-6 lg:p-8 pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))]">
      {/* КОМПАКТНАЯ ШАПКА БЕЗ СДВИГА ЗАГОЛОВКА */}
      <header
        className={`flex items-center justify-between gap-2 sm:gap-4 border-b pb-3.5 ${
          isLight ? "border-slate-200/80" : "border-zinc-800/80"
        }`}
      >
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight truncate">Панель Учителя</h1>
          <p className={`text-xs mt-0.5 truncate ${isLight ? "text-slate-500" : "text-zinc-400"}`}>
            2026–2027 учебный год
          </p>
        </div>

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
      </header>

      {/* ВЕРХНИЙ РЯД ВКЛАДОК С ГОРИЗОНТАЛЬНЫМ СКРОЛЛОМ БЕЗ ВЫПАДЕНИЯ ЗА РАМКИ */}
      <nav
        className={`flex items-center gap-2 overflow-x-auto no-scrollbar whitespace-nowrap px-4 -mx-4 sm:mx-0 sm:px-0 border-b pb-2.5 pt-0.5 ${
          isLight ? "border-slate-200/80" : "border-zinc-800/80"
        }`}
      >
        {[
          { id: "schedule", label: "Расписание" },
          { id: "journal", label: "Журнал ДЗ" },
          { id: "homeworks", label: "Выданные ДЗ" },
          { id: "submissions", label: `Проверка работ (${submissions.length})` },
          { id: "ege", label: `Банк задач ЕГЭ (${egeTasks.length})` },
          { id: "students", label: "Ученики" },
          { id: "teachers", label: `Учителя (${teachers.length})` },
        ].map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold border whitespace-nowrap shrink-0 transition duration-200 outline-none focus:outline-none cursor-pointer ${
                isActive
                  ? isLight
                    ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                    : "bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-[0_0_16px_rgba(56,189,248,0.2)]"
                  : isLight
                  ? "bg-slate-100 border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
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
          <section className="space-y-3.5">
            <Card padding="sm" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-sm sm:text-base font-bold">Расписание занятий:</span>
                <span
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                    isLight
                      ? "bg-slate-100 text-slate-700 border-slate-200/80"
                      : "bg-slate-800 text-slate-200 border-slate-700"
                  }`}
                >
                  {monthTitle}
                </span>
                <div className="w-40 sm:w-44">
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
                <div className="w-36 sm:w-44">
                  <Select
                    compact
                    value={selectedClassId}
                    onValueChange={handleClassChange}
                    options={classes.map((c) => ({
                      value: c.id,
                      label: `Класс: ${c.name}`,
                    }))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
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

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setScheduleMode(scheduleMode === "calendar" ? "excel" : "calendar")}
                >
                  {scheduleMode === "calendar" ? (
                    <TableIcon className="h-3.5 w-3.5" />
                  ) : (
                    <CalendarIcon className="h-3.5 w-3.5" />
                  )}
                  <span>{scheduleMode === "calendar" ? "Табличный режим" : "Вид календаря"}</span>
                </Button>

                {scheduleMode === "excel" && (
                  <>
                    <Button type="button" variant="secondary" size="sm" onClick={addTableRow}>
                      <Plus className="h-3.5 w-3.5" />
                      <span>Строка</span>
                    </Button>
                    <Button type="button" variant="primary" size="sm" onClick={handleSaveScheduleBatch}>
                      <Save className="h-3.5 w-3.5" />
                      <span>Сохранить</span>
                    </Button>
                  </>
                )}
              </div>
            </Card>

            {scheduleSavedMsg && (
              <p className={`text-xs font-semibold ${isLight ? "text-sky-600" : "text-cyan-400"}`}>
                ✓ Изменения расписания сохранены
              </p>
            )}

            {scheduleMode === "calendar" ? (
              <div className="space-y-3.5">
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
                  } space-y-3`}
                >
                  <div className="flex justify-between items-center gap-2 flex-wrap px-1">
                    <span
                      className={`font-bold text-xs sm:text-sm tracking-wide ${
                        isLight ? "text-slate-700" : "text-cyan-400"
                      }`}
                    >
                      {selectedDayOfWeek === 7
                        ? `Воскресенье, ${activeDateFormatted} — Выходной день`
                        : `Уроки на ${activeDateFormatted} (${SHORT_WEEKDAYS[selectedDayOfWeek - 1].toUpperCase()})`}
                    </span>

                    {selectedDayOfWeek !== 7 && (
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            const targetDayStr = format(currentDate, "yyyy-MM-dd");
                            const hwForDay = homeworks.find((h) => h.targetDate === targetDayStr);
                            if (hwForDay) {
                              openCheckingStudio(hwForDay);
                            } else {
                              // Никаких «первых попавшихся» ДЗ: отправляем в журнал.
                              showNotice("На этот день домашних заданий нет.");
                              setActiveTab("journal");
                            }
                          }}
                          title="Проверить домашнее задание"
                        >
                          <PenTool className="h-3.5 w-3.5" />
                          <span>Проверить ДЗ</span>
                        </Button>

                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setLessonDayOfWeek(selectedDayOfWeek);
                            setIsAddLessonOpen(true);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Добавить занятие</span>
                        </Button>
                      </div>
                    )}
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
                              Занятий нет, учебный процесс возобновится в понедельник
                            </span>
                          </>
                        ) : (
                          <span className="text-xs sm:text-sm font-medium">Уроков в этот день нет</span>
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
                                    className={`rounded-lg px-2 py-0.5 text-[11px] font-bold border cursor-pointer ${
                                      isLight
                                        ? "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                                        : "bg-white/10 border-white/10 hover:bg-white/20 text-zinc-200"
                                    }`}
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
                                    className="rounded p-1 text-red-500 hover:bg-red-500/15 cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div
                                className={`mt-2.5 text-sm sm:text-base font-black ${
                                  isLight ? "text-slate-900" : "text-white"
                                }`}
                              >
                                {l.subjectName}
                              </div>

                              {attachedHw.length > 0 && (
                                <div
                                  className={`mt-3 space-y-1.5 border-t pt-2 ${
                                    isLight ? "border-slate-100" : "border-zinc-700/60"
                                  }`}
                                >
                                  {attachedHw.map((h) => (
                                    <div
                                      key={h.id}
                                      className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-xs ${hwBadgeClass}`}
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <BookOpen className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate font-bold">ДЗ: {h.title}</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openCheckingStudio(h);
                                        }}
                                        className="flex items-center gap-1 rounded-lg bg-sky-600 hover:bg-sky-700 px-2.5 py-1 text-[10px] font-extrabold text-white shrink-0 shadow-2xs transition ml-2 cursor-pointer"
                                        title="Проверить работы учеников"
                                      >
                                        <PenTool className="h-3 w-3" />
                                        <span>Проверить ({h.submissionsCount})</span>
                                      </button>
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
              <div className="glass-panel overflow-x-auto rounded-2xl">
                <table className="w-full min-w-[700px] text-left text-xs">
                  <thead
                    className={`border-b font-semibold ${
                      isLight ? "border-slate-200 text-slate-500 bg-slate-50/60" : "border-zinc-800 text-zinc-400"
                    }`}
                  >
                    <tr>
                      <th className="p-2.5 w-20">День</th>
                      <th className="p-2.5 w-14 text-center">№</th>
                      <th className="p-2.5 w-32">Время</th>
                      <th className="p-2.5">Предмет</th>
                      <th className="p-2.5 w-24">Кабинет</th>
                      <th className="p-2.5">ФИО Учителя</th>
                      <th className="p-2.5 w-10 text-center">X</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isLight ? "divide-slate-200" : "divide-zinc-800"}`}>
                    {editableRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-400">
                          Строк нет. Нажмите «+ Строка» для добавления занятия.
                        </td>
                      </tr>
                    ) : (
                      editableRows.map((row, idx) => (
                        <tr key={idx} className={isLight ? "hover:bg-slate-50" : "hover:bg-white/5"}>
                          <td className="p-1.5">
                            <select
                              value={row.dayOfWeek}
                              onChange={(e) => updateTableRow(idx, "dayOfWeek", Number(e.target.value))}
                              className="w-full rounded border border-transparent bg-transparent p-1 font-semibold focus:border-sky-500"
                            >
                              <option value={1}>Пн</option>
                              <option value={2}>Вт</option>
                              <option value={3}>Ср</option>
                              <option value={4}>Чт</option>
                              <option value={5}>Пт</option>
                              <option value={6}>Сб</option>
                              <option value={7}>Вс</option>
                            </select>
                          </td>
                          <td className="p-1.5">
                            <input
                              type="number"
                              min={1}
                              max={8}
                              value={row.lessonNumber}
                              onChange={(e) => updateTableRow(idx, "lessonNumber", Number(e.target.value))}
                              className="w-full rounded border border-transparent bg-transparent p-1 text-center font-mono focus:border-sky-500"
                            />
                          </td>
                          <td className="p-1.5">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={row.startTime}
                                onChange={(e) => updateTableRow(idx, "startTime", e.target.value)}
                                className="w-12 rounded border border-transparent bg-transparent p-1 text-center focus:border-sky-500"
                              />
                              <span>-</span>
                              <input
                                type="text"
                                value={row.endTime}
                                onChange={(e) => updateTableRow(idx, "endTime", e.target.value)}
                                className="w-12 rounded border border-transparent bg-transparent p-1 text-center focus:border-sky-500"
                              />
                            </div>
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              placeholder="Предмет"
                              value={row.subjectName}
                              onChange={(e) => updateTableRow(idx, "subjectName", e.target.value)}
                              className="w-full rounded border border-transparent bg-transparent p-1 font-medium focus:border-sky-500"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              placeholder="Каб."
                              value={row.room}
                              onChange={(e) => updateTableRow(idx, "room", e.target.value)}
                              className="w-full rounded border border-transparent bg-transparent p-1 focus:border-sky-500"
                            />
                          </td>
                          <td className="p-1.5">
                            <select
                              value={row.teacherName}
                              onChange={(e) => updateTableRow(idx, "teacherName", e.target.value)}
                              className="w-full rounded border border-transparent bg-transparent p-1 focus:border-sky-500"
                            >
                              {teachers.map((t) => {
                                const formatted = formatTeacherName(t.fullName);
                                return (
                                  <option key={t.id} value={formatted}>
                                    {formatted}
                                  </option>
                                );
                              })}
                            </select>
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => deleteTableRow(idx)}
                              className="rounded p-1 text-red-500 hover:bg-red-500/10"
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

        {activeTab === "journal" && (
          <section className="space-y-4">
            <HomeworkJournalView
              homeworks={journalHomeworks}
              classes={classes}
              selectedClassId={selectedClassId}
              onSelectClassId={(cid) => setSelectedClassId(cid)}
              onOpenCheckingStudio={openCheckingStudio}
              onCreateHomework={async (data) => {
                await createHomeworkAction({
                  classId: data.classId,
                  subjectName: data.subjectName,
                  targetDate: data.targetDate,
                  title: data.title,
                  description: data.description,
                  targetTrack: data.targetTrack,
                  attachments: data.attachments,
                });
              }}
              onDeleteHomework={async (id) => {
                await deleteHomeworkAction(id);
              }}
            />
          </section>
        )}

        {activeTab === "homeworks" && (
          <section className="space-y-3.5 sm:space-y-4">
            <Card padding="sm" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold">Выданные домашние задания</h2>
                <p className={`text-xs mt-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                  Редактирование доступно до момента первой сдачи учениками
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => {
                  setHwPreset(null);
                  setIsHwModalOpen(true);
                }}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                <span>Создать задание</span>
              </Button>
            </Card>

            {/* Мобильный список карточек для «Выданные ДЗ» (< md) */}
            <div className="md:hidden space-y-3">
              {sortedHomeworks.length === 0 ? (
                <div
                  className={`glass-panel rounded-2xl p-6 text-center text-xs ${
                    isLight ? "text-slate-400" : "text-zinc-400"
                  }`}
                >
                  Нет выданных заданий
                </div>
              ) : (
                sortedHomeworks.map((hw) => (
                  <div
                    key={hw.id}
                    className="glass-panel rounded-2xl p-3.5 sm:p-4 space-y-2.5 transition duration-200"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                        <span
                          className={`rounded-lg px-2 py-0.5 text-xs font-black border ${
                            isLight
                              ? "bg-sky-50 text-sky-700 border-sky-200"
                              : "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                          }`}
                        >
                          {hw.className}
                        </span>
                        {hw.targetTrack && (
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase border ${
                              hw.targetTrack === "Профиль"
                                ? isLight
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                : isLight
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                            }`}
                          >
                            {hw.targetTrack}
                          </span>
                        )}
                        <span className={`text-xs font-bold truncate ${isLight ? "text-slate-700" : "text-zinc-200"}`}>
                          {hw.subjectName}
                        </span>
                      </div>

                      <span
                        className={`font-mono text-[11px] font-semibold shrink-0 ${
                          isLight ? "text-slate-500" : "text-zinc-400"
                        }`}
                      >
                        до {hw.targetDate}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <h3 className={`text-sm font-extrabold break-words ${isLight ? "text-slate-900" : "text-white"}`}>
                        {hw.title}
                      </h3>
                      {hw.description && (
                        <p
                          className={`text-xs mt-0.5 line-clamp-2 break-words ${
                            isLight ? "text-slate-500" : "text-zinc-400"
                          }`}
                        >
                          {hw.description}
                        </p>
                      )}
                    </div>

                    <div
                      className={`flex items-center justify-between gap-2 pt-2.5 border-t ${
                        isLight ? "border-slate-100" : "border-zinc-800/80"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold border ${
                            hw.submissionsCount > 0
                              ? isLight
                                ? "bg-sky-50 text-sky-700 border-sky-200"
                                : "bg-blue-950 text-blue-300 border-blue-800"
                              : isLight
                              ? "bg-slate-100 text-slate-500 border-slate-200"
                              : "bg-white/10 text-zinc-400 border-transparent"
                          }`}
                        >
                          <span>Сдано: {hw.submissionsCount}</span>
                        </span>

                        <button
                          type="button"
                          onClick={() => openCheckingStudio(hw)}
                          className="inline-flex items-center gap-1 rounded-lg bg-sky-600 hover:bg-sky-700 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs transition duration-200 cursor-pointer"
                        >
                          <PenTool className="h-3 w-3" />
                          <span>Проверить</span>
                        </button>
                      </div>

                      {hw.submissionsCount === 0 ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingHw(hw)}
                            className={`rounded-lg p-1.5 transition cursor-pointer ${
                              isLight
                                ? "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                : "text-zinc-400 hover:bg-white/10 hover:text-white"
                            }`}
                            title="Редактировать"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm("Удалить это ДЗ?")) await deleteHomeworkAction(hw.id);
                            }}
                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-500/10 transition cursor-pointer"
                            title="Удалить"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400">Заблокировано</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Десктопная таблица для «Выданные ДЗ» (md+) */}
            <div className="hidden md:block glass-panel overflow-x-auto rounded-2xl">
              <table className="w-full min-w-[700px] text-left text-xs">
                <thead
                  className={`border-b uppercase ${
                    isLight ? "border-slate-200 text-slate-500 bg-slate-50/60" : "border-zinc-800 text-zinc-500"
                  }`}
                >
                  <tr>
                    <th className="p-3">Класс</th>
                    <th className="p-3">Предмет</th>
                    <th className="p-3">Тема / Описание</th>
                    <th className="p-3">Срок сдачи</th>
                    <th className="p-3">Сдано</th>
                    <th className="p-3 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? "divide-slate-200" : "divide-zinc-800"}`}>
                  {sortedHomeworks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400">
                        Нет выданных заданий
                      </td>
                    </tr>
                  ) : (
                    sortedHomeworks.map((hw) => (
                      <tr key={hw.id} className={isLight ? "hover:bg-slate-50" : "hover:bg-white/5"}>
                        <td className="p-3 font-bold">
                          <span>{hw.className}</span>
                          {hw.targetTrack && (
                            <span
                              className={`ml-1.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase border ${
                                hw.targetTrack === "Профиль"
                                  ? isLight
                                    ? "bg-purple-50 text-purple-700 border-purple-200"
                                    : "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                  : isLight
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                              }`}
                            >
                              {hw.targetTrack}
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-medium">{hw.subjectName}</td>
                        <td className="p-3">
                          <span className="font-semibold">{hw.title}</span>
                          <span className={`block truncate max-w-xs ${isLight ? "text-slate-500" : "text-zinc-400"}`}>
                            {hw.description}
                          </span>
                        </td>
                        <td className="p-3 font-mono">{hw.targetDate}</td>
                        <td className="p-3">
                          <span
                            className={`inline-block rounded-md px-2 py-0.5 font-semibold border ${
                              hw.submissionsCount > 0
                                ? isLight
                                  ? "bg-sky-50 text-sky-700 border-sky-200"
                                  : "bg-blue-950 text-blue-300 border-blue-800"
                                : isLight
                                ? "bg-slate-100 text-slate-500 border-slate-200"
                                : "bg-white/10 text-zinc-400 border-transparent"
                            }`}
                          >
                            {hw.submissionsCount}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openCheckingStudio(hw)}
                              className="inline-flex items-center gap-1 rounded-lg bg-sky-600 hover:bg-sky-700 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs transition duration-200 cursor-pointer"
                            >
                              <PenTool className="h-3 w-3" />
                              <span>Проверить</span>
                            </button>
                            {hw.submissionsCount === 0 ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setEditingHw(hw)}
                                  className="rounded p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                                  title="Редактировать"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (confirm("Удалить это ДЗ?")) await deleteHomeworkAction(hw.id);
                                  }}
                                  className="rounded p-1 text-red-500 hover:bg-red-500/10 cursor-pointer"
                                  title="Удалить"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <span className="text-[10px] text-slate-400">Заблокировано</span>
                            )}
                          </div>
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
            <div className="glass-panel flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold">Проверка сданных работ</h2>
                <p className={`text-xs ${isLight ? "text-slate-500" : "text-zinc-500"}`}>
                  Фильтрация по предметам, статусам и датам сдачи
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={subSubjectFilter}
                  onChange={(e) => setSubSubjectFilter(e.target.value)}
                  className={`h-9 ${selectClass}`}
                >
                  <option value="ALL">Все предметы</option>
                  {uniqueSubjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <select
                  value={subStatusFilter}
                  onChange={(e) => setSubStatusFilter(e.target.value as any)}
                  className={`h-9 ${selectClass}`}
                >
                  <option value="ALL">Все статусы</option>
                  <option value="PENDING">Ожидают проверки</option>
                  <option value="GRADED">Проверено</option>
                </select>

                <button
                  type="button"
                  onClick={() => setSubSortDateOrder(subSortDateOrder === "desc" ? "asc" : "desc")}
                  className={`h-9 rounded-xl border px-3 font-semibold transition cursor-pointer ${
                    isLight
                      ? "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                      : "border-zinc-700 hover:bg-white/5"
                  }`}
                >
                  Дата: {subSortDateOrder === "desc" ? "Новые сначала" : "Старые сначала"}
                </button>
              </div>
            </div>

            <div className="glass-panel overflow-x-auto rounded-2xl">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead
                  className={`border-b text-xs uppercase ${
                    isLight ? "border-slate-200 text-slate-500 bg-slate-50/60" : "border-zinc-800 text-zinc-400"
                  }`}
                >
                  <tr>
                    <th className="p-3">Ученик</th>
                    <th className="p-3">Предмет / Задание</th>
                    <th className="p-3">Дата сдачи</th>
                    <th className="p-3">Статус / Оценка</th>
                    <th className="p-3 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? "divide-slate-200" : "divide-zinc-800"}`}>
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400">
                        Работ не найдено
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((sub) => (
                      <tr key={sub.id} className={isLight ? "hover:bg-slate-50" : "hover:bg-white/5"}>
                        <td className="p-3 font-medium">{sub.studentName}</td>
                        <td className="p-3">
                          <span className="font-semibold">{sub.subjectName}</span>
                          <span className={`block text-xs ${isLight ? "text-slate-500" : "text-zinc-500"}`}>
                            {sub.homeworkTitle}
                          </span>
                        </td>
                        <td className={`p-3 text-xs ${isLight ? "text-slate-500" : "text-zinc-500"}`}>
                          {new Date(sub.submittedAt).toLocaleString("ru-RU")}
                        </td>
                        <td className="p-3">
                          {sub.grade ? (
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold border ${
                                isLight
                                  ? "bg-sky-50 text-sky-700 border-sky-200"
                                  : "bg-cyan-500/20 text-cyan-300 border-cyan-400/40"
                              }`}
                            >
                              {sub.grade}
                            </span>
                          ) : (
                            <span
                              className={`rounded-md px-2 py-0.5 text-xs font-semibold border ${
                                isLight
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                              }`}
                            >
                              Ожидает
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => setActiveModalData(sub as any)}
                            className="theme-btn px-3 py-1.5 text-xs font-bold cursor-pointer"
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
          <section className="space-y-5">
            <Card padding="md">
              <div className="flex items-center gap-2 font-bold text-sm">
                <UserPlus className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <h2>Регистрация нового ученика</h2>
              </div>
              <form
                action={async (fd) => {
                  await createStudentAction(fd);
                  (document.getElementById("create-student-form") as HTMLFormElement)?.reset();
                }}
                id="create-student-form"
                className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-5 items-center"
              >
                <div className="sm:col-span-2">
                  <Input
                    name="fullName"
                    required
                    placeholder="ФИО ученика (например: Артищев Иван Петрович)"
                  />
                </div>
                <div>
                  <Input
                    name="grade"
                    type="number"
                    min="1"
                    max="11"
                    required
                    placeholder="Класс (1-11)"
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    name="letter"
                    required
                    maxLength={1}
                    placeholder="Буква"
                    className="w-16 uppercase text-center"
                  />
                  <Select
                    name="examTrack"
                    title="Для 11 класса: выберите уровень экзамена (Профиль / База)"
                  >
                    <option value="База">11 кл: База</option>
                    <option value="Профиль">11 кл: Профиль</option>
                  </Select>
                </div>
                <div>
                  <Button type="submit" variant="primary" size="full">
                    Создать
                  </Button>
                </div>
              </form>
            </Card>

            <div className="glass-panel rounded-2xl p-4 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <div>
                    <h3 className="font-bold text-sm">Журнал учащихся</h3>
                    <p className={`text-xs ${isLight ? "text-slate-500" : "text-zinc-500"}`}>
                      Ученики выбранного класса
                    </p>
                  </div>
                  <select
                    value={studentSelectedClassId}
                    onChange={(e) => setStudentSelectedClassId(e.target.value)}
                    className={`h-9 ${selectClass}`}
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        Класс {c.name}
                      </option>
                    ))}
                  </select>

                  {Boolean(
                    classes.find((c) => c.id === studentSelectedClassId)?.grade === 11 ||
                      classes.find((c) => c.id === studentSelectedClassId)?.name.startsWith("11")
                  ) && (
                    <div
                      className={`flex items-center gap-1 p-1 rounded-xl border text-xs ${
                        isLight ? "bg-slate-100 border-slate-200" : "bg-zinc-800/80 border-zinc-700"
                      }`}
                    >
                      <span className={`text-[11px] px-1.5 font-bold ${isLight ? "text-slate-500" : "text-zinc-400"}`}>
                        Экзамен:
                      </span>
                      {(["ALL", "База", "Профиль"] as const).map((tr) => (
                        <button
                          key={tr}
                          type="button"
                          onClick={() => setStudentTrackFilter(tr)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            studentTrackFilter === tr
                              ? tr === "Профиль"
                                ? "bg-purple-600 text-white shadow-xs"
                                : tr === "База"
                                ? "bg-amber-600 text-white shadow-xs"
                                : isLight
                                ? "bg-sky-600 text-white shadow-xs"
                                : "bg-white/20 text-white shadow-xs"
                              : isLight
                              ? "text-slate-600 hover:text-slate-900"
                              : "text-zinc-400 hover:text-white"
                          }`}
                        >
                          {tr === "ALL" ? "Все" : tr}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setStudentSortOrder(studentSortOrder === "asc" ? "desc" : "asc")}
                  className={`h-9 rounded-xl border px-3 text-xs font-semibold cursor-pointer ${
                    isLight
                      ? "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                      : "border-zinc-700 hover:bg-white/5"
                  }`}
                >
                  Фамилия: {studentSortOrder === "asc" ? "↑ По возрастанию" : "↓ По убыванию"}
                </button>
              </div>

              {Boolean(
                classes.find((c) => c.id === studentSelectedClassId)?.grade === 11 ||
                  classes.find((c) => c.id === studentSelectedClassId)?.name.startsWith("11")
              ) && (
                <p
                  className={`text-[11px] border rounded-xl px-3 py-2 ${
                    isLight
                      ? "bg-sky-50 border-sky-200 text-sky-900"
                      : "text-zinc-400 bg-blue-950/20 border-blue-900/30"
                  }`}
                >
                  💡 <strong>11 класс:</strong> нажмите на кнопку в колонке <em>«Экзамен»</em>, чтобы переключить ученика между{" "}
                  <strong>Базой</strong> и <strong>Профилем</strong>.
                </p>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-xs">
                  <thead
                    className={`border-b uppercase ${
                      isLight ? "border-slate-200 text-slate-500 bg-slate-50/60" : "border-zinc-800 text-zinc-500"
                    }`}
                  >
                    <tr>
                      <th className="p-2.5 w-12 text-center">№</th>
                      <th className="p-2.5">ФИО Ученика</th>
                      {Boolean(
                        classes.find((c) => c.id === studentSelectedClassId)?.grade === 11 ||
                          classes.find((c) => c.id === studentSelectedClassId)?.name.startsWith("11")
                      ) && <th className="p-2.5 text-center w-36">Экзамен (Профиль/База)</th>}
                      <th className="p-2.5">Логин</th>
                      <th className="p-2.5">Пароль</th>
                      <th className="p-2.5 w-28 text-center">Копировать</th>
                      <th className="p-2.5 w-12 text-center">Удалить</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isLight ? "divide-slate-200" : "divide-zinc-800"}`}>
                    {currentClassStudents.length === 0 ? (
                      <tr>
                        <td
                          colSpan={
                            Boolean(
                              classes.find((c) => c.id === studentSelectedClassId)?.grade === 11 ||
                                classes.find((c) => c.id === studentSelectedClassId)?.name.startsWith("11")
                            )
                              ? 7
                              : 6
                          }
                          className="p-4 text-center text-slate-400"
                        >
                          В этом классе пока нет зарегистрированных учеников
                        </td>
                      </tr>
                    ) : (
                      currentClassStudents.map((st, idx) => {
                        const is11 = Boolean(
                          classes.find((c) => c.id === studentSelectedClassId)?.grade === 11 ||
                            classes.find((c) => c.id === studentSelectedClassId)?.name.startsWith("11")
                        );
                        return (
                          <tr key={st.id} className={isLight ? "hover:bg-slate-50" : "hover:bg-white/5"}>
                            <td className="p-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                            <td className="p-2.5 font-semibold">{st.fullName}</td>
                            {is11 && (
                              <td className="p-2.5 text-center">
                                <button
                                  type="button"
                                  disabled={updatingStudentId === st.id}
                                  onClick={async () => {
                                    setUpdatingStudentId(st.id);
                                    try {
                                      const nextTrack = (st.examTrack || "База") === "Профиль" ? "База" : "Профиль";
                                      await updateStudentTrackAction(st.id, nextTrack);
                                    } finally {
                                      setUpdatingStudentId(null);
                                    }
                                  }}
                                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-black uppercase border transition shadow-2xs active:scale-95 cursor-pointer ${
                                    st.examTrack === "Профиль"
                                      ? isLight
                                        ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                                        : "bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30"
                                      : isLight
                                      ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                      : "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                                  }`}
                                  title="Нажмите, чтобы переключить экзамен (Профиль ↔ База)"
                                >
                                  <span>{st.examTrack === "Профиль" ? "Профиль ⚡" : "База 📘"}</span>
                                </button>
                              </td>
                            )}
                            <td className={`p-2.5 font-mono ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
                              {st.login}
                            </td>
                            <td className={`p-2.5 font-mono ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
                              {st.plainPassword}
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  copyToClipboard(`Логин: ${st.login} | Пароль: ${st.plainPassword}`, st.id)
                                }
                                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium cursor-pointer ${
                                  isLight
                                    ? "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                                    : "bg-white/10 border-transparent hover:bg-white/20 text-zinc-200"
                                }`}
                              >
                                {copiedId === st.id ? (
                                  <Check className="h-3 w-3 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
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
                                className="rounded p-1 text-red-500 hover:bg-red-500/10 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5 mx-auto" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeTab === "ege" && (
          <section className="space-y-6">
            <EgeTaskBankView
              tasks={egeTasks}
              assignments={egeAssignments}
              students={students.map((s) => ({
                id: s.id,
                fullName: s.fullName,
                className: s.className,
                classId: s.classId,
                grade: s.grade,
                examTrack: s.examTrack,
              }))}
              classes={classes.map((c) => ({
                id: c.id,
                name: c.name,
                grade: c.grade,
              }))}
            />
          </section>
        )}

        {activeTab === "teachers" && (
          <section className="space-y-5">
            <Card padding="md">
              <div className="flex items-center gap-2 font-bold text-sm">
                <GraduationCap className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <h2>Добавить нового учителя</h2>
              </div>
              <form
                action={async (fd) => {
                  await createTeacherAction(fd);
                  (document.getElementById("create-teacher-form") as HTMLFormElement)?.reset();
                }}
                id="create-teacher-form"
                className="mt-3 flex flex-col gap-3 sm:flex-row items-stretch sm:items-center"
              >
                <div className="flex-1">
                  <Input
                    name="fullName"
                    required
                    placeholder="ФИО Учителя (например: Смирнова Анна Павловна)"
                  />
                </div>
                <Button type="submit" variant="primary" size="md" className="h-11">
                  Зарегистрировать учителя
                </Button>
              </form>
            </Card>

            <div className="glass-panel rounded-2xl p-4 space-y-3">
              <h3 className="font-bold text-sm">Список учителей и администраторов</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-xs">
                  <thead
                    className={`border-b uppercase ${
                      isLight ? "border-slate-200 text-slate-500 bg-slate-50/60" : "border-zinc-800 text-zinc-500"
                    }`}
                  >
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
                  <tbody className={`divide-y ${isLight ? "divide-slate-200" : "divide-zinc-800"}`}>
                    {teachers.map((t, idx) => (
                      <tr key={t.id} className={isLight ? "hover:bg-slate-50" : "hover:bg-white/5"}>
                        <td className="p-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-2.5 font-semibold">{t.fullName}</td>
                        <td className={`p-2.5 ${isLight ? "text-slate-500" : "text-zinc-400"}`}>
                          {formatTeacherName(t.fullName)}
                        </td>
                        <td className={`p-2.5 font-mono ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
                          {t.login}
                        </td>
                        <td className={`p-2.5 font-mono ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
                          {t.plainPassword}
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(`Логин: ${t.login} | Пароль: ${t.plainPassword}`, t.id)
                            }
                            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium cursor-pointer ${
                              isLight
                                ? "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                                : "bg-white/10 border-transparent hover:bg-white/20 text-zinc-200"
                            }`}
                          >
                            {copiedId === t.id ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
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
                            className="rounded p-1 text-red-500 hover:bg-red-500/10 cursor-pointer"
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

      {/* Модальное окно «Добавить занятие» через единый <Modal /> дизайн-системы */}
      <Modal
        isOpen={isAddLessonOpen}
        onClose={() => setIsAddLessonOpen(false)}
        title="Добавить занятие"
        icon={<CalendarIcon className="w-4 h-4" />}
        maxWidth="md"
      >
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
          className="space-y-3.5 text-xs sm:text-sm"
        >
          <input type="hidden" name="dayOfWeek" value={lessonDayOfWeek} />
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              Дата занятия (день недели)
            </label>
            <DatePicker
              value={format(addDays(monday, Math.max(0, lessonDayOfWeek - 1)), "yyyy-MM-dd")}
              onChange={(iso) => {
                if (iso) {
                  const d = parseISO(iso);
                  const dow = getDay(d) === 0 ? 7 : getDay(d);
                  setLessonDayOfWeek(dow);
                  setCurrentDate(d);
                }
              }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                № Урока
              </label>
              <Input name="lessonNumber" type="number" min={1} max={8} defaultValue={1} required />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Начало
              </label>
              <Input name="startTime" defaultValue="08:30" required />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Конец
              </label>
              <Input name="endTime" defaultValue="09:15" required />
            </div>
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              Предмет
            </label>
            <Input name="subjectName" required placeholder="Алгебра" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Кабинет
              </label>
              <Input name="room" defaultValue="101" required />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Преподаватель
              </label>
              <Select name="teacherName" required>
                {teachers.map((t) => {
                  const formatted = formatTeacherName(t.fullName);
                  return (
                    <option key={t.id} value={formatted}>
                      {formatted}
                    </option>
                  );
                })}
              </Select>
            </div>
          </div>
          <div className="pt-2">
            <Button type="submit" variant="primary" size="full">
              Сохранить
            </Button>
          </div>
        </form>
      </Modal>

      {/* Модальное окно «Выдать ДЗ» через единый <Modal /> дизайн-системы */}
      <Modal
        isOpen={isHwModalOpen}
        onClose={() => {
          setIsHwModalOpen(false);
          setHwPreset(null);
          setHwFiles([]);
        }}
        title="Выдать домашнее задание"
        icon={<BookOpen className="w-4 h-4" />}
        maxWidth="lg"
      >
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
                targetTrack: Boolean(
                  classes.find((c) => c.id === selectedClassId)?.grade === 11 ||
                    classes.find((c) => c.id === selectedClassId)?.name.startsWith("11")
                )
                  ? modalTargetTrack === "ALL"
                    ? null
                    : modalTargetTrack
                  : null,
                attachments,
              });

              setIsHwModalOpen(false);
              setHwFiles([]);
              setHwPreset(null);
              setModalTargetTrack("ALL");
            } finally {
              setHwLoading(false);
            }
          }}
          className="space-y-3.5 text-xs sm:text-sm"
        >
          {Boolean(
            classes.find((c) => c.id === selectedClassId)?.grade === 11 ||
              classes.find((c) => c.id === selectedClassId)?.name.startsWith("11")
          ) && (
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Кому выдать ДЗ (11 класс)
              </label>
              <SegmentedControl
                fullWidth
                size="sm"
                value={modalTargetTrack}
                onChange={setModalTargetTrack}
                options={[
                  { value: "ALL", label: "Весь класс" },
                  { value: "База", label: "База" },
                  { value: "Профиль", label: "Профиль" },
                ]}
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Предмет
              </label>
              <Input name="subjectName" defaultValue={hwPreset?.subjectName || ""} required />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Срок сдачи
              </label>
              <DatePicker
                name="targetDate"
                defaultValue={hwPreset?.targetDate || format(currentDate, "yyyy-MM-dd")}
                required
              />
            </div>
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              Тема задания
            </label>
            <Input name="title" required placeholder="Параграф 5, упр. 12" />
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              Описание задания
            </label>
            <Textarea name="description" rows={3} placeholder="Инструкции..." />
          </div>

          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              Файлы
            </label>
            <div className="flex items-center gap-2">
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
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium ${
                      isLight ? "bg-slate-100 text-slate-700" : "bg-slate-800 text-slate-200"
                    }`}
                  >
                    <span className="max-w-[150px] truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setHwFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="rounded p-0.5 text-slate-400 hover:text-rose-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2">
            <Button type="submit" variant="primary" size="full" disabled={hwLoading}>
              {hwLoading ? "Сохранение..." : "Опубликовать"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Модальное окно «Редактирование ДЗ» через единый <Modal /> дизайн-системы */}
      <Modal
        isOpen={Boolean(editingHw)}
        onClose={() => setEditingHw(null)}
        title="Редактирование ДЗ"
        icon={<Edit2 className="w-4 h-4" />}
        maxWidth="lg"
      >
        {editingHw && (
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
                // Сохраняем трек 11 класса: иначе ДЗ «для Профиля» станет общим.
                targetTrack: editingHw.targetTrack ?? null,
              });
              setEditingHw(null);
            }}
            className="space-y-3.5 text-xs sm:text-sm"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Предмет
                </label>
                <Input name="subjectName" defaultValue={editingHw.subjectName} required />
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Срок сдачи
                </label>
                <DatePicker name="targetDate" defaultValue={editingHw.targetDate} required />
              </div>
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Тема
              </label>
              <Input name="title" defaultValue={editingHw.title} required />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Инструкция
              </label>
              <Textarea name="description" defaultValue={editingHw.description} rows={3} />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditingHw(null)}>
                Отмена
              </Button>
              <Button type="submit" variant="primary">
                Сохранить
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <GradingModal
        isOpen={Boolean(activeModalData)}
        onClose={() => setActiveModalData(null)}
        submission={activeModalData}
        onSaveGrade={async (id, grade, comment) => {
          await gradeSubmissionAction(id, grade, comment);
        }}
      />

      {checkingHomeworkData && (
        <HomeworkCheckingStudio
          isOpen={isCheckingStudioOpen}
          homework={checkingHomeworkData}
          submissions={studioSubmissionsList}
          onClose={() => setIsCheckingStudioOpen(false)}
          onSaveGrade={handleSaveStudioGrade}
        />
      )}

      {notice && (
        <div
          role="status"
          className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[10000] max-w-[92vw] rounded-2xl border px-4 py-2.5 text-xs font-semibold shadow-xl backdrop-blur-md ${
            isLight
              ? "bg-white/95 border-slate-200 text-slate-800"
              : "bg-slate-900/95 border-slate-700 text-slate-100"
          }`}
        >
          {notice}
        </div>
      )}
    </div>
  );
}