/**
 * <title> is parsed as plain text, so React/Next markers like <!-- --> stay in the title string.
 * Remove them before showing or measuring the title.
 */
export function visibleText(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/<!--[\s\S]*?-->/g, " ").replace(/\s+/g, " ").trim();
}
