import type { Dispatch, SetStateAction } from "react";
import { api } from "../api/client";
import type { NodeInfo } from "../api/types";
import type { Workspace } from "../workspace/useWorkspace";
import type { ItemActionHandlers } from "./actions";
import { startDownload } from "./download";

/** Connects the item actions of the toolbar, context menu and keyboard to the workspace. */
export function useItemHandlers(
  ws: Workspace,
  openMoveDialog: Dispatch<SetStateAction<readonly NodeInfo[] | null>>,
): ItemActionHandlers {
  const inDrive = ws.location?.kind === "drive";
  const open = (node: NodeInfo) => {
    if (node.kind === "folder") {
      if (inDrive) ws.openFolder(node);
      else void ws.showInFolder(node);
    } else if (node.capabilities.canDownload) {
      startDownload(api.downloadUrl(node.id));
    }
  };
  return {
    open,
    download: (node) => startDownload(api.downloadUrl(node.id)),
    setStar: (nodes, starred) => void ws.setStar(nodes, starred),
    rename: (node) => ws.setRenamingId(node.id),
    moveTo: openMoveDialog,
    trash: (nodes) => void ws.trash(nodes),
    restore: (nodes) => void ws.restore(nodes),
    showInFolder: (node) => void ws.showInFolder(node),
  };
}
