export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
      <span className="text-xs font-medium text-zinc-400">Загрузка…</span>
    </div>
  );
}
