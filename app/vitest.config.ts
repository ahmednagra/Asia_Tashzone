import { defineConfig } from "vitest/config";
// Pure TypeScript tests only (design tokens, table logic); React Native screens are checked by typecheck and device QA.
export default defineConfig({ test: { include: ["src/**/*.test.ts"], testTimeout: 60000 } });
