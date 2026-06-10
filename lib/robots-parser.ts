function getDisallowValue(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const match = trimmed.match(/^disallow:\s*(.*?)(?:\s+#.*)?$/i);
  return match ? match[1].trim().toLowerCase() : null;
}

export function hasDisallowAll(content: string): boolean {
  return content.split("\n").some((line) => getDisallowValue(line) === "/");
}

export function hasDisallowQueryParams(content: string): boolean {
  return content.split("\n").some((line) => getDisallowValue(line) === "/*?*");
}
