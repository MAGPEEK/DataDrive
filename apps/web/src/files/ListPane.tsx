import type { DriveInfo } from "../api/types";
import type { Location } from "../workspace/locations";
import type { Workspace } from "../workspace/useWorkspace";
import { itemActions, type ItemActionHandlers } from "./actions";
import { CommandBar } from "./CommandBar";
import { FileTable } from "./FileTable";
import { Heading } from "./Heading";
import { StatusBar } from "./StatusBar";

interface ListPaneProps {
  readonly ws: Workspace;
  readonly location: Location;
  readonly drive: DriveInfo | undefined;
  readonly handlers: ItemActionHandlers;
}

/** Toolbar, title, list and status bar of the current location. */
export function ListPane({ ws, location, drive, handlers }: ListPaneProps) {
  const canCreate = location.kind === "drive" && drive !== undefined && drive.role !== "viewer";
  const actions = itemActions({ selected: ws.selected, location, handlers });
  const moveIds = (ids: readonly string[], parentId: string | null) => {
    const items = ws.visible.filter((n) => ids.includes(n.id));
    if (items.length > 0) void ws.move(items, parentId);
  };
  return (
    <>
      <CommandBar
        canCreate={canCreate}
        onCreateFolder={() => void ws.createFolder()}
        onUpload={(files) => void ws.upload(files)}
        actions={actions}
        detailsOpen={ws.detailsOpen}
        onToggleDetails={ws.toggleDetails}
        onRefresh={ws.refresh}
      />
      <Heading location={location} drive={drive} onGoTo={ws.goTo} onDropItems={moveIds} />
      <FileTable ws={ws} location={location} handlers={handlers} />
      <StatusBar count={ws.count} selected={ws.selected.length} />
    </>
  );
}
