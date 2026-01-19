import * as cheerio from "cheerio";
import type { AccessibilityCheck, CheckResult } from "@/app/types";

export function analyzeAccessibility(
  html: string,
  passed: string[],
  warnings: string[],
  failed: string[]
): AccessibilityCheck {
  const $ = cheerio.load(html);

  return {
    altText: checkAltText($, passed, warnings, failed),
    formLabels: checkFormLabels($, passed, warnings, failed),
    ariaAttributes: checkAriaAttributes($, passed, warnings, failed),
    headingHierarchy: checkHeadingHierarchy($, passed, warnings, failed),
    semanticHtml: checkSemanticHtml($, passed, warnings, failed),
    keyboardNavigation: checkKeyboardNavigation($, passed, warnings, failed),
    focusIndicators: checkFocusIndicators($, passed, warnings, failed),
  };
}

function checkAltText(
  $: cheerio.CheerioAPI,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  const images = $("img");
  const imagesWithoutAlt: string[] = [];
  const imagesWithEmptyAlt: string[] = [];

  images.each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt === undefined) {
      imagesWithoutAlt.push($(el).attr("src") || "unknown");
    } else if (alt.trim() === "") {
      imagesWithEmptyAlt.push($(el).attr("src") || "unknown");
    }
  });

  const totalIssues = imagesWithoutAlt.length + imagesWithEmptyAlt.length;

  if (totalIssues === 0 && images.length > 0) {
    passed.push("All images have proper alt text");
    return {
      status: "pass",
      message: "All images have proper alt text",
      value: images.length,
    };
  }

  if (imagesWithoutAlt.length > 0) {
    failed.push(`Found ${imagesWithoutAlt.length} image(s) without alt text`);
  }
  if (imagesWithEmptyAlt.length > 0) {
    warnings.push(`Found ${imagesWithEmptyAlt.length} image(s) with empty alt text`);
  }

  const status = imagesWithoutAlt.length > 0 ? "fail" : "warn";
  return {
    status,
    message: `Found ${totalIssues} image(s) with alt text issues`,
    value: totalIssues,
    recommendation: "Add descriptive alt text to all images for accessibility",
  };
}

function checkFormLabels(
  $: cheerio.CheerioAPI,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  const inputs = $("input, textarea, select");
  const inputsWithoutLabels: string[] = [];

  inputs.each((_, el) => {
    const $el = $(el);
    const id = $el.attr("id");
    const name = $el.attr("name");
    const type = $el.attr("type");

    // Skip hidden inputs
    if (type === "hidden") {
      return;
    }

    // Check for associated label
    let hasLabel = false;
    if (id) {
      hasLabel = $(`label[for="${id}"]`).length > 0;
    }

    // Check for aria-label
    if (!hasLabel && $el.attr("aria-label")) {
      hasLabel = true;
    }

    // Check for aria-labelledby
    if (!hasLabel && $el.attr("aria-labelledby")) {
      hasLabel = true;
    }

    // Check for wrapping label
    if (!hasLabel && $el.closest("label").length > 0) {
      hasLabel = true;
    }

    if (!hasLabel) {
      inputsWithoutLabels.push(name || id || "unnamed");
    }
  });

  if (inputsWithoutLabels.length === 0 && inputs.length > 0) {
    passed.push("All form inputs have proper labels");
    return {
      status: "pass",
      message: "All form inputs have proper labels",
      value: inputs.length,
    };
  }

  if (inputsWithoutLabels.length > 0) {
    warnings.push(`Found ${inputsWithoutLabels.length} form input(s) without labels`);
    return {
      status: "warn",
      message: `Found ${inputsWithoutLabels.length} form input(s) without labels`,
      value: inputsWithoutLabels.length,
      recommendation: "Add labels to all form inputs for accessibility",
    };
  }

  return {
    status: "pass",
    message: "No form inputs found",
    value: 0,
  };
}

function checkAriaAttributes(
  $: cheerio.CheerioAPI,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  const issues: string[] = [];

  // Check for aria-required without required attribute
  $("[aria-required='true']").each((_, el) => {
    if (!$(el).attr("required")) {
      issues.push("Element has aria-required but missing required attribute");
    }
  });

  // Check for aria-hidden elements that might be focusable
  $("[aria-hidden='true']").each((_, el) => {
    const $el = $(el);
    if ($el.is("a, button, input, select, textarea") || $el.attr("tabindex") !== undefined) {
      issues.push("Focusable element has aria-hidden='true'");
    }
  });

  // Check for missing aria-labels on interactive elements
  $("button:not([aria-label]):not([aria-labelledby]), a:not([aria-label]):not([aria-labelledby]):not([href])").each((_, el) => {
    const text = $(el).text().trim();
    if (!text) {
      issues.push("Interactive element missing accessible name");
    }
  });

  if (issues.length === 0) {
    passed.push("ARIA attributes are properly used");
    return {
      status: "pass",
      message: "ARIA attributes are properly used",
      value: 0,
    };
  }

  warnings.push(`Found ${issues.length} ARIA attribute issue(s)`);
  return {
    status: "warn",
    message: `Found ${issues.length} ARIA attribute issue(s)`,
    value: issues.length,
    recommendation: "Review ARIA attribute usage for accessibility compliance",
  };
}

