import { jsonRequest, query, request } from "./http";
import type { DriveInfo, NodeInfo, Place, User } from "./types";

export interface Credentials {
  readonly username: string;
  readonly password: string;
  readonly otp?: string | undefined;
}

export const api = {
  login: async (credentials: Credentials): Promise<User> =>
    (await request<{ user: User }>("/auth/login", jsonRequest("POST", credentials))).user,

  me: (): Promise<User> => request<User>("/auth/me"),

  logout: async (): Promise<void> => {
    await request<unknown>("/auth/logout", { method: "POST" });
  },

  drives: (): Promise<DriveInfo[]> => request<DriveInfo[]>("/api/v1/drives"),

  listNodes: (place: Place): Promise<NodeInfo[]> =>
    request<NodeInfo[]>(`/api/v1/nodes${query(place)}`),

  listTrash: (driveId: string): Promise<NodeInfo[]> =>
    request<NodeInfo[]>(`/api/v1/trash${query({ driveId })}`),

  createFolder: (place: Place, name: string): Promise<NodeInfo> =>
    request<NodeInfo>("/api/v1/folders", jsonRequest("POST", { ...place, name })),

  trash: (id: string): Promise<NodeInfo> =>
    request<NodeInfo>(`/api/v1/nodes/${id}/trash`, { method: "POST" }),

  restore: (id: string): Promise<NodeInfo> =>
    request<NodeInfo>(`/api/v1/nodes/${id}/restore`, { method: "POST" }),

  upload: (place: Place, file: File): Promise<NodeInfo> =>
    request<NodeInfo>(`/api/v1/files${query({ ...place, name: file.name })}`, {
      method: "PUT",
      headers: { "content-type": "application/octet-stream" },
      body: file,
    }),

  downloadUrl: (id: string): string => `/api/v1/files/${id}/content`,
};
