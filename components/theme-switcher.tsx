"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAppTheme, ThemeType } from "./theme-context";
import { Palette, Check, ChevronDown } from "lucide-react";

const THEMES: { id: ThemeType; name: string; desc: string; colors: string[] }[] = [
  {
    id: "standart",
    name: "Стандарт",
    desc: "Современный изумрудный интерфейс",
    colors: ["#10b981", "#064e3b", "#070c09"],
  },
  {
    id: "base",
    name: "Базовая",
    desc: "Классический светлый дневник",
    colors: ["#18181b", "#10b981", "#71717a"],
  },
  {
    id: "clock",
    name: "Clock",
    desc: "Планетарный циферблат с Землёй",
    colors: ["#38bdf8", "#1e3a8a", "#06080c"],
  },
  {
    id: "garden",
    name: "Garden",
    desc: "Скандинавский мох и тёплое золото",
    colors: ["#fec868", "#abc270", "#182019"],
  },
];

export function ThemeSwitcher() {
  const { theme, setTheme, mounted } = useAppTheme();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!mounted) {
    return <div className="h-9 w-24 sm:w-28 rounded-xl bg-white/10 animate-pulse shrink-0" />;
  }

  const normalizedTheme = theme === "standart-plus" ? "standart" : theme;
  const currentThemeObj = THEMES.find((t) => t.id === normalizedTheme) || THEMES[0];

  return (
    <div className="relative inline-flex items-center" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 sm:gap-2 rounded-xl border border-white/15 bg-white/10 px-2.5 sm:px-3 py-1.5 text-xs font-semibold backdrop-blur-md transition hover:bg-white/20 text-zinc-100 shadow-sm shrink-0 min-h-[36px]"
      >
        <Palette className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
        <span className="whitespace-nowrap">{currentThemeObj.name}</span>
        <div className="flex -space-x-1 shrink-0">
          {currentThemeObj.colors.map((c, i) => (
            <span
              key={i}
              className="inline-block h-2.5 w-2.5 rounded-full border border-black/40"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <ChevronDown className={`h-3 w-3 text-zinc-400 transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-white/15 bg-[#0C1017]/95 p-2 shadow-2xl backdrop-blur-xl">
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Оформление интерфейса
          </div>
          <div className="space-y-1">
            {THEMES.map((t) => {
              const isSelected = normalizedTheme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setTheme(t.id);
                    setOpen(false);
                  }}
                  className={`flex w-full min-h-[44px] items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                    isSelected
                      ? "bg-white/15 font-semibold text-white shadow-inner"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span>{t.name}</span>
                      <div className="flex -space-x-1">
                        {t.colors.map((c, i) => (
                          <span
                            key={i}
                            className="inline-block h-2 w-2 rounded-full border border-black/30"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="text-[10px] text-zinc-500">{t.desc}</div>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}