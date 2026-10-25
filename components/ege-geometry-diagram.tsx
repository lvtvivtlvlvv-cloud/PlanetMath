"use client";

import React from "react";

interface EgeGeometryDiagramProps {
  taskNumber: number;
  text: string;
}

type DiagramType =
  | "right_triangle"
  | "isosceles_triangle"
  | "general_triangle"
  | "trapezoid"
  | "parallelogram"
  | "circle_tangent"
  | "vectors_plane"
  | "cube"
  | "pyramid"
  | "prism"
  | "cylinder"
  | "function_graph"
  | null;

function detectDiagramType(taskNumber: number, text: string): DiagramType {
  const lower = text.toLowerCase();

  // Задачи на векторы (№2)
  if (taskNumber === 2 || lower.includes("вектор") || (lower.includes("координат") && taskNumber <= 2)) {
    return "vectors_plane";
  }

  // Задачи на графики функций и производную (№8, №11)
  if (
    taskNumber === 8 ||
    taskNumber === 11 ||
    lower.includes("производн") ||
    lower.includes("график функции") ||
    lower.includes("касательн") && (lower.includes("график") || taskNumber === 8)
  ) {
    return "function_graph";
  }

  // Стереометрия (№3, №14)
  if (taskNumber === 3 || taskNumber === 14 || lower.includes("стереометри")) {
    if (lower.includes("пирамид")) return "pyramid";
    if (lower.includes("куб") || lower.includes("параллелепипед")) return "cube";
    if (lower.includes("цилиндр") || lower.includes("конус")) return "cylinder";
    if (lower.includes("призм")) return "prism";
    return "cube";
  }

  // Планиметрия (№1, №17) или геометрический контекст
  const isGeometry =
    taskNumber === 1 ||
    taskNumber === 17 ||
    lower.includes("треугольник") ||
    lower.includes("трапеци") ||
    lower.includes("параллелограмм") ||
    lower.includes("ромб") ||
    lower.includes("окружност");

  if (!isGeometry) {
    return null;
  }

  if (lower.includes("трапеци") || lower.includes("средняя линия")) {
    return "trapezoid";
  }
  if (lower.includes("параллелограмм") || lower.includes("ромб")) {
    return "parallelogram";
  }
  if (lower.includes("окружност") || lower.includes("касательн") || lower.includes("хорд") || lower.includes("радиус")) {
    return "circle_tangent";
  }
  if (lower.includes("прямоугольн") || lower.includes("угол c равен 90") || lower.includes("гипотенуз")) {
    return "right_triangle";
  }
  if (lower.includes("равнобедренн")) {
    return "isosceles_triangle";
  }

  return "general_triangle";
}

