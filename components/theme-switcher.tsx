"use client";

import React from "react";
import { useAppTheme, ThemeType } from "./theme-context";
import { Sparkles, Globe, Flower2 } from "lucide-react";

interface ThemeOption {
  id: ThemeType;
  label: string;
  mobileLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  activeBg: string;
  activeText: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "standart",
    label: "Стандарт",
    mobileLabel: "Станд",
    icon: Sparkles,
    accentColor: "#10b981",
    activeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]",
    activeText: "text-emerald-300",
  },
  {
    id: "clock",
    label: "Clock",
    mobileLabel: "Clock",
    icon: Globe,
    accentColor: "#38bdf8",
    activeBg: "bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-[0_0_12px_rgba(56,189,248,0.25)]",
    activeText: "text-sky-300",
  },
  {
    id: "garden",
    label: "Garden",
    mobileLabel: "Garden",
    icon: Flower2,
    accentColor: "#fec868",
    activeBg: "bg-[#FEC868]/20 text-[#FEC868] border-[#FEC868]/40 shadow-[0_0_12px_rgba(254,200,104,0.25)]",
    activeText: "text-[#FEC868]",
  },
];

export function ThemeSwitcher() {
  const { theme, setTheme, mounted } = useAppTheme();

  if (!mounted) {
    return (
      <div className="h-9 w-48 sm:w-60 rounded-xl bg-white/5 border border-white/10 animate-pulse shrink-0" />
    );
  }

  const currentTheme = (theme === "clock" || theme === "garden") ? theme : "standart";

  return (
    <div
      role="radiogroup"
      aria-label="Переключатель темы оформления"
      className="relative inline-flex items-center rounded-xl border border-white/10 bg-black/40 p-0.5 sm:p-1 shadow-inner backdrop-blur-md max-w-full overflow-hidden shrink min-h-[36px]"
      style={{
        marginRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      {THEME_OPTIONS.map((opt) => {
        const isSelected = currentTheme === opt.id;
        const IconComponent = opt.icon;

        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => setTheme(opt.id)}
            className={`relative flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg px-2 sm:px-3 py-1.5 text-xs font-semibold transition-all duration-200 select-none shrink-0 ${
              isSelected
                ? `${opt.activeBg} border font-bold scale-[1.02]`
                : "border border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
            }`}
          >
            <IconComponent
              className={`h-3.5 w-3.5 shrink-0 ${
                isSelected ? opt.activeText : "text-zinc-500"
              }`}
            />
            <span className="hidden sm:inline whitespace-nowrap">{opt.label}</span>
            <span className="inline sm:hidden whitespace-nowrap text-[11px] font-medium">
              {opt.mobileLabel}
            </span>
            <span
              className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
              style={{
                backgroundColor: opt.accentColor,
                opacity: isSelected ? 1 : 0.45,
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
