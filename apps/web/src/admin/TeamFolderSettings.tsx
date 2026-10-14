import { useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { DriveChanges, TeamFolder, VersionPolicy } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";
import { useGuarded } from "./useResource";

const GIB = 1024 ** 3;

interface Fields {
  quotaGb: string;
  maxVersions: string;
  policy: VersionPolicy;
  retentionDays: string;
  restrictDownloads: boolean;
}

const fieldsOf = (folder: TeamFolder): Fields => ({
  quotaGb: folder.quotaBytes === null ? "" : String(folder.quotaBytes / GIB),
  maxVersions: String(folder.settings.maxVersions),
  policy: folder.settings.versionPolicy,
  retentionDays:
    folder.settings.retentionDays === null ? "" : String(folder.settings.retentionDays),
  restrictDownloads: folder.settings.restrictDownloads,
});

const changesOf = (f: Fields): DriveChanges => ({
  quotaBytes: f.quotaGb === "" ? null : Math.round(Number(f.quotaGb) * GIB),
  settings: {
    maxVersions: Number(f.maxVersions),
    versionPolicy: f.policy,
    retentionDays: f.retentionDays === "" ? null : Number(f.retentionDays),
    restrictDownloads: f.restrictDownloads,
  },
});

interface FieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}

function NumberField({ label, value, onChange }: FieldProps) {
  return (
    <label>
      {label}
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

interface SettingsProps {
  readonly folder: TeamFolder;
  readonly onSaved: () => void;
}

export function TeamFolderSettings({ folder, onSaved }: SettingsProps) {
  const { t } = useI18n();
  const guarded = useGuarded();
  const [fields, setFields] = useState(() => fieldsOf(folder));
  const set = (patch: Partial<Fields>) => setFields((f) => ({ ...f, ...patch }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await guarded(() => api.updateDrive(folder.id, changesOf(fields)), t("saved"))) onSaved();
  }

  return (
    <form className="admin-settings" onSubmit={(event) => void submit(event)}>
      <NumberField
        label={t("quotaGb")}
        value={fields.quotaGb}
        onChange={(quotaGb) => set({ quotaGb })}
      />
      <NumberField
        label={t("maxVersions")}
        value={fields.maxVersions}
        onChange={(maxVersions) => set({ maxVersions })}
      />
      <label>
        {t("versionPolicy")}
        <select
          value={fields.policy}
          onChange={(event) => set({ policy: event.target.value as VersionPolicy })}
        >
          <option value="fifo">{t("policyFifo")}</option>
          <option value="intelligent">{t("policyIntelligent")}</option>
        </select>
      </label>
      <NumberField
        label={t("retentionDays")}
        value={fields.retentionDays}
        onChange={(retentionDays) => set({ retentionDays })}
      />
      <label className="check">
        <input
          type="checkbox"
          checked={fields.restrictDownloads}
          onChange={(event) => set({ restrictDownloads: event.target.checked })}
        />
        {t("restrictDownloads")}
      </label>
      <button type="submit" className="primary">
        {t("save")}
      </button>
    </form>
  );
}
