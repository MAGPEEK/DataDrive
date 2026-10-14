import { useRef, type ChangeEvent } from "react";
import { useI18n } from "../i18n/I18nProvider";

interface UploadButtonProps {
  readonly onFiles: (files: readonly File[]) => void;
}

export function UploadButton({ onFiles }: UploadButtonProps) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);

  function selected(event: ChangeEvent<HTMLInputElement>) {
    onFiles([...(event.target.files ?? [])]);
    event.target.value = "";
  }

  return (
    <>
      <button type="button" className="primary" onClick={() => input.current?.click()}>
        {t("upload")}
      </button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        data-testid="upload-input"
        onChange={selected}
      />
    </>
  );
}
