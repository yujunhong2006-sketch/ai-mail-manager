import { Hono } from "hono";
import { z } from "zod";
import { readFile, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { getEnv, googleOAuthConfigStatus } from "@miel/core";
import { closeDb } from "@miel/core";
export const localSetupRoutes = new Hono();
localSetupRoutes.use("*", async (c, next) => {
  if (process.env.DATABASE_DRIVER !== "local") return c.json({ error: "not_found" }, 404);
  return next();
});
localSetupRoutes.get("/", (c) => c.json({ configured: googleOAuthConfigStatus().configured }));
localSetupRoutes.post("/stop", (c) => {
  setTimeout(() => { void closeDb().finally(() => process.exit(0)); }, 150);
  return c.json({ ok: true });
});
localSetupRoutes.post("/google", async (c) => {
  const body = z.object({ clientId: z.string().regex(/^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/), clientSecret: z.string().min(8).max(500).regex(/^[A-Za-z0-9_-]+$/) }).strict().parse(await c.req.json());
  const file = resolve(import.meta.dir, "../../../../.env");
  let text = await readFile(file, "utf8");
  const fields = { GOOGLE_CLIENT_ID: body.clientId, GOOGLE_CLIENT_SECRET: body.clientSecret };
  for (const [key, value] of Object.entries(fields)) {
    const pattern = new RegExp("^" + key + "=.*$", "m");
    text = pattern.test(text) ? text.replace(pattern, key + "=" + value) : text + "\n" + key + "=" + value;
  }
  await writeFile(file + ".tmp", text, { mode: 0o600 });
  await rename(file + ".tmp", file);
  Object.assign(process.env, fields);
  Object.assign(getEnv(), fields);
  return c.json({ ok: true });
});
