const dotenv = require("dotenv");
dotenv.config();

const WebSocket = require("ws");
const { Assistant } = require("./lib/assistant");
const { PRESETS, DEFAULT_PRESET } = require("./lib/presets");

const PORT = 8000;
const server = new WebSocket.Server({ port: PORT });

// ====== Connection Handler ======

server.on("connection", (ws, req) => {
  const cid = req.headers["sec-websocket-key"];
  ws.binaryType = "arraybuffer";

  const url = new URL(req.url, "http://localhost");
  const presetName = url.searchParams.get("assistant") || DEFAULT_PRESET;
  const preset = PRESETS[presetName] || PRESETS[DEFAULT_PRESET];

  console.log("Client connected", cid, "| preset:", presetName in PRESETS ? presetName : `${presetName} (unknown, using ${DEFAULT_PRESET})`);

  const assistant = new Assistant(preset.instructions, {
    speakFirstOpeningMessage: preset.openingMessage,
    llmModel: "gpt-4o",
    speechToTextModel: "openai/whisper-1",
    voiceModel: "openai/tts-1",
    voiceName: preset.voiceName || "nova",
  });

  ws.send("--- Connected (" + presetName + ") ---");

  const conversation = assistant.createConversation(ws, {
    onEnd: (callLogs) => {
      console.log("----- CALL LOG -----");
      console.log(JSON.stringify(callLogs, null, 2));
    },
  });
  conversation.begin(1500);

  ws.on("close", () => {
    console.log("Client disconnected", cid);
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

console.log("WebSocket server running on ws://localhost:" + PORT);
console.log("Available presets:", Object.keys(PRESETS).join(", "));
