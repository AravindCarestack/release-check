import { ContentCheckError } from "@/lib/content-error";

const BLOCKED_HOSTS = new Set(["0.0.0.0"]);

export function assertPublicHttpUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new ContentCheckError("Enter a valid page URL, including https://");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ContentCheckError("Only http and https page URLs can be checked");
  }
  if (url.username || url.password) {
    throw new ContentCheckError("URLs with a username or password are not allowed");
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isLoopback(host)) return url;

  if (
    BLOCKED_HOSTS.has(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    isPrivateIp(host)
  ) {
    throw new ContentCheckError("That URL cannot be fetched");
  }

  return url;
}

function isLoopback(host: string): boolean {
  if (host === "localhost" || host.endsWith(".localhost") || host === "::1") return true;
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  return parts[0] === 127 && parts.every((part) => part <= 255);
}

function isPrivateIp(host: string): boolean {
  if (host.includes(":")) {
    return (
      host === "::1" ||
      host.startsWith("fe80:") ||
      host.startsWith("fc") ||
      host.startsWith("fd")
    );
  }

  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}
