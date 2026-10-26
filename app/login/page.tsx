"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { useAppTheme } from "@/components/theme-context";
import { LogIn, KeyRound, User as UserIcon } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { colorMode } = useAppTheme();
  const isLight = colorMode === "light";

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Неверный логин или пароль");

      if (data.role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/student");
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div
        className="absolute z-40"
        style={{
          top: "max(1rem, env(safe-area-inset-top))",
          right: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <ThemeSwitcher modeOnly />
      </div>

      <div
        className={`glass-panel w-full max-w-md rounded-2xl p-6 sm:p-8 transition-colors ${
          isLight
            ? "bg-white border-slate-200 shadow-lg"
            : "bg-[#0F172A]/85 border-cyan-500/20 shadow-2xl backdrop-blur-xl"
        }`}
      >
        <div className="text-center">
          <div
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border ${
              isLight
                ? "bg-sky-50 border-sky-200 text-sky-600"
                : "bg-sky-500/15 border-sky-400/30 text-sky-300"
            }`}
          >
            <LogIn className="h-6 w-6" />
          </div>
          <h1
            className={`mt-4 text-2xl font-black tracking-tight ${
              isLight ? "text-slate-900" : "text-white"
            }`}
          >
            Школьный Портал
          </h1>
          <p
            className={`mt-1 text-xs ${
              isLight ? "text-slate-500" : "text-zinc-400"
            }`}
          >
            Вход для учеников и преподавателей
          </p>
        </div>

        {error && (
          <div
            className={`mt-4 rounded-xl border p-3 text-center text-xs font-medium ${
              isLight
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-red-500/20 bg-red-500/10 text-red-400"
            }`}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              className={`text-xs font-semibold ${
                isLight ? "text-slate-700" : "text-zinc-300"
              }`}
            >
              Логин
            </label>
            <div className="relative mt-1">
              <UserIcon
                className={`absolute left-3 top-2.5 h-4 w-4 ${
                  isLight ? "text-slate-400" : "text-zinc-400"
                }`}
              />
              <input
                type="text"
                required
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Логин"
                className={`h-10 w-full rounded-xl border pl-9 pr-3 text-sm focus:outline-none transition-colors ${
                  isLight
                    ? "border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-sky-500"
                    : "border-zinc-700 bg-slate-900/70 text-white placeholder-zinc-500 focus:border-sky-400"
                }`}
              />
            </div>
          </div>

          <div>
            <label
              className={`text-xs font-semibold ${
                isLight ? "text-slate-700" : "text-zinc-300"
              }`}
            >
              Пароль
            </label>
            <div className="relative mt-1">
              <KeyRound
                className={`absolute left-3 top-2.5 h-4 w-4 ${
                  isLight ? "text-slate-400" : "text-zinc-400"
                }`}
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`h-10 w-full rounded-xl border pl-9 pr-3 text-sm focus:outline-none transition-colors ${
                  isLight
                    ? "border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-sky-500"
                    : "border-zinc-700 bg-slate-900/70 text-white placeholder-zinc-500 focus:border-sky-400"
                }`}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ color: "#FFFFFF" }}
            className={`w-full rounded-xl py-2.5 text-sm font-semibold text-white transition cursor-pointer disabled:opacity-50 ${
              isLight
                ? "bg-sky-600 hover:bg-sky-700 shadow-sm"
                : "bg-sky-600 hover:bg-sky-500 shadow-[0_0_20px_rgba(14,165,233,0.3)]"
            }`}
          >
            {loading ? "Авторизация..." : "Войти в систему"}
          </button>
        </form>
      </div>
    </div>
  );
}