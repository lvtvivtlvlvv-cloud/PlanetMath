"use client";

import React from "react";
import { FileText, AlertTriangle, ExternalLink, Image as ImageIcon } from "lucide-react";

export interface AttachmentItem {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  expiresAt: string | Date;
}

export function AttachmentBadge({ file }: { file?: AttachmentItem | null }) {
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
      <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-400">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Файл удален по истечении срока</span>
      </div>
    );
  }

  const isImage = file.fileType?.startsWith("image/");

  return (
    <a
      href={file.fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs transition hover:border-white/20 hover:bg-white/10"
    >
      {isImage ? (
        <ImageIcon className="h-4 w-4 text-emerald-400" />
      ) : (
        <FileText className="h-4 w-4 text-cyan-400" />
      )}
      <span className="max-w-[170px] truncate text-zinc-200 group-hover:text-white">
        {file.fileName || "Файл"}
      </span>
      {isImage && (
        <span className="rounded bg-white/10 px-1 py-0.5 text-[9px] font-bold text-zinc-400">
          IMG
        </span>
      )}
      <ExternalLink className="h-3 w-3 text-zinc-500 transition group-hover:text-zinc-300" />
    </a>
  );
}

export default AttachmentBadge;