"use client";

import React, { useState, useEffect } from "react";
import { AttachmentBadge, AttachmentItem } from "./attachment-badge";
import { X, Check } from "lucide-react";

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
  const [selectedGrade, setSelectedGrade] = useState<number>(5);
  const [comment, setComment] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (submission) {
      setSelectedGrade(submission.grade || 5);
      setComment(submission.teacherComment || "");
    }
  }, [submission]);

  // Защита от рендера вхолостую
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-lg rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div>
            <h3 className="font-bold text-base text-white">Проверка работы</h3>
            <p className="text-xs text-zinc-400">
              {submission.studentName} • {submission.subjectName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="font-medium text-zinc-400">Задание:</label>
            <div className="mt-1 rounded-xl bg-white/5 p-3 text-sm font-semibold text-white">
              {submission.homeworkTitle}
            </div>
          </div>

          <div>
            <label className="font-medium text-zinc-400">Ответ ученика:</label>
            <div className="mt-1 max-h-40 overflow-y-auto rounded-xl bg-white/5 p-3 text-xs text-zinc-200 whitespace-pre-wrap">
              {submission.content || "Без текстового ответа"}
            </div>
          </div>

          {submission.attachments && submission.attachments.length > 0 && (
            <div>
              <label className="font-medium text-zinc-400">Прикрепленные файлы:</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {submission.attachments.map((file) => (
                  <AttachmentBadge key={file.id} file={file} />
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="font-medium text-zinc-400">Оценка:</label>
            <div className="mt-1.5 flex gap-2">
              {[2, 3, 4, 5].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSelectedGrade(g)}
                  className={`flex h-10 w-12 items-center justify-center rounded-xl font-bold transition ${
                    selectedGrade === g
                      ? "bg-cyan-500 text-black shadow-[0_0_12px_rgba(34,211,238,0.5)]"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-medium text-zinc-400">Комментарий для ученика:</label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Оставьте замечания или похвалу..."
              className="mt-1 w-full rounded-2xl border border-zinc-700 bg-transparent p-3 text-xs focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 font-medium hover:bg-white/10 text-zinc-300"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="theme-btn flex items-center gap-1.5 px-5 py-2 font-bold disabled:opacity-50"
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