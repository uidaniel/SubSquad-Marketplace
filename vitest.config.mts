import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Next compiles JSX itself, so tsconfig says `preserve`; the test runner
  // has to do it here or nothing that imports a .tsx file will load.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
