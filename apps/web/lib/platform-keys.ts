/** Shortcut hints are written Mac-style (⌘, ⇧, ⌫); show Ctrl/Shift/Backspace elsewhere. */
export function platformKeys(text: string): string {
  if (
    typeof navigator === 'undefined' ||
    /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  )
    return text;
  return text.replace(/⇧⌘/g, 'Ctrl+Shift+').replace(/⌘/g, 'Ctrl+').replace(/⌫/g, 'Backspace');
}
