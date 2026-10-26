"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Moon, Sun, Maximize2, X, ZoomIn, ZoomOut, RotateCcw, Loader2 } from "lucide-react";
import { MathText } from "./math-text";
import { useAppTheme } from "./theme-context";

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

/**
 * Автоматически обрезает пустые белые поля вокруг условия и чертежа задачи,
 * чтобы при растяжении на всю ширину карточки (w-full) текст сразу легко читался при масштабе 100%.
 */
function findTightContentBounds(
  sourceCanvas: HTMLCanvasElement,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): { x: number; y: number; w: number; h: number } {
  const ctx = sourceCanvas.getContext("2d");
  if (!ctx) return { x: rx, y: ry, w: rw, h: rh };

  try {
    const imgData = ctx.getImageData(rx, ry, rw, rh);
    const data = imgData.data;

    let minX = rw;
    let maxX = 0;
    let minY = rh;
    let maxY = 0;
    let foundInk = false;

    for (let y = 0; y < rh; y++) {
      const rowOffset = y * rw * 4;
      for (let x = 0; x < rw; x++) {
        const idx = rowOffset + x * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        if (r < 244 || g < 244 || b < 244) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          foundInk = true;
        }
      }
    }

    if (!foundInk || maxX <= minX || maxY <= minY) {
      return { x: rx, y: ry, w: rw, h: rh };
    }

    const padX = 12;
    const padY = 10;
    const tightX = Math.max(0, rx + minX - padX);
    const tightY = Math.max(0, ry + minY - padY);
    const tightRight = Math.min(sourceCanvas.width, rx + maxX + padX);
    const tightBottom = Math.min(sourceCanvas.height, ry + maxY + padY);

    const tightW = tightRight - tightX;
    const tightH = tightBottom - tightY;

    if (tightW > 40 && tightH > 20) {
      return { x: tightX, y: tightY, w: tightW, h: tightH };
    }
  } catch {
    // Fallback to original bounds if getImageData fails
  }

  return { x: rx, y: ry, w: rw, h: rh };
}

