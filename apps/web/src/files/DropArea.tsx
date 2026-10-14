import { useState, type DragEvent, type ReactNode } from "react";
import { useI18n } from "../i18n/I18nProvider";

interface DropAreaProps {
  readonly enabled: boolean;
  readonly onFiles: (files: readonly File[]) => void;
  readonly children: ReactNode;
}

const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes("Files");

/** Accepts files dragged in from the desktop onto the content area. */
export function DropArea({ enabled, onFiles, children }: DropAreaProps) {
  const { t } = useI18n();
  const [dragging, setDragging] = useState(false);
  const accepts = (event: DragEvent) => enabled && hasFiles(event);

  return (
    <section
      className={dragging ? "content dragging" : "content"}
      onDragOver={(event) => {
        if (!accepts(event)) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={(event) => {
        setDragging(false);
        if (!accepts(event)) return;
        event.preventDefault();
        onFiles([...event.dataTransfer.files]);
      }}
    >
      {children}
      {dragging && <div className="drop-hint">{t("dropToUpload")}</div>}
    </section>
  );
}
