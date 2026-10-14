import type { DriveInfo } from "../api/types";
import { formatBytes } from "../format";
import { useI18n } from "../i18n/I18nProvider";
import { Icon, type IconName } from "../icons";
import { driveRoot, type Location } from "../workspace/locations";

interface SidebarProps {
  readonly drives: readonly DriveInfo[];
  readonly location: Location | null;
  readonly onNavigate: (location: Location) => void;
}

interface NavItemProps {
  readonly icon: IconName;
  readonly label: string;
  readonly active: boolean;
  readonly onClick: () => void;
  readonly nested?: boolean;
}

function NavItem({ icon, label, active, onClick, nested = false }: NavItemProps) {
  return (
    <li>
      <button
        type="button"
        className={nested ? "nav-item nested" : "nav-item"}
        aria-current={active ? "page" : undefined}
        onClick={onClick}
      >
        <Icon name={icon} />
        <span>{label}</span>
      </button>
    </li>
  );
}

/** The drive the location belongs to, or undefined for the virtual lists. */
const driveIdOf = (location: Location | null): string | undefined =>
  location?.kind === "drive" || location?.kind === "trash" ? location.driveId : undefined;

function Usage({ drive }: { readonly drive: DriveInfo }) {
  const { t, language } = useI18n();
  const used = formatBytes(drive.usedBytes, language);
  const quota = drive.quotaBytes;
  const text =
    quota === null
      ? t("used", { used })
      : t("usedOf", { used, total: formatBytes(quota, language) });
  return (
    <div className="usage">
      {quota !== null && (
        <progress max={quota} value={Math.min(drive.usedBytes, quota)} aria-label={drive.name} />
      )}
      <small>{text}</small>
    </div>
  );
}

function TeamFolders({
  teams,
  location,
  onNavigate,
}: { readonly teams: readonly DriveInfo[] } & Omit<SidebarProps, "drives">) {
  const { t } = useI18n();
  if (teams.length === 0) return null;
  return (
    <li className="nav-group">
      <span className="nav-heading">
        <Icon name="team" />
        {t("teamFolder")}
      </span>
      <ul>
        {teams.map((team) => (
          <NavItem
            key={team.id}
            nested
            icon="folder"
            label={team.name}
            active={location?.kind === "drive" && location.driveId === team.id}
            onClick={() => onNavigate(driveRoot(team.id))}
          />
        ))}
      </ul>
    </li>
  );
}

function VirtualLists({
  location,
  onNavigate,
  trashDriveId,
}: Omit<SidebarProps, "drives"> & { readonly trashDriveId: string | undefined }) {
  const { t } = useI18n();
  return (
    <>
      <NavItem
        icon="clock"
        label={t("recent")}
        active={location?.kind === "recent"}
        onClick={() => onNavigate({ kind: "recent" })}
      />
      <NavItem
        icon="star"
        label={t("starred")}
        active={location?.kind === "starred"}
        onClick={() => onNavigate({ kind: "starred" })}
      />
      <NavItem
        icon="trash"
        label={t("trash")}
        active={location?.kind === "trash"}
        onClick={() =>
          trashDriveId !== undefined && onNavigate({ kind: "trash", driveId: trashDriveId })
        }
      />
    </>
  );
}

export function Sidebar({ drives, location, onNavigate }: SidebarProps) {
  const { t } = useI18n();
  const personal = drives.find((d) => d.kind === "personal");
  const current = drives.find((d) => d.id === driveIdOf(location)) ?? personal;
  return (
    <nav className="sidebar" aria-label={t("categories")}>
      <ul>
        {personal !== undefined && (
          <NavItem
            icon="home"
            label={t("myDrive")}
            active={location?.kind === "drive" && location.driveId === personal.id}
            onClick={() => onNavigate(driveRoot(personal.id))}
          />
        )}
        <TeamFolders
          teams={drives.filter((d) => d.kind === "team")}
          location={location}
          onNavigate={onNavigate}
        />
        <VirtualLists location={location} onNavigate={onNavigate} trashDriveId={current?.id} />
      </ul>
      {current !== undefined && <Usage drive={current} />}
    </nav>
  );
}
