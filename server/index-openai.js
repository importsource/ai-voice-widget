const dotenv = require("dotenv");
dotenv.config();

const http = require("http");
const WebSocket = require("ws");
const { Assistant } = require("./lib/assistant");
const { PRESETS, DEFAULT_PRESET, getPresetList } = require("./lib/presets");

const PORT = 8000;

const httpServer = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/presets" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ presets: getPresetList(), default: DEFAULT_PRESET }));
    return;
  }

  res.writeHead(404);
  res.end();
});

const server = new WebSocket.Server({ server: httpServer });

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

httpServer.listen(PORT, () => {
  console.log("Server running on http://localhost:" + PORT);
  console.log("  GET /presets — list available presets");
  console.log("  WS  /        — voice connection (?assistant=<name>)");
  console.log("Available presets:", Object.keys(PRESETS).join(", "));
});
