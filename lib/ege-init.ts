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
    if (existingCount > 0) {
      return existingCount;
    }

    console.log("[EGE Init] Таблица EgeTask пуста. Запуск авто-инициализации базы заданий...");
    const tasksToInsert: ParsedEgeTask[] = [];
    const jsonPath = path.join(process.cwd(), "data", "ege-tasks.json");

    // 1. Попытка прочитать из data/ege-tasks.json
    if (fs.existsSync(jsonPath)) {
      try {
        const rawJson = fs.readFileSync(jsonPath, "utf-8");
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          tasksToInsert.push(...parsed);
          console.log(`[EGE Init] Загружено ${parsed.length} заданий из data/ege-tasks.json`);
        }
      } catch (e) {
        console.warn("[EGE Init] Ошибка чтения ege-tasks.json:", e);
      }
    }

    // 2. Если из JSON ничего не получено или мало, парсим локальный PDF в корне
    if (tasksToInsert.length < 50) {
      try {
        const fromPdf = await parseLocalFipiPdf();
        if (fromPdf.length > 0) {
          console.log(`[EGE Init] Из локального PDF извлечено ${fromPdf.length} заданий`);
          tasksToInsert.push(...fromPdf);
        }
      } catch (e) {
        console.warn("[EGE Init] Ошибка парсинга локального PDF:", e);
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
      const key = `${item.taskNumber}_${item.title.trim().slice(0, 80)}`;
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
      });
    }

    if (sanitizedBatch.length > 0) {
      await db.egeTask.createMany({
        data: sanitizedBatch,
      });
      console.log(`[EGE Init] Успешно создано ${sanitizedBatch.length} заданий в SQLite`);

      // Сохраняем актуальный снимок в data/ege-tasks.json
      const outDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      fs.writeFileSync(jsonPath, JSON.stringify(sanitizedBatch, null, 2), "utf-8");
    }

    return await db.egeTask.count();
  } catch (err) {
    console.error("[EGE Init] Фатальная ошибка авто-инициализации заданий:", err);
    return 0;
  }
}
