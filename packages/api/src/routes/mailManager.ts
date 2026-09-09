import { Hono } from "hono";
import { z } from "zod";
import {
  listManagedMail,
  analyzeManagedMail,
  updateManagedMail,
  draftManagedReply,
} from "@miel/core";
export const mailManagerRoutes = new Hono();
const Ref = z.object({ accountId: z.string().uuid(), gmailMessageId: z.string().min(1).max(200) });
mailManagerRoutes.get("/", async (c) => {
  const account = z.string().uuid().optional().parse(c.req.query("account"));
  return c.json(await listManagedMail(account));
});
mailManagerRoutes.post("/:accountId/:gmailMessageId/analyze", async (c) => {
  const result = await analyzeManagedMail(Ref.parse(c.req.param()));
  return result ? c.json(result) : c.json({ error: "message_not_found" }, 404);
});
mailManagerRoutes.post("/:accountId/:gmailMessageId/update", async (c) => {
  const patch = z
    .object({
      category: z.enum(["Important", "Normal", "Junk"]).optional(),
      completed: z.boolean().optional(),
    })
    .strict()
    .parse(await c.req.json());
  const ok = await updateManagedMail(Ref.parse(c.req.param()), patch);
  return ok ? c.json({ ok }) : c.json({ error: "Analyze this message first" }, 404);
});
mailManagerRoutes.post("/:accountId/:gmailMessageId/draft", async (c) => {
  const result = await draftManagedReply(Ref.parse(c.req.param()));
  return result ? c.json(result) : c.json({ error: "Analyze this message first" }, 404);
});
