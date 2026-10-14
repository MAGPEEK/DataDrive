import { useState } from "react";
import type { User } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";
import { UserDialog } from "./UserDialog";

interface UsersPanelProps {
  readonly users: readonly User[];
  readonly onChanged: () => void;
}

type Editing = User | "new" | null;

export function UsersPanel({ users, onChanged }: UsersPanelProps) {
  const { t } = useI18n();
  const [term, setTerm] = useState("");
  const [editing, setEditing] = useState<Editing>(null);
  const shown = users.filter((u) => u.username.includes(term.trim().toLowerCase()));

  return (
    <section aria-label={t("tabUsers")}>
      <div className="admin-toolbar">
        <button type="button" className="primary" onClick={() => setEditing("new")}>
          {t("newUser")}
        </button>
        <input
          type="search"
          aria-label={t("search")}
          placeholder={t("search")}
          value={term}
          onChange={(event) => setTerm(event.target.value)}
        />
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t("username")}</th>
            <th>{t("roleLabel")}</th>
            <th>{t("status")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {shown.map((user) => (
            <tr key={user.id}>
              <td>{user.username}</td>
              <td>{user.role === "admin" ? t("roleAdmin") : t("roleUser")}</td>
              <td>{user.disabled ? t("statusDisabled") : t("statusNormal")}</td>
              <td>
                <button
                  type="button"
                  aria-label={`${t("edit")} ${user.username}`}
                  onClick={() => setEditing(user)}
                >
                  {t("edit")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing !== null && (
        <UserDialog
          user={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
    </section>
  );
}
