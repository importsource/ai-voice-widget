const WebSocket = require("ws");
const { EventEmitter } = require("events");
const { float32ToPCM16, pcm16ToFloat32 } = require("./audio");

// Realtime API supports a different set of voices than standard TTS.
// Map standard TTS voice names to the closest Realtime API equivalents.
const REALTIME_VOICE_MAP = {
  nova: "coral",
  alloy: "alloy",
  echo: "echo",
  shimmer: "shimmer",
  fable: "sage",
  onyx: "ash",
};
const REALTIME_VOICES = new Set([
  "alloy", "ash", "ballad", "coral", "echo",
  "sage", "shimmer", "verse", "marin", "cedar",
]);

function mapVoice(voice) {
  if (REALTIME_VOICES.has(voice)) return voice;
  return REALTIME_VOICE_MAP[voice] || "coral";
}

/**
 * RealtimeRelay encapsulates a connection to the OpenAI Realtime API.
 * It converts audio between Float32Array (browser format) and base64 PCM16
 * (OpenAI format), and emits high-level events for the server to forward.
 */
class RealtimeRelay extends EventEmitter {
  /**
   * @param {object} config
   * @param {string} config.apiKey - OpenAI API key
   * @param {string} config.instructions - System instructions for the session
   * @param {string} config.voice - Voice name (nova, shimmer, echo, etc.)
   * @param {string} [config.model] - Model name (default: gpt-4o-realtime-preview)
   */
  constructor(config) {
    super();
    this.apiKey = config.apiKey;
    this.instructions = config.instructions;
    this.voice = mapVoice(config.voice || "nova");
    this.model = config.model || "gpt-4o-realtime-preview";
    this.ws = null;
    this.connected = false;
    this.responding = false;
  }

  /**
   * Open WebSocket connection to OpenAI Realtime API.
   * @returns {Promise<void>}
   */
  connect() {
    return new Promise((resolve, reject) => {
      const url = `wss://api.openai.com/v1/realtime?model=${this.model}`;
      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "OpenAI-Beta": "realtime=v1",
        },
      });

      this.ws.on("open", () => {
        this.connected = true;
        this._sendSessionUpdate();
        resolve();
      });

      this.ws.on("message", (data) => {
        try {
          const event = JSON.parse(data.toString());
          this._handleEvent(event);
        } catch (err) {
          this.emit("error", err);
        }
      });

      this.ws.on("error", (err) => {
        this.emit("error", err);
        reject(err);
      });

      this.ws.on("close", () => {
        this.connected = false;
        this.emit("close");
      });
    });
  }

  /**
   * Send session.update with instructions, voice, and server VAD config.
   */
  _sendSessionUpdate() {
    this._send({
      type: "session.update",
      session: {
        modalities: ["audio", "text"],
        instructions: this.instructions,
        voice: this.voice,
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
      },
    });
  }

  /**
   * Handle an event received from the OpenAI Realtime API.
   */
  _handleEvent(event) {
    switch (event.type) {
      case "session.created":
        this.emit("session_created");
        break;

      case "session.updated":
        this.emit("session_updated");
        break;

      case "response.created":
        this.responding = true;
        break;

      case "input_audio_buffer.speech_started":
        this.emit("speech_started");
        break;

      case "input_audio_buffer.speech_stopped":
        this.emit("speech_stopped");
        break;

      case "response.audio.delta":
        if (event.delta) {
          const pcm16Buf = Buffer.from(event.delta, "base64");
          const int16 = new Int16Array(
            pcm16Buf.buffer,
            pcm16Buf.byteOffset,
            pcm16Buf.byteLength / 2
          );
          const float32 = pcm16ToFloat32(int16);
          this.emit("audio", float32);
        }
        break;

      case "response.audio.done":
        this.emit("audio_done");
        break;

      case "response.done":
        this.responding = false;
        this._handleResponseDone(event);
        break;

      case "error":
        console.error("[RealtimeRelay] API error:", event.error);
        this.emit("error", event.error);
        break;

      default:
        // Ignore other events (rate_limits, etc.)
        break;
    }
  }

  /**
   * Handle response.done — extract transcript and check for endCall.
   */
  _handleResponseDone(event) {
    const response = event.response;
    if (!response || !response.output) return;

    let fullText = "";
    for (const item of response.output) {
      if (item.type === "message" && item.content) {
        for (const part of item.content) {
          if (part.type === "audio" && part.transcript) {
            fullText += part.transcript;
          } else if (part.type === "text" && part.text) {
            fullText += part.text;
          }
        }
      }
    }

    if (fullText) {
      this.emit("transcript", fullText);
    }

    if (fullText.includes("[endCall]")) {
      this.emit("end_call", fullText.replace("[endCall]", "").trim());
    }
  }

  /**
   * Send audio from the browser (Float32Array) to OpenAI.
   * Converts Float32 → PCM16 → base64.
   * @param {Float32Array} float32
   */
  sendAudio(float32) {
    if (!this.connected) return;
    const pcm16 = float32ToPCM16(float32);
    const base64 = Buffer.from(pcm16.buffer).toString("base64");
    this._send({
      type: "input_audio_buffer.append",
      audio: base64,
    });
  }

  /**
   * Inject an opening message and trigger its TTS response.
   * @param {string} text - The opening message text
   */
  sendOpeningMessage(text) {
    this._send({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: text }],
      },
    });
    this._send({ type: "response.create" });
  }

  /**
   * Cancel the current response (user interruption).
   */
  cancel() {
    if (!this.responding) return;
    this._send({ type: "response.cancel" });
  }

  /**
   * Close the connection.
   */
  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  /**
   * Send a JSON message to the OpenAI WebSocket.
   */
  _send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }
}

module.exports = { RealtimeRelay };
