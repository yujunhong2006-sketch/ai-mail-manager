import { PGlite } from "@electric-sql/pglite";
import { drizzle as localDrizzle } from "drizzle-orm/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "../env";
import { createDebug } from "../util/debug";
import * as schema from "./schema";

const debug = createDebug("db");

let cachedSql: ReturnType<typeof postgres> | null = null;
let cachedLocal: PGlite | null = null;
let cachedDb: PgDatabase<PgQueryResultHKT, typeof schema> | null = null;
export function getLocalDatabase() {
  if (!cachedLocal) cachedLocal = new PGlite(process.env.LOCAL_DATABASE_PATH ?? "./local-data/mail-db");
  return cachedLocal;
}

function redactConnectionString(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "(unparseable)";
  }
}

export function getDb() {
  if (cachedDb) return { db: cachedDb, sql: cachedSql };
  if (process.env.DATABASE_DRIVER === "local") {
    cachedDb = localDrizzle(getLocalDatabase(), { schema });
    return { db: cachedDb, sql: null };
  }
  const { DATABASE_URL } = getEnv();
  debug("connect", { url: redactConnectionString(DATABASE_URL) });
  cachedSql = postgres(DATABASE_URL);
  cachedDb = drizzle(cachedSql, { schema });
  return { db: cachedDb, sql: cachedSql };
}

export async function closeDb(): Promise<void> {
  if (cachedLocal) { await cachedLocal.close(); cachedLocal = null; cachedDb = null; }
  if (cachedSql) {
    debug("close");
    await cachedSql.end({ timeout: 5 });
    cachedSql = null;
    cachedDb = null;
  }
}

export type Db = ReturnType<typeof getDb>["db"];
