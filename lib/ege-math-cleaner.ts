/**
 * lib/ege-math-cleaner.ts
 * Утилиты для автоматической реконструкции и нормализации разорванного математического текста
 * из PDF-сборников ФИПИ в валидный KaTeX / LaTeX с поддержкой нижних индексов и детекцией чертежей.
 */

/**
 * 1. Нормализует вариационные селекторы, математический алфавит Юникода, минусы и спецсимволы
 */
export function normalizeFipiUnicode(raw: string): string {
  if (!raw) return "";

  // Удаляем вариационные селекторы Юникода U+FE00 - U+FE0F (например, варианты скобок (︂, )︂, [︁, ]︁)
  let text = raw.replace(/[\uFE00-\uFE0F]/g, "");

  // Заменяем математический алфавит Юникода (U+1D400 - U+1D7FF) на стандартный ASCII и греческий алфавит
  let res = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (!cp) {
      res += ch;
      continue;
    }

    // Подстрочные цифры Юникода (₀₁₂₃₄₅₆₇₈₉)
    if (cp >= 0x2080 && cp <= 0x2089) {
      res += String.fromCharCode(0x30 + (cp - 0x2080));
    }
    // Типографские минусы и тире
    else if (cp === 0x2212 || cp === 0x2013 || cp === 0x2014) {
      res += "-";
    }
    // Математические заглавные латинские буквы (жирный, курсив, полужирный курсив и др.)
    else if (
      (cp >= 0x1D400 && cp <= 0x1D419) ||
      (cp >= 0x1D434 && cp <= 0x1D44D) ||
      (cp >= 0x1D468 && cp <= 0x1D481) ||
      (cp >= 0x1D56C && cp <= 0x1D585) ||
      (cp >= 0x1D5A0 && cp <= 0x1D5B9) ||
      (cp >= 0x1D5D4 && cp <= 0x1D5ED) ||
      (cp >= 0x1D608 && cp <= 0x1D621) ||
      (cp >= 0x1D63C && cp <= 0x1D655)
    ) {
      const base =
        cp >= 0x1D63C ? 0x1D63C :
        cp >= 0x1D608 ? 0x1D608 :
        cp >= 0x1D5D4 ? 0x1D5D4 :
        cp >= 0x1D5A0 ? 0x1D5A0 :
        cp >= 0x1D56C ? 0x1D56C :
        cp >= 0x1D468 ? 0x1D468 :
        cp >= 0x1D434 ? 0x1D434 : 0x1D400;
      res += String.fromCharCode(65 + (cp - base));
    }
    // Математические строчные латинские буквы (жирный, курсив, полужирный курсив и др.)
    else if (
      (cp >= 0x1D41A && cp <= 0x1D433) ||
      (cp >= 0x1D44E && cp <= 0x1D467) ||
      (cp >= 0x1D482 && cp <= 0x1D49B) ||
      (cp >= 0x1D586 && cp <= 0x1D59F) ||
      (cp >= 0x1D5BA && cp <= 0x1D5D3) ||
      (cp >= 0x1D5EE && cp <= 0x1D607) ||
      (cp >= 0x1D622 && cp <= 0x1D63B) ||
      (cp >= 0x1D656 && cp <= 0x1D66F)
    ) {
      const base =
        cp >= 0x1D656 ? 0x1D656 :
        cp >= 0x1D622 ? 0x1D622 :
        cp >= 0x1D5EE ? 0x1D5EE :
        cp >= 0x1D5BA ? 0x1D5BA :
        cp >= 0x1D586 ? 0x1D586 :
        cp >= 0x1D482 ? 0x1D482 :
        cp >= 0x1D44E ? 0x1D44E : 0x1D41A;
      res += String.fromCharCode(97 + (cp - base));
    }
    // Математические цифры (0-9)
    else if (cp >= 0x1D7CE && cp <= 0x1D7FF) {
      res += String.fromCharCode(0x30 + ((cp - 0x1D7CE) % 10));
    }
    // Греческие символы (π, α, β, γ)
    else if (cp === 0x1D70B || cp === 0x1D745 || cp === 0x1D77F || cp === 0x1D7B9) {
      res += "π";
    } else if (cp === 0x1D6FC || cp === 0x1D736) {
      res += "α";
    } else if (cp === 0x1D6FD || cp === 0x1D737) {
      res += "β";
    } else if (cp === 0x1D6FE || cp === 0x1D738) {
      res += "γ";
    } else {
      res += ch;
    }
  }

  // Заменяем сломанные символы градусов
  res = res.replace(/[♦◆]/g, "°");

  return res;
}

