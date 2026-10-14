import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { describeError } from "../api/describe-error";
import type { NodeInfo, VersionInfo } from "../api/types";
import { formatBytes, formatDate } from "../format";
import { useI18n } from "../i18n/I18nProvider";
import { Icon } from "../icons";
import { useToasts } from "../workspace/ToastProvider";
import { startDownload } from "./download";

interface VersionHistoryProps {
  readonly file: NodeInfo;
  /** Called after a version was restored, so the listing can show the new size and date. */
  readonly onRestored: () => void;
}

function useVersions(fileId: string) {
  const [versions, setVersions] = useState<readonly VersionInfo[]>([]);
  const reload = useCallback(() => {
    let current = true;
    api
      .versions(fileId)
      .then((list) => current && setVersions(list))
      .catch(() => current && setVersions([]));
    return () => {
      current = false;
    };
  }, [fileId]);
  useEffect(() => reload(), [reload]);
  return { versions, reload };
}

function useRestore(file: NodeInfo, done: () => void) {
  const { t, language } = useI18n();
  const { push } = useToasts();
  return async (version: VersionInfo) => {
    try {
      await api.restoreVersion(file.id, version.id);
      const date = formatDate(version.createdAt, language);
      push({ kind: "info", message: t("versionRestored", { date }) });
      done();
    } catch (failure) {
      push({ kind: "error", message: describeError(failure, t) });
    }
  };
}

interface EntryProps {
  readonly file: NodeInfo;
  readonly version: VersionInfo;
  readonly onRestore: (version: VersionInfo) => void;
}

function Entry({ file, version, onRestore }: EntryProps) {
  const { t, language } = useI18n();
  const date = formatDate(version.createdAt, language);
  return (
    <li className={version.current ? "version current" : "version"}>
      <div>
        <strong>{date}</strong>
        {version.current && <span className="badge">{t("versionCurrent")}</span>}
        <small>
          {formatBytes(version.size, language)} · {t("versionBy", { name: version.authorName })}
        </small>
      </div>
      <div className="version-actions">
        {file.capabilities.canDownload && (
          <button
            type="button"
            className="icon-only"
            aria-label={t("versionDownload", { date })}
            onClick={() => startDownload(api.versionDownloadUrl(file.id, version.id))}
          >
            <Icon name="download" />
          </button>
        )}
        {file.capabilities.canWrite && !version.current && (
          <button
            type="button"
            className="icon-only"
            aria-label={t("versionRestore", { date })}
            onClick={() => onRestore(version)}
          >
            <Icon name="restore" />
          </button>
        )}
      </div>
    </li>
  );
}

/** The version history of one file: download any version, or make an old one current again. */
export function VersionHistory({ file, onRestored }: VersionHistoryProps) {
  const { t } = useI18n();
  const { versions, reload } = useVersions(file.id);
  const restore = useRestore(file, () => {
    reload();
    onRestored();
  });
  return (
    <section className="versions" aria-label={t("versions")}>
      <h3>{t("versions")}</h3>
      {versions.length <= 1 && <p className="empty">{t("noVersions")}</p>}
      <ul>
        {versions.map((version) => (
          <Entry key={version.id} file={file} version={version} onRestore={restore} />
        ))}
      </ul>
    </section>
  );
}
