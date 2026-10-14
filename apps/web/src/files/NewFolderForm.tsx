import { useState, type FormEvent } from "react";
import { useI18n } from "../i18n/I18nProvider";

interface NewFolderFormProps {
  readonly onCreate: (name: string) => Promise<void>;
}

export function NewFolderForm({ onCreate }: NewFolderFormProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onCreate(name);
    setName("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}>
        {t("newFolder")}
      </button>
    );
  }
  return (
    <form className="inline-form" onSubmit={submit}>
      <label>
        <span className="visually-hidden">{t("folderName")}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("folderName")}
          autoFocus
          required
        />
      </label>
      <button type="submit" className="primary">
        {t("create")}
      </button>
      <button type="button" onClick={() => setOpen(false)}>
        {t("cancel")}
      </button>
    </form>
  );
}
