const dotenv = require("dotenv");
dotenv.config();

const WebSocket = require("ws");
const { RealtimeRelay } = require("./lib/realtime-relay");
const { pcm16ToFloat32 } = require("./lib/audio");
const { generateBeep } = require("./lib/audio");
const { PRESETS, DEFAULT_PRESET } = require("./lib/presets");

const PORT = 8000;
const server = new WebSocket.Server({ port: PORT });

// ====== Connection Handler ======

server.on("connection", async (browserWs, req) => {
  const cid = req.headers["sec-websocket-key"];
  browserWs.binaryType = "arraybuffer";

  const url = new URL(req.url, "http://localhost");
  const presetName = url.searchParams.get("assistant") || DEFAULT_PRESET;
  const mode = url.searchParams.get("mode") || "standard";
  const preset = PRESETS[presetName] || PRESETS[DEFAULT_PRESET];

  // If not realtime mode, redirect to standard handler logic
  if (mode !== "realtime") {
    console.log(
      "Client connected (standard mode)", cid,
      "| preset:", presetName in PRESETS ? presetName : `${presetName} (unknown, using ${DEFAULT_PRESET})`
    );

    // Lazy-load standard mode dependencies
    const { Assistant } = require("./lib/assistant");
    const assistant = new Assistant(preset.instructions, {
      speakFirstOpeningMessage: preset.openingMessage,
      llmModel: "gpt-4o",
      speechToTextModel: "openai/whisper-1",
      voiceModel: "openai/tts-1",
      voiceName: preset.voiceName || "nova",
    });

    browserWs.send("--- Connected (" + presetName + ") ---");

    const conversation = assistant.createConversation(browserWs, {
      onEnd: (callLogs) => {
        console.log("----- CALL LOG -----");
        console.log(JSON.stringify(callLogs, null, 2));
      },
    });
    conversation.begin(1500);

    browserWs.on("close", () => console.log("Client disconnected (standard)", cid));
    browserWs.on("error", (error) => console.error("WebSocket error:", error));
    return;
  }

  // ====== Realtime Mode ======
  console.log(
    "Client connected (realtime mode)", cid,
    "| preset:", presetName in PRESETS ? presetName : `${presetName} (unknown, using ${DEFAULT_PRESET})`
  );

  browserWs.send("--- Connected (" + presetName + ", realtime) ---");

  const relay = new RealtimeRelay({
    apiKey: process.env.OPENAI_API_KEY,
    instructions: preset.instructions,
    voice: preset.voiceName || "nova",
  });

  // --- Relay events → Browser ---

  relay.on("session_created", () => {
    console.log("[Realtime]", cid, "Session created");
    browserWs.send("RDY");
    // Send opening message after session is ready
    if (preset.openingMessage) {
      relay.sendOpeningMessage(preset.openingMessage);
    }
  });

  relay.on("speech_started", () => {
    // Cancel any in-progress response when user starts speaking
    relay.cancel();
    browserWs.send("CLR");
    browserWs.send("SPEECH_STARTED");
  });

  relay.on("speech_stopped", () => {
    browserWs.send("SPEECH_STOPPED");
  });

  relay.on("audio", (float32) => {
    // Chunk into 1024-sample pieces to match browser playback buffer size
    if (browserWs.readyState !== WebSocket.OPEN) return;
    for (let i = 0; i < float32.length; i += 1024) {
      const chunk = float32.slice(i, i + 1024);
      browserWs.send(chunk.buffer);
    }
  });

  relay.on("audio_done", () => {
    browserWs.send("RDY");
  });

  relay.on("transcript", (text) => {
    console.log("[Realtime]", cid, "assistant:", text);
    browserWs.send("assistant: " + text);
  });

  relay.on("end_call", (text) => {
    console.log("[Realtime]", cid, "End call detected");
    browserWs.send("---- Assistant Hung Up ----");
    // Send a short beep and close after a brief delay
    const beep = generateBeep(180, 0.5, 24000);
    const float32 = pcm16ToFloat32(beep);
    for (let i = 0; i < float32.length; i += 1024) {
      browserWs.send(float32.slice(i, i + 1024).buffer);
    }
    setTimeout(() => {
      relay.close();
      browserWs.close();
    }, 1000);
  });

  relay.on("error", (err) => {
    console.error("[Realtime]", cid, "Error:", err);
  });

  relay.on("close", () => {
    console.log("[Realtime]", cid, "OpenAI connection closed");
    if (browserWs.readyState === WebSocket.OPEN) {
      browserWs.close();
    }
  });

  // --- Browser messages → Relay ---

  browserWs.on("message", (message) => {
    if (message instanceof ArrayBuffer || Buffer.isBuffer(message)) {
      // Audio data from browser — convert to Float32Array and forward
      const buf = Buffer.isBuffer(message) ? message : Buffer.from(message);
      const float32 = new Float32Array(
        buf.buffer,
        buf.byteOffset,
        buf.byteLength / 4
      );
      relay.sendAudio(float32);
    } else {
      const msg = message.toString();
      if (msg === "INT") {
        relay.cancel();
        browserWs.send("CLR");
      }
      // "EOS" is ignored in realtime mode — server VAD handles turn detection
    }
  });

  browserWs.on("close", () => {
    console.log("Client disconnected (realtime)", cid);
    relay.close();
  });

  browserWs.on("error", (error) => {
    console.error("WebSocket error:", error);
    relay.close();
  });

  // --- Connect to OpenAI ---
  try {
    await relay.connect();
  } catch (err) {
    console.error("[Realtime]", cid, "Failed to connect to OpenAI:", err);
    browserWs.send("Error: Failed to connect to OpenAI Realtime API");
    browserWs.close();
  }
});

console.log("WebSocket server running on ws://localhost:" + PORT);
console.log("Supports both standard and realtime modes (via ?mode=standard|realtime)");
console.log("Available presets:", Object.keys(PRESETS).join(", "));
