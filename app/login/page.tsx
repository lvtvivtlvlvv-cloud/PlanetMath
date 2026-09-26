"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { LogIn, KeyRound, User as UserIcon } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
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
      <div className="absolute top-4 sm:top-6 right-4 sm:right-6 right-[max(1rem,env(safe-area-inset-right))] z-40">
        <ThemeSwitcher />
      </div>

      <div className="glass-panel w-full max-w-md rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-black/5 dark:bg-white/10">
            <LogIn className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-black">Школьный Портал</h1>
          <p className="mt-1 text-xs text-zinc-500">Вход для учеников и преподавателей</p>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-500">Логин</label>
            <div className="relative mt-1">
              <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                required
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="admin или логин ученика"
                className="h-10 w-full rounded-xl border border-zinc-200/80 bg-transparent pl-9 pr-3 text-sm focus:outline-none dark:border-zinc-700"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-500">Пароль</label>
            <div className="relative mt-1">
              <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10 w-full rounded-xl border border-zinc-200/80 bg-transparent pl-9 pr-3 text-sm focus:outline-none dark:border-zinc-700"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {loading ? "Авторизация..." : "Войти в систему"}
          </button>
        </form>

        <div className="mt-6 border-t border-zinc-200/40 pt-4 text-center text-[11px] text-zinc-400">
          Демо: admin / admin123 (учитель) | user / user123 (ученик)
        </div>
      </div>
    </div>
  );
}