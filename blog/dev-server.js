import { watch } from "fs";
import { $ } from "bun";
import path from "path";

const BUILD_DIR = "./build";

// Function to run the build script
async function runBuild() {
  console.log("Running build script...");
  await $`bun ./build.js`;
}

// Run initial build
await runBuild();

// Inject refresh script into HTML files
function injectRefreshScript(content) {
  const script = `
    <script>
      const ws = new WebSocket('ws://localhost:3000');
      ws.onmessage = (event) => {
        if (event.data === 'refresh') {
          window.location.reload();
        }
      };
    </script>
  `;
  return content.replace("</body>", `${script}</body>`);
}

function getContentType(filePath) {
  const extension = path.extname(filePath);
  const contentTypeMap = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  };
  const contentType = contentTypeMap[extension] || "application/octet-stream";
  return contentType;
}

// Set up HTTP server
const httpServer = Bun.serve({
  port: 3000,
  async fetch(req, server) {
    const success = server.upgrade(req);
    if (success) return undefined;
    const url = new URL(req.url);
    const filePath = BUILD_DIR + url.pathname;

    // Serve index.html for root path
    if (url.pathname === "/") {
      const indexContent = await Bun.file(BUILD_DIR + "/index.html").text();
      return new Response(injectRefreshScript(indexContent), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Attempt to serve the requested file
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (exists) {
      const contentType = getContentType(filePath);
      if (filePath.endsWith(".html")) {
        const content = await file.text();
        return new Response(injectRefreshScript(content), {
          headers: { "Content-Type": contentType },
        });
      }
      return new Response(file, {
        headers: { "Content-Type": contentType },
      });
    } else {
      return new Response("404 Not Found", { status: 404 });
    }
  },
  websocket: {
    open(ws) {
      ws.subscribe("refresh");
    },
    close(ws) {
      ws.unsubscribe("refresh");
    },
  },
});

console.log(`HTTP Server running at http://localhost:${httpServer.port}`);

// Function to notify clients to refresh
function notifyClients() {
  httpServer.publish("refresh", "refresh");
}

async function onChange(event, filename) {
  console.log(`Detected ${event} in ${filename}`);
  try {
    await runBuild();
    notifyClients();
  } catch (error) {
    console.error("Build failed", error);
  }
}

// Set up file watcher
const publicWatcher = watch("./public", { recursive: true }, onChange);
const templatesWatcher = watch("./templates", { recursive: true }, onChange);

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("Closing watcher and shutting down servers...");
  publicWatcher.close();
  templatesWatcher.close();
  httpServer.stop();
  process.exit(0);
});
