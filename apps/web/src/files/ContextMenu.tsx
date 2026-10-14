import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { Icon } from "../icons";
import type { ItemAction } from "./actions";

interface ContextMenuProps {
  readonly x: number;
  readonly y: number;
  readonly actions: readonly ItemAction[];
  readonly onClose: () => void;
}

/** A small menu at the pointer. Closes on Escape, on outside clicks and after choosing an entry. */
export function ContextMenu({ x, y, actions, onClose }: ContextMenuProps) {
  const { t } = useI18n();
  const menu = useRef<HTMLUListElement>(null);

  useEffect(() => {
    menu.current?.querySelector("button")?.focus();
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent && menu.current?.contains(event.target as Node)) return;
      onClose();
    };
    document.addEventListener("keydown", close);
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("mousedown", close);
    };
  }, [onClose]);

  function move(event: React.KeyboardEvent, step: number) {
    event.preventDefault();
    const buttons = [...(menu.current?.querySelectorAll("button") ?? [])];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(index + step + buttons.length) % buttons.length]?.focus();
  }

  if (actions.length === 0) return null;
  return (
    <ul
      ref={menu}
      role="menu"
      className="context-menu"
      style={{ left: x, top: y }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") move(event, 1);
        if (event.key === "ArrowUp") move(event, -1);
      }}
    >
      {actions.map((action) => (
        <li key={action.id} role="none">
          <button
            type="button"
            role="menuitem"
            className={action.danger === true ? "danger" : undefined}
            onClick={() => {
              onClose();
              action.run();
            }}
          >
            <Icon name={action.icon} />
            {t(action.label)}
          </button>
        </li>
      ))}
    </ul>
  );
}