/**
 * Чистит границу отрезка: убирает многострочные переносы и прилипшие знаменатели к π
 * Например: -π2 -> -\frac{\pi}{2}, 3π2 -> \frac{3\pi}{2}, -5π \n 2 -> -\frac{5\pi}{2}
 */
export function cleanIntervalBound(bound: string): string {
  let b = bound.trim().replace(/\s+/g, "");

  // Многострочная дробь: -5π \n 2
  const nlMatch = b.match(/^([+\-]?(?:\d*π|[a-zA-Z0-9]+))\n+(\d+)$/);
  if (nlMatch) {
    const isNeg = nlMatch[1].startsWith("-");
    const num = nlMatch[1].replace(/^[+\-]/, "").replace(/π/g, "\\pi");
    return `${isNeg ? "-" : ""}\\frac{${num}}{${nlMatch[2]}}`;
  }

  // Прилипший знаменатель: -5π2, -π2, 3π2, π2, 7π6, etc.
  const stuckMatch = b.match(/^([+\-]?)(\d*π)(\d+)$/);
  if (stuckMatch) {
    const sign = stuckMatch[1] === "-" ? "-" : "";
    const num = stuckMatch[2].replace(/π/g, "\\pi");
    const den = stuckMatch[3];
    return `${sign}\\frac{${num}}{${den}}`;
  }

  // Обычная дробь через слеш: -5π/2
  const slashMatch = b.match(/^([+\-]?)(\d*π)\/(\d+)$/);
  if (slashMatch) {
    const sign = slashMatch[1] === "-" ? "-" : "";
    const num = slashMatch[2].replace(/π/g, "\\pi");
    return `${sign}\\frac{${num}}{${slashMatch[3]}}`;
  }

  // Заменяем π на \pi
  b = b.replace(/π/g, "\\pi");
  return b;
}

/**
 * Объединяет разорванные строки математических выражений, если скобки unclosed или строка оканчивается на оператор
 */