function checkHeadingHierarchy(
  $: cheerio.CheerioAPI,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  const headings = $("h1, h2, h3, h4, h5, h6");
  const issues: string[] = [];
  let previousLevel = 0;

  headings.each((_, el) => {
    const level = parseInt(el.tagName.charAt(1));
    
    if (previousLevel > 0 && level > previousLevel + 1) {
      issues.push(`Heading hierarchy skip: ${el.tagName} after h${previousLevel}`);
    }
    
    previousLevel = level;
  });

  // Check for multiple h1 tags
  const h1Count = $("h1").length;
  if (h1Count > 1) {
    issues.push(`Multiple h1 tags found (${h1Count})`);
  }

  if (issues.length === 0 && headings.length > 0) {
    passed.push("Heading hierarchy is proper");
    return {
      status: "pass",
      message: "Heading hierarchy is proper",
      value: headings.length,
    };
  }

  if (issues.length > 0) {
    warnings.push(`Found ${issues.length} heading hierarchy issue(s)`);
    return {
      status: "warn",
      message: `Found ${issues.length} heading hierarchy issue(s)`,
      value: issues.length,
      recommendation: "Maintain proper heading hierarchy (h1 → h2 → h3, etc.)",
    };
  }

  return {
    status: "warn",
    message: "No headings found",
    recommendation: "Add proper heading structure to improve accessibility",
  };
}

function checkSemanticHtml(
  $: cheerio.CheerioAPI,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  const semanticElements = $("nav, main, article, section, aside, header, footer, figure, figcaption");
  const divCount = $("div").length;
  const spanCount = $("span").length;

  if (semanticElements.length === 0 && (divCount > 10 || spanCount > 10)) {
    warnings.push("No semantic HTML elements found, excessive use of div/span");
    return {
      status: "warn",
      message: `No semantic HTML elements found (${divCount} divs, ${spanCount} spans)`,
      value: 0,
      recommendation: "Use semantic HTML elements (nav, main, article, etc.) for better accessibility",
    };
  }

  passed.push("Semantic HTML elements are used");
  return {
    status: "pass",
    message: "Semantic HTML elements are used",
    value: semanticElements.length,
  };
}

function checkKeyboardNavigation(
  $: cheerio.CheerioAPI,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  const interactiveElements = $("a, button, input, select, textarea, [tabindex]");
  const issues: string[] = [];

  interactiveElements.each((_, el) => {
    const $el = $(el);
    const tabindex = $el.attr("tabindex");

    // Check for positive tabindex (bad practice)
    if (tabindex && parseInt(tabindex) > 0) {
      issues.push("Element with positive tabindex found");
    }

    // Check for disabled interactive elements
    if ($el.attr("disabled") && ($el.is("a") || $el.attr("tabindex") !== undefined)) {
      issues.push("Disabled element may still be focusable");
    }
  });

  if (issues.length === 0) {
    passed.push("Keyboard navigation appears proper");
    return {
      status: "pass",
      message: "Keyboard navigation appears proper",
      value: interactiveElements.length,
    };
  }

  warnings.push(`Found ${issues.length} keyboard navigation issue(s)`);
  return {
    status: "warn",
    message: `Found ${issues.length} keyboard navigation issue(s)`,
    value: issues.length,
    recommendation: "Ensure all interactive elements are keyboard accessible",
  };
}

function checkFocusIndicators(
  $: cheerio.CheerioAPI,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  // Check for CSS that might hide focus indicators
  const styles = $("style, link[rel='stylesheet']");
  let hasFocusStyles = false;

  styles.each((_, el) => {
    const $el = $(el);
    let content = "";

    if ($el.is("style")) {
      content = $el.html() || "";
    } else {
      // Can't check external stylesheets easily, so we'll assume they might have focus styles
      hasFocusStyles = true;
    }

    if (content.includes(":focus") || content.includes(":focus-visible") || content.includes("outline")) {
      hasFocusStyles = true;
    }
  });

  // Check for elements that explicitly remove focus
  const noFocusElements = $("[style*='outline: none'], [style*='outline:0']").length;

  if (noFocusElements > 0) {
    warnings.push(`Found ${noFocusElements} element(s) that may hide focus indicators`);
    return {
      status: "warn",
      message: `Found ${noFocusElements} element(s) that may hide focus indicators`,
      value: noFocusElements,
      recommendation: "Ensure all interactive elements have visible focus indicators",
    };
  }

  if (hasFocusStyles || noFocusElements === 0) {
    passed.push("Focus indicators appear to be handled");
    return {
      status: "pass",
      message: "Focus indicators appear to be handled",
      value: 0,
    };
  }

  return {
    status: "warn",
    message: "Could not verify focus indicators",
    recommendation: "Ensure all interactive elements have visible focus indicators",
  };
}
