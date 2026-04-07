# Keyboard Navigation

Work item: 0003-keyboard-nav

Operate the entire todoapp without a mouse using the keyboard shortcuts below.

## Shortcuts

| Key | Action |
|-----|--------|
| `←` / `→` | Navigate between work areas. Shakes the tab bar when you reach an edge. |
| `↑` / `↓` | Move selection up or down through todos (bundles first, then ungrouped). Shakes the list at the boundary. With no selection, `↑` selects the last todo and `↓` selects the first. |
| `W` | Move the selected todo toward the top — into the bundle above, or (if no bundles) bundle it with the todo above. Error shake at the top boundary. |
| `S` | Move the selected todo toward the bottom — into the bundle below, or ungroup if it is in the last bundle. Error shake at the bottom boundary. |
| `A` | Move the selected todo to the work area on the left. Shakes and flashes red if no area exists to the left. |
| `D` | Move the selected todo to the work area on the right. Shakes and flashes red if no area exists to the right. |
| `T` | Focus and highlight the "new todo" input at the top of the current work area. |
| `N` | Open the new work area input (same as clicking `+`). |
| `Escape` | Deselect the highlighted todo. |

> **Note:** All shortcuts are suppressed while any text input or contenteditable element is focused, so you can type freely without triggering navigation.

## Visual Feedback

- **Selected todo** — highlighted with a border outline.
- **Error todo** (A/D with no adjacent area) — shakes and flashes a red outline, then clears automatically.
- **List shake** (Up/Down/W/S boundary) — the todo list container shakes briefly.
- **Tab bar shake** (Left/Right boundary) — the tab strip shakes briefly.
- **New-todo input highlight** (T key) — the input gains a blue ring and focus.
