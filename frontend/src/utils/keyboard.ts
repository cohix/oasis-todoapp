/**
 * Returns true if the currently focused element is a text input,
 * textarea, or contenteditable — used to suppress keyboard shortcuts.
 */
export function isTextInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}
