/**
 * lib/ege-math-cleaner.ts
 * Автоматическая реконструкция и нормализация математического текста
 * из PDF-сборников ФИПИ для рендеринга через KaTeX.
 */

export const TASK_CODE_TO_PDF_PAGE: Record<string, number> = {
  "1.1": 5, "1.2": 5, "1.3": 6, "1.4": 6, "1.5": 6, "1.6": 7, "1.7": 7, "1.8": 7, "1.9": 8, "1.10": 8,
  "1.11": 8, "1.12": 9, "1.13": 9, "1.14": 9, "1.15": 10, "1.16": 10, "1.17": 10, "1.18": 11, "1.19": 11, "1.20": 11,
  "1.21": 12, "1.22": 12, "1.23": 12, "1.24": 13, "1.25": 13, "1.26": 13, "1.27": 14, "1.28": 14, "1.29": 15, "2.1": 16,
  "2.2": 16, "2.3": 16, "2.4": 16, "2.5": 17, "2.6": 17, "3.1": 18, "3.2": 18, "3.3": 18, "3.4": 19, "3.5": 19,
  "3.6": 19, "3.7": 20, "3.8": 20, "3.9": 21, "3.10": 21, "3.11": 21, "3.12": 22, "3.13": 22, "3.14": 22, "3.15": 23,
  "3.16": 23, "3.17": 23, "3.18": 24, "3.19": 24, "3.20": 24, "3.21": 25, "3.22": 25, "3.23": 26, "3.24": 26, "3.25": 26,
  "3.26": 27, "3.27": 27, "3.28": 27, "4.1": 28, "4.2": 28, "4.3": 28, "4.4": 28, "4.5": 29, "4.6": 29, "4.7": 29,
  "4.8": 29, "4.9": 29, "4.10": 30, "4.11": 30, "4.12": 30, "4.13": 30, "4.14": 30, "4.15": 31, "4.16": 31, "4.17": 31,
  "4.18": 31, "4.19": 32, "5.1": 33, "5.2": 33, "5.3": 33, "5.4": 33, "5.5": 34, "5.6": 34, "5.7": 34, "5.8": 34,
  "5.9": 35, "6.1": 36, "7.1": 37, "7.2": 37, "7.3": 37, "7.4": 37, "7.5": 37, "7.6": 38, "7.7": 38, "7.8": 38,
  "7.9": 38, "7.10": 38, "8.1": 39, "8.2": 39, "8.3": 39, "8.4": 39, "8.5": 39, "8.6": 39, "8.7": 40, "8.8": 40,
  "8.9": 40, "8.10": 40, "8.11": 40, "8.12": 40, "8.13": 41, "8.14": 41, "8.15": 41, "8.16": 41, "8.17": 41, "8.18": 41,
  "8.19": 42, "8.20": 42, "8.21": 42, "8.22": 42, "8.23": 42, "8.24": 42, "9.1": 43, "9.2": 43, "9.3": 44, "9.4": 44,
  "9.5": 45, "9.6": 45, "9.7": 46, "9.8": 46, "9.9": 47, "10.1": 48, "10.2": 48, "10.3": 48, "10.4": 49, "10.5": 49,
  "10.6": 49, "10.7": 50, "10.8": 50, "10.9": 50, "10.10": 51, "10.11": 51, "10.12": 51, "10.13": 52, "10.14": 52, "10.15": 52,
  "10.16": 53, "10.17": 53, "10.18": 53, "10.19": 54, "10.20": 54, "10.21": 55, "10.22": 55, "10.23": 56, "11.1": 57, "11.2": 57,
  "11.3": 57, "11.4": 57, "11.5": 58, "11.6": 58, "11.7": 58, "11.8": 58, "11.9": 59, "11.10": 59, "11.11": 59, "11.12": 59,
  "11.13": 60, "11.14": 60, "11.15": 60, "11.16": 60, "11.17": 61, "11.18": 61, "11.19": 61, "11.20": 61, "11.21": 62, "11.22": 62,
  "11.23": 62, "11.24": 62, "12.1": 63, "12.2": 63, "12.3": 64, "12.4": 64, "12.5": 65, "12.6": 65, "12.7": 66, "12.8": 66,
  "12.9": 67, "12.10": 67, "13.1": 68, "13.2": 68, "13.3": 69, "13.4": 69, "13.5": 70, "13.6": 70, "13.7": 71, "13.8": 71,
  "13.9": 72, "13.10": 72, "13.11": 73, "13.12": 73, "13.13": 74, "13.14": 74, "13.15": 75, "13.16": 75, "13.17": 76, "13.18": 76,
  "13.19": 77, "13.20": 77, "13.21": 78, "13.22": 78, "13.23": 79, "13.24": 79, "13.25": 80, "13.26": 80, "13.27": 81, "13.28": 81,
  "13.29": 82, "13.30": 82, "13.31": 83, "13.32": 83, "13.33": 84, "13.34": 84, "13.35": 85, "13.36": 85, "13.37": 86, "13.38": 86,
  "13.39": 86, "13.40": 87, "13.41": 87, "13.42": 87, "13.43": 88, "14.1": 89, "14.2": 89, "14.3": 89, "14.4": 90, "14.5": 90,
  "14.6": 90, "14.7": 90, "14.8": 91, "14.9": 91, "14.10": 91, "14.11": 92, "14.12": 92, "14.13": 92, "14.14": 92, "14.15": 93,
  "14.16": 93, "14.17": 93, "14.18": 94, "14.19": 94, "14.20": 94, "14.21": 95, "14.22": 95, "14.23": 95, "14.24": 96, "14.25": 96,
  "14.26": 96, "14.27": 97, "14.28": 97, "14.29": 97, "14.30": 98, "14.31": 98, "15.1": 99, "15.2": 99, "15.3": 99, "15.4": 100,
  "15.5": 100, "15.6": 100, "15.7": 101, "15.8": 101, "15.9": 101, "15.10": 101, "15.11": 102, "15.12": 102, "15.13": 102, "15.14": 103,
  "15.15": 103, "15.16": 103, "15.17": 104, "15.18": 104, "15.19": 104, "15.20": 104, "15.21": 105, "15.22": 105, "15.23": 105, "15.24": 105,
  "15.25": 106, "15.26": 106, "15.27": 106, "15.28": 107, "15.29": 107, "15.30": 107, "15.31": 108, "15.32": 108, "15.33": 108, "15.34": 108,
  "15.35": 109, "15.36": 109, "15.37": 109, "15.38": 110, "15.39": 110, "15.40": 110, "15.41": 111, "15.42": 111, "15.43": 111, "15.44": 112,
  "15.45": 112, "15.46": 112, "15.47": 113, "16.1": 114, "16.2": 114, "16.3": 114, "16.4": 114, "16.5": 115, "16.6": 115, "16.7": 115,
  "16.8": 115, "16.9": 116, "16.10": 116, "16.11": 116, "16.12": 116, "16.13": 117, "16.14": 117, "16.15": 117, "16.16": 117, "16.17": 117,
  "16.18": 118, "16.19": 118, "16.20": 118, "16.21": 118, "16.22": 119, "16.23": 119, "16.24": 119, "16.25": 119, "16.26": 120, "16.27": 120,
  "16.30": 120, "16.28": 120, "16.29": 120, "16.31": 121, "16.32": 121, "16.33": 121, "16.34": 121, "17.1": 122, "17.2": 122, "18.1": 123,
  "18.2": 123, "18.3": 123, "18.4": 124, "18.5": 124, "18.6": 124, "18.7": 124, "18.8": 125, "18.9": 125, "18.10": 125, "18.11": 125,
  "18.12": 126, "18.13": 126, "18.14": 126, "18.15": 126, "18.16": 127, "18.17": 127, "18.18": 127, "18.19": 127, "18.20": 128, "18.21": 128,
  "18.22": 128, "18.23": 128, "18.24": 129, "18.25": 129, "18.26": 129, "18.27": 129, "18.28": 130, "18.29": 130, "18.30": 130, "18.31": 130,
  "18.32": 131, "18.33": 131, "18.34": 131, "18.35": 131, "18.36": 132, "18.37": 132, "18.38": 132, "18.39": 132, "18.40": 133, "18.41": 133,
  "18.42": 133, "18.43": 133, "18.44": 134, "18.45": 134, "18.46": 134, "18.47": 134, "18.48": 135, "18.49": 135, "18.50": 135, "18.51": 135,
  "18.52": 136, "18.53": 136, "18.54": 136, "19.1": 137, "19.2": 137, "19.3": 137, "19.4": 137, "19.5": 138, "19.6": 138, "19.7": 138,
  "19.8": 138, "19.9": 138, "19.10": 139, "19.11": 139, "19.12": 139, "19.13": 139, "19.14": 140, "19.15": 140, "19.16": 140, "19.17": 140,
  "19.18": 140, "19.19": 141, "19.20": 141, "19.21": 141, "19.22": 141, "19.23": 141, "19.24": 142, "19.25": 142, "19.26": 142, "19.27": 142,
  "19.28": 143, "19.29": 143, "19.30": 143, "19.31": 143, "19.32": 144, "19.33": 144, "19.34": 144, "19.35": 144, "19.36": 145, "19.37": 145,
  "19.38": 145, "19.39": 145, "19.40": 146, "19.41": 146, "19.42": 146, "19.43": 146, "19.44": 147, "20.1": 148, "20.2": 148, "20.3": 148,
  "20.4": 149, "20.5": 149, "20.6": 149, "20.7": 150, "20.8": 150, "20.9": 150, "20.10": 151, "20.11": 151, "20.12": 151, "20.13": 152,
  "20.14": 152, "20.15": 152, "20.16": 153, "20.17": 153, "20.18": 154, "20.19": 154, "20.20": 154, "20.21": 155, "20.22": 155, "20.23": 155,
  "20.24": 156, "20.25": 156, "20.26": 156, "20.27": 157, "20.28": 157, "20.29": 157, "20.30": 158, "20.31": 158, "20.32": 158, "20.33": 159,
  "20.34": 159, "20.35": 159, "20.36": 160, "20.37": 160, "20.38": 160, "20.39": 161, "21.1": 162, "21.2": 162, "21.3": 162, "21.4": 162,
  "21.5": 162, "21.6": 163, "21.7": 163, "21.8": 163, "21.9": 163, "21.10": 163, "21.11": 164, "21.12": 164, "21.13": 164, "21.14": 164,
  "21.15": 164, "21.16": 165, "21.17": 165, "21.18": 165, "21.19": 165, "21.20": 165,
};

