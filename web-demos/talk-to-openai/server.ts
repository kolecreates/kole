import dotenv from "dotenv";
dotenv.config();
import { OpenAI } from "openai";
import { createReadStream } from "node:fs";
import { unlink } from "node:fs/promises";
import type { ChatCompletionMessageParam } from "openai/src/resources/index.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Store conversation history
let conversationHistory: ChatCompletionMessageParam[] = [
  {
    role: "system",
    content:
      "Be casual, like a friend. Be short, sweet, concise, witty, fun, ask questions. Be *extremely* casual, like a friend you live with. Avoid talking too much.",
  },
];

async function transcribeAudio(audioFile: string): Promise<string> {
  console.time("transcribeAudio");
  const transcription = await openai.audio.transcriptions.create({
    file: createReadStream(audioFile),
    model: "whisper-1",
  });
  console.timeEnd("transcribeAudio");

  return transcription.text;
}

async function getResponseText(prompt: string): Promise<string> {
  console.time("getResponseText");

  // Add user's message to conversation history
  conversationHistory.push({ role: "user", content: prompt });

  const response = await openai.chat.completions.create({
    messages: conversationHistory,
    model: "gpt-4o-mini",
  });
  console.timeEnd("getResponseText");

  const responseContent = response.choices[0].message.content || "";

  // Add assistant's response to conversation history
  conversationHistory.push({ role: "assistant", content: responseContent });

  return responseContent;
}

async function getResponseAudio(
  prompt: string
): Promise<ReadableStream<Uint8Array> | null> {
  console.time("getResponseAudio");
  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice: "nova",
    input: await getResponseText(prompt),
    response_format: "mp3",
  });
  console.timeEnd("getResponseAudio");

  return response.body;
}

Bun.serve({
  port: 3000,

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      // Serve index.html
      return new Response(Bun.file("index.html"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (url.pathname === "/upload-audio" && request.method === "POST") {
      console.time("totalProcessingTime");
      const formData = await request.formData();
      const audioFile = formData.get("audio") as File;

      if (!audioFile) {
        return new Response("No audio file provided", { status: 400 });
      }

      // Save the audio file temporarily
      console.time("saveAudioFile");
      const tempFileName = `temp_${Date.now()}.webm`;
      await Bun.write(tempFileName, await audioFile.arrayBuffer());
      console.timeEnd("saveAudioFile");

      // Transcribe the audio
      const transcription = await transcribeAudio(tempFileName);

      // Get the response audio
      const responseAudio = await getResponseAudio(transcription);

      // Clean up the temporary file
      console.time("cleanupTempFile");
      await unlink(tempFileName).catch((e) => {
        console.error("Failed to delete temporary file:", e);
      });
      console.timeEnd("cleanupTempFile");

      console.timeEnd("totalProcessingTime");

      if (responseAudio) {
        return new Response(responseAudio, {
          headers: { "Content-Type": "audio/mpeg" },
        });
      } else {
        return new Response("Failed to generate response audio", {
          status: 500,
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`server running at http://localhost:3000`);
