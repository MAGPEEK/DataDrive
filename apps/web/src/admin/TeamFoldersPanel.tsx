import { useState } from "react";
import { api } from "../api/client";
import type { Group, TeamFolder, User } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";
import { MembersEditor } from "./MembersEditor";
import { Modal } from "./Modal";
import { NameForm } from "./NameForm";
import { TeamFolderSettings } from "./TeamFolderSettings";
import { useGuarded } from "./useResource";

interface TeamFoldersPanelProps {
  readonly folders: readonly TeamFolder[];
  readonly users: readonly User[];
  readonly groups: readonly Group[];
  readonly onChanged: () => void;
}

export function TeamFoldersPanel({ folders, users, groups, onChanged }: TeamFoldersPanelProps) {
  const { t } = useI18n();
  const guarded = useGuarded();
  const [open, setOpen] = useState<TeamFolder | null>(null);
  const create = async (name: string) => {
    const done = await guarded(() => api.createTeamFolder(name), t("teamCreated", { name }));
    if (done) onChanged();
    return done;
  };
  return (
    <section aria-label={t("tabTeams")}>
      <NameForm label="newTeam" onSubmit={create} />
      {folders.length === 0 && <p className="empty">{t("nothingYet")}</p>}
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t("name")}</th>
            <th>{t("maxVersions")}</th>
            <th>{t("restrictDownloadsShort")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {folders.map((folder) => (
            <tr key={folder.id}>
              <td>{folder.name}</td>
              <td>{folder.settings.maxVersions}</td>
              <td>{folder.settings.restrictDownloads ? t("on") : t("off")}</td>
              <td>
                <button
                  type="button"
                  aria-label={`${t("settings")} ${folder.name}`}
                  onClick={() => setOpen(folder)}
                >
                  {t("settings")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {open !== null && (
        <Modal title={open.name} onClose={() => setOpen(null)}>
          <TeamFolderSettings
            folder={open}
            onSaved={() => {
              setOpen(null);
              onChanged();
            }}
          />
          <MembersEditor driveId={open.id} users={users} groups={groups} />
        </Modal>
      )}
    </section>
  );
}