export function EgeGeometryDiagram({ taskNumber, text }: EgeGeometryDiagramProps) {
  const type = detectDiagramType(taskNumber, text);
  if (!type) return null;

  return (
    <div className="shrink-0 w-full sm:w-[260px] md:w-[280px] rounded-2xl bg-slate-950/80 border border-cyan-500/25 p-3 flex flex-col items-center select-none shadow-md">
      <div className="w-full flex items-center justify-between text-[11px] font-bold text-zinc-400 mb-2 px-1">
        <span className="flex items-center gap-1.5 text-cyan-400">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          Векторный чертеж
        </span>
        <span className="text-[10px] uppercase tracking-wider font-mono text-zinc-500">№{taskNumber}</span>
      </div>

      <div className="w-full aspect-[4/3] flex items-center justify-center relative overflow-hidden rounded-xl bg-slate-900/50 border border-white/5 p-1">
        <svg
          viewBox="0 0 260 190"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <marker
              id="arrow-cyan"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#22d3ee" />
            </marker>
            <marker
              id="arrow-sky"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#38bdf8" />
            </marker>
          </defs>

          {/* СЕТКА НА ФОНЕ */}
          <g opacity="0.1" stroke="#38bdf8" strokeWidth="0.5">
            {Array.from({ length: 13 }).map((_, i) => (
              <line key={`v-${i}`} x1={i * 20 + 10} y1="10" x2={i * 20 + 10} y2="180" />
            ))}
            {Array.from({ length: 9 }).map((_, i) => (
              <line key={`h-${i}`} x1="10" y1={i * 20 + 10} x2="250" y2={i * 20 + 10} />
            ))}
          </g>

          {/* ВЫБОР ФИГУРЫ */}
          {type === "right_triangle" && <RightTriangleSvg />}
          {type === "isosceles_triangle" && <IsoscelesTriangleSvg />}
          {type === "general_triangle" && <GeneralTriangleSvg />}
          {type === "trapezoid" && <TrapezoidSvg />}
          {type === "parallelogram" && <ParallelogramSvg />}
          {type === "circle_tangent" && <CircleTangentSvg />}
          {type === "vectors_plane" && <VectorsPlaneSvg />}
          {type === "cube" && <CubeSvg />}
          {type === "pyramid" && <PyramidSvg />}
          {type === "prism" && <PrismSvg />}
          {type === "cylinder" && <CylinderSvg />}
          {type === "function_graph" && <FunctionGraphSvg />}
        </svg>
      </div>

      <p className="mt-2 text-[10px] text-zinc-500 font-medium text-center">
        Интерактивная визуализация геометрической модели
      </p>
    </div>
  );
}

/* ==================== SVG КОМПОНЕНТЫ ФИГУР ==================== */

function Vertex({ x, y, label, dx = 0, dy = -8 }: { x: number; y: number; label: string; dx?: number; dy?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="3.5" fill="#22d3ee" stroke="#030712" strokeWidth="1.5" />
      <text
        x={x + dx}
        y={y + dy}
        fill="#f1f5f9"
        fontSize="11"
        fontWeight="bold"
        fontFamily="sans-serif"
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
}

// Прямоугольный треугольник ABC (угол C = 90°, высота CH)
function RightTriangleSvg() {
  const A = { x: 40, y: 150 };
  const B = { x: 220, y: 150 };
  const C = { x: 80, y: 50 };
  // Основание высоты H
  const H = { x: 80, y: 150 };

  return (
    <g>
      {/* Заливка треугольника */}
      <polygon
        points={`${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y}`}
        fill="rgba(34, 211, 238, 0.08)"
        stroke="#22d3ee"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Высота CH */}
      <line
        x1={C.x}
        y1={C.y}
        x2={H.x}
        y2={H.y}
        stroke="#38bdf8"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      {/* Квадратик прямого угла у вершины C */}
      <path
        d="M 80 62 L 90 66 L 90 54"
        fill="none"
        stroke="#38bdf8"
        strokeWidth="1.2"
      />
      {/* Квадратик прямого угла у H */}
      <path
        d="M 80 140 L 90 140 L 90 150"
        fill="none"
        stroke="#38bdf8"
        strokeWidth="1.2"
      />

      <Vertex x={A.x} y={A.y} label="A" dx={-10} dy={4} />
      <Vertex x={B.x} y={B.y} label="B" dx={12} dy={4} />
      <Vertex x={C.x} y={C.y} label="C" dy={-10} />
      <Vertex x={H.x} y={H.y} label="H" dy={14} />
    </g>
  );
}

