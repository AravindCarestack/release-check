export type ContentKind =
  | "heading"
  | "sentence"
  | "list-item"
  | "table-cell"
  | "link"
  | "image"
  | "button";

export interface ContentUnit {
  index: number;
  kind: ContentKind;
  text: string;
  normalized: string;
  href?: string;
  level?: number;
  standalone?: boolean;
}

export interface DiffRow {
  status: "paired" | "missing" | "added";
  documentKind?: ContentKind;
  pageKind?: ContentKind;
  documentText?: string;
  pageText?: string;
  moved?: boolean;
}

export interface LinkRow {
  text: string;
  pageText?: string;
  documentHref?: string;
  pageHref?: string;
  status: "same" | "different" | "missing";
}

export interface ContentValidationResult {
  url: string;
  documentName: string;
  pageTitle: string;
  renderedWith: "http" | "browser";
  warnings: string[];
  rows: DiffRow[];
  links: LinkRow[];
}

export const CONTENT_KIND_LABELS: Record<ContentKind, string> = {
  heading: "Heading",
  sentence: "Text",
  "list-item": "List item",
  "table-cell": "Table cell",
  link: "Link",
  image: "Image alt text",
  button: "Button",
};
