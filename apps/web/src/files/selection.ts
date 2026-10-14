export interface Selection {
  readonly ids: ReadonlySet<string>;
  /** The item a shift-click range starts from. */
  readonly anchor: string | null;
}

export const emptySelection: Selection = { ids: new Set(), anchor: null };

export interface ClickModifiers {
  readonly toggle: boolean;
  readonly range: boolean;
}

/** Desktop-style selection: plain click selects one, ctrl/cmd toggles, shift selects a range. */
export interface Click extends ClickModifiers {
  readonly id: string;
}

export function applyClick(
  selection: Selection,
  orderedIds: readonly string[],
  click: Click,
): Selection {
  const { id: clicked, ...modifiers } = click;
  if (modifiers.range && selection.anchor !== null) {
    const from = orderedIds.indexOf(selection.anchor);
    const to = orderedIds.indexOf(clicked);
    if (from >= 0 && to >= 0) {
      const [start, end] = from < to ? [from, to] : [to, from];
      return { ids: new Set(orderedIds.slice(start, end + 1)), anchor: selection.anchor };
    }
  }
  if (modifiers.toggle) {
    const ids = new Set(selection.ids);
    if (ids.has(clicked)) ids.delete(clicked);
    else ids.add(clicked);
    return { ids, anchor: clicked };
  }
  return { ids: new Set([clicked]), anchor: clicked };
}

export const selectAll = (orderedIds: readonly string[]): Selection => ({
  ids: new Set(orderedIds),
  anchor: orderedIds[0] ?? null,
});

/** Keeps only ids that still exist (after reloads or deletions). */
export function prune(selection: Selection, existing: readonly string[]): Selection {
  const alive = new Set(existing);
  const ids = new Set([...selection.ids].filter((id) => alive.has(id)));
  if (ids.size === selection.ids.size) return selection;
  return {
    ids,
    anchor: selection.anchor !== null && alive.has(selection.anchor) ? selection.anchor : null,
  };
}

/** The id one step up or down from the anchor, clamped to the list. */
export function neighbor(
  orderedIds: readonly string[],
  from: string | null,
  step: 1 | -1,
): string | null {
  if (orderedIds.length === 0) return null;
  const index = from === null ? -1 : orderedIds.indexOf(from);
  if (index < 0) return orderedIds[step === 1 ? 0 : orderedIds.length - 1] ?? null;
  return orderedIds[Math.min(orderedIds.length - 1, Math.max(0, index + step))] ?? null;
}
