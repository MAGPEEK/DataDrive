import { useState, type FormEvent } from "react";
import { describeError } from "../api/describe-error";
import { ApiError } from "../api/http";
import { useI18n } from "../i18n/I18nProvider";
import { Icon } from "../icons";
import { LanguageSwitch } from "../LanguageSwitch";
import { Logo } from "../Logo";
import { useSession } from "./SessionProvider";

type Step = "username" | "password" | "otp";

function useSignInFlow() {
  const { t } = useI18n();
  const { signIn } = useSession();
  const [step, setStep] = useState<Step>("username");
  const [values, setValues] = useState({ username: "", password: "", otp: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (field: Step, value: string) => setValues((v) => ({ ...v, [field]: value }));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn({ ...values, otp: step === "otp" ? values.otp : undefined });
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === "otp_required") setStep("otp");
      else setError(describeError(failure, t));
    } finally {
      setBusy(false);
    }
  }

  function advance(event: FormEvent) {
    event.preventDefault();
    if (values[step].trim() === "") return;
    if (step === "username") setStep("password");
    else void submit();
  }

  function back() {
    setStep("username");
    setError(null);
    setValues((v) => ({ ...v, password: "", otp: "" }));
  }
  return { step, values, set, error, busy, advance, back };
}

const FIELD: Record<
  Step,
  { label: "username" | "password" | "otpCode"; type: string; complete: string }
> = {
  username: { label: "username", type: "text", complete: "username" },
  password: { label: "password", type: "password", complete: "current-password" },
  otp: { label: "otpCode", type: "text", complete: "one-time-code" },
};

/** Sign-in in two steps (username, then password, then a one-time code if the account needs one). */
export function LoginPage() {
  const { t } = useI18n();
  const flow = useSignInFlow();
  const field = FIELD[flow.step];
  const value = flow.values[flow.step];

  return (
    <main className="signin" style={{ backgroundImage: "url(/login-background.svg)" }}>
      <form className="signin-card" onSubmit={flow.advance} noValidate>
        <h1>{t("welcomeBack")}</h1>
        <p className="signin-title">{t("signIn")}</p>
        {flow.step !== "username" && (
          <button type="button" className="signin-user" onClick={flow.back} aria-label={t("back")}>
            <Icon name="arrow" size={14} />
            <span>{flow.values.username}</span>
          </button>
        )}
        <input
          key={flow.step}
          className="signin-input"
          type={field.type}
          name={field.label}
          autoComplete={field.complete}
          inputMode={flow.step === "otp" ? "numeric" : undefined}
          aria-label={t(field.label)}
          placeholder={t(field.label)}
          value={value}
          onChange={(event) => flow.set(flow.step, event.target.value)}
          disabled={flow.busy}
          autoFocus
        />
        {flow.step === "otp" && <p className="signin-hint">{t("otpHint")}</p>}
        {flow.error !== null && <p role="alert">{flow.error}</p>}
        <button
          type="submit"
          className="signin-next"
          aria-label={flow.step === "username" ? t("next") : t("signIn")}
          disabled={flow.busy || value.trim() === ""}
        >
          <Icon name="arrow" size={34} />
        </button>
        <footer className="signin-footer">
          <Logo />
          <LanguageSwitch />
        </footer>
      </form>
    </main>
  );
}
