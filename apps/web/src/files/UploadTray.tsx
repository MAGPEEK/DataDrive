import { useI18n } from "../i18n/I18nProvider";
import type { UploadItem } from "../workspace/useCommands";

interface UploadTrayProps {
  readonly uploads: readonly UploadItem[];
  readonly onClear: () => void;
}

export function UploadTray({ uploads, onClear }: UploadTrayProps) {
  const { t } = useI18n();
  if (uploads.length === 0) return null;
  const busy = uploads.some((u) => u.status === "uploading");
  return (
    <section className="upload-tray" aria-label={t("upload")}>
      <header>
        <strong>{t("upload")}</strong>
        {!busy && (
          <button type="button" className="icon-only" aria-label={t("close")} onClick={onClear}>
            ×
          </button>
        )}
      </header>
      <ul>
        {uploads.map((upload) => (
          <li key={upload.id} className={upload.status}>
            <span>
              {upload.status === "uploading" ? t("uploading", { name: upload.name }) : upload.name}
            </span>
            <progress
              aria-hidden="true"
              {...(upload.status === "uploading" ? {} : { value: 1, max: 1 })}
            />
            {upload.status === "done" && (
              <span className="visually-hidden">{t("uploadDone", { name: upload.name })}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
