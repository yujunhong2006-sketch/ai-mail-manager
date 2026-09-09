import { afterEach, expect, test } from "bun:test";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { queryKeys } from "../api/queries";
import { MailManagerPage } from "./MailManagerPage";
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const a = "00000000-0000-4000-8000-000000000001";
const b = "00000000-0000-4000-8000-000000000002";
const base = {
  accountId: a,
  gmailMessageId: "same-id",
  accountEmail: "one@example.com",
  fromEmail: "sender@example.com",
  subject: "Submit form",
  receivedAt: "2026-09-09T12:00:00Z",
  category: "Important",
  summary: "A form is required",
  reasoning: "Your reply is needed",
  suggestedAction: "Submit the form",
  deadline: "2026-09-15",
  topic: "Campus",
  completed: false,
  draftSubject: null,
  draftBody: null,
};
function setup(items: object[]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  qc.setQueryData(queryKeys.accounts, [
    { id: a, email: "one@example.com" },
    { id: b, email: "two@example.com" },
  ]);
  qc.setQueryData(["mail-manager", ""], { items, truncated: false });
  const requests: { url: string; body: string }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), body: String(init?.body ?? "") });
    return Response.json(init?.method === "POST" ? { ok: true } : { items, truncated: false });
  }) as typeof fetch;
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MailManagerPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return requests;
}
test("action completion is scoped to the correct Gmail account", async () => {
  const requests = setup([
    base,
    { ...base, accountId: b, accountEmail: "two@example.com", subject: "Second form" },
  ]);
  fireEvent.click(screen.getByRole("checkbox", { name: "Complete action: Second form" }));
  await waitFor(() =>
    expect(
      requests.some(
        (r) => r.url.includes(b + "/same-id/update") && r.body.includes('"completed":true'),
      ),
    ).toBe(true),
  );
});
test("quarantined mail can be restored without a Gmail delete call", async () => {
  const requests = setup([{ ...base, category: "Junk", subject: "Promotion" }]);
  fireEvent.click(screen.getByRole("button", { name: /Quarantine/ }));
  fireEvent.click(screen.getByRole("button", { name: "Promotion" }));
  fireEvent.change(screen.getByLabelText("Move to"), { target: { value: "Normal" } });
  await waitFor(() =>
    expect(requests.some((r) => r.body.includes('"category":"Normal"'))).toBe(true),
  );
  expect(requests.every((r) => !r.url.includes("/messages/"))).toBe(true);
});
test("normal digest groups summaries and shows source accounts", () => {
  setup([
    { ...base, category: "Normal", summary: "Package arrives tomorrow", topic: "Deliveries" },
  ]);
  fireEvent.click(screen.getByRole("button", { name: /Normal/ }));
  expect(screen.getByText("Deliveries · 1")).toBeDefined();
  expect(screen.getAllByText("Package arrives tomorrow").length).toBeGreaterThan(0);
});
test("draft generation never calls the sending endpoint", async () => {
  const requests = setup([base]);
  fireEvent.click(screen.getByRole("button", { name: "Submit form" }));
  fireEvent.click(screen.getByRole("button", { name: "Generate reply draft" }));
  await waitFor(() => expect(requests.some((r) => r.url.endsWith("/draft"))).toBe(true));
  expect(requests.some((r) => r.url.includes("send"))).toBe(false);
});
