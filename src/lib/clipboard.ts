/**
 * Copies exactly `text` and reports the real outcome. Success is only claimed after
 * the browser confirms it; otherwise callers offer the text for manual selection.
 */
export type CopyOutcome = "copied" | "failed";

function legacyCopy(text: string): boolean {
  if (typeof document === "undefined" || typeof document.execCommand !== "function") return false;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  area.select();
  let copied = false;
  try { copied = document.execCommand("copy"); } catch { copied = false; }
  document.body.removeChild(area);
  previous?.focus();
  return copied;
}

export async function copyText(text: string): Promise<CopyOutcome> {
  const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
  if (clipboard && typeof clipboard.writeText === "function") {
    try {
      await clipboard.writeText(text);
      return "copied";
    } catch {
      // Permission denied or cancelled: try the legacy path, then manual selection.
    }
  }
  return legacyCopy(text) ? "copied" : "failed";
}