const CYR_TO_LAT: Record<string, string> = {
  "А": "A", "В": "B", "С": "C", "Е": "E", "К": "K",
  "М": "M", "Н": "H", "О": "O", "Р": "P", "Т": "T", "Х": "X",
};

/**
 * Заменяет русские заглавные буквы-двойники (А, В, С, Е, К, М, Н, О, Р, Т, Х)
 * в названиях геометрических вершин и отрезков на латинские A, B, C, E, K, M, H, O, P, T, X.
 */
function replaceCyrillicVertices(input: string): string {
  let text = input;

  // Защищаем единицу измерения Ампер "(в А)" от превращения в вершину A
  text = text.replace(/\(в\s*A\)/g, "(в А)");

  // 1. Заглавная кириллическая буква с индексом 0, 1, 2 (например: В1 -> B1, С1 -> C1, А1 -> A1)
  text = text.replace(/([АВСЕНКМОРТХ])([012])/g, (_, ch: string, d: string) => (CYR_TO_LAT[ch] || ch) + d);

  // 2. Цепочки из 2+ заглавных букв/индексов (например: АВ -> AB, ВС -> BC, МК -> MK, АВCDA1 -> ABCDA1)
  text = text.replace(/(?<![а-яёА-ЯЁa-zA-Z])([A-ZАВСЕНКМОРТХ012]{2,})(?![а-яёА-ЯЁa-zA-Z])/g, (m) => {
    return m.replace(/[АВСЕНКМОРТХ]/g, (ch) => CYR_TO_LAT[ch] || ch);
  });

  // 3. Одиночные заглавные буквы после геометрических терминов (точка М, прямая СМ, вершина В, ∠ВАС)
  text = text.replace(
    /(точк[аеиуой]+|вершин[аеыуой]+|середин[аеыуой]+|прям[аяыеой]+|отрез[окау]+|ребр[аеуо]+|плоскост[ьию]+|уг[олула]+|∠)\s+([АВСЕНКМОРТХ])(?![а-яёА-ЯЁa-zA-Z])/gi,
    (_, prefix: string, ch: string) => `${prefix} ${CYR_TO_LAT[ch] || ch}`
  );

  return text;
}

