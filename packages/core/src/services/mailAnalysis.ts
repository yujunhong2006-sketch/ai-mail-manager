import type { TriageOutputItemT } from "../schemas/triage";

/** Preserve uncertainty and never infer spam from a legacy priority alone. */
export function normalizeMailAnalysis(item: TriageOutputItemT) {
  const date = item.deadline ? new Date(item.deadline + "T00:00:00.000Z") : null;
  const deadline =
    date && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === item.deadline
      ? item.deadline
      : null;
  return {
    category: item.category ?? (item.priority === "high" ? "Important" : "Normal"),
    summary: item.summary?.trim() || "Summary unavailable; analyze again.",
    reasoning: item.reasoning,
    suggestedAction: item.suggestedAction?.trim() || null,
    deadline,
    topic: item.topic?.trim() || "Other",
    updatedAt: new Date(),
  };
}
