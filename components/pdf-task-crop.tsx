"use client";

import React, { useEffect, useRef, useState } from "react";
import { Moon, Sun, Maximize2, X, ZoomIn, ZoomOut, RotateCcw, AlertCircle, Loader2 } from "lucide-react";
import { MathText } from "./math-text";

interface PdfTaskCropProps {
  pdfPage?: number | null;
  taskCode?: string | null;
  fallbackText?: string;
  taskNumber?: number;
  className?: string;
}

// Global cached PDF document & rendered pages to prevent re-fetching and re-rendering
let sharedPdfDocPromise: Promise<any> | null = null;

function loadPdfJsFromPublic(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("SSR environment"));
  }
  const win = window as any;
  if (win.pdfjsLib) {
    win.pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
    return Promise.resolve(win.pdfjsLib);
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-pdfjs="true"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => {
        if (win.pdfjsLib) {
          win.pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
          resolve(win.pdfjsLib);
        } else {
          reject(new Error("pdfjsLib not found after script load"));
        }
      });
      existing.addEventListener("error", () => reject(new Error("Failed to load /pdf.min.js")));
      return;
    }
    const script = document.createElement("script");
    script.src = "/pdf.min.js";
    script.async = true;
    script.setAttribute("data-pdfjs", "true");
    script.onload = () => {
      if (win.pdfjsLib) {
        win.pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
        resolve(win.pdfjsLib);
      } else {
        reject(new Error("pdfjsLib not initialized"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load /pdf.min.js"));
    document.head.appendChild(script);
  });
}

function getSharedPdfDoc() {
  if (!sharedPdfDocPromise) {
    sharedPdfDocPromise = (async () => {
      try {
        const pdfjs = await loadPdfJsFromPublic();
        const loadingTask = pdfjs.getDocument({
          url: "/api/ege/pdf-file",
          cMapUrl: "https://unpkg.com/pdfjs-dist@3.11.174/cmaps/",
          cMapPacked: true,
        });
        return await loadingTask.promise;
      } catch (err) {
        sharedPdfDocPromise = null;
        throw err;
      }
    })();
  }
  return sharedPdfDocPromise;
}

interface PageCacheItem {
  offscreenCanvas: HTMLCanvasElement;
  textContent: any;
  viewport: any;
}

const pageRenderCache = new Map<number, Promise<PageCacheItem>>();

function getRenderedPage(pageNum: number, scale = 2.2): Promise<PageCacheItem> {
  if (!pageRenderCache.has(pageNum)) {
    const promise = (async () => {
      const doc = await getSharedPdfDoc();
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const textContent = await page.getTextContent();

      const offscreenCanvas = document.createElement("canvas");
      offscreenCanvas.width = Math.round(viewport.width);
      offscreenCanvas.height = Math.round(viewport.height);
      const ctx = offscreenCanvas.getContext("2d", { alpha: false });

      if (!ctx) throw new Error("Canvas context creation failed");

      // Render the PDF page into offscreen canvas
      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise;

      return {
        offscreenCanvas,
        textContent,
        viewport,
      };
    })();
    pageRenderCache.set(pageNum, promise);
  }
  return pageRenderCache.get(pageNum)!;
}

export function PdfTaskCrop({
  pdfPage,
  taskCode,
  fallbackText,
  taskNumber,
  className = "",
}: PdfTaskCropProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [lightboxZoom, setLightboxZoom] = useState<number>(1);
  const [croppedDataUrl, setCroppedDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    if (!pdfPage) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    getRenderedPage(pdfPage, 2.2)
      .then((pageData) => {
        if (isCancelled) return;
        const { offscreenCanvas, textContent, viewport } = pageData;
        const items = textContent.items || [];

        // 1. Find all task markers on this page
        interface Marker {
          code: string;
          y: number;
        }
        const markers: Marker[] = [];

        for (let idx = 0; idx < items.length; idx++) {
          const str = (items[idx].str || "").trim();
          const m = str.match(/Задача\s*(\d{1,2}\.\d+)/i);
          if (m) {
            markers.push({ code: m[1], y: items[idx].transform[5] });
          } else if (/Задача/i.test(str)) {
            const nextStr = (items[idx + 1]?.str || "").trim();
            const m2 = nextStr.match(/^(\d{1,2}\.\d+)/);
            if (m2) {
              markers.push({ code: m2[1], y: items[idx].transform[5] });
            }
          }
        }

        // 2. Identify the matching marker for taskCode
        let targetIdx = -1;
        if (taskCode) {
          const normalizedCode = taskCode.replace(/^Задача\s*/i, "").trim();
          targetIdx = markers.findIndex(
            (m) => m.code === normalizedCode || m.code.startsWith(normalizedCode) || normalizedCode.startsWith(m.code)
          );
        }

        let startY = 750;
        let endY = 55;

        if (markers.length > 0) {
          if (targetIdx !== -1) {
            startY = markers[targetIdx].y;
            endY = targetIdx + 1 < markers.length ? markers[targetIdx + 1].y : 55;
          } else {
            // If specific code wasn't matched but markers exist, default to the first marker or single task
            startY = markers[0].y;
            endY = markers.length > 1 ? markers[1].y : 55;
          }
        }

        // Trim top green header bar ("Задача X.Y. | Аналоги | Ответ"):
        // startY in PDF coords is baseline of "Задача X.Y.". Cut 7pt below baseline so green bar is excluded.
        const pdfTop = Math.min(840, startY - 7);

        // Find "Ответ:" line and lowest content item within this task block to trim bottom "Ответ: [ ][ ]"
        let answerY: number | null = null;
        let minContentY = startY - 20;
        for (let idx = 0; idx < items.length; idx++) {
          const itemStr = (items[idx].str || "").trim();
          if (!itemStr) continue;
          const iy = items[idx].transform[5];
          if (iy < startY - 8 && iy > endY + 8) {
            if (/^Ответ:?$/i.test(itemStr)) {
              answerY = iy;
            } else if (!/^(?:Задача|Аналоги|>+|Ответы)$/i.test(itemStr)) {
              if (iy < minContentY) {
                minContentY = iy;
              }
            }
          }
        }

        let pdfBottom = Math.max(52, endY + 12);
        if (answerY !== null) {
          const trimmedAboveAnswer = Math.min(answerY + 12, minContentY - 6);
          if (pdfTop - trimmedAboveAnswer >= 28) {
            pdfBottom = Math.max(52, trimmedAboveAnswer);
          }
        }

        // Convert coordinates to canvas pixels via PDF.js viewport
        const [cLeft, cTop] = viewport.convertToViewportPoint(50, pdfTop);
        const [cRight, cBottom] = viewport.convertToViewportPoint(545, pdfBottom);

        const cropX = Math.max(0, Math.round(Math.min(cLeft, cRight)));
        const cropY = Math.max(0, Math.round(Math.min(cTop, cBottom)));
        const cropW = Math.round(Math.abs(cRight - cLeft));
        const cropH = Math.round(Math.abs(cBottom - cTop));

        if (cropW <= 0 || cropH <= 0) {
          throw new Error("Неверные координаты кропа страницы");
        }

        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = cropW;
          canvas.height = cropH;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(offscreenCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            try {
              setCroppedDataUrl(canvas.toDataURL("image/png"));
            } catch {
              // Ignore if dataURL export fails
            }
          }
        }

        setLoading(false);
      })
      .catch((err) => {
        if (!isCancelled) {
          console.warn("PdfTaskCrop render error:", err);
          setError(err.message || "Не удалось загрузить визуальный фрагмент из PDF");
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [pdfPage, taskCode]);

  // Fallback to MathText if no PDF page is specified or if an error occurred
  if (!pdfPage || error) {
    if (fallbackText) {
      return <MathText text={fallbackText} className="text-xs sm:text-sm text-zinc-200" />;
    }
    return null;
  }

  return (
    <div className={`relative group ${className}`}>
      {/* Task Image Container with Glass Design */}
      <div
        className={`relative rounded-xl overflow-hidden border transition-all duration-300 ${
          isDarkMode
            ? "border-cyan-500/20 bg-slate-950/70 shadow-inner"
            : "border-slate-200/80 bg-white shadow-md"
        } p-3 sm:p-4`}
      >
        {/* Loading Skeleton */}
        {loading && (
          <div className="min-h-[140px] flex flex-col items-center justify-center gap-2.5 py-8 text-cyan-400">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            <span className="text-xs font-mono text-cyan-300/80 tracking-wider">
              Загрузка фрагмента из PDF (стр. {pdfPage})...
            </span>
          </div>
        )}

        {/* The Cropped Canvas with Dark Mode Filter */}
        <div className={`w-full overflow-x-auto ${loading ? "hidden" : "block"}`}>
          <canvas
            ref={canvasRef}
            className="w-full h-auto max-w-full block mx-auto rounded transition-all duration-200"
            style={
              isDarkMode
                ? {
                    filter: "invert(0.92) hue-rotate(180deg) contrast(1.15)",
                    mixBlendMode: "screen",
                  }
                : {
                    filter: "none",
                    mixBlendMode: "normal",
                  }
            }
          />
        </div>

        {/* Top-Right Glass Control Buttons */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity z-10">
          <button
            type="button"
            onClick={() => setIsDarkMode((prev) => !prev)}
            title={isDarkMode ? "Переключить на оригинальный белый фон" : "Переключить на темный контрастный фон"}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg border backdrop-blur-md transition-all shadow-sm ${
              isDarkMode
                ? "bg-slate-900/90 border-cyan-500/40 text-cyan-300 hover:bg-slate-800"
                : "bg-slate-800/90 border-slate-600 text-amber-300 hover:bg-slate-700"
            }`}
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span className="text-[11px] font-medium hidden sm:inline">
              {isDarkMode ? "Светлый фон" : "Темный фон"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLightboxZoom(1);
              setIsLightboxOpen(true);
            }}
            title="Открыть в полном размере (Zoom / Lightbox)"
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-cyan-500/40 bg-slate-900/90 backdrop-blur-md text-cyan-300 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium hidden sm:inline">Увеличить</span>
          </button>
        </div>
      </div>

      {/* Lightbox / Zoom Modal */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-cyan-500/30 bg-slate-900/95 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/20 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  {taskNumber ? `Задание №${taskNumber}` : "ЕГЭ"}
                </span>
                <span className="text-sm font-semibold text-slate-100">
                  {taskCode ? `Прототип ${taskCode}` : "Фрагмент сборника ФИПИ"}
                </span>
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  (PDF стр. {pdfPage})
                </span>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDarkMode((prev) => !prev)}
                  className="p-1.5 rounded-lg border border-cyan-500/30 bg-slate-800/80 text-cyan-300 hover:bg-slate-700 transition"
                  title="Переключить тему фона"
                >
                  {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>

                <div className="flex items-center border border-cyan-500/30 rounded-lg bg-slate-800/80 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setLightboxZoom((z) => Math.max(0.7, z - 0.2))}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                    title="Уменьшить"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="px-2 text-xs font-mono text-cyan-300">
                    {Math.round(lightboxZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setLightboxZoom((z) => Math.min(2.5, z + 0.2))}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                    title="Увеличить"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxZoom(1)}
                    className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-700 transition border-l border-cyan-500/20"
                    title="Сбросить масштаб"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(false)}
                  className="p-1.5 rounded-lg border border-red-500/30 bg-red-950/40 text-red-300 hover:bg-red-900/60 hover:text-white transition"
                  title="Закрыть"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body / Image Viewport */}
            <div
              className={`flex-1 overflow-auto p-4 flex items-center justify-center transition-colors ${
                isDarkMode ? "bg-slate-950/90" : "bg-white"
              }`}
            >
              {croppedDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={croppedDataUrl}
                  alt={taskCode || "Задание ЕГЭ"}
                  style={{
                    transform: `scale(${lightboxZoom})`,
                    transformOrigin: "center center",
                    transition: "transform 0.15s ease-out",
                    filter: isDarkMode
                      ? "invert(0.92) hue-rotate(180deg) contrast(1.15)"
                      : "none",
                    mixBlendMode: isDarkMode ? "screen" : "normal",
                  }}
                  className="max-w-full max-h-full object-contain rounded shadow-lg"
                />
              ) : (
                <div className="text-slate-400 text-sm">Изображение недоступно</div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2 text-xs font-mono text-slate-400 border-t border-cyan-500/20 bg-slate-950/80 flex items-center justify-between">
              <span>Оригинал из Открытого банка заданий ФИПИ</span>
              <span>Масштаб: {Math.round(lightboxZoom * 100)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
