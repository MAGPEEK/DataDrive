import { useCallback, useEffect, useState } from "react";
import { describeError } from "../api/describe-error";
import { useI18n } from "../i18n/I18nProvider";
import { useToasts } from "../workspace/ToastProvider";

/** Loads a list once and again whenever `reload` is called; failures show up as a toast. */
export function useResource<T>(load: () => Promise<T[]>) {
  const { t } = useI18n();
  const { push } = useToasts();
  const [items, setItems] = useState<readonly T[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    load()
      .then((list) => live && setItems(list))
      .catch((error: unknown) => {
        if (live) push({ kind: "error", message: describeError(error, t) });
      });
    return () => {
      live = false;
    };
  }, [tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { items, reload };
}

/** Runs a change; reports success or failure as a toast and tells the caller whether it worked. */
export function useGuarded() {
  const { t } = useI18n();
  const { push } = useToasts();
  return async (work: () => Promise<unknown>, success?: string): Promise<boolean> => {
    try {
      await work();
      if (success !== undefined) push({ kind: "info", message: success });
      return true;
    } catch (failure) {
      push({ kind: "error", message: describeError(failure, t) });
      return false;
    }
  };
}
