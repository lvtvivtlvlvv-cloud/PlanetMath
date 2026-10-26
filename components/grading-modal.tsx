"use client";

import React, { useState, useEffect } from "react";
import { AttachmentBadge, AttachmentItem } from "./attachment-badge";
import { X, Check } from "lucide-react";
import { useAppTheme } from "./theme-context";

export interface SubmissionModalData {
  id: string;
  studentName: string;
  subjectName: string;
  homeworkTitle: string;
  content: string;
  submittedAt: string | Date;
  status: string;
  grade: number | null;
  teacherComment: string | null;
  attachments?: AttachmentItem[];
}

interface GradingModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: SubmissionModalData | null;
  onSaveGrade: (id: string, grade: number, comment: string) => Promise<void>;
}

export function GradingModal({
  isOpen,
  onClose,
  submission,
  onSaveGrade,
}: GradingModalProps) {
  const { colorMode } = useAppTheme();
  const isLight = colorMode === "light";

  const [selectedGrade, setSelectedGrade] = useState<number>(5);
  const [comment, setComment] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (submission) {
      setSelectedGrade(submission.grade || 5);
      setComment(submission.teacherComment || "");
    }
  }, [submission]);

  if (!isOpen || !submission) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSaveGrade(submission.id, selectedGrade, comment);
      onClose();
    } catch (err: any) {
      alert(err.message || "Ошибка при сохранении оценки");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 w-full max-w-[100vw] h-[100dvh] flex items-center justify-center p-3 sm:p-4 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] backdrop-blur-md ${
        isLight ? "bg-slate-900/40" : "bg-black/70"
      }`}
    >
      <div className="glass-panel w-full max-w-[min(95vw,calc(100vw-1.5rem))] sm:max-w-lg max-h-[90dvh] flex flex-col overflow-hidden rounded-3xl p-4 sm:p-6 shadow-2xl">
        <div
          className={`flex items-center justify-between gap-2 border-b pb-3 shrink-0 ${
            isLight ? "border-slate-200" : "border-zinc-800"
          }`}
        >
          <div className="min-w-0 flex-1">
            <h3 className={`font-bold text-base truncate ${isLight ? "text-slate-900" : "text-white"}`}>
              Проверка работы
            </h3>
            <p className={`text-xs truncate ${isLight ? "text-slate-500" : "text-zinc-400"}`}>
              {submission.studentName} • {submission.subjectName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`shrink-0 rounded-lg p-1 transition ${
              isLight ? "text-slate-500 hover:text-slate-900 hover:bg-slate-100" : "text-zinc-400 hover:text-white"
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs flex-1 min-h-0 overflow-y-auto pr-1">
          <div>
            <label className={`font-medium ${isLight ? "text-slate-500" : "text-zinc-400"}`}>Задание:</label>
            <div
              className={`mt-1 rounded-xl p-3 text-sm font-semibold border ${
                isLight
                  ? "bg-slate-50 border-slate-200 text-slate-900"
                  : "bg-white/5 border-white/5 text-white"
              }`}
            >
              {submission.homeworkTitle}
            </div>
          </div>

          <div>
            <label className={`font-medium ${isLight ? "text-slate-500" : "text-zinc-400"}`}>Ответ ученика:</label>
            <div
              className={`mt-1 max-h-40 overflow-y-auto rounded-xl p-3 text-xs whitespace-pre-wrap border ${
                isLight
                  ? "bg-slate-50 border-slate-200 text-slate-800"
                  : "bg-white/5 border-white/5 text-zinc-200"
              }`}
            >
              {submission.content || "Без текстового ответа"}
            </div>
          </div>

          {submission.attachments && submission.attachments.length > 0 && (
            <div>
              <label className={`font-medium ${isLight ? "text-slate-500" : "text-zinc-400"}`}>
                Прикрепленные файлы:
              </label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {submission.attachments.map((file) => (
                  <AttachmentBadge key={file.id} file={file} />
                ))}
              </div>
            </div>
          )}

          <div>
            <label className={`font-medium ${isLight ? "text-slate-500" : "text-zinc-400"}`}>Оценка:</label>
            <div className="mt-1.5 flex gap-2">
              {[2, 3, 4, 5].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSelectedGrade(g)}
                  className={`flex h-10 w-12 items-center justify-center rounded-xl font-bold transition cursor-pointer ${
                    selectedGrade === g
                      ? isLight
                        ? "bg-sky-600 text-white shadow-sm"
                        : "bg-cyan-500 text-black shadow-[0_0_12px_rgba(34,211,238,0.5)]"
                      : isLight
                      ? "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={`font-medium ${isLight ? "text-slate-500" : "text-zinc-400"}`}>
              Комментарий для ученика:
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Оставьте замечания или похвалу..."
              className={`mt-1 w-full rounded-2xl border p-3 text-xs focus:outline-none ${
                isLight
                  ? "border-slate-200 bg-white text-slate-900 focus:border-sky-500"
                  : "border-zinc-700 bg-transparent text-white focus:border-cyan-400"
              }`}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`rounded-xl px-4 py-2 font-medium cursor-pointer ${
                isLight
                  ? "hover:bg-slate-100 text-slate-600"
                  : "hover:bg-white/10 text-zinc-300"
              }`}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="theme-btn flex items-center gap-1.5 px-5 py-2 font-bold disabled:opacity-50 cursor-pointer"
            >
              <Check className="h-4 w-4" />
              <span>{loading ? "Сохранение..." : "Выставить оценку"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}