import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createFileStore, copyBoilerplate } from "../tools/fs.js";

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-fs-test-"));
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("createFileStore", () => {
  it("writes and reads a nested file, creating directories as needed", async () => {
    const store = createFileStore(tmpRoot);
    await store.write("src/hooks/useCars.ts", "export const x = 1;");
    expect(await store.read("src/hooks/useCars.ts")).toBe("export const x = 1;");
  });

  it("reports whether a file exists", async () => {
    const store = createFileStore(tmpRoot);
    expect(await store.has("src/App.tsx")).toBe(false);
    await store.write("src/App.tsx", "export {};");
    expect(await store.has("src/App.tsx")).toBe(true);
  });
});

describe("copyBoilerplate", () => {
  async function writeFixture(root: string) {
    await fs.mkdir(path.join(root, "src", "components"), { recursive: true });
    await fs.mkdir(path.join(root, "src", "__tests__"), { recursive: true });
    await fs.mkdir(path.join(root, "node_modules", "some-dep"), { recursive: true });
    await fs.mkdir(path.join(root, "agent"), { recursive: true });
    await fs.writeFile(path.join(root, "package.json"), "{}");
    await fs.writeFile(path.join(root, "take-home.pdf"), "pdf");
    await fs.writeFile(path.join(root, "src", "App.tsx"), "export {};");
    await fs.writeFile(path.join(root, "src", "components", "Example.tsx"), "export {};");
    await fs.writeFile(path.join(root, "src", "__tests__", "Example.test.tsx"), "export {};");
    await fs.writeFile(path.join(root, "node_modules", "some-dep", "index.js"), "module.exports = {};");
    await fs.writeFile(path.join(root, "agent", "index.ts"), "export {};");
  }

  it("copies real project files but excludes node_modules, agent/, and take-home.pdf", async () => {
    const src = path.join(tmpRoot, "src-project");
    const dest = path.join(tmpRoot, "dest-project");
    await fs.mkdir(src, { recursive: true });
    await writeFixture(src);

    await copyBoilerplate(src, dest);

    await expect(fs.access(path.join(dest, "package.json"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "src", "App.tsx"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "node_modules"))).rejects.toThrow();
    await expect(fs.access(path.join(dest, "agent"))).rejects.toThrow();
    await expect(fs.access(path.join(dest, "take-home.pdf"))).rejects.toThrow();
  });

  it("drops the placeholder Example files after copying", async () => {
    const src = path.join(tmpRoot, "src-project-2");
    const dest = path.join(tmpRoot, "dest-project-2");
    await fs.mkdir(src, { recursive: true });
    await writeFixture(src);

    await copyBoilerplate(src, dest);

    await expect(fs.access(path.join(dest, "src", "components", "Example.tsx"))).rejects.toThrow();
    await expect(fs.access(path.join(dest, "src", "__tests__", "Example.test.tsx"))).rejects.toThrow();
  });

  it("copies successfully when dest is nested inside src (e.g. src/generated-app)", async () => {
    const src = path.join(tmpRoot, "src-project-3");
    const dest = path.join(src, "generated-app");
    await fs.mkdir(src, { recursive: true });
    await writeFixture(src);

    await copyBoilerplate(src, dest);

    await expect(fs.access(path.join(dest, "package.json"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "src", "App.tsx"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "node_modules"))).rejects.toThrow();
    await expect(fs.access(path.join(dest, "agent"))).rejects.toThrow();
    // dest must not contain itself
    await expect(fs.access(path.join(dest, "generated-app"))).rejects.toThrow();
  });
});
