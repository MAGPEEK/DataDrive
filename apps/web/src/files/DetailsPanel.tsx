import type { NodeInfo } from "../api/types";
import { formatBytes, formatDate } from "../format";
import { useI18n } from "../i18n/I18nProvider";
import { Icon } from "../icons";
import { VersionHistory } from "./VersionHistory";

interface DetailsPanelProps {
  readonly selected: readonly NodeInfo[];
  readonly onClose: () => void;
  readonly onChanged: () => void;
}

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

export function DetailsPanel({ selected, onClose, onChanged }: DetailsPanelProps) {
  const { t, language } = useI18n();
  const [only] = selected;
  return (
    <aside className="details" aria-label={t("details")}>
      <header>
        <h2>{t("details")}</h2>
        <button type="button" className="icon-only" aria-label={t("close")} onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      {selected.length === 0 && <p className="empty">{t("details")}</p>}
      {selected.length > 1 && <p>{t("selectedCount", { count: String(selected.length) })}</p>}
      {selected.length === 1 && only !== undefined && (
        <>
          <h3>{only.name}</h3>
          <dl>
            <Row
              label={t("type")}
              value={only.kind === "folder" ? t("folderType") : t("fileType")}
            />
            {only.kind === "file" && (
              <Row label={t("size")} value={formatBytes(only.size, language)} />
            )}
            <Row label={t("modified")} value={formatDate(only.modifiedAt, language)} />
            <Row label={t("created")} value={formatDate(only.createdAt, language)} />
          </dl>
          {only.kind === "file" && only.trashedAt === null && (
            <VersionHistory key={only.id} file={only} onRestored={onChanged} />
          )}
        </>
      )}
    </aside>
  );
}
