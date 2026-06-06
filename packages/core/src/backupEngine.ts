import { cp, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { OCPackBackupEntry } from "@muse-egg/oc-schema";

const restorableFiles = [
  "manifest.json",
  "profile.json",
  "lore.json",
  "memories.json",
  "guard-rules.json",
  "reaction-rules.json",
  "awakening-rules.json",
  "autonomy.json",
  "asset-bindings.json",
  "model-routing.json",
  "memory-store.json",
  "self-growth.json",
  "growth-proposals.json",
  "life-state.json",
  "companion.json",
  "runtime.json"
];

export async function listPackBackups(packPath: string): Promise<OCPackBackupEntry[]> {
  const root = join(packPath, ".museegg", "backups");
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const backups = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const path = join(root, entry.name);
        const files = await listFiles(path);
        return {
          id: entry.name,
          path,
          createdAt: backupStampToIso(entry.name),
          files
        } satisfies OCPackBackupEntry;
      })
  );
  return backups.sort((a, b) => b.id.localeCompare(a.id));
}

export async function restorePackBackup(packPath: string, backupId: string): Promise<void> {
  const backupPath = join(packPath, ".museegg", "backups", backupId);
  await stat(backupPath);
  for (const file of restorableFiles) {
    try {
      await cp(join(backupPath, file), join(packPath, file), { force: true });
    } catch {
      // Optional files may not exist in older backups.
    }
  }
  try {
    await cp(join(backupPath, "prompts"), join(packPath, "prompts"), { recursive: true, force: true });
  } catch {
    // Prompt backup is optional for very old snapshots.
  }
}

async function listFiles(path: string): Promise<string[]> {
  try {
    return (await readdir(path, { withFileTypes: true })).map((entry) => entry.name).sort();
  } catch {
    return [];
  }
}

function backupStampToIso(stamp: string): string {
  if (!/^\d{14}$/u.test(stamp)) {
    return new Date(0).toISOString();
  }
  return `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(8, 10)}:${stamp.slice(10, 12)}:${stamp.slice(12, 14)}.000Z`;
}
