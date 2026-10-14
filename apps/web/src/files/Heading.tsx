import type { DriveInfo } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";
import type { Location } from "../workspace/locations";
import { Breadcrumbs } from "./Breadcrumbs";

interface HeadingProps {
  readonly location: Location;
  readonly drive: DriveInfo | undefined;
  readonly onGoTo: (depth: number) => void;
  readonly onDropItems: (ids: readonly string[], parentId: string | null) => void;
}

/** The title row: a clickable folder path in drives, a plain title in the virtual lists. */
export function Heading({ location, drive, onGoTo, onDropItems }: HeadingProps) {
  const { t } = useI18n();
  if (location.kind === "drive") {
    const rootLabel = drive?.kind === "team" ? drive.name : t("myDrive");
    return (
      <Breadcrumbs
        rootLabel={rootLabel}
        trail={location.trail}
        onNavigate={onGoTo}
        onDropItems={onDropItems}
      />
    );
  }
  const title =
    location.kind === "search"
      ? `${t("search")}: ${location.term}`
      : t(location.kind === "trash" ? "trash" : location.kind);
  return <h1 className="title">{title}</h1>;
}
