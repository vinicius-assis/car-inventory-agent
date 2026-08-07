import fs from "node:fs/promises";
import path from "node:path";

export interface GeneratedFileStore {
  write(relativePath: string, content: string): Promise<void>;
  read(relativePath: string): Promise<string>;
  has(relativePath: string): Promise<boolean>;
}

export function createFileStore(rootDir: string): GeneratedFileStore {
  return {
    async write(relativePath, content) {
      const target = path.join(rootDir, relativePath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, "utf-8");
    },
    async read(relativePath) {
      return fs.readFile(path.join(rootDir, relativePath), "utf-8");
    },
    async has(relativePath) {
      try {
        await fs.access(path.join(rootDir, relativePath));
        return true;
      } catch {
        return false;
      }
    },
  };
}

const EXCLUDED_TOP_LEVEL = new Set(["node_modules", ".git", "agent", "docs", "generated-app", "take-home.pdf"]);

const PLACEHOLDER_FILES = ["src/components/Example.tsx", "src/__tests__/Example.test.tsx"];

export async function copyBoilerplate(srcDir: string, destDir: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });

  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED_TOP_LEVEL.has(entry.name)) continue;
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    await fs.cp(srcPath, destPath, { recursive: true });
  }

  for (const relPath of PLACEHOLDER_FILES) {
    await fs.rm(path.join(destDir, relPath), { force: true });
  }
}
