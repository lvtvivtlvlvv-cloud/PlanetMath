export * from "./ege-constants";
import { ParsedEgeTask, EGE_TASK_TOPICS, detectTaskNumberByKeywords } from "./ege-constants";

/**
 * Parse text from PDF and extract individual EGE tasks
 */
export function extractTasksFromText(rawText: string, defaultSource = "FIPI"): ParsedEgeTask[] {
  const tasks: ParsedEgeTask[] = [];

  // Normalize line endings and whitespace
  const clean = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ");

  // Strategy 1: Look for explicit task headers: "Задание 1", "№ 1", "Задание №1", "Задача 1."
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

      let solution: string | undefined;
      const solMatch = content.match(/Решение:?\s*([\s\S]*?)(?=Ответ:|\z)/i);
      if (solMatch) {
        solution = solMatch[1].trim();
        content = content.replace(/Решение:?\s*[\s\S]*?(?=Ответ:|\z)/i, "").trim();
      }

      const meta = EGE_TASK_TOPICS[taskNum] || { topic: `Задание №${taskNum} ЕГЭ`, difficulty: "BASE" as const };
      const previewTitle = content.split("\n")[0].substring(0, 75).trim();

      tempTasks.push({
        taskNumber: taskNum,
        topic: meta.topic,
        title: previewTitle.length > 5 ? previewTitle : `Задание №${taskNum} по теме: ${meta.topic}`,
        content,
        answer,
        solution,
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

  // Strategy 2: If no strict regex matched, split by paragraphs
  if (!matchesFound) {
    const paragraphs = clean
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 40);

    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      if (/содержание|введение|оглавление|фипи|демоверсия|инструкция/i.test(p) && p.length < 150) {
        continue;
      }

      const taskNum = detectTaskNumberByKeywords(p);
      const meta = EGE_TASK_TOPICS[taskNum] || { topic: `Задание №${taskNum} ЕГЭ`, difficulty: "BASE" as const };
      const previewTitle = p.split("\n")[0].substring(0, 70).trim();

      let answer: string | undefined;
      let content = p;
      const ansMatch = p.match(/Ответ:\s*([^\n\r\.]+)/i);
      if (ansMatch) {
        answer = ansMatch[1].trim();
        content = p.replace(/Ответ:\s*[^\n\r\.]+/i, "").trim();
      }

      tasks.push({
        taskNumber: taskNum,
        topic: meta.topic,
        title: previewTitle || `Задача №${i + 1} (${meta.topic})`,
        content,
        answer,
        difficulty: meta.difficulty,
        source: defaultSource,
      });
    }
  }

  return tasks;
}

/**
 * Parse PDF buffer safely with optional page range limit
 */
export async function parsePdfBuffer(
  buffer: Buffer,
  options?: { maxPages?: number; source?: string }
): Promise<{ tasks: ParsedEgeTask[]; text: string; numpages: number; sampleSummary: string }> {
  const maxPages = options?.maxPages ?? 0;

  const pdfModule = await import("pdf-parse");
  const pdfParse = (pdfModule as any).default || pdfModule;

  const data = await pdfParse(buffer, {
    max: maxPages > 0 ? maxPages : undefined,
  });

  const rawText = data.text || "";
  const tasks = extractTasksFromText(rawText, options?.source || "FIPI_PDF");

  const sampleLines = rawText.split("\n").filter((l: string) => l.trim().length > 0).slice(0, 15).join("\n");
  const sampleSummary = `Страниц обработано: ${data.numpages}. Извлечено заданий: ${tasks.length}.\nНачало документа:\n${sampleLines.substring(0, 400)}...`;

  return {
    tasks,
    text: rawText,
    numpages: data.numpages,
    sampleSummary,
  };
}
