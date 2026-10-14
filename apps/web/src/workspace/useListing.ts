import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { DriveInfo, NodeInfo } from "../api/types";
import { currentFolder, locationKey, type Location } from "./locations";

export function loadListing(location: Location): Promise<NodeInfo[]> {
  switch (location.kind) {
    case "recent":
      return api.recent();
    case "starred":
      return api.starred();
    case "search":
      return api.search(location.term);
    case "trash":
      return api.listTrash(location.driveId);
    case "drive":
      return api.listNodes(currentFolder(location) as { driveId: string; parentId: string | null });
  }
}

export function useDrives(tick: number, onError: (error: unknown) => void): DriveInfo[] {
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

export interface Listing {
  readonly nodes: readonly NodeInfo[];
  /** Always the latest nodes, also inside callbacks created earlier. */
  readonly nodesRef: { readonly current: readonly NodeInfo[] };
  readonly loading: boolean;
  readonly replace: (nodes: readonly NodeInfo[]) => void;
}

/** The items of the current location. Reloads when the location or `tick` changes. */
export function useListing(
  location: Location | null,
  tick: number,
  onError: (error: unknown) => void,
): Listing {
  const [nodes, setNodes] = useState<readonly NodeInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const nodesRef = useRef<readonly NodeInfo[]>(nodes);
  nodesRef.current = nodes;
  const key = location === null ? null : locationKey(location);

  useEffect(() => {
    if (location === null) return undefined;
    let active = true;
    setLoading(true);
    loadListing(location)
      .then((items) => active && setNodes(items))
      .catch((error: unknown) => active && onError(error))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [key, tick, onError]);

  const replace = useCallback((next: readonly NodeInfo[]) => {
    nodesRef.current = next;
    setNodes(next);
  }, []);
  return { nodes, nodesRef, loading, replace };
}
