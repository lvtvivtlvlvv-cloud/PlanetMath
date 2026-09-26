$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$dbPath = [System.IO.Path]::Combine($PSScriptRoot, "prisma", "dev.db").Replace("\", "/")
$files = [ordered]@{}

$files[".env"] = @"
DATABASE_URL="file:$dbPath"
JWT_SECRET="school-portal-super-secret-key-prod-2026"
CRON_SECRET="cron-secret-key-prod-2026"
"@

$files["package.json"] = @'
{
  "name": "school-diary",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "5.19.0",
    "bcryptjs": "^2.4.3",
    "clsx": "^2.1.1",
    "date-fns": "^3.6.0",
    "jose": "^5.9.0",
    "lucide-react": "^0.441.0",
    "next": "14.2.13",
    "next-themes": "^0.3.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwind-merge": "^2.5.2"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^20.16.5",
    "@types/react": "^18.3.8",
    "@types/react-dom": "^18.3.0",
    "postcss": "^8.4.47",
    "prisma": "5.19.0",
    "tailwindcss": "^3.4.11",
    "ts-node": "^10.9.2",
    "typescript": "^5.6.2"
  }
}
'@

$files["tsconfig.json"] = @'
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
'@

$files["next.config.mjs"] = @'
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
};
export default nextConfig;
'@

$files["tailwind.config.ts"] = @'
import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: "class",
  content: ["./components/**/*.{js,ts,jsx,tsx,mdx}", "./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: {} },
  plugins: [],
};
export default config;
'@

$files["postcss.config.mjs"] = @'
export default {
  plugins: {
    tailwindcss: {},
  },
};
'@

$files["prisma/schema.prisma"] = @'
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id                    String               @id @default(cuid())
  login                 String               @unique
  passwordHash          String
  role                  String               @default("STUDENT")
  fullName              String
  classId               String?
  plainPasswordForAdmin String?
  classGroup            ClassGroup?          @relation(fields: [classId], references: [id], onDelete: SetNull)
  submissions           HomeworkSubmission[]
  createdAt             DateTime             @default(now())

  @@index([login])
  @@index([classId])
}

model ClassGroup {
  id            String         @id @default(cuid())
  grade         Int
  letter        String
  name          String         @unique
  students      User[]
  scheduleItems ScheduleItem[]
  homeworks     Homework[]
}

model ScheduleItem {
  id           String     @id @default(cuid())
  classId      String
  dayOfWeek    Int
  lessonNumber Int
  startTime    String
  endTime      String
  subjectName  String
  room         String
  teacherName  String
  classGroup   ClassGroup @relation(fields: [classId], references: [id], onDelete: Cascade)

  @@index([classId, dayOfWeek])
}

model Homework {
  id          String               @id @default(cuid())
  classId     String
  subjectName String
  targetDate  DateTime
  title       String
  description String
  createdAt   DateTime             @default(now())
  classGroup  ClassGroup           @relation(fields: [classId], references: [id], onDelete: Cascade)
  attachments Attachment[]
  submissions HomeworkSubmission[]

  @@index([classId, targetDate])
}

model HomeworkSubmission {
  id             String       @id @default(cuid())
  homeworkId     String
  studentId      String
  content        String
  submittedAt    DateTime     @default(now())
  status         String       @default("PENDING")
  grade          Int?
  teacherComment String?
  gradedAt       DateTime?
  homework       Homework     @relation(fields: [homeworkId], references: [id], onDelete: Cascade)
  student        User         @relation(fields: [studentId], references: [id], onDelete: Cascade)
  attachments    Attachment[]

  @@unique([homeworkId, studentId])
  @@index([studentId])
  @@index([homeworkId])
}

model Attachment {
  id           String              @id @default(cuid())
  fileName     String
  fileUrl      String
  fileType     String
  fileSize     Int
  createdAt    DateTime            @default(now())
  expiresAt    DateTime
  homeworkId   String?
  submissionId String?
  homework     Homework?           @relation(fields: [homeworkId], references: [id], onDelete: Cascade)
  submission   HomeworkSubmission? @relation(fields: [submissionId], references: [id], onDelete: Cascade)

  @@index([expiresAt])
}
'@

