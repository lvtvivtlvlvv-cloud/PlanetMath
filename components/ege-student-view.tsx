"use client";

import React, { useState, useMemo, useTransition } from "react";
import { useAppTheme } from "./theme-context";
import {
  GraduationCap,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  Layers,
  ListFilter,
  Check,
  X,
  FileQuestion,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { submitEgeItemAnswerAction } from "@/app/student/actions";
import { MathText } from "./math-text";
import { EgeGeometryDiagram } from "./ege-geometry-diagram";

export interface StudentEgeAssignmentItem {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  assignmentDeadline?: string | null;
  teacherComment?: string | null;
  taskNumber: number;
  topic: string;
  title: string;
  content: string;
  difficulty: string;
  pdfPage?: number | null;
  taskCode?: string | null;
  studentAnswer?: string | null;
  studentComment?: string | null;
  status: "ASSIGNED" | "SUBMITTED" | "GRADED";
  score?: number | null;
  maxScore: number;
  teacherFeedback?: string | null;
  submittedAt?: string | null;
  gradedAt?: string | null;
}

interface EgeStudentViewProps {
  studentId: string;
  items: StudentEgeAssignmentItem[];
}

export function EgeStudentView({ studentId, items = [] }: EgeStudentViewProps) {
  const { theme } = useAppTheme();
  const isPlanet = theme === "planet";
  const isGarden = theme === "garden";

  const [groupingMode, setGroupingMode] = useState<"by_work" | "by_task_number">("by_work");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "COMPLETED">("ALL");
  const [selectedTaskNum, setSelectedTaskNum] = useState<number | "ALL">("ALL");

  // Answers form state: { [itemId]: { answer: string, comment: string } }
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [draftComments, setDraftComments] = useState<Record<string, string>>({});
  const [submittingItemId, setSubmittingItemId] = useState<string | null>(null);
  const [itemFeedback, setItemFeedback] = useState<Record<string, { success: boolean; msg: string }>>({});
  const [expandedWorks, setExpandedWorks] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const showToast = (text: string, type: "success" | "error" | "info" = "info") => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  const [isPending, startTransition] = useTransition();

  // Statistics
  const stats = useMemo(() => {
    const total = items.length;
    const completed = items.filter((i) => i.status === "GRADED" || i.status === "SUBMITTED").length;
    const scored = items.filter((i) => (i.score || 0) > 0).length;
    const totalScore = items.reduce((acc, i) => acc + (i.score || 0), 0);
    const maxScore = items.reduce((acc, i) => acc + (i.maxScore || 1), 0);
    const percent = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    return { total, completed, scored, totalScore, maxScore, percent };
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter === "PENDING" && item.status !== "ASSIGNED") return false;
      if (statusFilter === "COMPLETED" && item.status === "ASSIGNED") return false;
      if (selectedTaskNum !== "ALL" && item.taskNumber !== selectedTaskNum) return false;
      return true;
    });
  }, [items, statusFilter, selectedTaskNum]);

  // Grouped by Work
  const groupedByWork = useMemo(() => {
    const map = new Map<string, { title: string; deadline?: string | null; comment?: string | null; items: StudentEgeAssignmentItem[] }>();
    filteredItems.forEach((i) => {
      if (!map.has(i.assignmentId)) {
        map.set(i.assignmentId, {
          title: i.assignmentTitle,
          deadline: i.assignmentDeadline,
          comment: i.teacherComment,
          items: [],
        });
      }
      map.get(i.assignmentId)!.items.push(i);
    });
    return Array.from(map.entries()).map(([id, data]) => ({ id, ...data }));
  }, [filteredItems]);

  // Grouped by Task Number (1..19)
  const groupedByTaskNumber = useMemo(() => {
    const map = new Map<number, StudentEgeAssignmentItem[]>();
    filteredItems.forEach((i) => {
      if (!map.has(i.taskNumber)) {
        map.set(i.taskNumber, []);
      }
      map.get(i.taskNumber)!.push(i);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([num, list]) => ({ taskNumber: num, topic: list[0]?.topic || `Задание №${num}`, items: list }));
  }, [filteredItems]);

  const handleSubmitAnswer = (item: StudentEgeAssignmentItem) => {
    const ans = draftAnswers[item.id] !== undefined ? draftAnswers[item.id] : item.studentAnswer || "";
    const comm = draftComments[item.id] !== undefined ? draftComments[item.id] : item.studentComment || "";

    if (!ans.trim()) {
      showToast("Пожалуйста, введите ваш ответ перед отправкой!", "error");
      return;
    }

    setSubmittingItemId(item.id);
    startTransition(async () => {
      try {
        const res = await submitEgeItemAnswerAction({
          itemId: item.id,
          studentId,
          studentAnswer: ans,
          studentComment: comm,
        });

        if (res.success) {
          if (res.status === "GRADED") {
            const isCorrect = res.isCorrect;
            setItemFeedback((prev) => ({
              ...prev,
              [item.id]: {
                success: isCorrect ?? false,
                msg: isCorrect ? "Верно! Ответ правильный (+1 балл)." : "Ответ не совпал с ключом.",
              },
            }));
            showToast(isCorrect ? "Ответ верный! +1 балл" : "Ответ принят, но не совпал с ключом", isCorrect ? "success" : "info");
          } else {
            setItemFeedback((prev) => ({
              ...prev,
              [item.id]: { success: true, msg: "Решение отправлено учителю на проверку." },
            }));
            showToast("Решение отправлено учителю на проверку!", "success");
          }
        }
      } catch (err: any) {
        showToast(err.message || "Ошибка при отправке решения", "error");
      } finally {
        setSubmittingItemId(null);
      }
    });
  };

  const toggleWorkExpand = (id: string) => {
    setExpandedWorks((prev) => ({ ...prev, [id]: prev[id] === false ? true : false }));
  };

  return (
    <div className="space-y-6">
      {/* СТАТИСТИЧЕСКИЙ БАННЕР УСПЕШНОСТИ */}
      <div className="glass-panel p-5 rounded-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-zinc-100 flex items-center gap-2">
                Задания и варианты ЕГЭ
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                  {stats.completed} из {stats.total} решено
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Индивидуальные тренировочные работы, подобранные преподавателем из открытого банка ФИПИ
              </p>
            </div>
          </div>

          {/* ПОКАЗАТЕЛИ БАЛЛОВ */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 shrink-0">
            <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 text-center">
              <p className="text-[10px] uppercase font-bold text-zinc-400">Назначено</p>
              <p className="text-base font-black text-cyan-300">{stats.total} задач</p>
            </div>
            <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 text-center">
              <p className="text-[10px] uppercase font-bold text-zinc-400">Сдано</p>
              <p className="text-base font-black text-emerald-400">{stats.completed}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 text-center">
              <p className="text-[10px] uppercase font-bold text-zinc-400">Баллы</p>
              <p className="text-base font-black text-amber-300">
                {stats.totalScore} <span className="text-[11px] text-zinc-500 font-normal">/ {stats.maxScore}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ПАНЕЛЬ ПЕРЕКЛЮЧЕНИЯ ГРУППИРОВКИ И ФИЛЬТРОВ */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Переключатель режима группировки */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/5">
          <button
            type="button"
            onClick={() => setGroupingMode("by_work")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              groupingMode === "by_work"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>По выданным работам</span>
          </button>
          <button
            type="button"
            onClick={() => setGroupingMode("by_task_number")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              groupingMode === "by_task_number"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <ListFilter className="h-3.5 w-3.5" />
            <span>По номерам ЕГЭ (1–19)</span>
          </button>
        </div>

        {/* Фильтр по статусу */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {[
            { id: "ALL", label: "Все задания" },
            { id: "PENDING", label: "Ожидают решения" },
            { id: "COMPLETED", label: "Сдано / Решено" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition shrink-0 ${
                statusFilter === tab.id
                  ? "bg-white/10 text-white border-white/20"
                  : "bg-black/20 text-zinc-400 border-white/5 hover:bg-white/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ОСНОВНОЙ КОНТЕНТ ЗАДАНИЙ */}
      {filteredItems.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center space-y-2">
          <FileQuestion className="h-10 w-10 text-zinc-500 mx-auto" />
          <h3 className="text-sm font-bold text-zinc-300">Назначенных заданий пока нет</h3>
          <p className="text-xs text-zinc-500">
            Когда преподаватель назначит вам тренировочный вариант из банка ЕГЭ, он появится здесь.
          </p>
        </div>
      ) : groupingMode === "by_work" ? (
        /* РЕЖИМ 1: ГРУППИРОВКА ПО ВЫДАННЫМ РАБОТАМ */
        <div className="space-y-6">
          {groupedByWork.map((work) => {
            const isExpanded = expandedWorks[work.id] !== false;
            const completedInWork = work.items.filter((i) => i.status !== "ASSIGNED").length;

            return (
              <div key={work.id} className="glass-panel p-5 rounded-2xl space-y-4">
                {/* Шапка работы */}
                <div
                  onClick={() => toggleWorkExpand(work.id)}
                  className="flex items-start justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-zinc-100">{work.title}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                        {completedInWork} из {work.items.length} сдано
                      </span>
                    </div>

                    <div className="flex items-center flex-wrap gap-3 text-xs text-zinc-400">
                      {work.deadline && (
                        <span className="flex items-center gap-1 text-amber-400 font-semibold">
                          <Clock className="h-3 w-3" />
                          Срок сдачи: {work.deadline}
                        </span>
                      )}
                      {work.comment && <span className="italic text-zinc-400">«{work.comment}»</span>}
                    </div>
                  </div>

                  <button type="button" className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200">
                    {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                </div>

                {/* Список заданий в работе */}
                {isExpanded && (
                  <div className="space-y-4 pt-2 border-t border-white/5">
                    {work.items.map((item, idx) => (
                      <TaskCard
                        key={item.id}
                        item={item}
                        index={idx + 1}
                        draftAnswer={draftAnswers[item.id] !== undefined ? draftAnswers[item.id] : item.studentAnswer || ""}
                        draftComment={draftComments[item.id] !== undefined ? draftComments[item.id] : item.studentComment || ""}
                        onAnswerChange={(val) => setDraftAnswers((prev) => ({ ...prev, [item.id]: val }))}
                        onCommentChange={(val) => setDraftComments((prev) => ({ ...prev, [item.id]: val }))}
                        onSubmit={() => handleSubmitAnswer(item)}
                        isSubmitting={submittingItemId === item.id || isPending}
                        feedback={itemFeedback[item.id]}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* РЕЖИМ 2: ГРУППИРОВКА ПО НОМЕРАМ ЕГЭ (1..19) */
        <div className="space-y-6">
          {groupedByTaskNumber.map((group) => (
            <div key={group.taskNumber} className="glass-panel p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center text-xs font-black">
                    №{group.taskNumber}
                  </span>
                  <div>
                    <h3 className="text-sm font-black text-zinc-100">{group.topic}</h3>
                    <p className="text-[11px] text-zinc-400">Заданий в этом блоке: {group.items.length}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-2 border-t border-white/5">
                {group.items.map((item, idx) => (
                  <TaskCard
                    key={item.id}
                    item={item}
                    index={idx + 1}
                    draftAnswer={draftAnswers[item.id] !== undefined ? draftAnswers[item.id] : item.studentAnswer || ""}
                    draftComment={draftComments[item.id] !== undefined ? draftComments[item.id] : item.studentComment || ""}
                    onAnswerChange={(val) => setDraftAnswers((prev) => ({ ...prev, [item.id]: val }))}
                    onCommentChange={(val) => setDraftComments((prev) => ({ ...prev, [item.id]: val }))}
                    onSubmit={() => handleSubmitAnswer(item)}
                    isSubmitting={submittingItemId === item.id || isPending}
                    feedback={itemFeedback[item.id]}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Стилизованные Toast-уведомления */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl animate-in slide-in-from-bottom-3 duration-200 ${
            toast.type === "success"
              ? "bg-slate-900/95 border-emerald-500/40 text-emerald-300"
              : toast.type === "error"
              ? "bg-slate-900/95 border-rose-500/40 text-rose-300"
              : "bg-slate-900/95 border-cyan-500/40 text-cyan-300"
          }`}
        >
          {toast.type === "success" && <Check className="w-4 h-4 shrink-0 text-emerald-400" />}
          {toast.type === "error" && <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />}
          {toast.type === "info" && <Clock className="w-4 h-4 shrink-0 text-cyan-400" />}
          <span className="text-xs font-semibold">{toast.text}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Отдельная карточка конкретного задания для ученика
 */
function TaskCard({
  item,
  index,
  draftAnswer,
  draftComment,
  onAnswerChange,
  onCommentChange,
  onSubmit,
  isSubmitting,
  feedback,
}: {
  item: StudentEgeAssignmentItem;
  index: number;
  draftAnswer: string;
  draftComment: string;
  onAnswerChange: (v: string) => void;
  onCommentChange: (v: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  feedback?: { success: boolean; msg: string };
}) {
  const isPart2 = item.taskNumber >= 13;
  const isGraded = item.status === "GRADED";
  const isSubmitted = item.status === "SUBMITTED";

  return (
    <div className="p-4 rounded-xl bg-black/30 border border-white/5 hover:border-white/10 transition space-y-3">
      {/* Шапка карточки задания */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center flex-wrap gap-2.5">
          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-black shadow-sm ${
              isPart2
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
            }`}
          >
            Задание №{item.taskNumber}
          </span>
          <span className="text-xs font-bold text-zinc-100">{item.topic}</span>
          {item.taskCode && (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              Прототип #{item.taskCode}
            </span>
          )}
        </div>

        {/* Статус выполнения */}
        <div className="shrink-0">
          {isGraded ? (
            (item.score || 0) > 0 ? (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                <Check className="h-3 w-3" />
                <span>Верно (+{item.score} б.)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold">
                <X className="h-3 w-3" />
                <span>Неверно (0 б.)</span>
              </span>
            )
          ) : isSubmitted ? (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-bold">
              <Clock className="h-3 w-3" />
              <span>На проверке</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-bold">
              <span>Ожидает решения</span>
            </span>
          )}
        </div>
      </div>

      {/* Условие задания с KaTeX рендером формул и векторным чертежом */}
      <div className="flex flex-col lg:flex-row gap-4 items-start justify-between py-1">
        <div className="flex-1 min-w-0">
          <MathText text={item.content} className="text-xs sm:text-sm text-zinc-200" />
        </div>
        <EgeGeometryDiagram taskNumber={item.taskNumber} text={item.content} />
      </div>

      {/* Поле ввода ответа и отправка */}
      <div className="space-y-2 pt-1">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-zinc-400">Ваш ответ:</label>
            <input
              type="text"
              value={draftAnswer}
              onChange={(e) => onAnswerChange(e.target.value)}
              placeholder={isPart2 ? "Ответ или корни (например: 7; -1)" : "Число (например: 12 или 0.75)"}
              className="w-full h-9 rounded-xl bg-black/40 border border-white/10 px-3 text-xs text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="sm:col-span-2 space-y-1">
            <label className="text-[11px] font-semibold text-zinc-400">Пояснение / решение (по желанию):</label>
            <input
              type="text"
              value={draftComment}
              onChange={(e) => onCommentChange(e.target.value)}
              placeholder="Краткие шаги решения или ссылки на формулы..."
              className="w-full h-9 rounded-xl bg-black/40 border border-white/10 px-3 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          {feedback && (
            <div
              className={`text-[11px] font-semibold flex items-center gap-1.5 ${
                feedback.success ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {feedback.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              <span>{feedback.msg}</span>
            </div>
          )}

          <div className="ml-auto">
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 text-zinc-950 font-bold text-xs hover:bg-cyan-400 transition cursor-pointer disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isSubmitting ? "Отправка..." : isSubmitted || isGraded ? "Обновить ответ" : "Сдать решение"}</span>
            </button>
          </div>
        </div>

        {item.teacherFeedback && (
          <div className="p-2.5 rounded-lg bg-blue-950/20 border border-blue-500/20 text-xs text-blue-300">
            <b>Комментарий учителя:</b> {item.teacherFeedback}
          </div>
        )}
      </div>
    </div>
  );
}
