

/**
 * Cleans LLM-generated JSON text before parsing:
 * - Strips UTF-8 BOM and surrounding whitespace
 * - Extracts payload from ```json ... ``` or ``` ... ``` markdown code fences
 * - Slices out leading/trailing conversational chatter outside the outermost { ... }
 * - Removes trailing commas before } or ] outside JSON string literals
 */
export function cleanAIJsonText(rawText: string): string {
  if (!rawText || typeof rawText !== "string") return "";

  let text = rawText.replace(/^\uFEFF/, "").trim();

  // Extract fenced block if present (preferring ```json blocks)
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch && fencedMatch[1] && fencedMatch[1].includes("{")) {
    text = fencedMatch[1].trim();
  } else {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }

  // Extract outermost JSON object if conversational text wraps it
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  // Remove trailing commas outside string literals: e.g. { "a": 1, } -> { "a": 1 }
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === ",") {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (j < text.length && (text[j] === "}" || text[j] === "]")) {
        // Skip trailing comma
        continue;
      }
    }

    out += ch;
  }

  return out.trim();
}

/**
 * Parses LLM-generated JSON tolerantly by trying strict JSON.parse first
 * and falling back to cleanAIJsonText sanitization.
 */
export function parseLooseAIJson<T = any>(rawText: string): { data: T; cleanedText: string } {
  const trimmed = (rawText || "").replace(/^\uFEFF/, "").trim();
  if (!trimmed) {
    throw new Error("Empty JSON input.");
  }
  try {
    return { data: JSON.parse(trimmed) as T, cleanedText: trimmed };
  } catch {
    const cleaned = cleanAIJsonText(trimmed);
    return { data: JSON.parse(cleaned) as T, cleanedText: cleaned };
  }
}
