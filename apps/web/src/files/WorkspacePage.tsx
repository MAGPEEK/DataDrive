import { useState } from "react";
import type { NodeInfo } from "../api/types";
import { Sidebar } from "../nav/Sidebar";
import { Topbar } from "../shell/Topbar";
import { Toaster } from "../workspace/ToastProvider";
import { useWorkspace } from "../workspace/useWorkspace";
import { DetailsPanel } from "./DetailsPanel";
import { DropArea } from "./DropArea";
import { ListPane } from "./ListPane";
import { MoveDialog } from "./MoveDialog";
import { UploadTray } from "./UploadTray";
import { useItemHandlers } from "./useItemHandlers";

export function WorkspacePage({ username }: { readonly username: string }) {
  const ws = useWorkspace();
  const [moving, setMoving] = useState<readonly NodeInfo[] | null>(null);
  const handlers = useItemHandlers(ws, setMoving);
  const { location } = ws;
  const driveId = location !== null && "driveId" in location ? location.driveId : undefined;
  const drive = ws.drives.find((d) => d.id === driveId);
  const writable = location?.kind === "drive" && drive !== undefined && drive.role !== "viewer";

  return (
    <>
      <Topbar
        username={username}
        location={location}
        onSearch={(term) => ws.navigate({ kind: "search", term })}
        onClearSearch={() => location?.kind === "search" && ws.home()}
      />
      <div className={ws.detailsOpen ? "workspace with-details" : "workspace"}>
        <Sidebar drives={ws.drives} location={location} onNavigate={ws.navigate} />
        <DropArea enabled={writable} onFiles={(files) => void ws.upload(files)}>
          {location !== null && (
            <ListPane ws={ws} location={location} drive={drive} handlers={handlers} />
          )}
        </DropArea>
        {ws.detailsOpen && <DetailsPanel selected={ws.selected} onClose={ws.toggleDetails} />}
      </div>
      <UploadTray uploads={ws.uploads} onClear={ws.clearFinished} />
      <Toaster />
      {moving !== null && (
        <MoveDialog
          items={moving}
          onClose={() => setMoving(null)}
          onMove={(parentId) => {
            void ws.move(moving, parentId);
            setMoving(null);
          }}
        />
      )}
    </>
  );
}
