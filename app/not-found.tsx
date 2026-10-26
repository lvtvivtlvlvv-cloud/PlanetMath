import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="font-mono text-5xl font-black text-sky-500">404</span>
      <h1 className="text-xl font-black tracking-tight">Страница не найдена</h1>
      <p className="max-w-md text-sm text-zinc-400">
        Возможно, ссылка устарела. Вернитесь на портал и откройте нужный раздел из меню.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-500"
      >
        На главную
      </Link>
    </div>
  );
}