$files["prisma/seed.ts"] = @'
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.attachment.deleteMany();
  await prisma.homeworkSubmission.deleteMany();
  await prisma.homework.deleteMany();
  await prisma.scheduleItem.deleteMany();
  await prisma.user.deleteMany();
  await prisma.classGroup.deleteMany();

  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  await prisma.user.create({
    data: {
      login: "admin",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      fullName: "Главный Администратор",
    },
  });

  const class6A = await prisma.classGroup.create({
    data: { grade: 6, letter: "А", name: "6А" },
  });

  await prisma.classGroup.create({
    data: { grade: 9, letter: "Б", name: "9Б" },
  });

  const studentPasswordHash = await bcrypt.hash("student123", 10);
  const student = await prisma.user.create({
    data: {
      login: "saa06a123",
      passwordHash: studentPasswordHash,
      role: "STUDENT",
      fullName: "Савченко Андрей Алексеевич",
      classId: class6A.id,
      plainPasswordForAdmin: "student123",
    },
  });

  const subjects = ["Математика", "Русский язык", "Литература", "История", "Физика"];
  for (let day = 1; day <= 6; day++) {
    for (let lesson = 1; lesson <= 4; lesson++) {
      await prisma.scheduleItem.create({
        data: {
          classId: class6A.id,
          dayOfWeek: day,
          lessonNumber: lesson,
          startTime: `${7 + lesson}:30`,
          endTime: `${8 + lesson}:15`,
          subjectName: subjects[(day + lesson) % subjects.length],
          room: `${100 + lesson}`,
          teacherName: "Иванова Е. В.",
        },
      });
    }
  }

  const hw = await prisma.homework.create({
    data: {
      classId: class6A.id,
      subjectName: "Математика",
      targetDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      title: "Параграф 14, № 240-245",
      description: "Решить уравнения и построить график функции в тетради.",
    },
  });

  await prisma.homeworkSubmission.create({
    data: {
      homeworkId: hw.id,
      studentId: student.id,
      content: "Решение на страницах тетради, номер 245 проверил через дискриминант.",
      status: "PENDING",
    },
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
'@

$files["lib/db.ts"] = @'
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
'@

$files["lib/auth-utils.ts"] = @'
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "school-portal-super-secret-key-prod-2026"
);

export interface TokenPayload {
  userId: string;
  login: string;
  role: "ADMIN" | "STUDENT";
  fullName: string;
  classId?: string | null;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSessionToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function transliterateChar(char: string): string {
  const lower = char.toLowerCase();
  return CYRILLIC_TO_LATIN[lower] ?? (/[a-z0-9]/.test(lower) ? lower : "x");
}

export function generateStudentCredentials(fullName: string, grade: number, letter: string) {
  const parts = fullName.trim().split(/\s+/);
  const surname = parts[0] || "User";
  const name = parts[1] || "";
  const patronymic = parts[2] || "";

  let initials = "";
  if (patronymic) {
    initials =
      transliterateChar(surname[0] || "u") +
      transliterateChar(name[0] || "x") +
      transliterateChar(patronymic[0] || "x");
  } else {
    initials =
      transliterateChar(surname[0] || "u") +
      transliterateChar(surname[1] || "x") +
      transliterateChar(name[0] || "x");
  }

  const paddedGrade = grade < 10 ? `0${grade}` : `${grade}`;
  const translitLetter = transliterateChar(letter[0] || "a");
  const randomSuffix = Math.floor(100 + Math.random() * 900).toString();
  const login = `${initials}${paddedGrade}${translitLetter}${randomSuffix}`.toLowerCase();

  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(8);
  let password = "";
  for (let i = 0; i < 8; i++) {
    password += charset[bytes[i] % charset.length];
  }

  return { login, password };
}
'@

$files["lib/cleanup-files.ts"] = @'
import fs from "fs/promises";
import path from "path";
import { db } from "./db";

export async function cleanupExpiredFiles(): Promise<{ deletedCount: number; errors: string[] }> {
  const now = new Date();
  const errors: string[] = [];

  const expiredRecords = await db.attachment.findMany({
    where: { expiresAt: { lte: now } },
  });

  if (expiredRecords.length === 0) {
    return { deletedCount: 0, errors: [] };
  }

  const publicDir = path.join(process.cwd(), "public");

  for (const item of expiredRecords) {
    try {
      const sanitizedUrl = item.fileUrl.replace(/^\/+/, "");
      const absolutePath = path.join(publicDir, sanitizedUrl);
      await fs.unlink(absolutePath).catch((err: NodeJS.ErrnoException) => {
        if (err.code !== "ENOENT") throw err;
      });
    } catch (e: unknown) {
      errors.push(`FS error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const deleteResult = await db.attachment.deleteMany({
    where: { id: { in: expiredRecords.map((r) => r.id) } },
  });

  return { deletedCount: deleteResult.count, errors };
}
'@

$files["instrumentation.ts"] = @'
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { cleanupExpiredFiles } = await import("./lib/cleanup-files");
    const DAY_MS = 24 * 60 * 60 * 1000;
    setInterval(async () => {
      try {
        await cleanupExpiredFiles();
      } catch (err) {
        console.error("Cron error:", err);
      }
    }, DAY_MS);
  }
}
'@

$files["middleware.ts"] = @'
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "school-portal-super-secret-key-prod-2026"
);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("session_token")?.value;

  const isAuthPage = pathname.startsWith("/login");
  const isAdminPage = pathname.startsWith("/admin");
  const isStudentPage = pathname.startsWith("/student");

  if (!token) {
    if (isAdminPage || isStudentPage) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const role = payload.role as string;

    if (isAuthPage) {
      return NextResponse.redirect(
        new URL(role === "ADMIN" ? "/admin" : "/student", req.url)
      );
    }
    if (isAdminPage && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/student", req.url));
    }
    if (isStudentPage && role !== "STUDENT") {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete("session_token");
    return res;
  }
}

export const config = {
  matcher: ["/admin/:path*", "/student/:path*", "/login"],
};
'@

$files["components/theme-provider.tsx"] = @'
"use client";
import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
'@

$files["components/theme-toggle.tsx"] = @'
"use client";
import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-9 w-9" />;

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      aria-label="Toggle Theme"
    >
      {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
'@

$files["components/attachment-badge.tsx"] = @'
import React from "react";
import { FileText, AlertTriangle, ExternalLink } from "lucide-react";

interface AttachmentItem {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  expiresAt: string | Date;
}

export function AttachmentBadge({ file }: { file: AttachmentItem }) {
  const isExpired = new Date(file.expiresAt).getTime() <= Date.now();

  if (isExpired) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Файл удален по истечении срока хранения (3 недели)</span>
      </div>
    );
  }

  const isImage = file.fileType.startsWith("image/");

  return (
    <a
      href={file.fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <FileText className="h-4 w-4 text-zinc-500" />
      <span className="max-w-[180px] truncate text-zinc-700 group-hover:underline dark:text-zinc-300">
        {file.fileName}
      </span>
      {isImage && (
        <span className="rounded bg-zinc-200 px-1 py-0.5 text-[9px] dark:bg-zinc-800">
          IMG
        </span>
      )}
      <ExternalLink className="h-3 w-3 text-zinc-400" />
    </a>
  );
}
'@

$files["components/schedule-view.tsx"] = @'
"use client";
import React, { useState } from "react";

export interface ScheduleItemData {
  id: string;
  dayOfWeek: number;
  lessonNumber: number;
  startTime: string;
  endTime: string;
  subjectName: string;
  room: string;
  teacherName: string;
}

const DAYS = [
  { id: 1, short: "Пн", full: "Понедельник" },
  { id: 2, short: "Вт", full: "Вторник" },
  { id: 3, short: "Ср", full: "Среда" },
  { id: 4, short: "Чт", full: "Четверг" },
  { id: 5, short: "Пт", full: "Пятница" },
  { id: 6, short: "Сб", full: "Суббота" },
];

export function ScheduleView({ items }: { items: ScheduleItemData[] }) {
  const [activeDay, setActiveDay] = useState<number>(1);
  const filterByDay = (day: number) =>
    items.filter((i) => i.dayOfWeek === day).sort((a, b) => a.lessonNumber - b.lessonNumber);

  return (
    <div className="w-full">
      <div className="md:hidden">
        <div className="flex space-x-1 border-b border-zinc-200 pb-2 dark:border-zinc-800">
          {DAYS.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveDay(d.id)}
              className={`flex-1 rounded-md py-2 text-center text-sm font-medium transition ${
                activeDay === d.id
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {d.short}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {filterByDay(activeDay).length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">Занятий нет</p>
          ) : (
            filterByDay(activeDay).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center space-x-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold dark:bg-zinc-800">
                    {item.lessonNumber}
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold">{item.subjectName}</h4>
                    <p className="text-xs text-zinc-500">
                      Каб. {item.room} • {item.teacherName}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-zinc-400">{item.startTime}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-6 gap-3">
        {DAYS.map((day) => {
          const dayItems = filterByDay(day.id);
          return (
            <div
              key={day.id}
              className="flex flex-col rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <h3 className="border-b border-zinc-100 pb-2 text-sm font-bold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                {day.full}
              </h3>
              <div className="mt-2 flex-1 space-y-2">
                {dayItems.length === 0 ? (
                  <span className="block text-xs text-zinc-400">Нет уроков</span>
                ) : (
                  dayItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded border border-zinc-100 bg-zinc-50 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <div className="flex justify-between font-medium">
                        <span>{item.lessonNumber}. {item.subjectName}</span>
                        <span className="text-[10px] text-zinc-400">{item.startTime}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500">Каб. {item.room}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
'@

$files["components/grading-modal.tsx"] = @'
"use client";
import React, { useEffect, useState, useTransition } from "react";
import { X, Check } from "lucide-react";
import { AttachmentBadge } from "./attachment-badge";

export interface SubmissionModalData {
  id: string;
  studentName: string;
  content: string;
  submittedAt: string | Date;
  attachments: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
    expiresAt: string | Date;
  }>;
  grade: number | null;
  teacherComment: string | null;
}

export function GradingModal({
  isOpen,
  onClose,
  submission,
  onSaveGrade,
}: {
  isOpen: boolean;
  onClose: () => void;
  submission: SubmissionModalData | null;
  onSaveGrade: (submissionId: string, grade: number, comment?: string) => Promise<void>;
}) {
  const [selectedGrade, setSelectedGrade] = useState<number | null>(submission?.grade ?? null);
  const [comment, setComment] = useState<string>(submission?.teacherComment ?? "");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (submission) {
      setSelectedGrade(submission.grade ?? null);
      setComment(submission.teacherComment ?? "");
    }
  }, [submission]);

  const executeSave = () => {
    if (!submission || selectedGrade === null || isPending) return;
    startTransition(async () => {
      await onSaveGrade(submission.id, selectedGrade, comment.trim() || undefined);
      onClose();
    });
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        executeSave();
        return;
      }
      if (e.key === "Enter" && !isInput) {
        e.preventDefault();
        executeSave();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (!isInput && ["1", "2", "3", "4", "5"].includes(e.key)) {
        e.preventDefault();
        setSelectedGrade(parseInt(e.key, 10));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedGrade, comment, isPending, submission]);

  if (!isOpen || !submission) return null;

  const grades = [
    { value: 5, active: "bg-emerald-600 text-white" },
    { value: 4, active: "bg-blue-600 text-white" },
    { value: 3, active: "bg-amber-500 text-white" },
    { value: 2, active: "bg-rose-600 text-white" },
    { value: 1, active: "bg-rose-800 text-white" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Проверка работы: {submission.studentName}
            </h2>
            <p className="text-xs text-zinc-500">
              Сдано: {new Date(submission.submittedAt).toLocaleString("ru-RU")}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Текст решения:</span>
            <div className="mt-1 rounded-lg border border-zinc-100 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
              {submission.content || "Без текстового пояснения"}
            </div>
          </div>

          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Материалы ({submission.attachments.length}):</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {submission.attachments.length === 0 ? (
                <span className="text-sm text-zinc-500">Файлы не прикреплены</span>
              ) : (
                submission.attachments.map((file) => <AttachmentBadge file={file} key={file.id} />)
              )}
            </div>
          </div>

          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Оценка:</span>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {grades.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setSelectedGrade(g.value)}
                  className={`flex h-12 flex-col items-center justify-center rounded-lg border text-base font-semibold transition ${
                    selectedGrade === g.value
                      ? g.active
                      : "border-zinc-300 bg-zinc-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  <span>{g.value}</span>
                  <kbd className="mt-0.5 rounded border border-black/20 bg-black/10 px-1.5 text-[10px] leading-tight dark:border-white/20 dark:bg-white/10">
                    {g.value}
                  </kbd>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">Комментарий учителя (опционально):</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Замечания..."
              rows={3}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <span className="text-xs text-zinc-500">
            <kbd className="rounded border px-1">1..5</kbd> — оценка, <kbd className="rounded border px-1">Ctrl+↵</kbd> — сохранить
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
              Отмена
            </button>
            <button
              type="button"
              onClick={executeSave}
              disabled={selectedGrade === null || isPending}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              <Check className="h-4 w-4" />
              <span>{isPending ? "Сохранение..." : "Выставить"}</span>
              <kbd className="ml-1 rounded border border-white/20 bg-white/10 px-1 text-[10px]">Enter</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
'@

$files["components/admin-dashboard.tsx"] = @'
"use client";
import React, { useState } from "react";
import { GradingModal, SubmissionModalData } from "./grading-modal";
import {
  gradeSubmissionAction,
  createStudentAction,
  createHomeworkAction,
  saveScheduleBatchAction,
  logoutAction,
  EditableScheduleRow,
} from "@/app/admin/actions";
import { ThemeToggle } from "./theme-toggle";
import {
  LogOut,
  UserPlus,
  BookOpen,
  Trash2,
  CheckCircle,
  Calendar,
  Table as TableIcon,
  Plus,
  Save,
  Paperclip,
  X,
} from "lucide-react";

const DAYS_MAP: Record<number, string> = { 1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт", 6: "Сб" };

export function AdminDashboard({
  classes,
  scheduleItems,
  submissions,
}: {
  classes: { id: string; name: string }[];
  scheduleItems: Array<EditableScheduleRow & { id: string }>;
  submissions: Array<{
    id: string;
    studentName: string;
    subjectName: string;
    homeworkTitle: string;
    content: string;
    submittedAt: string | Date;
    status: string;
    grade: number | null;
    teacherComment: string | null;
    attachments: Array<{
      id: string;
      fileName: string;
      fileUrl: string;
      fileType: string;
      expiresAt: string | Date;
    }>;
  }>;
}) {
  const [activeModalData, setActiveModalData] = useState<SubmissionModalData | null>(null);
  const [createdStudent, setCreatedStudent] = useState<{ login: string; password: string } | null>(null);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || "");
  const [scheduleMode, setScheduleMode] = useState<"calendar" | "excel">("excel");
  const [editableRows, setEditableRows] = useState<EditableScheduleRow[]>(
    scheduleItems.filter((i) => i.classId === (classes[0]?.id || ""))
  );
  const [scheduleSavedMsg, setScheduleSavedMsg] = useState(false);

  const [hwFiles, setHwFiles] = useState<File[]>([]);
  const [hwLoading, setHwLoading] = useState(false);

  const handleClassChange = (newClassId: string) => {
    setSelectedClassId(newClassId);
    setEditableRows(scheduleItems.filter((i) => i.classId === newClassId));
    setScheduleSavedMsg(false);
  };

  const addScheduleRow = () => {
    setEditableRows([
      ...editableRows,
      {
        classId: selectedClassId,
        dayOfWeek: 1,
        lessonNumber: (editableRows.length % 7) + 1,
        startTime: "08:30",
        endTime: "09:15",
        subjectName: "",
        room: "",
        teacherName: "",
      },
    ]);
  };

  const updateScheduleRow = (idx: number, field: keyof EditableScheduleRow, val: any) => {
    const updated = [...editableRows];
    updated[idx] = { ...updated[idx], [field]: val };
    setEditableRows(updated);
  };

  const removeScheduleRow = (idx: number) => {
    setEditableRows(editableRows.filter((_, i) => i !== idx));
  };

  const handleSaveSchedule = async () => {
    await saveScheduleBatchAction(selectedClassId, editableRows);
    setScheduleSavedMsg(true);
    setTimeout(() => setScheduleSavedMsg(false), 3000);
  };

  const handleCreateHw = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setHwLoading(true);
    try {
      const fd = new FormData(e.currentTarget);
      let attachments: any[] = [];

      if (hwFiles.length > 0) {
        const uploadFd = new FormData();
        hwFiles.forEach((f) => uploadFd.append("files", f));
        const res = await fetch("/api/upload", { method: "POST", body: uploadFd });
        const data = await res.json();
        if (data.files) attachments = data.files;
      }

      await createHomeworkAction({
        classId: fd.get("classId") as string,
        subjectName: fd.get("subjectName") as string,
        targetDate: fd.get("targetDate") as string,
        title: fd.get("title") as string,
        description: fd.get("description") as string,
        attachments,
      });

      (e.target as HTMLFormElement).reset();
      setHwFiles([]);
      alert("ДЗ успешно создано!");
    } finally {
      setHwLoading(false);
    }
  };

  const handleManualCleanup = async () => {
    const res = await fetch("/api/cron/cleanup");
    const json = await res.json();
    setCleanupMessage(`Удалено устаревших файлов: ${json.deletedCount}`);
  };

  return (
    <div className="min-h-screen space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold">Панель Учителя</h1>
          <p className="text-xs text-zinc-500">Управление расписанием и журнал сдачи работ</p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
            >
              <LogOut className="h-4 w-4" />
              <span>Выйти</span>
            </button>
          </form>
        </div>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold">Расписание занятий</h2>
            <select
              value={selectedClassId}
              onChange={(e) => handleClassChange(e.target.value)}
              className="h-9 rounded-md border border-zinc-300 px-3 text-sm font-semibold dark:border-zinc-700 dark:bg-zinc-950"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>Класс: {c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setScheduleMode(scheduleMode === "excel" ? "calendar" : "excel")}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {scheduleMode === "excel" ? (
                <><Calendar className="h-4 w-4" /><span>Вид календаря</span></>
              ) : (
                <><TableIcon className="h-4 w-4" /><span>Excel-таблица</span></>
              )}
            </button>

            {scheduleMode === "excel" && (
              <>
                <button
                  type="button"
                  onClick={addScheduleRow}
                  className="flex items-center gap-1 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                >
                  <Plus className="h-3.5 w-3.5" /><span>Строка</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveSchedule}
                  className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <Save className="h-3.5 w-3.5" /><span>Сохранить расписание</span>
                </button>
              </>
            )}
          </div>
        </div>

        {scheduleSavedMsg && (
          <p className="mt-2 text-xs font-semibold text-emerald-600">✓ Расписание успешно сохранено в БД</p>
        )}

        {scheduleMode === "excel" ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse border border-zinc-200 text-left text-xs dark:border-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-950 font-semibold text-zinc-600 dark:text-zinc-400">
                <tr>
                  <th className="border border-zinc-200 p-2 dark:border-zinc-800 w-16">День</th>
                  <th className="border border-zinc-200 p-2 dark:border-zinc-800 w-14">№ Урока</th>
                  <th className="border border-zinc-200 p-2 dark:border-zinc-800 w-28">Время</th>
                  <th className="border border-zinc-200 p-2 dark:border-zinc-800">Предмет</th>
                  <th className="border border-zinc-200 p-2 dark:border-zinc-800 w-24">Кабинет</th>
                  <th className="border border-zinc-200 p-2 dark:border-zinc-800">ФИО Учителя</th>
                  <th className="border border-zinc-200 p-2 dark:border-zinc-800 w-10 text-center">X</th>
                </tr>
              </thead>
              <tbody>
                {editableRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-zinc-400">
                      Расписание пусто. Нажмите «Строка» для добавления предмета.
                    </td>
                  </tr>
                ) : (
                  editableRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-950/40">
                      <td className="border border-zinc-200 p-1 dark:border-zinc-800">
                        <select
                          value={row.dayOfWeek}
                          onChange={(e) => updateScheduleRow(idx, "dayOfWeek", Number(e.target.value))}
                          className="w-full bg-transparent p-1 font-bold"
                        >
                          <option value={1}>Пн</option><option value={2}>Вт</option><option value={3}>Ср</option>
                          <option value={4}>Чт</option><option value={5}>Пт</option><option value={6}>Сб</option>
                        </select>
                      </td>
                      <td className="border border-zinc-200 p-1 dark:border-zinc-800">
                        <input
                          type="number"
                          min={1}
                          max={8}
                          value={row.lessonNumber}
                          onChange={(e) => updateScheduleRow(idx, "lessonNumber", Number(e.target.value))}
                          className="w-full bg-transparent p-1 font-mono text-center"
                        />
                      </td>
                      <td className="border border-zinc-200 p-1 dark:border-zinc-800">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={row.startTime}
                            onChange={(e) => updateScheduleRow(idx, "startTime", e.target.value)}
                            className="w-12 bg-transparent p-0.5 text-center"
                          />
                          <span>-</span>
                          <input
                            type="text"
                            value={row.endTime}
                            onChange={(e) => updateScheduleRow(idx, "endTime", e.target.value)}
                            className="w-12 bg-transparent p-0.5 text-center"
                          />
                        </div>
                      </td>
                      <td className="border border-zinc-200 p-1 dark:border-zinc-800">
                        <input
                          type="text"
                          placeholder="Алгебра"
                          value={row.subjectName}
                          onChange={(e) => updateScheduleRow(idx, "subjectName", e.target.value)}
                          className="w-full bg-transparent p-1 font-medium"
                        />
                      </td>
                      <td className="border border-zinc-200 p-1 dark:border-zinc-800">
                        <input
                          type="text"
                          placeholder="Каб. 204"
                          value={row.room}
                          onChange={(e) => updateScheduleRow(idx, "room", e.target.value)}
                          className="w-full bg-transparent p-1 text-center"
                        />
                      </td>
                      <td className="border border-zinc-200 p-1 dark:border-zinc-800">
                        <input
                          type="text"
                          placeholder="Иванова А. С."
                          value={row.teacherName}
                          onChange={(e) => updateScheduleRow(idx, "teacherName", e.target.value)}
                          className="w-full bg-transparent p-1"
                        />
                      </td>
                      <td className="border border-zinc-200 p-1 text-center dark:border-zinc-800">
                        <button
                          type="button"
                          onClick={() => removeScheduleRow(idx)}
                          className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((dayNum) => {
              const dayLessons = editableRows
                .filter((r) => Number(r.dayOfWeek) === dayNum)
                .sort((a, b) => a.lessonNumber - b.lessonNumber);

              return (
                <div key={dayNum} className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <h4 className="border-b border-zinc-200 pb-1 text-sm font-bold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                    {DAYS_MAP[dayNum]}
                  </h4>
                  <div className="mt-2 space-y-2">
                    {dayLessons.length === 0 ? (
                      <span className="text-[11px] text-zinc-400">Нет уроков</span>
                    ) : (
                      dayLessons.map((l, i) => (
                        <div key={i} className="rounded border border-zinc-200 bg-white p-2 text-xs dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="font-semibold">{l.lessonNumber}. {l.subjectName}</div>
                          <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
                            <span>Каб. {l.room}</span><span>{l.startTime}</span>
                          </div>
                          <div className="mt-0.5 truncate text-[10px] text-zinc-400">{l.teacherName}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 font-semibold">
            <UserPlus className="h-5 w-5" />
            <h2>Регистрация ученика</h2>
          </div>
          <form
            action={async (fd) => {
              const res = await createStudentAction(fd);
              if (res.success) setCreatedStudent({ login: res.login, password: res.password });
            }}
            className="mt-4 space-y-3"
          >
            <div>
              <label className="text-xs font-medium text-zinc-500">ФИО Ученика</label>
              <input
                name="fullName"
                required
                placeholder="Иванов Петр Сергеевич"
                className="mt-1 h-9 w-full rounded-md border border-zinc-200 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-zinc-500">Класс (1-11)</label>
                <input
                  name="grade"
                  type="number"
                  min="1"
                  max="11"
                  required
                  placeholder="6"
                  className="mt-1 h-9 w-full rounded-md border border-zinc-200 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Буква (А-Я)</label>
                <input
                  name="letter"
                  required
                  maxLength={1}
                  placeholder="А"
                  className="mt-1 h-9 w-full rounded-md border border-zinc-200 px-3 text-sm uppercase dark:border-zinc-700 dark:bg-zinc-950"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Сгенерировать учетную запись
            </button>
          </form>

          {createdStudent && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
              <p className="font-semibold">Учетная запись создана:</p>
              <p>Логин: <code className="font-mono font-bold">{createdStudent.login}</code></p>
              <p>Пароль: <code className="font-mono font-bold">{createdStudent.password}</code></p>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 font-semibold">
            <BookOpen className="h-5 w-5" />
            <h2>Выдать домашнее задание с файлами</h2>
          </div>
          <form onSubmit={handleCreateHw} className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-zinc-500">Класс</label>
              <select
                name="classId"
                required
                className="mt-1 h-9 w-full rounded-md border border-zinc-200 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-zinc-500">Предмет</label>
                <input
                  name="subjectName"
                  required
                  placeholder="Алгебра"
                  className="mt-1 h-9 w-full rounded-md border border-zinc-200 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Дата сдачи</label>
                <input
                  name="targetDate"
                  type="date"
                  required
                  className="mt-1 h-9 w-full rounded-md border border-zinc-200 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500">Тема задания</label>
              <input
                name="title"
                required
                placeholder="Параграф 5, упражнение 12"
                className="mt-1 h-9 w-full rounded-md border border-zinc-200 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500">Инструкция</label>
              <textarea
                name="description"
                rows={2}
                placeholder="Подробности решения..."
                className="mt-1 w-full rounded-md border border-zinc-200 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-500">Прикрепить файлы (Фото/PDF)</label>
              <div className="mt-1 flex items-center gap-2">
                <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                  <Paperclip className="h-4 w-4" />
                  <span>Выбрать файлы</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      if (e.target.files) setHwFiles(Array.from(e.target.files));
                    }}
                    className="hidden"
                  />
                </label>
                {hwFiles.length > 0 && <span className="text-xs text-zinc-500">Выбрано: {hwFiles.length}</span>}
              </div>
              {hwFiles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {hwFiles.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 text-[11px] dark:bg-zinc-800">
                      {f.name}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setHwFiles(hwFiles.filter((_, idx) => idx !== i))} />
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={hwLoading}
              className="w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {hwLoading ? "Загрузка и отправка..." : "Опубликовать ДЗ"}
            </button>
          </form>
        </section>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle className="h-5 w-5" />
            <h2>Сданные работы на проверку</h2>
          </div>
          <button
            onClick={handleManualCleanup}
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Очистить старые файлы (&gt; 21 дн.)</span>
          </button>
        </div>

        {cleanupMessage && <p className="mt-2 text-xs text-amber-600">{cleanupMessage}</p>}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-400 dark:border-zinc-800">
              <tr>
                <th className="py-2">Ученик</th>
                <th className="py-2">Предмет / Задание</th>
                <th className="py-2">Дата сдачи</th>
                <th className="py-2">Статус / Оценка</th>
                <th className="py-2 text-right">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {submissions.map((sub) => (
                <tr key={sub.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="py-3 font-medium">{sub.studentName}</td>
                  <td className="py-3">
                    <span className="font-semibold">{sub.subjectName}</span>
                    <span className="block text-xs text-zinc-500">{sub.homeworkTitle}</span>
                  </td>
                  <td className="py-3 text-xs text-zinc-500">
                    {new Date(sub.submittedAt).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="py-3">
                    {sub.grade ? (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {sub.grade}
                      </span>
                    ) : (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                        Ожидает
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() =>
                        setActiveModalData({
                          id: sub.id,
                          studentName: sub.studentName,
                          content: sub.content,
                          submittedAt: sub.submittedAt,
                          attachments: sub.attachments,
                          grade: sub.grade,
                          teacherComment: sub.teacherComment,
                        })
                      }
                      className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                    >
                      Проверить [1-5]
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <GradingModal
        isOpen={Boolean(activeModalData)}
        onClose={() => setActiveModalData(null)}
        submission={activeModalData}
        onSaveGrade={async (id, grade, comment) => {
          await gradeSubmissionAction(id, grade, comment);
        }}
      />
    </div>
  );
}
'@

$files["components/student-dashboard.tsx"] = @'
"use client";
import React, { useState } from "react";
import { ScheduleView, ScheduleItemData } from "./schedule-view";
import { AttachmentBadge } from "./attachment-badge";
import { ThemeToggle } from "./theme-toggle";
import { submitHomeworkAction, logoutAction } from "@/app/student/actions";
import { LogOut, Upload, Send, X } from "lucide-react";

export function StudentDashboard({
  user,
  schedule,
  homeworks,
}: {
  user: { fullName: string; className: string; id: string };
  schedule: ScheduleItemData[];
  homeworks: Array<{
    id: string;
    subjectName: string;
    targetDate: string | Date;
    title: string;
    description: string;
    attachments: Array<{
      id: string;
      fileName: string;
      fileUrl: string;
      fileType: string;
      expiresAt: string | Date;
    }>;
    submission?: {
      content: string;
      status: string;
      grade: number | null;
      teacherComment: string | null;
    } | null;
  }>;
}) {
  const [activeTab, setActiveTab] = useState<"schedule" | "homework">("homework");
  const [submittingHwId, setSubmittingHwId] = useState<string | null>(null);
  const [solutionText, setSolutionText] = useState("");
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmitSolution = async (homeworkId: string) => {
    setLoading(true);
    try {
      let uploadedAttachments: any[] = [];
      if (filesToUpload.length > 0) {
        const fd = new FormData();
        filesToUpload.forEach((f) => fd.append("files", f));
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (json.files) uploadedAttachments = json.files;
      }

      await submitHomeworkAction({
        homeworkId,
        studentId: user.id,
        content: solutionText,
        attachments: uploadedAttachments,
      });

      setSubmittingHwId(null);
      setSolutionText("");
      setFilesToUpload([]);
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (g: number) => {
    if (g === 5) return "bg-emerald-600 text-white";
    if (g === 4) return "bg-blue-600 text-white";
    if (g === 3) return "bg-amber-500 text-white";
    return "bg-rose-600 text-white";
  };

  return (
    <div className="min-h-screen space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">{user.fullName}</h1>
          <p className="text-xs text-zinc-500">Ученик класса {user.className}</p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
            >
              <LogOut className="h-4 w-4" />
              <span>Выйти</span>
            </button>
          </form>
        </div>
      </header>

      <div className="flex gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("homework")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "homework"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          Задания и решения
        </button>
        <button
          onClick={() => setActiveTab("schedule")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "schedule"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          Расписание уроков
        </button>
      </div>

      {activeTab === "schedule" ? (
        <ScheduleView items={schedule} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {homeworks.map((hw) => (
            <div
              key={hw.id}
              className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{hw.subjectName}</span>
                    <h3 className="text-base font-bold">{hw.title}</h3>
                  </div>
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    Срок: {new Date(hw.targetDate).toLocaleDateString("ru-RU")}
                  </span>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{hw.description}</p>
                {hw.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {hw.attachments.map((f) => <AttachmentBadge file={f} key={f.id} />)}
                  </div>
                )}
              </div>

              <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                {hw.submission ? (
                  <div className="space-y-2 rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-950">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-500">Статус:</span>
                      {hw.submission.grade ? (
                        <span className={`rounded px-2 py-0.5 font-bold ${getGradeColor(hw.submission.grade)}`}>
                          Оценка: {hw.submission.grade}
                        </span>
                      ) : (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                          На проверке
                        </span>
                      )}
                    </div>
                    {hw.submission.teacherComment && (
                      <p className="border-l-2 border-zinc-300 pl-2 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                        {hw.submission.teacherComment}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    {submittingHwId === hw.id ? (
                      <div className="space-y-3 pt-2">
                        <textarea
                          value={solutionText}
                          onChange={(e) => setSolutionText(e.target.value)}
                          placeholder="Текстовый ответ или комментарий..."
                          rows={2}
                          className="w-full rounded-md border border-zinc-200 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        />
                        <div className="flex items-center gap-2">
                          <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                            <Upload className="h-4 w-4" />
                            <span>Прикрепить фото / PDF</span>
                            <input
                              type="file"
                              multiple
                              accept="image/*,application/pdf"
                              onChange={(e) => {
                                if (e.target.files) setFilesToUpload(Array.from(e.target.files));
                              }}
                              className="hidden"
                            />
                          </label>
                          {filesToUpload.length > 0 && <span className="text-xs text-zinc-500">Выбрано: {filesToUpload.length}</span>}
                        </div>

                        {filesToUpload.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {filesToUpload.map((f, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 text-[11px] dark:bg-zinc-800">
                                {f.name}
                                <X className="h-3 w-3 cursor-pointer" onClick={() => setFilesToUpload(filesToUpload.filter((_, i) => i !== idx))} />
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => { setSubmittingHwId(null); setFilesToUpload([]); }}
                            className="rounded px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            Отмена
                          </button>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleSubmitSolution(hw.id)}
                            className="flex items-center gap-1 rounded bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
                          >
                            <Send className="h-3 w-3" />
                            <span>{loading ? "Загрузка..." : "Сдать"}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSubmittingHwId(hw.id)}
                        className="w-full rounded-lg bg-zinc-900 py-2 text-center text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
                      >
                        Сдать решение
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
'@

$files["app/admin/actions.ts"] = @'
"use server";
import { db } from "@/lib/db";
import { generateStudentCredentials, hashPassword } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function logoutAction() {
  cookies().delete("session_token");
  redirect("/login");
}

export async function createStudentAction(formData: FormData) {
  const fullName = formData.get("fullName") as string;
  const gradeStr = formData.get("grade") as string;
  const letter = (formData.get("letter") as string).trim().toUpperCase();

  const grade = parseInt(gradeStr, 10);
  if (!fullName || isNaN(grade) || grade < 1 || grade > 11 || !letter) {
    throw new Error("Некорректные параметры ученика");
  }

  const className = `${grade}${letter}`;
  let classGroup = await db.classGroup.findUnique({ where: { name: className } });

  if (!classGroup) {
    classGroup = await db.classGroup.create({ data: { grade, letter, name: className } });
  }

  const { login, password } = generateStudentCredentials(fullName, grade, letter);
  const passwordHash = await hashPassword(password);

  await db.user.create({
    data: {
      login,
      passwordHash,
      fullName,
      role: "STUDENT",
      classId: classGroup.id,
      plainPasswordForAdmin: password,
    },
  });

  revalidatePath("/admin");
  return { success: true, login, password };
}

export async function createHomeworkAction(data: {
  classId: string;
  subjectName: string;
  targetDate: string;
  title: string;
  description: string;
  attachments?: { fileName: string; fileUrl: string; fileType: string; fileSize: number; expiresAt: string }[];
}) {
  await db.homework.create({
    data: {
      classId: data.classId,
      subjectName: data.subjectName,
      targetDate: new Date(data.targetDate),
      title: data.title,
      description: data.description,
      attachments: {
        create: data.attachments?.map((a) => ({
          fileName: a.fileName,
          fileUrl: a.fileUrl,
          fileType: a.fileType,
          fileSize: a.fileSize,
          expiresAt: new Date(a.expiresAt),
        })),
      },
    },
  });

  revalidatePath("/admin");
  revalidatePath("/student");
}

export async function gradeSubmissionAction(submissionId: string, grade: number, comment?: string) {
  if (grade < 1 || grade > 5) throw new Error("Оценка 1-5");

  await db.homeworkSubmission.update({
    where: { id: submissionId },
    data: { grade, teacherComment: comment ?? null, status: "GRADED", gradedAt: new Date() },
  });

  revalidatePath("/admin");
  revalidatePath("/student");
}

export interface EditableScheduleRow {
  id?: string;
  classId: string;
  dayOfWeek: number;
  lessonNumber: number;
  startTime: string;
  endTime: string;
  subjectName: string;
  room: string;
  teacherName: string;
}

export async function saveScheduleBatchAction(classId: string, rows: EditableScheduleRow[]) {
  await db.$transaction(async (tx) => {
    await tx.scheduleItem.deleteMany({ where: { classId } });
    if (rows.length > 0) {
      await tx.scheduleItem.createMany({
        data: rows.map((r) => ({
          classId,
          dayOfWeek: Number(r.dayOfWeek),
          lessonNumber: Number(r.lessonNumber),
          startTime: r.startTime.trim() || "08:30",
          endTime: r.endTime.trim() || "09:15",
          subjectName: r.subjectName.trim() || "Предмет",
          room: r.room.trim() || "101",
          teacherName: r.teacherName.trim() || "Учитель",
        })),
      });
    }
  });

  revalidatePath("/admin");
  revalidatePath("/student");
  return { success: true };
}
'@

$files["app/student/actions.ts"] = @'
"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function logoutAction() {
  cookies().delete("session_token");
  redirect("/login");
}

export async function submitHomeworkAction(data: {
  homeworkId: string;
  studentId: string;
  content: string;
  attachments?: { fileName: string; fileUrl: string; fileType: string; fileSize: number; expiresAt: string }[];
}) {
  await db.homeworkSubmission.upsert({
    where: {
      homeworkId_studentId: { homeworkId: data.homeworkId, studentId: data.studentId },
    },
    create: {
      homeworkId: data.homeworkId,
      studentId: data.studentId,
      content: data.content,
      attachments: {
        create: data.attachments?.map((a) => ({
          fileName: a.fileName,
          fileUrl: a.fileUrl,
          fileType: a.fileType,
          fileSize: a.fileSize,
          expiresAt: new Date(a.expiresAt),
        })),
      },
    },
    update: {
      content: data.content,
      submittedAt: new Date(),
      status: "PENDING",
      attachments: {
        create: data.attachments?.map((a) => ({
          fileName: a.fileName,
          fileUrl: a.fileUrl,
          fileType: a.fileType,
          fileSize: a.fileSize,
          expiresAt: new Date(a.expiresAt),
        })),
      },
    },
  });

  revalidatePath("/student");
  revalidatePath("/admin");
}
'@

$files["app/globals.css"] = @'
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  overflow-x: hidden;
}
'@

$files["app/layout.tsx"] = @'
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "Электронный Дневник",
  description: "Школьный электронный журнал и дневник",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen overflow-x-hidden bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-50`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
'@

$files["app/page.tsx"] = @'
import { redirect } from "next/navigation";
export default function RootPage() {
  redirect("/login");
}
'@

$files["app/login/page.tsx"] = @'
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSessionToken, verifyPassword } from "@/lib/auth-utils";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  async function handleLogin(formData: FormData) {
    "use server";
    const login = (formData.get("login") as string)?.trim();
    const password = (formData.get("password") as string)?.trim();

    if (!login || !password) redirect("/login?error=empty");

    const user = await db.user.findUnique({ where: { login } });
    if (!user) redirect("/login?error=invalid");

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) redirect("/login?error=invalid");

    const token = await createSessionToken({
      userId: user.id,
      login: user.login,
      role: user.role as "ADMIN" | "STUDENT",
      fullName: user.fullName,
      classId: user.classId,
    });

    cookies().set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    redirect(user.role === "ADMIN" ? "/admin" : "/student");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-bold tracking-tight">Электронный Дневник</h1>
        <p className="mt-1 text-xs text-zinc-500">Авторизация в системе</p>

        {searchParams.error && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950">
            Неверный логин или пароль
          </div>
        )}

        <form action={handleLogin} className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Логин</label>
            <input
              name="login"
              type="text"
              required
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Пароль</label>
            <input
              name="password"
              type="password"
              required
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <button
            type="submit"
            className="h-10 w-full rounded-md bg-zinc-900 font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Войти
          </button>
        </form>
      </div>
    </main>
  );
}
'@

$files["app/admin/page.tsx"] = @'
import { db } from "@/lib/db";
import { AdminDashboard } from "@/components/admin-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const classes = await db.classGroup.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const rawSchedule = await db.scheduleItem.findMany({
    orderBy: [{ dayOfWeek: "asc" }, { lessonNumber: "asc" }],
  });

  const rawSubmissions = await db.homeworkSubmission.findMany({
    include: {
      student: { select: { fullName: true } },
      homework: { select: { title: true, subjectName: true } },
      attachments: true,
    },
    orderBy: { submittedAt: "desc" },
  });

  const submissions = rawSubmissions.map((s) => ({
    id: s.id,
    studentName: s.student.fullName,
    subjectName: s.homework.subjectName,
    homeworkTitle: s.homework.title,
    content: s.content,
    submittedAt: s.submittedAt.toISOString(),
    status: s.status,
    grade: s.grade,
    teacherComment: s.teacherComment,
    attachments: s.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileUrl: a.fileUrl,
      fileType: a.fileType,
      expiresAt: a.expiresAt.toISOString(),
    })),
  }));

  return (
    <AdminDashboard
      classes={classes}
      scheduleItems={rawSchedule}
      submissions={submissions}
    />
  );
}
'@

$files["app/student/page.tsx"] = @'
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { StudentDashboard } from "@/components/student-dashboard";

export const dynamic = "force-dynamic";

export default async function StudentPage() {
  const token = cookies().get("session_token")?.value;
  if (!token) redirect("/login");

  const session = await verifySessionToken(token);
  if (!session || session.role !== "STUDENT" || !session.classId) redirect("/login");

  const userRecord = await db.user.findUnique({
    where: { id: session.userId },
    include: { classGroup: true },
  });

  if (!userRecord || !userRecord.classGroup) redirect("/login");

  const scheduleRaw = await db.scheduleItem.findMany({ where: { classId: session.classId } });
  const homeworksRaw = await db.homework.findMany({
    where: { classId: session.classId },
    include: {
      attachments: true,
      submissions: { where: { studentId: session.userId } },
    },
    orderBy: { targetDate: "asc" },
  });

  const schedule = scheduleRaw.map((s) => ({
    id: s.id,
    dayOfWeek: s.dayOfWeek,
    lessonNumber: s.lessonNumber,
    startTime: s.startTime,
    endTime: s.endTime,
    subjectName: s.subjectName,
    room: s.room,
    teacherName: s.teacherName,
  }));

  const homeworks = homeworksRaw.map((h) => ({
    id: h.id,
    subjectName: h.subjectName,
    targetDate: h.targetDate.toISOString(),
    title: h.title,
    description: h.description,
    attachments: h.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileUrl: a.fileUrl,
      fileType: a.fileType,
      expiresAt: a.expiresAt.toISOString(),
    })),
    submission: h.submissions[0]
      ? {
          content: h.submissions[0].content,
          status: h.submissions[0].status,
          grade: h.submissions[0].grade,
          teacherComment: h.submissions[0].teacherComment,
        }
      : null,
  }));

  return (
    <StudentDashboard
      user={{ id: userRecord.id, fullName: userRecord.fullName, className: userRecord.classGroup.name }}
      schedule={schedule}
      homeworks={homeworks}
    />
  );
}
'@

$files["app/api/upload/route.ts"] = @'
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Файлы не получены" }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
    const savedFiles = [];

    for (const file of files) {
      if (file.size === 0) continue;
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const ext = path.extname(file.name) || ".bin";
      const safeId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
      const physicalFileName = `${safeId}${ext}`;
      const filePath = path.join(uploadDir, physicalFileName);

      await fs.writeFile(filePath, buffer);

      savedFiles.push({
        fileName: file.name,
        fileUrl: `/uploads/${physicalFileName}`,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      });
    }

    return NextResponse.json({ files: savedFiles });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload error" },
      { status: 500 }
    );
  }
}
'@

