import { defineConfig } from "vitest/config";

// This is a Node.js CLI package (no browser/jsdom code), and without an
// explicit config here Vitest walks up to the repo-root `vitest.config.ts`
// (a Vite/React app) and inherits its `environment: "jsdom"` setting. That
// makes SDK clients (e.g. @anthropic-ai/sdk, openai) think they're running
// in a browser and refuse to construct. Pin the Node environment explicitly.
export default defineConfig({
  test: {
    environment: "node",
  },
});
