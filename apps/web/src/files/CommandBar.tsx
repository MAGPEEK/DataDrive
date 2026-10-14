import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { Icon } from "../icons";
import type { ItemAction } from "./actions";

interface CommandBarProps {
  readonly canCreate: boolean;
  readonly onCreateFolder: () => void;
  readonly onUpload: (files: readonly File[]) => void;
  readonly actions: readonly ItemAction[];
  readonly detailsOpen: boolean;
  readonly onToggleDetails: () => void;
  readonly onRefresh: () => void;
}

/** Actions that only make sense in the context menu or through double click. */
const MENU_ONLY = new Set(["open", "show"]);

function CreateMenu({
  onCreateFolder,
  onUpload,
}: Pick<CommandBarProps, "onCreateFolder" | "onUpload">) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent && root.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("mousedown", close);
    };
  }, [open]);

  return (
    <div className="create" ref={root}>
      <button
        type="button"
        className="primary pill"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name="plus" /> {t("create")}
      </button>
      {open && (
        <ul role="menu" className="menu">
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onCreateFolder();
              }}
            >
              <Icon name="folder" /> {t("newFolder")}
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                picker.current?.click();
              }}
            >
              <Icon name="upload" /> {t("uploadFiles")}
            </button>
          </li>
        </ul>
      )}
      <input
        ref={picker}
        type="file"
        multiple
        hidden
        data-testid="upload-input"
        onChange={(event) => {
          onUpload([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
    </div>
  );
}

export function CommandBar(props: CommandBarProps) {
  const { t } = useI18n();
  return (
    <div className="commandbar" role="toolbar" aria-label={t("actions")}>
      {props.canCreate && (
        <CreateMenu onCreateFolder={props.onCreateFolder} onUpload={props.onUpload} />
      )}
      <div className="item-actions">
        {props.actions
          .filter((action) => !MENU_ONLY.has(action.id))
          .map((action) => (
            <button
              key={action.id}
              type="button"
              className={action.danger === true ? "tool danger" : "tool"}
              onClick={action.run}
            >
              <Icon name={action.icon} />
              <span>{t(action.label)}</span>
            </button>
          ))}
      </div>
      <div className="spacer" />
      <button
        type="button"
        className="tool"
        aria-pressed={props.detailsOpen}
        onClick={props.onToggleDetails}
      >
        <Icon name="info" />
        <span>{t("details")}</span>
      </button>
      <button type="button" className="tool" onClick={props.onRefresh}>
        <Icon name="refresh" />
        <span className="visually-hidden">{t("refresh")}</span>
      </button>
    </div>
  );
}
