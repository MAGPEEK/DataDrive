import { useState, type FormEvent } from "react";
import { describeError } from "../api/describe-error";
import { ApiError } from "../api/http";
import { useI18n } from "../i18n/I18nProvider";
import { LanguageSwitch } from "../LanguageSwitch";
import { Logo } from "../Logo";
import { useSession } from "./SessionProvider";

export function LoginPage() {
  const { t } = useI18n();
  const { signIn } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [needsOtp, setNeedsOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn({ username, password, otp: needsOtp ? otp : undefined });
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === "otp_required") setNeedsOtp(true);
      else setError(describeError(failure, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="card" onSubmit={submit}>
        <Logo />
        <label>
          {t("username")}
          <input
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label>
          {t("password")}
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {needsOtp && (
          <label>
            {t("otpCode")}
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />
            <small>{t("otpHint")}</small>
          </label>
        )}
        {error !== null && <p role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>
          {busy ? t("signingIn") : t("signIn")}
        </button>
        <LanguageSwitch />
      </form>
    </main>
  );
}
