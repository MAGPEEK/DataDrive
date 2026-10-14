import { jsonRequest, query, request } from "./http";
import type { DriveInfo, NodeInfo, PathItem, Place, User, VersionInfo } from "./types";

export interface Credentials {
  readonly username: string;
  readonly password: string;
  readonly otp?: string | undefined;
}

const post = <T>(path: string): Promise<T> => request<T>(path, { method: "POST" });
const send = async (path: string, method: string): Promise<void> => {
  await request<unknown>(path, { method });
};

export const api = {
  login: async (credentials: Credentials): Promise<User> =>
    (await request<{ user: User }>("/auth/login", jsonRequest("POST", credentials))).user,

  me: (): Promise<User> => request<User>("/auth/me"),

  logout: (): Promise<void> => send("/auth/logout", "POST"),

  drives: (): Promise<DriveInfo[]> => request<DriveInfo[]>("/api/v1/drives"),

  listNodes: (place: Place): Promise<NodeInfo[]> =>
    request<NodeInfo[]>(`/api/v1/nodes${query(place)}`),

  recent: (): Promise<NodeInfo[]> => request<NodeInfo[]>("/api/v1/recent"),

  starred: (): Promise<NodeInfo[]> => request<NodeInfo[]>("/api/v1/starred"),

  search: (term: string): Promise<NodeInfo[]> =>
    request<NodeInfo[]>(`/api/v1/search${query({ q: term })}`),

  listTrash: (driveId: string): Promise<NodeInfo[]> =>
    request<NodeInfo[]>(`/api/v1/trash${query({ driveId })}`),

  path: (id: string): Promise<PathItem[]> => request<PathItem[]>(`/api/v1/nodes/${id}/path`),

  createFolder: (place: Place, name: string): Promise<NodeInfo> =>
    request<NodeInfo>("/api/v1/folders", jsonRequest("POST", { ...place, name })),

  rename: (id: string, name: string): Promise<NodeInfo> =>
    request<NodeInfo>(`/api/v1/nodes/${id}`, jsonRequest("PATCH", { name })),

  move: (id: string, parentId: string | null): Promise<NodeInfo> =>
    request<NodeInfo>(`/api/v1/nodes/${id}/move`, jsonRequest("POST", { parentId })),

  star: (id: string, starred: boolean): Promise<void> =>
    send(`/api/v1/nodes/${id}/star`, starred ? "PUT" : "DELETE"),

  trash: (id: string): Promise<NodeInfo> => post<NodeInfo>(`/api/v1/nodes/${id}/trash`),

  restore: (id: string): Promise<NodeInfo> => post<NodeInfo>(`/api/v1/nodes/${id}/restore`),

  upload: (place: Place, file: File): Promise<NodeInfo> =>
    request<NodeInfo>(`/api/v1/files${query({ ...place, name: file.name })}`, {
      method: "PUT",
      headers: { "content-type": "application/octet-stream" },
      body: file,
    }),

  downloadUrl: (id: string): string => `/api/v1/files/${id}/content`,

  versions: (id: string): Promise<VersionInfo[]> =>
    request<VersionInfo[]>(`/api/v1/files/${id}/versions`),

  restoreVersion: (id: string, versionId: string): Promise<NodeInfo> =>
    post<NodeInfo>(`/api/v1/files/${id}/versions/${versionId}/restore`),

  versionDownloadUrl: (id: string, versionId: string): string =>
    `/api/v1/files/${id}/versions/${versionId}/content`,
};
