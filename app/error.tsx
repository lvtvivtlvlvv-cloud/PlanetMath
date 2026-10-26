"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-2xl">
        !
      </div>
      <h1 className="text-xl font-black tracking-tight">Что-то пошло не так</h1>
      <p className="max-w-md text-sm text-zinc-400">
        Не удалось загрузить страницу. Попробуйте обновить — данные, которые вы уже отправили,
        скорее всего сохранились.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-500"
        >
          Попробовать снова
        </button>
        <a
          href="/login"
          className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/5"
        >
          На страницу входа
        </a>
      </div>
    </div>
  );
}