export function joinBrokenMathLines(text: string): string {
  const lines = text.split("\n");
  const merged: string[] = [];
  let buffer = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const combined = buffer ? buffer + " " + line.trim() : line;

    // Считаем открытые и закрытые скобки
    const openParens = (combined.match(/\(/g) || []).length;
    const closeParens = (combined.match(/\)/g) || []).length;
    const openBrackets = (combined.match(/\[/g) || []).length;
    const closeBrackets = (combined.match(/\]/g) || []).length;
    const hasUnclosed = openParens > closeParens || openBrackets > closeBrackets;

    const nextLine = (lines[i + 1] || "").trim();
    const nextStartsOperator = /^[=+\-×·/*]/.test(nextLine);
    const currEndsOperator = /[=+\-×·/*,]$/.test(combined.trim());

    // Не объединяем, если следующая строка - это новый пункт задания (а), б), в)
    const nextIsPoint = /^(?:а|б|в)\)/i.test(nextLine);

    if ((hasUnclosed || currEndsOperator || nextStartsOperator) && !nextIsPoint) {
      buffer = combined;
    } else {
      merged.push(combined);
      buffer = "";
    }
  }

  if (buffer) {
    merged.push(buffer);
  }

  return merged.join("\n");
}

/**
 * Главная функция очистки и реконструкции разорванного математического текста
 */
export function cleanBrokenPdfMathText(rawText: string): string {
  if (!rawText) return "";

  let text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 1. Нормализация Юникода
  text = normalizeFipiUnicode(text);

  // 2. Склеиваем разорванные дефисом слова и склеенные слова из PDF
  text = text.replace(/([а-яА-ЯёЁa-zA-Z]+)-\s*\n\s*([а-яА-ЯёЁa-zA-Z]+)/gi, "$1$2");
  text = text.replace(/Найдитерасстояние/g, "Найдите расстояние");
  text = text.replace(/предыдущегогода/g, "предыдущего года");
  text = text.replace(/треугольнойпризмы/g, "треугольной призмы");

  // 3. Удаляем мусор колонтитулов и оглавления сборника ФИПИ в конце задач
  text = text.replace(/Ответ:\s*Оглавление[\s\S]*$/gi, "");
  text = text.replace(/Оглавление\s*<\s*<\s*<\s*<[\s\S]*$/gi, "");
  text = text.replace(/№\d+\.\s*(?:Стереометрия|Планиметрия|Уравнения|Неравенства|Задачи)[\s\S]*$/gi, "");
  text = text.replace(/(?:AB\s*C|A\s+B\s+C|y\s*=\s*f\s*\(x\)\s*0[\s\S]*)$/gi, "");
  text = text.replace(/(?:ABCDMNA1 B1C1D1[\s\S]*)$/gi, "");

  // 4. Приклеиваем точку после закрывающей скобки
  text = text.replace(/([\]\)])\s*\n*\./g, "$1.");

  // 5. Показательные уравнения: прилипшая степень вида 32x -> 3^{2x}, 22x -> 2^{2x}
  text = text.replace(/\b([23456789])(\d[a-z])\b/g, "$1^{$2}");

  // 6. Тригонометрические функции и степени
  text = text.replace(/\b(sin|cos|tg|ctg)\s*2\b/gi, (_, f) => `\\${f.toLowerCase()}^2`);
  text = text.replace(/\b(sin|cos|tg|ctg)\s*3\b/gi, (_, f) => `\\${f.toLowerCase()}^3`);
  text = text.replace(/\b(sin|cos|tg|ctg)\b/gi, (_, f) => `\\${f.toLowerCase()}`);

  // Логарифмы
  text = text.replace(/\blog(\d+)\s*\(/gi, (_, base) => `\\log_{${base}}(`);
  text = text.replace(/\blog(\d+)\b/gi, (_, base) => `\\log_{${base}}`);
  text = text.replace(/\blog_(\d+)/gi, (_, base) => `\\log_{${base}}`);

  // Корни
  text = text.replace(/√\s*\(([^)]+)\)/g, "\\sqrt{$1}");
  text = text.replace(/√\s*(\d+|[a-zA-Z]+)/g, "\\sqrt{$1}");

  // Градусы
  text = text.replace(/(\d+)\s*°/g, "$1^\\circ");

  // Склеиваем разорванные аргументы тригонометрии: ( 3π \n 2 + x )
  text = text.replace(
    /\(\s*(\d*π|\d+)\s*\n\s*(\d+)\s*([+\-][^)]*)\)/g,
    (_, num, den, tail) => `\\left(\\frac{${num.replace(/π/g, "\\pi")}}{${den}} ${tail.trim()}\\right)`
  );
  text = text.replace(
    /\(\s*([^)]*?)\s*([+\-])\s*(\d*π|\d+)\s*\n\s*(\d+)\s*\)/g,
    (_, head, op, num, den) => `\\left(${head.trim()} ${op} \\frac{${num.replace(/π/g, "\\pi")}}{${den}}\\right)`
  );
  text = text.replace(
    /\(\s*(\d*π|\d+)\s*\n\s*(\d+)\s*\)/g,
    (_, num, den) => `\\left(\\frac{${num.replace(/π/g, "\\pi")}}{${den}}\\right)`
  );

  // Склеиваем прилипшие дроби вида 23π12 -> \frac{23\pi}{12}, 7π8 -> \frac{7\pi}{8}
  text = text.replace(/\b(\d*π)(\d{1,2})\b/g, (_, num, den) => `\\frac{${num.replace(/π/g, "\\pi")}}{${den}}`);

  // 7. Склеиваем многострочные отрезки: [ -2π; -π2 ], [ -4π; -5π \n 2 ]
  text = text.replace(/\[\s*([\s\S]*?);\s*([\s\S]*?)\]/g, (match, left, right) => {
    if (left.length < 50 && right.length < 50 && !/[а-яА-ЯёЁ]{4,}/.test(left + right)) {
      const cLeft = cleanIntervalBound(left);
      const cRight = cleanIntervalBound(right);
      return `$\\left[${cLeft}; ${cRight}\\right]$`;
    }
    return match;
  });

  // 8. Склеиваем многострочные дроби на стыке строк (например, "3\n2" или "π\n2")
  text = text.replace(/(\d*π|[a-zA-Z0-9]+)\s*\n\s*(\d+)\b/g, (match, top, bot) => {
    if (/^\d+\.$/.test(top)) return match;
    return `\\frac{${top.replace(/π/g, "\\pi")}}{${bot}}`;
  });

  // 9. Преобразование нижних индексов: ABCDA1B1C1D1 -> ABCDA_{1}B_{1}C_{1}D_{1}, B1N -> B_{1}N, AA1 -> AA_{1}, x1 -> x_{1}
  text = text.replace(/([A-DF-Za-df-z])(\d+)/g, "$1_{$2}");

  // Заменяем греческие символы на команды LaTeX
  text = text.replace(/([αβγπ])/g, (ch) => {
    if (ch === "π") return "\\pi";
    if (ch === "α") return "\\alpha";
    if (ch === "β") return "\\beta";
    if (ch === "γ") return "\\gamma";
    return ch;
  });

  // 10. Объединяем разорванные строки уравнений
  text = joinBrokenMathLines(text);

  // 11. Удаляем висящие буквы от чертежей в самом конце текста
  let prevText = "";
  while (prevText !== text) {
    prevText = text;
    text = text.replace(/\n\s*(?:[A-Z]\s*){1,6}$/g, "").trim();
  }

  // 12. Разметка математических токенов в $...$ для аккуратного рендера KaTeX
  text = wrapMathTokensForKatex(text);

  return text.trim();
}

