# Website SEO & Deployment Readiness Validator

A production-ready Next.js 14 web application that audits websites for SEO and technical readiness.

## Features

- **Single Page Analysis**
  - Meta tags (title, description, robots, canonical)
  - Open Graph tags for social media sharing
  - Twitter Card tags
  - Robots.txt and indexing configuration
  - Link health checking (internal/external, broken links)
  - Technical SEO checks (HTTPS, viewport, charset, H1 tags)

- **Multi-Page Crawling** (NEW)
  - Crawls internal links using breadth-first search
  - Configurable page limit (default: 25 pages)
  - Per-page SEO analysis with status indicators
  - Filterable results (failed pages, missing H1, missing description)
  - SSRF protection and safety measures
  - Concurrent analysis with rate limiting

- **User-Friendly Interface**
  - Clean, modern UI with Tailwind CSS
  - Real-time loading states
  - Detailed results with expandable sections
  - Color-coded pass/warn/fail indicators
  - Overall SEO score (0-100)

- **Production Ready**
  - TypeScript for type safety
  - Server-side analysis with proper error handling
  - Timeout protection
  - Redirect handling
  - Responsive design

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Cheerio** (HTML parsing)
- **Axios** (HTTP requests)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

### Build for Production

```bash
npm run build
npm start
```

## Usage

### Single Page Analysis
1. Enter a website URL in the input field (HTTPS recommended)
2. Click "Analyze Website"
3. Review the comprehensive SEO analysis results
4. Check the detailed breakdown in expandable sections
5. Follow recommendations to improve your SEO score

### Multi-Page Crawling
1. Enter a website URL
2. Enable "Multi-Page Crawling" checkbox
3. Set maximum pages to crawl (default: 25)
4. Click "Analyze Website"
5. Review the grid of page cards with SEO status
6. Use filters to find specific issues (failed pages, missing H1, etc.)

## SEO Checks Performed

### Meta Tags
- Title tag presence and length (30-60 chars optimal)
- Meta description presence and length (120-160 chars optimal)
- Meta robots configuration
- Canonical URL

### Open Graph
- og:title
- og:description
- og:image
- og:url
- og:type

### Twitter Cards
- twitter:card (prefers summary_large_image)
- twitter:title
- twitter:description
- twitter:image

### Robots & Indexing
- robots.txt existence
- Disallow: / detection
- Sitemap reference
- Meta robots noindex check

### Links
- Total link count
- Internal vs external classification
- Broken link detection (HTTP status >= 400)

### Technical SEO
- HTTPS enabled
- HTTP → HTTPS redirect
- HTTP 200 status code
- Viewport meta tag
- Charset declaration
- H1 tag presence (warns if multiple)

## Scoring

The overall SEO score (0-100) is calculated based on:
- **Pass**: Full points (1.0)
- **Warning**: Half points (0.5)
- **Fail**: No points (0.0)

Score = (Passes × 1.0 + Warnings × 0.5) / Total Checks × 100

## Project Structure

```
├── app/
│   ├── api/
│   │   └── analyze/
│   │       └── route.ts          # API endpoint for analysis
│   ├── results/
│   │   └── page.tsx              # Results page (single & multi-page)
│   ├── globals.css                # Global styles
│   ├── layout.tsx                 # Root layout
│   ├── page.tsx                   # Home page
│   └── types.ts                   # TypeScript types
├── components/
│   ├── CheckSection.tsx           # Expandable check section
│   ├── ResultsDisplay.tsx         # Single page results display
│   ├── ScoreBadge.tsx             # Score badge component
│   ├── PageCard.tsx               # Individual page card (multi-page)
│   ├── PageGrid.tsx               # Grid of page cards with filters
│   └── StatusBadge.tsx            # Status badge (pass/warn/fail)
├── lib/
│   ├── seo-analyzer.ts            # Single page SEO analysis
│   ├── crawler.ts                 # Website crawler (BFS)
│   └── page-analyzer.ts           # Per-page SEO analysis
└── package.json
```

## Crawling Features

### How It Works
- **Breadth-First Search**: Crawls pages level by level starting from the root URL
- **Internal Links Only**: Only follows links with the same hostname
- **Smart Filtering**: Automatically ignores:
  - `mailto:`, `tel:`, `javascript:`, `data:` links
  - Hash fragments (`#section`)
  - PDFs and image files
  - External links
- **Safety**: SSRF protection blocks localhost and private IP ranges
- **Performance**: Concurrent analysis with configurable limits (default: 5 concurrent)

### Per-Page Analysis
Each crawled page is analyzed for:
- **H1 Tags**: Count and validation (pass if exactly 1, warn if 0 or >1)
- **Meta Tags**: title, description, robots, canonical
- **Open Graph**: title, description, image
- **Twitter Cards**: card type, title, description, image

### Status Calculation
- **Pass**: No issues found
- **Warn**: 1-2 issues found
- **Fail**: 3+ issues found

## License

MIT
