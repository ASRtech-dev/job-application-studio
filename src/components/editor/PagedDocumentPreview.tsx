"use client";

import { useEffect, useRef, useState } from "react";
import type { Application } from "@/lib/schemas";
import { buildDocumentHtml, getDocumentElementId } from "@/lib/documentExport";
import { paginatePrintableDocument, type DocumentPaginationResult } from "@/lib/documentPagination";

interface Props {
  app: Application;
  type: "cv" | "letter";
  onMeasured: (result: DocumentPaginationResult) => void;
  /** Disables the 2-page CV ceiling so full Master CVs can paginate cleanly across 3+ A4 pages. */
  unboundedPages?: boolean;
  /** Optional footer suffix label overriding the default document type suffix. */
  documentLabel?: string;
}

/** The same isolated HTML, font metrics and paginator used by offline export. */
export function PagedDocumentPreview({ app, type, onMeasured, unboundedPages, documentLabel }: Props) {
  const [html, setHtml] = useState("");
  const [measuredHeights, setMeasuredHeights] = useState<Record<"cv" | "letter", number>>({ cv: 1123, letter: 1123 });
  const [error, setError] = useState("");
  const generation = useRef(0);
  const measured = useRef(onMeasured);
  useEffect(() => { measured.current = onMeasured; }, [onMeasured]);
  const height = measuredHeights[type] ?? 1123;
  useEffect(() => {
    const version = ++generation.current;
    const frame = requestAnimationFrame(() => {
      const node = document.getElementById(getDocumentElementId(app, type));
      if (!node) return;
      const faces: string[] = [];
      for (const sheet of document.styleSheets) {
        try { for (const rule of sheet.cssRules) if (rule.type === CSSRule.FONT_FACE_RULE) faces.push(rule.cssText); }
        catch { /* Third-party style sheets are never required by the document. */ }
      }
      const documentHtml = buildDocumentHtml(app, type, node.outerHTML, { unboundedPages, documentLabel });
      setHtml(documentHtml.replace("</head>", `<meta name="job-preview-generation" content="${version}"><style>${faces.join("\n")}</style></head>`));
      setError("");
    });
    return () => { cancelAnimationFrame(frame); generation.current = version + 1; };
  }, [app, type, unboundedPages, documentLabel]);

  return <div style={{ width: "210mm", position: "relative" }}>
    {error && <p role="alert" className="ui-controls" style={{ color: "#9f1239", background: "#fff1f2", padding: 16 }}>{error}</p>}
    <iframe
      title={type === "cv" ? "Paginated CV preview" : "Paginated cover letter preview"}
      sandbox="allow-same-origin"
      srcDoc={html}
      style={{ display: "block", border: 0, width: "210mm", height, background: "white" }}
      onLoad={async (event) => {
        const doc = event.currentTarget.contentDocument;
        if (!doc || !doc.querySelector('meta[name="job-page-layout"]')) return;
        const version = generation.current;
        if (doc.querySelector<HTMLMetaElement>('meta[name="job-preview-generation"]')?.content !== String(version)) return;
        try {
          await doc.fonts.ready;
          await Promise.all([...doc.images].map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          })));
          if (version !== generation.current) return;
          const result = paginatePrintableDocument(doc);
          const nextHeight = result.height || 1123;
          setMeasuredHeights((prev) => (prev[type] === nextHeight ? prev : { ...prev, [type]: nextHeight }));
          measured.current(result);
        } catch (failure) {
          if (version === generation.current) setError(failure instanceof Error ? failure.message : "Could not compose the document preview.");
        }
      }}
    />
  </div>;
}
