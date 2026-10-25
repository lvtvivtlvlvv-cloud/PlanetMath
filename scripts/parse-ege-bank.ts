import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { parsePdfBuffer, INITIAL_FIPI_TASKS, ParsedEgeTask } from "../lib/ege-parser";

const prisma = new PrismaClient();

const CANDIDATE_PATHS = [
  process.argv[2],
  path.join(process.cwd(), "tasks.pdf"),
  path.join(process.cwd(), "Открытый банк задач ФИПИ. ЕГЭ по профильной математике.pdf"),
  path.join("/", "Открытый банк задач ФИПИ. ЕГЭ по профильной математике.pdf"),
  path.join(process.cwd(), "public", "tasks.pdf"),
  path.join(process.cwd(), "public", "Открытый банк задач ФИПИ. ЕГЭ по профильной математике.pdf"),
].filter(Boolean) as string[];

async function main() {
  console.log("==================================================");
  console.log("   Инструмент парсинга Банка задач ЕГЭ ФИПИ       ");
  console.log("==================================================");

  let targetPdfPath: string | null = null;
  for (const p of CANDIDATE_PATHS) {
    if (fs.existsSync(p)) {
      targetPdfPath = p;
      break;
    }
  }

  const outDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const jsonOutPath = path.join(outDir, "ege-tasks.json");

  let parsedTasks: ParsedEgeTask[] = [];

  if (targetPdfPath) {
    console.log(`\n[1/3] Обнаружен PDF-файл: ${targetPdfPath}`);
    const fileBuffer = fs.readFileSync(targetPdfPath);
    console.log(`Размер файла: ${(fileBuffer.length / (1024 * 1024)).toFixed(2)} МБ`);

    if (fileBuffer.length === 0) {
      console.log("[Внимание] Файл пуст (0 байт). Возможно, он был создан без содержимого.");
      console.log("Загружаем эталонный банк задач ФИПИ (все задания 1–19 ЕГЭ по профильной математике)...");
      parsedTasks = [...INITIAL_FIPI_TASKS];
    } else {
      // Фаза 1: Анализ структуры на первых 2-3 страницах
      console.log("\n[2/3] Предварительный анализ первых 3 страниц...");
      const preview = await parsePdfBuffer(fileBuffer, { maxPages: 3, source: "FIPI_PDF" });
      console.log("----------------- Отчет по структуре -----------------");
      console.log(preview.sampleSummary);
      console.log(`Найдено заданий на первых 3 страницах: ${preview.tasks.length}`);
      console.log("------------------------------------------------------");

      // Фаза 2: Полный парсинг всего файла локально
      console.log("\n[3/3] Локальный парсинг всего PDF-файла...");
      const fullResult = await parsePdfBuffer(fileBuffer, { source: "FIPI_PDF" });
      parsedTasks = fullResult.tasks;
      console.log(`Всего страниц в документе: ${fullResult.numpages}`);
      console.log(`Успешно извлечено заданий: ${parsedTasks.length}`);

      if (parsedTasks.length === 0) {
        console.log("В файле не найдено заданий, загружаем эталонный банк ФИПИ...");
        parsedTasks = [...INITIAL_FIPI_TASKS];
      }
    }
  } else {
    console.log("\n[Внимание] PDF-файл не найден по стандартным путям:");
    CANDIDATE_PATHS.forEach((p) => console.log(` - ${p}`));
    console.log("\nЧтобы распарсить ваш PDF-файл, поместите его в корень проекта как `tasks.pdf`");
    console.log("или `Открытый банк задач ФИПИ. ЕГЭ по профильной математике.pdf`");
    console.log("и выполните: npm run parse:pdf");
    console.log("\nЗагружаем эталонный банк задач ФИПИ (все задания 1–19 ЕГЭ по профильной математике)...");

    parsedTasks = [...INITIAL_FIPI_TASKS];
  }

  // Сохраняем в структурированный JSON
  fs.writeFileSync(jsonOutPath, JSON.stringify(parsedTasks, null, 2), "utf-8");
  console.log(`\nСтруктурированный банк задач сохранен в JSON: ${jsonOutPath}`);

  // Сохраняем в базу данных SQLite (Prisma)
  console.log("\nИмпорт заданий в базу данных проекта (SQLite)...");
  let addedCount = 0;
  let updatedCount = 0;

  for (const item of parsedTasks) {
    const existing = await prisma.egeTask.findFirst({
      where: {
        taskNumber: item.taskNumber,
        title: item.title,
      },
    });

    if (existing) {
      await prisma.egeTask.update({
        where: { id: existing.id },
        data: {
          content: item.content,
          topic: item.topic,
          answer: item.answer || existing.answer,
          solution: item.solution || existing.solution,
          difficulty: item.difficulty,
          source: item.source,
        },
      });
      updatedCount++;
    } else {
      await prisma.egeTask.create({
        data: {
          taskNumber: item.taskNumber,
          topic: item.topic,
          title: item.title,
          content: item.content,
          answer: item.answer,
          solution: item.solution,
          difficulty: item.difficulty,
          source: item.source,
        },
      });
      addedCount++;
    }
  }

  console.log(`Добавлено новых заданий: ${addedCount}`);
  console.log(`Обновлено существующих: ${updatedCount}`);

  // Выводим статистику банка по номерам заданий
  const totalInDb = await prisma.egeTask.count();
  console.log(`\nВсего заданий в базе данных: ${totalInDb}`);

  console.log("\nРаспределение по номерам заданий ЕГЭ:");
  for (let num = 1; num <= 19; num++) {
    const count = await prisma.egeTask.count({ where: { taskNumber: num } });
    if (count > 0) {
      console.log(`  №${num.toString().padEnd(2)}: ${count} шт.`);
    }
  }

  console.log("\nПарсинг и сохранение успешно завершены!\n");
}

main()
  .catch((err) => {
    console.error("Ошибка при парсинге банка задач:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
