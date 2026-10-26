"use client";

import React, { useState, useEffect } from "react";
import { AttachmentBadge, AttachmentItem } from "./attachment-badge";
import { Check, ClipboardCheck } from "lucide-react";
import { useAppTheme } from "./theme-context";
import { Modal, Button, Textarea } from "./ui-kit";

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
  const { isLight } = useAppTheme();

  const [selectedGrade, setSelectedGrade] = useState<number>(5);
  const [comment, setComment] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (submission) {
      setSelectedGrade(submission.grade || 5);
      setComment(submission.teacherComment || "");
    }
  }, [submission]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submission) return;
    setLoading(true);
    try {
      await onSaveGrade(submission.id, selectedGrade, comment);
      onClose();
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen && !!submission}
      onClose={onClose}
      title="Проверка работы"
      subtitle={submission ? `${submission.studentName} • ${submission.subjectName}` : ""}
      icon={<ClipboardCheck className="w-4 h-4" />}
      maxWidth="lg"
    >
      {submission && (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              Задание:
            </label>
            <div
              className={`rounded-xl p-3.5 text-sm font-semibold border ${
                isLight
                  ? "bg-slate-50 border-slate-200 text-slate-900"
                  : "bg-slate-800/60 border-slate-700/80 text-white"
              }`}
            >
              {submission.homeworkTitle}
            </div>
          </div>

          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              Ответ ученика:
            </label>
            <div
              className={`max-h-40 overflow-y-auto rounded-xl p-3.5 text-xs sm:text-sm whitespace-pre-wrap border ${
                isLight
                  ? "bg-slate-50 border-slate-200 text-slate-800"
                  : "bg-slate-800/60 border-slate-700/80 text-slate-200"
              }`}
            >
              {submission.content || "Без текстового ответа"}
            </div>
          </div>

          {submission.attachments && submission.attachments.length > 0 && (
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Прикрепленные файлы:
              </label>
              <div className="flex flex-wrap gap-2">
                {submission.attachments.map((file) => (
                  <AttachmentBadge key={file.id} file={file} />
                ))}
              </div>
            </div>
          )}

          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              Оценка:
            </label>
            <div className="flex gap-2">
              {[2, 3, 4, 5].map((g) => (
                <Button
                  key={g}
                  type="button"
                  variant={selectedGrade === g ? "primary" : "secondary"}
                  size="md"
                  onClick={() => setSelectedGrade(g)}
                  className="w-12 font-bold"
                >
                  {g}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              Комментарий для ученика:
            </label>
            <Textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Оставьте замечания или похвалу..."
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              <Check className="h-4 w-4" />
              <span>{loading ? "Сохранение..." : "Выставить оценку"}</span>
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}