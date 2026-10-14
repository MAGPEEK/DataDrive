import { useEffect, useRef, useState, type DragEvent, type MouseEvent } from "react";
import type { NodeInfo } from "../api/types";
import { formatBytes, formatDate } from "../format";
import { useI18n } from "../i18n/I18nProvider";
import { Icon } from "../icons";

export const DRAG_TYPE = "application/x-datadrive-ids";

export interface RowHandlers {
  readonly onSelect: (event: MouseEvent) => void;
  readonly onOpen: () => void;
  readonly onContextMenu: (event: MouseEvent) => void;
  readonly onToggleStar: () => void;
  readonly onRename: (name: string) => void;
  readonly onCancelRename: () => void;
  readonly onDragStart: (event: DragEvent) => void;
  readonly onDropItems: (ids: readonly string[]) => void;
}

interface FileRowProps {
  readonly node: NodeInfo;
  readonly selected: boolean;
  readonly renaming: boolean;
  readonly draggable: boolean;
  readonly handlers: RowHandlers;
}

function NameEditor({
  node,
  handlers,
}: {
  readonly node: NodeInfo;
  readonly handlers: RowHandlers;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(node.name);

  useEffect(() => {
    const field = input.current;
    if (field === null) return;
    field.focus();
    const dot = node.kind === "file" ? node.name.lastIndexOf(".") : -1;
    field.setSelectionRange(0, dot > 0 ? dot : node.name.length);
  }, [node.kind, node.name]);

  return (
    <input
      ref={input}
      className="rename-input"
      aria-label={t("rename")}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onBlur={() => handlers.onRename(value.trim())}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") handlers.onRename(value.trim());
        if (event.key === "Escape") handlers.onCancelRename();
      }}
    />
  );
}

export function FileRow({ node, selected, renaming, draggable, handlers }: FileRowProps) {
  const { t, language } = useI18n();
  const [dropTarget, setDropTarget] = useState(false);
  const isFolder = node.kind === "folder";

  function accepts(event: DragEvent): boolean {
    return isFolder && node.capabilities.canWrite && event.dataTransfer.types.includes(DRAG_TYPE);
  }

  return (
    <tr
      role="row"
      aria-selected={selected}
      data-node-id={node.id}
      className={[selected ? "selected" : "", dropTarget ? "drop-target" : ""].join(" ").trim()}
      draggable={draggable && !renaming}
      onClick={handlers.onSelect}
      onDoubleClick={handlers.onOpen}
      onContextMenu={handlers.onContextMenu}
      onDragStart={handlers.onDragStart}
      onDragOver={(event) => {
        if (!accepts(event)) return;
        event.preventDefault();
        setDropTarget(true);
      }}
      onDragLeave={() => setDropTarget(false)}
      onDrop={(event) => {
        setDropTarget(false);
        if (!accepts(event)) return;
        event.preventDefault();
        event.stopPropagation();
        handlers.onDropItems(JSON.parse(event.dataTransfer.getData(DRAG_TYPE)) as string[]);
      }}
    >
      <td className="col-star">
        <button
          type="button"
          className={node.starred ? "star on" : "star"}
          aria-label={node.starred ? t("removeStar") : t("addStar")}
          aria-pressed={node.starred}
          onClick={(event) => {
            event.stopPropagation();
            handlers.onToggleStar();
          }}
        >
          <Icon name="star" filled={node.starred} />
        </button>
      </td>
      <td className="col-name">
        <span className={isFolder ? "node-icon folder" : "node-icon"}>
          <Icon name={isFolder ? "folder" : "file"} filled={isFolder} />
        </span>
        {renaming ? (
          <NameEditor node={node} handlers={handlers} />
        ) : (
          <span className="node-name">{node.name}</span>
        )}
      </td>
      <td className="col-modified">{formatDate(node.modifiedAt, language)}</td>
      <td className="col-size">{isFolder ? "–" : formatBytes(node.size, language)}</td>
    </tr>
  );
}
