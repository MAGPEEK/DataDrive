import { useState, type DragEvent } from "react";
import type { PathItem } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";
import { DRAG_TYPE } from "./FileRow";

interface BreadcrumbsProps {
  readonly rootLabel: string;
  readonly trail: readonly PathItem[];
  readonly onNavigate: (depth: number) => void;
  /** Called when items are dropped on a crumb; null is the drive root. */
  readonly onDropItems: (ids: readonly string[], parentId: string | null) => void;
}

interface CrumbProps {
  readonly label: string;
  readonly current: boolean;
  readonly onClick: () => void;
  readonly onDropItems: (ids: readonly string[]) => void;
}

function Crumb({ label, current, onClick, onDropItems }: CrumbProps) {
  const [over, setOver] = useState(false);
  const accepts = (event: DragEvent) => event.dataTransfer.types.includes(DRAG_TYPE);
  return (
    <li>
      <button
        type="button"
        className={over ? "drop-target" : undefined}
        aria-current={current ? "page" : undefined}
        onClick={onClick}
        onDragOver={(event) => {
          if (!accepts(event)) return;
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          setOver(false);
          if (!accepts(event)) return;
          event.preventDefault();
          event.stopPropagation();
          onDropItems(JSON.parse(event.dataTransfer.getData(DRAG_TYPE)) as string[]);
        }}
      >
        {label}
      </button>
    </li>
  );
}

export function Breadcrumbs({ rootLabel, trail, onNavigate, onDropItems }: BreadcrumbsProps) {
  const { t } = useI18n();
  return (
    <nav aria-label={t("breadcrumbs")} className="breadcrumbs">
      <ol>
        <Crumb
          label={rootLabel}
          current={trail.length === 0}
          onClick={() => onNavigate(0)}
          onDropItems={(ids) => onDropItems(ids, null)}
        />
        {trail.map((folder, index) => (
          <Crumb
            key={folder.id}
            label={folder.name}
            current={index === trail.length - 1}
            onClick={() => onNavigate(index + 1)}
            onDropItems={(ids) => onDropItems(ids, folder.id)}
          />
        ))}
      </ol>
    </nav>
  );
}
