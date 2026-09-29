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
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  ZoomIn,
  ZoomOut,
  SlidersHorizontal,
} from "lucide-react";
import { useAppTheme } from "./theme-context";
import { ThemeSwitcher } from "./theme-switcher";

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

  // Сворачивание панелей: режим "Только фото" (свернуть всё, кроме файла) или раздельное сворачивание
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState<boolean>(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const { theme } = useAppTheme();
  const isPlanet = theme === "planet";
  const isGarden = theme === "garden";

  // Dynamic theme styling matching the chosen theme
  const themeTokens = {
    headerBg: isPlanet
      ? "bg-[#090D18]/95 border-sky-500/25 text-zinc-100 backdrop-blur-xl"
      : isGarden
      ? "bg-[#141C16]/95 border-[#FEC868]/25 text-zinc-100 backdrop-blur-xl"
      : "bg-[#0C121A]/95 border-emerald-500/25 text-zinc-100 backdrop-blur-xl",

    sidebarBg: isPlanet
      ? "bg-[#070A12]/95 border-sky-500/20 text-zinc-100 backdrop-blur-xl"
      : isGarden
      ? "bg-[#111713]/95 border-[#FEC868]/20 text-zinc-100 backdrop-blur-xl"
      : "bg-[#0A0E15]/95 border-emerald-500/20 text-zinc-100 backdrop-blur-xl",

    panelSubHeaderBg: isPlanet
      ? "bg-sky-950/30 border-sky-500/20 text-zinc-200"
      : isGarden
      ? "bg-[#1A251D]/50 border-[#FEC868]/20 text-zinc-200"
      : "bg-emerald-950/30 border-emerald-500/20 text-zinc-200",

    accentBtn: isPlanet
      ? "bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-[0_0_16px_rgba(56,189,248,0.35)]"
      : isGarden
      ? "bg-[#FEC868] hover:bg-[#ffe082] text-zinc-950 shadow-[0_0_16px_rgba(254,200,104,0.35)]"
      : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.3)]",

    activeToolBtn: isPlanet
      ? "bg-sky-500 text-slate-950 shadow-sm"
      : isGarden
      ? "bg-[#FEC868] text-zinc-950 shadow-sm"
      : "bg-emerald-600 text-white shadow-sm",

    activeStudentItem: isPlanet
      ? "bg-sky-500/15 border-l-4 border-sky-400 text-sky-200"
      : isGarden
      ? "bg-[#FEC868]/15 border-l-4 border-[#FEC868] text-[#FEC868]"
      : "bg-emerald-500/15 border-l-4 border-emerald-500 text-emerald-300",

    focusBtn: isPlanet
      ? "bg-sky-500 hover:bg-sky-400 text-slate-950 font-black shadow-[0_0_12px_rgba(56,189,248,0.35)]"
      : isGarden
      ? "bg-[#FEC868] hover:bg-[#ffe082] text-zinc-950 font-black shadow-[0_0_12px_rgba(254,200,104,0.35)]"
      : "bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-[0_0_12px_rgba(16,185,129,0.3)]",

    accentText: isPlanet
      ? "text-sky-400"
      : isGarden
      ? "text-[#FEC868]"
      : "text-emerald-400",

    accentBorder: isPlanet
      ? "border-sky-500/30"
      : isGarden
      ? "border-[#FEC868]/30"
      : "border-emerald-500/30",

    collapsedStrip: isPlanet
      ? "bg-[#070A12] border-sky-500/20 text-sky-300 hover:bg-sky-950/40"
      : isGarden
      ? "bg-[#111713] border-[#FEC868]/20 text-[#FEC868] hover:bg-[#1A251D]/60"
      : "bg-[#0A0E15] border-emerald-500/20 text-emerald-300 hover:bg-emerald-950/40",

    progressBar: isPlanet
      ? "bg-sky-400"
      : isGarden
      ? "bg-[#FEC868]"
      : "bg-emerald-500",
  };

  // Индекс и переключение между учениками
  const currentStudentIdx = submissions.findIndex((s) => s.id === (currentSubmission?.id || selectedStudentId));
  const handlePrevStudent = () => {
    if (currentStudentIdx > 0) {
      setSelectedStudentId(submissions[currentStudentIdx - 1].id);
    }
  };
  const handleNextStudent = () => {
    if (currentStudentIdx < submissions.length - 1) {
      setSelectedStudentId(submissions[currentStudentIdx + 1].id);
    }
  };

  // Горячая клавиша F для переключения режима "Только фото" и Esc для выхода
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "f" || e.key === "F" || e.key === "а" || e.key === "А") {
        setIsFocusMode((prev) => !prev);
      }
      if (e.key === "Escape" && isFocusMode) {
        setIsFocusMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFocusMode]);

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
    const timer = setTimeout(updateCanvasSize, 150);
    window.addEventListener("resize", updateCanvasSize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateCanvasSize);
    };
  }, [redrawCanvas, currentSubmission?.id, isFocusMode, isLeftCollapsed, isRightCollapsed, zoomLevel]);

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
    <div className={`fixed inset-0 z-50 flex flex-col select-none overflow-hidden font-sans ${themeTokens.sidebarBg}`}>
      {/* ПЛАВАЮЩИЙ ХАД-ТУЛБАР В РЕЖИМЕ "ТОЛЬКО ФОТО" (СВЕРНУТО ВСЁ, КРОМЕ КАРТИНКИ ФАЙЛА) */}
      {isFocusMode && (
        <div className={`absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-2xl shadow-2xl max-w-[96vw] overflow-x-auto scrollbar-none animate-in fade-in zoom-in-95 duration-200 border ${themeTokens.headerBg}`}>
          <button
            type="button"
            onClick={() => setIsFocusMode(false)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition shadow-sm active:scale-95 shrink-0 ${themeTokens.accentBtn}`}
            title="Развернуть все панели [Esc]"
          >
            <Minimize2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Развернуть всё</span>
          </button>

          <div className="h-5 w-px bg-white/20 shrink-0" />

          {/* Переключатель учеников */}
          <div className="flex items-center gap-1 bg-white/5 rounded-xl px-1.5 py-0.5 border border-white/10 shrink-0">
            <button
              type="button"
              disabled={currentStudentIdx <= 0}
              onClick={handlePrevStudent}
              className="p-1 rounded-lg hover:bg-white/10 text-zinc-300 disabled:opacity-30 transition"
              title="Предыдущий ученик"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="px-1 text-center min-w-[110px] max-w-[170px]">
              <p className="text-xs font-extrabold truncate text-zinc-100">
                {currentSubmission?.studentName || "Ученик"}
              </p>
              <p className="text-[10px] text-zinc-400 font-mono leading-none">
                {currentStudentIdx + 1} из {submissions.length}
              </p>
            </div>
            <button
              type="button"
              disabled={currentStudentIdx >= submissions.length - 1}
              onClick={handleNextStudent}
              className="p-1 rounded-lg hover:bg-white/10 text-zinc-300 disabled:opacity-30 transition"
              title="Следующий ученик"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="h-5 w-px bg-white/20 shrink-0" />

          {/* Инструменты рисования */}
          <div className="flex items-center bg-white/10 p-0.5 rounded-xl border border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTool("pen")}
              className={`p-1.5 rounded-lg text-xs font-bold transition ${
                activeTool === "pen" ? `${themeTokens.activeToolBtn} shadow-xs` : "text-zinc-400 hover:text-white"
              }`}
              title="Ручка"
            >
              <PenTool className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setActiveTool("text")}
              className={`p-1.5 rounded-lg text-xs font-bold transition ${
                activeTool === "text" ? `${themeTokens.activeToolBtn} shadow-xs` : "text-zinc-400 hover:text-white"
              }`}
              title="Текст"
            >
              <Type className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setActiveTool("eraser")}
              className={`p-1.5 rounded-lg text-xs font-bold transition ${
                activeTool === "eraser" ? `${themeTokens.activeToolBtn} shadow-xs` : "text-zinc-400 hover:text-white"
              }`}
              title="Ластик"
            >
              <Eraser className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Цвета */}
          <div className="hidden lg:flex items-center gap-1 shrink-0">
            {PALETTE.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => setPenColor(c.hex)}
                className={`h-5 w-5 rounded-full transition-transform ${
                  penColor === c.hex ? "scale-115 ring-2 ring-white ring-offset-1 ring-offset-black" : "hover:scale-105"
                }`}
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
          </div>

          {/* Отмена / Повтор / Поворот */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!undoStackMap[currentSubmission?.id]?.length}
              className="p-1 rounded-lg text-zinc-400 hover:text-white disabled:opacity-20"
              title="Отменить"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!redoStackMap[currentSubmission?.id]?.length}
              className="p-1 rounded-lg text-zinc-400 hover:text-white disabled:opacity-20"
              title="Повторить"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRotate}
              className="p-1 rounded-lg text-zinc-400 hover:text-white"
              title="Повернуть фото"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="h-5 w-px bg-white/20 shrink-0" />

          {/* Оценка */}
          <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-xl border border-white/10 shrink-0">
            {[2, 3, 4, 5].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setCurrentGrade(g)}
                className={`h-7 w-7 rounded-lg text-xs font-black transition ${
                  currentGrade === g
                    ? `${themeTokens.accentBtn} shadow-xs scale-105`
                    : "text-zinc-400 hover:text-white hover:bg-white/10"
                }`}
                title={`Оценка ${g}`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Сохранить */}
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSaveGrade(false)}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-black transition shadow-xs disabled:opacity-50 shrink-0 ${themeTokens.accentBtn}`}
            title="Сохранить оценку"
          >
            <Save className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isSaving ? "..." : "Сохранить"}</span>
          </button>

          <div className="h-5 w-px bg-white/20 shrink-0" />

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 shrink-0"
            title="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 1. TOP HEADER TOOLBAR — адаптирован под выбранную тему */}
      {!isFocusMode && (
        <header className={`flex h-14 w-full shrink-0 items-center justify-between border-b px-4 shadow-xs ${themeTokens.headerBg}`}>
          {/* Left Section: Back, Title, Mode */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/10 hover:text-white transition"
              title="Вернуться назад"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div>
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-zinc-100 leading-tight">
                Проверка домашней работы
              </h1>
              <p className="text-[11px] font-semibold text-zinc-400 leading-none mt-0.5">
                {homework.title} • {homework.subjectName}
              </p>
            </div>

            <div className="hidden md:flex items-center ml-4 pl-4 border-l border-white/15 gap-1 bg-white/5 p-0.5 rounded-xl text-xs font-semibold border border-white/10">
              <button
                type="button"
                onClick={() => setViewMode("single")}
                className={`px-3 py-1 rounded-lg transition ${
                  viewMode === "single"
                    ? `${themeTokens.activeToolBtn} font-bold shadow-xs`
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                По ученикам
              </button>
              <button
                type="button"
                onClick={() => setViewMode("all")}
                className={`px-3 py-1 rounded-lg transition ${
                  viewMode === "all"
                    ? `${themeTokens.activeToolBtn} font-bold shadow-xs`
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Все работы
              </button>
            </div>

            {/* Кнопка: Свернуть всё, кроме фото (Focus Mode) */}
            <button
              type="button"
              onClick={() => setIsFocusMode(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black shadow-xs hover:shadow-md transition active:scale-95 shrink-0 ml-2 ${themeTokens.focusBtn}`}
              title="Свернуть всё, кроме картинки файла [Клавиша F]"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Свернуть всё, кроме фото</span>
            </button>
          </div>

          {/* Center / Right: Drawing Tools (Pen, Text, Eraser, Colors, Thickness, Undo/Redo) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Main Drawing Tools */}
            <div className="flex items-center rounded-xl bg-white/5 p-1 border border-white/10">
              <button
                type="button"
                onClick={() => setActiveTool("pen")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTool === "pen"
                    ? `${themeTokens.activeToolBtn} shadow-xs`
                    : "text-zinc-400 hover:text-white hover:bg-white/10"
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
                    ? `${themeTokens.activeToolBtn} shadow-xs`
                    : "text-zinc-400 hover:text-white hover:bg-white/10"
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
                    ? `${themeTokens.activeToolBtn} shadow-xs`
                    : "text-zinc-400 hover:text-white hover:bg-white/10"
                }`}
                title="Ластик (удаляет штрихи и текстовые пометки)"
              >
                <Eraser className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Ластик</span>
              </button>
            </div>

            {/* Color Picker */}
            <div className="hidden sm:flex items-center gap-1.5 px-2 border-l border-r border-white/15">
              {PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setPenColor(c.hex)}
                  className={`h-6 w-6 rounded-full transition-transform ${
                    penColor === c.hex ? "scale-115 ring-2 ring-white ring-offset-2 ring-offset-black" : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                />
              ))}
            </div>

            {/* Stroke Width Selector */}
            <div className="hidden md:flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
              {[2, 4, 8].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setStrokeWidth(w)}
                  className={`flex h-7 w-7 items-center justify-center rounded transition ${
                    strokeWidth === w ? `${themeTokens.activeToolBtn} font-bold shadow-xs` : "text-zinc-400 hover:text-white"
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
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-20"
                title="Отменить действие"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={!redoStackMap[currentSubmission?.id]?.length}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-20"
                title="Повторить действие"
              >
                <Redo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleClearPage}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-500/20 hover:text-red-400 transition"
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
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
                title="Повернуть фото на 90°"
              >
                <RotateCw className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="hidden lg:flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:bg-white/15 shadow-xs"
                title="Скачать или распечатать с пометками"
              >
                <Download className="h-3.5 w-3.5" />
                <span>PDF</span>
              </button>

              {/* Переключатель тем прямо в шапке проверки ДЗ */}
              <div className="hidden xl:block shrink-0">
                <ThemeSwitcher />
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>
      )}

      {/* 2. MAIN 3-COLUMN WORKSPACE (Left: Students, Center: Photo Canvas, Right: Grading) */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* LEFT COLUMN: SUBMITTED STUDENTS LIST — адаптирован под тему */}
        {!isFocusMode && !isLeftCollapsed ? (
          <aside className={`w-64 sm:w-72 shrink-0 border-r flex flex-col justify-between transition-all ${themeTokens.sidebarBg}`}>
            <div className={`p-3 border-b flex items-center justify-between ${themeTokens.panelSubHeaderBg}`}>
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-zinc-200">
                    {homework.targetDate}
                  </span>
                  <span className="text-[11px] font-semibold text-zinc-400">
                    • {submissions.length} работ
                  </span>
                </div>
                <div className="mt-0.5 text-xs font-extrabold text-zinc-100 truncate">
                  {homework.title}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLeftCollapsed(true)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition shrink-0"
                title="Свернуть список учеников"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>

            {/* Student list */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/5">
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
                        ? themeTokens.activeStudentItem
                        : "hover:bg-white/5 text-zinc-300"
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
                        <div className={`truncate text-xs font-bold ${isSelected ? "text-white font-extrabold" : "text-zinc-200"}`}>
                          {sub.studentName}
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          {sub.pagesCount || 1} лист • {sub.submittedAt || "16.09.2026, 17:45"}
                        </div>
                      </div>
                    </div>

                    {/* Status Indicator */}
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {isGraded ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-black text-emerald-400 border border-emerald-500/30">
                          {sub.grade || "✓"}
                        </span>
                      ) : (
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]" title="Ожидает проверки" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom quick summary */}
            <div className={`p-3 border-t text-[11px] font-semibold text-zinc-300 flex items-center justify-between ${themeTokens.panelSubHeaderBg}`}>
              <span>Проверено:</span>
              <span className={`font-extrabold ${themeTokens.accentText}`}>
                {gradedCount} из {submissions.length} ({gradedPercentage}%)
              </span>
            </div>
          </aside>
        ) : !isFocusMode && isLeftCollapsed ? (
          <button
            type="button"
            onClick={() => setIsLeftCollapsed(false)}
            className={`h-full w-9 border-r flex flex-col items-center justify-start py-4 gap-3 transition z-20 shrink-0 shadow-xs ${themeTokens.collapsedStrip}`}
            title="Развернуть список учеников"
          >
            <PanelLeftOpen className="h-4 w-4" />
            <span className="[writing-mode:vertical-lr] text-[11px] font-extrabold tracking-wider uppercase opacity-80">
              Ученики ({submissions.length})
            </span>
          </button>
        ) : null}

        {/* CENTER VIEWPORT: STUDENT'S HANDWRITTEN HOMEWORK PHOTO + DRAWING CANVAS */}
        <main className={`flex-1 overflow-y-auto bg-[#2E3440] flex flex-col items-center justify-start relative transition-all duration-300 ${
          isFocusMode ? "p-2 sm:p-4 pt-16 sm:pt-20" : "p-4 sm:p-6"
        }`}>
          {currentSubmission ? (
            <div className={`flex flex-col items-center w-full transition-all duration-300 ${
              isFocusMode ? "max-w-5xl lg:max-w-6xl space-y-4" : "max-w-4xl space-y-6"
            }`}>
              {/* Page Header (hidden in focus mode because HUD toolbar has it) */}
              {!isFocusMode && (
                <div className="w-full flex items-center justify-between text-xs font-bold text-zinc-300 px-2">
                  <span className="truncate">
                    {currentSubmission.studentName}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-zinc-400">лист 1 из {currentSubmission.pagesCount || 1}</span>
                    <button
                      type="button"
                      onClick={handleRotate}
                      className="p-1 rounded hover:bg-white/10 text-zinc-300"
                      title="Повернуть лист на 90°"
                    >
                      <RotateCw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsFocusMode(true)}
                      className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-xl border border-white/15 transition shadow-xs"
                      title="Свернуть всё, кроме фото [Клавиша F]"
                    >
                      <Maximize2 className="h-3.5 w-3.5 text-blue-400" />
                      <span>Только фото</span>
                    </button>
                  </div>
                </div>
              )}

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

          {/* Плавающая кнопка развернуть панели в режиме "Только фото" */}
          {isFocusMode && (
            <button
              type="button"
              onClick={() => setIsFocusMode(false)}
              className={`fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-black shadow-2xl backdrop-blur-md transition active:scale-95 ${
                isPlanet
                  ? "bg-[#090D18]/95 border-sky-500/40 text-sky-200 hover:border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.3)]"
                  : isGarden
                  ? "bg-[#141C16]/95 border-[#FEC868]/40 text-[#FEC868] hover:border-[#FEC868] shadow-[0_0_20px_rgba(254,200,104,0.3)]"
                  : "bg-[#0C121A]/95 border-emerald-500/40 text-emerald-200 hover:border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              }`}
              title="Развернуть все панели [Esc]"
            >
              <Minimize2 className="h-4 w-4" />
              <span>Развернуть панели</span>
            </button>
          )}
        </main>

        {/* RIGHT COLUMN: TASK CHECKLIST & GRADING — адаптирован под тему */}
        {!isFocusMode && !isRightCollapsed ? (
          <aside className={`w-72 sm:w-80 shrink-0 border-l flex flex-col justify-between overflow-y-auto transition-all ${themeTokens.sidebarBg}`}>
            <div className={`p-3 border-b flex items-center justify-between ${themeTokens.panelSubHeaderBg}`}>
              <button
                type="button"
                onClick={() => setIsRightCollapsed(true)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition"
                title="Свернуть панель оценки"
              >
                <PanelRightClose className="h-4 w-4" />
              </button>
              <span className="text-xs font-extrabold text-zinc-100">Оценка и задачи</span>
              <span className={`text-[11px] font-bold ${themeTokens.accentText}`}>Оценка: {currentGrade}</span>
            </div>
            <div className="p-4 space-y-5">
            {/* 1. Выполнение заданий (Task grid) */}
            <div>
              <h2 className="text-sm font-extrabold text-zinc-100">
                Выполнение заданий
              </h2>
              <p className="text-[11px] text-zinc-400 leading-tight mt-1">
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
                  className="h-8 w-20 rounded-xl border border-white/15 bg-white/5 px-2 text-center text-xs font-bold text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    const parsed = parseInt(tasksInput, 10);
                    if (!isNaN(parsed) && parsed > 0 && parsed <= 60) {
                      setTotalTasksCount(parsed);
                    }
                  }}
                  className={`h-8 flex-1 rounded-xl px-3 text-xs font-bold transition ${themeTokens.accentBtn}`}
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
                          ? "bg-emerald-500 text-white font-extrabold shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                          : status === false
                          ? "bg-rose-500 text-white font-extrabold shadow-[0_0_10px_rgba(244,63,94,0.3)]"
                          : "bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10"
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
                  <span className="h-2 w-2 rounded-full bg-white/20" /> Без оценки
                </span>
              </div>
            </div>

            {/* 2. Текущая работа & Оценка */}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-zinc-300">Текущая работа:</span>
                <span className={`text-xs font-bold truncate max-w-[140px] ${themeTokens.accentText}`}>
                  {currentSubmission?.studentName}
                </span>
              </div>

              {/* Grade Selector 2, 3, 4, 5 */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400">Итоговая оценка:</label>
                <div className="mt-1.5 grid grid-cols-4 gap-2">
                  {[2, 3, 4, 5].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setCurrentGrade(g)}
                      className={`flex h-10 items-center justify-center rounded-xl text-base font-black transition ${
                        currentGrade === g
                          ? `${themeTokens.accentBtn} scale-102`
                          : "bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment text */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400">
                  Замечания и комментарий:
                </label>
                <textarea
                  rows={3}
                  value={currentComment}
                  onChange={(e) => setCurrentComment(e.target.value)}
                  placeholder="Например: все верно, но аккуратнее с чертежом..."
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 p-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>

              {/* Submit Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSaveGrade(false)}
                  className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-extrabold transition disabled:opacity-50 ${themeTokens.accentBtn}`}
                >
                  <Save className="h-4 w-4" />
                  <span>{isSaving ? "Сохранение..." : "Сохранить оценку"}</span>
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSaveGrade(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 py-2 text-xs font-bold text-zinc-200 hover:bg-white/10 transition"
                >
                  <span>Сохранить и следующий</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 3. Общая статистика */}
            <div className="pt-4 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-zinc-200">Общая статистика</span>
                <span className="text-zinc-400 text-[11px] font-bold">
                  {gradedCount} / {submissions.length}
                </span>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${themeTokens.progressBar}`}
                  style={{ width: `${gradedPercentage}%` }}
                />
              </div>

              <p className="text-[10px] text-zinc-400">
                Завершите проверку всех работ для формирования классного отчета.
              </p>
            </div>
          </div>
        </aside>
      ) : !isFocusMode && isRightCollapsed ? (
        <button
          type="button"
          onClick={() => setIsRightCollapsed(false)}
          className={`h-full w-9 border-l flex flex-col items-center justify-start py-4 gap-3 transition z-20 shrink-0 shadow-xs ${themeTokens.collapsedStrip}`}
          title="Развернуть панель оценки"
        >
          <PanelRightOpen className="h-4 w-4" />
          <span className="[writing-mode:vertical-lr] text-[11px] font-extrabold tracking-wider uppercase opacity-80">
            Оценка ({currentGrade})
          </span>
        </button>
      ) : null}
      </div>
    </div>
  );
}
