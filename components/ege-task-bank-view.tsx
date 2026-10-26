"use client";

import React, { useState, useMemo, useTransition, useEffect, useRef, useCallback } from "react";
import { useAppTheme } from "./theme-context";
import {
  BookOpen,
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  Layers,
  Sparkles,
  Search,
  Users,
  User,
  GraduationCap,
  Calendar,
  AlertCircle,
  FileText,
  Clock,
  RotateCcw,
  Eye,
  EyeOff,
  Send,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  createEgeTaskAction,
  deleteEgeTaskAction,
  createEgeAssignmentAction,
  deleteEgeAssignmentAction,
  reseedEgeTasksAction,
  syncFromLocalPdfAction,
} from "@/app/admin/actions";
import { EGE_TASK_TOPICS } from "@/lib/ege-constants";
import { MathText } from "./math-text";
import { PdfTaskCrop } from "./pdf-task-crop";
import { DatePicker } from "./date-picker";
import { resolvePdfTaskMeta } from "@/lib/ege-math-cleaner";
import { Card, Button, Input, Textarea, Select, SegmentedControl, Modal } from "./ui-kit";

export interface EgeTaskItem {
  id: string;
  taskNumber: number;
  topic: string;
  title: string;
  content: string;
  answer?: string | null;
  solution?: string | null;
  difficulty: string;
  source: string;
  pdfPage?: number | null;
  taskCode?: string | null;
  createdAt: string;
}

export interface EgeAssignmentRecord {
  id: string;
  title: string;
  teacherComment?: string | null;
  targetClassId?: string | null;
  studentId?: string | null;
  targetTrack?: string | null;
  deadline?: string | null;
  createdAt: string;
  studentName?: string;
  itemsCount: number;
  completedCount: number;
}

export interface StudentOption {
  id: string;
  fullName: string;
  className: string;
  classId: string;
  grade: number;
  examTrack?: string | null;
}

export interface ClassOption {
  id: string;
  name: string;
  grade: number;
}

interface EgeTaskBankViewProps {
  tasks: EgeTaskItem[];
  assignments: EgeAssignmentRecord[];
  students: StudentOption[];
  classes: ClassOption[];
}

