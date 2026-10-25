import fs from "fs";
import path from "path";
import { db } from "./db";
import { INITIAL_FIPI_TASKS, ParsedEgeTask } from "./ege-constants";
import { parseLocalFipiPdf } from "./ege-parser";

/**
 * Ensures that the EgeTask table in SQLite is populated.
 * If empty, automatically imports from local PDF, data/ege-tasks.json, and baseline FIPI tasks.
 */
export async function ensureEgeTasksInitialized(): Promise<number> {
  try {
    const existingCount = await db.egeTask.count();
    const existingWithPage = existingCount > 0 ? await db.egeTask.count({ where: { pdfPage: { not: null } } }) : 0;
    if (existingCount > 0 && existingWithPage > 0) {
      return existingCount;
    }

    console.log("[EGE Init] Требуется инициализация / обогащение банка заданий PDF-страницами...");
    // If existingCount > 0 but no pdfPage, clean old un-paged tasks before re-importing so we have clean data
    if (existingCount > 0 && existingWithPage === 0) {
      console.log("[EGE Init] Обновление задач до нового формата с pdfPage и taskCode...");
      // Check if there are assignments linked
      const itemsCount = await db.egeAssignmentItem.count();
      if (itemsCount === 0) {
        await db.egeTask.deleteMany({});
      }
    }

    const tasksToInsert: ParsedEgeTask[] = [];

    // 1. Парсим локальный PDF в корне напрямую
    try {
      const fromPdf = await parseLocalFipiPdf();
      if (fromPdf.length > 0) {
        console.log(`[EGE Init] Из локального PDF извлечено ${fromPdf.length} заданий с номерами страниц`);
        tasksToInsert.push(...fromPdf);
      }
    } catch (e) {
      console.warn("[EGE Init] Ошибка парсинга локального PDF:", e);
    }

    // 2. Если PDF не дал результатов, проверяем data/ege-tasks.json
    if (tasksToInsert.length < 50) {
      const jsonPath = path.join(process.cwd(), "data", "ege-tasks.json");
      if (fs.existsSync(jsonPath)) {
        try {
          const rawJson = fs.readFileSync(jsonPath, "utf-8");
          const parsed = JSON.parse(rawJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            tasksToInsert.push(...parsed);
          }
        } catch (e) {
          console.warn("[EGE Init] Ошибка чтения ege-tasks.json:", e);
        }
      }
    }

    // 3. Дополняем эталонным банком по всем 19 номерам
    for (const item of INITIAL_FIPI_TASKS) {
      if (!tasksToInsert.some((t) => t.taskNumber === item.taskNumber && t.title === item.title)) {
        tasksToInsert.push(item);
      }
    }

    // 4. Пакетная запись в SQLite
    const uniqueKeys = new Set<string>();
    const sanitizedBatch = [];

    for (const item of tasksToInsert) {
      const key = `${item.taskNumber}_${item.taskCode || item.title.trim().slice(0, 80)}`;
      if (uniqueKeys.has(key)) continue;
      uniqueKeys.add(key);

      sanitizedBatch.push({
        taskNumber: item.taskNumber,
        topic: item.topic || `Задание №${item.taskNumber}`,
        title: item.title,
        content: item.content,
        answer: item.answer || null,
        solution: item.solution || null,
        difficulty: item.difficulty || "BASE",
        source: item.source || "FIPI",
        pdfPage: item.pdfPage ?? null,
        taskCode: item.taskCode ?? null,
      });
    }

    if (sanitizedBatch.length > 0) {
      for (const t of sanitizedBatch) {
        const existing = await db.egeTask.findFirst({
          where: {
            taskNumber: t.taskNumber,
            title: t.title,
          },
        });
        if (existing) {
          await db.egeTask.update({
            where: { id: existing.id },
            data: {
              pdfPage: t.pdfPage,
              taskCode: t.taskCode,
              topic: t.topic,
              content: t.content,
              answer: t.answer,
            },
          });
        } else {
          await db.egeTask.create({ data: t });
        }
      }
      console.log(`[EGE Init] База заданий успешно синхронизирована (всего ${sanitizedBatch.length})`);

      // Сохраняем актуальный снимок в data/ege-tasks.json
      const outDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      const allTasks = await db.egeTask.findMany({ orderBy: [{ taskNumber: "asc" }, { createdAt: "asc" }] });
      fs.writeFileSync(path.join(outDir, "ege-tasks.json"), JSON.stringify(allTasks, null, 2), "utf-8");
    }

    return await db.egeTask.count();
  } catch (err) {
    console.error("[EGE Init] Фатальная ошибка авто-инициализации заданий:", err);
    return 0;
  }
}
