Object.assign(process.env, {
  NODE_ENV: "production",
  APP_ENV: "staging",
  STAGING_SEED_NATAL: "true",
  STAGING_AUTH_USERNAME: "staging-seed-integration",
  STAGING_AUTH_DISPLAY_NAME: "Staging Seed Integration",
});

const { seedStagingNatal } = await import("../server/staging/seed");
const first = await seedStagingNatal();
const second = await seedStagingNatal();

if (first.reused) throw new Error("Primeira execução do seed deveria criar o projeto.");
if (!second.reused) throw new Error("Segunda execução do seed deveria reutilizar o projeto.");
if (first.projectId !== second.projectId)
  throw new Error("Seed repetido mudou o projeto canônico.");
if (first.baselineSnapshotId !== second.baselineSnapshotId)
  throw new Error("Seed repetido mudou o snapshot baseline.");
if (first.scenarioCount !== 2 || second.scenarioCount !== 2)
  throw new Error("Seed não preservou os dois cenários de preço adicionais.");

const receipt = JSON.stringify({
  status: "PASS",
  projectId: first.projectId,
  baselineSnapshotId: first.baselineSnapshotId,
  scenarioCount: first.scenarioCount,
  harmony: first.harmony,
  sourceConflict: first.sourceConflict,
  idempotent: second.reused,
});
process.stdout.write(`${receipt}\n`, () => process.exit(0));
