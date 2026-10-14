import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { describeError } from "../api/describe-error";
import type { DriveInfo, NodeInfo } from "../api/types";
import {
  applyClick,
  emptySelection,
  neighbor,
  prune,
  selectAll,
  type ClickModifiers,
  type Selection,
} from "../files/selection";
import { defaultSort, sortNodes, toggleSort, type Sort, type SortKey } from "../files/sorting";
import { useI18n } from "../i18n/I18nProvider";
import { useToasts, type ToastAction } from "./ToastProvider";
import { driveRoot, enterFolder, popTo, type Location } from "./locations";
import {
  useCreateFolder,
  useMove,
  useRename,
  useRestore,
  useStar,
  useTrash,
  useUploads,
  type CommandContext,
} from "./useCommands";
import { useDrives, useListing } from "./useListing";

function useNavigation(drives: readonly DriveInfo[]) {
  const [chosen, setChosen] = useState<Location | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const personal = drives.find((d) => d.kind === "personal");
  const location = chosen ?? (personal === undefined ? null : driveRoot(personal.id));

  const openFolder = useCallback(
    (folder: NodeInfo) => setChosen(enterFolder(location ?? driveRoot(folder.driveId), folder)),
    [location],
  );
  const goTo = useCallback(
    (depth: number) => location !== null && setChosen(popTo(location, depth)),
    [location],
  );
  const showInFolder = useCallback(async (node: NodeInfo) => {
    const trail = await api.path(node.id);
    setChosen({ kind: "drive", driveId: node.driveId, trail });
    setFocusId(node.id);
  }, []);
  const home = useCallback(() => setChosen(null), []);
  return {
    location,
    navigate: setChosen,
    home,
    openFolder,
    goTo,
    showInFolder,
    focusId,
    setFocusId,
  };
}

function useView(nodes: readonly NodeInfo[], location: Location | null) {
  const [sort, setSort] = useState<Sort>(defaultSort);
  const kind = location?.kind ?? "";
  useEffect(() => {
    setSort(
      kind === "recent" || kind === "trash" ? { key: "modified", direction: "desc" } : defaultSort,
    );
  }, [kind]);
  const visible = useMemo(() => sortNodes(nodes, sort), [nodes, sort]);
  const sortBy = useCallback((key: SortKey) => setSort((s) => toggleSort(s, key)), []);
  return { sort, sortBy, visible };
}

function useSelectionState(visible: readonly NodeInfo[]) {
  const [selection, setSelection] = useState<Selection>(emptySelection);
  const order = useMemo(() => visible.map((n) => n.id), [visible]);
  useEffect(() => setSelection((s) => prune(s, order)), [order]);

  const click = useCallback(
    (id: string, modifiers: ClickModifiers) =>
      setSelection((s) => applyClick(s, order, { id, ...modifiers })),
    [order],
  );
  const step = useCallback(
    (direction: 1 | -1, extend: boolean) =>
      setSelection((s) => {
        const target = neighbor(order, s.anchor, direction);
        if (target === null) return s;
        return applyClick(s, order, { id: target, toggle: false, range: extend });
      }),
    [order],
  );
  const all = useCallback(() => setSelection(selectAll(order)), [order]);
  const clear = useCallback(() => setSelection(emptySelection), []);
  const only = useCallback((id: string) => setSelection({ ids: new Set([id]), anchor: id }), []);
  const selected = useMemo(
    () => visible.filter((n) => selection.ids.has(n.id)),
    [visible, selection],
  );
  return { selected, click, step, all, clear, only };
}

function useFocusOnLoad(
  focusId: string | null,
  visible: readonly NodeInfo[],
  actions: { only: (id: string) => void; setFocusId: (id: string | null) => void },
) {
  useEffect(() => {
    if (focusId === null || !visible.some((n) => n.id === focusId)) return;
    actions.only(focusId);
    actions.setFocusId(null);
  }, [focusId, visible]);
}

/** Refresh counter, error reporting and toast helpers shared by all workspace hooks. */
function useFeedback() {
  const { t } = useI18n();
  const { push } = useToasts();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  const report = useCallback(
    (error: unknown) => push({ kind: "error", message: describeError(error, t) }),
    [push, t],
  );
  const notify = useCallback(
    (message: string, action?: ToastAction) => push({ kind: "info", message, action }),
    [push],
  );
  return { t, tick, refresh, report, notify };
}

function useData() {
  const feedback = useFeedback();
  const drives = useDrives(feedback.tick, feedback.report);
  const nav = useNavigation(drives);
  const listing = useListing(nav.location, feedback.tick, feedback.report);
  const view = useView(listing.nodes, nav.location);
  const selection = useSelectionState(view.visible);
  useFocusOnLoad(nav.focusId, view.visible, { only: selection.only, setFocusId: nav.setFocusId });
  return { feedback, drives, nav, listing, view, selection };
}

function useCommandSet(data: ReturnType<typeof useData>) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const { feedback, nav, listing, selection } = data;
  const ctx: CommandContext = { listing, location: nav.location, ...feedback };
  const onCreated = useCallback(
    (folder: NodeInfo) => {
      selection.only(folder.id);
      setRenamingId(folder.id);
    },
    [selection.only],
  );
  return {
    renamingId,
    setRenamingId,
    rename: useRename(ctx),
    setStar: useStar(ctx),
    move: useMove(ctx),
    trash: useTrash(ctx),
    restore: useRestore(ctx),
    createFolder: useCreateFolder(ctx, onCreated),
    ...useUploads(ctx),
  };
}

export function useWorkspace() {
  const data = useData();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const commands = useCommandSet(data);
  return {
    drives: data.drives,
    ...data.nav,
    ...data.view,
    ...data.selection,
    ...commands,
    loading: data.listing.loading,
    count: data.listing.nodes.length,
    refresh: data.feedback.refresh,
    detailsOpen,
    toggleDetails: () => setDetailsOpen((open) => !open),
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;
