import { useCallback, useState } from "react";
import { api } from "../api/client";
import type { NodeInfo } from "../api/types";
import { uniqueName } from "../files/sorting";
import type { MessageKey } from "../i18n/messages";
import type { ToastAction } from "./ToastProvider";
import { currentFolder, type Location } from "./locations";
import type { Listing } from "./useListing";

export interface CommandContext {
  readonly listing: Listing;
  readonly location: Location | null;
  readonly refresh: () => void;
  readonly report: (error: unknown) => void;
  readonly notify: (message: string, action?: ToastAction) => void;
  readonly t: (key: MessageKey, params?: Record<string, string>) => string;
}

type Update = (nodes: readonly NodeInfo[]) => readonly NodeInfo[];

/** Applies a change to the list at once, then asks the server. On failure the list is put back. */
export async function mutate(
  ctx: CommandContext,
  update: Update,
  request: () => Promise<unknown>,
): Promise<boolean> {
  const snapshot = ctx.listing.nodesRef.current;
  ctx.listing.replace(update(snapshot));
  try {
    await request();
    return true;
  } catch (error) {
    ctx.listing.replace(snapshot);
    ctx.report(error);
    return false;
  } finally {
    ctx.refresh();
  }
}

const without =
  (items: readonly NodeInfo[]): Update =>
  (nodes) => {
    const ids = new Set(items.map((i) => i.id));
    return nodes.filter((n) => !ids.has(n.id));
  };

interface Wording {
  readonly one: MessageKey;
  readonly many: MessageKey;
}

const describe = (ctx: CommandContext, items: readonly NodeInfo[], wording: Wording) =>
  items.length === 1
    ? ctx.t(wording.one, { name: items[0]?.name ?? "" })
    : ctx.t(wording.many, { count: String(items.length) });

export function useRename(ctx: CommandContext) {
  return useCallback(
    async (node: NodeInfo, name: string) => {
      if (name === "" || name === node.name) return;
      const rename: Update = (nodes) => nodes.map((n) => (n.id === node.id ? { ...n, name } : n));
      await mutate(ctx, rename, () => api.rename(node.id, name));
    },
    [ctx],
  );
}

export function useStar(ctx: CommandContext) {
  return useCallback(
    async (items: readonly NodeInfo[], starred: boolean) => {
      const ids = new Set(items.map((i) => i.id));
      const flip: Update = (nodes) =>
        ctx.location?.kind === "starred" && !starred
          ? nodes.filter((n) => !ids.has(n.id))
          : nodes.map((n) => (ids.has(n.id) ? { ...n, starred } : n));
      await mutate(ctx, flip, () => Promise.all(items.map((i) => api.star(i.id, starred))));
    },
    [ctx],
  );
}

export function useMove(ctx: CommandContext) {
  return useCallback(
    async (items: readonly NodeInfo[], targetParentId: string | null) => {
      const request = () => Promise.all(items.map((i) => api.move(i.id, targetParentId)));
      const ok = await mutate(ctx, without(items), request);
      if (ok) ctx.notify(describe(ctx, items, { one: "moved", many: "movedMany" }));
    },
    [ctx],
  );
}

export function useTrash(ctx: CommandContext) {
  return useCallback(
    async (items: readonly NodeInfo[]) => {
      const request = () => Promise.all(items.map((i) => api.trash(i.id)));
      if (!(await mutate(ctx, without(items), request))) return;
      const undo = () =>
        void Promise.all(items.map((i) => api.restore(i.id)))
          .then(ctx.refresh)
          .catch(ctx.report);
      ctx.notify(describe(ctx, items, { one: "movedToTrash", many: "movedManyToTrash" }), {
        label: ctx.t("undo"),
        run: undo,
      });
    },
    [ctx],
  );
}

export function useRestore(ctx: CommandContext) {
  return useCallback(
    async (items: readonly NodeInfo[]) => {
      const request = () => Promise.all(items.map((i) => api.restore(i.id)));
      const ok = await mutate(ctx, without(items), request);
      if (ok) ctx.notify(describe(ctx, items, { one: "restored", many: "restoredMany" }));
    },
    [ctx],
  );
}

/** Creates "New folder" right away and hands it over for in-place renaming (like a file manager). */
export function useCreateFolder(ctx: CommandContext, onCreated: (node: NodeInfo) => void) {
  return useCallback(async () => {
    const place = ctx.location === null ? null : currentFolder(ctx.location);
    if (place === null) return;
    const names = ctx.listing.nodesRef.current.map((n) => n.name);
    try {
      const folder = await api.createFolder(place, uniqueName(ctx.t("newFolderDefault"), names));
      ctx.listing.replace([...ctx.listing.nodesRef.current, folder]);
      onCreated(folder);
    } catch (error) {
      ctx.report(error);
    }
  }, [ctx, onCreated]);
}

export interface UploadItem {
  readonly id: number;
  readonly name: string;
  readonly status: "uploading" | "done" | "error";
}

export function useUploads(ctx: CommandContext) {
  const [uploads, setUploads] = useState<readonly UploadItem[]>([]);

  const patch = useCallback((id: number, status: UploadItem["status"]) => {
    setUploads((all) => all.map((u) => (u.id === id ? { ...u, status } : u)));
  }, []);

  const upload = useCallback(
    async (files: readonly File[]) => {
      const place = ctx.location === null ? null : currentFolder(ctx.location);
      if (place === null) return;
      for (const file of files) {
        const id = Date.now() + Math.random();
        setUploads((all) => [...all, { id, name: file.name, status: "uploading" }]);
        try {
          await api.upload(place, file);
          patch(id, "done");
          ctx.refresh();
        } catch (error) {
          patch(id, "error");
          ctx.report(error);
        }
      }
    },
    [ctx, patch],
  );

  const clearFinished = useCallback(
    () => setUploads((all) => all.filter((u) => u.status === "uploading")),
    [],
  );
  return { uploads, upload, clearFinished };
}
