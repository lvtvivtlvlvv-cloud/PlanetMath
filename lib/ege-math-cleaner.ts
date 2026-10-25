/**
 * lib/ege-math-cleaner.ts
 * Утилиты для автоматической реконструкции и нормализации разорванного математического текста
 * из PDF-сборников ФИПИ в валидный KaTeX / LaTeX.
 */

/**
 * Нормализует спецсимволы, склеивает переносы слов, разорванные дроби и отрезки
 */
export function cleanBrokenPdfMathText(rawText: string): string {
  if (!rawText) return "";

  let text = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  // 1. Убираем сломанный символ градуса (90♦ -> 90° или 90^\circ)
  text = text.replace(/(\d+)\s*[♦◆]/g, "$1°");
  text = text.replace(/[♦◆]/g, "°");

  // 2. Склеиваем разорванные дефисом слова (например, "равно-\nбедренный" -> "равнобедренный")
  text = text.replace(/([а-яА-ЯёЁa-zA-Z]+)-\s*\n\s*([а-яА-ЯёЁa-zA-Z]+)/gi, "$1$2");

  // 3. Заменяем типографский минус на стандартный для формул где уместно
  text = text.replace(/[−–]/g, "-");

  // 4. Склеиваем многострочные отрезки вида [ -4π; -5π \n 2 ] или [ -5π \n 2; -π ]
  // Случай А: левый конец целый, правый дробный: [ -4π; -5π \n 2 ]
  text = text.replace(
    /\[\s*([\-]?\s*(?:\d*π|[a-zA-Z0-9]+))\s*;\s*([\-]?\s*(?:\d*π|[a-zA-Z0-9]+))\s*\n\s*(\d+)\s*\]/g,
    (_, a, b, c) => `$\\left[${a.trim()}; -\\frac{${b.replace(/^-/, "").trim()}}{${c}}\\right]$`
  );

  // Случай Б: левый конец дробный, правый целый: [ -5π \n 2; -π ]
  text = text.replace(
    /\[\s*([\-]?\s*(?:\d*π|[a-zA-Z0-9]+))\s*\n\s*(\d+)\s*;\s*([\-]?\s*(?:\d*π|[a-zA-Z0-9]+))\s*\]/g,
    (_, a, b, c) => `$\\left[-\\frac{${a.replace(/^-/, "").trim()}}{${b}}; ${c.trim()}\\right]$`
  );

  // Случай В: оба конца дробные: [ -5π \n 2; -π \n 2 ]
  text = text.replace(
    /\[\s*([\-]?\s*(?:\d*π|[a-zA-Z0-9]+))\s*\n\s*(\d+)\s*;\s*([\-]?\s*(?:\d*π|[a-zA-Z0-9]+))\s*\n\s*(\d+)\s*\]/g,
    (_, a, b, c, d) => `$\\left[-\\frac{${a.replace(/^-/, "").trim()}}{${b}}; -\\frac{${c.replace(/^-/, "").trim()}}{${d}}\\right]$`
  );

  // Случай Г: многострочный отрезок без дробей: [\n -4π; -π \n]
  text = text.replace(
    /\[\s*\n\s*([\-]?\s*(?:\d*π|[a-zA-Z0-9]+))\s*;\s*([\-]?\s*(?:\d*π|[a-zA-Z0-9]+))\s*\n\s*\]/g,
    (_, a, b) => `$\\left[${a.trim()}; ${b.trim()}\\right]$`
  );

  // 5. Склеиваем разорванные аргументы тригонометрии вида ( 3π \n 2 + x ) или ( π \n 2 - x )
  text = text.replace(
    /\(\s*(\d*π)\s*\n\s*(\d+)\s*([+\-]\s*[a-zA-Z0-9]+)\s*\)/g,
    (_, num, den, tail) => `\\left(\\frac{${num}}{${den}} ${tail}\\right)`
  );

  // ( x + 3π \n 2 )
  text = text.replace(
    /\(\s*([a-zA-Z0-9]+)\s*([+\-])\s*(\d*π)\s*\n\s*(\d+)\s*\)/g,
    (_, head, op, num, den) => `\\left(${head} ${op} \\frac{${num}}{${den}}\\right)`
  );

  // Одиночная дробь в скобках вида ( 3π \n 2 )
  text = text.replace(
    /\(\s*(\d*π)\s*\n\s*(\d+)\s*\)/g,
    (_, num, den) => `\\left(\\frac{${num}}{${den}}\\right)`
  );

  // 6. Склеиваем разорванные дроби с числом или π на переносе строки
  text = text.replace(/(\d*π|[a-zA-Z0-9]+)\s*\n\s*(\d+)\b/g, (match, top, bot) => {
    // Не объединяем, если это явный список вида "1.\n2."
    if (/^\d+\.$/.test(top)) return match;
    return `\\frac{${top}}{${bot}}`;
  });

  // 7. Склеиваем разорванные знаки равенства и плюса/минуса
  text = text.replace(/\n\s*([=+\-×*])\s*/g, " $1 ");

  // 8. Исправляем степени функций: sin2 -> \sin^2, cos2 -> \cos^2, tg2 -> \tg^2, ctg2 -> \ctg^2
  text = text.replace(/\b(sin|cos|tg|ctg)2\b/gi, (_, f) => `\\${f.toLowerCase()}^2`);
  text = text.replace(/\b(sin|cos|tg|ctg)3\b/gi, (_, f) => `\\${f.toLowerCase()}^3`);

  // 9. Корни: √2 -> \sqrt{2}, √(x+1) -> \sqrt{x+1}
  text = text.replace(/√\s*\(([^)]+)\)/g, "\\sqrt{$1}");
  text = text.replace(/√\s*(\d+|[a-zA-Z]+)/g, "\\sqrt{$1}");

  // 10. Логарифмы: log2(x) -> \log_{2}(x)
  text = text.replace(/\blog(\d+)\s*\(/gi, (_, base) => `\\log_{${base}}(`);
  text = text.replace(/\blog_(\d+)/gi, (_, base) => `\\log_{${base}}`);

  // 11. Одиночные буквы от чертежей в конце условия (A B C D на отдельных строках)
  // В геометрических задачах из PDF ФИПИ в самом конце часто висят строки:
  // "A\nB C\nD"
  let prevText = "";
  while (prevText !== text) {
    prevText = text;
    text = text.replace(/\n\s*(?:[A-Z]\s*){1,6}$/g, "").trim();
  }

  // 12. Лишние пустые строки подряд
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
}