/**
 * Преобразует конец интервала (например, "-5\pi\n2" или "-5\pi/2") в LaTeX-дробь "-\frac{5\pi}{2}"
 */
function formatEndpointFraction(ep: string): string {
  const s = ep.trim().replace(/\s*\n\s*/g, "/").replace(/[\t ]+/g, " ");
  const m = s.match(/^([+\-]?\s*)(\d*\s*\\pi|\d+)\s*\/\s*(\d+)$/);
  if (m) {
    const sign = m[1].trim();
    const num = m[2].replace(/\s+/g, "");
    return `${sign}\\frac{${num}}{${m[3].trim()}}`;
  }
  return s;
}

/**
 * Делит математический фрагмент по запятым верхнего уровня (вне скобок и десятичных дробей)
 */
function splitTopLevelCommas(mathStr: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let lastIdx = 0;
  for (let i = 0; i < mathStr.length; i++) {
    const ch = mathStr[i];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth = Math.max(0, depth - 1);
    else if (ch === "," && depth === 0) {
      const prevIsDigit = i > 0 && /\d/.test(mathStr[i - 1]);
      const nextIsDigit = i + 1 < mathStr.length && /\d/.test(mathStr[i + 1]);
      if (!prevIsDigit || !nextIsDigit) {
        parts.push(mathStr.slice(lastIdx, i));
        lastIdx = i + 1;
      }
    }
  }
  parts.push(mathStr.slice(lastIdx));
  return parts;
}

