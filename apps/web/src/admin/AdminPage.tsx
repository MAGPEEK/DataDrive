import { useState } from "react";
import { api } from "../api/client";
import { useI18n } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n/messages";
import { LanguageSwitch } from "../LanguageSwitch";
import { Logo } from "../Logo";
import { Toaster } from "../workspace/ToastProvider";
import { GroupsPanel } from "./GroupsPanel";
import { Overview } from "./Overview";
import { TeamFoldersPanel } from "./TeamFoldersPanel";
import { UsersPanel } from "./UsersPanel";
import { useResource } from "./useResource";

type Section = "overview" | "users" | "groups" | "teams";
const SECTIONS: readonly { id: Section; label: MessageKey }[] = [
  { id: "overview", label: "overview" },
  { id: "users", label: "tabUsers" },
  { id: "groups", label: "tabGroups" },
  { id: "teams", label: "tabTeams" },
];

function useAdminData() {
  return {
    users: useResource(api.users),
    groups: useResource(api.groups),
    folders: useResource(api.teamFolders),
  };
}

type AdminData = ReturnType<typeof useAdminData>;

function Content({ section, data }: { readonly section: Section; readonly data: AdminData }) {
  const { users, groups, folders } = data;
  if (section === "users") return <UsersPanel users={users.items} onChanged={users.reload} />;
  if (section === "groups") {
    return <GroupsPanel groups={groups.items} users={users.items} onChanged={groups.reload} />;
  }
  if (section === "teams") {
    return (
      <TeamFoldersPanel
        folders={folders.items}
        users={users.items}
        groups={groups.items}
        onChanged={folders.reload}
      />
    );
  }
  return (
    <Overview
      users={users.items.length}
      groups={groups.items.length}
      folders={folders.items.length}
    />
  );
}

/** Administration console: navigation on the left, the selected section on the right. */
export function AdminPage({ onBack }: { readonly onBack: () => void }) {
  const { t } = useI18n();
  const [section, setSection] = useState<Section>("overview");
  const data = useAdminData();
  return (
    <>
      <header className="topbar admin-top">
        <Logo />
        <h1>{t("admin")}</h1>
        <div className="topbar-right">
          <LanguageSwitch />
          <button type="button" onClick={onBack}>
            {t("backToFiles")}
          </button>
        </div>
      </header>
      <div className="admin-layout">
        <nav className="admin-nav" aria-label={t("admin")}>
          {SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className="nav-item"
              aria-current={section === id ? "page" : undefined}
              onClick={() => setSection(id)}
            >
              {t(label)}
            </button>
          ))}
        </nav>
        <main className="admin">
          <h2>{t(SECTIONS.find((s) => s.id === section)?.label ?? "overview")}</h2>
          <Content section={section} data={data} />
        </main>
      </div>
      <Toaster />
    </>
  );
}
