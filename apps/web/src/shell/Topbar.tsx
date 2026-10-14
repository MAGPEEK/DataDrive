import { useSession } from "../auth/SessionProvider";
import { useI18n } from "../i18n/I18nProvider";
import { LanguageSwitch } from "../LanguageSwitch";
import { Logo } from "../Logo";
import type { Location } from "../workspace/locations";
import { SearchBox } from "./SearchBox";

interface TopbarProps {
  readonly username: string;
  readonly location: Location | null;
  readonly onSearch: (term: string) => void;
  readonly onClearSearch: () => void;
}

export function Topbar({ username, location, onSearch, onClearSearch }: TopbarProps) {
  const { t } = useI18n();
  const { signOut } = useSession();
  return (
    <header className="topbar">
      <Logo />
      <SearchBox
        activeTerm={location?.kind === "search" ? location.term : null}
        onSearch={onSearch}
        onClear={onClearSearch}
      />
      <div className="topbar-right">
        <LanguageSwitch />
        <span className="user">{username}</span>
        <button type="button" onClick={() => void signOut()}>
          {t("signOut")}
        </button>
      </div>
    </header>
  );
}
