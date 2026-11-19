/** Accepts the priority labels used by both imported JSON and Zod preprocessors. */
export function normalizePriority(value: unknown): "low" | "medium" | "high" | "strategic" {
  const normalized = String(value || "").toLowerCase().trim();
  if (normalized.includes("strategic") || normalized.includes("veryhigh") || normalized.includes("very high") || normalized.includes("very_high")) return "strategic";
  if (normalized.includes("high")) return "high";
  if (normalized.includes("low")) return "low";
  return "medium";
}

export function normalizeRisk(value: unknown): "Low" | "Medium" | "High" {
  const normalized = String(value || "").toLowerCase().trim();
  if (normalized === "low-medium" || normalized === "medium") return "Medium";
  if (normalized.includes("high")) return "High";
  return "Low";
}
