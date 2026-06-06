import { readdir, stat } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import type { OCFolderIndexItem, OCFolderIndexSnapshot, OCPack, OCValidationIssue } from "@muse-egg/oc-schema";
import { RuntimeContextEngine } from "./runtimeContextEngine.js";
import { nowIso } from "./utils.js";

export class FolderIndexEngine {
  private readonly runtime: RuntimeContextEngine;

  constructor(private readonly pack: OCPack) {
    this.runtime = new RuntimeContextEngine(pack);
  }

  async scan(): Promise<OCFolderIndexSnapshot> {
    const settings = this.runtime.settings().folderIndex;
    const issues: OCValidationIssue[] = [];
    const items: OCFolderIndexItem[] = [];
    if (!settings.enabled) {
      return { generatedAt: nowIso(), roots: [], items, truncated: false, issues };
    }

    const roots = this.installedRoots(issues);
    for (const root of roots) {
      await this.scanRoot(root, root, items, issues);
      if (items.length >= settings.maxFiles) {
        break;
      }
    }

    return {
      generatedAt: nowIso(),
      roots,
      items: items.slice(0, settings.maxFiles),
      truncated: items.length > settings.maxFiles,
      issues
    };
  }

  private async scanRoot(root: string, current: string, items: OCFolderIndexItem[], issues: OCValidationIssue[]): Promise<void> {
    const settings = this.runtime.settings().folderIndex;
    if (items.length >= settings.maxFiles || shouldExclude(current, settings.excludePatterns)) {
      return;
    }

    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      issues.push({ path: current, message: error instanceof Error ? error.message : "資料夾無法讀取。" });
      return;
    }

    for (const entry of entries) {
      const path = join(current, entry.name);
      if (items.length >= settings.maxFiles || shouldExclude(path, settings.excludePatterns)) {
        break;
      }
      if (entry.isDirectory()) {
        await this.scanRoot(root, path, items, issues);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const extension = extname(entry.name).toLowerCase();
      if (settings.includeExtensions.length > 0 && !settings.includeExtensions.includes(extension)) {
        continue;
      }
      try {
        const info = await stat(path);
        items.push({
          path,
          name: basename(path),
          extension,
          size: info.size,
          modifiedAt: info.mtime.toISOString(),
          root
        });
      } catch {
        issues.push({ path, message: "檔案資訊讀取失敗。" });
      }
    }
  }

  private installedRoots(issues: OCValidationIssue[]): string[] {
    if (!this.pack.path) {
      issues.push({ path: "$.path", message: "目前 OC Pack 沒有安裝資料夾，無法建立固定資料夾索引。" });
      return [];
    }
    return [resolve(this.pack.path)];
  }
}

function shouldExclude(path: string, patterns: string[]): boolean {
  const normalized = path.replaceAll("\\", "/").toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern.replaceAll("\\", "/").toLowerCase()));
}
