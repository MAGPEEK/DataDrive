import { LoginPage } from "./auth/LoginPage";
import { SessionProvider, useSession } from "./auth/SessionProvider";
import { BrowserPage } from "./files/BrowserPage";
import { I18nProvider, useI18n } from "./i18n/I18nProvider";
import { LanguageSwitch } from "./LanguageSwitch";
import { Logo } from "./Logo";

function Header({ username }: { readonly username: string }) {
  const { t } = useI18n();
  const { signOut } = useSession();
  return (
    <header className="topbar">
      <Logo />
      <div className="topbar-right">
        <LanguageSwitch />
        <span>{username}</span>
        <button type="button" onClick={() => void signOut()}>
          {t("signOut")}
        </button>
      </div>
    </header>
  );
}

function Gate() {
  const { t } = useI18n();
  const { state } = useSession();
  if (state.status === "loading") return <p className="loading">{t("loading")}</p>;
  if (state.status === "anonymous") return <LoginPage />;
  return (
    <>
      <Header username={state.user.username} />
      <BrowserPage />
    </>
  );
}

export function App() {
  return (
    <I18nProvider>
      <SessionProvider>
        <Gate />
      </SessionProvider>
    </I18nProvider>
  );
}
