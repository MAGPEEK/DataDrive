import type { NodeInfo } from "../api/types";
import type { IconName } from "../icons";
import type { MessageKey } from "../i18n/messages";
import type { Location } from "../workspace/locations";

export interface ItemActionHandlers {
  readonly open: (node: NodeInfo) => void;
  readonly download: (node: NodeInfo) => void;
  readonly setStar: (nodes: readonly NodeInfo[], starred: boolean) => void;
  readonly rename: (node: NodeInfo) => void;
  readonly moveTo: (nodes: readonly NodeInfo[]) => void;
  readonly trash: (nodes: readonly NodeInfo[]) => void;
  readonly restore: (nodes: readonly NodeInfo[]) => void;
  readonly showInFolder: (node: NodeInfo) => void;
}

export interface ItemAction {
  readonly id: string;
  readonly label: MessageKey;
  readonly icon: IconName;
  readonly danger?: boolean;
  readonly run: () => void;
}

export interface ActionInput {
  readonly selected: readonly NodeInfo[];
  readonly location: Location;
  readonly handlers: ItemActionHandlers;
}

const every = (nodes: readonly NodeInfo[], check: (n: NodeInfo) => boolean) =>
  nodes.length > 0 && nodes.every(check);

function trashActions({ selected, handlers }: ActionInput): ItemAction[] {
  if (!every(selected, (n) => n.capabilities.canWrite)) return [];
  return [
    { id: "restore", label: "restore", icon: "refresh", run: () => handlers.restore(selected) },
  ];
}

function singleActions({ selected, location, handlers }: ActionInput): ItemAction[] {
  const [only] = selected;
  if (selected.length !== 1 || only === undefined) return [];
  const actions: ItemAction[] = [
    { id: "open", label: "open", icon: "chevron", run: () => handlers.open(only) },
  ];
  if (only.kind === "file" && only.capabilities.canDownload) {
    actions.push({
      id: "download",
      label: "download",
      icon: "download",
      run: () => handlers.download(only),
    });
  }
  if (only.capabilities.canRename) {
    actions.push({ id: "rename", label: "rename", icon: "edit", run: () => handlers.rename(only) });
  }
  if (location.kind !== "drive") {
    actions.push({
      id: "show",
      label: "showInFolder",
      icon: "folder",
      run: () => handlers.showInFolder(only),
    });
  }
  return actions;
}

function manyActions({ selected, handlers }: ActionInput): ItemAction[] {
  const actions: ItemAction[] = [];
  const target = !every(selected, (n) => n.starred);
  actions.push({
    id: "star",
    label: target ? "addStar" : "removeStar",
    icon: "star",
    run: () => handlers.setStar(selected, target),
  });
  if (every(selected, (n) => n.capabilities.canWrite)) {
    actions.push({
      id: "move",
      label: "moveTo",
      icon: "move",
      run: () => handlers.moveTo(selected),
    });
  }
  if (every(selected, (n) => n.capabilities.canDelete)) {
    actions.push({
      id: "trash",
      label: "moveToTrash",
      icon: "trash",
      danger: true,
      run: () => handlers.trash(selected),
    });
  }
  return actions;
}

/** What can be done with the current selection; the toolbar and the context menu show the same list. */
export function itemActions(input: ActionInput): ItemAction[] {
  if (input.selected.length === 0) return [];
  if (input.location.kind === "trash") return trashActions(input);
  return [...singleActions(input), ...manyActions(input)];
}
