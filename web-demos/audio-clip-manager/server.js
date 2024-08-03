import { serve } from "bun";
import { readFileSync, readdirSync, mkdirSync } from "fs";
import { join } from "path";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
const CLIPS_DIR = join(import.meta.dir, "clips");

// Ensure the clips directory exists
try {
  readdirSync(CLIPS_DIR);
} catch (error) {
  if (error.code === "ENOENT") {
    mkdirSync(CLIPS_DIR);
  } else {
    throw error;
  }
}

const server = serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/") {
      // Serve the index.html file
      const indexHtml = readFileSync(
        join(import.meta.dir, "index.html"),
        "utf8"
      );
      return new Response(indexHtml, {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (url.pathname === "/upload-audio" && req.method === "POST") {
      const formData = await req.formData();
      const audioFile = formData.get("audio");

      if (!audioFile) {
        return new Response("No audio file provided", { status: 400 });
      }

      const fileName = `audio_${Date.now()}.webm`;
      const filePath = join(CLIPS_DIR, fileName);

      try {
        const fileBuffer = await audioFile.arrayBuffer();
        if (fileBuffer.byteLength > MAX_FILE_SIZE) {
          throw new Error("File size exceeds 5MB limit");
        }
        await Bun.write(filePath, fileBuffer);
        console.log(`Audio saved as ${fileName}`);
        return new Response("Audio saved successfully", { status: 200 });
      } catch (error) {
        console.error("Error saving audio:", error);
        return new Response("Error: " + error.message, { status: 413 });
      }
    }

    if (url.pathname === "/list-clips" && req.method === "GET") {
      try {
        const clips = readdirSync(CLIPS_DIR);
        return new Response(JSON.stringify(clips), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("Error listing clips:", error);
        return new Response("Error listing clips", { status: 500 });
      }
    }

    if (url.pathname.startsWith("/clips/") && req.method === "GET") {
      console.log("Requested clip:", url.pathname);
      const fileName = url.pathname.split("/").pop();
      const filePath = join(CLIPS_DIR, fileName);
      try {
        const fileContent = readFileSync(filePath);
        return new Response(fileContent, {
          headers: { "Content-Type": "audio/webm" },
        });
      } catch (error) {
        console.error("Error serving clip:", error);
        return new Response("Clip not found", { status: 404 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running at http://localhost:${server.port}`);