/**
 * Оборачивает один очищенный математический фрагмент в $ ... $, вынося знаки препинания наружу
 */
function wrapSingleMathCore(rawSpan: string): string {
  let leading = "";
  let trailing = "";
  let core = rawSpan;

  // Отделяем начальные пробелы и знаки препинания (кроме унарного минуса перед формулой)
  const leadMatch = core.match(/^([\s.,:;!?«»"—]+)(.*)$/s);
  if (leadMatch) {
    leading = leadMatch[1];
    core = leadMatch[2];
  }

  // Отделяем конечные пробелы и знаки препинания
  const trailMatch = core.match(/^(.*?)([\s.,:;!?«»"—\-]+)$/s);
  if (trailMatch) {
    trailing = trailMatch[2];
    core = trailMatch[1];
  }

  // Балансируем внешние скобки, если открывается русское пояснение вроде "I (в А)" или "R_{2} (в Ом)"
  let openCount = (core.match(/\(/g) || []).length - (core.match(/\\left\(/g) || []).length;
  let closeCount = (core.match(/\)/g) || []).length - (core.match(/\\right\)/g) || []).length;
  while (openCount > closeCount && /[\s(]+$/.test(core)) {
    const m = core.match(/^(.*?)(\s*\(\s*)$/s);
    if (!m) break;
    trailing = m[2] + trailing;
    core = m[1];
    openCount--;
  }
  while (closeCount > openCount && /^[\s)]+/.test(core)) {
    const m = core.match(/^(\s*\)\s*)(.*)$/s);
    if (!m) break;
    leading = leading + m[1];
    core = m[2];
    closeCount--;
  }

  // Повторно отделяем хвостовую пунктуацию после балансировки скобок
  const trailMatch2 = core.match(/^(.*?)([\s.,:;!?«»"—]+)$/s);
  if (trailMatch2) {
    trailing = trailMatch2[2] + trailing;
    core = trailMatch2[1];
  }

  if (!core || !/[a-zA-Z\\_^=<>]/.test(core)) {
    return rawSpan;
  }

  // Защита от дублирования \left\left и \right\right
  core = core
    .replace(/\\left\s*\\left/g, "\\left")
    .replace(/\\right\s*\\right/g, "\\right")
    .trim();

  if (!core) return rawSpan;

  return `${leading}$${core}$${trailing}`;
}

/**
 * Однопроходная обертка математических выражений в строке в $ ... $
 */
function wrapMathInLine(line: string): string {
  if (!line.trim()) return line;

  return line.replace(/[^а-яёА-ЯЁ]+/g, (span) => {
    if (!/[a-zA-Z\\_^=<>]/.test(span)) {
      return span;
    }
    const subParts = splitTopLevelCommas(span);
    return subParts.map((part) => wrapSingleMathCore(part)).join(",");
  });
}

/**
 * Главная функция очистки и реконструкции текста задачи из PDF в LaTeX-разметку.
 * Полностью идемпотентна: повторный вызов дает идентичный результат без вложенных $.
 */
export function cleanBrokenPdfMathText(rawText: string): string {
  if (!rawText) return "";

  let text = rawText;

  // 0. Очистка шапки задачи, старых знаков $ и дублей \left\left
  text = text.replace(/^Задача\s*\d{1,2}\.\d+(?:\.\d+)?\.?\s*/i, "");
  text = text.replace(/\$/g, "");
  text = text.replace(/\\left\s*\\left/g, "\\left").replace(/\\right\s*\\right/g, "\\right");
  text = text.replace(/^[\s.]*(?:(?:DEMO|NEW|SIM)|Аналоги|Ответ|[\s.])+/gi, "");
  text = text.replace(/Ответ:[\s\S]*$/i, "");
  text = text.replace(/Оглавление[\s\S]*$/i, "");
  text = text.replace(/Библиотека MathStart[\s\S]*?ВКонтакте\s*/gi, "");

  // Восстановление ошибочно сконвертированных степеней из старой БД (a_{2} -> a^{2}, x_{4} -> x^{4})
  text = text.replace(/\b([abctyz])_\{([2-9])\}/g, "$1^{$2}");
  text = text.replace(/\bx_\{([3-9])\}(?!\s*,\s*x_)/g, "x^{$1}");
  text = text.replace(/\bx_\{2\}(?!\s*,\s*x_)(?<!x_\{1\}\s*,\s*x_\{2\})/g, "x^{2}");
  text = text.replace(/8x\+1\s*-\s*\\frac\{40\}\{2\}\s*[·⋅*\\cdot]+\s*6\^\{?4x\}?\s*-\s*32/g, "\\frac{8^{x+1} - 40}{2 \\cdot 64^{x} - 32}");

  // 1. Нормализация Unicode (Variation Selectors \uFE00-\uFE0F и Mathematical Italic)
  text = text.replace(/[\uFE00-\uFE0F]/g, "");
  let norm = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (!cp) continue;
    if (cp >= 0x1d400 && cp <= 0x1d7ff) {
      if (cp >= 0x1d434 && cp <= 0x1d44d) { norm += String.fromCharCode(65 + (cp - 0x1d434)); continue; }
      if (cp >= 0x1d44e && cp <= 0x1d467) { norm += String.fromCharCode(97 + (cp - 0x1d44e)); continue; }
      if (cp >= 0x1d400 && cp <= 0x1d419) { norm += String.fromCharCode(65 + (cp - 0x1d400)); continue; }
      if (cp >= 0x1d41a && cp <= 0x1d433) { norm += String.fromCharCode(97 + (cp - 0x1d41a)); continue; }
      if (cp >= 0x1d468 && cp <= 0x1d481) { norm += String.fromCharCode(65 + (cp - 0x1d468)); continue; }
      if (cp >= 0x1d482 && cp <= 0x1d49b) { norm += String.fromCharCode(97 + (cp - 0x1d482)); continue; }
      if (cp === 0x1d6fc || cp === 0x1d736) { norm += "\\alpha "; continue; }
      if (cp === 0x1d6fd || cp === 0x1d737) { norm += "\\beta "; continue; }
      if (cp === 0x1d6fe || cp === 0x1d738) { norm += "\\gamma "; continue; }
      if (cp === 0x1d6ff || cp === 0x1d739) { norm += "\\delta "; continue; }
      if (cp === 0x1d70b || cp === 0x1d745) { norm += "\\pi "; continue; }
      if (cp === 0x1d711 || cp === 0x1d719) { norm += "\\varphi "; continue; }
      if (cp === 0x1d714) { norm += "\\omega "; continue; }
      if (cp >= 0x1d7ce && cp <= 0x1d7d7) { norm += String.fromCharCode(48 + (cp - 0x1d7ce)); continue; }
    }
    if (cp === 0x210e) { norm += "h"; continue; }
    norm += ch;
  }

  text = norm
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/−/g, "-")
    .replace(/[♦∘]/g, "°")
    .replace(/[α]/g, "\\alpha ")
    .replace(/[β]/g, "\\beta ")
    .replace(/[γ]/g, "\\gamma ")
    .replace(/[π]/g, "\\pi ")
    .replace(/\\(pi|alpha|beta|gamma|delta|varphi|omega)[\t ]+(?=[0-9a-zA-Z(])/g, "\\$1 ")
    .replace(/\\(pi|alpha|beta|gamma|delta|varphi|omega)[\t ]+(?=[),.;:\]\-+*/=\n])/g, "\\$1");

  // Исправление битых маркеров списка в Задании №16 (U+0088, ˆ, Private Use Area \uE000-\uF8FF, \u2580-\u25FF)
  text = text.replace(
    /(^|\n)[\t ]*[\u0080-\u009F\u02C6\u02DC\u2022\u2580-\u25FF\uE000-\uF8FF\uF000-\uF0FF\uFFFD][\t ]*/g,
    "$1— "
  );

  // Склейка переносов русских слов через дефис
  text = text.replace(/([а-яёА-ЯЁ]{2,})-[\t ]*\n[\t ]*([а-яё]{2,})/g, "$1$2");

  // Удаление прилипших заголовков разделов внизу страницы
  text = text.replace(/\n(?:Уравнения|Неравенства|Планиметрия|Стереометрия|Производная|Финансовая)[^\n]*$/i, "");

  // 2. Удаление вывалившихся подписей осей графиков (№8, №11) и вершин чертежей (№1, №2, №3) в конце текста
  const lines = text.split("\n");
  while (lines.length > 1) {
    const last = lines[lines.length - 1].trim();
    if (!last) {
      lines.pop();
      continue;
    }
    const precedingText = lines.slice(0, -1).join("\n");
    const hasCompletedSentenceAbove = /[.?][\t ]*(?:\n|$)/.test(precedingText);
    const isAxisOrVertexLabel =
      hasCompletedSentenceAbove &&
      last.length <= 40 &&
      /^[A-Z0-9xy_{}\t ,.\-°?()=f\\\/]+$/i.test(last) &&
      !/[а-яёА-ЯЁ]/i.test(last) &&
      !/\\pi|\\left|\\right|\\sin|\\cos/.test(last) &&
      !/[<>≤≥]/.test(last);
    if (isAxisOrVertexLabel) {
      lines.pop();
    } else {
      break;
    }
  }
  text = lines.join("\n").trim();

  // Дополнительная очистка хвостов x_1 x_2 ... x_8 в Задании №8
  text = text.replace(/(?:\n[\t ]*x[_0-9{}\t x]+)+$/gi, "");

  // 3. Замена кириллических букв-двойников в вершинах и склейка кернинга (M K -> MK, EF T -> EFT)
  text = replaceCyrillicVertices(text);
  for (let pass = 0; pass < 2; pass++) {
    text = text.replace(/\b([A-Z][012]?)[\t ]+([A-Z][012]?)\b(?![\t ]*[а-яё])/g, "$1$2");
  }

  // Схлопывание всех подряд идущих переносов строк сразу после открывающих '(' / '[' и перед закрывающими ')' / ']'
  text = text.replace(/([(\[])[\t \n]+/g, "$1");
  text = text.replace(/[\t \n]+([)\]])/g, "$1");
  text = text.replace(/\][\t \n]*\./g, "].");
  // Одиночная фигурная скобка системы уравнений на отдельной строке
  text = text.replace(/(^|\n)[\t ]*\{[\t ]*\n/g, "$1");

  // 4. Функции, степени и нижние индексы
  text = text.replace(/\blog2[\t ]*\n[\t ]*(\d+(?:,\d+)?)\b/g, "\\log_{$1}^{2}");
  text = text.replace(/\blog_?(\d+(?:,\d+)?)\b/g, "\\log_{$1}");
  text = text.replace(/(?<!\\)\b(sin|cos)([2-9])\b/g, "\\$1^{$2}");
  text = text.replace(/(?<!\\)\b(tg|ctg)([2-9])\b/g, "\\text{$1}^{$2}");
  text = text.replace(/(?<!\\)\b(sin|cos|ln|lg)\b/g, "\\$1");
  text = text.replace(/(?<!\\|\\text\{)\b(tg|ctg)\b/g, "\\text{$1}");

  // Нижний индекс (_) ТОЛЬКО у заглавных букв геометрических вершин и физических величин с цифрами 0, 1, 2
  text = text.replace(/\b([A-Z012]+)\b/g, (m) => {
    if (/^[012]+$/.test(m)) return m;
    return m.replace(/([A-Z])([012])(?![0-9])/g, "$1_{$2}");
  });

  // Нижний индекс у маленьких x_0, x_1, ..., x_9 ТОЛЬКО при перечислении через запятую или после слов "точек"/"абсциссой"
  text = text.replace(/\bx0\b/g, "x_{0}");
  text = text.replace(/\bx([1-9])(?=[\t ]*,[\t ]*x[1-9])/g, "x_{$1}");
  for (let pass = 0; pass < 10; pass++) {
    text = text.replace(/(x_\{\d+\}[\t ]*,[\t ]*)x(\d+)\b/g, "$1x_{$2}");
  }
  text = text.replace(/(точ[еккаиуой]+|абсцисс[аеыуой]+)[\t ]+x([0-9])\b/gi, "$1 x_{$2}");

  // Многострочные дроби внутри круглых скобок: ( 3\pi\n2 + x ) и ( x + 4\nx )
  text = text.replace(
    /\([\t ]*([+\-]?[\t ]*\d*\\pi)[\t ]*\n[\t ]*(\d+)[\t ]*([+\-][\t ]*[^()\n]+?)[\t ]*\)/g,
    "\\left(\\frac{$1}{$2} $3\\right)"
  );
  text = text.replace(
    /\([\t ]*([^\n()=,:;а-яёА-ЯЁ]+?)[\t ]*\n[\t ]*([^\n()=,:;а-яёА-ЯЁ]+?)[\t ]*\)/g,
    (m, num: string, den: string) => {
      const n = num.trim();
      const d = den.trim();
      if (!n || !d) return m;
      return `\\left(\\frac{${n}}{${d}}\\right)`;
    }
  );

  // Склейка строки, начинающейся с + или - сразу после закрывающей скобки
  text = text.replace(/(\\right\)|\))[\t ]*\n[\t ]*([+\-])/g, "$1 $2");

  // Верхний индекс (степень ^) после закрывающей скобки или закрывающего модуля: (x + 1)2 -> (x + 1)^{2}
  text = text.replace(/(\\right\)|\)|(?<=[a-zA-Z0-9}])\|)[\t ]*\n?[\t ]*([2-9])\b(?![0-9x^])/g, "$1^{$2}");

  // Показательные выражения вида 8x+ 2\n3, 8x+1, 2 · 64x
  text = text.replace(/\b(\d+)x[\t ]*([+\-])[\t ]*(\d+)[\t ]*\n[\t ]*(\d+)\b/g, "$1^{x $2 \\frac{$3}{$4}}");
  text = text.replace(/\b(\d+)x([+\-]\d+)\b/g, "$1^{x$2}");
  text = text.replace(/·[\t ]*(\d+)x\b/g, "· $1^{x}");

  // Верхний индекс (степень ^) после маленьких переменных a, b, c, k, m, n, p, q, t, x, y, z в уравнениях и неравенствах
  text = text.replace(/(?<![\\a-zA-Z_{^])([0-9a-zA-Z]*?[abckmnpqtxyz])([2-9])\b/g, (full, base: string, pow: string) => {
    if (/^(?:sin|cos|tg|ctg|log|ln|lg)$/i.test(base)) return full;
    return `${base}^{${pow}}`;
  });

  // В показательных неравенствах и уравнениях (без x^2, без (...)^2, без модулей |...| и без \log) преобразуем 3x -> 3^{x}, 64x -> 64^{x}
  if (
    !/x\^\{[2-9]\}|\)\^\{[2-9]\}|\||\\log/.test(text) &&
    /(?:неравенств|уравнен)/i.test(text) &&
    !/\\sin|\\cos|\\text\{tg\}/.test(text)
  ) {
    text = text.replace(/\b(2|3|4|5|6|7|8|9|11|12|16|25|27|36|64|81|121)x\b/g, "$1^{x}");
  }

  // 5. Многострочные отрезки [ a ; b ]
  text = text.replace(/\[[\t ]*([^\];]+?)[\t ]*;[\t ]*([^\]]+?)[\t ]*\]/g, (_, a: string, b: string) => {
    return `\\left[${formatEndpointFraction(a)}; ${formatEndpointFraction(b)}\\right]`;
  });

  // Корни √
  text = text.replace(/√\(([^)]+)\)/g, "\\sqrt{$1}");
  text = text.replace(/√[\t ]*(\d*x\^\{\d+\}[^=\n,.;]*)/g, (_, rad: string) => `\\sqrt{${rad.trim()}}`);
  text = text.replace(/√(\d+|[a-zA-Z]+)/g, "\\sqrt{$1}");

  // Многострочные физические и алгебраические формулы вида "I = U\nR" или "R = R_{1}R_{2}\nR_{1} + R_{2}"
  text = text.replace(
    /(\b[A-Za-z_0-9\{\}]+[\t ]*=[\t ]*)([^\n=,.;:а-яёА-ЯЁ]+)\n[\t ]*([^\n=,.;:а-яёА-ЯЁ]+?)(?=[\t ]*(?:[,.;:]|\n|$))/g,
    (_, lhs: string, num: string, den: string) => {
      return `${lhs}\\frac{${num.trim()}}{${den.trim()}}`;
    }
  );

  // Многострочные дроби в неравенствах и уравнениях (без тяжелого lookbehind)
  text = text.replace(
    /(^|\n|неравенство[\t ]+|[=≤≥<>][\t ]*)([0-9a-zA-Z\\_{}^+\-·*() ]+)\n[\t ]*([0-9a-zA-Z\\_{}^+\-·*() ]+?)(?=[\t ]*(?:[=≤≥<>]|\.[\t ]*(?:\n|$)|\n|$))/g,
    (match, prefix: string, num: string, den: string) => {
      const n = num.trim();
      const d = den.trim();
      if (!n || !d || n === "{" || n === "}") return match;
      if (/^[+\-]/.test(d)) return `${prefix}${n} ${d}`;
      if (/^\\(?:sin|cos|text\{tg\}|text\{ctg\})/.test(d)) return `${prefix}${n} ${d}`;
      return `${prefix}\\frac{${n}}{${d}}`;
    }
  );

  // Склейка разорванных формул после знаков =, +, -, ·, \sqrt{...}
  text = text.replace(/([=+\-·])[\t ]*\n[\t ]*(?=[0-9a-zA-Z\\(\[])/g, "$1 ");
  text = text.replace(/(\\sqrt\{[^}]+\})[\t ]*\n[\t ]*(?=[0-9a-zA-Z\\(\[])/g, "$1 ");

  // Замена спецсимволов на LaTeX-команды
  text = text.replace(/∠[\t ]*/g, "\\angle ");
  text = text.replace(/(\d+)[\t ]*°/g, "$1^{\\circ}");
  text = text.replace(/°/g, "^{\\circ}");
  text = text.replace(/≤/g, " \\le ");
  text = text.replace(/≥/g, " \\ge ");
  text = text.replace(/·/g, " \\cdot ");
  text = text.replace(/\b([fg])[\t ]+\(/g, "$1(");

  // 6. Однопроходная обертка всех математических фрагментов в $ ... $
  text = text
    .split("\n")
    .map((line) => wrapMathInLine(line))
    .join("\n");

  // 7. Финальная зачистка дублей \left\left и \right\right
  text = text
    .replace(/\\left\s*\\left/g, "\\left")
    .replace(/\\right\s*\\right/g, "\\right");

  return text;
}

export interface MathSegment {
  type: "text" | "inline_math" | "block_math";
  content: string;
}

/**
 * Разбивает строку по символу переноса строки ТОЛЬКО вне математических блоков $ ... $
 */
function splitLinesOutsideMath(text: string): string[] {
  const result: string[] = [];
  let inMath = false;
  let lastIdx = 0;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "$") {
      inMath = !inMath;
    } else if (text[i] === "\n" && !inMath) {
      result.push(text.slice(lastIdx, i));
      lastIdx = i + 1;
    }
  }
  result.push(text.slice(lastIdx));
  return result;
}

/**
 * Разбивает текст задачи на абзацы и сегменты для рендера через KaTeX
 */
export function parseMathSegments(rawText: string): MathSegment[][] {
  const cleaned = cleanBrokenPdfMathText(rawText);
  if (!cleaned) return [];

  const rawLines = splitLinesOutsideMath(cleaned);
  const paragraphs: MathSegment[][] = [];

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Если строка целиком состоит из одной крупной формулы $...$ (с возможной точкой/запятой в конце)
    const singleMathMatch = line.match(/^\$([^$]+)\$([.,;]?)$/);
    if (singleMathMatch) {
      const mathBody = singleMathMatch[1]
        .replace(/\\left\s*\\left/g, "\\left")
        .replace(/\\right\s*\\right/g, "\\right")
        .trim();
      const punct = singleMathMatch[2] || "";
      const isDisplayFormula =
        mathBody.length > 10 &&
        (/[=<>]|\\le|\\ge|\\frac|\\left\[|\\sqrt/.test(mathBody));

      if (isDisplayFormula) {
        paragraphs.push([{ type: "block_math", content: mathBody + punct }]);
        continue;
      }
    }

    const segments: MathSegment[] = [];
    const parts = line.split(/(\$[^$]+\$)/g);

    for (const part of parts) {
      if (!part) continue;
      if (part.startsWith("$") && part.endsWith("$") && part.length >= 2) {
        const mathContent = part
          .slice(1, -1)
          .replace(/\\left\s*\\left/g, "\\left")
          .replace(/\\right\s*\\right/g, "\\right")
          .trim();
        if (mathContent) {
          segments.push({ type: "inline_math", content: mathContent });
        }
      } else {
        segments.push({ type: "text", content: part });
      }
    }

    if (segments.length > 0) {
      paragraphs.push(segments);
    }
  }

  return paragraphs;
}

/**
 * Разрешает страницу PDF и код прототипа для любого задания (№1–19) из банка ФИПИ.
 * Возвращает pdfPage и taskCode для рендера через <PdfTaskCrop />, либо null для задач,
 * созданных учителем вручную без привязки к PDF.
 */
export function resolvePdfTaskMeta(task: {
  taskNumber: number;
  content: string;
  pdfPage?: number | null;
  taskCode?: string | null;
  title?: string | null;
}): { hasDrawing: boolean; pdfPage: number | null; taskCode: string | null } {
  // Извлекаем код задачи (например, "14.1", "9.1" или "1.1")
  let code = task.taskCode ? task.taskCode.replace(/^Задача\s*/i, "").trim() : null;
  if (!code && task.title) {
    const m = task.title.match(/(\d{1,2}\.\d+(?:\.\d+)?)/);
    if (m) code = m[1];
  }

  // Определяем страницу PDF из БД или из таблицы всех 506 задач ФИПИ
  const page = task.pdfPage ?? (code ? TASK_CODE_TO_PDF_PAGE[code] ?? null : null);

  if (!page) {
    return { hasDrawing: false, pdfPage: null, taskCode: code };
  }

  return {
    hasDrawing: true,
    pdfPage: page,
    taskCode: code,
  };
}

/**
 * Проверяет, есть ли у задачи привязка к странице исходного PDF
 */
export function hasPdfDrawing(task: {
  taskNumber: number;
  content: string;
  pdfPage?: number | null;
  taskCode?: string | null;
  title?: string | null;
}): boolean {
  return Boolean(resolvePdfTaskMeta(task).pdfPage);
}

