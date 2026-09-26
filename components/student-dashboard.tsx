"use client";

import React, { useState, useMemo, useEffect } from "react";
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
import { ThemeSwitcher } from "./theme-switcher";
import { ThemeCalendarStrip } from "./theme-calendar-strip";
import { useAppTheme } from "./theme-context";
import { logoutAction, submitHomeworkAction } from "@/app/student/actions";
import { AttachmentBadge } from "./attachment-badge";
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Paperclip,
  Clock,
  Send,
  X,
} from "lucide-react";

const SHORT_WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

interface StudentDashboardProps {
  serverDate?: string;
  user: {
    id: string;
    fullName: string;
    login: string;
    className: string;
  };
  scheduleItems: Array<{
    id: string;
    dayOfWeek: number;
    lessonNumber: number;
    startTime: string;
    endTime: string;
    subjectName: string;
    room: string;
    teacherName: string;
  }>;
  homeworks: Array<{
    id: string;
    subjectName: string;
    targetDate: string;
    title: string;
    description: string;
    attachments: Array<{
      id: string;
      fileName: string;
      fileUrl: string;
      fileType: string;
      expiresAt: string | Date;
    }>;
    submission?: {
      id: string;
      content: string;
      submittedAt: string | Date;
      status: string;
      grade: number | null;
      teacherComment: string | null;
    } | null;
  }>;
}

