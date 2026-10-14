import { en, type MessageKey } from "../i18n/messages";
import { ApiError } from "./http";

/** Maps a failed request to a translated, user-facing message. */
export function describeError(error: unknown, t: (key: MessageKey) => string): string {
  if (error instanceof ApiError) {
    const key = `error.${error.code}`;
    if (key in en) return t(key as MessageKey);
  }
  return t("error.unknown");
}
