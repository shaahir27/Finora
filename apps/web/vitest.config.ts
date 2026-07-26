import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Vitest configuration for apps/web.
 *
 * Key requirements:
 * 1. Tests use relative imports from src/ — resolve them with the correct root.
 * 2. "use server" directive is a Next.js server action marker — vitest must ignore it.
 * 3. Workspace packages (@smart-school/db, @smart-school/rules) are mocked by the
 *    individual test files — this config doesn't auto-mock them.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    // Allow each test file to isolate its own mocks
    isolate: true,
    // Resolve the same path alias as tsconfig.json
    alias: [
      { find: "@/auth", replacement: path.resolve(__dirname, "./tests/auth-mock.ts") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
  resolve: {
    alias: [
      { find: "@/auth", replacement: path.resolve(__dirname, "./tests/auth-mock.ts") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
  // Strip Next.js-specific directives ("use server", "use client") before test execution
  plugins: [
    {
      name: "strip-next-directives",
      transform(code: string, id: string) {
        if (id.endsWith(".ts") || id.endsWith(".tsx")) {
          // Remove "use server" and "use client" directives at the top of files
          return code.replace(/^["']use (server|client)["'];\s*\n?/m, "");
        }
      },
    },
  ],
});
