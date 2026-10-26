"use client";

import React, { useState } from "react";
import {
  Plus,
  FileText,
  Trash2,
  Copy,
  Users,
  PenTool,
  UploadCloud,
  X,
} from "lucide-react";
import { DatePicker } from "./date-picker";
import { AttachmentBadge } from "./attachment-badge";
import { useAppTheme } from "./theme-context";
import { Card, Button, Input, Textarea, Select, SegmentedControl } from "./ui-kit";

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
  const { isLight } = useAppTheme();

  const currentClass = classes.find((c) => c.id === selectedClassId);
  const is11Class = Boolean(currentClass?.name?.startsWith("11") || currentClass?.grade === 11);

  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>("Алгебра");
  const [filterTrack, setFilterTrack] = useState<"ALL" | "База" | "Профиль">("ALL");

  const [newSubject, setNewSubject] = useState<string>("Алгебра");
  const [newDate, setNewDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [newTopic, setNewTopic] = useState<string>("");
  const [newComment, setNewComment] = useState<string>("");
  const [newTargetTrack, setNewTargetTrack] = useState<"ALL" | "База" | "Профиль">("ALL");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [closedMap, setClosedMap] = useState<{ [hwId: string]: boolean }>({});

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
    if (!newTopic.trim()) return;

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
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <span className="text-[11px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">
            Учебный журнал
          </span>
          <h1
            className={`text-xl sm:text-3xl font-black tracking-tight mt-0.5 truncate ${
              isLight ? "text-slate-900" : "text-white"
            }`}
          >
            {selectedSubjectFilter}
          </h1>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="flex-1 sm:w-48">
            <Select
              value={selectedClassId}
              onValueChange={onSelectClassId}
              options={classes.map((c) => ({
                value: c.id,
                label: `Класс: ${c.name}`,
              }))}
            />
          </div>

          <Button
            variant="primary"
            size="md"
            className="h-11 px-4"
            onClick={() => {
              const formEl = document.getElementById("new-homework-form");
              formEl?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>Новое ДЗ</span>
          </Button>
        </div>
      </div>

      {/* 2. Subject Filter Pills & Track Filters for Grade 11 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
        <div className="overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
          <SegmentedControl
            size="md"
            value={selectedSubjectFilter}
            onChange={setSelectedSubjectFilter}
            options={[
              { label: "Алгебра", value: "Алгебра", badge: algebraCount },
              { label: "Геометрия", value: "Геометрия", badge: geomCount },
              { label: "Самостоятельные", value: "Самостоятельные", badge: samostCount },
              { label: "Результаты", value: "Результаты" },
            ]}
          />
        </div>

        {is11Class && (
          <SegmentedControl
            size="sm"
            value={filterTrack}
            onChange={setFilterTrack}
            options={[
              { value: "ALL", label: "Все (11 кл.)" },
              { value: "База", label: "База" },
              { value: "Профиль", label: "Профиль" },
            ]}
          />
        )}
      </div>

      {/* 3. Main 2-Column Content (Left: Homework Cards, Right: "Новое ДЗ" Form) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        <div
          key={`${selectedSubjectFilter}-${filterTrack}-${selectedClassId}`}
          className="lg:col-span-8 space-y-3.5 sm:space-y-5 animate-tab-enter"
        >
          {filteredHomeworks.length === 0 ? (
            <Card padding="lg" className="flex h-48 sm:h-56 flex-col items-center justify-center text-center border-dashed">
              <FileText className="h-8 w-8 mb-2 text-slate-400" />
              <p className="text-sm font-bold">Домашних заданий не найдено</p>
              <p className={`text-xs mt-1 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                Добавьте новое ДЗ в форме создания
              </p>
            </Card>
          ) : (
            filteredHomeworks.map((hw) => {
              const isClosed = closedMap[hw.id];
              const dateParts = hw.targetDate.split("-");
              const dayStr = dateParts[2] || "16";
              const monthStr = dateParts[1] || "09";
              const displayDate = `${dayStr}.${monthStr}.${dateParts[0] || "2026"}`;

              return (
                <div key={hw.id} className="flex items-start gap-3 sm:gap-4 w-full min-w-0">
                  <div
                    className={`hidden sm:flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl border font-mono shadow-xs mt-1 ${
                      isLight
                        ? "bg-sky-50 border-sky-200 text-sky-700"
                        : "bg-sky-500/15 border-sky-500/30 text-sky-300"
                    }`}
                  >
                    <span className="text-sm font-black leading-none">{dayStr}</span>
                    <span className="text-[9px] font-bold leading-none mt-0.5 opacity-80">{monthStr}</span>
                  </div>

                  <Card padding="md" className="flex-1 min-w-0 space-y-3.5 sm:space-y-4">
                    <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
                          <span
                            className={`inline-flex sm:hidden items-center gap-1 rounded-lg border px-2 py-0.5 font-mono text-[11px] font-black ${
                              isLight
                                ? "bg-sky-50 border-sky-200 text-sky-700"
                                : "bg-sky-500/15 border-sky-500/30 text-sky-300"
                            }`}
                          >
                            {dayStr}.{monthStr}
                          </span>
                          <span className={`hidden sm:inline text-xs font-semibold ${isLight ? "text-slate-500" : "text-slate-400"}`}>
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
                                  : "bg-sky-500/15 border-sky-500/30 text-sky-400"
                              }`}
                            >
                              <span className="sm:hidden">Весь класс</span>
                              <span className="hidden sm:inline">Весь класс (База + Профиль)</span>
                            </span>
                          )}
                        </div>
                        <h2
                          className={`text-base sm:text-xl font-black tracking-tight mt-1 break-words ${
                            isLight ? "text-slate-900" : "text-white"
                          }`}
                        >
                          {hw.title}
                        </h2>
                        {hw.description && (
                          <p
                            className={`text-xs mt-1 leading-relaxed break-words ${
                              isLight ? "text-slate-600" : "text-slate-400"
                            }`}
                          >
                            {hw.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            try {
                              navigator.clipboard?.writeText(`${hw.subjectName}: ${hw.title}\n${hw.description || ""}`);
                            } catch {}
                          }}
                          title="Копировать"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        {onDeleteHomework && (
                          <Button
                            variant="danger"
                            size="icon"
                            onClick={() => onDeleteHomework(hw.id)}
                            title="Удалить ДЗ"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {hw.attachments && hw.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {hw.attachments.map((att) => (
                          <AttachmentBadge key={att.id} file={att} />
                        ))}
                      </div>
                    )}

                    <div className="pt-0.5">
                      <button
                        type="button"
                        onClick={() => onOpenCheckingStudio(hw)}
                        className={`group flex items-center justify-between gap-3 sm:gap-4 rounded-2xl border px-3.5 sm:px-5 py-2.5 sm:py-3 transition-all duration-200 shadow-xs w-full sm:w-auto cursor-pointer ${
                          isLight
                            ? "border-sky-200 bg-sky-50/80 hover:bg-sky-100/80 text-slate-900"
                            : "border-sky-500/30 bg-sky-950/30 hover:bg-sky-900/40 text-sky-100"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-xs">
                            <PenTool className="h-4 w-4" />
                          </div>
                          <div className="text-left min-w-0">
                            <div
                              className={`text-xs sm:text-sm font-black truncate ${
                                isLight ? "text-slate-900 group-hover:text-sky-700" : "text-sky-100"
                              }`}
                            >
                              Проверить ДЗ
                            </div>
                            <div
                              className={`text-[11px] font-semibold truncate ${
                                isLight ? "text-sky-700" : "text-sky-300"
                              }`}
                            >
                              Работы и заметки
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                          <span className="flex h-6 min-w-6 px-1.5 items-center justify-center rounded-full bg-sky-600 text-xs font-black text-white shadow-xs">
                            {hw.submissionsCount}
                          </span>
                          <Users className={`h-4 w-4 ${isLight ? "text-sky-600" : "text-sky-400"}`} />
                        </div>
                      </button>
                    </div>

                    <div
                      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 pt-3 border-t ${
                        isLight ? "border-slate-100" : "border-slate-800"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 ${
                              isClosed ? "bg-slate-400" : "bg-emerald-500 animate-pulse"
                            }`}
                          />
                          <span
                            className={`text-xs font-bold ${
                              isLight ? "text-slate-800" : "text-slate-200"
                            }`}
                          >
                            {isClosed ? "Приём ДЗ закрыт" : "Приём ДЗ открыт"}
                          </span>
                        </div>
                        <p className={`text-[11px] mt-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                          {isClosed
                            ? "Срок сдачи окончен, отправка новых работ недоступна"
                            : "Ученики ещё могут отправлять решения"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setClosedMap((prev) => ({ ...prev, [hw.id]: !prev[hw.id] }))}
                          className="w-full sm:w-auto"
                        >
                          {isClosed ? "Открыть приём" : "Закрыть приём"}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: "Новое ДЗ" Form Panel */}
        <Card id="new-homework-form" padding="md" className="lg:col-span-4 space-y-4 sm:space-y-5">
          <div>
            <h2 className={`text-lg font-black ${isLight ? "text-slate-900" : "text-white"}`}>
              Новое ДЗ
            </h2>
            <p className={`text-xs leading-tight mt-1 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
              Заполните данные домашнего задания и при необходимости приложите файлы.
            </p>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs font-bold">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={`font-semibold block mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Предмет
                </label>
                <Select
                  value={newSubject}
                  onValueChange={setNewSubject}
                  options={[
                    { value: "Алгебра", label: "Алгебра" },
                    { value: "Геометрия", label: "Геометрия" },
                    { value: "Физика", label: "Физика" },
                    { value: "Математика", label: "Математика" },
                  ]}
                />
              </div>

              <div>
                <label className={`font-semibold block mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Срок сдачи
                </label>
                <DatePicker value={newDate} onChange={setNewDate} />
              </div>
            </div>

            {is11Class && (
              <div>
                <label className={`font-semibold block mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Кому выдать ДЗ (11 класс)
                </label>
                <SegmentedControl
                  fullWidth
                  size="sm"
                  value={newTargetTrack}
                  onChange={setNewTargetTrack}
                  options={[
                    { value: "ALL", label: "Весь класс" },
                    { value: "База", label: "База" },
                    { value: "Профиль", label: "Профиль" },
                  ]}
                />
              </div>
            )}

            <div>
              <label className={`font-semibold block mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Тема ДЗ
              </label>
              <Input
                type="text"
                required
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                placeholder="Например, Исследование функций"
              />
            </div>

            <div>
              <label className={`font-semibold block mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Описание и комментарий
              </label>
              <Textarea
                rows={3}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Номера заданий, что повторить, на что обратить внимание..."
              />
            </div>

            <div>
              <label
                className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-2xl cursor-pointer transition-colors duration-200 ${
                  isLight
                    ? "border-slate-300 hover:bg-slate-50 text-slate-700"
                    : "border-slate-700 hover:bg-slate-800/50 text-slate-200"
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
                        isLight ? "bg-slate-100 text-slate-800" : "bg-slate-800 text-slate-200"
                      }`}
                    >
                      <span className="truncate max-w-[200px]">{f.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="h-6 w-6 text-slate-400 hover:text-rose-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" variant="primary" size="full" disabled={isSubmitting}>
              {isSubmitting ? "Сохранение..." : "Добавить ДЗ"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
