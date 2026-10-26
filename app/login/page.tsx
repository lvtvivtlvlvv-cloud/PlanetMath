"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { useAppTheme } from "@/components/theme-context";
import { Card, Input, Button } from "@/components/ui-kit";
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

      <Card padding="lg" className="w-full max-w-md shadow-xl">
        <div className="text-center">
          <div
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border ${
              isLight
                ? "bg-sky-50 border-sky-200 text-sky-600"
                : "bg-sky-500/15 border-sky-500/30 text-sky-400"
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
              isLight ? "text-slate-500" : "text-slate-400"
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
                : "border-rose-500/30 bg-rose-500/10 text-rose-300"
            }`}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label
              className={`block text-xs font-semibold ${
                isLight ? "text-slate-700" : "text-slate-300"
              }`}
            >
              Логин
            </label>
            <Input
              type="text"
              required
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Логин"
              icon={<UserIcon className="h-4 w-4" />}
            />
          </div>

          <div className="space-y-1.5">
            <label
              className={`block text-xs font-semibold ${
                isLight ? "text-slate-700" : "text-slate-300"
              }`}
            >
              Пароль
            </label>
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              icon={<KeyRound className="h-4 w-4" />}
            />
          </div>

          <Button type="submit" variant="primary" size="full" disabled={loading}>
            {loading ? "Авторизация..." : "Войти в систему"}
          </Button>
        </form>
      </Card>
    </div>
  );
}