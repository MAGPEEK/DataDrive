import { useState, type DragEvent, type ReactNode } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { Breadcrumbs } from "./Breadcrumbs";
import { NewFolderForm } from "./NewFolderForm";
import { NodeTable } from "./NodeTable";
import { Sidebar } from "./Sidebar";
import { TrashTable } from "./TrashTable";
import { UploadButton } from "./UploadButton";
import { useBrowser, type Browser } from "./useBrowser";

interface DropAreaProps {
  readonly enabled: boolean;
  readonly onFiles: (files: readonly File[]) => void;
  readonly children: ReactNode;
}

/** Accepts files dropped onto the content area when the user may upload. */
function DropArea({ enabled, onFiles, children }: DropAreaProps) {
  const { t } = useI18n();
  const [dragging, setDragging] = useState(false);

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (enabled) onFiles([...event.dataTransfer.files]);
  }

  function over(event: DragEvent) {
    event.preventDefault();
    if (enabled) setDragging(true);
  }

  return (
    <section
      className={dragging ? "content dragging" : "content"}
      onDragOver={over}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
    >
      {children}
      {dragging && <div className="drop-hint">{t("dropToUpload")}</div>}
    </section>
  );
}

function Messages({ browser }: { readonly browser: Browser }) {
  const { t } = useI18n();
  return (
    <>
      {browser.error !== null && <p role="alert">{browser.error}</p>}
      {browser.uploading !== null && (
        <p role="status">{t("uploading", { name: browser.uploading })}</p>
      )}
    </>
  );
}

function FilesView({
  browser,
  canWrite,
}: {
  readonly browser: Browser;
  readonly canWrite: boolean;
}) {
  const { t } = useI18n();
  const rootLabel = browser.drive?.kind === "team" ? browser.drive.name : t("myDrive");
  return (
    <>
      <div className="toolbar">
        <Breadcrumbs rootLabel={rootLabel} trail={browser.trail} onNavigate={browser.goTo} />
        {canWrite && (
          <div className="actions">
            <NewFolderForm onCreate={browser.createFolder} />
            <UploadButton onFiles={(files) => void browser.upload(files)} />
          </div>
        )}
      </div>
      <Messages browser={browser} />
      <NodeTable
        nodes={browser.nodes}
        canWrite={canWrite}
        onOpen={browser.openFolder}
        onTrash={(node) => void browser.moveToTrash(node)}
      />
    </>
  );
}

function TrashView({ browser }: { readonly browser: Browser }) {
  const { t } = useI18n();
  return (
    <>
      <h1>{t("trash")}</h1>
      <Messages browser={browser} />
      <TrashTable nodes={browser.nodes} onRestore={(node) => void browser.restore(node)} />
    </>
  );
}

export function BrowserPage() {
  const browser = useBrowser();
  const canWrite = browser.drive !== null && browser.drive.role !== "viewer";
  return (
    <div className="layout">
      <Sidebar
        drives={browser.drives}
        selectedId={browser.driveId}
        view={browser.view}
        onSelect={browser.selectDrive}
        onTrash={browser.showTrash}
      />
      <DropArea enabled={canWrite} onFiles={(files) => void browser.upload(files)}>
        {browser.view === "files" ? (
          <FilesView browser={browser} canWrite={canWrite} />
        ) : (
          <TrashView browser={browser} />
        )}
      </DropArea>
    </div>
  );
}
