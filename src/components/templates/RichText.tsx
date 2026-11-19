import React from "react";

// -------------------------------------------------------------
// RICH TEXT & METRIC EMPHASIS HELPER (100% ATS-SAFE INLINE DOM)
// -------------------------------------------------------------
const METRIC_REGEX =
  /(\*\*[^*]+?\*\*|\b\d+(?:[.,]\d+)?\s*(?:%|percent|Prozent)\b|\b\d{1,3}(?:\.\d{3})+(?:\s*[–-]\s*\d{1,3}(?:\.\d{3})+)?\s*€|(?:€|\$|£)\s*\d+(?:[.,]\d+)?\s*[KMBkmb]?\+?|\b\d+(?:[.,]\d+)?\s*[KMBkmb]?\+?\s*(?:€|EUR|USD|GBP|CHF)\b|\b\d+\+\s*(?:documented\s+processes|processes|dokumentierte\s+Prozesse|procesos\s+documentados|markets|Märkte|mercados|teams|clients|projects)\b)/gi;

export function renderRichText(text: string, autoHighlightMetrics = true, maxBolds = 2): React.ReactNode {
  if (!text) return null;
  const cleaned = text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
    .replace(
      /\b(interact|work|operate|function|collaborate|integrate|scale|execute)\s+and\s+(efficiently|effectively|reliably|accurately|securely|smoothly)\b/gi,
      "$1 $2"
    );

  const hasExplicitBold = cleaned.includes("**");
  if (!autoHighlightMetrics && !hasExplicitBold && !/\*[^*]+\*/.test(cleaned)) {
    return cleaned;
  }

  let boldCount = 0;
  let key = 0;
  const strong = (content: React.ReactNode): React.ReactNode => {
    boldCount++;
    return boldCount <= maxBolds
      ? <strong key={key++} style={{ fontWeight: 700, color: "inherit" }}>{content}</strong>
      : <React.Fragment key={key++}>{content}</React.Fragment>;
  };
  const plain = (content: string): React.ReactNode => {
    // Explicit emphasis keeps control of bolding, as before. Use a fresh regex
    // for each segment so italic parsing cannot leak global lastIndex state.
    if (hasExplicitBold || !autoHighlightMetrics) return content;
    const matcher = new RegExp(METRIC_REGEX.source, "gi");
    return content.split(matcher).map((part) => {
      matcher.lastIndex = 0;
      return matcher.test(part) ? strong(part) : <React.Fragment key={key++}>{part}</React.Fragment>;
    });
  };
  function closingMarker(content: string, start: number, marker: string): number {
    let italicOpen = false;
    for (let index = start; index < content.length; index++) {
      if (content[index] !== "*") continue;
      if (marker === "***" && content.startsWith("***", index)) return index;
      if (marker === "**") {
        if (content.startsWith("***", index) && italicOpen) return index + 1;
        if (content.startsWith("**", index)) return index;
        italicOpen = !italicOpen;
      } else if (marker === "*") {
        if (content.startsWith("**", index)) {
          const nestedEnd = closingMarker(content, index + 2, "**");
          if (nestedEnd !== -1) index = nestedEnd + 1;
          else index++;
        } else return index;
      }
    }
    return -1;
  }
  function inline(content: string): React.ReactNode {
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    let plainStart = 0;
    while (cursor < content.length) {
      if (content[cursor] !== "*") { cursor++; continue; }
      const marker = content.startsWith("***", cursor) ? "***" : content.startsWith("**", cursor) ? "**" : "*";
      const end = closingMarker(content, cursor + marker.length, marker);
      if (end <= cursor + marker.length) { cursor += marker.length; continue; }
      if (cursor > plainStart) nodes.push(<React.Fragment key={key++}>{plain(content.slice(plainStart, cursor))}</React.Fragment>);
      const inner = inline(content.slice(cursor + marker.length, end));
      const emphasized = marker.length === 1 || marker.length === 3 ? <em key={key++}>{inner}</em> : inner;
      nodes.push(marker.length >= 2 ? strong(emphasized) : emphasized);
      cursor = end + marker.length;
      plainStart = cursor;
    }
    if (plainStart < content.length) nodes.push(<React.Fragment key={key++}>{plain(content.slice(plainStart))}</React.Fragment>);
    return nodes;
  }
  return inline(cleaned);
}