export function EgeTaskBankView({
  tasks = [],
  assignments = [],
  students = [],
  classes = [],
}: EgeTaskBankViewProps) {
  const { isLight } = useAppTheme();

  const [activeSubTab, setActiveSubTab] = useState<"constructor" | "bank" | "history">("constructor");
  const [isPending, startTransition] = useTransition();

  // Bank filters
  const [selectedTaskNumberFilter, setSelectedTaskNumberFilter] = useState<number | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleAnswers, setVisibleAnswers] = useState<Record<string, boolean>>({});

  // Constructor state
  const [targetType, setTargetType] = useState<"class" | "student">("class");
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || "");
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || "");
  const [selectedTrackFilter, setSelectedTrackFilter] = useState<"ALL" | "Профиль" | "База">("ALL");
  const [workTitle, setWorkTitle] = useState("Тренировочная работа по математике ЕГЭ");
  const [workDeadline, setWorkDeadline] = useState("");
  const [teacherComment, setTeacherComment] = useState("");

  // Requested counts by task number: { 1: 0, 2: 0, ... 19: 0 }
  const [taskCounts, setTaskCounts] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    for (let i = 1; i <= 19; i++) init[i] = 0;
    init[1] = 1;
    init[2] = 1;
    init[6] = 1;
    return init;
  });

  // Manual task creation form
  const [newTaskNumber, setNewTaskNumber] = useState<number>(1);
  const [newTaskTopic, setNewTaskTopic] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskContent, setNewTaskContent] = useState("");
  const [newTaskAnswer, setNewTaskAnswer] = useState("");
  const [newTaskSolution, setNewTaskSolution] = useState("");
  const [newTaskDifficulty, setNewTaskDifficulty] = useState<string>("BASE");

  // Toast and modal states
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // PDF upload state
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [syncingLocalPdf, setSyncingLocalPdf] = useState(false);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (type: "success" | "error" | "info", message: string) => {
    setToast({ type, message });
  };

  const tasksCountByNumber = useMemo(() => {
    const map: Record<number, number> = {};
    for (let i = 1; i <= 19; i++) map[i] = 0;
    tasks.forEach((t) => {
      map[t.taskNumber] = (map[t.taskNumber] || 0) + 1;
    });
    return map;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (selectedTaskNumberFilter !== "ALL" && t.taskNumber !== selectedTaskNumberFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesContent = t.content.toLowerCase().includes(q);
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesTopic = t.topic.toLowerCase().includes(q);
        return matchesContent || matchesTitle || matchesTopic;
      }
      return true;
    });
  }, [tasks, selectedTaskNumberFilter, searchQuery]);

  // ---------------------------------------------------------------------------
  // Постраничный вывод + горизонтальная прокрутка фильтров стрелками (ПК)
  // ---------------------------------------------------------------------------
  const PAGE_SIZE = 10;

  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageTasks = filteredTasks.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  // При смене фильтра/поиска возвращаемся на первую страницу.
  useEffect(() => {
    setPage(0);
  }, [selectedTaskNumberFilter, searchQuery]);

  const listTopRef = useRef<HTMLDivElement | null>(null);
  const goToPage = (next: number) => {
    const clamped = Math.max(0, Math.min(pageCount - 1, next));
    setPage(clamped);
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const chipsScrollRef = useRef<HTMLDivElement | null>(null);
  const [chipsScroll, setChipsScroll] = useState({ left: false, right: false, canScroll: false });

  const updateChipsScroll = useCallback(() => {
    const el = chipsScrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setChipsScroll({
      left: el.scrollLeft > 4,
      right: el.scrollLeft < max - 4,
      canScroll: max > 4,
    });
  }, []);

  useEffect(() => {
    const el = chipsScrollRef.current;
    updateChipsScroll();

    // Ширина полосы зависит от шрифтов/лейаута — пересчитываем после первого кадра
    // и после загрузки шрифтов, иначе стрелки остаются «залипшими» в disabled.
    const raf = requestAnimationFrame(updateChipsScroll);
    const timer = setTimeout(updateChipsScroll, 300);

    const observer =
      el && typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateChipsScroll) : null;
    if (el && observer) observer.observe(el);

    window.addEventListener("resize", updateChipsScroll);
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(updateChipsScroll).catch(() => undefined);
    }

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      observer?.disconnect();
      window.removeEventListener("resize", updateChipsScroll);
    };
    // activeSubTab важен: полоса фильтров монтируется только на вкладке «Банк задач»,
    // и при первом монтировании компонента её ещё нет в DOM.
  }, [updateChipsScroll, activeSubTab]);

  const scrollChips = (direction: -1 | 1) => {
    const el = chipsScrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 0) return;
    el.scrollBy({
      left: direction * Math.max(220, el.clientWidth * 0.8),
      behavior: "smooth",
    });
  };

  const totalTasksSelected = useMemo(() => {
    return Object.values(taskCounts).reduce((acc, c) => acc + (c || 0), 0);
  }, [taskCounts]);

  const recipientSummary = useMemo(() => {
    if (targetType === "student") {
      const st = students.find((s) => s.id === selectedStudentId);
      return st ? `${st.fullName} (${st.className}${st.examTrack ? `, ${st.examTrack}` : ""})` : "Ученик не выбран";
    }
    const cls = classes.find((c) => c.id === selectedClassId);
    if (!cls) return "Класс не выбран";
    const studentsInClass = students.filter(
      (s) => s.classId === selectedClassId && (selectedTrackFilter === "ALL" || s.examTrack === selectedTrackFilter)
    );
    return `Класс ${cls.name} (${studentsInClass.length} учеников${selectedTrackFilter !== "ALL" ? `, профиль: ${selectedTrackFilter}` : ""})`;
  }, [targetType, selectedStudentId, selectedClassId, selectedTrackFilter, students, classes]);

  const applyPreset = (preset: "part1" | "geometry" | "algebra" | "part2" | "clear") => {
    const next: Record<number, number> = {};
    for (let i = 1; i <= 19; i++) next[i] = 0;

    if (preset === "part1") {
      for (let i = 1; i <= 12; i++) next[i] = 1;
      setWorkTitle("Пробный вариант ЕГЭ: Часть 1 (№1–12)");
      showToast("info", "Применен шаблон: Вся 1-я часть (№1–12 по 1 задаче)");
    } else if (preset === "geometry") {
      next[1] = 2;
      next[3] = 2;
      next[14] = 1;
      next[17] = 1;
      setWorkTitle("Тематическая работа: Геометрия ЕГЭ (№1, 3, 14, 17)");
      showToast("info", "Применен шаблон: Геометрия");
    } else if (preset === "algebra") {
      next[6] = 2;
      next[7] = 2;
      next[12] = 2;
      next[13] = 1;
      next[15] = 1;
      setWorkTitle("Тренировка: Уравнения, функции и неравенства");
      showToast("info", "Применен шаблон: Алгебра и уравнения");
    } else if (preset === "part2") {
      for (let i = 13; i <= 19; i++) next[i] = 1;
      setWorkTitle("Сложная часть профильного ЕГЭ (№13–19)");
      showToast("info", "Применен шаблон: Часть 2 (№13–19)");
    } else if (preset === "clear") {
      setWorkTitle("Новая тренировочная работа");
      showToast("info", "Счетчики заданий сброшены");
    }

    setTaskCounts(next);
  };

  const handleCountChange = (num: number, delta: number) => {
    setTaskCounts((prev) => {
      const current = prev[num] || 0;
      const nextVal = Math.max(0, Math.min(20, current + delta));
      return { ...prev, [num]: nextVal };
    });
  };

  const handleCreateAssignment = () => {
    if (totalTasksSelected === 0) {
      showToast("error", "Выберите хотя бы одно задание для включения в работу!");
      return;
    }
    if (!workTitle.trim()) {
      showToast("error", "Пожалуйста, укажите название работы!");
      return;
    }

    startTransition(async () => {
      try {
        const res = await createEgeAssignmentAction({
          title: workTitle,
          teacherComment,
          targetType,
          targetId: targetType === "student" ? selectedStudentId : selectedClassId,
          targetTrack: targetType === "class" ? selectedTrackFilter : null,
          deadline: workDeadline || undefined,
          countsByType: taskCounts,
        });

        if (res.success) {
          showToast("success", `Работа успешно сформирована и выдана (${res.countAssigned} ученикам)!`);
          setActiveSubTab("history");
        }
      } catch (err: any) {
        showToast("error", err.message || "Ошибка при выдаче работы");
      }
    });
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTaskTitle.trim() || !newTaskContent.trim()) {
      showToast("error", "Укажите краткое название и текст задания");
      return;
    }

    startTransition(async () => {
      try {
        await createEgeTaskAction({
          taskNumber: newTaskNumber,
          topic: newTaskTopic || undefined,
          title: newTaskTitle,
          content: newTaskContent,
          answer: newTaskAnswer || undefined,
          solution: newTaskSolution || undefined,
          difficulty: newTaskDifficulty,
        });

        showToast("success", `Задание №${newTaskNumber} успешно сохранено в банк!`);
        setNewTaskTitle("");
        setNewTaskContent("");
        setNewTaskAnswer("");
        setNewTaskSolution("");
      } catch (err: any) {
        showToast("error", err.message || "Не удалось сохранить задание");
      }
    });
  };

  const handleSyncFromLocalPdf = () => {
    setSyncingLocalPdf(true);
    startTransition(async () => {
      try {
        const res = await syncFromLocalPdfAction();
        showToast("success", `Синхронизация завершена! Всего в базе: ${res.total} заданий.`);
        window.location.reload();
      } catch (err: any) {
        showToast("error", `Ошибка синхронизации: ${err.message}`);
      } finally {
        setSyncingLocalPdf(false);
      }
    });
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      showToast("error", "Пожалуйста, выберите файл в формате .pdf");
      return;
    }

    setUploadingPdf(true);
    showToast("info", "Загрузка и парсинг PDF файла...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ege/import-pdf", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ошибка при парсинге PDF");
      }

      showToast(
        "success",
        `Готово! Страниц: ${data.pages}. Заданий: ${data.totalExtracted} (новых: ${data.added}, обновлено: ${data.updated}).`
      );
      window.location.reload();
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleReseed = () => {
    setConfirmModal({
      isOpen: true,
      title: "Восстановление эталонного банка ФИПИ",
      message: "Загрузить стандартный эталонный банк ФИПИ со всеми 19 номерами заданий?",
      onConfirm: () => {
        setConfirmModal(null);
        startTransition(async () => {
          try {
            await reseedEgeTasksAction();
            showToast("success", "Эталонный банк ФИПИ успешно загружен!");
            window.location.reload();
          } catch (err: any) {
            showToast("error", "Ошибка: " + err.message);
          }
        });
      },
    });
  };

  const handleDeleteTask = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Удаление задания",
      message: "Вы действительно хотите удалить это задание из банка?",
      onConfirm: () => {
        setConfirmModal(null);
        startTransition(async () => {
          try {
            await deleteEgeTaskAction(id);
            showToast("info", "Задание удалено из базы");
          } catch (err: any) {
            showToast("error", "Ошибка при удалении: " + err.message);
          }
        });
      },
    });
  };

  const handleDeleteAssignment = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Удаление выданной работы",
      message: "Удалить эту тренировочную работу и все прикрепленные к ней задания учеников?",
      onConfirm: () => {
        setConfirmModal(null);
        startTransition(async () => {
          try {
            await deleteEgeAssignmentAction(id);
            showToast("info", "Выданная работа удалена");
          } catch (err: any) {
            showToast("error", "Ошибка при удалении: " + err.message);
          }
        });
      },
    });
  };

  const toggleAnswer = (id: string) => {
    setVisibleAnswers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6 relative">
      {/* СТИЛИЗОВАННОЕ ВСПЛЫВАЮЩЕЕ УВЕДОМЛЕНИЕ (TOAST) */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-4 duration-200 max-w-sm">
          <div
            className={`p-4 rounded-2xl shadow-xl backdrop-blur-2xl border flex items-start gap-3 ${
              isLight
                ? toast.type === "success"
                  ? "bg-white border-emerald-200 text-slate-800"
                  : toast.type === "error"
                  ? "bg-white border-rose-200 text-slate-800"
                  : "bg-white border-sky-200 text-slate-800"
                : toast.type === "success"
                ? "bg-slate-950/90 border-emerald-500/40 text-emerald-300"
                : toast.type === "error"
                ? "bg-slate-950/90 border-rose-500/40 text-rose-300"
                : "bg-slate-950/90 border-sky-500/40 text-sky-300"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            ) : toast.type === "error" ? (
              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            ) : (
              <Sparkles className="h-5 w-5 text-sky-500 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs font-semibold leading-relaxed">{toast.message}</div>
            <Button variant="ghost" size="icon" onClick={() => setToast(null)} className="h-6 w-6">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ЕДИНОЕ МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ (CONFIRM) */}
      <Modal
        isOpen={Boolean(confirmModal?.isOpen)}
        onClose={() => setConfirmModal(null)}
        title={confirmModal?.title || "Подтверждение"}
        icon={<AlertCircle className="w-4 h-4" />}
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmModal(null)}>
              Отмена
            </Button>
            <Button variant="primary" size="sm" onClick={() => confirmModal?.onConfirm()}>
              Подтвердить
            </Button>
          </div>
        }
      >
        <p className={`text-xs sm:text-sm leading-relaxed ${isLight ? "text-slate-600" : "text-slate-300"}`}>
          {confirmModal?.message}
        </p>
      </Modal>

      {/* ВЕРХНЯЯ ШАПКА РАЗДЕЛА */}
      <Card padding="md" className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`p-2.5 rounded-xl border shrink-0 ${
              isLight
                ? "bg-sky-50 text-sky-600 border-sky-200/80"
                : "bg-sky-500/15 text-sky-400 border-sky-500/30"
            }`}
          >
            <GraduationCap className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-black tracking-tight flex flex-wrap items-center gap-2">
              <span>Банк заданий ЕГЭ (Профиль)</span>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                  isLight
                    ? "bg-sky-50 text-sky-700 border-sky-200"
                    : "bg-sky-500/20 text-sky-300 border-sky-400/40"
                }`}
              >
                {tasks.length} заданий в базе
              </span>
            </h2>
            <p className={`text-xs mt-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
              Конструктор выдачи вариантов, открытый банк ФИПИ и управление базой задач
            </p>
          </div>
        </div>

        {/* АДАПТИВНЫЙ СЕГМЕНТИРОВАННЫЙ ПЕРЕКЛЮЧАТЕЛЬ ПОДВКЛАДОК */}
        <SegmentedControl
          fullWidth
          className="lg:w-auto flex-wrap sm:flex-nowrap"
          value={activeSubTab}
          onChange={setActiveSubTab}
          options={[
            { value: "constructor", label: "Конструктор выдачи", icon: <Sparkles className="h-3.5 w-3.5" /> },
            { value: "bank", label: "Банк задач", icon: <BookOpen className="h-3.5 w-3.5" /> },
            {
              value: "history",
              label: "Выданные работы",
              badge: assignments.length,
              icon: <Clock className="h-3.5 w-3.5" />,
            },
          ]}
        />
      </Card>

      {/* ===================== ВКЛАДКА 1: КОНСТРУКТОР ВЫДАЧИ ЗАДАНИЙ ===================== */}
      {activeSubTab === "constructor" && (
        <div className="space-y-6">
          {/* СЕКЦИЯ 1: ПАРАМЕТРЫ РАБОТЫ И ВЫБОР ПОЛУЧАТЕЛЕЙ */}
          <Card padding="md" className="space-y-4">
            <h3
              className={`text-sm font-black uppercase tracking-wider flex items-center gap-2 ${
                isLight ? "text-slate-800" : "text-slate-200"
              }`}
            >
              <Users className={`h-4 w-4 ${isLight ? "text-sky-600" : "text-sky-400"}`} />
              1. Кому и как выдать работу
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Формат выдачи */}
              <div className="space-y-1.5">
                <label className={`block text-xs font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Формат выдачи:
                </label>
                <SegmentedControl
                  fullWidth
                  value={targetType}
                  onChange={setTargetType}
                  className="h-11"
                  options={[
                    { value: "class", label: "Целому классу", icon: <Users className="h-3.5 w-3.5" /> },
                    { value: "student", label: "Ученику", icon: <User className="h-3.5 w-3.5" /> },
                  ]}
                />
              </div>

              {targetType === "class" ? (
                <>
                  <div className="space-y-1.5">
                    <label className={`block text-xs font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                      Выберите класс:
                    </label>
                    <Select
                      value={selectedClassId}
                      onValueChange={(val) => setSelectedClassId(String(val))}
                      options={classes.map((c) => ({
                        value: c.id,
                        label: `${c.name} (${c.grade} класс)`,
                        badge: `${c.grade} кл.`,
                      }))}
                      placeholder="Выберите класс"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={`block text-xs font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                      По профилю ЕГЭ (11 класс):
                    </label>
                    <Select
                      value={selectedTrackFilter}
                      onValueChange={(val) => setSelectedTrackFilter(val as any)}
                      options={[
                        { value: "ALL", label: "Все ученики класса" },
                        { value: "Профиль", label: "Только «Профиль»", badge: "Профиль" },
                        { value: "База", label: "Только «База»", badge: "База" },
                      ]}
                    />
                  </div>
                </>
              ) : (
                <div className="md:col-span-2 space-y-1.5">
                  <label className={`block text-xs font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                    Выберите конкретного ученика:
                  </label>
                  <Select
                    value={selectedStudentId}
                    onValueChange={(val) => setSelectedStudentId(String(val))}
                    options={students.map((st) => ({
                      value: st.id,
                      label: `${st.fullName} — ${st.className}`,
                      badge: st.examTrack || undefined,
                      sublabel: st.className,
                    }))}
                    placeholder="Выберите ученика"
                  />
                </div>
              )}
            </div>

            <div
              className={`grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t ${
                isLight ? "border-slate-100" : "border-slate-800"
              }`}
            >
              <div className="md:col-span-2 space-y-1.5">
                <label className={`block text-xs font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Название тренировочной работы:
                </label>
                <Input
                  type="text"
                  value={workTitle}
                  onChange={(e) => setWorkTitle(e.target.value)}
                  placeholder="Например: Тренировочная работа №1 по планиметрии и уравнениям"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  className={`text-xs font-semibold flex items-center gap-1.5 ${
                    isLight ? "text-slate-600" : "text-slate-400"
                  }`}
                >
                  <Calendar className={`h-3.5 w-3.5 ${isLight ? "text-sky-600" : "text-sky-400"}`} />
                  Срок сдачи (дедлайн):
                </label>
                <DatePicker
                  value={workDeadline}
                  onChange={setWorkDeadline}
                  placeholder="Выберите дату сдачи"
                  allowClear
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={`block text-xs font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Комментарий / инструкция учителя (опционально):
              </label>
              <Input
                type="text"
                value={teacherComment}
                onChange={(e) => setTeacherComment(e.target.value)}
                placeholder="Например: Задания 1-12 проверяются автоматически, ход решений запишите в тетрадь"
              />
            </div>
          </Card>

          {/* СЕКЦИЯ 2: БЫСТРЫЕ ШАБЛОНЫ И МАТРИЦА ЗАДАНИЙ 1-19 */}
          <Card padding="md" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3
                  className={`text-sm font-black uppercase tracking-wider flex items-center gap-2 ${
                    isLight ? "text-slate-800" : "text-slate-200"
                  }`}
                >
                  <Layers className={`h-4 w-4 ${isLight ? "text-sky-600" : "text-sky-400"}`} />
                  2. Выберите количество заданий по номерам ЕГЭ (1–19)
                </h3>
                <p className={`text-xs mt-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                  Укажите, сколько задач каждого типа нужно автоматически подобрать и прикрепить
                </p>
              </div>

              <div className="flex items-center flex-wrap gap-1.5">
                <Button variant="secondary" size="sm" onClick={() => applyPreset("part1")}>
                  ⚡ Вся Часть 1 (№1–12)
                </Button>
                <Button variant="secondary" size="sm" onClick={() => applyPreset("geometry")}>
                  📐 Геометрия
                </Button>
                <Button variant="secondary" size="sm" onClick={() => applyPreset("algebra")}>
                  ∑ Алгебра
                </Button>
                <Button variant="secondary" size="sm" onClick={() => applyPreset("part2")}>
                  🔥 Часть 2 (№13–19)
                </Button>
                <Button variant="danger" size="sm" onClick={() => applyPreset("clear")}>
                  Сброс
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-2">
              {Array.from({ length: 19 }, (_, i) => i + 1).map((num) => {
                const count = taskCounts[num] || 0;
                const inBank = tasksCountByNumber[num] || 0;
                const meta = EGE_TASK_TOPICS[num] || { topic: `Задание №${num}`, difficulty: "BASE" };
                const isSelected = count > 0;
                const isPart2 = num >= 13;

                return (
                  <div
                    key={num}
                    className={`p-3.5 rounded-2xl border transition-all duration-200 h-full flex flex-col justify-between ${
                      isSelected
                        ? isLight
                          ? "bg-sky-50/70 border-sky-300 ring-1 ring-sky-200 shadow-xs"
                          : "bg-sky-950/30 border-sky-500/50 ring-1 ring-sky-500/30"
                        : isLight
                        ? "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
                        : "bg-slate-800/50 border-slate-700/80 hover:border-slate-600"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`flex items-center justify-center w-8 h-8 rounded-xl text-xs font-black border shrink-0 ${
                            isPart2
                              ? isLight
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : isLight
                              ? "bg-sky-50 text-sky-700 border-sky-200"
                              : "bg-sky-500/20 text-sky-300 border-sky-500/40"
                          }`}
                        >
                          №{num}
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${
                            inBank > 0
                              ? isLight
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : isLight
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                          }`}
                        >
                          {inBank > 0 ? `В банке: ${inBank} шт.` : "0 в банке"}
                        </span>
                      </div>

                      <p
                        className={`mt-2 text-xs font-bold line-clamp-2 min-h-[2.5rem] leading-snug ${
                          isLight ? "text-slate-800" : "text-slate-100"
                        }`}
                        title={meta.topic}
                      >
                        {meta.topic}
                      </p>
                    </div>

                    <div
                      className={`mt-3 flex items-center justify-between gap-2 pt-2.5 border-t ${
                        isLight ? "border-slate-100" : "border-slate-700/60"
                      }`}
                    >
                      <span className={`text-[11px] font-medium ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                        Выдать в работу:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7 rounded-lg"
                          onClick={() => handleCountChange(num, -1)}
                          disabled={count <= 0}
                        >
                          -
                        </Button>
                        <span
                          className={`w-7 text-center text-xs font-black ${
                            count > 0
                              ? isLight
                                ? "text-sky-600 scale-105"
                                : "text-sky-300 scale-105"
                              : isLight
                              ? "text-slate-400"
                              : "text-slate-500"
                          }`}
                        >
                          {count}
                        </span>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7 rounded-lg"
                          onClick={() => handleCountChange(num, 1)}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              className={`mt-4 p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isLight
                  ? "bg-sky-50/70 border-sky-200"
                  : "bg-sky-950/30 border-sky-500/30"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className={`h-4 w-4 ${isLight ? "text-sky-600" : "text-sky-400"}`} />
                  <p className={`text-xs font-bold ${isLight ? "text-slate-800" : "text-slate-200"}`}>
                    Итого выбрано:{" "}
                    <span className={`font-black text-sm ${isLight ? "text-sky-700" : "text-sky-300"}`}>
                      {totalTasksSelected} заданий
                    </span>
                  </p>
                </div>
                <p className={`text-[11px] mt-0.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Получатели:{" "}
                  <span className={`font-semibold ${isLight ? "text-slate-900" : "text-slate-200"}`}>
                    {recipientSummary}
                  </span>
                </p>
              </div>

              <Button
                variant="primary"
                size="lg"
                onClick={handleCreateAssignment}
                disabled={isPending || totalTasksSelected === 0}
              >
                <Send className="h-4 w-4" />
                <span>{isPending ? "Формирование варианта..." : "Сформировать и выдать работу"}</span>
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ===================== ВКЛАДКА 2: УПРАВЛЕНИЕ БАНКОМ ЗАДАЧ И ИМПОРТ PDF ===================== */}
      {activeSubTab === "bank" && (
        <div className="space-y-6">
          <Card padding="md" className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              className={`p-4 rounded-xl border space-y-2.5 flex flex-col justify-between ${
                isLight ? "bg-sky-50/70 border-sky-200" : "bg-sky-950/30 border-sky-500/30"
              }`}
            >
              <div>
                <div
                  className={`flex items-center gap-2 font-bold text-xs ${
                    isLight ? "text-sky-800" : "text-sky-300"
                  }`}
                >
                  <FileText className={`h-4 w-4 ${isLight ? "text-sky-600" : "text-sky-400"}`} />
                  <span>Локальный PDF ФИПИ в корне</span>
                </div>
                <p className={`text-[11px] leading-relaxed mt-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Файл «Открытый банк задач ФИПИ. ЕГЭ по профильной математике.pdf» (611 стр.) уже доступен в проекте.
                </p>
              </div>

              <Button
                variant="primary"
                size="full"
                onClick={handleSyncFromLocalPdf}
                disabled={syncingLocalPdf || isPending}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncingLocalPdf ? "animate-spin" : ""}`} />
                <span>{syncingLocalPdf ? "Синхронизация..." : "Синхронизировать из локального PDF"}</span>
              </Button>
            </div>

            <div
              className={`p-4 rounded-xl border space-y-2.5 flex flex-col justify-between ${
                isLight ? "bg-slate-50 border-slate-200" : "bg-slate-800/50 border-slate-700"
              }`}
            >
              <div>
                <div
                  className={`flex items-center gap-2 font-bold text-xs ${
                    isLight ? "text-slate-800" : "text-slate-200"
                  }`}
                >
                  <Upload className={`h-4 w-4 ${isLight ? "text-sky-600" : "text-sky-400"}`} />
                  <span>Загрузить другой PDF-файл</span>
                </div>
                <p className={`text-[11px] leading-relaxed mt-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Загрузите любой другой сборник задач в формате PDF для распознавания формулировок и ответов.
                </p>
              </div>

              <label
                className={`h-11 w-full flex items-center justify-center gap-2 px-4 rounded-xl font-medium text-sm border transition-all duration-200 cursor-pointer ${
                  isLight
                    ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                }`}
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{uploadingPdf ? "Обработка..." : "Выбрать и распарсить PDF"}</span>
                <input type="file" accept=".pdf" onChange={handlePdfUpload} disabled={uploadingPdf} className="hidden" />
              </label>
            </div>

            <div
              className={`p-4 rounded-xl border space-y-2.5 flex flex-col justify-between ${
                isLight ? "bg-emerald-50/70 border-emerald-200" : "bg-emerald-950/20 border-emerald-500/20"
              }`}
            >
              <div>
                <div
                  className={`flex items-center gap-2 font-bold text-xs ${
                    isLight ? "text-emerald-800" : "text-emerald-300"
                  }`}
                >
                  <RotateCcw className={`h-4 w-4 ${isLight ? "text-emerald-600" : "text-emerald-400"}`} />
                  <span>Эталонный банк ФИПИ</span>
                </div>
                <p className={`text-[11px] leading-relaxed mt-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Быстро дополнить банк эталонными заданиями по всем 19 номерам с подробными решениями.
                </p>
              </div>

              <Button
                variant="secondary"
                size="full"
                onClick={handleReseed}
                disabled={isPending}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>Загрузить эталонный банк</span>
              </Button>
            </div>
          </Card>

          {/* ФОРМА РУЧНОГО ДОБАВЛЕНИЯ ЗАДАНИЯ В БАНК */}
          <Card padding="md" className="space-y-4">
            <h3
              className={`text-sm font-black uppercase tracking-wider flex items-center gap-2 ${
                isLight ? "text-slate-800" : "text-slate-200"
              }`}
            >
              <Plus className={`h-4 w-4 ${isLight ? "text-sky-600" : "text-sky-400"}`} />
              Добавить новое задание вручную
            </h3>

            <form onSubmit={handleCreateTask} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className={`block text-xs font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                    Номер задания ЕГЭ:
                  </label>
                  <Select
                    value={String(newTaskNumber)}
                    onValueChange={(val) => {
                      const num = Number(val);
                      setNewTaskNumber(num);
                      const meta = EGE_TASK_TOPICS[num];
                      if (meta) {
                        setNewTaskTopic(meta.topic);
                        setNewTaskDifficulty(meta.difficulty);
                      }
                    }}
                    options={Array.from({ length: 19 }, (_, i) => i + 1).map((n) => ({
                      value: String(n),
                      label: `№${n} — ${EGE_TASK_TOPICS[n]?.topic || ""}`,
                      badge: `№${n}`,
                    }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={`block text-xs font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                    Тема (подраздел):
                  </label>
                  <Input
                    type="text"
                    value={newTaskTopic}
                    onChange={(e) => setNewTaskTopic(e.target.value)}
                    placeholder="Например: Векторы на координатной плоскости"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={`block text-xs font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                    Сложность:
                  </label>
                  <Select
                    value={newTaskDifficulty}
                    onValueChange={(val) => setNewTaskDifficulty(String(val))}
                    options={[
                      { value: "BASE", label: "Базовый (Часть 1)", badge: "1 балл" },
                      { value: "ADVANCED", label: "Повышенный (Часть 2)", badge: "2-3 балла" },
                      { value: "HIGH", label: "Высокий (Олимпиадный)", badge: "4 балла" },
                    ]}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={`block text-xs font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Краткий заголовок задания:
                </label>
                <Input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Например: Скалярное произведение векторов при заданных координатах"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className={`block text-xs font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Текст и условие задачи:
                </label>
                <Textarea
                  rows={4}
                  value={newTaskContent}
                  onChange={(e) => setNewTaskContent(e.target.value)}
                  placeholder="Введите полное условие задачи, формулы, числовые данные..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={`block text-xs font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                    Правильный ответ (для автопроверки):
                  </label>
                  <Input
                    type="text"
                    value={newTaskAnswer}
                    onChange={(e) => setNewTaskAnswer(e.target.value)}
                    placeholder="Например: 12 или 0.75"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={`block text-xs font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                    Пояснение / решение (опционально):
                  </label>
                  <Input
                    type="text"
                    value={newTaskSolution}
                    onChange={(e) => setNewTaskSolution(e.target.value)}
                    placeholder="Краткий ход решения или критерии"
                  />
                </div>
              </div>

              <Button type="submit" variant="primary" disabled={isPending}>
                + Добавить задание в базу
              </Button>
            </form>
          </Card>

          {/* СПИСОК И ФИЛЬТРАЦИЯ ЗАДАНИЙ В БАНКЕ */}
          <Card padding="md" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <h3
                  className={`text-sm font-black uppercase tracking-wider flex items-center gap-2 ${
                    isLight ? "text-slate-800" : "text-slate-200"
                  }`}
                >
                  <BookOpen className={`h-4 w-4 ${isLight ? "text-sky-600" : "text-sky-400"}`} />
                  Все задания в банке ({filteredTasks.length} из {tasks.length})
                </h3>

                {pageCount > 1 && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => goToPage(safePage - 1)}
                      disabled={safePage === 0}
                      aria-label="Предыдущая страница заданий"
                      title="Предыдущая страница"
                      className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                        isLight
                          ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                          : "border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span
                      className={`min-w-[46px] text-center text-[11px] font-mono font-bold tabular-nums ${
                        isLight ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      {safePage + 1}/{pageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => goToPage(safePage + 1)}
                      disabled={safePage >= pageCount - 1}
                      aria-label="Следующая страница заданий"
                      title="Следующая страница"
                      className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                        isLight
                          ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                          : "border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="w-full sm:w-72">
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по условию..."
                  icon={<Search className="h-4 w-4" />}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollChips(-1)}
                disabled={!chipsScroll.canScroll || !chipsScroll.left}
                aria-label="Прокрутить фильтры влево"
                title="Прокрутить влево"
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  isLight
                    ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                    : "border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-700"
                }`}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div
                ref={chipsScrollRef}
                onScroll={updateChipsScroll}
                className="flex flex-1 min-w-0 items-center gap-1.5 overflow-x-auto no-scrollbar py-1 scroll-smooth"
              >
                <Button
                  variant={selectedTaskNumberFilter === "ALL" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setSelectedTaskNumberFilter("ALL")}
                >
                  Все типы ({tasks.length})
                </Button>
                {Array.from({ length: 19 }, (_, i) => i + 1).map((n) => {
                  const count = tasksCountByNumber[n] || 0;
                  const isActive = selectedTaskNumberFilter === n;
                  return (
                    <Button
                      key={n}
                      variant={isActive ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => setSelectedTaskNumberFilter(n)}
                    >
                      <span>№{n}</span>
                      <span className="text-[10px] opacity-75">({count})</span>
                    </Button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => scrollChips(1)}
                disabled={!chipsScroll.canScroll || !chipsScroll.right}
                aria-label="Прокрутить фильтры вправо"
                title="Прокрутить вправо"
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  isLight
                    ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                    : "border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-700"
                }`}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div ref={listTopRef} className="scroll-mt-24" />

            <div className="space-y-3 pt-2">
              {filteredTasks.length === 0 ? (
                <div className={`text-center py-10 text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                  Заданий по выбранным фильтрам не найдено.
                </div>
              ) : (
                pageTasks.map((t) => {
                  const showAnswer = visibleAnswers[t.id];
                  const isPart2 = t.taskNumber >= 13;

                  return (
                    <div
                      key={t.id}
                      className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 space-y-2.5 ${
                        isLight
                          ? "bg-slate-50/70 border-slate-200/90 hover:border-slate-300"
                          : "bg-slate-800/40 border-slate-700/80 hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center flex-wrap gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-black border ${
                              isPart2
                                ? isLight
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                : isLight
                                ? "bg-sky-50 text-sky-700 border-sky-200"
                                : "bg-sky-500/20 text-sky-300 border-sky-500/40"
                            }`}
                          >
                            Задание №{t.taskNumber}
                          </span>
                          <span className={`text-xs font-bold ${isLight ? "text-slate-800" : "text-slate-100"}`}>
                            {t.topic}
                          </span>
                          {t.taskCode && (
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold border ${
                                isLight
                                  ? "bg-white text-slate-600 border-slate-200"
                                  : "bg-sky-500/10 text-sky-300 border-sky-500/30"
                              }`}
                            >
                              Прототип #{t.taskCode}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {t.answer && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => toggleAnswer(t.id)}
                            >
                              {showAnswer ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              <span>{showAnswer ? "Скрыть ответ" : "Показать ответ"}</span>
                            </Button>
                          )}
                          <Button
                            variant="danger"
                            size="icon"
                            onClick={() => handleDeleteTask(t.id)}
                            title="Удалить задание"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="w-full">
                        {(() => {
                          const pdfMeta = resolvePdfTaskMeta(t);
                          if (pdfMeta.pdfPage) {
                            return (
                              <PdfTaskCrop
                                pdfPage={pdfMeta.pdfPage}
                                taskCode={pdfMeta.taskCode}
                                taskNumber={t.taskNumber}
                                fallbackText={t.content}
                                className="w-full"
                              />
                            );
                          }
                          return (
                            <MathText
                              text={t.content}
                              className={`text-xs sm:text-sm ${isLight ? "text-slate-800" : "text-slate-200"}`}
                            />
                          );
                        })()}
                      </div>

                      {showAnswer && t.answer && (
                        <div
                          className={`p-3 rounded-xl border text-xs space-y-1 ${
                            isLight
                              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                              : "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                          }`}
                        >
                          <p className="font-bold">
                            Ответ: <span className="font-mono text-sm ml-1">{t.answer}</span>
                          </p>
                          {t.solution && (
                            <p className={`text-[11px] mt-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                              Решение: {t.solution}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              {filteredTasks.length > PAGE_SIZE && (
                <div
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 mt-2 ${
                    isLight ? "border-slate-200 bg-slate-50/70" : "border-slate-700/70 bg-slate-800/40"
                  }`}
                >
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => goToPage(safePage - 1)}
                    disabled={safePage === 0}
                    aria-label="Предыдущая страница заданий"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Назад</span>
                  </Button>

                  <span className={`text-[11px] font-semibold ${isLight ? "text-slate-600" : "text-slate-300"}`}>
                    Страница {safePage + 1} из {pageCount}
                    <span className={`ml-1.5 font-normal ${isLight ? "text-slate-400" : "text-slate-500"}`}>
                      · {pageTasks.length} из {filteredTasks.length}
                    </span>
                  </span>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => goToPage(safePage + 1)}
                    disabled={safePage >= pageCount - 1}
                    aria-label="Следующая страница заданий"
                  >
                    <span>Вперёд</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ===================== ВКЛАДКА 3: ИСТОРИЯ ВЫДАННЫХ РАБОТ ===================== */}
      {activeSubTab === "history" && (
        <Card padding="md" className="space-y-4">
          <h3
            className={`text-sm font-black uppercase tracking-wider flex items-center gap-2 ${
              isLight ? "text-slate-800" : "text-slate-200"
            }`}
          >
            <Clock className={`h-4 w-4 ${isLight ? "text-sky-600" : "text-sky-400"}`} />
            Выданные тренировочные работы ЕГЭ ({assignments.length})
          </h3>

          {assignments.length === 0 ? (
            <div className={`text-center py-10 text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}>
              Вы еще не выдавали работ из банка ЕГЭ. Перейдите во вкладку «Конструктор выдачи», чтобы создать первую работу.
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map((a) => (
                <div
                  key={a.id}
                  className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-200 ${
                    isLight
                      ? "bg-slate-50/70 border-slate-200 hover:border-slate-300"
                      : "bg-slate-800/40 border-slate-700/80 hover:border-slate-600"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-slate-100"}`}>
                        {a.title}
                      </span>
                      {a.studentName ? (
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${
                            isLight
                              ? "bg-sky-50 text-sky-700 border-sky-200"
                              : "bg-sky-500/20 text-sky-300 border-sky-500/30"
                          }`}
                        >
                          {a.studentName}
                        </span>
                      ) : (
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${
                            isLight
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-purple-500/20 text-purple-300 border-purple-500/30"
                          }`}
                        >
                          Всему классу
                        </span>
                      )}
                    </div>

                    <div className={`flex items-center flex-wrap gap-3 text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                      <span>
                        Заданий в работе: <b className={isLight ? "text-slate-800" : "text-slate-200"}>{a.itemsCount}</b>
                      </span>
                      <span>
                        Выполнено: <b className={isLight ? "text-emerald-600" : "text-emerald-400"}>{a.completedCount}</b>
                      </span>
                      {a.deadline && (
                        <span>
                          Срок: <b className={isLight ? "text-amber-600" : "text-amber-400"}>{a.deadline}</b>
                        </span>
                      )}
                    </div>

                    {a.teacherComment && (
                      <p className={`text-[11px] italic mt-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                        «{a.teacherComment}»
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="danger"
                      size="icon"
                      onClick={() => handleDeleteAssignment(a.id)}
                      title="Удалить работу"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
