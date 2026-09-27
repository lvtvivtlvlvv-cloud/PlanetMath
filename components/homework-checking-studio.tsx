"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  PenTool,
  Type,
  Eraser,
  RotateCw,
  Download,
  Undo2,
  Redo2,
  Trash2,
  CheckCircle2,
  XCircle,
  Save,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  Plus,
  HelpCircle,
  FileText,
  User,
  Clock,
  Sparkles,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

export interface AnnotationStroke {
  id: string;
  type: "stroke";
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

export interface AnnotationText {
  id: string;
  type: "text";
  color: string;
  text: string;
  x: number; // percentage 0-100 or px
  y: number; // percentage 0-100 or px
  fontSize?: number;
}

export type AnnotationItem = AnnotationStroke | AnnotationText;

export interface StudentSubmissionItem {
  id: string;
  studentId: string;
  studentName: string;
  avatarColor: string;
  initials: string;
  submittedAt: string;
  pagesCount: number;
  pageImages: string[];
  status: "PENDING" | "GRADED";
  grade: number | null;
  teacherComment: string | null;
  annotations?: AnnotationItem[];
  tasksCompleted?: { [taskNum: number]: boolean | null };
  content?: string;
  modifiedImageUrl?: string;
}

export interface HomeworkCheckingStudioProps {
  homework: {
    id: string;
    title: string;
    subjectName: string;
    targetDate: string;
    totalTasks?: number;
    className?: string;
    description?: string;
  };
  submissions: StudentSubmissionItem[];
  isOpen: boolean;
  onClose: () => void;
  onSaveGrade: (
    submissionId: string,
    grade: number,
    comment: string,
    annotations: AnnotationItem[],
    tasksCompleted: { [taskNum: number]: boolean | null },
    modifiedImageUrl?: string
  ) => Promise<void>;
}

const PALETTE = [
  { name: "Красный", hex: "#EF4444" },
  { name: "Синий", hex: "#2563EB" },
  { name: "Зеленый", hex: "#10B981" },
  { name: "Желтый", hex: "#F59E0B" },
  { name: "Темный", hex: "#0F172A" },
];

export function HomeworkCheckingStudio({
  homework,
  submissions: initialSubmissions,
  isOpen,
  onClose,
  onSaveGrade,
}: HomeworkCheckingStudioProps) {
  const [submissions, setSubmissions] = useState<StudentSubmissionItem[]>(initialSubmissions);

  // Sync if props update
  useEffect(() => {
    setSubmissions(initialSubmissions);
  }, [initialSubmissions]);

  // Selected student
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialSubmissions[0]?.id || ""
  );

  // View mode: single student or all documents in one continuous view
  const [viewMode, setViewMode] = useState<"single" | "all">("single");

  // Current active submission
  const currentSubmission =
    submissions.find((s) => s.id === selectedStudentId) || submissions[0];

  // Tool state
  const [activeTool, setActiveTool] = useState<"pen" | "text" | "eraser">("pen");
  const [penColor, setPenColor] = useState<string>("#EF4444");
  const [strokeWidth, setStrokeWidth] = useState<number>(3);

  // Per-submission annotations map: { [submissionId]: AnnotationItem[] }
  const [annotationsMap, setAnnotationsMap] = useState<{ [subId: string]: AnnotationItem[] }>({});

  // History for Undo/Redo per submission
  const [undoStackMap, setUndoStackMap] = useState<{ [subId: string]: AnnotationItem[][] }>({});
  const [redoStackMap, setRedoStackMap] = useState<{ [subId: string]: AnnotationItem[][] }>({});

  // Rotation angles per submission: { [subId]: number (0, 90, 180, 270) }
  const [rotationMap, setRotationMap] = useState<{ [subId: string]: number }>({});

  // Tasks breakdown: default 14 tasks (matching Image 1)
  const [totalTasksCount, setTotalTasksCount] = useState<number>(homework.totalTasks || 14);
  const [tasksInput, setTasksInput] = useState<string>(String(homework.totalTasks || 14));

  // Tasks completed status per submission: { [subId]: { [taskNum]: true (done) | false (error) | null } }
  const [tasksCompletedMap, setTasksCompletedMap] = useState<{
    [subId: string]: { [taskNum: number]: boolean | null };
  }>({});

