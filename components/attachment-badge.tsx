"use client";

import React, { useState } from "react";
import {
  FileText,
  AlertTriangle,
  ExternalLink,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import { useAppTheme } from "./theme-context";
import { Modal } from "./ui-kit";

export interface AttachmentItem {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  expiresAt?: string | Date;
}

export function AttachmentBadge({ file }: { file?: AttachmentItem | null }) {
  const { isLight } = useAppTheme();

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

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
            : "border-rose-500/30 bg-rose-500/10 text-rose-400"
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
          className={`group inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-all duration-200 cursor-pointer ${
            isLight
              ? "border-slate-200 bg-white text-slate-800 hover:border-sky-300 hover:bg-sky-50/70 shadow-2xs"
              : "border-slate-700 bg-slate-800/70 text-slate-200 hover:border-sky-500/40 hover:bg-slate-800"
          }`}
        >
          <ImageIcon className={`h-4 w-4 shrink-0 ${isLight ? "text-emerald-600" : "text-emerald-400"}`} />
          <span
            className={`max-w-[170px] truncate font-medium ${
              isLight ? "text-slate-800 group-hover:text-sky-800" : "text-slate-200 group-hover:text-white"
            }`}
          >
            {file.fileName || "Фото"}
          </span>
          <span
            className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
              isLight ? "bg-slate-100 text-slate-600" : "bg-slate-700 text-slate-300"
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
          className={`group inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-all duration-200 ${
            isLight
              ? "border-slate-200 bg-white text-slate-800 hover:border-sky-300 hover:bg-sky-50/70 shadow-2xs"
              : "border-slate-700 bg-slate-800/70 text-slate-200 hover:border-sky-500/40 hover:bg-slate-800"
          }`}
        >
          <FileText className={`h-4 w-4 shrink-0 ${isLight ? "text-sky-600" : "text-sky-400"}`} />
          <span
            className={`max-w-[170px] truncate font-medium ${
              isLight ? "text-slate-800 group-hover:text-sky-800" : "text-slate-200 group-hover:text-white"
            }`}
          >
            {file.fileName || "Файл"}
          </span>
          <ExternalLink
            className={`h-3 w-3 transition ${
              isLight ? "text-slate-400 group-hover:text-sky-600" : "text-slate-500 group-hover:text-slate-300"
            }`}
          />
        </a>
      )}

      <Modal
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        maxWidth="4xl"
        title={file.fileName || "Просмотр изображения"}
        icon={<ImageIcon className="w-4 h-4" />}
        bodyClassName={`w-full flex-1 min-h-0 overflow-auto p-3 sm:p-5 flex items-center justify-center ${
          isLight ? "bg-slate-50" : "bg-slate-950"
        }`}
        headerActions={
          <div
            className={`flex items-center border rounded-xl overflow-hidden shrink-0 ${
              isLight
                ? "border-slate-200 bg-white shadow-2xs"
                : "border-slate-700 bg-slate-800/90"
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
                isLight ? "text-sky-700" : "text-sky-300"
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
                  : "text-slate-400 hover:text-sky-300 hover:bg-slate-700 border-slate-700"
              }`}
              title="Сбросить масштаб"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        }
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
      </Modal>
    </>
  );
}

export default AttachmentBadge;