// Равнобедренный треугольник ABC (AB = BC) с высотой BH
function IsoscelesTriangleSvg() {
  const A = { x: 45, y: 155 };
  const C = { x: 215, y: 155 };
  const B = { x: 130, y: 40 };
  const H = { x: 130, y: 155 };

  return (
    <g>
      <polygon
        points={`${A.x},${A.y} ${C.x},${C.y} ${B.x},${B.y}`}
        fill="rgba(34, 211, 238, 0.08)"
        stroke="#22d3ee"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Высота/медиана BH */}
      <line
        x1={B.x}
        y1={B.y}
        x2={H.x}
        y2={H.y}
        stroke="#38bdf8"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      {/* Засечки равенства сторон AB и BC */}
      <line x1="82" y1="94" x2="92" y2="100" stroke="#38bdf8" strokeWidth="1.5" />
      <line x1="168" y1="100" x2="178" y2="94" stroke="#38bdf8" strokeWidth="1.5" />
      {/* Прямой угол у H */}
      <path d="M 130 145 L 140 145 L 140 155" fill="none" stroke="#38bdf8" strokeWidth="1.2" />

      <Vertex x={A.x} y={A.y} label="A" dx={-10} dy={4} />
      <Vertex x={C.x} y={C.y} label="C" dx={12} dy={4} />
      <Vertex x={B.x} y={B.y} label="B" dy={-10} />
      <Vertex x={H.x} y={H.y} label="H" dy={14} />
    </g>
  );
}

// Произвольный треугольник ABC
function GeneralTriangleSvg() {
  const A = { x: 40, y: 150 };
  const B = { x: 220, y: 150 };
  const C = { x: 160, y: 45 };
  const H = { x: 160, y: 150 };

  return (
    <g>
      <polygon
        points={`${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y}`}
        fill="rgba(34, 211, 238, 0.08)"
        stroke="#22d3ee"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <line x1={C.x} y1={C.y} x2={H.x} y2={H.y} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 3" />
      <path d="M 160 140 L 150 140 L 150 150" fill="none" stroke="#38bdf8" strokeWidth="1.2" />

      <Vertex x={A.x} y={A.y} label="A" dx={-10} dy={4} />
      <Vertex x={B.x} y={B.y} label="B" dx={12} dy={4} />
      <Vertex x={C.x} y={C.y} label="C" dy={-10} />
      <Vertex x={H.x} y={H.y} label="H" dy={14} />
    </g>
  );
}

// Трапеция ABCD со средней линией MN
function TrapezoidSvg() {
  const A = { x: 35, y: 150 };
  const D = { x: 225, y: 150 };
  const B = { x: 80, y: 55 };
  const C = { x: 180, y: 55 };
  // Средняя линия MN
  const M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const N = { x: (D.x + C.x) / 2, y: (D.y + C.y) / 2 };

  return (
    <g>
      <polygon
        points={`${A.x},${A.y} ${D.x},${D.y} ${C.x},${C.y} ${B.x},${B.y}`}
        fill="rgba(34, 211, 238, 0.08)"
        stroke="#22d3ee"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Средняя линия */}
      <line
        x1={M.x}
        y1={M.y}
        x2={N.x}
        y2={N.y}
        stroke="#38bdf8"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />

      <Vertex x={A.x} y={A.y} label="A" dx={-10} dy={4} />
      <Vertex x={D.x} y={D.y} label="D" dx={12} dy={4} />
      <Vertex x={B.x} y={B.y} label="B" dx={-8} dy={-10} />
      <Vertex x={C.x} y={C.y} label="C" dx={8} dy={-10} />
      <Vertex x={M.x} y={M.y} label="M" dx={-10} dy={2} />
      <Vertex x={N.x} y={N.y} label="N" dx={12} dy={2} />
    </g>
  );
}

// Параллелограмм ABCD с высотой BH
function ParallelogramSvg() {
  const A = { x: 40, y: 150 };
  const D = { x: 200, y: 150 };
  const B = { x: 80, y: 55 };
  const C = { x: 240, y: 55 };
  const H = { x: 80, y: 150 };

  return (
    <g>
      <polygon
        points={`${A.x},${A.y} ${D.x},${D.y} ${C.x},${C.y} ${B.x},${B.y}`}
        fill="rgba(34, 211, 238, 0.08)"
        stroke="#22d3ee"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Высота BH */}
      <line x1={B.x} y1={B.y} x2={H.x} y2={H.y} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 3" />
      <path d="M 80 140 L 90 140 L 90 150" fill="none" stroke="#38bdf8" strokeWidth="1.2" />

      <Vertex x={A.x} y={A.y} label="A" dx={-10} dy={4} />
      <Vertex x={D.x} y={D.y} label="D" dx={10} dy={14} />
      <Vertex x={B.x} y={B.y} label="B" dy={-10} />
      <Vertex x={C.x} y={C.y} label="C" dx={10} dy={-8} />
      <Vertex x={H.x} y={H.y} label="H" dy={14} />
    </g>
  );
}

