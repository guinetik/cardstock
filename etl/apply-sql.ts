/**
 * Run a multi-statement SQL file against SUPABASE_DB_URL — e.g. a project's seed kept next to its tracker.
 *
 *   bun run db:apply --file path/to/seed.sql
 *
 * `supabase db query` only accepts a single statement; this runs the file as one script inside a transaction.
 */
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { arg } from "./db";

const file = arg("file");
const url = process.env.SUPABASE_DB_URL;
if (!url) throw new Error("SUPABASE_DB_URL is required (see .env.example)");

const sql = postgres(url, { max: 1, onnotice: () => {} });
const text = await readFile(file, "utf8");
try {
  await sql.begin(async (tx) => {
    await tx.unsafe(text);
  });
  console.log(`applied ${file}`);
} finally {
  await sql.end();
}
