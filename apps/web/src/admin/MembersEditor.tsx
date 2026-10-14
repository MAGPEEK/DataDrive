import { useState } from "react";
import { api } from "../api/client";
import type { DriveRole, Group, Member, User } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n/messages";
import { useGuarded, useResource } from "./useResource";

const ROLES: readonly DriveRole[] = ["viewer", "editor", "manager"];
const ROLE_KEY: Record<DriveRole, MessageKey> = {
  viewer: "roleViewer",
  editor: "roleEditor",
  manager: "roleManager",
};

interface Subjects {
  readonly users: readonly User[];
  readonly groups: readonly Group[];
}

interface RoleSelectProps {
  readonly label: string;
  readonly value: DriveRole;
  readonly onChange: (role: DriveRole) => void;
}

function RoleSelect({ label, value, onChange }: RoleSelectProps) {
  const { t } = useI18n();
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as DriveRole)}
    >
      {ROLES.map((role) => (
        <option key={role} value={role}>
          {t(ROLE_KEY[role])}
        </option>
      ))}
    </select>
  );
}

function useMemberCommands(driveId: string, reload: () => void) {
  const guarded = useGuarded();
  return {
    set: async (member: Member) => {
      if (await guarded(() => api.setMember(driveId, member))) reload();
    },
    remove: async (member: Omit<Member, "role">) => {
      if (await guarded(() => api.removeMember(driveId, member))) reload();
    },
  };
}

function subjectName(member: Member, { users, groups }: Subjects): string {
  if (member.subjectType === "user") {
    return users.find((u) => u.id === member.subjectId)?.username ?? member.subjectId;
  }
  return groups.find((g) => g.id === member.subjectId)?.name ?? member.subjectId;
}

interface AddMemberProps extends Subjects {
  readonly onAdd: (member: Member) => void;
}

function AddMember({ users, groups, onAdd }: AddMemberProps) {
  const { t } = useI18n();
  const [subject, setSubject] = useState("");
  const [role, setRole] = useState<DriveRole>("editor");
  const add = () => {
    const [subjectType, subjectId] = subject.split(":") as [Member["subjectType"], string];
    onAdd({ subjectType, subjectId, role });
    setSubject("");
  };
  return (
    <div className="admin-form">
      <select
        aria-label={t("memberType")}
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
      >
        <option value="">{t("addMember")}</option>
        {users.map((u) => (
          <option key={u.id} value={`user:${u.id}`}>
            {u.username}
          </option>
        ))}
        {groups.map((g) => (
          <option key={g.id} value={`group:${g.id}`}>
            {g.name} ({t("tabGroups")})
          </option>
        ))}
      </select>
      <RoleSelect label={t("roleLabel")} value={role} onChange={setRole} />
      <button type="button" disabled={subject === ""} onClick={add}>
        {t("add")}
      </button>
    </div>
  );
}

export function MembersEditor({ driveId, ...subjects }: Subjects & { readonly driveId: string }) {
  const { t } = useI18n();
  const { items, reload } = useResource(() => api.members(driveId));
  const commands = useMemberCommands(driveId, reload);
  return (
    <div className="admin-members">
      <h3>{t("members")}</h3>
      <ul className="admin-list">
        {items.map((member) => {
          const name = subjectName(member, subjects);
          return (
            <li key={`${member.subjectType}:${member.subjectId}`}>
              <span>{name}</span>
              <RoleSelect
                label={`${t("roleLabel")} ${name}`}
                value={member.role}
                onChange={(role) => void commands.set({ ...member, role })}
              />
              <button
                type="button"
                aria-label={`${t("remove")} ${name}`}
                onClick={() => void commands.remove(member)}
              >
                {t("remove")}
              </button>
            </li>
          );
        })}
      </ul>
      <AddMember {...subjects} onAdd={(m) => void commands.set(m)} />
    </div>
  );
}