// Окружность с центром O и касательной / хордой
function CircleTangentSvg() {
  const O = { x: 120, y: 100 };
  const r = 55;
  const T = { x: 120, y: 155 }; // Точка касания снизу
  const A = { x: 30, y: 155 };
  const B = { x: 230, y: 155 };

  return (
    <g>
      {/* Окружность */}
      <circle
        cx={O.x}
        cy={O.y}
        r={r}
        fill="rgba(34, 211, 238, 0.08)"
        stroke="#22d3ee"
        strokeWidth="2"
      />
      {/* Касательная прямая AB */}
      <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#38bdf8" strokeWidth="2" />
      {/* Радиус OT перпендикулярен касательной */}
      <line x1={O.x} y1={O.y} x2={T.x} y2={T.y} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 3" />
      <path d="M 120 145 L 130 145 L 130 155" fill="none" stroke="#38bdf8" strokeWidth="1.2" />

      <Vertex x={O.x} y={O.y} label="O" dy={-8} />
      <Vertex x={T.x} y={T.y} label="T" dy={14} />
      <text x={A.x} y={A.y - 8} fill="#94a3b8" fontSize="11" fontWeight="bold">A</text>
      <text x={B.x} y={B.y - 8} fill="#94a3b8" fontSize="11" fontWeight="bold">B</text>
    </g>
  );
}

// Векторы на координатной плоскости (№2)
function VectorsPlaneSvg() {
  const origin = { x: 50, y: 140 };

  return (
    <g>
      {/* Оси X и Y */}
      <line
        x1="30"
        y1={origin.y}
        x2="230"
        y2={origin.y}
        stroke="#64748b"
        strokeWidth="1.5"
        markerEnd="url(#arrow-sky)"
      />
      <line
        x1={origin.x}
        y1="170"
        x2={origin.x}
        y2="30"
        stroke="#64748b"
        strokeWidth="1.5"
        markerEnd="url(#arrow-sky)"
      />
      <text x="235" y={origin.y + 4} fill="#94a3b8" fontSize="11" fontWeight="bold">x</text>
      <text x={origin.x - 4} y="22" fill="#94a3b8" fontSize="11" fontWeight="bold">y</text>
      <text x={origin.x - 10} y={origin.y + 14} fill="#64748b" fontSize="10">0</text>

      {/* Вектор a */}
      <line
        x1={origin.x + 20}
        y1={origin.y - 20}
        x2={origin.x + 100}
        y2={origin.y - 80}
        stroke="#22d3ee"
        strokeWidth="2.5"
        markerEnd="url(#arrow-cyan)"
      />
      <text x={origin.x + 65} y={origin.y - 65} fill="#22d3ee" fontSize="12" fontWeight="bold">
        {"a\u20D7"}
      </text>

      {/* Вектор b */}
      <line
        x1={origin.x + 40}
        y1={origin.y - 10}
        x2={origin.x + 140}
        y2={origin.y - 20}
        stroke="#38bdf8"
        strokeWidth="2.5"
        markerEnd="url(#arrow-sky)"
      />
      <text x={origin.x + 100} y={origin.y - 30} fill="#38bdf8" fontSize="12" fontWeight="bold">
        {"b\u20D7"}
      </text>
    </g>
  );
}

