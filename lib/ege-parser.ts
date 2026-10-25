import fs from "fs";
import path from "path";
export * from "./ege-constants";
import { ParsedEgeTask, EGE_TASK_TOPICS, detectTaskNumberByKeywords } from "./ege-constants";

export const BOOK_TO_EGE_MAP: Record<number, number> = {
  1: 1,   // Планиметрия 1 -> ЕГЭ 1
  2: 2,   // Векторы -> ЕГЭ 2
  3: 3,   // Стереометрия 1 -> ЕГЭ 3
  4: 4,   // Вероятность 1 -> ЕГЭ 4
  5: 5,   // Вероятность 2 -> ЕГЭ 5
  6: 5,   // Случайные величины -> ЕГЭ 5
  7: 6,   // Уравнения 1 -> ЕГЭ 6
  8: 7,   // Вычисления и преобразования -> ЕГЭ 7
  9: 8,   // Производная и её график -> ЕГЭ 8
  10: 9,  // Задачи с прикладным содержанием -> ЕГЭ 9
  11: 10, // Текстовые задачи -> ЕГЭ 10
  12: 11, // Анализ графика -> ЕГЭ 11
  13: 16, // Финансовые задачи -> ЕГЭ 16
  14: 13, // Уравнения 2 -> ЕГЭ 13
  15: 14, // Стереометрия 2 -> ЕГЭ 14
  16: 15, // Неравенства -> ЕГЭ 15
  17: 12, // Экстремальные задачи -> ЕГЭ 12
  18: 17, // Планиметрия 2 -> ЕГЭ 17
  19: 18, // Задачи с параметром -> ЕГЭ 18
  20: 19, // “Нестандартные” задачи -> ЕГЭ 19
  21: 12, // Поиск экстремума -> ЕГЭ 12
};

/**
 * Extract tasks and answers specifically from the FIPI open bank PDF book (Ostromogilsky)
 */
export function extractFipiBookTasks(pagesText: string[], answersMap: Record<string, string>, defaultSource = "FIPI_PDF"): ParsedEgeTask[] {
  const tasks: ParsedEgeTask[] = [];

  // Pages 4 to ~175 contain the task prototypes
  const textBody = pagesText.slice(4, Math.min(180, pagesText.length)).join("\n");
  const taskRegex = /Задача\s*(\d{1,2})\.(\d+(?:\.\d+)?)[\.\s]+([\s\S]*?)(?=(?:Задача\s*\d{1,2}\.\d+)|\z)/gi;

  let match: RegExpExecArray | null;
  while ((match = taskRegex.exec(textBody)) !== null) {
    const bookChapter = parseInt(match[1], 10);
    const key = `${match[1]}.${match[2]}`;
    let body = match[3]
      .replace(/^(?:DEMO|NEW|SIM|Аналоги|Ответ|\s)+/g, "")
      .replace(/Оглавление[\s\S]*?Ответы/g, "")
      .replace(/Библиотека MathStart[\s\S]*?ВКонтакте/g, "")
      .replace(/Ответ:[\s\S]*$/, "")
      .trim();

    if (body.length > 20) {
      const egeNum = BOOK_TO_EGE_MAP[bookChapter] || (bookChapter <= 19 ? bookChapter : 1);
      const meta = EGE_TASK_TOPICS[egeNum] || { topic: `Задание №${egeNum}`, difficulty: "BASE" as const };
      const answer = answersMap[key] || answersMap[`${match[1]}.${match[2].split(".")[0]}`] || undefined;
      const wellBody = body.toWellFormed().trim();
      const firstLineChars = Array.from(wellBody.split("\n")[0] || "");
      const preview = firstLineChars.slice(0, 65).join("").trim();

      tasks.push({
        taskNumber: egeNum,
        topic: meta.topic,
        title: `Задача ${key}: ${preview.length > 5 ? preview : meta.topic}`.toWellFormed(),
        content: wellBody,
        answer: answer ? answer.toWellFormed() : undefined,
        difficulty: meta.difficulty,
        source: defaultSource,
      });
    }
  }

  return tasks;
}

/**
 * Parse text from PDF and extract individual EGE tasks (fallback for arbitrary PDF)
 */
