import { FolderOpen, HeartPulse, RotateCcw, ScanSearch, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { IconActionButton, StatusPill } from "@muse-egg/ui";
import type { OCFolderIndexSnapshot, OCIdentityTestReport, OCPack, OCPackBackupEntry, OCPackHealthReport } from "@muse-egg/oc-schema";
import { museEggApi } from "../api";
import { useI18n } from "../i18n";

export interface HealthCenterProps {
  pack: OCPack;
  onChange(pack: OCPack): void;
}

export function HealthCenter({ pack, onChange }: HealthCenterProps) {
  const { t } = useI18n();
  const [health, setHealth] = useState<OCPackHealthReport>();
  const [identity, setIdentity] = useState<OCIdentityTestReport>();
  const [folderIndex, setFolderIndex] = useState<OCFolderIndexSnapshot>();
  const [backups, setBackups] = useState<OCPackBackupEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    try {
      const [nextHealth, nextIndex, nextBackups] = await Promise.all([
        museEggApi.getPackHealth(),
        museEggApi.scanFolderIndex(),
        museEggApi.listBackups()
      ]);
      setHealth(nextHealth);
      setIdentity(nextHealth.identity);
      setFolderIndex(nextIndex);
      setBackups(nextBackups);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [pack.manifest.id, pack.path]);

  const runIdentity = async () => {
    setBusy(true);
    try {
      setIdentity(await museEggApi.runIdentityTests());
    } finally {
      setBusy(false);
    }
  };

  const restore = async (backup: OCPackBackupEntry) => {
    if (!window.confirm(t("health.restoreConfirm", { id: backup.id }))) {
      return;
    }
    const restored = await museEggApi.restoreBackup(backup.id);
    onChange(restored);
    await refresh();
  };

  return (
    <div className="health-center">
      <section className="growth-card">
        <div className="growth-card-head">
          <HeartPulse size={17} />
          <div>
            <strong>{t("health.packHealth")}</strong>
            <span>{t("health.packHealthDetail")}</span>
          </div>
        </div>
        <div className="health-summary">
          <StatusPill tone={health?.ok ? "green" : "amber"}>{health ? `${health.score}/100` : t("state.checkNeeded")}</StatusPill>
          <span>{health ? t("health.issueCount", { count: health.issues.length }) : t("health.notChecked")}</span>
          <IconActionButton showLabel icon={<ScanSearch size={15} />} label={busy ? t("health.checking") : t("health.recheck")} onClick={() => void refresh()} />
        </div>
        <IssueList issues={health?.issues ?? []} />
      </section>

      <section className="growth-card">
        <div className="growth-card-head">
          <ShieldCheck size={17} />
          <div>
            <strong>{t("health.identityTests")}</strong>
            <span>{t("health.identityDetail")}</span>
          </div>
        </div>
        <div className="health-summary">
          <StatusPill tone={identity?.ok ? "green" : "rose"}>
            {identity ? `${identity.passed}/${identity.passed + identity.failed}` : t("state.checkNeeded")}
          </StatusPill>
          <IconActionButton showLabel icon={<ScanSearch size={15} />} label={t("health.runIdentity")} onClick={() => void runIdentity()} />
        </div>
        <div className="identity-results">
          {(identity?.results ?? []).map((result) => (
            <article key={result.caseId}>
              <strong>{result.prompt}</strong>
              <span>{result.responseText}</span>
              <StatusPill tone={result.passed ? "green" : "rose"}>{result.passed ? t("health.pass") : t("health.fail")}</StatusPill>
            </article>
          ))}
        </div>
      </section>

      <section className="growth-card">
        <div className="growth-card-head">
          <FolderOpen size={17} />
          <div>
            <strong>{t("health.fixedFolders")}</strong>
            <span>{t("health.fixedFoldersDetail")}</span>
          </div>
        </div>
        <div className="health-summary">
          <StatusPill tone="cyan">{t("health.folderCount", { count: folderIndex?.roots.length ?? 0 })}</StatusPill>
          <StatusPill tone={folderIndex?.truncated ? "amber" : "green"}>{t("health.indexCount", { count: folderIndex?.items.length ?? 0 })}</StatusPill>
        </div>
        <ul className="health-folder-list">
          {(folderIndex?.roots ?? (pack.path ? [pack.path] : [])).map((root) => <li key={root}>{root}</li>)}
        </ul>
      </section>

      <section className="growth-card">
        <div className="growth-card-head">
          <RotateCcw size={17} />
          <div>
            <strong>{t("health.backups")}</strong>
            <span>{t("health.backupsDetail")}</span>
          </div>
        </div>
        <div className="backup-list">
          {backups.length === 0 ? (
            <p className="empty-line">{t("health.noBackups")}</p>
          ) : (
            backups.slice(0, 8).map((backup) => (
              <article key={backup.id}>
                <div>
                  <strong>{backup.id}</strong>
                  <span>{backup.files.length} files</span>
                </div>
                <IconActionButton showLabel icon={<RotateCcw size={15} />} label={t("health.restore")} onClick={() => void restore(backup)} />
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function IssueList({ issues }: { issues: OCPackHealthReport["issues"] }) {
  if (issues.length === 0) {
    return <p className="empty-line">OK</p>;
  }
  return (
    <ul className="issue-list">
      {issues.slice(0, 12).map((issue) => (
        <li key={`${issue.path}:${issue.message}`}>
          <code>{issue.path}</code>
          <span>{issue.message}</span>
        </li>
      ))}
    </ul>
  );
}