export function StudentDashboard({ user, scheduleItems, homeworks, serverDate }: StudentDashboardProps) {
  const { theme } = useAppTheme();

  // Синхронизация времени с хостом компьютера (2026 год)
  const hostToday = useMemo(() => {
    return serverDate ? parseISO(serverDate) : new Date();
  }, [serverDate]);

  const [currentDate, setCurrentDate] = useState<Date>(hostToday);

  // Периодическая проверка системного времени компьютера
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

  // Понедельник текущей недели
  const monday = useMemo(() => {
    return startOfWeek(currentDate, { weekStartsOn: 1 });
  }, [currentDate]);

  // День недели: 1 (Пн) .. 7 (Вс)
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
      .filter((i) => Number(i.dayOfWeek) === selectedDayOfWeek)
      .sort((a, b) => a.lessonNumber - b.lessonNumber);
  }, [scheduleItems, selectedDayOfWeek]);

  const [activeHwModal, setActiveHwModal] = useState<typeof homeworks[0] | null>(null);
  const [submitText, setSubmitText] = useState("");
  const [submitFiles, setSubmitFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitSolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHwModal) return;
    setIsSubmitting(true);
    try {
      let attachments: any[] = [];
      if (submitFiles.length > 0) {
        const uploadFd = new FormData();
        submitFiles.forEach((f) => uploadFd.append("files", f));
        const res = await fetch("/api/upload", { method: "POST", body: uploadFd });
        const data = await res.json();
        if (data.files) attachments = data.files;
      }

      await submitHomeworkAction({
        homeworkId: activeHwModal.id,
        studentId: user.id,
        content: submitText,
        attachments,
      });

      setActiveHwModal(null);
      setSubmitText("");
      setSubmitFiles([]);
    } catch (err: any) {
      alert(err.message || "Ошибка отправки работы");
    } finally {
      setIsSubmitting(false);
    }
  };

  const roomColorClass =
    theme === "clock"
      ? "theme-room-text"
      : theme === "garden"
      ? "text-[#FEC868]"
      : "text-emerald-400";

  const hwBadgeClass =
    theme === "clock"
      ? "theme-hw-chip"
      : theme === "garden"
      ? "bg-black/25 text-[#FEC868] border border-[#FEC868]/30"
      : "bg-emerald-950/50 text-emerald-300 border border-emerald-500/20";

  return (
    <div className="min-h-screen space-y-6 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
      <header className="flex flex-col gap-3 sm:gap-4 border-b border-zinc-200/40 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Электронный Дневник</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {user.fullName} • Класс: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{user.className}</span>
          </p>
        </div>
        <div className="flex items-center justify-end gap-2.5 sm:gap-3 shrink-0">
          <ThemeSwitcher />
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl border border-red-200/80 bg-red-50/70 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400 min-h-[36px]"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Выйти</span>
            </button>
          </form>
        </div>
      </header>

      <section className="space-y-4">
        <div className="glass-panel flex items-center justify-between rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold">Расписание:</span>
            <span className="rounded-lg bg-black/10 px-2.5 py-1 text-xs font-semibold dark:bg-white/10">
              {monthTitle}
            </span>
          </div>

          <div className="flex items-center rounded-lg border border-zinc-700">
            <button
              type="button"
              onClick={() => handlePrevWeek(1)}
              className="p-1.5 hover:bg-white/5"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleNextWeek(1)}
              className="p-1.5 hover:bg-white/5"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-4">
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
            className={`${
              weekAnimDirection === "right"
                ? "animate-week-right"
                : weekAnimDirection === "left"
                ? "animate-week-left"
                : ""
            } ${
              theme === "garden"
                ? "rounded-b-[38px] rounded-tr-[38px] bg-[#FEC868] p-5 sm:p-6 shadow-2xl text-[#473C33]"
                : "space-y-3 pt-1"
            }`}
          >
            {/* ПОДПИСЬ ТЕКУЩЕЙ ВЫБРАННОЙ ДАТЫ */}
            <div className="mb-3">
              <span
                className={`font-bold text-sm tracking-wide ${
                  theme === "garden"
                    ? "text-[#473C33]"
                    : theme === "clock"
                    ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.4)]"
                    : (theme === "standart" || theme === "standart-plus")
                    ? "text-emerald-400 font-bold"
                    : "text-zinc-800 dark:text-zinc-200"
                }`}
              >
                {selectedDayOfWeek === 7
                  ? `Воскресенье, ${activeDateFormatted} — Выходной день`
                  : `Уроки на ${activeDateFormatted} (${SHORT_WEEKDAYS[selectedDayOfWeek - 1].toUpperCase()})`}
              </span>
            </div>

            <div className="space-y-3 min-h-[380px]">
              {activeDayLessons.length === 0 ? (
                <div
                  className={`flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed p-8 text-center text-sm ${
                    theme === "garden"
                      ? "border-[#473C33]/30 text-[#473C33]"
                      : theme === "clock"
                      ? "border-cyan-500/20 text-cyan-300/80 bg-cyan-950/10"
                      : "border-zinc-800 text-zinc-400"
                  }`}
                >
                  {selectedDayOfWeek === 7 ? (
                    <>
                      <span className="text-base font-bold text-cyan-300">Воскресенье — выходной</span>
                      <span className="text-xs text-zinc-400 mt-1">В этот день занятий нет, уроки начнутся в понедельник</span>
                    </>
                  ) : (
                    <span>В этот день занятий нет</span>
                  )}
                </div>
              ) : (
                activeDayLessons.map((l) => {
                  const targetDayStr = format(currentDate, "yyyy-MM-dd");
                  const attachedHw = homeworks.filter(
                    (h) =>
                      h.targetDate === targetDayStr &&
                      h.subjectName.trim().toLowerCase() === l.subjectName.trim().toLowerCase()
                  );

                  return (
                    <div key={l.id} className="flex items-stretch gap-3 sm:gap-4">
                      <div className="flex w-12 sm:w-14 flex-col justify-between py-1 text-right shrink-0">
                        <span
                          className={`text-xs sm:text-sm font-bold ${
                            theme === "garden" ? "text-[#473C33]" : "text-zinc-100"
                          }`}
                        >
                          {l.startTime}
                        </span>
                        <span
                          className={`text-xs sm:text-sm font-medium ${
                            theme === "garden" ? "text-[#473C33]/70" : "text-zinc-400"
                          }`}
                        >
                          {l.endTime}
                        </span>
                      </div>

                      <div
                        className={`group flex-1 rounded-2xl sm:rounded-3xl p-4 shadow-sm transition ${
                          theme === "garden"
                            ? "bg-[#182019] text-white border border-[#2D3A2F]"
                            : "glass-panel glass-interactive"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className={`text-xs font-semibold ${roomColorClass}`}>
                              {l.room.toLowerCase().startsWith("каб") ? l.room : `каб. ${l.room}`}
                            </div>
                            <div className="mt-0.5 text-xs text-zinc-400">{l.teacherName}</div>
                          </div>
                        </div>

                        <div className="mt-3 text-sm sm:text-base font-bold text-white">{l.subjectName}</div>

                        {attachedHw.length > 0 && (
                          <div className="mt-3 space-y-2 border-t border-zinc-700/60 pt-2">
                            {attachedHw.map((h) => {
                              const sub = h.submission;
                              return (
                                <div
                                  key={h.id}
                                  className={`rounded-xl p-3 ${
                                    theme === "clock"
                                      ? "bg-[#090D15]/80 border border-cyan-500/25"
                                      : "border border-zinc-700/60 bg-black/20"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className={`flex items-center gap-1.5 font-semibold text-xs ${roomColorClass}`}>
                                        <BookOpen className="h-3.5 w-3.5" />
                                        <span>ДЗ: {h.title}</span>
                                      </div>
                                      <p className="mt-1 text-xs text-zinc-400">{h.description}</p>
                                    </div>

                                    {sub?.grade ? (
                                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold text-cyan-300 border border-cyan-400/40 shadow-[0_0_10px_rgba(56,189,248,0.4)]">
                                        {sub.grade}
                                      </span>
                                    ) : sub ? (
                                      <span className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
                                        <Clock className="h-3 w-3" />
                                        Сдано
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setActiveHwModal(h)}
                                        className="theme-btn px-3 py-1 text-xs font-bold"
                                      >
                                        Сдать
                                      </button>
                                    )}
                                  </div>

                                  {h.attachments.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {h.attachments.map((file) => (
                                        <AttachmentBadge key={file.id} file={file} />
                                      ))}
                                    </div>
                                  )}

                                  {sub?.teacherComment && (
                                    <div className={`mt-2 rounded-lg p-2 text-xs ${
                                      theme === "clock"
                                        ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                                        : "bg-emerald-500/10 text-emerald-300"
                                    }`}>
                                      <span className="font-semibold">Комментарий учителя: </span>
                                      {sub.teacherComment}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
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
      </section>

      {/* Модальное окно сдачи ДЗ */}
      {activeHwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-bold text-base">Сдача домашнего задания</h3>
                <p className="text-xs text-zinc-400">{activeHwModal.subjectName}: {activeHwModal.title}</p>
              </div>
              <button onClick={() => setActiveHwModal(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSolution} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="font-medium text-zinc-400">Ваш ответ или комментарий:</label>
                <textarea
                  rows={4}
                  required
                  value={submitText}
                  onChange={(e) => setSubmitText(e.target.value)}
                  placeholder="Опишите выполненное задание..."
                  className="mt-1 w-full rounded-2xl border border-zinc-700 bg-transparent p-3 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="font-medium text-zinc-400">Прикрепить фото или файл:</label>
                <div className="mt-1">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-white/5">
                    <Paperclip className="h-3.5 w-3.5" />
                    <span>Выбрать файлы</span>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          setSubmitFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                {submitFiles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {submitFiles.map((file, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-medium"
                      >
                        <span className="max-w-[140px] truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setSubmitFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-zinc-400 hover:text-red-400"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveHwModal(null)}
                  className="rounded-lg px-4 py-2 font-medium hover:bg-white/10"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="theme-btn flex items-center gap-1.5 px-5 py-2 font-bold disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{isSubmitting ? "Отправка..." : "Отправить"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}