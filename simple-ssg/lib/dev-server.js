import { watch } from "fs";
import path from "path";
import { build } from "./build.js";

export function startDevServer(publicDir, buildDir, templatesDir) {
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
    return contentTypeMap[extension] || "application/octet-stream";
  }

  // Set up HTTP server
  const httpServer = Bun.serve({
    port: 3000,
    async fetch(req, server) {
      const success = server.upgrade(req);
      if (success) return undefined;
      const url = new URL(req.url);
      const filePath = path.join(buildDir, url.pathname);

      // Serve index.html for root path
      if (url.pathname === "/") {
        const indexContent = await Bun.file(
          path.join(buildDir, "index.html")
        ).text();
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
      await build(publicDir, buildDir, templatesDir);
      notifyClients();
    } catch (error) {
      console.error("Build failed", error);
    }
  }

  // Set up file watchers
  const publicWatcher = watch(publicDir, { recursive: true }, onChange);
  const templatesWatcher = watch(templatesDir, { recursive: true }, onChange);

  // Run initial build
  build(publicDir, buildDir, templatesDir);

  // Return a function to stop the server and watchers
  return () => {
    console.log("Closing watcher and shutting down servers...");
    publicWatcher.close();
    templatesWatcher.close();
    httpServer.stop();
  };
}