  // Grading state for current student
  const [currentGrade, setCurrentGrade] = useState<number>(5);
  const [currentComment, setCurrentComment] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Load active student state into local form
  useEffect(() => {
    if (currentSubmission) {
      setCurrentGrade(currentSubmission.grade || 5);
      setCurrentComment(currentSubmission.teacherComment || "");

      // Load initial annotations if not yet in state
      if (!annotationsMap[currentSubmission.id] && currentSubmission.annotations) {
        setAnnotationsMap((prev) => ({
          ...prev,
          [currentSubmission.id]: currentSubmission.annotations || [],
        }));
      }

      // Load tasks if not yet in state
      if (!tasksCompletedMap[currentSubmission.id] && currentSubmission.tasksCompleted) {
        setTasksCompletedMap((prev) => ({
          ...prev,
          [currentSubmission.id]: currentSubmission.tasksCompleted || {},
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSubmission?.id]);

  // Drawing state on canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<{ x: number; y: number }[]>([]);

  // Text annotation creation state
  const [isAddingText, setIsAddingText] = useState(false);
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null);
  const [newTextInput, setNewTextInput] = useState("");

  const currentAnnotations = React.useMemo(() => {
    return (currentSubmission ? annotationsMap[currentSubmission.id] : []) || [];
  }, [currentSubmission, annotationsMap]);
  const currentRotation = (currentSubmission ? rotationMap[currentSubmission.id] : 0) || 0;
  const currentTasks = (currentSubmission ? tasksCompletedMap[currentSubmission.id] : {}) || {};

  // Redraw canvas when annotations, rotation, or tool changes
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw strokes
    currentAnnotations.forEach((item) => {
      if (item.type === "stroke" && item.points.length > 0) {
        ctx.beginPath();
        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const p0 = item.points[0];
        ctx.moveTo(p0.x, p0.y);

        for (let i = 1; i < item.points.length; i++) {
          const pt = item.points[i];
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }
    });
  }, [currentAnnotations]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Resize canvas to match parent container width/height
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const updateCanvasSize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (container && canvas) {
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          canvas.width = rect.width;
          canvas.height = rect.height;
          redrawCanvas();
        }
      }
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, [redrawCanvas, currentSubmission?.id]);

  // Push to undo stack
  const saveUndoState = (newAnnotations: AnnotationItem[]) => {
    if (!currentSubmission) return;
    const subId = currentSubmission.id;
    setUndoStackMap((prev) => ({
      ...prev,
      [subId]: [...(prev[subId] || []), currentAnnotations],
    }));
    // Clear redo
    setRedoStackMap((prev) => ({ ...prev, [subId]: [] }));
    setAnnotationsMap((prev) => ({ ...prev, [subId]: newAnnotations }));
  };

  const handleUndo = () => {
    if (!currentSubmission) return;
    const subId = currentSubmission.id;
    const stack = undoStackMap[subId] || [];
    if (stack.length === 0) return;

    const previous = stack[stack.length - 1];
    setUndoStackMap((prev) => ({ ...prev, [subId]: stack.slice(0, stack.length - 1) }));
    setRedoStackMap((prev) => ({ ...prev, [subId]: [...(prev[subId] || []), currentAnnotations] }));
    setAnnotationsMap((prev) => ({ ...prev, [subId]: previous }));
  };

  const handleRedo = () => {
    if (!currentSubmission) return;
    const subId = currentSubmission.id;
    const stack = redoStackMap[subId] || [];
    if (stack.length === 0) return;

    const next = stack[stack.length - 1];
    setRedoStackMap((prev) => ({ ...prev, [subId]: stack.slice(0, stack.length - 1) }));
    setUndoStackMap((prev) => ({ ...prev, [subId]: [...(prev[subId] || []), currentAnnotations] }));
    setAnnotationsMap((prev) => ({ ...prev, [subId]: next }));
  };

  const handleClearPage = () => {
    if (!currentSubmission) return;
    if (currentAnnotations.length === 0) return;
    saveUndoState([]);
  };

  // Pointer / Touch drawing handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === "pen") {
      isDrawingRef.current = true;
      currentPointsRef.current = [{ x, y }];
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.beginPath();
        ctx.strokeStyle = penColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(x, y);
      }
    } else if (activeTool === "text") {
      setTextPosition({ x, y });
      setIsAddingText(true);
      setNewTextInput("");
    } else if (activeTool === "eraser") {
      // Find and delete stroke or text near (x, y)
      const hitRadius = 20;
      const filtered = currentAnnotations.filter((item) => {
        if (item.type === "stroke") {
          return !item.points.some(
            (p) => Math.hypot(p.x - x, p.y - y) < hitRadius
          );
        } else if (item.type === "text") {
          // Eraser deleting text annotations
          return Math.hypot(item.x - x, item.y - y) > 40;
        }
        return true;
      });
      if (filtered.length !== currentAnnotations.length) {
        saveUndoState(filtered);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current && activeTool !== "eraser") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === "pen" && isDrawingRef.current) {
      currentPointsRef.current.push({ x, y });
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    } else if (activeTool === "eraser" && e.buttons === 1) {
      const hitRadius = 20;
      const filtered = currentAnnotations.filter((item) => {
        if (item.type === "stroke") {
          return !item.points.some(
            (p) => Math.hypot(p.x - x, p.y - y) < hitRadius
          );
        } else if (item.type === "text") {
          return Math.hypot(item.x - x, item.y - y) > 40;
        }
        return true;
      });
      if (filtered.length !== currentAnnotations.length) {
        saveUndoState(filtered);
      }
    }
  };

  const handlePointerUp = () => {
    if (activeTool === "pen" && isDrawingRef.current) {
      isDrawingRef.current = false;
      if (currentPointsRef.current.length > 1) {
        const newStroke: AnnotationStroke = {
          id: `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          type: "stroke",
          color: penColor,
          width: strokeWidth,
          points: [...currentPointsRef.current],
        };
        saveUndoState([...currentAnnotations, newStroke]);
      }
      currentPointsRef.current = [];
    }
  };

  // Add text annotation
  const handleCommitText = () => {
    if (!textPosition || !newTextInput.trim()) {
      setIsAddingText(false);
      setTextPosition(null);
      return;
    }
    const newTextItem: AnnotationText = {
      id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: "text",
      color: penColor,
      text: newTextInput.trim(),
      x: textPosition.x,
      y: textPosition.y,
      fontSize: 15,
    };
    saveUndoState([...currentAnnotations, newTextItem]);
    setIsAddingText(false);
    setTextPosition(null);
    setNewTextInput("");
  };

  // Delete text annotation
  const handleDeleteText = (id: string) => {
    saveUndoState(currentAnnotations.filter((item) => item.id !== id));
  };

  // Toggle rotate
  const handleRotate = () => {
    if (!currentSubmission) return;
    const subId = currentSubmission.id;
    setRotationMap((prev) => ({
      ...prev,
      [subId]: ((prev[subId] || 0) + 90) % 360,
    }));
  };

  // Task click toggle (Green -> Red -> Neutral)
  const handleToggleTask = (taskNum: number) => {
    if (!currentSubmission) return;
    const subId = currentSubmission.id;
    const currentVal = currentTasks[taskNum];
    let nextVal: boolean | null = null;
    if (currentVal === undefined || currentVal === null) nextVal = true; // green
    else if (currentVal === true) nextVal = false; // red
    else nextVal = null; // neutral

    const updated = { ...currentTasks, [taskNum]: nextVal };
    setTasksCompletedMap((prev) => ({ ...prev, [subId]: updated }));

    // Auto-calculate suggested grade based on done tasks
    let completedCount = 0;
    let failedCount = 0;
    for (let i = 1; i <= totalTasksCount; i++) {
      if (updated[i] === true) completedCount++;
      else if (updated[i] === false) failedCount++;
    }
    const ratio = completedCount / totalTasksCount;
    if (ratio >= 0.88) setCurrentGrade(5);
    else if (ratio >= 0.72) setCurrentGrade(4);
    else if (ratio >= 0.5) setCurrentGrade(3);
    else if (failedCount > totalTasksCount * 0.5) setCurrentGrade(2);
  };

  // Generate merged image of student page + teacher's pen strokes & text notes
  const generateCompositeImage = async (): Promise<string> => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container) return "";
    const rect = container.getBoundingClientRect();
    const width = Math.max(400, Math.round(rect.width));
    const height = Math.max(500, Math.round(rect.height));

    const offscreen = document.createElement("canvas");
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return "";

    // 1. Draw base layer
    if (currentSubmission?.pageImages && currentSubmission.pageImages[0]) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = currentSubmission.pageImages[0];
        });
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        const hRatio = width / (img.width || width);
        const vRatio = height / (img.height || height);
        const ratio = Math.min(hRatio, vRatio);
        const centerShiftX = (width - img.width * ratio) / 2;
        const centerShiftY = (height - img.height * ratio) / 2;
        ctx.drawImage(img, 0, 0, img.width, img.height, centerShiftX, centerShiftY, img.width * ratio, img.height * ratio);
      } catch {
        ctx.fillStyle = "#FAF9F5";
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      ctx.fillStyle = "#FAF9F5";
      ctx.fillRect(0, 0, width, height);

      // Grid
      ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Notebook Header
      ctx.fillStyle = "#1E40AF";
      ctx.font = "bold 14px monospace, serif";
      ctx.fillText(currentSubmission?.studentName || "Ученик", 30, 40);
      ctx.font = "12px monospace, serif";
      ctx.fillText(homework.targetDate, width - 140, 40);

      ctx.strokeStyle = "rgba(96, 165, 250, 0.4)";
      ctx.beginPath();
      ctx.moveTo(30, 50);
      ctx.lineTo(width - 30, 50);
      ctx.stroke();

      ctx.font = "bold 16px monospace, serif";
      ctx.fillStyle = "#1E3A8A";
      ctx.fillText(`ДЗ: ${homework.subjectName} — ${homework.title}`, 30, 80);

      // Student answer text
      ctx.font = "14px monospace, serif";
      ctx.fillStyle = "#172554";
      const textToRender = currentSubmission?.content || "Решение домашнего задания выполнено в тетради.";
      const lines = textToRender.split("\n");
      let lineY = 120;
      for (const line of lines) {
        ctx.fillText(line, 30, lineY);
        lineY += 24;
        if (lineY > height - 60) break;
      }

      // Footer
      ctx.font = "11px monospace, serif";
      ctx.fillStyle = "#64748B";
      ctx.fillText("Работа выполнена самостоятельно • Проверено учителем", 30, height - 25);
    }

    // 2. Draw canvas drawings directly from canvasRef
    if (canvas) {
      ctx.drawImage(canvas, 0, 0, width, height);
    }

    // 3. Draw text annotations
    currentAnnotations.forEach((item) => {
      if (item.type === "text" && item.text) {
        const pxX = (item.x / 100) * width;
        const pxY = (item.y / 100) * height;

        ctx.font = "bold 13px sans-serif";
        const textMetrics = ctx.measureText(item.text);
        const textWidth = textMetrics.width;

        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 1.5;
        const padX = 8;
        const padY = 5;
        const badgeH = 24;
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(pxX - padX, pxY - badgeH + padY, textWidth + padX * 2, badgeH, 6);
        } else {
          ctx.rect(pxX - padX, pxY - badgeH + padY, textWidth + padX * 2, badgeH);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = item.color;
        ctx.fillText(item.text, pxX, pxY);
      }
    });

    return offscreen.toDataURL("image/jpeg", 0.92);
  };

  // Save current student grade
  const handleSaveGrade = async (advanceToNext = false) => {
    if (!currentSubmission) return;
    setIsSaving(true);
    try {
      const modifiedImg = await generateCompositeImage();

      await onSaveGrade(
        currentSubmission.id,
        currentGrade,
        currentComment,
        currentAnnotations,
        currentTasks,
        modifiedImg
      );

      // Update local status
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === currentSubmission.id
            ? {
                ...s,
                status: "GRADED",
                grade: currentGrade,
                teacherComment: currentComment,
                annotations: currentAnnotations,
                tasksCompleted: currentTasks,
                modifiedImageUrl: modifiedImg,
              }
            : s
        )
      );

      if (advanceToNext) {
        const currentIndex = submissions.findIndex((s) => s.id === currentSubmission.id);
        if (currentIndex < submissions.length - 1) {
          setSelectedStudentId(submissions[currentIndex + 1].id);
        }
      }
    } catch (err: any) {
      alert(err.message || "Ошибка при сохранении оценки");
    } finally {
      setIsSaving(false);
    }
  };

  // Statistics
  const gradedCount = submissions.filter((s) => s.status === "GRADED").length;
  const gradedPercentage = Math.round((gradedCount / Math.max(1, submissions.length)) * 100);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F3F4F6] text-zinc-900 select-none overflow-hidden font-sans">
      {/* 1. TOP HEADER TOOLBAR (Matching Image 1) */}
      <header className="flex h-14 w-full shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 shadow-xs">
        {/* Left Section: Back, Title, Mode */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition"
            title="Вернуться назад"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div>
            <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-zinc-900 leading-tight">
              Проверка домашней работы
            </h1>
            <p className="text-[11px] font-semibold text-zinc-500 leading-none mt-0.5">
              {homework.title} • {homework.subjectName}
            </p>
          </div>

          <div className="hidden md:flex items-center ml-4 pl-4 border-l border-zinc-200 gap-1 bg-zinc-100/80 p-0.5 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode("single")}
              className={`px-3 py-1 rounded-lg transition ${
                viewMode === "single"
                  ? "bg-white text-zinc-900 shadow-xs font-bold"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              По ученикам
            </button>
            <button
              type="button"
              onClick={() => setViewMode("all")}
              className={`px-3 py-1 rounded-lg transition ${
                viewMode === "all"
                  ? "bg-white text-zinc-900 shadow-xs font-bold"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              Все работы одним документом
            </button>
          </div>
        </div>

        {/* Center / Right: Drawing Tools (Pen, Text, Eraser, Colors, Thickness, Undo/Redo) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Main Drawing Tools */}
          <div className="flex items-center rounded-xl bg-zinc-100 p-1 border border-zinc-200/80">
            <button
              type="button"
              onClick={() => setActiveTool("pen")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTool === "pen"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-zinc-700 hover:bg-white/80"
              }`}
              title="Ручка (свободное рисование)"
            >
              <PenTool className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ручка</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool("text")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTool === "text"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-zinc-700 hover:bg-white/80"
              }`}
              title="Текст (кликните на фото, чтобы оставить комментарий)"
            >
              <Type className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Текст</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool("eraser")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTool === "eraser"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-zinc-700 hover:bg-white/80"
              }`}
              title="Ластик (удаляет штрихи и текстовые пометки)"
            >
              <Eraser className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ластик</span>
            </button>
          </div>

          {/* Color Picker */}
          <div className="hidden sm:flex items-center gap-1.5 px-2 border-l border-r border-zinc-200">
            {PALETTE.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => setPenColor(c.hex)}
                className={`h-6 w-6 rounded-full transition-transform ${
                  penColor === c.hex ? "scale-115 ring-2 ring-blue-500 ring-offset-2" : "hover:scale-105"
                }`}
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
          </div>

          {/* Stroke Width Selector */}
          <div className="hidden md:flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
            {[2, 4, 8].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setStrokeWidth(w)}
                className={`flex h-7 w-7 items-center justify-center rounded transition ${
                  strokeWidth === w ? "bg-white font-bold text-blue-600 shadow-xs" : "text-zinc-500 hover:text-zinc-900"
                }`}
                title={`Толщина: ${w}px`}
              >
                <div
                  className="rounded-full bg-current"
                  style={{ width: `${w * 1.5}px`, height: `${w * 1.5}px` }}
                />
              </button>
            ))}
          </div>

          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!undoStackMap[currentSubmission?.id]?.length}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 disabled:opacity-30"
              title="Отменить действие"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!redoStackMap[currentSubmission?.id]?.length}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 disabled:opacity-30"
              title="Повторить действие"
            >
              <Redo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleClearPage}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-red-50 hover:text-red-600 transition"
              title="Очистить все пометки"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* Rotate & Download Actions */}
          <div className="flex items-center gap-1 pl-1">
            <button
              type="button"
              onClick={handleRotate}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100"
              title="Повернуть фото на 90°"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="hidden lg:flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 shadow-xs"
              title="Скачать или распечатать с пометками"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Скачать PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN 3-COLUMN WORKSPACE (Left: Students, Center: Photo Canvas, Right: Grading) */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT COLUMN: SUBMITTED STUDENTS LIST (Matching Image 1) */}
        <aside className="w-64 sm:w-72 shrink-0 border-r border-zinc-200 bg-white flex flex-col justify-between">
          <div className="p-3 border-b border-zinc-100 bg-zinc-50/70">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-800">
                {homework.targetDate}
              </span>
              <span className="text-[11px] font-semibold text-zinc-500">
                {submissions.length} работ • 35 листов
              </span>
            </div>
            <div className="mt-1 text-xs font-extrabold text-zinc-900 truncate">
              {homework.title}
            </div>
          </div>

          {/* Student list */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
            {submissions.map((sub, idx) => {
              const isSelected = sub.id === currentSubmission?.id && viewMode === "single";
              const isGraded = sub.status === "GRADED";

              return (
                <div
                  key={sub.id}
                  onClick={() => {
                    setSelectedStudentId(sub.id);
                    setViewMode("single");
                  }}
                  className={`flex items-center justify-between p-3 cursor-pointer transition ${
                    isSelected
                      ? "bg-blue-50/80 border-l-4 border-blue-600"
                      : "hover:bg-zinc-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Two-letter Avatar */}
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-white shadow-xs"
                      style={{ backgroundColor: sub.avatarColor || "#2563EB" }}
                    >
                      {sub.initials || "УЧ"}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-zinc-900">
                        {sub.studentName}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        {sub.pagesCount || 1} лист • {sub.submittedAt || "16.09.2026, 17:45"}
                      </div>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {isGraded ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">
                        {sub.grade || "✓"}
                      </span>
                    ) : (
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" title="Ожидает проверки" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom quick summary */}
          <div className="p-3 border-t border-zinc-200 bg-zinc-50 text-[11px] font-semibold text-zinc-600 flex items-center justify-between">
            <span>Проверено:</span>
            <span className="font-extrabold text-blue-600">
              {gradedCount} из {submissions.length} ({gradedPercentage}%)
            </span>
          </div>
        </aside>

        {/* CENTER VIEWPORT: STUDENT'S HANDWRITTEN HOMEWORK PHOTO + DRAWING CANVAS */}
        <main className="flex-1 overflow-y-auto bg-[#2E3440] p-4 sm:p-6 flex flex-col items-center justify-start relative">
          {currentSubmission ? (
            <div className="flex flex-col items-center w-full max-w-4xl space-y-6">
              {/* Page Header */}
              <div className="w-full flex items-center justify-between text-xs font-bold text-zinc-300 px-2">
                <span>
                  {currentSubmission.studentName}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400">лист 1 из {currentSubmission.pagesCount || 1}</span>
                  <button
                    type="button"
                    onClick={handleRotate}
                    className="p-1 rounded hover:bg-white/10 text-zinc-300"
                    title="Повернуть лист"
                  >
                    <RotateCw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Photo Card with Canvas Layer */}
              <div
                ref={containerRef}
                className="relative w-full overflow-hidden rounded-2xl shadow-2xl bg-white border border-zinc-700 transition-transform duration-300"
                style={{
                  transform: `rotate(${currentRotation}deg)`,
                  transformOrigin: "center center",
                }}
              >
                {/* 1. Underlying Student Homework Sheet (Realistic Math Homework or Uploaded Photo) */}
                <div className="relative w-full aspect-[3/4] bg-[#FAF9F5] select-none">
                  {currentSubmission.pageImages && currentSubmission.pageImages[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentSubmission.pageImages[0]}
                      alt="Домашняя работа ученика"
                      className="w-full h-full object-contain pointer-events-none"
                    />
                  ) : (
                    // Authentic Student Handwritten Math Notebook Page in Grid (Matching Image 1)
                    <div className="absolute inset-0 p-8 sm:p-12 text-[#1E293B] font-serif leading-relaxed flex flex-col justify-between overflow-hidden">
                      {/* Notebook Squared Grid Background Pattern */}
                      <div
                        className="absolute inset-0 opacity-25 pointer-events-none"
                        style={{
                          backgroundImage:
                            "linear-gradient(to right, #94A3B8 1px, transparent 1px), linear-gradient(to bottom, #94A3B8 1px, transparent 1px)",
                          backgroundSize: "20px 20px",
                        }}
                      />

                      {/* Header in Blue Pen */}
                      <div className="relative z-0 space-y-2">
                        <div className="flex items-center justify-between border-b border-blue-400/40 pb-2">
                          <span className="font-mono text-sm font-bold text-blue-800">
                            {currentSubmission.studentName}
                          </span>
                          <span className="font-mono text-xs text-blue-600">
                            {homework.targetDate}
                          </span>
                        </div>

                        <div className="text-center py-2 font-mono text-base font-extrabold text-blue-900 tracking-wide">
                          ДЗ. {homework.subjectName}: {homework.title}
                        </div>
                      </div>

                      {/* Student's answer in blue ink */}
                      <div className="relative z-0 space-y-4 text-xs sm:text-sm font-mono text-blue-950 font-medium my-auto">
                        {currentSubmission.content ? (
                          <div className="space-y-2 whitespace-pre-wrap bg-white/50 p-5 rounded-2xl border border-blue-200/60 shadow-xs">
                            <p className="font-bold text-blue-900 text-sm">Выполненное решение ученика:</p>
                            <p className="text-blue-950 leading-relaxed font-sans text-sm">{currentSubmission.content}</p>
                          </div>
                        ) : homework.subjectName.toLowerCase().includes("математ") || homework.title.toLowerCase().includes("вектор") ? (
                          <div className="space-y-3">
                            <div>
                              <p className="font-bold text-blue-900">1. Задание по теме: {homework.title}</p>
                              <p className="pl-4 mt-1 text-blue-800">Дано: координаты векторов и числовые коэффициенты. Решение выполнено подробно.</p>
                            </div>
                            <div>
                              <p className="font-bold text-blue-900">2. Вычисление числовых значений и проекций:</p>
                              <p className="pl-4 mt-1 text-blue-800">|a&#773;| = &radic;(64 + 225) = &radic;289 = 17. Ответ проверен.</p>
                            </div>
                            <div>
                              <p className="font-bold text-blue-900">3. Итоговый ответ к заданию:</p>
                              <p className="pl-4 mt-1 text-blue-800">Ответ получен строго по алгоритму, график приведен в решении.</p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3 bg-white/50 p-5 rounded-2xl border border-blue-200/60 shadow-xs">
                            <p className="font-bold text-blue-900 text-sm">Решение домашнего задания:</p>
                            <p className="text-blue-950 leading-relaxed font-sans text-sm">
                              {homework.description || `Задание по предмету «${homework.subjectName}» (${homework.title}) выполнено в тетради.`}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Footer Signature */}
                      <div className="relative z-0 flex items-center justify-between text-xs font-mono text-zinc-500 pt-4 border-t border-zinc-300">
                        <span>Работа выполнена самостоятельно</span>
                        <span>Стр. 1 из {currentSubmission.pagesCount || 1}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Interactive Canvas Overlay for Teacher's Pen Drawings */}
                <canvas
                  ref={canvasRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className={`absolute inset-0 w-full h-full z-10 touch-none ${
                    activeTool === "pen"
                      ? "cursor-crosshair"
                      : activeTool === "text"
                      ? "cursor-text"
                      : activeTool === "eraser"
                      ? "cursor-cell"
                      : "cursor-default"
                  }`}
                />

                {/* 3. Text Annotations Layer (Draggable and Deletable) */}
                <div className="absolute inset-0 pointer-events-none z-20">
                  {currentAnnotations
                    .filter((item): item is AnnotationText => item.type === "text")
                    .map((item) => (
                      <div
                        key={item.id}
                        onClick={(e) => {
                          if (activeTool === "eraser") {
                            e.stopPropagation();
                            handleDeleteText(item.id);
                          }
                        }}
                        className={`group absolute pointer-events-auto flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1 text-xs font-black shadow-md border transition ${
                          activeTool === "eraser"
                            ? "cursor-cell hover:border-red-500 hover:bg-red-50 hover:text-red-700"
                            : ""
                        }`}
                        style={{
                          left: `${item.x}px`,
                          top: `${item.y}px`,
                          borderColor: item.color,
                          color: item.color,
                        }}
                      >
                        <span>{item.text}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteText(item.id);
                          }}
                          className="rounded p-0.5 hover:bg-red-100 text-red-600 transition"
                          title="Удалить пометку"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                </div>

                {/* 4. Text Input Prompt when clicking with Text Tool */}
                {isAddingText && textPosition && (
                  <div
                    className="absolute z-30 flex items-center gap-1 rounded-xl bg-white p-1.5 shadow-xl border border-blue-500"
                    style={{ left: `${textPosition.x}px`, top: `${textPosition.y}px` }}
                  >
                    <input
                      type="text"
                      autoFocus
                      value={newTextInput}
                      onChange={(e) => setNewTextInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCommitText();
                        if (e.key === "Escape") {
                          setIsAddingText(false);
                          setTextPosition(null);
                        }
                      }}
                      placeholder="Заметка или ошибка..."
                      className="h-7 w-48 rounded-lg border border-zinc-200 px-2 text-xs text-zinc-900 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleCommitText}
                      className="flex h-7 px-2 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingText(false);
                        setTextPosition(null);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-400">
              Работы не выбраны
            </div>
          )}
        </main>

        {/* RIGHT COLUMN: TASK CHECKLIST & GRADING (Matching Image 1) */}
        <aside className="w-72 sm:w-80 shrink-0 border-l border-zinc-200 bg-white flex flex-col justify-between overflow-y-auto">
          <div className="p-4 space-y-5">
            {/* 1. Выполнение заданий (Task grid) */}
            <div>
              <h2 className="text-sm font-extrabold text-zinc-900">
                Выполнение заданий
              </h2>
              <p className="text-[11px] text-zinc-500 leading-tight mt-1">
                Укажите количество задач для этого ДЗ. Красным отметьте номера, которые ученик не выполнил:
              </p>

              {/* Tasks count config */}
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={tasksInput}
                  onChange={(e) => setTasksInput(e.target.value)}
                  className="h-8 w-20 rounded-xl border border-zinc-300 px-2 text-center text-xs font-bold text-zinc-900 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const parsed = parseInt(tasksInput, 10);
                    if (!isNaN(parsed) && parsed > 0 && parsed <= 60) {
                      setTotalTasksCount(parsed);
                    }
                  }}
                  className="h-8 flex-1 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800 transition"
                >
                  Создать
                </button>
              </div>

              {/* Interactive Tasks Matrix */}
              <div className="mt-3 grid grid-cols-5 gap-1.5">
                {Array.from({ length: totalTasksCount }).map((_, i) => {
                  const num = i + 1;
                  const status = currentTasks[num]; // true = green, false = red, null = neutral

                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleToggleTask(num)}
                      className={`flex h-9 items-center justify-center rounded-xl text-xs font-bold transition-all shadow-xs ${
                        status === true
                          ? "bg-emerald-500 text-white font-extrabold"
                          : status === false
                          ? "bg-rose-500 text-white font-extrabold"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      }`}
                      title={
                        status === true
                          ? `Задача ${num}: Выполнено`
                          : status === false
                          ? `Задача ${num}: Ошибка / Не выполнено`
                          : `Задача ${num}: Нажмите для отметки`
                      }
                    >
                      {num}
                    </button>
                  );
                })}
              </div>

              {/* Mini legend */}
              <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-400 font-semibold px-1">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Сделано
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-500" /> Ошибка
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-zinc-200" /> Без оценки
                </span>
              </div>
            </div>

            {/* 2. Текущая работа & Оценка */}
            <div className="pt-4 border-t border-zinc-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-zinc-900">Текущая работа:</span>
                <span className="text-xs font-bold text-blue-600 truncate max-w-[140px]">
                  {currentSubmission?.studentName}
                </span>
              </div>

              {/* Grade Selector 2, 3, 4, 5 */}
              <div>
                <label className="text-[11px] font-bold text-zinc-500">Итоговая оценка:</label>
                <div className="mt-1.5 grid grid-cols-4 gap-2">
                  {[2, 3, 4, 5].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setCurrentGrade(g)}
                      className={`flex h-10 items-center justify-center rounded-xl text-base font-black transition ${
                        currentGrade === g
                          ? "bg-blue-600 text-white shadow-md scale-102"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment text */}
              <div>
                <label className="text-[11px] font-bold text-zinc-500">
                  Замечания и комментарий:
                </label>
                <textarea
                  rows={3}
                  value={currentComment}
                  onChange={(e) => setCurrentComment(e.target.value)}
                  placeholder="Например: все верно, но аккуратнее с чертежом..."
                  className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5 text-xs text-zinc-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSaveGrade(false)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{isSaving ? "Сохранение..." : "Сохранить оценку"}</span>
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSaveGrade(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition"
                >
                  <span>Сохранить и следующий</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 3. Общая статистика (Matching Image 1) */}
            <div className="pt-4 border-t border-zinc-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-zinc-900">Общая статистика</span>
                <span className="text-zinc-500 text-[11px] font-bold">
                  {gradedCount} / {submissions.length}
                </span>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${gradedPercentage}%` }}
                />
              </div>

              <p className="text-[10px] text-zinc-400">
                Завершите проверку всех работ для формирования классного отчета.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
