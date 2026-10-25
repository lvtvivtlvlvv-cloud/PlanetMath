"use client";

import React, { useState, useMemo, useTransition } from "react";
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
  ChevronRight,
  Send,
} from "lucide-react";
import {
  createEgeTaskAction,
  deleteEgeTaskAction,
  createEgeAssignmentAction,
  deleteEgeAssignmentAction,
  reseedEgeTasksAction,
} from "@/app/admin/actions";
import { EGE_TASK_TOPICS } from "@/lib/ege-constants";

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
    // Default preset: 1 task of #1, #2, #6
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
  const [formFeedback, setFormFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // PDF upload state
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

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
    } else if (preset === "geometry") {
      next[1] = 2; // планиметрия
      next[3] = 2; // стереометрия
      next[14] = 1; // стереометрия часть 2
      next[17] = 1; // планиметрия часть 2
      setWorkTitle("Тематическая работа: Геометрия ЕГЭ (№1, 3, 14, 17)");
    } else if (preset === "algebra") {
      next[6] = 2; // уравнения
      next[7] = 2; // вычисления
      next[12] = 2; // экстремумы
      next[13] = 1; // уравнения с отбором
      next[15] = 1; // неравенства
      setWorkTitle("Тренировка: Уравнения, функции и неравенства");
    } else if (preset === "part2") {
      for (let i = 13; i <= 19; i++) next[i] = 1;
      setWorkTitle("Сложная часть профильного ЕГЭ (№13–19)");
    } else if (preset === "clear") {
      setWorkTitle("Новая тренировочная работа");
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
      alert("Выберите хотя бы одно задание для включения в работу!");
      return;
    }
    if (!workTitle.trim()) {
      alert("Пожалуйста, укажите название работы!");
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
          alert(`Работа успешно выдана (${res.countAssigned} ученикам)!`);
          setActiveSubTab("history");
        }
      } catch (err: any) {
        alert(err.message || "Ошибка при выдаче работы");
      }
    });
  };

  // Handle manual task creation
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    setFormFeedback(null);

    if (!newTaskTitle.trim() || !newTaskContent.trim()) {
      setFormFeedback({ type: "error", message: "Укажите краткое название и текст задания" });
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

        setFormFeedback({ type: "success", message: `Задание №${newTaskNumber} успешно добавлено в банк!` });
        setNewTaskTitle("");
        setNewTaskContent("");
        setNewTaskAnswer("");
        setNewTaskSolution("");
      } catch (err: any) {
        setFormFeedback({ type: "error", message: err.message || "Не удалось сохранить задание" });
      }
    });
  };

  // Handle PDF file upload
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Пожалуйста, выберите файл в формате .pdf");
      return;
    }

    setUploadingPdf(true);
    setUploadMessage("Обработка и локальный парсинг PDF-файла...");

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

      setUploadMessage(
        `Готово! Обработано страниц: ${data.pages}. Найдено заданий: ${data.totalExtracted} (новых: ${data.added}, обновлено: ${data.updated}).`
      );
      window.location.reload();
    } catch (err: any) {
      setUploadMessage(`Ошибка: ${err.message}`);
    } finally {
      setUploadingPdf(false);
    }
  };

  // Reseed default bank
  const handleReseed = () => {
    if (!confirm("Загрузить стандартный банк заданий ФИПИ (все 19 номеров ЕГЭ)?")) return;
    startTransition(async () => {
      try {
        await reseedEgeTasksAction();
        alert("Стандартный банк ФИПИ успешно загружен!");
        window.location.reload();
      } catch (err: any) {
        alert("Ошибка: " + err.message);
      }
    });
  };

  // Delete task
  const handleDeleteTask = (id: string) => {
    if (!confirm("Удалить это задание из банка?")) return;
    startTransition(async () => {
      try {
        await deleteEgeTaskAction(id);
      } catch (err: any) {
        alert("Ошибка при удалении: " + err.message);
      }
    });
  };

  // Delete assignment
  const handleDeleteAssignment = (id: string) => {
    if (!confirm("Удалить выданную работу?")) return;
    startTransition(async () => {
      try {
        await deleteEgeAssignmentAction(id);
      } catch (err: any) {
        alert("Ошибка при удалении: " + err.message);
      }
    });
  };

  const toggleAnswer = (id: string) => {
    setVisibleAnswers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {/* ВЕРХНЯЯ ШАПКА РАЗДЕЛА */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-zinc-100 flex items-center gap-2">
                Банк заданий ЕГЭ (Профиль)
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
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
              {/* Тип получателя */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Формат выдачи:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetType("class")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                      targetType === "class"
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/40"
                        : "bg-black/20 text-zinc-400 border-white/5 hover:bg-white/5"
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Целому классу</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType("student")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                      targetType === "student"
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/40"
                        : "bg-black/20 text-zinc-400 border-white/5 hover:bg-white/5"
                    }`}
                  >
                    <User className="h-3.5 w-3.5" />
                    <span>Ученику</span>
                  </button>
                </div>
              </div>

              {/* Выбор класса или ученика */}
              {targetType === "class" ? (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Выберите класс:</label>
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="w-full h-9 rounded-xl bg-black/40 border border-white/10 px-3 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id} className="bg-zinc-900 text-zinc-100">
                          {c.name} ({c.grade} класс)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">По профилю ЕГЭ (11 класс):</label>
                    <select
                      value={selectedTrackFilter}
                      onChange={(e) => setSelectedTrackFilter(e.target.value as any)}
                      className="w-full h-9 rounded-xl bg-black/40 border border-white/10 px-3 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="ALL" className="bg-zinc-900 text-zinc-100">Все ученики класса</option>
                      <option value="Профиль" className="bg-zinc-900 text-zinc-100">Только «Профиль»</option>
                      <option value="База" className="bg-zinc-900 text-zinc-100">Только «База»</option>
                    </select>
                  </div>
                </>
              ) : (
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Выберите конкретного ученика:</label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full h-9 rounded-xl bg-black/40 border border-white/10 px-3 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                  >
                    {students.map((st) => (
                      <option key={st.id} value={st.id} className="bg-zinc-900 text-zinc-100">
                        {st.fullName} — {st.className} {st.examTrack ? `(${st.examTrack})` : ""}
                      </option>
                    ))}
                  </select>
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
                  className="w-full h-9 rounded-xl bg-black/40 border border-white/10 px-3 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
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
                  className="w-full h-9 rounded-xl bg-black/40 border border-white/10 px-3 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
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
                className="w-full h-9 rounded-xl bg-black/40 border border-white/10 px-3 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
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
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 hover:bg-cyan-500/20 transition"
                >
                  ⚡ Вся Часть 1 (№1–12)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("geometry")}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 transition"
                >
                  📐 Геометрия
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("algebra")}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 transition"
                >
                  ∑ Алгебра
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("part2")}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 transition"
                >
                  🔥 Часть 2 (№13–19)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("clear")}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20 transition"
                >
                  Сброс
                </button>
              </div>
            </div>

            {/* МАТРИЦА КАРТОЧЕК 1..19 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 pt-2">
              {Array.from({ length: 19 }, (_, i) => i + 1).map((num) => {
                const count = taskCounts[num] || 0;
                const inBank = tasksCountByNumber[num] || 0;
                const meta = EGE_TASK_TOPICS[num] || { topic: `Задание №${num}`, difficulty: "BASE" };
                const isSelected = count > 0;
                const isPart2 = num >= 13;

                return (
                  <div
                    key={num}
                    className={`p-3 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-cyan-500/10 border-cyan-500/40 shadow-xs"
                        : "bg-black/20 border-white/5 hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black shrink-0 ${
                            isPart2
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                          }`}
                        >
                          №{num}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-zinc-200 line-clamp-1">{meta.topic}</p>
                          <p className="text-[10px] text-zinc-400">
                            В банке:{" "}
                            <span className={inBank > 0 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                              {inBank} шт.
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* СЧЕТЧИК ЗАДАНИЙ */}
                    <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                      <span className="text-[11px] text-zinc-400">Выдать:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCountChange(num, -1)}
                          disabled={count <= 0}
                          className="w-6 h-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-xs text-zinc-300 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5"
                        >
                          -
                        </button>
                        <span
                          className={`w-7 text-center text-xs font-black ${
                            count > 0 ? "text-cyan-300" : "text-zinc-500"
                          }`}
                        >
                          {count}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCountChange(num, 1)}
                          className="w-6 h-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-xs text-zinc-300 hover:bg-white/10"
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
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-blue-950/20 to-black/40 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  <p className="text-xs font-bold text-zinc-200">
                    Итого выбрано: <span className="text-cyan-300 font-black text-sm">{totalTasksSelected} заданий</span>
                  </p>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Получатели: <span className="text-zinc-300 font-medium">{recipientSummary}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={handleCreateAssignment}
                disabled={isPending || totalTasksSelected === 0}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm text-zinc-950 bg-gradient-to-r from-cyan-400 to-sky-400 hover:brightness-110 active:scale-95 disabled:opacity-40 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
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
          {/* БАННЕР ИМПОРТА PDF И ПЕРЕЗАГРУЗКИ БАЗЫ */}
          <div className="glass-panel p-5 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Загрузка PDF */}
            <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/20 space-y-2.5">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                <Upload className="h-4 w-4" />
                <span>Импорт заданий из PDF-файла ФИПИ</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Загрузите официальный PDF Открытого банка заданий ФИПИ (или файл `tasks.pdf`). Скрипт автоматически
                распознает тип заданий (№1–19), условия и ответы.
              </p>
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500 text-zinc-950 font-bold text-xs hover:bg-cyan-400 transition cursor-pointer">
                <FileText className="h-3.5 w-3.5" />
                <span>{uploadingPdf ? "Парсинг PDF..." : "Выбрать и распарсить PDF"}</span>
                <input type="file" accept=".pdf" onChange={handlePdfUpload} disabled={uploadingPdf} className="hidden" />
              </label>
              {uploadMessage && (
                <p className="text-[11px] text-cyan-300 bg-cyan-950/40 p-2 rounded-lg border border-cyan-500/20 mt-1">
                  {uploadMessage}
                </p>
              )}
            </div>

            {/* Стандартный банк ФИПИ */}
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-2.5">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                <RotateCcw className="h-4 w-4" />
                <span>Эталонный банк задач ФИПИ (№1–19)</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Восстановите или дополните банк эталонными заданиями профильного ЕГЭ по всем 19 номерам со строгими
                формулировками, решениями и ответами.
              </p>
              <button
                type="button"
                onClick={handleReseed}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs hover:bg-emerald-500/30 transition"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Загрузить эталонный банк ФИПИ</span>
              </button>
            </div>
          </div>

          {/* ФОРМА РУЧНОГО ДОБАВЛЕНИЯ ЗАДАНИЯ В БАНК */}
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Plus className="h-4 w-4 text-cyan-400" />
              Добавить новое задание вручную
            </h3>

            {formFeedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  formFeedback.type === "success"
                    ? "bg-emerald-950/40 text-emerald-300 border border-emerald-500/30"
                    : "bg-rose-950/40 text-rose-300 border border-rose-500/30"
                }`}
              >
                {formFeedback.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <span>{formFeedback.message}</span>
              </div>
            )}

            <form onSubmit={handleCreateTask} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Номер задания ЕГЭ */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400">Номер задания ЕГЭ:</label>
                  <select
                    value={newTaskNumber}
                    onChange={(e) => {
                      const num = Number(e.target.value);
                      setNewTaskNumber(num);
                      const meta = EGE_TASK_TOPICS[num];
                      if (meta) {
                        setNewTaskTopic(meta.topic);
                        setNewTaskDifficulty(meta.difficulty);
                      }
                    }}
                    className="w-full h-9 rounded-xl bg-black/40 border border-white/10 px-3 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                  >
                    {Array.from({ length: 19 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n} className="bg-zinc-900 text-zinc-100">
                        №{n} — {EGE_TASK_TOPICS[n]?.topic || ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Тема */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400">Тема (подраздел):</label>
                  <input
                    type="text"
                    value={newTaskTopic}
                    onChange={(e) => setNewTaskTopic(e.target.value)}
                    placeholder="Например: Векторы на координатной плоскости"
                    className="w-full h-9 rounded-xl bg-black/40 border border-white/10 px-3 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Уровень сложности */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400">Сложность:</label>
                  <select
                    value={newTaskDifficulty}
                    onChange={(e) => setNewTaskDifficulty(e.target.value)}
                    className="w-full h-9 rounded-xl bg-black/40 border border-white/10 px-3 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="BASE" className="bg-zinc-900 text-zinc-100">Базовый (Часть 1)</option>
                    <option value="ADVANCED" className="bg-zinc-900 text-zinc-100">Повышенный (Часть 2)</option>
                    <option value="HIGH" className="bg-zinc-900 text-zinc-100">Высокий (Олимпиадный)</option>
                  </select>
                </div>
              </div>

              {/* Название */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">Краткий заголовок задания:</label>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Например: Скалярное произведение векторов при заданных координатах"
                  className="w-full h-9 rounded-xl bg-black/40 border border-white/10 px-3 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              {/* Условие задачи */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">Текст и условие задачи:</label>
                <textarea
                  rows={4}
                  value={newTaskContent}
                  onChange={(e) => setNewTaskContent(e.target.value)}
                  placeholder="Введите полное условие задачи, формулы, числовые данные..."
                  className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500 font-sans"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Ответ */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400">Правильный ответ (для автопроверки):</label>
                  <input
                    type="text"
                    value={newTaskAnswer}
                    onChange={(e) => setNewTaskAnswer(e.target.value)}
                    placeholder="Например: 12 или 0.75"
                    className="w-full h-9 rounded-xl bg-black/40 border border-white/10 px-3 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Решение */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400">Пояснение / решение (опционально):</label>
                  <input
                    type="text"
                    value={newTaskSolution}
                    onChange={(e) => setNewTaskSolution(e.target.value)}
                    placeholder="Краткий ход решения или критерии"
                    className="w-full h-9 rounded-xl bg-black/40 border border-white/10 px-3 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 rounded-xl bg-cyan-500 text-zinc-950 font-bold text-xs hover:bg-cyan-400 transition cursor-pointer"
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
                  <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск по условию..."
                    className="h-8 pl-8 pr-3 rounded-lg bg-black/30 border border-white/10 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500 w-48 sm:w-64"
                  />
                </div>
              </div>
            </div>

            {/* ФИЛЬТРЫ ПО НОМЕРАМ 1..19 */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
              <button
                type="button"
                onClick={() => setSelectedTaskNumberFilter("ALL")}
                className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 border transition ${
                  selectedTaskNumberFilter === "ALL"
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/40"
                    : "bg-black/20 text-zinc-400 border-white/5 hover:bg-white/5"
                }`}
              >
                Все типы
              </button>
              {Array.from({ length: 19 }, (_, i) => i + 1).map((n) => {
                const count = tasksCountByNumber[n] || 0;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSelectedTaskNumberFilter(n)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 border flex items-center gap-1 transition ${
                      selectedTaskNumberFilter === n
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/40"
                        : "bg-black/20 text-zinc-400 border-white/5 hover:bg-white/5"
                    }`}
                  >
                    <span>№{n}</span>
                    <span className="text-[10px] opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* СПИСОК КАРТОЧЕК */}
            <div className="space-y-3 pt-2">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 text-xs">
                  Заданий по выбранным фильтрам не найдено.
                </div>
              ) : (
                filteredTasks.map((t) => {
                  const showAnswer = visibleAnswers[t.id];
                  const isPart2 = t.taskNumber >= 13;

                  return (
                    <div
                      key={t.id}
                      className="p-4 rounded-xl bg-black/30 border border-white/5 hover:border-white/10 transition-all space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center flex-wrap gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-black ${
                              isPart2
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                            }`}
                          >
                            Задание №{t.taskNumber}
                          </span>
                          <span className="text-xs font-bold text-zinc-300">{t.title}</span>
                          <span className="text-[10px] text-zinc-500">• {t.topic}</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {t.answer && (
                            <button
                              type="button"
                              onClick={() => toggleAnswer(t.id)}
                              className="px-2 py-1 text-[11px] rounded-lg bg-white/5 text-zinc-400 hover:text-zinc-200 border border-white/5 flex items-center gap-1 transition"
                            >
                              {showAnswer ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              <span>{showAnswer ? "Скрыть ответ" : "Показать ответ"}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteTask(t.id)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                            title="Удалить задание"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Текст условия */}
                      <p className="text-xs text-zinc-300 leading-relaxed font-mono whitespace-pre-wrap bg-black/20 p-3 rounded-lg border border-white/5">
                        {t.content}
                      </p>

                      {/* Блок с ответом */}
                      {showAnswer && t.answer && (
                        <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs space-y-1">
                          <p className="text-emerald-300 font-bold">
                            Ответ: <span className="font-mono text-white">{t.answer}</span>
                          </p>
                          {t.solution && <p className="text-[11px] text-zinc-400">Решение: {t.solution}</p>}
                        </div>
                      )}
                    </div>
                  );
                })
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
                  className="p-4 rounded-xl bg-black/30 border border-white/5 hover:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-sm font-bold text-zinc-100">{a.title}</span>
                      {a.studentName ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {a.studentName}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
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
                      <p className="text-[11px] text-zinc-500 italic mt-0.5">«{a.teacherComment}»</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDeleteAssignment(a.id)}
                      className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
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
