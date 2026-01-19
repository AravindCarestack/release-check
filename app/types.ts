export interface SEOAnalysisResult {
  score: number;
  passed: string[];
  warnings: string[];
  failed: string[];
  details: {
    metaTags: MetaTagCheck;
    openGraph: OpenGraphCheck;
    twitter: TwitterCheck;
    robots: RobotsCheck;
    links: LinksCheck;
    technical: TechnicalCheck;
    performance?: PerformanceCheck;
    security?: SecurityCheck;
    accessibility?: AccessibilityCheck;
    analytics?: AnalyticsCheck;
    caching?: CachingCheck;
  };
}

export interface MetaTagCheck {
  title: CheckResult;
  description: CheckResult;
  robots: CheckResult;
  canonical: CheckResult;
}

export interface OpenGraphCheck {
  title: CheckResult;
  description: CheckResult;
  image: CheckResult;
  url: CheckResult;
  type: CheckResult;
}

export interface TwitterCheck {
  card: CheckResult;
  title: CheckResult;
  description: CheckResult;
  image: CheckResult;
}

export interface RobotsCheck {
  robotsTxtExists: CheckResult;
  disallowAll: CheckResult;
  sitemapReference: CheckResult;
  noindexMeta: CheckResult;
}

export interface LinksCheck {
  totalLinks: number;
  internalLinks: number;
  externalLinks: number;
  brokenLinks: BrokenLink[];
}

export interface BrokenLink {
  url: string;
  status: number;
  type: "internal" | "external";
}

export interface TechnicalCheck {
  httpsEnabled: CheckResult;
  httpRedirect: CheckResult;
  statusCode: CheckResult;
  viewport: CheckResult;
  charset: CheckResult;
  h1Count: CheckResult;
  multipleH1: CheckResult;
}

export interface CheckResult {
  status: "pass" | "warn" | "fail";
  message: string;
  value?: string | number | boolean;
  recommendation?: string;
}

export interface PerformanceCheck {
  pageLoadTime: CheckResult;
  ttfb: CheckResult;
  domContentLoaded: CheckResult;
  totalPageSize: CheckResult;
  imageOptimization: CheckResult;
  renderBlockingResources: CheckResult;
  fontLoading: CheckResult;
  thirdPartyScripts: CheckResult;
}

export interface SecurityCheck {
  contentSecurityPolicy: CheckResult;
  xFrameOptions: CheckResult;
  xContentTypeOptions: CheckResult;
  strictTransportSecurity: CheckResult;
  referrerPolicy: CheckResult;
  permissionsPolicy: CheckResult;
  sslCertificate: CheckResult;
  mixedContent: CheckResult;
  cookieSecurity: CheckResult;
}

export interface AccessibilityCheck {
  altText: CheckResult;
  formLabels: CheckResult;
  ariaAttributes: CheckResult;
  headingHierarchy: CheckResult;
  semanticHtml: CheckResult;
  keyboardNavigation: CheckResult;
  focusIndicators: CheckResult;
}

export interface AnalyticsCheck {
  googleAnalytics: CheckResult;
  googleTagManager: CheckResult;
  facebookPixel: CheckResult;
  trackingConsent: CheckResult;
}

export interface CachingCheck {
  cacheControl: CheckResult;
  etag: CheckResult;
  cdnUsage: CheckResult;
  staticAssetCaching: CheckResult;
}
