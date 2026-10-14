import { useState } from "react";
import { api } from "../api/client";
import type { Group, User } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";
import { NameForm } from "./NameForm";
import { useGuarded } from "./useResource";

interface GroupsPanelProps {
  readonly groups: readonly Group[];
  readonly users: readonly User[];
  readonly onChanged: () => void;
}

function AddToGroup({ group, users }: { readonly group: Group; readonly users: readonly User[] }) {
  const { t } = useI18n();
  const guarded = useGuarded();
  const [userId, setUserId] = useState("");
  return (
    <span className="admin-inline">
      <select
        aria-label={`${t("groupMemberAdd")} (${group.name})`}
        value={userId}
        onChange={(event) => setUserId(event.target.value)}
      >
        <option value="">{t("groupMemberAdd")}</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.username}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={userId === ""}
        onClick={() => void guarded(() => api.setGroupMember(group.id, userId, true))}
      >
        {t("add")}
      </button>
    </span>
  );
}

export function GroupsPanel({ groups, users, onChanged }: GroupsPanelProps) {
  const { t } = useI18n();
  const guarded = useGuarded();
  const create = async (name: string) => {
    const done = await guarded(() => api.createGroup(name), t("groupCreated", { name }));
    if (done) onChanged();
    return done;
  };
  return (
    <section aria-label={t("tabGroups")}>
      <NameForm label="newGroup" onSubmit={create} />
      {groups.length === 0 && <p className="empty">{t("nothingYet")}</p>}
      <ul className="admin-list">
        {groups.map((group) => (
          <li key={group.id}>
            <strong>{group.name}</strong>
            <AddToGroup group={group} users={users} />
          </li>
        ))}
      </ul>
    </section>
  );
}