export function extractTasksFromText(rawText: string, defaultSource = "FIPI"): ParsedEgeTask[] {
  const tasks: ParsedEgeTask[] = [];

  const clean = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ");

  const regexPatterns = [
    /(?:^|\n)(?:Задание|Задача|№)\s*(\d{1,2})[\.:\s\-]+([\s\S]*?)(?=(?:\n(?:Задание|Задача|№)\s*\d{1,2}[\.:\s\-]+)|\z)/gi,
    /(?:^|\n)(\d{1,2})\.\s+([А-ЯA-Z][\s\S]*?)(?=(?:\n\d{1,2}\.\s+[А-ЯA-Z])|\z)/g,
  ];

  let matchesFound = false;

  for (const re of regexPatterns) {
    let match: RegExpExecArray | null;
    re.lastIndex = 0;
    const tempTasks: ParsedEgeTask[] = [];

    while ((match = re.exec(clean)) !== null) {
      const rawNum = parseInt(match[1], 10);
      let content = match[2]?.trim() || "";

      if (content.length < 25) continue;

      let taskNum = rawNum;
      if (taskNum < 1 || taskNum > 19) {
        taskNum = detectTaskNumberByKeywords(content);
      }

      let answer: string | undefined;
      const ansMatch = content.match(/Ответ:\s*([^\n\r\.]+)/i);
      if (ansMatch) {
        answer = ansMatch[1].trim();
        content = content.replace(/Ответ:\s*[^\n\r\.]+/i, "").trim();
      }

      const meta = EGE_TASK_TOPICS[taskNum] || { topic: `Задание №${taskNum} ЕГЭ`, difficulty: "BASE" as const };
      const contentChars = Array.from(content.toWellFormed().split("\n")[0] || "");
      const previewTitle = contentChars.slice(0, 65).join("").trim();

      tempTasks.push({
        taskNumber: taskNum,
        topic: meta.topic,
        title: (previewTitle.length > 5 ? previewTitle : `Задание №${taskNum} по теме: ${meta.topic}`).toWellFormed(),
        content: content.toWellFormed(),
        answer: answer ? answer.toWellFormed() : undefined,
        difficulty: meta.difficulty,
        source: defaultSource,
      });
    }

    if (tempTasks.length >= 2) {
      tasks.push(...tempTasks);
      matchesFound = true;
      break;
    }
  }

  return tasks;
}

/**
 * Parse PDF buffer safely using pdf-parse PDFParse class (v2.x) with fallback
 */
export async function parsePdfBuffer(
  buffer: Buffer,
  options?: { maxPages?: number; source?: string }
): Promise<{ tasks: ParsedEgeTask[]; text: string; numpages: number; sampleSummary: string }> {
  if (!buffer || buffer.length < 50) {
    return {
      tasks: [],
      text: "",
      numpages: 0,
      sampleSummary: "Переданный PDF-файл пуст или поврежден.",
    };
  }

  const maxPages = options?.maxPages ?? 0;
  let pagesText: string[] = [];
  let fullText = "";
  let totalPages = 1;

  try {
    // Dynamic import of pdf-parse
    const pdfModule = await import("pdf-parse");
    const PDFParseClass = (pdfModule as any).PDFParse || (pdfModule as any).default?.PDFParse;

    if (PDFParseClass) {
      const parser = new PDFParseClass({ data: buffer });
      await parser.load();
      const textResult = await parser.getText();
      totalPages = textResult.total || textResult.pages?.length || 1;
      fullText = textResult.text || "";
      pagesText = (textResult.pages || []).map((p: any) => p.text || "");
      await parser.destroy();
    } else {
      const fn = (pdfModule as any).default || pdfModule;
      if (typeof fn === "function") {
        const res = await fn(buffer, { max: maxPages > 0 ? maxPages : undefined });
        fullText = res.text || "";
        totalPages = res.numpages || 1;
        pagesText = fullText.split(/\n-- \d+ of \d+ --\n/);
      }
    }
  } catch (err: any) {
    console.error("PDF parse engine error:", err);
    throw new Error(`Ошибка разбора структуры PDF: ${err.message || String(err)}`);
  }

  // 1. Extract answers from the answer section (pages 500+ if present)
  const answersMap: Record<string, string> = {};
  if (pagesText.length > 50) {
    const answerPages = pagesText.slice(Math.max(0, pagesText.length - 75));
    const answersText = answerPages.join("\n");
    const ansRegex = /№(\d{1,2}\.\d+(?:\.\d+)?)\s+([^\n\r]+)/g;
    let m: RegExpExecArray | null;
    while ((m = ansRegex.exec(answersText)) !== null) {
      answersMap[m[1]] = m[2].trim().replace(/\.$/, "");
    }
  }

  // 2. Try specialized extraction for FIPI book
  let tasks = extractFipiBookTasks(pagesText, answersMap, options?.source || "FIPI_PDF");

  // 3. If book pattern didn't match, fallback to generic task parser
  if (tasks.length === 0) {
    tasks = extractTasksFromText(fullText, options?.source || "FIPI_PDF");
  }

  const sampleLines = fullText.split("\n").filter((l) => l.trim().length > 0).slice(0, 15).join("\n");
  const sampleSummary = `Страниц обработано: ${totalPages}. Извлечено заданий: ${tasks.length}.\nНачало документа:\n${sampleLines.substring(0, 400)}...`;

  return {
    tasks,
    text: fullText,
    numpages: totalPages,
    sampleSummary,
  };
}

/**
 * Reads local PDF file if present in workspace root and returns parsed tasks
 */
export async function parseLocalFipiPdf(): Promise<ParsedEgeTask[]> {
  const candidatePaths = [
    path.join(process.cwd(), "Открытый банк задач ФИПИ. ЕГЭ по профильной математике.pdf"),
    path.join(process.cwd(), "tasks.pdf"),
    path.join("/", "Открытый банк задач ФИПИ. ЕГЭ по профильной математике.pdf"),
  ];

  let targetPath: string | null = null;
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      const stats = fs.statSync(p);
      if (stats.size > 1000) {
        targetPath = p;
        break;
      }
    }
  }

  if (!targetPath) {
    return [];
  }

  const buf = fs.readFileSync(targetPath);
  const result = await parsePdfBuffer(buf, { source: "LOCAL_FIPI_PDF" });
  return result.tasks;
}