// Куб / прямоугольный параллелепипед в изометрии (№3, №14)
function CubeSvg() {
  return (
    <g>
      {/* Невидимые задние ребра (пунктир) */}
      <line x1="60" y1="130" x2="60" y2="60" stroke="#475569" strokeWidth="1.2" strokeDasharray="3 3" />
      <line x1="60" y1="130" x2="100" y2="160" stroke="#475569" strokeWidth="1.2" strokeDasharray="3 3" />
      <line x1="60" y1="130" x2="180" y2="130" stroke="#475569" strokeWidth="1.2" strokeDasharray="3 3" />

      {/* Видимые грани куба */}
      {/* Передняя грань */}
      <polygon
        points="100,160 220,160 220,90 100,90"
        fill="rgba(34, 211, 238, 0.05)"
        stroke="#22d3ee"
        strokeWidth="1.8"
      />
      {/* Верхняя грань */}
      <polygon
        points="100,90 220,90 180,60 60,60"
        fill="rgba(56, 189, 248, 0.08)"
        stroke="#22d3ee"
        strokeWidth="1.8"
      />
      {/* Правая грань */}
      <polygon
        points="220,160 220,90 180,60 180,130"
        fill="rgba(14, 165, 233, 0.05)"
        stroke="#22d3ee"
        strokeWidth="1.8"
      />

      <Vertex x={100} y={160} label="A" dx={-8} dy={12} />
      <Vertex x={220} y={160} label="B" dx={8} dy={12} />
      <Vertex x={180} y={130} label="C" dx={10} dy={2} />
      <Vertex x={100} y={90} label="A₁" dx={-10} dy={-4} />
      <Vertex x={220} y={90} label="B₁" dx={12} dy={-4} />
      <Vertex x={180} y={60} label="C₁" dx={8} dy={-8} />
      <Vertex x={60} y={60} label="D₁" dx={-10} dy={-6} />
    </g>
  );
}

// Пирамида SABCD
function PyramidSvg() {
  const S = { x: 130, y: 35 };
  const A = { x: 50, y: 145 };
  const B = { x: 110, y: 165 };
  const C = { x: 215, y: 145 };
  const D = { x: 160, y: 125 };
  const H = { x: 130, y: 145 };

  return (
    <g>
      {/* Невидимые ребра основания и боковое SD */}
      <line x1={A.x} y1={A.y} x2={D.x} y2={D.y} stroke="#475569" strokeWidth="1.2" strokeDasharray="3 3" />
      <line x1={C.x} y1={C.y} x2={D.x} y2={D.y} stroke="#475569" strokeWidth="1.2" strokeDasharray="3 3" />
      <line x1={S.x} y1={S.y} x2={D.x} y2={D.y} stroke="#475569" strokeWidth="1.2" strokeDasharray="3 3" />
      {/* Высота SH */}
      <line x1={S.x} y1={S.y} x2={H.x} y2={H.y} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 3" />

      {/* Видимые грани */}
      <polygon
        points={`${S.x},${S.y} ${A.x},${A.y} ${B.x},${B.y}`}
        fill="rgba(34, 211, 238, 0.06)"
        stroke="#22d3ee"
        strokeWidth="1.8"
      />
      <polygon
        points={`${S.x},${S.y} ${B.x},${B.y} ${C.x},${C.y}`}
        fill="rgba(56, 189, 248, 0.09)"
        stroke="#22d3ee"
        strokeWidth="1.8"
      />

      <Vertex x={S.x} y={S.y} label="S" dy={-10} />
      <Vertex x={A.x} y={A.y} label="A" dx={-10} dy={4} />
      <Vertex x={B.x} y={B.y} label="B" dy={14} />
      <Vertex x={C.x} y={C.y} label="C" dx={12} dy={4} />
      <Vertex x={D.x} y={D.y} label="D" dx={10} dy={-6} />
    </g>
  );
}

