"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  FileText,
  AlertTriangle,
  ExternalLink,
  Image as ImageIcon,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import { useAppTheme } from "./theme-context";

export interface AttachmentItem {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  expiresAt?: string | Date;
}

export function AttachmentBadge({ file }: { file?: AttachmentItem | null }) {
  const { colorMode } = useAppTheme();
  const isLight = colorMode === "light";

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!file || !file.fileUrl) return null;

  let isExpired = false;
  try {
    if (file.expiresAt) {
      isExpired = new Date(file.expiresAt).getTime() <= Date.now();
    }
  } catch {
    isExpired = false;
  }

  if (isExpired) {
    return (
      <div
        className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs ${
          isLight
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-red-500/30 bg-red-500/10 text-red-400"
        }`}
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Файл удален по истечении срока</span>
      </div>
    );
  }

  const isImage =
    file.fileType?.startsWith("image/") ||
    /\.(jpeg|jpg|png|webp|gif|bmp)$/i.test(file.fileName || "") ||
    /\.(jpeg|jpg|png|webp|gif|bmp)$/i.test(file.fileUrl || "");

  return (
    <>
      {isImage ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setZoom(1);
            setIsLightboxOpen(true);
          }}
          className={`group inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition cursor-pointer ${
            isLight
              ? "border-slate-200 bg-white text-slate-800 hover:border-sky-300 hover:bg-sky-50/70 shadow-2xs"
              : "border-white/10 bg-white/5 text-zinc-200 hover:border-white/20 hover:bg-white/10"
          }`}
        >
          <ImageIcon className={`h-4 w-4 shrink-0 ${isLight ? "text-emerald-600" : "text-emerald-400"}`} />
          <span
            className={`max-w-[170px] truncate font-medium ${
              isLight ? "text-slate-800 group-hover:text-sky-800" : "text-zinc-200 group-hover:text-white"
            }`}
          >
            {file.fileName || "Фото"}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
              isLight ? "bg-slate-100 text-slate-600" : "bg-white/10 text-zinc-400"
            }`}
          >
            ФОТО
          </span>
        </button>
      ) : (
        <a
          href={file.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`group inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition ${
            isLight
              ? "border-slate-200 bg-white text-slate-800 hover:border-sky-300 hover:bg-sky-50/70 shadow-2xs"
              : "border-white/10 bg-white/5 text-zinc-200 hover:border-white/20 hover:bg-white/10"
          }`}
        >
          <FileText className={`h-4 w-4 shrink-0 ${isLight ? "text-sky-600" : "text-cyan-400"}`} />
          <span
            className={`max-w-[170px] truncate font-medium ${
              isLight ? "text-slate-800 group-hover:text-sky-800" : "text-zinc-200 group-hover:text-white"
            }`}
          >
            {file.fileName || "Файл"}
          </span>
          <ExternalLink
            className={`h-3 w-3 transition ${
              isLight ? "text-slate-400 group-hover:text-sky-600" : "text-zinc-500 group-hover:text-zinc-300"
            }`}
          />
        </a>
      )}

      {mounted &&
        isLightboxOpen &&
        createPortal(
          <div
            onClick={() => setIsLightboxOpen(false)}
            className={`fixed inset-0 z-[9999] w-full max-w-[100vw] h-[100dvh] flex items-center justify-center p-2 sm:p-4 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md overflow-hidden animate-in fade-in duration-150 ${
              isLight ? "bg-slate-900/40" : "bg-slate-950/85"
            }`}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`relative w-full max-w-[min(95vw,calc(100vw-1.5rem))] lg:max-w-4xl max-h-[90dvh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
                isLight
                  ? "bg-white/95 border-slate-200/90 text-slate-900"
                  : "bg-slate-900/95 border-cyan-500/30 text-slate-100"
              }`}
            >
              {/* Modal Header */}
              <div
                className={`flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b shrink-0 w-full overflow-hidden ${
                  isLight
                    ? "bg-slate-50/95 border-slate-200/90 text-slate-900"
                    : "bg-slate-950/90 border-cyan-500/20 text-slate-100"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                  <ImageIcon className={`h-4 w-4 shrink-0 ${isLight ? "text-sky-600" : "text-cyan-400"}`} />
                  <span className="text-xs sm:text-sm font-bold truncate">
                    {file.fileName || "Просмотр изображения"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <div
                    className={`flex items-center border rounded-xl overflow-hidden shrink-0 ${
                      isLight
                        ? "border-slate-200 bg-white shadow-2xs"
                        : "border-cyan-500/30 bg-slate-800/80"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                      className={`p-1.5 transition cursor-pointer shrink-0 ${
                        isLight
                          ? "text-slate-700 hover:text-slate-950 hover:bg-slate-100"
                          : "text-slate-300 hover:text-white hover:bg-slate-700"
                      }`}
                      title="Уменьшить"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span
                      className={`px-2 text-[11px] sm:text-xs font-mono font-bold shrink-0 ${
                        isLight ? "text-sky-700" : "text-cyan-300"
                      }`}
                    >
                      {Math.round(zoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                      className={`p-1.5 transition cursor-pointer shrink-0 ${
                        isLight
                          ? "text-slate-700 hover:text-slate-950 hover:bg-slate-100"
                          : "text-slate-300 hover:text-white hover:bg-slate-700"
                      }`}
                      title="Увеличить"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoom(1)}
                      className={`p-1.5 transition border-l cursor-pointer shrink-0 ${
                        isLight
                          ? "text-slate-500 hover:text-sky-700 hover:bg-slate-100 border-slate-200"
                          : "text-slate-400 hover:text-cyan-300 hover:bg-slate-700 border-cyan-500/20"
                      }`}
                      title="Сбросить масштаб"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsLightboxOpen(false)}
                    className={`p-1.5 rounded-xl border transition cursor-pointer shrink-0 ${
                      isLight
                        ? "border-slate-200 bg-white text-slate-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 shadow-2xs"
                        : "border-red-500/40 bg-red-950/60 text-red-300 hover:bg-red-900/80 hover:text-white"
                    }`}
                    title="Закрыть"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Image Body — natural colors without inversion */}
              <div
                className={`w-full flex-1 min-h-0 overflow-auto p-3 sm:p-5 flex items-center justify-center ${
                  isLight ? "bg-slate-50" : "bg-slate-950"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={file.fileUrl}
                  alt={file.fileName || "Фото"}
                  style={{
                    width: `${Math.round(zoom * 100)}%`,
                    maxWidth: zoom > 1 ? "none" : "100%",
                    filter: "none",
                  }}
                  className="h-auto object-contain block mx-auto rounded-lg shadow-md bg-white"
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export default AttachmentBadge;