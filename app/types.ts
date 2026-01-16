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