// Призма треугольная ABCA₁B₁C₁
function PrismSvg() {
  return (
    <g>
      {/* Заднее ребро невидимое */}
      <line x1="80" y1="130" x2="80" y2="55" stroke="#475569" strokeWidth="1.2" strokeDasharray="3 3" />
      <line x1="80" y1="130" x2="50" y2="160" stroke="#475569" strokeWidth="1.2" strokeDasharray="3 3" />
      <line x1="80" y1="130" x2="200" y2="150" stroke="#475569" strokeWidth="1.2" strokeDasharray="3 3" />

      {/* Основания и грани */}
      <polygon
        points="50,160 200,150 140,80 50,90"
        fill="rgba(34, 211, 238, 0.05)"
        stroke="#22d3ee"
        strokeWidth="1.8"
      />
      <polygon
        points="50,90 200,80 140,40 50,45"
        fill="rgba(56, 189, 248, 0.08)"
        stroke="#22d3ee"
        strokeWidth="1.8"
      />
      <line x1="200" y1="150" x2="200" y2="80" stroke="#22d3ee" strokeWidth="1.8" />
      <line x1="50" y1="160" x2="50" y2="90" stroke="#22d3ee" strokeWidth="1.8" />

      <Vertex x={50} y={160} label="A" dx={-8} dy={12} />
      <Vertex x={200} y={150} label="B" dx={10} dy={12} />
      <Vertex x={50} y={90} label="A₁" dx={-10} dy={-4} />
      <Vertex x={200} y={80} label="B₁" dx={10} dy={-4} />
    </g>
  );
}

// Цилиндр с основанием-эллипсом
function CylinderSvg() {
  return (
    <g>
      {/* Нижнее основание */}
      <ellipse cx="130" cy="145" rx="70" ry="20" fill="rgba(34, 211, 238, 0.06)" stroke="#22d3ee" strokeWidth="1.8" />
      {/* Верхнее основание */}
      <ellipse cx="130" cy="55" rx="70" ry="20" fill="rgba(56, 189, 248, 0.09)" stroke="#22d3ee" strokeWidth="1.8" />
      {/* Боковые образующие */}
      <line x1="60" y1="55" x2="60" y2="145" stroke="#22d3ee" strokeWidth="1.8" />
      <line x1="200" y1="55" x2="200" y2="145" stroke="#22d3ee" strokeWidth="1.8" />
      {/* Ось цилиндра */}
      <line x1="130" y1="55" x2="130" y2="145" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="4 3" />

      <Vertex x={130} y={55} label="O₁" dy={-10} />
      <Vertex x={130} y={145} label="O" dy={16} />
    </g>
  );
}

// График функции y = f(x) и касательная (№8, №11)
function FunctionGraphSvg() {
  return (
    <g>
      {/* Координатная сетка и оси */}
      <line x1="30" y1="110" x2="235" y2="110" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#arrow-sky)" />
      <line x1="100" y1="170" x2="100" y2="25" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#arrow-sky)" />
      <text x="238" y="114" fill="#94a3b8" fontSize="11" fontWeight="bold">x</text>
      <text x="96" y="20" fill="#94a3b8" fontSize="11" fontWeight="bold">y</text>

      {/* Гладкая кривая функции y = f(x) */}
      <path
        d="M 40 150 C 70 50, 110 50, 140 120 C 160 160, 190 150, 220 70"
        fill="none"
        stroke="#22d3ee"
        strokeWidth="2.5"
      />
      <text x="215" y="60" fill="#22d3ee" fontSize="11" fontWeight="bold">y = f(x)</text>

      {/* Касательная в точке перегиба/экстремума */}
      <line x1="50" y1="65" x2="210" y2="135" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 3" />

      {/* Точка касания x0 */}
      <Vertex x={130} y={100} label="A(x₀)" dy={-10} />
      <line x1="130" y1="100" x2="130" y2="110" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />
      <text x="130" y="122" fill="#94a3b8" fontSize="10" textAnchor="middle">x₀</text>
    </g>
  );
}
