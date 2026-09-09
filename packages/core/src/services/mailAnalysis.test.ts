import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { TriageOutputItem } from "../schemas/triage";
import { normalizeMailAnalysis } from "./mailAnalysis";
import { sendReplyEffect } from "./reply";
const base = {
  id: "mail",
  priority: "low" as const,
  reasoning: "Routine notification",
  applyExistingLabels: [],
  suggestNewLabels: [],
};
describe("mail manager analysis", () => {
  test("legacy low priority stays Normal, explicit spam enters quarantine", () => {
    expect(normalizeMailAnalysis(base).category).toBe("Normal");
    expect(normalizeMailAnalysis({ ...base, category: "Junk" }).category).toBe("Junk");
    expect(normalizeMailAnalysis({ ...base, priority: "high" }).category).toBe("Important");
  });
  test("missing and impossible deadlines remain unknown", () => {
    expect(normalizeMailAnalysis(base).deadline).toBeNull();
    expect(normalizeMailAnalysis({ ...base, deadline: "2026-02-30" }).deadline).toBeNull();
    expect(normalizeMailAnalysis({ ...base, deadline: "2026-09-15" }).deadline).toBe("2026-09-15");
  });
  test("rejects invalid classifications and preserves old output compatibility", () => {
    expect(TriageOutputItem.safeParse(base).success).toBe(true);
    expect(TriageOutputItem.safeParse({ ...base, category: "delete" }).success).toBe(false);
  });
  test("default send policy fails before looking up an account or contacting Gmail", async () => {
    const previous = process.env.ALLOW_EMAIL_SEND;
    delete process.env.ALLOW_EMAIL_SEND;
    try {
      await expect(
        Effect.runPromise(
          sendReplyEffect({
            accountId: "missing",
            gmailMessageId: "mail",
            subject: "test",
            body: "test",
          }),
        ),
      ).rejects.toThrow("Sending is disabled");
    } finally {
      if (previous === undefined) delete process.env.ALLOW_EMAIL_SEND;
      else process.env.ALLOW_EMAIL_SEND = previous;
    }
  });
});