export function PdfTaskCrop({
  pdfPage,
  taskCode,
  fallbackText,
  taskNumber,
  className = "",
}: PdfTaskCropProps) {
  const { colorMode } = useAppTheme();
  const isLightTheme = colorMode === "light";

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // По умолчанию изображение всегда в естественных цветах без инверсии
  const [isInverted, setIsInverted] = useState<boolean>(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [lightboxZoom, setLightboxZoom] = useState<number>(1);
  const [croppedDataUrl, setCroppedDataUrl] = useState<string | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // В светлой теме принудительно отключаем инверсию, чтобы не было негатива
  useEffect(() => {
    if (isLightTheme) {
      setIsInverted(false);
    }
  }, [isLightTheme]);

  useEffect(() => {
    let isCancelled = false;

    if (!pdfPage) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    getRenderedPage(pdfPage, 2.5)
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
            startY = markers[0].y;
            endY = markers.length > 1 ? markers[1].y : 55;
          }
        }

        const pdfTop = Math.min(840, startY - 7);

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

        const [cLeft, cTop] = viewport.convertToViewportPoint(56, pdfTop);
        const [cRight, cBottom] = viewport.convertToViewportPoint(540, pdfBottom);

        const rawX = Math.max(0, Math.round(Math.min(cLeft, cRight)));
        const rawY = Math.max(0, Math.round(Math.min(cTop, cBottom)));
        const rawW = Math.min(offscreenCanvas.width - rawX, Math.round(Math.abs(cRight - cLeft)));
        const rawH = Math.min(offscreenCanvas.height - rawY, Math.round(Math.abs(cBottom - cTop)));

        if (rawW <= 0 || rawH <= 0) {
          throw new Error("Неверные координаты кропа страницы");
        }

        const { x: cropX, y: cropY, w: cropW, h: cropH } = findTightContentBounds(
          offscreenCanvas,
          rawX,
          rawY,
          rawW,
          rawH
        );

        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = cropW;
          canvas.height = cropH;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, cropW, cropH);
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

  if (!pdfPage || error) {
    if (fallbackText) {
      return (
        <MathText
          text={fallbackText}
          className={`text-xs sm:text-sm ${isLightTheme ? "text-slate-800" : "text-zinc-200"}`}
        />
      );
    }
    return null;
  }

  return (
    <div className={`relative group w-full ${className}`}>
      {/* Task Image Container — stretched full width (w-full) with minimal padding */}
      <div
        className={`relative w-full rounded-xl overflow-hidden border transition-all duration-200 ${
          isInverted
            ? "border-cyan-500/20 bg-slate-950/70 shadow-inner"
            : "border-slate-200/90 bg-white shadow-xs"
        } p-1 sm:p-2`}
      >
        {/* Loading Skeleton */}
        {loading && (
          <div className="min-h-[110px] flex flex-col items-center justify-center gap-2 py-6 text-sky-600 dark:text-cyan-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs font-mono text-slate-500 tracking-wider">
              Загрузка задания (стр. {pdfPage})...
            </span>
          </div>
        )}

        {/* The Cropped Canvas stretched to 100% card width (w-full h-auto object-contain) */}
        <div
          onClick={() => {
            setLightboxZoom(1);
            setIsLightboxOpen(true);
          }}
          className={`w-full cursor-zoom-in ${loading ? "hidden" : "block"}`}
          title="Нажмите для увеличения"
        >
          <canvas
            ref={canvasRef}
            className="w-full h-auto object-contain block rounded"
            style={
              isInverted
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

        {/* Top-Right Compact Control Buttons */}
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity z-10">
          {!isLightTheme && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsInverted((prev) => !prev);
              }}
              title={isInverted ? "Переключить на оригинальный белый фон" : "Инвертировать под темный фон"}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-lg border backdrop-blur-md transition-all shadow-xs cursor-pointer ${
                isInverted
                  ? "bg-slate-900/90 border-cyan-500/40 text-cyan-300 hover:bg-slate-800"
                  : "bg-white/95 border-slate-300 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {isInverted ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
              <span className="font-semibold hidden sm:inline">
                {isInverted ? "Оригинал" : "Инверсия"}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxZoom(1);
              setIsLightboxOpen(true);
            }}
            title="Открыть в полном размере"
            className={`flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-lg border backdrop-blur-md transition-all shadow-xs cursor-pointer font-semibold ${
              isLightTheme
                ? "bg-white/95 border-slate-300 text-slate-800 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300"
                : "border-cyan-500/40 bg-slate-900/85 text-cyan-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Maximize2 className="w-3 h-3" />
            <span className="hidden sm:inline">Увеличить</span>
          </button>
        </div>
      </div>

      {/* Lightbox / Zoom Modal — rendered via Portal to document.body */}
      {mounted &&
        isLightboxOpen &&
        createPortal(
          <div
            onClick={() => setIsLightboxOpen(false)}
            className={`fixed inset-0 z-[9999] w-full max-w-[100vw] h-[100dvh] flex items-center justify-center p-2 sm:p-4 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md overflow-hidden animate-in fade-in duration-150 ${
              isLightTheme ? "bg-slate-900/40" : "bg-slate-950/85"
            }`}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`relative w-full max-w-[min(95vw,calc(100vw-1.5rem))] lg:max-w-4xl max-h-[90dvh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
                isLightTheme
                  ? "bg-white/95 border-slate-200/90 text-slate-900"
                  : "bg-slate-900/95 border-cyan-500/30 text-slate-100"
              }`}
            >
              {/* Fixed Modal Header */}
              <div
                className={`flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b shrink-0 w-full overflow-hidden ${
                  isLightTheme
                    ? "bg-slate-50/95 border-slate-200/90 text-slate-900"
                    : "bg-slate-950/90 border-cyan-500/20 text-slate-100"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                  <span
                    className={`px-2.5 py-0.5 text-[11px] sm:text-xs font-mono font-bold rounded-lg border shrink-0 ${
                      isLightTheme
                        ? "bg-sky-50 text-sky-700 border-sky-200"
                        : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                    }`}
                  >
                    {taskNumber ? `Задание №${taskNumber}` : "ЕГЭ"}
                  </span>
                  <span
                    className={`text-xs sm:text-sm font-bold min-w-0 flex-1 truncate ${
                      isLightTheme ? "text-slate-800" : "text-slate-100"
                    }`}
                  >
                    {taskCode ? `Прототип #${taskCode}` : "Фрагмент сборника ФИПИ"}
                  </span>
                </div>

                {/* Right Controls — strictly shrink-0 so buttons and close X never get clipped */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {!isLightTheme && (
                    <button
                      type="button"
                      onClick={() => setIsInverted((prev) => !prev)}
                      className="p-1.5 rounded-xl border border-cyan-500/30 bg-slate-800/80 text-cyan-300 hover:bg-slate-700 transition cursor-pointer shrink-0"
                      title="Переключить инверсию фона"
                    >
                      {isInverted ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                  )}

                  <div
                    className={`flex items-center border rounded-xl overflow-hidden shrink-0 ${
                      isLightTheme
                        ? "border-slate-200 bg-white shadow-2xs"
                        : "border-cyan-500/30 bg-slate-800/80"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setLightboxZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
                      className={`p-1.5 transition cursor-pointer shrink-0 ${
                        isLightTheme
                          ? "text-slate-700 hover:text-slate-950 hover:bg-slate-100"
                          : "text-slate-300 hover:text-white hover:bg-slate-700"
                      }`}
                      title="Уменьшить"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span
                      className={`px-2 text-[11px] sm:text-xs font-mono font-bold shrink-0 ${
                        isLightTheme ? "text-sky-700" : "text-cyan-300"
                      }`}
                    >
                      {Math.round(lightboxZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setLightboxZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
                      className={`p-1.5 transition cursor-pointer shrink-0 ${
                        isLightTheme
                          ? "text-slate-700 hover:text-slate-950 hover:bg-slate-100"
                          : "text-slate-300 hover:text-white hover:bg-slate-700"
                      }`}
                      title="Увеличить"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLightboxZoom(1)}
                      className={`p-1.5 transition border-l cursor-pointer shrink-0 ${
                        isLightTheme
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
                      isLightTheme
                        ? "border-slate-200 bg-white text-slate-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 shadow-2xs"
                        : "border-red-500/40 bg-red-950/60 text-red-300 hover:bg-red-900/80 hover:text-white"
                    }`}
                    title="Закрыть"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Modal Body */}
              <div
                className={`w-full flex-1 min-h-0 overflow-auto p-2 sm:p-4 transition-colors ${
                  isInverted && !isLightTheme ? "bg-slate-950" : "bg-white"
                }`}
              >
                {croppedDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={croppedDataUrl}
                    alt={taskCode || "Задание ЕГЭ"}
                    style={{
                      width: `${Math.round(lightboxZoom * 100)}%`,
                      maxWidth: lightboxZoom > 1 ? "none" : "100%",
                      filter:
                        isInverted && !isLightTheme
                          ? "invert(0.92) hue-rotate(180deg) contrast(1.15)"
                          : "none",
                      mixBlendMode: isInverted && !isLightTheme ? "screen" : "normal",
                    }}
                    className="w-full h-auto object-contain block mx-auto rounded"
                  />
                ) : (
                  <div className="text-slate-400 text-sm py-6 text-center">Изображение недоступно</div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
