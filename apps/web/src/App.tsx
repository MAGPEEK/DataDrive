import { LoginPage } from "./auth/LoginPage";
import { SessionProvider, useSession } from "./auth/SessionProvider";
import { WorkspacePage } from "./files/WorkspacePage";
import { I18nProvider, useI18n } from "./i18n/I18nProvider";
import { ToastProvider } from "./workspace/ToastProvider";

function Gate() {
  const { t } = useI18n();
  const { state } = useSession();
  if (state.status === "loading") return <p className="loading">{t("loading")}</p>;
  if (state.status === "anonymous") return <LoginPage />;
  return <WorkspacePage username={state.user.username} />;
}

export function App() {
  return (
    <I18nProvider>
      <SessionProvider>
        <ToastProvider>
          <Gate />
        </ToastProvider>
      </SessionProvider>
    </I18nProvider>
  );
}
