"use client";

import React, { useState, useEffect } from "react";
import { useAppTheme, ThemeType } from "./theme-context";
import { Sparkles, Globe, Flower2, ChevronDown, X, Check, Palette } from "lucide-react";

interface ThemeMeta {
  id: ThemeType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  activeRing: string;
}

const THEME_OPTIONS: ThemeMeta[] = [
  {
    id: "standart",
    label: "standart",
    description: "Строгий изумрудный интерфейс с чистыми контрастными панелями",
    icon: Sparkles,
    accentColor: "#10B981",
    accentBg: "bg-emerald-500/15",
    accentBorder: "border-emerald-500/40",
    activeRing: "ring-2 ring-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]",
  },
  {
    id: "planet",
    label: "planet",
    description: "Космический стиль с 3D Землей и интерактивным инерционным циферблатом",
    icon: Globe,
    accentColor: "#38BDF8",
    accentBg: "bg-sky-500/15",
    accentBorder: "border-sky-500/40",
    activeRing: "ring-2 ring-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.35)]",
  },
  {
    id: "garden",
    label: "garden",
    description: "Органический ботанический стиль со сверхскругленной соединенной таблицей",
    icon: Flower2,
    accentColor: "#FEC868",
    accentBg: "bg-[#FEC868]/15",
    accentBorder: "border-[#FEC868]/40",
    activeRing: "ring-2 ring-[#FEC868] shadow-[0_0_20px_rgba(254,200,104,0.35)]",
  },
];

export function ThemeSwitcher() {
  const { theme, setTheme, mounted } = useAppTheme();
  const [isOpen, setIsOpen] = useState(false);

  // Закрытие по клавише Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!mounted) {
    return (
      <div className="h-9 w-28 sm:w-36 rounded-xl bg-white/5 border border-white/10 animate-pulse shrink-0" />
    );
  }

  const currentTheme = theme === "garden" ? "garden" : theme === "planet" ? "planet" : "standart";
  const currentOption = THEME_OPTIONS.find((t) => t.id === currentTheme) || THEME_OPTIONS[0];
  const CurrentIcon = currentOption.icon;

  return (
    <>
      {/* Кнопка-триггер всплывающего окна темы */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title="Сменить тему оформления"
        className="group relative flex items-center gap-2 rounded-xl border border-white/15 bg-black/40 hover:bg-white/10 px-3 py-1.5 text-xs font-semibold shadow-inner backdrop-blur-md transition-all select-none shrink-0 min-h-[36px] max-w-full"
        style={{
          marginRight: "env(safe-area-inset-right, 0px)",
        }}
      >
        <span
          className="flex h-5 w-5 items-center justify-center rounded-lg transition-transform group-hover:scale-110"
          style={{ backgroundColor: `${currentOption.accentColor}25` }}
        >
          <CurrentIcon
            className="h-3.5 w-3.5"
            style={{ color: currentOption.accentColor }}
          />
        </span>

        <span className="font-medium text-zinc-200 capitalize">
          {currentOption.label}
        </span>

        <span
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: currentOption.accentColor }}
        />

        <ChevronDown className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-200 transition-transform group-hover:translate-y-0.5" />
      </button>

      {/* Всплывающее окно (модальное окно, как на расписании занятий) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="theme-modal-title"
            className="glass-panel relative w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl border border-white/15 bg-[#0C1017]/95 backdrop-blur-2xl"
          >
            {/* Шапка модального окна */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-zinc-200">
                  <Palette className="h-4 w-4" />
                </div>
                <div>
                  <h3 id="theme-modal-title" className="font-bold text-base text-zinc-100">
                    Тема оформления
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Выберите визуальный стиль интерфейса
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Закрыть"
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Карточки выбора тем */}
            <div className="mt-4 space-y-2.5">
              {THEME_OPTIONS.map((opt) => {
                const isSelected = currentTheme === opt.id;
                const IconComponent = opt.icon;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setTheme(opt.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl text-left transition-all duration-200 border ${
                      isSelected
                        ? `${opt.activeRing} ${opt.accentBg} ${opt.accentBorder} bg-opacity-30`
                        : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-zinc-300"
                    }`}
                  >
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10"
                      style={{
                        backgroundColor: `${opt.accentColor}20`,
                        color: opt.accentColor,
                      }}
                    >
                      <IconComponent className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-zinc-100">
                          {opt.label}
                        </span>
                        {isSelected && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                            style={{
                              backgroundColor: `${opt.accentColor}30`,
                              color: opt.accentColor,
                            }}
                          >
                            Активна
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">
                        {opt.description}
                      </p>
                    </div>

                    <div className="shrink-0 flex items-center justify-center">
                      {isSelected ? (
                        <div
                          className="flex h-6 w-6 items-center justify-center rounded-full text-black font-black"
                          style={{ backgroundColor: opt.accentColor }}
                        >
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="h-5 w-5 rounded-full border border-zinc-600/60" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Подвал модального окна */}
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl px-5 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10 transition"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
