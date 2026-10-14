import { useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { Role, User } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";
import { Modal } from "./Modal";
import { useGuarded } from "./useResource";

interface UserDialogProps {
  /** The user to edit; null creates a new one. */
  readonly user: User | null;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

interface Form {
  username: string;
  password: string;
  role: Role;
  disabled: boolean;
}

const initial = (user: User | null): Form => ({
  username: user?.username ?? "",
  password: "",
  role: user?.role ?? "user",
  disabled: user?.disabled ?? false,
});

function useSave(user: User | null, form: Form, onSaved: () => void) {
  const { t } = useI18n();
  const guarded = useGuarded();
  return async (event: FormEvent) => {
    event.preventDefault();
    const work =
      user === null
        ? () => api.createUser(form)
        : () =>
            api.updateUser(user.id, {
              role: form.role,
              disabled: form.disabled,
              ...(form.password === "" ? {} : { password: form.password }),
            });
    const message = user === null ? t("userCreated", { name: form.username }) : t("saved");
    if (await guarded(work, message)) onSaved();
  };
}

export function UserDialog({ user, onClose, onSaved }: UserDialogProps) {
  const { t } = useI18n();
  const [form, setForm] = useState(() => initial(user));
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const save = useSave(user, form, onSaved);
  const canSave = form.username !== "" && (user !== null || form.password !== "");

  return (
    <Modal
      title={user === null ? t("newUser") : t("editUser", { name: user.username })}
      onClose={onClose}
    >
      <form className="admin-settings" onSubmit={(event) => void save(event)}>
        <label>
          {t("username")}
          <input
            value={form.username}
            disabled={user !== null}
            onChange={(event) => set({ username: event.target.value })}
          />
        </label>
        <label>
          {user === null ? t("password") : t("newPassword")}
          <input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => set({ password: event.target.value })}
          />
        </label>
        <label>
          {t("roleLabel")}
          <select value={form.role} onChange={(event) => set({ role: event.target.value as Role })}>
            <option value="user">{t("roleUser")}</option>
            <option value="admin">{t("roleAdmin")}</option>
          </select>
        </label>
        {user !== null && (
          <label className="check">
            <input
              type="checkbox"
              checked={form.disabled}
              onChange={(event) => set({ disabled: event.target.checked })}
            />
            {t("accountDisabled")}
          </label>
        )}
        <button type="submit" className="primary" disabled={!canSave}>
          {t("save")}
        </button>
      </form>
    </Modal>
  );
}
