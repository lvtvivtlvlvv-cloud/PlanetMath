"use client";

import React, { useState } from "react";
import {
  Plus,
  FileText,
  Trash2,
  Edit2,
  Copy,
  Users,
  PenTool,
  UploadCloud,
  X,
} from "lucide-react";
import { DatePicker } from "./date-picker";
import { AttachmentBadge } from "./attachment-badge";
import { useAppTheme } from "./theme-context";

export interface HomeworkCardItem {
  id: string;
  classId: string;
  className: string;
  subjectName: string;
  title: string;
  description: string;
  targetDate: string; // "2026-09-16"
  submissionsCount: number;
  isOpenForSubmissions?: boolean;
  targetTrack?: string | null;
  attachments?: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize?: number;
    expiresAt?: string;
  }>;
}

interface HomeworkJournalViewProps {
  homeworks: HomeworkCardItem[];
  classes: { id: string; name: string; grade?: number }[];
  selectedClassId: string;
  onSelectClassId: (id: string) => void;
  onOpenCheckingStudio: (homework: HomeworkCardItem) => void;
  onCreateHomework: (data: {
    classId: string;
    subjectName: string;
    targetDate: string;
    title: string;
    description: string;
    targetTrack?: string | null;
    attachments?: any[];
  }) => Promise<void>;
  onDeleteHomework?: (id: string) => Promise<void>;
}

