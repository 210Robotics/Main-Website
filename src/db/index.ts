import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;
let database: Database | null = null;

export function getDb(): Database {
  if (database) return database;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }
  database = drizzle(neon(connectionString), { schema });
  return database;
}

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}
