import { useI18n } from "../i18n/I18nProvider";

interface OverviewProps {
  readonly users: number;
  readonly groups: number;
  readonly folders: number;
}

function Figure({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="admin-figure">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function Overview({ users, groups, folders }: OverviewProps) {
  const { t } = useI18n();
  return (
    <section aria-label={t("overview")} className="admin-figures">
      <Figure label={t("tabUsers")} value={users} />
      <Figure label={t("tabGroups")} value={groups} />
      <Figure label={t("tabTeams")} value={folders} />
    </section>
  );
}
