import { test, expect } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb } from "./client";
import { runMigrations } from "./migrate";
import { accounts } from "./schema";

test("local workbench migrates without a server and persists across reopen", async () => {
  const previousDriver = process.env.DATABASE_DRIVER;
  const previousPath = process.env.LOCAL_DATABASE_PATH;
  const folder = await mkdtemp(join(tmpdir(), "mail-local-test-"));
  await closeDb();
  process.env.DATABASE_DRIVER = "local";
  process.env.LOCAL_DATABASE_PATH = join(folder, "database");
  try {
    await runMigrations();
    await getDb().db.insert(accounts).values({ email: "local-test@example.invalid" });
    await closeDb();
    await runMigrations();
    const rows = await getDb().db.select({ email: accounts.email }).from(accounts);
    expect(rows).toEqual([{ email: "local-test@example.invalid" }]);
  } finally {
    await closeDb();
    if (previousDriver === undefined) delete process.env.DATABASE_DRIVER;
    else process.env.DATABASE_DRIVER = previousDriver;
    if (previousPath === undefined) delete process.env.LOCAL_DATABASE_PATH;
    else process.env.LOCAL_DATABASE_PATH = previousPath;
  }
});
