import type { Express } from "express";
import { ENV } from "./env";
import { redactErrorForLog, sdk } from "./sdk";
import { resolveLocalStoragePath } from "../storage";
import path from "node:path";

function getStorageKey(params: { key?: string | string[] }) {
  return Array.isArray(params.key) ? params.key.join("/") : params.key;
}

function isAuthorizedExportKey(key: string, tenantId: number) {
  const normalized = key.replace(/^\/+/, "");
  return (
    normalized === key &&
    !normalized.includes("..") &&
    normalized.startsWith(`igr/${tenantId}/exports/`)
  );
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*key", async (req, res) => {
    const key = getStorageKey(req.params);
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    let user: Awaited<ReturnType<typeof sdk.authenticateRequest>>;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      res.status(401).send("Authentication required");
      return;
    }

    if (!isAuthorizedExportKey(key, user.id)) {
      res.status(403).send("Storage key not authorized");
      return;
    }

    if (ENV.storageDriver === "filesystem") {
      try {
        const filePath = resolveLocalStoragePath(key);
        const downloadName = path.basename(filePath).replace(/["\r\n]/g, "_");
        res.set("Cache-Control", "no-store");
        res.set("Content-Disposition", `attachment; filename="${downloadName}"`);
        res.sendFile(filePath, error => {
          if (error && !res.headersSent) res.status(404).send("Storage object not found");
        });
      } catch {
        res.status(400).send("Invalid storage key");
      }
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        console.error("[StorageProxy] forge error", {
          status: forgeResp.status,
          keyPrefix: `igr/${user.id}/exports/`,
        });
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", redactErrorForLog(err));
      res.status(502).send("Storage proxy error");
    }
  });
}
