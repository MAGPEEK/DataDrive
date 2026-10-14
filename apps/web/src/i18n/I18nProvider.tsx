import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { LANGUAGES, type Language, type MessageKey } from "./messages";

const STORAGE_KEY = "datadrive.language";

export function detectLanguage(preferred: readonly string[], stored: string | null): Language {
  if (stored !== null && stored in LANGUAGES) return stored as Language;
  const first = preferred.find((tag) => tag.slice(0, 2).toLowerCase() in LANGUAGES);
  return first === undefined ? "en" : (first.slice(0, 2).toLowerCase() as Language);
}

export function translate(
  language: Language,
  key: MessageKey,
  params?: Record<string, string>,
): string {
  const template = LANGUAGES[language][key];
  if (params === undefined) return template;
  return template.replace(/\{(\w+)\}/gu, (match, name: string) => params[name] ?? match);
}

interface I18nValue {
  readonly language: Language;
  readonly setLanguage: (language: Language) => void;
  readonly t: (key: MessageKey, params?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function readStoredLanguage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() =>
    detectLanguage(navigator.languages, readStoredLanguage()),
  );

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    document.documentElement.lang = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* the choice just is not remembered */
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ language, setLanguage, t: (key, params) => translate(language, key, params) }),
    [language, setLanguage],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (value === null) throw new Error("useI18n needs an I18nProvider");
  return value;
}
