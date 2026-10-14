import { useI18n } from "../i18n/I18nProvider";

interface StatusBarProps {
  readonly count: number;
  readonly selected: number;
}

export function StatusBar({ count, selected }: StatusBarProps) {
  const { t } = useI18n();
  return (
    <footer className="statusbar">
      <span>{count === 1 ? t("itemCountOne") : t("itemCount", { count: String(count) })}</span>
      {selected > 0 && <span>{t("selectedCount", { count: String(selected) })}</span>}
    </footer>
  );
}
