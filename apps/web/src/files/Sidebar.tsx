import type { DriveInfo } from "../api/types";
import { formatBytes } from "../format";
import { useI18n } from "../i18n/I18nProvider";
import type { View } from "./useBrowser";

interface SidebarProps {
  readonly drives: readonly DriveInfo[];
  readonly selectedId: string | null;
  readonly view: View;
  readonly onSelect: (id: string) => void;
  readonly onTrash: () => void;
}

function usage(drive: DriveInfo, locale: string, t: ReturnType<typeof useI18n>["t"]): string {
  const used = formatBytes(drive.usedBytes, locale);
  if (drive.quotaBytes === null) return t("used", { used });
  return t("usedOf", { used, total: formatBytes(drive.quotaBytes, locale) });
}

export function Sidebar({ drives, selectedId, view, onSelect, onTrash }: SidebarProps) {
  const { t, language } = useI18n();
  return (
    <nav className="sidebar" aria-label={t("drives")}>
      <ul>
        {drives.map((drive) => (
          <li key={drive.id}>
            <button
              type="button"
              className="nav-item"
              aria-current={drive.id === selectedId && view === "files" ? "page" : undefined}
              onClick={() => onSelect(drive.id)}
            >
              <span>{drive.kind === "personal" ? t("myDrive") : drive.name}</span>
              <small>{usage(drive, language, t)}</small>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="nav-item"
        aria-current={view === "trash" ? "page" : undefined}
        onClick={onTrash}
      >
        {t("trash")}
      </button>
    </nav>
  );
}
