import { useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { Icon } from "../icons";

interface SearchBoxProps {
  /** The term of the currently shown search, so the field follows navigation. */
  readonly activeTerm: string | null;
  readonly onSearch: (term: string) => void;
  readonly onClear: () => void;
}

const DEBOUNCE_MS = 300;
const MIN_LENGTH = 2;

export function SearchBox({ activeTerm, onSearch, onClear }: SearchBoxProps) {
  const { t } = useI18n();
  const [value, setValue] = useState(activeTerm ?? "");

  useEffect(() => {
    if (activeTerm === null) setValue("");
  }, [activeTerm]);

  useEffect(() => {
    const term = value.trim();
    if (term.length < MIN_LENGTH || term === activeTerm) return undefined;
    const timer = setTimeout(() => onSearch(term), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, activeTerm, onSearch]);

  return (
    <form
      className="search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim() !== "") onSearch(value.trim());
      }}
    >
      <Icon name="search" />
      <input
        type="search"
        value={value}
        aria-label={t("search")}
        placeholder={t("searchPlaceholder")}
        onChange={(event) => {
          setValue(event.target.value);
          if (event.target.value === "") onClear();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setValue("");
            onClear();
          }
        }}
      />
    </form>
  );
}
