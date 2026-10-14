import { useState } from "react";
import { AdminPage } from "./admin/AdminPage";
import { LoginPage } from "./auth/LoginPage";
import { SessionProvider, useSession } from "./auth/SessionProvider";
import { WorkspacePage } from "./files/WorkspacePage";
import type { User } from "./api/types";
import { I18nProvider, useI18n } from "./i18n/I18nProvider";
import { ToastProvider } from "./workspace/ToastProvider";

function Signed({ user }: { readonly user: User }) {
  const [admin, setAdmin] = useState(false);
  if (admin) return <AdminPage onBack={() => setAdmin(false)} />;
  const open = user.role === "admin" ? () => setAdmin(true) : undefined;
  return <WorkspacePage username={user.username} onOpenAdmin={open} />;
}

function Gate() {
  const { t } = useI18n();
  const { state } = useSession();
  if (state.status === "loading") return <p className="loading">{t("loading")}</p>;
  if (state.status === "anonymous") return <LoginPage />;
  return <Signed user={state.user} />;
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