$files["app/api/cron/cleanup/route.ts"] = @'
import { NextResponse } from "next/server";
import { cleanupExpiredFiles } from "@/lib/cleanup-files";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await cleanupExpiredFiles();
  return NextResponse.json(result);
}
'@

Write-Host "=== 1. Развертывание файлов проекта ===" -ForegroundColor Cyan

foreach ($relPath in $files.Keys) {$full = [System.IO.Path]::Combine($PSScriptRoot,$relPath)
    $dir = [System.IO.Path]::GetDirectoryName($full)
    if (-not [System.IO.Directory]::Exists($dir)) {
        [System.IO.Directory]::CreateDirectory($dir) | Out-Null
    }
    [System.IO.File]::WriteAllText($full,$files[$relPath], [System.Text.UTF8Encoding]::new($false))
    Write-Host " [CREATED] $relPath" -ForegroundColor Green
}

$upDir = [System.IO.Path]::Combine($PSScriptRoot, "public", "uploads")
if (-not [System.IO.Directory]::Exists($upDir)) {
    [System.IO.Directory]::CreateDirectory($upDir) | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $upDir ".gitkeep"), "")
}

Write-Host "`n=== 2. Сборка зависимостей и базы данных ===" -ForegroundColor Cyan

if (-not (Test-Path "node_modules/@prisma/client")) {
    Write-Host "Установка npm пакетов..."
    cmd /c npm install
}

Write-Host "Генерация Prisma Client..."
cmd /c npx --yes prisma@5.19.0 generate

Write-Host "Синхронизация схемы SQLite..."
cmd /c npx --yes prisma@5.19.0 db push

Write-Host "Заполнение начальных данных..."
cmd /c npm run seed

Write-Host "`n=== 3. Запуск сервера Next.js ===" -ForegroundColor Cyan
Write-Host "URL: http://localhost:3000" -ForegroundColor Yellow
Write-Host "Учитель: admin / admin123" -ForegroundColor White
Write-Host "Ученик:  saa06a123 / student123" -ForegroundColor White
cmd /c npm run dev