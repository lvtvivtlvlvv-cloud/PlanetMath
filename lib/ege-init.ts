import fs from "fs";
import path from "path";
import { db as prisma } from "./db";
import { INITIAL_FIPI_TASKS, ParsedEgeTask } from "./ege-constants";
import { parseLocalFipiPdf } from "./ege-parser";
import { cleanBrokenPdfMathText } from "./ege-math-cleaner";

let isInitializing = false;
let hasCleanedExistingTasks = false;

export async function ensureEgeTasksInitialized(): Promise<number> {
  if (isInitializing) {
    return await prisma.egeTask.count();
  }
  try {
    isInitializing = true;
    const count = await prisma.egeTask.count();

    if (count === 0) {
      let tasksToInsert: ParsedEgeTask[] = [];

      // 1. Try pre-parsed JSON first (instant, 500+ real FIPI tasks + answers)
      const jsonPath = path.join(process.cwd(), "data", "ege-tasks.json");
      if (fs.existsSync(jsonPath)) {
        try {
          const rawJson = fs.readFileSync(jsonPath, "utf-8");
          tasksToInsert = JSON.parse(rawJson) as ParsedEgeTask[];
        } catch (err) {
          console.error("Failed to read data/ege-tasks.json:", err);
        }
      }

      // 2. Fallback to runtime PDF parsing
      if (tasksToInsert.length === 0) {
        tasksToInsert = await parseLocalFipiPdf();
      }

      // 3. Fallback to built-in seed tasks
      if (tasksToInsert.length === 0) {
        tasksToInsert = INITIAL_FIPI_TASKS;
      }

      await prisma.egeTask.createMany({
        data: tasksToInsert.map((t) => ({
          taskNumber: t.taskNumber,
          topic: (t.topic || "").toWellFormed(),
          title: (t.title || "").toWellFormed(),
          content: cleanBrokenPdfMathText((t.content || "").toWellFormed()),
          answer: t.answer ? t.answer.toWellFormed() : null,
          solution: t.solution ? t.solution.toWellFormed() : null,
          difficulty: t.difficulty || "BASE",
          source: t.source || "FIPI_PDF",
          pdfPage: t.pdfPage || null,
          taskCode: t.taskCode || null,
        })),
      });
      hasCleanedExistingTasks = true;
      return tasksToInsert.length;
    }

    // Auto-clean and sync content/pdfPage/taskCode for existing tasks in SQLite once per server boot
    if (!hasCleanedExistingTasks) {
      hasCleanedExistingTasks = true;
      const existingTasks = await prisma.egeTask.findMany({
        select: { id: true, title: true, content: true, pdfPage: true, taskCode: true },
      });

      const jsonPath = path.join(process.cwd(), "data", "ege-tasks.json");
      const jsonLookup = new Map<string, { content: string; pdfPage?: number; taskCode?: string }>();
      if (fs.existsSync(jsonPath)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as ParsedEgeTask[];
          for (const item of parsed) {
            if (item.title) {
              jsonLookup.set(item.title.trim(), {
                content: item.content,
                pdfPage: item.pdfPage,
                taskCode: item.taskCode,
              });
            }
          }
        } catch {
          // ignore
        }
      }

      const updates = [];
      for (const t of existingTasks) {
        const matchMeta = jsonLookup.get((t.title || "").trim());
        const cleaned = matchMeta?.content
          ? cleanBrokenPdfMathText(matchMeta.content)
          : cleanBrokenPdfMathText(t.content);
        let nextTaskCode = t.taskCode ?? matchMeta?.taskCode ?? null;
        if (!nextTaskCode && t.title) {
          const m = t.title.match(/Задача\s*(\d{1,2}\.\d+(?:\.\d+)?)/i);
          if (m) nextTaskCode = m[1];
        }
        const nextPdfPage = t.pdfPage ?? matchMeta?.pdfPage ?? null;

        if (cleaned !== t.content || nextPdfPage !== t.pdfPage || nextTaskCode !== t.taskCode) {
          updates.push(
            prisma.egeTask.update({
              where: { id: t.id },
              data: {
                content: cleaned,
                pdfPage: nextPdfPage,
                taskCode: nextTaskCode,
              },
            })
          );
        }
      }

      if (updates.length > 0) {
        for (let i = 0; i < updates.length; i += 50) {
          await prisma.$transaction(updates.slice(i, i + 50));
        }
      }
    }

    return count;
  } catch (e) {
    console.error("Failed to initialize EGE tasks:", e);
    return 0;
  } finally {
    isInitializing = false;
  }
}

export const ensureEgeBankInitialized = ensureEgeTasksInitialized;
