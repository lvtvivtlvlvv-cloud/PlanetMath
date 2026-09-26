"use client";
import React, { useState } from "react";

export interface ScheduleItemData {
  id: string;
  dayOfWeek: number;
  lessonNumber: number;
  startTime: string;
  endTime: string;
  subjectName: string;
  room: string;
  teacherName: string;
}

const DAYS = [
  { id: 1, short: "Пн", full: "Понедельник" },
  { id: 2, short: "Вт", full: "Вторник" },
  { id: 3, short: "Ср", full: "Среда" },
  { id: 4, short: "Чт", full: "Четверг" },
  { id: 5, short: "Пт", full: "Пятница" },
  { id: 6, short: "Сб", full: "Суббота" },
];

export function ScheduleView({ items }: { items: ScheduleItemData[] }) {
  const [activeDay, setActiveDay] = useState<number>(1);
  const filterByDay = (day: number) =>
    items.filter((i) => i.dayOfWeek === day).sort((a, b) => a.lessonNumber - b.lessonNumber);

  return (
    <div className="w-full">
      <div className="md:hidden">
        <div className="flex space-x-1 border-b border-zinc-200 pb-2 dark:border-zinc-800">
          {DAYS.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveDay(d.id)}
              className={`flex-1 rounded-md py-2 text-center text-sm font-medium transition ${
                activeDay === d.id
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {d.short}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {filterByDay(activeDay).length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">Занятий нет</p>
          ) : (
            filterByDay(activeDay).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center space-x-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold dark:bg-zinc-800">
                    {item.lessonNumber}
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold">{item.subjectName}</h4>
                    <p className="text-xs text-zinc-500">
                      Каб. {item.room} • {item.teacherName}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-zinc-400">{item.startTime}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-6 gap-3">
        {DAYS.map((day) => {
          const dayItems = filterByDay(day.id);
          return (
            <div
              key={day.id}
              className="flex flex-col rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <h3 className="border-b border-zinc-100 pb-2 text-sm font-bold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                {day.full}
              </h3>
              <div className="mt-2 flex-1 space-y-2">
                {dayItems.length === 0 ? (
                  <span className="block text-xs text-zinc-400">Нет уроков</span>
                ) : (
                  dayItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded border border-zinc-100 bg-zinc-50 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <div className="flex justify-between font-medium">
                        <span>{item.lessonNumber}. {item.subjectName}</span>
                        <span className="text-[10px] text-zinc-400">{item.startTime}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500">Каб. {item.room}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}