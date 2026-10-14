import { useI18n } from "./i18n/I18nProvider";
import type { Language } from "./i18n/messages";

const OPTIONS: readonly { value: Language; label: string }[] = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "English" },
];

export function LanguageSwitch() {
  const { language, setLanguage, t } = useI18n();
  return (
    <label className="language">
      <span className="visually-hidden">{t("language")}</span>
      <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
