import fs from "fs";
import path from "path";
import { db } from "./db";
import { INITIAL_FIPI_TASKS, ParsedEgeTask } from "./ege-constants";
import { parseLocalFipiPdf } from "./ege-parser";
import { cleanBrokenPdfMathText } from "./ege-math-cleaner";

/**
 * In-place cleanup of existing EgeTask records in SQLite without breaking IDs
 */
export async function runInPlaceEgeCleanupMigration(): Promise<number> {
  try {
    const allExisting = await db.egeTask.findMany();
    let updatedCount = 0;

    for (const task of allExisting) {
      const cleanedContent = cleanBrokenPdfMathText(task.content);
      const cleanedTitle = (task.title || "").replace(/[♦◆]/g, "°").trim();

      if (cleanedContent !== task.content || cleanedTitle !== task.title) {
        await db.egeTask.update({
          where: { id: task.id },
          data: {
            content: cleanedContent,
            title: cleanedTitle,
          },
        });
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      console.log(`[EGE Init] In-place очистка текста выполнена для ${updatedCount} заданий в БД`);
    }
    return updatedCount;
  } catch (err) {
    console.error("[EGE Init] Ошибка in-place миграции EgeTask:", err);
    return 0;
  }
}

/**
 * Ensures that the EgeTask table in SQLite is populated and cleaned.
 * Preserves all student assignments and foreign key relationships.
 */
export async function ensureEgeTasksInitialized(): Promise<number> {
  try {
    // 1. Всегда запускаем in-place очистку формул и символов у уже существующих заданий
    await runInPlaceEgeCleanupMigration();

    const existingCount = await db.egeTask.count();
    if (existingCount >= 19) {
      // Проверяем, представлены ли все номера 1..19
      const existingNumbers = await db.egeTask.findMany({
        select: { taskNumber: true },
        distinct: ["taskNumber"],
      });
      const numbersSet = new Set(existingNumbers.map((n) => n.taskNumber));
      const hasAllNumbers = Array.from({ length: 19 }, (_, i) => i + 1).every((num) => numbersSet.has(num));

      if (hasAllNumbers) {
        return existingCount;
      }
    }

    console.log("[EGE Init] Требуется дополнение или первичная инициализация банка заданий...");

    const tasksToInsert: ParsedEgeTask[] = [];

    // 2. Парсим локальный PDF в корне напрямую
    try {
      const fromPdf = await parseLocalFipiPdf();
      if (fromPdf.length > 0) {
        console.log(`[EGE Init] Из локального PDF извлечено ${fromPdf.length} заданий`);
        tasksToInsert.push(...fromPdf);
      }
    } catch (e) {
      console.warn("[EGE Init] Ошибка парсинга локального PDF:", e);
    }

    // 3. Если PDF дал мало задач, дополняем из data/ege-tasks.json
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

    // 4. Дополняем эталонным банком по всем 19 номерам
    for (const item of INITIAL_FIPI_TASKS) {
      if (!tasksToInsert.some((t) => t.taskNumber === item.taskNumber && t.title === item.title)) {
        tasksToInsert.push(item);
      }
    }

    // 5. Пакетная запись / обновление в SQLite
    const uniqueKeys = new Set<string>();
    for (const item of tasksToInsert) {
      const key = `${item.taskNumber}_${item.taskCode || item.title.trim().slice(0, 80)}`;
      if (uniqueKeys.has(key)) continue;
      uniqueKeys.add(key);

      const cleanedContent = cleanBrokenPdfMathText(item.content);
      const cleanedTitle = (item.title || "").replace(/[♦◆]/g, "°").trim();

      const existing = await db.egeTask.findFirst({
        where: {
          taskNumber: item.taskNumber,
          title: cleanedTitle,
        },
      });

      if (existing) {
        await db.egeTask.update({
          where: { id: existing.id },
          data: {
            pdfPage: item.pdfPage ?? existing.pdfPage,
            taskCode: item.taskCode ?? existing.taskCode,
            topic: item.topic || existing.topic,
            content: cleanedContent,
            answer: item.answer || existing.answer,
          },
        });
      } else {
        await db.egeTask.create({
          data: {
            taskNumber: item.taskNumber,
            topic: item.topic || `Задание №${item.taskNumber}`,
            title: cleanedTitle,
            content: cleanedContent,
            answer: item.answer || null,
            solution: item.solution || null,
            difficulty: item.difficulty || "BASE",
            source: item.source || "FIPI",
            pdfPage: item.pdfPage ?? null,
            taskCode: item.taskCode ?? null,
          },
        });
      }
    }

    console.log(`[EGE Init] База заданий успешно синхронизирована (всего ${await db.egeTask.count()})`);

    // Сохраняем актуальный снимок в data/ege-tasks.json
    try {
      const outDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      const allTasks = await db.egeTask.findMany({ orderBy: [{ taskNumber: "asc" }, { createdAt: "asc" }] });
      fs.writeFileSync(path.join(outDir, "ege-tasks.json"), JSON.stringify(allTasks, null, 2), "utf-8");
    } catch (e) {
      console.warn("[EGE Init] Ошибка сохранения data/ege-tasks.json:", e);
    }

    return await db.egeTask.count();
  } catch (err) {
    console.error("[EGE Init] Фатальная ошибка авто-инициализации заданий:", err);
    return 0;
  }
}