/**
 * Оборачивает математические токены (вершины, равенства, греческие буквы, уравнения)
 * в $...$, не трогая уже существующие $...$ и $$...$$
 */
export function wrapMathTokensForKatex(text: string): string {
  // Разбиваем по уже размеченным формулам $...$ и $$...$$
  const chunks = text.split(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g);

  return chunks
    .map((chunk, idx) => {
      // Нечетные фрагменты — уже размеченные $...$ или $$...$$
      if (idx % 2 === 1) return chunk;

      let res = chunk;

      // 1. Уравнения с \log, \sin, \cos или равенства: например, \log_{9}(...) = x
      res = res.replace(/(\\log_\{[^\}]+\}\([^\)]+\)\s*=\s*[a-zA-Z0-9]+)/g, "$$$1$$");

      // 2. Числовые равенства и пропорции: B_{1}N = 6, AA_{1} = 16, AB = 10, A_{1}E : EA = 5 : 3
      res = res.replace(
        /(?:\b[A-Za-z]+(?:_\{[0-9]+\}[A-Za-z0-9]*)*|\b[A-Z]{1,6})\s*=\s*[0-9]+(?:\.[0-9]+)?/g,
        "$$$&$$"
      );
      res = res.replace(
        /\b[A-Z]{1,2}_\{[0-9]+\}\s*:\s*[A-Z]{1,2}\s*=\s*[0-9]+\s*:\s*[0-9]+/g,
        "$$$&$$"
      );

      // 3. Цепочки вершин и переменные с индексами: ABCDA_{1}B_{1}C_{1}D_{1}, B_{1}N, AA_{1}, A_{1}E, x_{1}, a_{1}
      res = res.replace(/\b([A-Za-z]+(?:_\{[0-9]+\}[A-Za-z0-9]*)+)\b/g, "$$$1$$");

      // 4. Отрезки и многогранники (2-6 заглавных букв): AB, AD, CM, SC, ABM, SBC, SABCD
      res = res.replace(/\b([A-Z]{2,6})\b/g, "$$$1$$");

      // 5. Одиночные вершины после контекстных слов: "точки M и N", "прямой CM", "точки C", "плоскости \alpha"
      res = res.replace(
        /(точки?|прямой|прямые|плоскост[ьи]|отрезк[ае]|ребр[ае])\s+([A-Z])\b/g,
        "$1 $$$2$$"
      );
      res = res.replace(
        /(\b[A-Z]\b)\s+(и|или)\s+(\b[A-Z]\b)/g,
        "$$$1$$ $2 $$$3$$"
      );

      // 6. Греческие команды \alpha, \beta, \gamma, \pi
      res = res.replace(/(\\(?:alpha|beta|gamma|pi))\b/g, "$$$1$$");

      // 7. Выражения с командами LaTeX (\sqrt, \frac, ^\circ)
      res = res.replace(
        /((?:\d*\\(?:sqrt|frac|circ|sin|cos|tg|ctg)[a-zA-Z0-9_{}()\^+\\-]*\s*)+)/g,
        (match) => {
          const trimmed = match.trim();
          if (trimmed.length > 0 && !trimmed.startsWith("$")) {
            return `$$${trimmed}$$`;
          }
          return match;
        }
      );

      // Убираем случайные дублирования знаков доллара
      res = res.replace(/\$\$+/g, "$");
      res = res.replace(/\$([^\$]+)\$/g, (_, c) => `$${c.trim()}$`);

      return res;
    })
    .join("");
}

