import type { NodeInfo } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";

interface BreadcrumbsProps {
  readonly rootLabel: string;
  readonly trail: readonly NodeInfo[];
  readonly onNavigate: (depth: number) => void;
}

export function Breadcrumbs({ rootLabel, trail, onNavigate }: BreadcrumbsProps) {
  const { t } = useI18n();
  return (
    <nav aria-label={t("breadcrumbs")} className="breadcrumbs">
      <ol>
        <li>
          <button
            type="button"
            onClick={() => onNavigate(0)}
            aria-current={trail.length === 0 ? "page" : undefined}
          >
            {rootLabel}
          </button>
        </li>
        {trail.map((folder, index) => (
          <li key={folder.id}>
            <button
              type="button"
              onClick={() => onNavigate(index + 1)}
              aria-current={index === trail.length - 1 ? "page" : undefined}
            >
              {folder.name}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
