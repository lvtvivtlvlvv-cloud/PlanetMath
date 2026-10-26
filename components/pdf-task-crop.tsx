"use client";

import React, { useEffect, useRef, useState } from "react";
import { Moon, Sun, Maximize2, ZoomIn, ZoomOut, RotateCcw, Loader2 } from "lucide-react";
import { MathText } from "./math-text";
import { useAppTheme } from "./theme-context";
import { Modal, Button } from "./ui-kit";

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

// Не держим в памяти весь учебник: 12 страниц по ~10 МБ — уже много.
const MAX_CACHED_PAGES = 12;
const pageRenderCache = new Map<number, Promise<PageCacheItem>>();

function getRenderedPage(pageNum: number, scale = 2.2): Promise<PageCacheItem> {
  const cached = pageRenderCache.get(pageNum);
  if (cached) return cached;

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

  promise.catch(() => {
    // Не кэшируем ошибку навсегда — иначе до перезагрузки страницы задача не отрисуется.
    if (pageRenderCache.get(pageNum) === promise) pageRenderCache.delete(pageNum);
  });

  if (pageRenderCache.size > MAX_CACHED_PAGES) {
    const oldest = pageRenderCache.keys().next().value;
    if (oldest !== undefined && oldest !== pageNum) pageRenderCache.delete(oldest);
  }

  return promise;
}

// Готовые вырезки кэшируем по (страница + прототип): при переключении вкладок
// не нужно заново сканировать пиксели и кодировать PNG.
const croppedCache = new Map<string, string>();

function cropCacheKey(page: number, taskCode?: string | null) {
  return `${page}::${taskCode || ""}`;
}

/**
 * Автоматически обрезает пустые белые поля вокруг условия и чертежа задачи,
 * чтобы при растяжении на всю ширину карточки (w-full) текст сразу легко читался.
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

    // Шаг 2 пикселя: точности хватает, а перебор вдвое быстрее.
    const step = 2;

    for (let y = 0; y < rh; y += step) {
      const rowOffset = y * rw * 4;
      for (let x = 0; x < rw; x += step) {
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

function buildCrop(pageData: PageCacheItem, taskCode?: string | null): string {
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

  const canvas = document.createElement("canvas");
  canvas.width = cropW;
  canvas.height = cropH;
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Canvas context creation failed");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cropW, cropH);
  ctx.drawImage(offscreenCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  return canvas.toDataURL("image/png");
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

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // По умолчанию изображение всегда в естественных цветах без инверсии
  const [isInverted, setIsInverted] = useState<boolean>(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [lightboxZoom, setLightboxZoom] = useState<number>(1);
  const [croppedDataUrl, setCroppedDataUrl] = useState<string | null>(null);

  // Рендерим только когда карточка подходит к экрану: иначе открытие вкладки
  // с десятком задач блокирует главный поток на несколько секунд.
  useEffect(() => {
    if (!pdfPage) {
      setIsVisible(true);
      return;
    }

    const el = wrapperRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "500px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pdfPage]);

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

    if (!isVisible) return;

    const key = cropCacheKey(pdfPage, taskCode);
    const cached = croppedCache.get(key);

    if (cached) {
      setCroppedDataUrl(cached);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    getRenderedPage(pdfPage, 2.2)
      .then((pageData) => {
        if (isCancelled) return;
        const dataUrl = buildCrop(pageData, taskCode);
        croppedCache.set(key, dataUrl);
        setCroppedDataUrl(dataUrl);
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
  }, [pdfPage, taskCode, isVisible]);

  if (!pdfPage || (error && !croppedDataUrl)) {
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
    <div ref={wrapperRef} className={`relative group w-full ${className}`}>
      {/* Task Image Container — stretched full width with minimal padding */}
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

        {/* The Cropped Image stretched to 100% card width */}
        {croppedDataUrl && !loading && (
          <div
            onClick={() => {
              setLightboxZoom(1);
              setIsLightboxOpen(true);
            }}
            className="w-full cursor-zoom-in"
            title="Нажмите для увеличения"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={croppedDataUrl}
              alt={taskCode ? `Задание ${taskCode}` : "Фрагмент задания"}
              loading="lazy"
              decoding="async"
              className="w-full h-auto object-contain block rounded"
              style={
                isInverted
                  ? {
                      filter: "invert(0.92) hue-rotate(180deg) contrast(1.15)",
                      mixBlendMode: "screen",
                    }
                  : { filter: "none", mixBlendMode: "normal" }
              }
            />
          </div>
        )}

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
              className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-lg border backdrop-blur-md transition-colors shadow-xs cursor-pointer ${
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
            className={`flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-lg border backdrop-blur-md transition-colors shadow-xs cursor-pointer font-semibold ${
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

      {/* Lightbox / Zoom Modal — near fullscreen */}
      <Modal
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        maxWidth="screen"
        title={taskCode ? `Прототип #${taskCode}` : "Фрагмент сборника ФИПИ"}
        subtitle={taskNumber ? `Задание №${taskNumber} • Стр. ${pdfPage}` : `Стр. ${pdfPage}`}
        bodyClassName={`w-full flex-1 min-h-0 overflow-auto p-1 sm:p-2 transition-colors ${
          isInverted && !isLightTheme ? "bg-slate-950" : "bg-white"
        }`}
        headerActions={
          <div className="flex items-center gap-1.5 shrink-0">
            {!isLightTheme && (
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setIsInverted((prev) => !prev)}
                title="Переключить инверсию фона"
              >
                {isInverted ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
            )}

            <div
              className={`flex items-center border rounded-xl overflow-hidden shrink-0 ${
                isLightTheme
                  ? "border-slate-200 bg-white shadow-2xs"
                  : "border-slate-700 bg-slate-800/90"
              }`}
            >
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
                className={`p-1.5 transition-colors cursor-pointer shrink-0 ${
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
                  isLightTheme ? "text-sky-700" : "text-sky-300"
                }`}
              >
                {Math.round(lightboxZoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                className={`p-1.5 transition-colors cursor-pointer shrink-0 ${
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
                className={`p-1.5 transition-colors border-l cursor-pointer shrink-0 ${
                  isLightTheme
                    ? "text-slate-500 hover:text-sky-700 hover:bg-slate-100 border-slate-200"
                    : "text-slate-400 hover:text-sky-300 hover:bg-slate-700 border-slate-700"
                }`}
                title="По размеру экрана"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        }
      >
        {croppedDataUrl ? (
          <div className="w-full flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={croppedDataUrl}
              alt={taskCode || "Задание ЕГЭ"}
              style={{
                width: `${Math.round(lightboxZoom * 100)}%`,
                maxWidth: lightboxZoom > 1 ? "none" : "100%",
                height: lightboxZoom > 1 ? "auto" : "80dvh",
                objectFit: "contain",
                filter:
                  isInverted && !isLightTheme
                    ? "invert(0.92) hue-rotate(180deg) contrast(1.15)"
                    : "none",
                mixBlendMode: isInverted && !isLightTheme ? "screen" : "normal",
              }}
              className="block mx-auto rounded"
            />
          </div>
        ) : (
          <div className="text-slate-400 text-sm py-6 text-center">Изображение недоступно</div>
        )}
      </Modal>
    </div>
  );
}
