import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { NodeInfo, PathItem } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";
import { Icon } from "../icons";

interface MoveDialogProps {
  readonly items: readonly NodeInfo[];
  readonly onMove: (targetParentId: string | null) => void;
  readonly onClose: () => void;
}

/** Lets the user pick a folder of the same drive to move items into. */
export function MoveDialog({ items, onMove, onClose }: MoveDialogProps) {
  const { t } = useI18n();
  const driveId = items[0]?.driveId ?? "";
  const [trail, setTrail] = useState<readonly PathItem[]>([]);
  const [folders, setFolders] = useState<readonly NodeInfo[]>([]);
  const dialog = useRef<HTMLDivElement>(null);
  const parentId = trail.at(-1)?.id ?? null;
  const moving = new Set(items.map((i) => i.id));

  useEffect(() => {
    let active = true;
    api
      .listNodes({ driveId, parentId })
      .then(
        (list) =>
          active && setFolders(list.filter((n) => n.kind === "folder" && !moving.has(n.id))),
      )
      .catch(() => active && setFolders([]));
    return () => {
      active = false;
    };
  }, [driveId, parentId]);

  useEffect(() => dialog.current?.focus(), []);

  const title = items.length === 1 ? (items[0]?.name ?? "") : String(items.length);
  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div
        ref={dialog}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("moveDialogTitle", { name: title })}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.key === "Escape" && onClose()}
      >
        <h2>{t("moveDialogTitle", { name: title })}</h2>
        <nav className="breadcrumbs" aria-label={t("breadcrumbs")}>
          <ol>
            <li>
              <button type="button" onClick={() => setTrail([])}>
                {t("driveRoot")}
              </button>
            </li>
            {trail.map((item, index) => (
              <li key={item.id}>
                <button type="button" onClick={() => setTrail(trail.slice(0, index + 1))}>
                  {item.name}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <ul className="folder-list">
          {folders.length === 0 && <li className="empty">{t("noFolders")}</li>}
          {folders.map((folder) => (
            <li key={folder.id}>
              <button
                type="button"
                onClick={() => setTrail([...trail, { id: folder.id, name: folder.name }])}
              >
                <Icon name="folder" filled /> {folder.name}
              </button>
            </li>
          ))}
        </ul>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="button" className="primary" onClick={() => onMove(parentId)}>
            {t("moveHere")}
          </button>
        </div>
      </div>
    </div>
  );
}
