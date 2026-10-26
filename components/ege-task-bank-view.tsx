"use client";

import React, { useState, useMemo, useTransition, useRef, useEffect } from "react";
import { useAppTheme } from "./theme-context";
import {
  BookOpen,
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  Layers,
  Sparkles,
  Filter,
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
  ChevronDown,
  Send,
  Check,
  X,
  RefreshCw,
  HelpCircle,
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
import { resolvePdfTaskMeta } from "@/lib/ege-math-cleaner";

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

/**
 * Custom glassmorphism select dropdown
 */
function CustomSelect<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = "Выберите...",
  className = "",
  icon,
}: {
  value: T;
  onChange: (val: T) => void;
  options: { value: T; label: string; badge?: string; sublabel?: string }[];
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const selectedOpt = options.find((o) => o.value === value);

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full h-10 px-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-cyan-500/30 hover:border-cyan-400/60 focus:border-cyan-400 text-xs text-zinc-100 flex items-center justify-between gap-2 shadow-sm backdrop-blur-xl transition-all cursor-pointer group outline-none"
      >
        <div className="flex items-center gap-2 truncate">
          {icon && <span className="text-cyan-400 shrink-0">{icon}</span>}
          <span className="truncate font-semibold">{selectedOpt ? selectedOpt.label : placeholder}</span>
          {selectedOpt?.badge && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {selectedOpt.badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-cyan-400/80 transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180 text-cyan-300" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl bg-slate-950/95 backdrop-blur-2xl border border-cyan-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.8)] p-1.5 max-h-60 overflow-y-auto scrollbar-thin animate-in fade-in zoom-in-95 duration-150">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={String(opt.value)}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                  isSelected
                    ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30"
                    : "text-zinc-300 hover:bg-cyan-500/10 hover:text-cyan-200"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="truncate">{opt.label}</span>
                  {opt.sublabel && <span className="text-[10px] text-zinc-500">({opt.sublabel})</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {opt.badge && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-white/5 text-zinc-400 border border-white/10">
                      {opt.badge}
                    </span>
                  )}
                  {isSelected && <Check className="h-3.5 w-3.5 text-cyan-400" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function EgeTaskBankView({
  tasks = [],
  assignments = [],
  students = [],
  classes = [],
}: EgeTaskBankViewProps) {
  const { theme } = useAppTheme();
  const isPlanet = theme === "planet";
  const isGarden = theme === "garden";

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

  // Auto-hide toast after 4s
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (type: "success" | "error" | "info", message: string) => {
    setToast({ type, message });
  };

  // Count available tasks in bank by number
  const tasksCountByNumber = useMemo(() => {
    const map: Record<number, number> = {};
    for (let i = 1; i <= 19; i++) map[i] = 0;
    tasks.forEach((t) => {
      map[t.taskNumber] = (map[t.taskNumber] || 0) + 1;
    });
    return map;
  }, [tasks]);

  // Filtered tasks for bank list
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

  // Total selected tasks in constructor
  const totalTasksSelected = useMemo(() => {
    return Object.values(taskCounts).reduce((acc, c) => acc + (c || 0), 0);
  }, [taskCounts]);

  // Target recipients preview in constructor
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

  // Preset handlers for constructor
  const applyPreset = (preset: "part1" | "geometry" | "algebra" | "part2" | "clear") => {
    const next: Record<number, number> = {};
    for (let i = 1; i <= 19; i++) next[i] = 0;

    if (preset === "part1") {
      for (let i = 1; i <= 12; i++) next[i] = 1;
      setWorkTitle("Пробный вариант ЕГЭ: Часть 1 (№1–12)");
      showToast("info", "Применен шаблон: Вся 1-я часть (№1–12 по 1 задаче)");
    } else if (preset === "geometry") {
      next[1] = 2; // планиметрия
      next[3] = 2; // стереометрия
      next[14] = 1; // стереометрия часть 2
      next[17] = 1; // планиметрия часть 2
      setWorkTitle("Тематическая работа: Геометрия ЕГЭ (№1, 3, 14, 17)");
      showToast("info", "Применен шаблон: Геометрия");
    } else if (preset === "algebra") {
      next[6] = 2; // уравнения
      next[7] = 2; // вычисления
      next[12] = 2; // экстремумы
      next[13] = 1; // уравнения с отбором
      next[15] = 1; // неравенства
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

  // Submit constructor assignment
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

  // Handle manual task creation
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

  // Synchronize from local PDF
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

  // Handle PDF file upload
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

  // Reseed default bank
  const handleReseed = () => {
    setConfirmModal({
      isOpen: true,
      title: "Восстановление эталонного банка ФИПИ",
      message: "Загрузить стандартный эталонный банк задач ФИПИ со всеми 19 номерами заданий?",
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

  // Delete task
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

  // Delete assignment
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
            className={`p-4 rounded-2xl shadow-2xl backdrop-blur-2xl border flex items-start gap-3 ${
              toast.type === "success"
                ? "bg-slate-950/90 border-emerald-500/40 text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.25)]"
                : toast.type === "error"
                ? "bg-slate-950/90 border-rose-500/40 text-rose-300 shadow-[0_0_25px_rgba(244,63,94,0.25)]"
                : "bg-slate-950/90 border-cyan-500/40 text-cyan-300 shadow-[0_0_25px_rgba(56,189,248,0.25)]"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : toast.type === "error" ? (
              <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <Sparkles className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs font-semibold leading-relaxed text-zinc-100">{toast.message}</div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* КАСТОМНОЕ МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ (CONFIRM) */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 shadow-2xl border border-cyan-500/30 bg-[#0C121D]/95 backdrop-blur-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-cyan-300 font-black text-sm">
              <AlertCircle className="h-5 w-5 text-cyan-400" />
              <span>{confirmModal.title}</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">{confirmModal.message}</p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 transition"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-zinc-950 shadow-lg shadow-cyan-500/20 transition cursor-pointer"
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ВЕРХНЯЯ ШАПКА РАЗДЕЛА */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-xs">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-zinc-100 flex items-center gap-2">
                Банк заданий ЕГЭ (Профиль)
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-xs">
                  {tasks.length} заданий в базе
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Конструктор выдачи вариантов, открытый банк ФИПИ и управление базой задач
              </p>
            </div>
          </div>
        </div>

        {/* НАВИГАЦИОННЫЙ ПЕРЕКЛЮЧАТЕЛЬ ПОДВКЛАДОК */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/5 backdrop-blur-md self-start md:self-auto">
          {[
            { id: "constructor", label: "Конструктор выдачи", icon: Sparkles },
            { id: "bank", label: "Банк задач", icon: BookOpen },
            { id: "history", label: `Выданные работы (${assignments.length})`, icon: Clock },
          ].map((tab) => {
            const isActive = activeSubTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  isActive
                    ? isPlanet
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shadow-xs"
                      : isGarden
                      ? "bg-[#FEC868]/20 text-[#FEC868] border border-[#FEC868]/30 shadow-xs"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================== ВКЛАДКА 1: КОНСТРУКТОР ВЫДАЧИ ЗАДАНИЙ ===================== */}
      {activeSubTab === "constructor" && (
        <div className="space-y-6">
          {/* СЕКЦИЯ 1: ПАРАМЕТРЫ РАБОТЫ И ВЫБОР ПОЛУЧАТЕЛЕЙ */}
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-400" />
              1. Кому и как выдать работу
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Формат выдачи */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Формат выдачи:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetType("class")}
                    className={`h-10 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                      targetType === "class"
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-xs"
                        : "bg-slate-900/60 text-zinc-400 border-white/5 hover:bg-white/5"
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Целому классу</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType("student")}
                    className={`h-10 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                      targetType === "student"
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-xs"
                        : "bg-slate-900/60 text-zinc-400 border-white/5 hover:bg-white/5"
                    }`}
                  >
                    <User className="h-3.5 w-3.5" />
                    <span>Ученику</span>
                  </button>
                </div>
              </div>

              {/* КАСТОМНЫЕ ВЫПАДАЮЩИЕ СПИСКИ */}
              {targetType === "class" ? (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Выберите класс:</label>
                    <CustomSelect
                      value={selectedClassId}
                      onChange={(val) => setSelectedClassId(String(val))}
                      options={classes.map((c) => ({
                        value: c.id,
                        label: `${c.name} (${c.grade} класс)`,
                        badge: `${c.grade} кл.`,
                      }))}
                      placeholder="Выберите класс"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">По профилю ЕГЭ (11 класс):</label>
                    <CustomSelect
                      value={selectedTrackFilter}
                      onChange={(val) => setSelectedTrackFilter(val as any)}
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
                  <label className="text-xs font-semibold text-zinc-400">Выберите конкретного ученика:</label>
                  <CustomSelect
                    value={selectedStudentId}
                    onChange={(val) => setSelectedStudentId(String(val))}
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

            {/* Название работы и дедлайн */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-white/5">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Название тренировочной работы:</label>
                <input
                  type="text"
                  value={workTitle}
                  onChange={(e) => setWorkTitle(e.target.value)}
                  placeholder="Например: Тренировочная работа №1 по планиметрии и уравнениям"
                  className="w-full h-10 rounded-xl bg-slate-900/80 border border-cyan-500/30 px-3.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-400 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-cyan-400" />
                  Срок сдачи (дедлайн):
                </label>
                <input
                  type="date"
                  value={workDeadline}
                  onChange={(e) => setWorkDeadline(e.target.value)}
                  className="w-full h-10 rounded-xl bg-slate-900/80 border border-cyan-500/30 px-3.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-400 transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Комментарий / инструкция учителя (опционально):</label>
              <input
                type="text"
                value={teacherComment}
                onChange={(e) => setTeacherComment(e.target.value)}
                placeholder="Например: Задания 1-12 проверяются автоматически, ход решений запишите в тетрадь"
                className="w-full h-10 rounded-xl bg-slate-900/80 border border-cyan-500/30 px-3.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-400 transition"
              />
            </div>
          </div>

          {/* СЕКЦИЯ 2: БЫСТРЫЕ ШАБЛОНЫ И МАТРИЦА ЗАДАНИЙ 1-19 */}
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-cyan-400" />
                  2. Выберите количество заданий по номерам ЕГЭ (1–19)
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Укажите, сколько задач каждого типа нужно автоматически подобрать и прикрепить
                </p>
              </div>

              {/* Кнопки пресетов */}
              <div className="flex items-center flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyPreset("part1")}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition cursor-pointer"
                >
                  ⚡ Вся Часть 1 (№1–12)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("geometry")}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition cursor-pointer"
                >
                  📐 Геометрия
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("algebra")}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 transition cursor-pointer"
                >
                  ∑ Алгебра
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("part2")}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition cursor-pointer"
                >
                  🔥 Часть 2 (№13–19)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("clear")}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 transition cursor-pointer"
                >
                  Сброс
                </button>
              </div>
            </div>

            {/* МАТРИЦА КАРТОЧЕК 1..19 С УЛУЧШЕННОЙ ЧИТАЕМОСТЬЮ */}
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
                    className={`p-3.5 rounded-2xl border transition-all h-full flex flex-col justify-between ${
                      isSelected
                        ? "bg-cyan-950/30 border-cyan-400/50 shadow-[0_0_15px_rgba(56,189,248,0.15)] ring-1 ring-cyan-500/40"
                        : "bg-slate-900/60 border-white/10 hover:border-cyan-500/30"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`flex items-center justify-center w-8 h-8 rounded-xl text-xs font-black shrink-0 ${
                            isPart2
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          }`}
                        >
                          №{num}
                        </span>

                        {/* Бейдж наличия в банке с контрастными цветами */}
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${
                            inBank > 0
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                          }`}
                        >
                          {inBank > 0 ? `В банке: ${inBank} шт.` : "0 в банке"}
                        </span>
                      </div>

                      {/* Полное название темы без обрезки в 1 строку */}
                      <p
                        className="mt-2 text-xs font-bold text-zinc-100 line-clamp-2 min-h-[2.5rem] leading-snug"
                        title={meta.topic}
                      >
                        {meta.topic}
                      </p>
                    </div>

                    {/* СЧЕТЧИК ЗАДАНИЙ */}
                    <div className="mt-3 flex items-center justify-between gap-2 pt-2.5 border-t border-white/5">
                      <span className="text-[11px] font-medium text-zinc-400">Выдать в работу:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCountChange(num, -1)}
                          disabled={count <= 0}
                          className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-500/40 hover:text-cyan-300 active:scale-90 flex items-center justify-center text-xs font-bold text-zinc-300 transition cursor-pointer disabled:opacity-25 disabled:pointer-events-none"
                        >
                          -
                        </button>
                        <span
                          className={`w-7 text-center text-xs font-black ${
                            count > 0 ? "text-cyan-300 scale-105" : "text-zinc-500"
                          }`}
                        >
                          {count}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCountChange(num, 1)}
                          className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-500/40 hover:text-cyan-300 active:scale-90 flex items-center justify-center text-xs font-bold text-zinc-300 transition cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ИТОГОВАЯ ПАНЕЛЬ И КНОПКА ВЫДАЧИ */}
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-blue-950/20 to-black/40 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  <p className="text-xs font-bold text-zinc-200">
                    Итого выбрано: <span className="text-cyan-300 font-black text-sm">{totalTasksSelected} заданий</span>
                  </p>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Получатели: <span className="text-zinc-200 font-medium">{recipientSummary}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={handleCreateAssignment}
                disabled={isPending || totalTasksSelected === 0}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm text-zinc-950 bg-gradient-to-r from-cyan-400 to-sky-400 hover:brightness-110 active:scale-95 disabled:opacity-40 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
              >
                <Send className="h-4 w-4" />
                <span>{isPending ? "Формирование варианта..." : "Сформировать и выдать работу"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== ВКЛАДКА 2: УПРАВЛЕНИЕ БАНКОМ ЗАДАЧ И ИМПОРТ PDF ===================== */}
      {activeSubTab === "bank" && (
        <div className="space-y-6">
          {/* БАННЕР СИНХРОНИЗАЦИИ И ИМПОРТА */}
          <div className="glass-panel p-5 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Кнопка 1: Синхронизация из локального PDF ФИПИ */}
            <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 space-y-2.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                  <FileText className="h-4 w-4 text-cyan-400" />
                  <span>Локальный PDF ФИПИ в корне</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed mt-1">
                  Файл «Открытый банк задач ФИПИ. ЕГЭ по профильной математике.pdf» (611 стр.) уже доступен в проекте.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSyncFromLocalPdf}
                disabled={syncingLocalPdf || isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 text-zinc-950 font-black text-xs hover:brightness-110 shadow-md shadow-cyan-500/20 transition cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncingLocalPdf ? "animate-spin" : ""}`} />
                <span>{syncingLocalPdf ? "Синхронизация..." : "Синхронизировать из локального PDF"}</span>
              </button>
            </div>

            {/* Кнопка 2: Загрузка стороннего PDF */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-white/10 space-y-2.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-zinc-200 font-bold text-xs">
                  <Upload className="h-4 w-4 text-cyan-400" />
                  <span>Загрузить другой PDF-файл</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed mt-1">
                  Загрузите любой другой сборник задач в формате PDF для распознавания формулировок и ответов.
                </p>
              </div>

              <label className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 font-bold text-xs border border-white/10 transition cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                <span>{uploadingPdf ? "Обработка..." : "Выбрать и распарсить PDF"}</span>
                <input type="file" accept=".pdf" onChange={handlePdfUpload} disabled={uploadingPdf} className="hidden" />
              </label>
            </div>

            {/* Кнопка 3: Эталонный банк ФИПИ */}
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-2.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                  <RotateCcw className="h-4 w-4 text-emerald-400" />
                  <span>Эталонный банк ФИПИ</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed mt-1">
                  Быстро дополнить банк эталонными заданиями по всем 19 номерам с подробными решениями.
                </p>
              </div>

              <button
                type="button"
                onClick={handleReseed}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold text-xs transition cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Загрузить эталонный банк</span>
              </button>
            </div>
          </div>

          {/* ФОРМА РУЧНОГО ДОБАВЛЕНИЯ ЗАДАНИЯ В БАНК */}
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Plus className="h-4 w-4 text-cyan-400" />
              Добавить новое задание вручную
            </h3>

            <form onSubmit={handleCreateTask} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Номер задания ЕГЭ - Кастомный селект */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Номер задания ЕГЭ:</label>
                  <CustomSelect
                    value={newTaskNumber}
                    onChange={(val) => {
                      const num = Number(val);
                      setNewTaskNumber(num);
                      const meta = EGE_TASK_TOPICS[num];
                      if (meta) {
                        setNewTaskTopic(meta.topic);
                        setNewTaskDifficulty(meta.difficulty);
                      }
                    }}
                    options={Array.from({ length: 19 }, (_, i) => i + 1).map((n) => ({
                      value: n,
                      label: `№${n} — ${EGE_TASK_TOPICS[n]?.topic || ""}`,
                      badge: `№${n}`,
                    }))}
                  />
                </div>

                {/* Тема */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Тема (подраздел):</label>
                  <input
                    type="text"
                    value={newTaskTopic}
                    onChange={(e) => setNewTaskTopic(e.target.value)}
                    placeholder="Например: Векторы на координатной плоскости"
                    className="w-full h-10 rounded-xl bg-slate-900/80 border border-cyan-500/30 px-3.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-400 transition"
                  />
                </div>

                {/* Уровень сложности - Кастомный селект */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Сложность:</label>
                  <CustomSelect
                    value={newTaskDifficulty}
                    onChange={(val) => setNewTaskDifficulty(String(val))}
                    options={[
                      { value: "BASE", label: "Базовый (Часть 1)", badge: "1 балл" },
                      { value: "ADVANCED", label: "Повышенный (Часть 2)", badge: "2-3 балла" },
                      { value: "HIGH", label: "Высокий (Олимпиадный)", badge: "4 балла" },
                    ]}
                  />
                </div>
              </div>

              {/* Название */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Краткий заголовок задания:</label>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Например: Скалярное произведение векторов при заданных координатах"
                  className="w-full h-10 rounded-xl bg-slate-900/80 border border-cyan-500/30 px-3.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-400 transition"
                  required
                />
              </div>

              {/* Условие задачи */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Текст и условие задачи:</label>
                <textarea
                  rows={4}
                  value={newTaskContent}
                  onChange={(e) => setNewTaskContent(e.target.value)}
                  placeholder="Введите полное условие задачи, формулы, числовые данные..."
                  className="w-full rounded-xl bg-slate-900/80 border border-cyan-500/30 p-3.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-400 transition font-sans"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Ответ */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Правильный ответ (для автопроверки):</label>
                  <input
                    type="text"
                    value={newTaskAnswer}
                    onChange={(e) => setNewTaskAnswer(e.target.value)}
                    placeholder="Например: 12 или 0.75"
                    className="w-full h-10 rounded-xl bg-slate-900/80 border border-cyan-500/30 px-3.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-400 transition"
                  />
                </div>

                {/* Решение */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Пояснение / решение (опционально):</label>
                  <input
                    type="text"
                    value={newTaskSolution}
                    onChange={(e) => setNewTaskSolution(e.target.value)}
                    placeholder="Краткий ход решения или критерии"
                    className="w-full h-10 rounded-xl bg-slate-900/80 border border-cyan-500/30 px-3.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-400 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 text-zinc-950 font-black text-xs hover:bg-cyan-400 shadow-md shadow-cyan-500/20 transition cursor-pointer"
              >
                + Добавить задание в базу
              </button>
            </form>
          </div>

          {/* СПИСОК И ФИЛЬТРАЦИЯ ЗАДАНИЙ В БАНКЕ */}
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-cyan-400" />
                Все задания в банке ({filteredTasks.length} из {tasks.length})
              </h3>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-3 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск по условию..."
                    className="h-9 pl-9 pr-3 rounded-xl bg-slate-900/80 border border-cyan-500/30 text-xs text-zinc-100 focus:outline-none focus:border-cyan-400 w-48 sm:w-64 transition"
                  />
                </div>
              </div>
            </div>

            {/* ФИЛЬТРЫ ПО НОМЕРАМ 1..19 */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
              <button
                type="button"
                onClick={() => setSelectedTaskNumberFilter("ALL")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 border transition cursor-pointer ${
                  selectedTaskNumberFilter === "ALL"
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/50 shadow-xs"
                    : "bg-slate-900/60 text-zinc-400 border-white/5 hover:bg-white/5"
                }`}
              >
                Все типы ({tasks.length})
              </button>
              {Array.from({ length: 19 }, (_, i) => i + 1).map((n) => {
                const count = tasksCountByNumber[n] || 0;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSelectedTaskNumberFilter(n)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold shrink-0 border flex items-center gap-1.5 transition cursor-pointer ${
                      selectedTaskNumberFilter === n
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/50 shadow-xs"
                        : "bg-slate-900/60 text-zinc-400 border-white/5 hover:bg-white/5"
                    }`}
                  >
                    <span>№{n}</span>
                    <span className="text-[10px] opacity-75">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* СПИСОК КАРТОЧЕК */}
            <div className="space-y-3 pt-2">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs">
                  Заданий по выбранным фильтрам не найдено.
                </div>
              ) : (
                filteredTasks.slice(0, 50).map((t) => {
                  const showAnswer = visibleAnswers[t.id];
                  const isPart2 = t.taskNumber >= 13;

                  return (
                    <div
                      key={t.id}
                      className="p-4 rounded-2xl bg-slate-900/70 border border-white/5 hover:border-cyan-500/30 transition-all space-y-2.5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center flex-wrap gap-2.5">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-black shadow-sm ${
                              isPart2
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                            }`}
                          >
                            Задание №{t.taskNumber}
                          </span>
                          <span className="text-xs font-bold text-zinc-100">{t.topic}</span>
                          {t.taskCode && (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                              Прототип #{t.taskCode}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {t.answer && (
                            <button
                              type="button"
                              onClick={() => toggleAnswer(t.id)}
                              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white/5 text-zinc-300 hover:text-white border border-white/10 flex items-center gap-1 transition cursor-pointer"
                            >
                              {showAnswer ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              <span>{showAnswer ? "Скрыть ответ" : "Показать ответ"}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteTask(t.id)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                            title="Удалить задание"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Условие задания с KaTeX рендером формул и оригинальным чертежом из PDF при наличии */}
                      <div className="flex flex-col lg:flex-row gap-4 items-start justify-between py-1">
                        <div className="flex-1 min-w-0">
                          <MathText text={t.content} className="text-xs sm:text-sm text-zinc-200" />
                        </div>
                        {(() => {
                          const pdfMeta = resolvePdfTaskMeta(t);
                          if (!pdfMeta.hasDrawing || !pdfMeta.pdfPage) return null;
                          return (
                            <div className="shrink-0 w-full sm:w-[280px] lg:w-[320px]">
                              <PdfTaskCrop
                                pdfPage={pdfMeta.pdfPage}
                                taskCode={pdfMeta.taskCode}
                                taskNumber={t.taskNumber}
                              />
                            </div>
                          );
                        })()}
                      </div>

                      {/* Блок с ответом */}
                      {showAnswer && t.answer && (
                        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs space-y-1">
                          <p className="text-emerald-300 font-bold">
                            Ответ: <span className="font-mono text-white text-sm ml-1">{t.answer}</span>
                          </p>
                          {t.solution && <p className="text-[11px] text-zinc-400 mt-1">Решение: {t.solution}</p>}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              {filteredTasks.length > 50 && (
                <p className="text-center text-[11px] text-zinc-500 pt-2">
                  Показано 50 из {filteredTasks.length} заданий. Используйте фильтр по номеру для точного выбора.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== ВКЛАДКА 3: ИСТОРИЯ ВЫДАННЫХ РАБОТ ===================== */}
      {activeSubTab === "history" && (
        <div className="glass-panel p-5 rounded-2xl space-y-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-400" />
            Выданные тренировочные работы ЕГЭ ({assignments.length})
          </h3>

          {assignments.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-xs">
              Вы еще не выдавали работ из банка ЕГЭ. Перейдите во вкладку «Конструктор выдачи», чтобы создать первую работу.
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map((a) => (
                <div
                  key={a.id}
                  className="p-4 rounded-2xl bg-slate-900/70 border border-white/10 hover:border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-sm font-bold text-zinc-100">{a.title}</span>
                      {a.studentName ? (
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {a.studentName}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          Всему классу
                        </span>
                      )}
                    </div>

                    <div className="flex items-center flex-wrap gap-3 text-xs text-zinc-400">
                      <span>Заданий в работе: <b className="text-zinc-200">{a.itemsCount}</b></span>
                      <span>Выполнено: <b className="text-emerald-400">{a.completedCount}</b></span>
                      {a.deadline && <span>Срок: <b className="text-amber-400">{a.deadline}</b></span>}
                    </div>

                    {a.teacherComment && (
                      <p className="text-[11px] text-zinc-400 italic mt-0.5">«{a.teacherComment}»</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDeleteAssignment(a.id)}
                      className="p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                      title="Удалить работу"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
