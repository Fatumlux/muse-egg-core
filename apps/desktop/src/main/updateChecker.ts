import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export interface AppUpdateStatus {
  enabled: boolean;
  currentVersion: string;
  latestVersion?: string;
  updateAvailable: boolean;
  url?: string;
  notes?: string;
  checkedAt: string;
  error?: string;
}

interface PackageMetadata {
  version?: string;
  museEgg?: {
    updateCheckUrl?: string;
  };
}

interface ReleaseManifest {
  version?: unknown;
  latestVersion?: unknown;
  url?: unknown;
  html_url?: unknown;
  tag_name?: unknown;
  body?: unknown;
  notes?: unknown;
}

export async function checkForAppUpdates(workspaceRoot: string): Promise<AppUpdateStatus> {
  const checkedAt = new Date().toISOString();
  const packageJson = await readPackageJson(workspaceRoot);
  const currentVersion = normalizeVersion(packageJson.version ?? "0.1.0");
  const updateUrl = updateCheckUrl(packageJson);

  if (!updateUrl) {
    return {
      enabled: false,
      currentVersion,
      updateAvailable: false,
      checkedAt
    };
  }

  try {
    const manifest = await fetchReleaseManifest(updateUrl);
    const latestVersion = normalizeVersion(
      stringValue(manifest.latestVersion) ?? stringValue(manifest.version) ?? stringValue(manifest.tag_name) ?? currentVersion
    );
    const url = stringValue(manifest.url) ?? stringValue(manifest.html_url);
    const notes = truncateNotes(stringValue(manifest.notes) ?? stringValue(manifest.body));

    return {
      enabled: true,
      currentVersion,
      latestVersion,
      updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
      url,
      notes,
      checkedAt
    };
  } catch (error) {
    if (error instanceof NoReleaseYetError) {
      return {
        enabled: true,
        currentVersion,
        latestVersion: currentVersion,
        updateAvailable: false,
        checkedAt
      };
    }
    return {
      enabled: true,
      currentVersion,
      updateAvailable: false,
      checkedAt,
      error: error instanceof Error ? error.message : "Update check failed."
    };
  }
}

function updateCheckUrl(packageJson: PackageMetadata): string | undefined {
  const envUrl = process.env.MUSEEGG_UPDATE_CHECK_URL?.trim();
  if (envUrl) {
    return envUrl;
  }

  const envRepo = process.env.MUSEEGG_UPDATE_REPO?.trim();
  if (envRepo && /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/iu.test(envRepo)) {
    return `https://api.github.com/repos/${envRepo}/releases/latest`;
  }

  const packageUrl = packageJson.museEgg?.updateCheckUrl?.trim();
  return packageUrl && /^https:\/\//iu.test(packageUrl) ? packageUrl : undefined;
}

async function readPackageJson(workspaceRoot: string): Promise<PackageMetadata> {
  const candidates = [
    join(workspaceRoot, "package.json"),
    join(resolve(workspaceRoot, "../.."), "package.json"),
    join(dirname(workspaceRoot), "package.json")
  ];

  for (const candidate of candidates) {
    try {
      return JSON.parse(await readFile(candidate, "utf8")) as PackageMetadata;
    } catch {
      // Try the next likely workspace root.
    }
  }
  return {};
}

async function fetchReleaseManifest(url: string): Promise<ReleaseManifest> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "MuseEgg-Core/0.1"
    }
  });
  if (response.status === 404 && /api\.github\.com\/repos\/[^/]+\/[^/]+\/releases\/latest/iu.test(url)) {
    throw new NoReleaseYetError();
  }
  if (!response.ok) {
    throw new Error(`Update endpoint returned HTTP ${response.status}.`);
  }

  const text = await response.text();
  if (text.length > 256 * 1024) {
    throw new Error("Update manifest is too large.");
  }
  return JSON.parse(text) as ReleaseManifest;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/iu, "");
}

function compareVersions(left: string, right: string): number {
  const a = normalizeVersion(left).split(/[.-]/g);
  const b = normalizeVersion(right).split(/[.-]/g);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = a[index] ?? "0";
    const rightPart = b[index] ?? "0";
    const leftNumber = Number(leftPart);
    const rightNumber = Number(rightPart);
    const diff =
      Number.isFinite(leftNumber) && Number.isFinite(rightNumber)
        ? leftNumber - rightNumber
        : leftPart.localeCompare(rightPart);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

function truncateNotes(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.length > 500 ? `${value.slice(0, 500)}...` : value;
}

class NoReleaseYetError extends Error {}
