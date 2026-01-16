/**
 * Detects locale/region from URL path
 * Supports common patterns like:
 * - /en-GB, /en-AU, /en-US
 * - /gb/, /au/, /us/
 * - /en/gb/, /en/au/
 * - /fr/, /de/, /es/
 */

export interface LocaleInfo {
  locale: string; // e.g., "en-GB", "en-AU", "default"
  region: string; // e.g., "GB", "AU", "US", or "default"
  displayName: string; // e.g., "English (GB)", "English (AU)", "Default"
}

/**
 * Common locale patterns in URL paths
 */
const LOCALE_PATTERNS = [
  // ISO 639-1 language codes with ISO 3166-1 country codes (e.g., en-GB, en-AU)
  /^\/([a-z]{2})-([A-Z]{2})(\/|$)/,
  // Two-letter language code (e.g., /en/, /fr/, /de/)
  /^\/([a-z]{2})(\/|$)/,
  // Two-letter country code (e.g., /gb/, /au/, /us/)
  /^\/([a-z]{2})(\/|$)/,
];

/**
 * Language code to display name mapping
 */
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  fr: "French",
  de: "German",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  pl: "Polish",
  ru: "Russian",
  ja: "Japanese",
  zh: "Chinese",
  ko: "Korean",
  ar: "Arabic",
  hi: "Hindi",
};

/**
 * Country code to country name mapping
 */
const COUNTRY_NAMES: Record<string, string> = {
  GB: "United Kingdom",
  US: "United States",
  AU: "Australia",
  CA: "Canada",
  NZ: "New Zealand",
  IE: "Ireland",
  IN: "India",
  SG: "Singapore",
  MY: "Malaysia",
  PH: "Philippines",
  ZA: "South Africa",
};

/**
 * Extracts locale information from a URL
 * Detects country based on URL patterns:
 * - If URL contains "en-au" → Australia
 * - If URL contains "en-gb" → UK
 * - Otherwise → US
 */
export function detectLocale(url: string): LocaleInfo {
  try {
    const urlLower = url.toLowerCase();
    
    // Check for en-au pattern anywhere in the URL
    if (urlLower.includes("en-au")) {
      return {
        locale: "en-AU",
        region: "AU",
        displayName: "Australia",
      };
    }
    
    // Check for en-gb pattern anywhere in the URL
    if (urlLower.includes("en-gb")) {
      return {
        locale: "en-GB",
        region: "GB",
        displayName: "United Kingdom",
      };
    }
    
    // Default: US version
    return {
      locale: "en-US",
      region: "US",
      displayName: "United States",
    };
  } catch {
    // Default: US version on error
    return {
      locale: "en-US",
      region: "US",
      displayName: "United States",
    };
  }
}

/**
 * Groups pages by locale
 */
export function groupPagesByLocale<T extends { url: string }>(
  pages: T[]
): Map<string, { locale: LocaleInfo; pages: T[] }> {
  const groups = new Map<string, { locale: LocaleInfo; pages: T[] }>();
  
  for (const page of pages) {
    const localeInfo = detectLocale(page.url);
    const key = localeInfo.locale;
    
    if (!groups.has(key)) {
      groups.set(key, { locale: localeInfo, pages: [] });
    }
    
    groups.get(key)!.pages.push(page);
  }
  
  return groups;
}

/**
 * Sorts locale groups by display name, with "en-US" (US) always first
 */
export function sortLocaleGroups(
  groups: Map<string, { locale: LocaleInfo; pages: any[] }>
): Array<{ locale: LocaleInfo; pages: any[] }> {
  const sorted = Array.from(groups.values());
  
  sorted.sort((a, b) => {
    // US (en-US) always comes first
    if (a.locale.locale === "en-US") return -1;
    if (b.locale.locale === "en-US") return 1;
    
    // Then sort by display name
    return a.locale.displayName.localeCompare(b.locale.displayName);
  });
  
  return sorted;
}