export function HomeworkJournalView({
  homeworks,
  classes,
  selectedClassId,
  onSelectClassId,
  onOpenCheckingStudio,
  onCreateHomework,
  onDeleteHomework,
}: HomeworkJournalViewProps) {
  const { colorMode } = useAppTheme();
  const isLight = colorMode === "light";

  // Current class & 11th grade check
  const currentClass = classes.find((c) => c.id === selectedClassId);
  const is11Class = Boolean(currentClass?.name?.startsWith("11") || currentClass?.grade === 11);

  // Subject filter: "Алгебра", "Геометрия", "Самостоятельные", "Результаты"
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>("Алгебра");
  const [filterTrack, setFilterTrack] = useState<"ALL" | "База" | "Профиль">("ALL");

  // Form state for "Новое ДЗ"
  const [newSubject, setNewSubject] = useState<string>("Алгебра");
  const [newDate, setNewDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [newTopic, setNewTopic] = useState<string>("");
  const [newComment, setNewComment] = useState<string>("");
  const [newTargetTrack, setNewTargetTrack] = useState<"ALL" | "База" | "Профиль">("ALL");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Status for accepting submissions per homework
  const [closedMap, setClosedMap] = useState<{ [hwId: string]: boolean }>({});

  // Filter homeworks by active subject pill and track (if 11th grade)
  const filteredHomeworks = homeworks.filter((hw) => {
    if (is11Class && filterTrack !== "ALL") {
      if (hw.targetTrack && hw.targetTrack !== filterTrack) {
        return false;
      }
    }
    if (selectedSubjectFilter === "Результаты") return true;
    if (selectedSubjectFilter === "Самостоятельные") {
      return (
        hw.title.toLowerCase().includes("самостоят") ||
        hw.description.toLowerCase().includes("самостоят")
      );
    }
    return (
      hw.subjectName.trim().toLowerCase() ===
      selectedSubjectFilter.trim().toLowerCase()
    );
  });

  // Calculate counts for pills
  const algebraCount = homeworks.filter(
    (h) => h.subjectName.toLowerCase() === "алгебра"
  ).length;
  const geomCount = homeworks.filter(
    (h) => h.subjectName.toLowerCase() === "геометрия"
  ).length;
  const samostCount = homeworks.filter(
    (h) =>
      h.title.toLowerCase().includes("самостоят") ||
      h.description.toLowerCase().includes("самостоят")
  ).length;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.trim()) {
      alert("Укажите тему домашнего задания");
      return;
    }

    setIsSubmitting(true);
    try {
      let uploadedAttachments: any[] = [];
      if (selectedFiles.length > 0) {
        const formData = new FormData();
        selectedFiles.forEach((f) => formData.append("files", f));
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (res.ok) {
          const json = await res.json();
          uploadedAttachments = json.files || [];
        }
      }

      await onCreateHomework({
        classId: selectedClassId || classes[0]?.id || "",
        subjectName: newSubject,
        targetDate: newDate,
        title: newTopic,
        description: newComment,
        targetTrack: is11Class ? (newTargetTrack === "ALL" ? null : newTargetTrack) : null,
        attachments: uploadedAttachments,
      });

      setNewTopic("");
      setNewComment("");
      setSelectedFiles([]);
    } catch (err: any) {
      alert(err.message || "Ошибка при добавлении ДЗ");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-sky-600 dark:text-cyan-400">
            Учебный журнал
          </span>
          <h1
            className={`text-2xl sm:text-3xl font-black tracking-tight mt-0.5 ${
              isLight ? "text-slate-900" : "text-white"
            }`}
          >
            {selectedSubjectFilter}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Class Selector */}
          <select
            value={selectedClassId}
            onChange={(e) => onSelectClassId(e.target.value)}
            className={`h-10 rounded-xl border px-3.5 text-xs font-bold shadow-2xs outline-none ${
              isLight
                ? "border-slate-200 bg-white text-slate-800 focus:border-sky-500"
                : "border-zinc-700 bg-zinc-800 text-zinc-100 focus:border-cyan-400"
            }`}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                Класс: {c.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              const formEl = document.getElementById("new-homework-form");
              formEl?.scrollIntoView({ behavior: "smooth" });
            }}
            className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-sky-700 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Новое ДЗ</span>
          </button>
        </div>
      </div>

      {/* 2. Subject Filter Pills & Track Filters for Grade 11 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            { label: "Алгебра", count: algebraCount },
            { label: "Геометрия", count: geomCount },
            { label: "Самостоятельные", count: samostCount },
            { label: "Результаты", count: null },
          ].map((pill) => {
            const isActive = selectedSubjectFilter === pill.label;
            return (
              <button
                key={pill.label}
                type="button"
                onClick={() => setSelectedSubjectFilter(pill.label)}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition border whitespace-nowrap cursor-pointer ${
                  isActive
                    ? isLight
                      ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                      : "bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-xs"
                    : isLight
                    ? "bg-slate-100 border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
                    : "bg-zinc-800/50 border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isActive
                      ? isLight
                        ? "bg-white"
                        : "bg-cyan-400"
                      : "bg-slate-400"
                  }`}
                />
                <span>{pill.label}</span>
                {pill.count !== null && (
                  <span
                    className={`text-[11px] font-extrabold ${
                      isActive ? "opacity-90" : "text-slate-400"
                    }`}
                  >
                    {pill.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {is11Class && (
          <div
            className={`flex items-center gap-1.5 p-1 rounded-xl border text-xs shrink-0 ${
              isLight
                ? "bg-slate-100 border-slate-200"
                : "bg-zinc-800/80 border-zinc-700"
            }`}
          >
            <span className={`text-[11px] font-bold px-2 ${isLight ? "text-slate-500" : "text-zinc-400"}`}>
              Уровень:
            </span>
            {(["ALL", "База", "Профиль"] as const).map((track) => (
              <button
                key={track}
                type="button"
                onClick={() => setFilterTrack(track)}
                className={`px-3 py-1 rounded-lg font-bold transition text-xs cursor-pointer ${
                  filterTrack === track
                    ? track === "Профиль"
                      ? "bg-purple-600 text-white shadow-xs"
                      : track === "База"
                      ? "bg-amber-600 text-white shadow-xs"
                      : isLight
                      ? "bg-sky-600 text-white shadow-xs"
                      : "bg-zinc-700 text-white shadow-xs"
                    : isLight
                    ? "text-slate-600 hover:text-slate-900"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {track === "ALL" ? "Все (11 класс)" : track}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Main 2-Column Content (Left: Homework Cards, Right: "Новое ДЗ" Form) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: List of Homework Cards */}
        <div className="lg:col-span-8 space-y-5">
          {filteredHomeworks.length === 0 ? (
            <div
              className={`flex h-56 flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center ${
                isLight
                  ? "border-slate-200 bg-white/60 text-slate-500"
                  : "border-zinc-800 text-zinc-400"
              }`}
            >
              <FileText className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm font-bold">Домашних заданий не найдено</p>
              <p className="text-xs mt-1">Добавьте новое ДЗ в панели справа</p>
            </div>
          ) : (
            filteredHomeworks.map((hw) => {
              const isClosed = closedMap[hw.id];
              const dateParts = hw.targetDate.split("-");
              const dayStr = dateParts[2] || "16";
              const monthStr = dateParts[1] || "09";
              const displayDate = `${dayStr}.${monthStr}.${dateParts[0] || "2026"}`;

              return (
                <div key={hw.id} className="flex items-start gap-3.5 sm:gap-4">
                  {/* Left Date Circle Badge */}
                  <div
                    className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl border font-mono shadow-xs mt-1 ${
                      isLight
                        ? "bg-sky-50 border-sky-200 text-sky-700"
                        : "bg-blue-950/60 border-blue-900/40 text-blue-300"
                    }`}
                  >
                    <span className="text-sm font-black leading-none">{dayStr}</span>
                    <span className="text-[9px] font-bold leading-none mt-0.5 opacity-80">{monthStr}</span>
                  </div>

                  {/* Card Body */}
                  <div className="glass-panel flex-1 rounded-3xl p-4 sm:p-6 space-y-4 transition">
                    {/* Header: Date + Topic Title + Top Right Actions */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center flex-wrap gap-2">
                          <span className={`text-xs font-semibold ${isLight ? "text-slate-500" : "text-zinc-400"}`}>
                            {displayDate}
                          </span>
                          {hw.targetTrack === "База" && (
                            <span
                              className={`rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase ${
                                isLight
                                  ? "bg-amber-50 border-amber-200 text-amber-700"
                                  : "bg-amber-500/15 border-amber-500/30 text-amber-400"
                              }`}
                            >
                              База
                            </span>
                          )}
                          {hw.targetTrack === "Профиль" && (
                            <span
                              className={`rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase ${
                                isLight
                                  ? "bg-purple-50 border-purple-200 text-purple-700"
                                  : "bg-purple-500/15 border-purple-500/30 text-purple-400"
                              }`}
                            >
                              Профиль
                            </span>
                          )}
                          {is11Class && (!hw.targetTrack || hw.targetTrack === "ALL") && (
                            <span
                              className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold ${
                                isLight
                                  ? "bg-sky-50 border-sky-200 text-sky-700"
                                  : "bg-blue-500/15 border-blue-500/30 text-blue-400"
                              }`}
                            >
                              Весь класс (База + Профиль)
                            </span>
                          )}
                        </div>
                        <h2
                          className={`text-lg sm:text-xl font-black tracking-tight mt-0.5 ${
                            isLight ? "text-slate-900" : "text-white"
                          }`}
                        >
                          {hw.title}
                        </h2>
                        {hw.description && (
                          <p
                            className={`text-xs mt-1 leading-relaxed ${
                              isLight ? "text-slate-600" : "text-zinc-400"
                            }`}
                          >
                            {hw.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-slate-400">
                        <button
                          type="button"
                          className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                          title="Копировать"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                          title="Редактировать"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {onDeleteHomework && (
                          <button
                            type="button"
                            onClick={() => onDeleteHomework(hw.id)}
                            className="rounded-lg p-1.5 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-red-950/40 cursor-pointer"
                            title="Удалить ДЗ"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Attached Files */}
                    {hw.attachments && hw.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {hw.attachments.map((att) => (
                          <AttachmentBadge key={att.id} file={att} />
                        ))}
                      </div>
                    )}

                    {/* BIG BUTTON: ПРОВЕРИТЬ ДЗ / РАБОТЫ И ЗАМЕТКИ */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => onOpenCheckingStudio(hw)}
                        className={`group flex items-center justify-between gap-4 rounded-2xl border px-5 py-3 transition shadow-xs w-full sm:w-auto cursor-pointer ${
                          isLight
                            ? "border-sky-200 bg-sky-50/80 hover:bg-sky-100/80 text-slate-900"
                            : "border-blue-900/60 bg-blue-950/30 hover:bg-blue-900/40 text-blue-100"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white shadow-xs">
                            <PenTool className="h-4 w-4" />
                          </div>
                          <div className="text-left">
                            <div
                              className={`text-xs sm:text-sm font-black ${
                                isLight ? "text-slate-900 group-hover:text-sky-700" : "text-blue-100"
                              }`}
                            >
                              Проверить ДЗ
                            </div>
                            <div
                              className={`text-[11px] font-semibold ${
                                isLight ? "text-sky-700" : "text-blue-300"
                              }`}
                            >
                              Работы и заметки
                            </div>
                          </div>
                        </div>

                        {/* Submission Counter Badge & Avatar Icon */}
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 min-w-6 px-1.5 items-center justify-center rounded-full bg-sky-600 text-xs font-black text-white shadow-xs">
                            {hw.submissionsCount}
                          </span>
                          <Users className={`h-4 w-4 ${isLight ? "text-sky-600" : "text-blue-400"}`} />
                        </div>
                      </button>
                    </div>

                    {/* Status Bar: Приём ДЗ открыт / закрыт */}
                    <div
                      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t ${
                        isLight ? "border-slate-100" : "border-zinc-800"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              isClosed ? "bg-slate-400" : "bg-emerald-500 animate-pulse"
                            }`}
                          />
                          <span
                            className={`text-xs font-bold ${
                              isLight ? "text-slate-800" : "text-zinc-200"
                            }`}
                          >
                            {isClosed ? "Приём ДЗ закрыт" : "Приём ДЗ открыт"}
                          </span>
                        </div>
                        <p className={`text-[11px] mt-0.5 ${isLight ? "text-slate-500" : "text-zinc-400"}`}>
                          {isClosed
                            ? "Срок сдачи окончен, отправка новых работ недоступна"
                            : "Ученики ещё могут отправлять решения"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setClosedMap((prev) => ({ ...prev, [hw.id]: !prev[hw.id] }))}
                          className={`rounded-xl border px-3.5 py-1.5 text-xs font-bold shadow-2xs transition cursor-pointer ${
                            isLight
                              ? "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                              : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                          }`}
                        >
                          {isClosed ? "Открыть приём" : "Закрыть приём"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: "Новое ДЗ" Form Panel */}
        <div
          id="new-homework-form"
          className="glass-panel lg:col-span-4 rounded-3xl p-5 sm:p-6 space-y-5"
        >
          <div>
            <h2 className={`text-lg font-black ${isLight ? "text-slate-900" : "text-white"}`}>
              Новое ДЗ
            </h2>
            <p className={`text-xs leading-tight mt-1 ${isLight ? "text-slate-500" : "text-zinc-400"}`}>
              Заполните данные домашнего задания и при необходимости приложите файлы.
            </p>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs font-bold">
            {/* Предмет и Дата в 2 колонки */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={`font-semibold block mb-1 ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
                  Предмет
                </label>
                <select
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className={`w-full h-10 rounded-xl border px-3 text-xs font-bold focus:outline-none ${
                    isLight
                      ? "border-slate-200 bg-white text-slate-900 focus:border-sky-500"
                      : "border-zinc-700 bg-slate-900/80 text-white focus:border-cyan-400"
                  }`}
                >
                  <option value="Алгебра">Алгебра</option>
                  <option value="Геометрия">Геометрия</option>
                  <option value="Физика">Физика</option>
                  <option value="Математика">Математика</option>
                </select>
              </div>

              <div>
                <label className={`font-semibold block mb-1 ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
                  Срок сдачи
                </label>
                <DatePicker value={newDate} onChange={setNewDate} />
              </div>
            </div>

            {/* Выбор База / Профиль для 11 класса */}
            {is11Class && (
              <div>
                <label className={`font-semibold block mb-1.5 ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
                  Кому выдать ДЗ (11 класс)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewTargetTrack("ALL")}
                    className={`h-9 rounded-xl border text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                      newTargetTrack === "ALL"
                        ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                        : isLight
                        ? "border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700"
                        : "border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    Весь класс
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTargetTrack("База")}
                    className={`h-9 rounded-xl border text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                      newTargetTrack === "База"
                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                        : isLight
                        ? "border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700"
                        : "border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    База
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTargetTrack("Профиль")}
                    className={`h-9 rounded-xl border text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                      newTargetTrack === "Профиль"
                        ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                        : isLight
                        ? "border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700"
                        : "border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    Профиль
                  </button>
                </div>
              </div>
            )}

            {/* Тема ДЗ */}
            <div>
              <label className={`font-semibold block mb-1 ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
                Тема ДЗ
              </label>
              <input
                type="text"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                placeholder="Например, Исследование функций"
                className={`w-full h-10 rounded-xl border px-3 text-xs font-medium focus:outline-none ${
                  isLight
                    ? "border-slate-200 bg-white text-slate-900 focus:border-sky-500"
                    : "border-zinc-700 bg-slate-900/80 text-white focus:border-cyan-400"
                }`}
              />
            </div>

            {/* Комментарий / Описание задания */}
            <div>
              <label className={`font-semibold block mb-1 ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
                Описание и комментарий
              </label>
              <textarea
                rows={3}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Номера заданий, что повторить, на что обратить внимание..."
                className={`w-full rounded-xl border p-3 text-xs font-medium focus:outline-none ${
                  isLight
                    ? "border-slate-200 bg-white text-slate-900 focus:border-sky-500"
                    : "border-zinc-700 bg-slate-900/80 text-white focus:border-cyan-400"
                }`}
              />
            </div>

            {/* Выбрать PDF-файлы */}
            <div>
              <label
                className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-2xl cursor-pointer transition ${
                  isLight
                    ? "border-slate-300 hover:bg-slate-50 text-slate-700"
                    : "border-zinc-700 hover:bg-zinc-800/50 text-zinc-200"
                }`}
              >
                <UploadCloud className="h-6 w-6 text-slate-400 mb-1" />
                <span className="text-xs font-bold">Прикрепить файлы к ДЗ</span>
                <span className="text-[10px] text-slate-400 mt-0.5">PDF или фото, до 30 МБ</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,application/pdf,image/*"
                  onChange={(e) => {
                    if (e.target.files) {
                      setSelectedFiles(Array.from(e.target.files));
                    }
                  }}
                  className="hidden"
                />
              </label>

              {selectedFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {selectedFiles.map((f, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between text-[11px] px-3 py-1.5 rounded-xl font-medium ${
                        isLight ? "bg-slate-100 text-slate-800" : "bg-zinc-800 text-zinc-200"
                      }`}
                    >
                      <span className="truncate max-w-[200px]">{f.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="text-slate-400 hover:text-rose-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="theme-btn w-full h-11 rounded-2xl font-extrabold text-sm shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? "Сохранение..." : "Добавить ДЗ"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
