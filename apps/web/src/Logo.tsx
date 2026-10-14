import { useI18n } from "./i18n/I18nProvider";

export function Logo() {
  const { t } = useI18n();
  return (
    <div className="logo">
      <svg viewBox="0 0 256 256" width="32" height="32" aria-hidden="true">
        <rect x="40" y="76" width="176" height="52" rx="26" fill="var(--logo-dark)" />
        <rect x="40" y="144" width="176" height="52" rx="26" fill="var(--accent)" />
        <circle cx="66" cy="102" r="9" fill="#fff" />
        <circle cx="66" cy="170" r="9" fill="#fff" />
      </svg>
      <span>{t("appName")}</span>
    </div>
  );
}
