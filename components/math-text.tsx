"use client";

import React, { useMemo } from "react";
import katex from "katex";
import { parseMathSegments } from "@/lib/ege-math-cleaner";

interface MathTextProps {
  text: string;
  className?: string;
  blockClassName?: string;
}

export function MathText({ text, className = "", blockClassName = "" }: MathTextProps) {
  const renderedParagraphs = useMemo(() => {
    if (!text) return [];

    const paragraphs = parseMathSegments(text);

    return paragraphs.map((para, pIdx) =>
      para.map((seg, sIdx) => {
        if (seg.type === "text") {
          return {
            id: `${pIdx}-${sIdx}`,
            type: "text" as const,
            html: null,
            content: seg.content,
          };
        }

        const sanitizedLatex = seg.content
          .replace(/\\left\s*\\left/g, "\\left")
          .replace(/\\right\s*\\right/g, "\\right")
          .trim();

        try {
          const html = katex.renderToString(sanitizedLatex, {
            displayMode: seg.type === "block_math",
            throwOnError: false,
            strict: false,
            // trust: true разрешает \href с произвольными протоколами — это XSS.
            trust: false,
          });
          return {
            id: `${pIdx}-${sIdx}`,
            type: seg.type,
            html,
            content: sanitizedLatex,
          };
        } catch (err) {
          console.warn("[MathText] KaTeX render error:", err);
          return {
            id: `${pIdx}-${sIdx}`,
            type: "text" as const,
            html: null,
            content: sanitizedLatex,
          };
        }
      })
    );
  }, [text]);

  if (!text) return null;

  return (
    <div className={`space-y-1.5 leading-relaxed text-zinc-200 select-text ${className}`}>
      {renderedParagraphs.map((para, pIdx) => {
        if (para.length === 1 && para[0].type === "block_math" && para[0].html) {
          return (
            <div
              key={pIdx}
              className={`my-2.5 py-1.5 px-3 overflow-x-auto text-center text-cyan-200 text-sm sm:text-base ${blockClassName}`}
              dangerouslySetInnerHTML={{ __html: para[0].html }}
            />
          );
        }

        return (
          <p key={pIdx} className="leading-relaxed">
            {para.map((seg) => {
              if ((seg.type === "inline_math" || seg.type === "block_math") && seg.html) {
                return (
                  <span
                    key={seg.id}
                    className="inline align-baseline mx-0.5 text-cyan-200"
                    dangerouslySetInnerHTML={{ __html: seg.html }}
                  />
                );
              }
              return <span key={seg.id}>{seg.content}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}
