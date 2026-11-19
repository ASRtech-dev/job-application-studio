import confetti from "canvas-confetti";

/** Decorative feedback follows the same motion preference as application controls. */
export function celebrate(options: Parameters<typeof confetti>[0]): void {
  if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  void confetti(options);
}
