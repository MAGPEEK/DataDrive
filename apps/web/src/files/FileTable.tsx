import { useState, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import type { NodeInfo } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n/messages";
import { Icon } from "../icons";
import type { Location } from "../workspace/locations";
import type { Workspace } from "../workspace/useWorkspace";
import { itemActions, type ItemActionHandlers } from "./actions";
import { ContextMenu } from "./ContextMenu";
import { DRAG_TYPE, FileRow } from "./FileRow";
import { dispatchKey, type KeyCommands } from "./keyboard";
import type { SortKey } from "./sorting";

interface FileTableProps {
  readonly ws: Workspace;
  readonly location: Location;
  readonly handlers: ItemActionHandlers;
}

const COLUMNS: readonly { key: SortKey; label: MessageKey; className: string }[] = [
  { key: "name", label: "name", className: "col-name" },
  { key: "modified", label: "modified", className: "col-modified" },
  { key: "size", label: "size", className: "col-size" },
];

function emptyMessage(location: Location): MessageKey {
  if (location.kind === "recent") return "emptyRecent";
  if (location.kind === "starred") return "emptyStarred";
  if (location.kind === "trash") return "emptyTrash";
  if (location.kind === "search") return "emptySearch";
  return "emptyFolder";
}

function SortHeader({ ws }: { readonly ws: Workspace }) {
  const { t } = useI18n();
  return (
    <thead>
      <tr>
        <th className="col-star" aria-label={t("starred")} />
        {COLUMNS.map((column) => (
          <th
            key={column.key}
            className={column.className}
            aria-sort={
              ws.sort.key === column.key
                ? ws.sort.direction === "asc"
                  ? "ascending"
                  : "descending"
                : "none"
            }
          >
            <button type="button" className="sort" onClick={() => ws.sortBy(column.key)}>
              {t(column.label)}
              {ws.sort.key === column.key && (
                <span
                  className={ws.sort.direction === "desc" ? "arrow down" : "arrow"}
                  aria-hidden="true"
                >
                  <Icon name="chevron" size={12} />
                </span>
              )}
            </button>
          </th>
        ))}
      </tr>
    </thead>
  );
}

function useTableKeys(ws: Workspace, handlers: ItemActionHandlers, location: Location) {
  const commands: KeyCommands = {
    step: ws.step,
    selectAll: ws.all,
    clear: ws.clear,
    open: handlers.open,
    rename: handlers.rename,
    trash: handlers.trash,
  };
  return (event: KeyboardEvent) => {
    const state = { selected: ws.selected, inTrash: location.kind === "trash" };
    if (dispatchKey(event, state, commands)) event.preventDefault();
  };
}

export function FileTable({ ws, location, handlers }: FileTableProps) {
  const { t } = useI18n();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const onKeyDown = useTableKeys(ws, handlers, location);
  const selectedIds = new Set(ws.selected.map((n) => n.id));

  function select(node: NodeInfo, event: MouseEvent) {
    ws.click(node.id, { toggle: event.ctrlKey || event.metaKey, range: event.shiftKey });
  }

  function contextMenu(node: NodeInfo, event: MouseEvent) {
    event.preventDefault();
    if (!selectedIds.has(node.id)) ws.only(node.id);
    setMenu({ x: event.clientX, y: event.clientY });
  }

  function dragStart(node: NodeInfo, event: DragEvent) {
    const ids = selectedIds.has(node.id) ? [...selectedIds] : [node.id];
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(ids));
    event.dataTransfer.effectAllowed = "move";
  }

  function dropInto(folder: NodeInfo, ids: readonly string[]) {
    const items = ws.visible.filter((n) => ids.includes(n.id) && n.id !== folder.id);
    if (items.length > 0) void ws.move(items, folder.id);
  }

  if (ws.visible.length === 0 && !ws.loading) {
    const term = location.kind === "search" ? location.term : "";
    return <p className="empty">{t(emptyMessage(location), { term })}</p>;
  }

  const menuActions =
    menu === null ? [] : itemActions({ selected: ws.selected, location, handlers });
  return (
    <div className="table-wrap" tabIndex={0} onKeyDown={onKeyDown} aria-label={t("name")}>
      <table role="grid" aria-multiselectable="true">
        <SortHeader ws={ws} />
        <tbody>
          {ws.visible.map((node) => (
            <FileRow
              key={node.id}
              node={node}
              selected={selectedIds.has(node.id)}
              renaming={ws.renamingId === node.id}
              draggable={node.capabilities.canWrite && location.kind === "drive"}
              handlers={{
                onSelect: (event) => select(node, event),
                onOpen: () => handlers.open(node),
                onContextMenu: (event) => contextMenu(node, event),
                onToggleStar: () => void ws.setStar([node], !node.starred),
                onRename: (name) => {
                  ws.setRenamingId(null);
                  void ws.rename(node, name);
                },
                onCancelRename: () => ws.setRenamingId(null),
                onDragStart: (event) => dragStart(node, event),
                onDropItems: (ids) => dropInto(node, ids),
              }}
            />
          ))}
        </tbody>
      </table>
      {menu !== null && (
        <ContextMenu x={menu.x} y={menu.y} actions={menuActions} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}
