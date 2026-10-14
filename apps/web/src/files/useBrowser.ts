import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { describeError } from "../api/describe-error";
import type { DriveInfo, NodeInfo, Place } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";

export type View = "files" | "trash";

type ErrorHandler = (error: unknown) => void;

function useDriveList(tick: number, onError: ErrorHandler): DriveInfo[] {
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  useEffect(() => {
    let active = true;
    api
      .drives()
      .then((list) => active && setDrives(list))
      .catch((error: unknown) => active && onError(error));
    return () => {
      active = false;
    };
  }, [tick, onError]);
  return drives;
}

interface NodeListInput {
  readonly place: Place | null;
  readonly view: View;
  readonly tick: number;
  readonly onError: ErrorHandler;
}

function useNodeList({ place, view, tick, onError }: NodeListInput) {
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const driveId = place?.driveId ?? null;
  const parentId = place?.parentId ?? null;
  useEffect(() => {
    if (driveId === null) return undefined;
    let active = true;
    const request =
      view === "trash" ? api.listTrash(driveId) : api.listNodes({ driveId, parentId });
    request
      .then((items) => active && setNodes(items))
      .catch((error: unknown) => active && onError(error));
    return () => {
      active = false;
    };
  }, [driveId, parentId, view, tick, onError]);
  return nodes;
}

function useNavigation(drives: readonly DriveInfo[]) {
  const [chosenDrive, setChosenDrive] = useState<string | null>(null);
  const [trail, setTrail] = useState<readonly NodeInfo[]>([]);
  const [view, setView] = useState<View>("files");
  const driveId = chosenDrive ?? drives[0]?.id ?? null;

  const selectDrive = useCallback((id: string) => {
    setChosenDrive(id);
    setTrail([]);
    setView("files");
  }, []);
  const openFolder = useCallback((folder: NodeInfo) => setTrail((path) => [...path, folder]), []);
  const goTo = useCallback((depth: number) => {
    setTrail((path) => path.slice(0, depth));
    setView("files");
  }, []);
  const showTrash = useCallback(() => setView("trash"), []);

  const place: Place | null =
    driveId === null ? null : { driveId, parentId: trail[trail.length - 1]?.id ?? null };
  return { driveId, trail, view, place, selectDrive, openFolder, goTo, showTrash };
}

function useActions(place: Place | null, refresh: () => void, onError: ErrorHandler) {
  const [uploading, setUploading] = useState<string | null>(null);

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      try {
        await action();
        onError(null);
      } catch (error) {
        onError(error);
      } finally {
        refresh();
      }
    },
    [refresh, onError],
  );

  const createFolder = (name: string) =>
    place === null ? Promise.resolve() : run(() => api.createFolder(place, name));
  const moveToTrash = (node: NodeInfo) => run(() => api.trash(node.id));
  const restore = (node: NodeInfo) => run(() => api.restore(node.id));

  async function upload(files: readonly File[]) {
    if (place === null) return;
    for (const file of files) {
      setUploading(file.name);
      await run(() => api.upload(place, file));
    }
    setUploading(null);
  }
  return { uploading, createFolder, moveToTrash, restore, upload };
}

export function useBrowser() {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  const onError = useCallback(
    (failure: unknown) => setError(failure === null ? null : describeError(failure, t)),
    [t],
  );

  const drives = useDriveList(tick, onError);
  const navigation = useNavigation(drives);
  const nodes = useNodeList({ place: navigation.place, view: navigation.view, tick, onError });
  const actions = useActions(navigation.place, refresh, onError);
  const drive = drives.find((d) => d.id === navigation.driveId) ?? null;
  return { drives, drive, nodes, error, ...navigation, ...actions };
}

export type Browser = ReturnType<typeof useBrowser>;
