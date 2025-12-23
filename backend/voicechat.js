import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { VertexAI } from "@google-cloud/vertexai";
import multer from "multer";
import { SpeechClient } from "@google-cloud/speech";
import fs from "fs";
import { createRequire } from "module";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer(); // for future audio uploads (STT)
const speechClient = new SpeechClient(); // uses GOOGLE_APPLICATION_CREDENTIALS

// 👉 Google Cloud / Gemini setup
const projectId = "tria-479719";
const location = "us-central1";
const modelName = "gemini-2.5-flash";

const vertexAI = new VertexAI({ project: projectId, location });
const generativeModel = vertexAI.getGenerativeModel({ model: modelName });

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

// 👉 ElevenLabs setup
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.VOICE_ID;

if (!ELEVENLABS_API_KEY) {
  console.warn("⚠️ ELEVENLABS_API_KEY is missing from .env");
}
if (!VOICE_ID) {
  console.warn("⚠️ VOICE_ID is missing from .env");
}

// 🔧 Helper: process text with Gemini + ElevenLabs, return text + base64 audio
async function processTextWithAI(userText) {
  console.log("🧑‍💻 User text:", userText);

  // 1️⃣ Gemini
  const geminiResp = await generativeModel.generateContent({
    contents: [{ role: "user", parts: [{ text: userText }] }],
  });

  const replyText =
    geminiResp.response.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!replyText) {
    console.error("❌ No text returned from Gemini:", geminiResp);
    throw new Error("No reply from Gemini");
  }

  console.log("🤖 Gemini reply:", replyText);

  // 2️⃣ ElevenLabs TTS
  const ttsResponse = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: replyText,
        model_id: "eleven_flash_v2_5",
      }),
    }
  );

  if (!ttsResponse.ok) {
    const errText = await ttsResponse.text();
    console.error(
      "❌ ElevenLabs error:",
      ttsResponse.status,
      ttsResponse.statusText,
      errText
    );
    throw new Error(`ElevenLabs TTS failed: ${errText}`);
  }

  const contentType = ttsResponse.headers.get("Content-Type");
  console.log("🎧 ElevenLabs Content-Type:", contentType);

  const audioArrayBuffer = await ttsResponse.arrayBuffer();
  const audioBuffer = Buffer.from(audioArrayBuffer);

  console.log("🎵 Audio buffer length:", audioBuffer.length);
  if (!audioBuffer.length) {
    throw new Error("Empty audio from ElevenLabs");
  }

  const audioBase64 = audioBuffer.toString("base64");

  return { replyText, audioBase64 };
}

// =======================
// 1️⃣ TEXT → AI → VOICE
// =======================
app.post("/api/voice-chat", async (req, res) => {
  try {
    const userText = req.body.text;
    if (!userText) {
      return res.status(400).json({ error: "No text provided" });
    }

    const result = await processTextWithAI(userText);
    // { replyText, audioBase64 }
    res.json(result);
  } catch (err) {
    console.error("🔥 /api/voice-chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================================
// 2️⃣ AUDIO → STT → AI → VOICE
// (skeleton for later usage)
// ================================
app.post("/api/voice-chat-audio", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file received" });
    }

    const audioBuffer = req.file.buffer;

    // 1️⃣ Google Speech-to-Text
    const [sttResponse] = await speechClient.recognize({
      audio: {
        content: audioBuffer.toString("base64"),
      },
      config: {
        encoding: "WEBM_OPUS", // depends on what frontend sends
        languageCode: "en-IN",
      },
    });

    const transcript =
      sttResponse.results?.[0]?.alternatives?.[0]?.transcript || "";

    console.log("🎙 Transcript from STT:", transcript);

    if (!transcript) {
      return res.status(400).json({ error: "No speech detected" });
    }

    // 2️⃣ Process transcript via Gemini + ElevenLabs
    const { replyText, audioBase64 } = await processTextWithAI(transcript);

    // 3️⃣ Send everything back
    res.json({
      transcript,
      replyText,
      audioBase64,
    });
  } catch (err) {
    console.error("🔥 /api/voice-chat-audio error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 📁 FILE → TEXT → GEMINI → ANSWER
const uploadFile = multer({ dest: "uploads/" });

app.post("/api/file-chat", uploadFile.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;
    const fileType = req.file.mimetype;

    let extractedText = "";

    // ✅ PDF File
    if (fileType === "application/pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      extractedText = pdfData.text;
    }

    // ✅ Text File
    else if (fileType === "text/plain") {
      extractedText = fs.readFileSync(filePath, "utf-8");
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: "Unsupported file type" });
    }

    fs.unlinkSync(filePath); // delete uploaded file after processing

    const userQuestion = req.body.question || "Summarize this document";

    const finalPrompt = `
Here is a document:
${extractedText}

User question:
${userQuestion}
`;

    const result = await processTextWithAI(finalPrompt);

    res.json(result);
  } catch (err) {
    console.error("File Chat Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// =======================
// SERVER START
// =======================

app.listen(3000, () => {
  console.log("🚀 Voice Chat API running at http://localhost:3000");
});
