import "dotenv/config";
import path from "node:path";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { assertProductionConfiguration } from "./_core/env";
import { seedStagingNatal } from "./staging/seed";

async function applyMigrations(databaseUrl: string) {
  const connection = await mysql.createConnection(databaseUrl);
  try {
    await migrate(drizzle(connection), {
      migrationsFolder: path.resolve(process.cwd(), "drizzle"),
    });
  } finally {
    await connection.end();
  }
}

async function startStaging() {
  assertProductionConfiguration();
  const databaseUrl = process.env.DATABASE_URL!;
  await applyMigrations(databaseUrl);
  console.info({
    event: "staging.migrations.applied",
    environment: process.env.APP_ENV,
    gitSha: process.env.GIT_SHA,
  });
  const seed = await seedStagingNatal();
  console.info({
    event: "staging.seed.ready",
    environment: process.env.APP_ENV,
    gitSha: process.env.GIT_SHA,
    projectId: seed.projectId,
    baselineSnapshotId: seed.baselineSnapshotId,
    reused: seed.reused,
    harmony: seed.harmony,
    sourceConflict: seed.sourceConflict,
  });
  await import("./_core/index");
}

startStaging().catch(error => {
  console.error({
    event: "staging.start.failed",
    message: error instanceof Error ? error.message : "Unknown startup error",
  });
  process.exitCode = 1;
});
