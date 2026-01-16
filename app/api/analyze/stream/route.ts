import { NextRequest } from "next/server";
import { crawlWebsite } from "@/lib/crawler-sitemap-first";
import { analyzePage } from "@/lib/page-analyzer";

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

interface LogEntry {
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
}

function createLogEntry(level: LogEntry["level"], message: string): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
  };
}

function sendLog(controller: ReadableStreamDefaultController, log: LogEntry) {
  try {
    // Check if controller is still open before sending
    if (controller.desiredSize === null) {
      // Controller is closed, don't try to send
      return;
    }
    const data = JSON.stringify(log) + "\n";
    controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
  } catch (error) {
    // Controller might be closed, ignore the error
    // This can happen if the client disconnects
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");
  const crawl = searchParams.get("crawl") === "true";
  const maxPagesParam = searchParams.get("maxPages");
  const maxPages = maxPagesParam ? parseInt(maxPagesParam, 10) : 200;

  if (!url) {
    return new Response(
      JSON.stringify({ error: "URL parameter is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let isCancelled = false;
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (crawl) {
          // Normalize URL
          let normalizedUrl = url.trim();
          if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
            normalizedUrl = `https://${normalizedUrl}`;
          }
          const baseUrl = new URL(normalizedUrl);

          sendLog(controller, createLogEntry("info", `Starting crawl for ${normalizedUrl}`));

          // Intercept console methods to capture logs
          const originalConsoleLog = console.log;
          const originalConsoleWarn = console.warn;
          const originalConsoleError = console.error;

          let controllerClosed = false;

          const sendConsoleLog = (level: LogEntry["level"], ...args: any[]) => {
            // Don't try to send if controller is already closed or cancelled
            if (controllerClosed || isCancelled) {
              return;
            }

            try {
              const message = args.map(arg => {
                if (typeof arg === "object") {
                  try {
                    return JSON.stringify(arg, null, 2);
                  } catch {
                    return String(arg);
                  }
                }
                return String(arg);
              }).join(" ");

              // Parse log message and determine level
              let logLevel: LogEntry["level"] = level;
              const msgLower = message.toLowerCase();
              if (message.includes("✓") || message.includes("Successfully") || message.includes("Found sitemap")) {
                logLevel = "success";
              } else if (message.includes("⚠") || msgLower.includes("warning")) {
                logLevel = "warning";
              } else if (message.includes("✗") || msgLower.includes("error") || msgLower.includes("failed")) {
                logLevel = "error";
              }

              // Clean up the message (remove prefixes)
              let cleanMessage = message
                .replace(/\[SitemapCrawler\]\s*/g, "")
                .replace(/\[Sitemap\]\s*/g, "")
                .replace(/\[SitemapDiscovery\]\s*/g, "")
                .replace(/\[API\]\s*/g, "")
                .trim();

              if (cleanMessage) {
                sendLog(controller, createLogEntry(logLevel, cleanMessage));
              }
            } catch (error) {
              // If sending fails, mark controller as closed
              controllerClosed = true;
              isCancelled = true;
            }
          };

          console.log = (...args: any[]) => {
            sendConsoleLog("info", ...args);
            originalConsoleLog(...args);
          };

          console.warn = (...args: any[]) => {
            sendConsoleLog("warning", ...args);
            originalConsoleWarn(...args);
          };

          console.error = (...args: any[]) => {
            sendConsoleLog("error", ...args);
            originalConsoleError(...args);
          };

          try {
            // Crawl the website (logs will be captured via console intercept)
            const crawlResult = await crawlWebsite(normalizedUrl, {
              maxPages,
              timeout: 15000,
              debug: true,
            });

            if (!controllerClosed && !isCancelled) {
              sendLog(controller, createLogEntry("success", `✓ Crawled ${crawlResult.pages.length} pages`));
              sendLog(controller, createLogEntry("info", "Analyzing pages..."));
            }

            // Analyze pages
            let analyzedCount = 0;
            const batchSize = 5;
            for (let i = 0; i < crawlResult.pages.length; i += batchSize) {
              if (controllerClosed || isCancelled) break;
              
              const batch = crawlResult.pages.slice(i, i + batchSize);
              await Promise.all(
                batch.map(async (page) => {
                  try {
                    await analyzePage(page.html, page.url, baseUrl);
                    analyzedCount++;
                    if (!controllerClosed && !isCancelled && (analyzedCount % 10 === 0 || analyzedCount === crawlResult.pages.length)) {
                      sendLog(controller, createLogEntry("info", `Analyzed ${analyzedCount}/${crawlResult.pages.length} pages`));
                    }
                  } catch (error: any) {
                    if (!controllerClosed && !isCancelled) {
                      sendLog(controller, createLogEntry("error", `✗ Failed to analyze ${page.url}: ${error.message}`));
                    }
                  }
                })
              );
            }

            if (!controllerClosed && !isCancelled) {
              sendLog(controller, createLogEntry("success", `✓ Analysis complete! Analyzed ${analyzedCount} pages`));
              sendLog(controller, createLogEntry("info", "Finalizing results..."));

              // Send completion signal
              try {
                if (controller.desiredSize !== null) {
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: "complete" })}\n\n`));
                }
              } catch (error) {
                // Controller might be closed, ignore
                isCancelled = true;
              }
            }

            // Restore console
            console.log = originalConsoleLog;
            console.warn = originalConsoleWarn;
            console.error = originalConsoleError;
          } catch (error: any) {
            console.log = originalConsoleLog;
            console.warn = originalConsoleWarn;
            console.error = originalConsoleError;
            if (!controllerClosed && !isCancelled) {
              sendLog(controller, createLogEntry("error", `✗ Crawl failed: ${error.message}`));
            }
          }
        } else {
          if (!isCancelled) {
            sendLog(controller, createLogEntry("info", "Single page analysis mode"));
          }
        }
      } catch (error: any) {
        if (!isCancelled) {
          try {
            sendLog(controller, createLogEntry("error", `Error: ${error.message}`));
          } catch {
            // Controller might be closed, ignore
          }
        }
      } finally {
        try {
          if (controller.desiredSize !== null && !isCancelled) {
            controller.close();
          }
        } catch {
          // Controller might already be closed, ignore
        }
      }
    },
    cancel() {
      // Client disconnected, mark as cancelled
      isCancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