/**
 * Преобразует строку с математическими выражениями в размеченные сегменты для KaTeX.
 * Автоматически распознает $...$, $$...$$, а также явные математические уравнения.
 */
export interface MathSegment {
  type: "text" | "inline_math" | "block_math";
  content: string;
}

export function parseMathSegments(text: string): MathSegment[] {
  const segments: MathSegment[] = [];

  // Регулярка для вычленения $...$ и $$...$$
  const mathRegex = /(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mathRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textChunk = text.slice(lastIndex, match.index);
      if (textChunk) {
        segments.push({ type: "text", content: textChunk });
      }
    }

    const rawMatch = match[0];
    if (rawMatch.startsWith("$$") && rawMatch.endsWith("$$")) {
      segments.push({
        type: "block_math",
        content: rawMatch.slice(2, -2).trim(),
      });
    } else if (rawMatch.startsWith("$") && rawMatch.endsWith("$")) {
      segments.push({
        type: "inline_math",
        content: rawMatch.slice(1, -1).trim(),
      });
    }

    lastIndex = match.index + rawMatch.length;
  }

  if (lastIndex < text.length) {
    const tail = text.slice(lastIndex);
    if (tail) {
      segments.push({ type: "text", content: tail });
    }
  }

  // Если в тексте не было знаков доллара, но есть явные математические блоки с \frac, \sqrt, \sin, \cos:
  if (segments.length === 1 && segments[0].type === "text") {
    return autoDetectMathInText(segments[0].content);
  }

  return segments;
}

/**
 * Эвристическое разбиение обычного текста на слова и формулы, если разметка $...$ отсутствовала
 */
function autoDetectMathInText(raw: string): MathSegment[] {
  const result: MathSegment[] = [];

  // Ищем формульные куски, содержащие LaTeX-команды (\frac, \sin, \cos, \sqrt, \left) или равенства
  // или выражения вида sin^2(x) + cos(x) = 0
  const lines = raw.split("\n");

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (idx < lines.length - 1) {
        result.push({ type: "text", content: "\n" });
      }
      return;
    }

    // Если строка целиком выглядит как математическое уравнение/выражение
    const hasMathCommands = /\\(frac|sqrt|sin|cos|tg|ctg|log|left|right|circ)/.test(trimmed);
    const hasEquation = /[=+\-×*^]/i.test(trimmed) && (/[a-zA-Zπ]/.test(trimmed) || hasMathCommands);
    const isMainlyRussianWords = (trimmed.match(/[а-яА-ЯёЁ]{4,}/g) || []).length >= 3;

    if (hasMathCommands && !isMainlyRussianWords && trimmed.length < 160) {
      result.push({ type: "block_math", content: trimmed });
    } else {
      // Внутри строки ищем вкрапления формул
      const parts = splitInlineMath(trimmed);
      result.push(...parts);
    }

    if (idx < lines.length - 1) {
      result.push({ type: "text", content: "\n" });
    }
  });

  return result;
}

/**
 * Разделяет строку на русский текст и встроенные формулы
 */
function splitInlineMath(line: string): MathSegment[] {
  const segments: MathSegment[] = [];
  // Ищем формульные выражения, например: \sin^2\left(...) = 0 или y = 3x^2 - 4x + 1
  const inlineFormulaRegex = /((?:\\[a-zA-Z]+(?:\{[^}]*\}|\([^)]*\)|\^[0-9]+|\b)|[a-zA-Z0-9π\^_{}\(\)\+\-\*\/=><,;:\s\.]){4,})/g;

  // Безопасный режим: если есть \frac, \sqrt, \sin, \cos - вырезаем их как inline_math
  const latexCommandRegex = /(\\(?:frac\{[^}]*\}\{[^}]*\}|sqrt\{[^}]*\}|left\(.*?\\right\)|sin\^[0-9]+|cos\^[0-9]+|[a-zA-Z]+\^[0-9]+|\d+\^\circ))/g;

  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = latexCommandRegex.exec(line)) !== null) {
    if (m.index > last) {
      segments.push({ type: "text", content: line.slice(last, m.index) });
    }
    segments.push({ type: "inline_math", content: m[0] });
    last = m.index + m[0].length;
  }

  if (last < line.length) {
    segments.push({ type: "text", content: line.slice(last) });
  }

  return segments.length > 0 ? segments : [{ type: "text", content: line }];
}
