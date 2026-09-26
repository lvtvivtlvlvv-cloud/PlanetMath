"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAppTheme, ThemeType } from "./theme-context";
import { Palette, Check, ChevronDown } from "lucide-react";

const THEMES: { id: ThemeType; name: string; desc: string; colors: string[] }[] = [
  {
    id: "base",
    name: "Базовая",
    desc: "Классический светлый дневник",
    colors: ["#18181b", "#10b981", "#71717a"],
  },
  {
    id: "standart-plus",
    name: "Standart +",
    desc: "Liquid Glass / Неоновый изумруд",
    colors: ["#2EDC85", "#0F3826", "#040A07"],
  },
  {
    id: "clock",
    name: "Clock",
    desc: "Планетарный циферблат с Землёй",
    colors: ["#38BDF8", "#1E3A8A", "#06080C"],
  },
  {
    id: "garden",
    name: "Garden",
    desc: "Скандинавский мох и тёплое золото",
    colors: ["#FEC868", "#ABC270", "#182019"],
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
    return <div className="h-8 w-28 rounded-xl bg-white/10 animate-pulse" />;
  }

  const currentThemeObj = THEMES.find((t) => t.id === theme) || THEMES[0];

  return (
    <div className="relative inline-flex items-center" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur-md transition hover:bg-white/20 text-zinc-100 shadow-sm"
      >
        <Palette className="h-3.5 w-3.5 text-zinc-300" />
        <span>{currentThemeObj.name}</span>
        <div className="flex -space-x-1">
          {currentThemeObj.colors.map((c, i) => (
            <span
              key={i}
              className="inline-block h-2.5 w-2.5 rounded-full border border-black/40"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <ChevronDown className={`h-3 w-3 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-72 rounded-2xl border border-white/15 bg-[#0C1017]/95 p-2 shadow-2xl backdrop-blur-2xl">
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Оформление интерфейса
          </div>
          <div className="space-y-1">
            {THEMES.map((t) => {
              const isSelected = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setTheme(t.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
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
                  {isSelected && <Check className="h-4 w-4 text-emerald-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}