/**
 * Сегмент математического текста для рендеринга KaTeX
 */
export interface MathSegment {
  type: "text" | "inline_math" | "block_math";
  content: string;
}

/**
 * Преобразует строку с $...$ и $$...$$ в массив сегментов
 */
export function parseMathSegments(text: string): MathSegment[] {
  const segments: MathSegment[] = [];
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

  return segments;
}

/**
 * Определяет, действительно ли задача содержит оригинальный чертеж в PDF-файле.
 * - В задачах Части 2 (№13–19) и текстовых задачах без рисунков чертежей НЕТ.
 * - В Части 1 чертежи присутствуют только у задач №1, 2, 3, 8, 11 при наличии реального чертежа в PDF.
 */
export function hasPdfDrawing(task: {
  taskNumber: number;
  content: string;
  pdfPage?: number | null;
  taskCode?: string | null;
}): boolean {
  // 1. Часть 2 (№13–19) НИКОГДА не имеет чертежей в сборнике
  if (task.taskNumber >= 13) return false;

  // 2. Только задачи №1, 2, 3, 8, 11 Части 1 могут иметь чертежи
  const drawingEligibleNumbers = [1, 2, 3, 8, 11];
  if (!drawingEligibleNumbers.includes(task.taskNumber)) return false;

  // 3. Необходима страница PDF для кропа
  if (!task.pdfPage) return false;

  // 4. Задачи №2 (векторы), №8 (производные и касательные) и №11 (графики) всегда содержат графики в сборнике
  if (task.taskNumber === 2 || task.taskNumber === 8 || task.taskNumber === 11) {
    return true;
  }

  // 5. Для задач №1 (планиметрия) и №3 (стереометрия) проверяем контекстные маркеры наличия чертежа
  const lower = (task.content || "").toLowerCase();
  const mentionsDrawing =
    lower.includes("рисун") ||
    lower.includes("график") ||
    lower.includes("изображ") ||
    lower.includes("показан") ||
    lower.includes("клетчат") ||
    lower.includes("на клетк") ||
    /см\.\s*рис/i.test(lower);

  return mentionsDrawing;
}
