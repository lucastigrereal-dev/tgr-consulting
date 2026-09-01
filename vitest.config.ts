import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    // Database integration files share one explicitly ephemeral schema. Running
    // files concurrently lets one suite clean rows while another is writing.
    fileParallelism: false,
    include: ["server/**/*.test.ts", "server/**/*.spec.ts", "shared/**/*.test.ts", "shared/**/*.spec.ts", "client/src/*.test.ts", "client/src/lib/**/*.test.ts", "client/src/lib/**/*.spec.ts", "client/src/components/**/*.test.tsx", "client/src/components/**/*.spec.tsx", "client/src/pages/**/*.test.tsx", "client/src/pages/**/*.spec.tsx"],
  },
});
