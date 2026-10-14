const nameBody = {
  type: "object",
  required: ["name"],
  properties: { name: { type: "string" } },
  additionalProperties: false,
};

const settingsSchema = {
  type: "object",
  properties: {
    restrictDownloads: { type: "boolean" },
    watermark: { type: "boolean" },
    fileLocking: { type: "boolean" },
    maxVersions: { type: "integer", minimum: 1, maximum: 32 },
  },
  additionalProperties: false,
};

export const driveSchemas = {
  mine: { tags: ["drives"], summary: "My drives with role and usage" },
  allTeams: { tags: ["team folders"], summary: "All team folders (admin)" },
  createTeam: { tags: ["team folders"], summary: "Create a team folder (admin)", body: nameBody },
  update: {
    tags: ["drives"],
    summary: "Change quota and settings of a drive (admin)",
    body: {
      type: "object",
      properties: {
        quotaBytes: { type: ["integer", "null"], minimum: 0 },
        settings: settingsSchema,
      },
      additionalProperties: false,
    },
  },
};

export const memberSchemas = {
  list: { tags: ["team folders"], summary: "List members of a team folder (manager or admin)" },
  set: {
    tags: ["team folders"],
    summary: "Add or change a member (manager or admin)",
    body: {
      type: "object",
      required: ["subjectType", "subjectId", "role"],
      properties: {
        subjectType: { type: "string", enum: ["user", "group"] },
        subjectId: { type: "string" },
        role: { type: "string", enum: ["viewer", "editor", "manager"] },
      },
      additionalProperties: false,
    },
  },
  remove: { tags: ["team folders"], summary: "Remove a member (manager or admin)" },
};

export const groupSchemas = {
  create: { tags: ["groups"], summary: "Create a group (admin)", body: nameBody },
  list: { tags: ["groups"], summary: "List groups (admin)" },
  addMember: { tags: ["groups"], summary: "Add a user to a group (admin)" },
  removeMember: { tags: ["groups"], summary: "Remove a user from a group (admin)" },
};
