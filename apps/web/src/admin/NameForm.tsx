import { useState, type FormEvent } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n/messages";

interface NameFormProps {
  readonly label: MessageKey;
  /** Resolves true when the name was accepted, which clears the field. */
  readonly onSubmit: (name: string) => Promise<boolean>;
}

/** A single-field "create something with a name" form. */
export function NameForm({ label, onSubmit }: NameFormProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim() !== "" && (await onSubmit(name.trim()))) setName("");
  }

  return (
    <form className="admin-form" onSubmit={(event) => void submit(event)}>
      <input
        aria-label={t(label)}
        placeholder={t(label)}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <button type="submit" className="primary" disabled={name.trim() === ""}>
        {t("add")}
      </button>
    </form>
  );
}
