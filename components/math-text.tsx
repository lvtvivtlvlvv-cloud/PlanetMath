"use client";

import React, { useMemo } from "react";
import katex from "katex";
import { cleanBrokenPdfMathText, parseMathSegments } from "@/lib/ege-math-cleaner";

interface MathTextProps {
  text: string;
  className?: string;
  blockClassName?: string;
}

export function MathText({ text, className = "", blockClassName = "" }: MathTextProps) {
  const renderedSegments = useMemo(() => {
    if (!text) return [];

    const cleaned = cleanBrokenPdfMathText(text);
    const segments = parseMathSegments(cleaned);

    return segments.map((seg, idx) => {
      if (seg.type === "text") {
        return {
          id: idx,
          type: "text" as const,
          html: null,
          content: seg.content,
        };
      }

      try {
        const html = katex.renderToString(seg.content, {
          displayMode: seg.type === "block_math",
          throwOnError: false,
          strict: false,
          trust: true,
        });
        return {
          id: idx,
          type: seg.type,
          html,
          content: seg.content,
        };
      } catch (err) {
        console.warn("[MathText] KaTeX render error:", err);
        return {
          id: idx,
          type: "text" as const,
          html: null,
          content: seg.content,
        };
      }
    });
  }, [text]);

  if (!text) return null;

  return (
    <div className={`space-y-2 leading-relaxed text-zinc-200 select-text ${className}`}>
      {renderedSegments.map((seg) => {
        if (seg.type === "block_math" && seg.html) {
          return (
            <div
              key={seg.id}
              className={`my-3 py-1.5 px-3 overflow-x-auto text-center text-cyan-200 text-sm sm:text-base ${blockClassName}`}
              dangerouslySetInnerHTML={{ __html: seg.html }}
            />
          );
        }

        if (seg.type === "inline_math" && seg.html) {
          return (
            <span
              key={seg.id}
              className="inline align-baseline mx-0.5 text-cyan-200"
              dangerouslySetInnerHTML={{ __html: seg.html }}
            />
          );
        }

        // Обычный текст с сохранением переводов строк
        return (
          <span key={seg.id} className="whitespace-pre-wrap">
            {seg.content}
          </span>
        );
      })}
    </div>
  );
}
