import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { resolveLocalStoragePath, storagePut } from "./storage";

const created: string[] = [];

afterEach(async () => {
  ENV.storageDriver = "forge";
  ENV.storageLocalDir = "";
  await Promise.all(created.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe("staging filesystem storage", () => {
  it("persiste export no volume configurado sem escapar da raiz", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "tgr-storage-"));
    created.push(directory);
    ENV.storageDriver = "filesystem";
    ENV.storageLocalDir = directory;

    const stored = await storagePut("igr/7/exports/study.pdf", Buffer.from("pdf"), "application/pdf");
    const filePath = resolveLocalStoragePath(stored.key, directory);

    expect(await readFile(filePath, "utf8")).toBe("pdf");
    expect(stored.url).toBe(`/manus-storage/${stored.key}`);
    expect(() => resolveLocalStoragePath("../../secret", directory)).toThrow("Storage key inválida");
  });
});
