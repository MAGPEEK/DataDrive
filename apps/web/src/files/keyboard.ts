import type { NodeInfo } from "../api/types";

export interface KeyLike {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
}

export interface KeyState {
  readonly selected: readonly NodeInfo[];
  readonly inTrash: boolean;
}

export interface KeyCommands {
  readonly step: (direction: 1 | -1, extend: boolean) => void;
  readonly selectAll: () => void;
  readonly clear: () => void;
  readonly open: (node: NodeInfo) => void;
  readonly rename: (node: NodeInfo) => void;
  readonly trash: (nodes: readonly NodeInfo[]) => void;
}

function navigate(event: KeyLike, commands: KeyCommands): boolean {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    commands.step(event.key === "ArrowDown" ? 1 : -1, event.shiftKey);
    return true;
  }
  if (event.key === "Escape") {
    commands.clear();
    return true;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
    commands.selectAll();
    return true;
  }
  return false;
}

function remove(event: KeyLike, state: KeyState, commands: KeyCommands): boolean {
  const wantsDelete = event.key === "Delete" || event.key === "Backspace";
  const allowed =
    state.selected.length > 0 && state.selected.every((n) => n.capabilities.canDelete);
  if (!wantsDelete || !allowed || state.inTrash) return false;
  commands.trash(state.selected);
  return true;
}

function edit(event: KeyLike, state: KeyState, commands: KeyCommands): boolean {
  const [only] = state.selected;
  const single = state.selected.length === 1 ? only : undefined;
  if (event.key === "Enter" && single !== undefined) {
    commands.open(single);
    return true;
  }
  if (event.key === "F2" && single?.capabilities.canRename === true) {
    commands.rename(single);
    return true;
  }
  return remove(event, state, commands);
}

/** Handles the keys of a file list. Returns true when the key was used (the caller then prevents the default). */
export function dispatchKey(event: KeyLike, state: KeyState, commands: KeyCommands): boolean {
  return navigate(event, commands) || edit(event, state, commands);
}
