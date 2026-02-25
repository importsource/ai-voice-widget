# AI Voice Widget

A real-time voice conversation widget that lets website visitors talk to an AI assistant. Drop a single `<script>` tag into any webpage and your site gets a floating voice chat widget — no build tools required.

Supports two modes: **Standard** (Whisper STT + GPT + TTS pipeline) and **Realtime** (OpenAI Realtime API with server-side VAD for lower latency).

**CDN:**
```html
<script src="https://cdn.jsdelivr.net/gh/importsource/ai-voice-widget@main/ai-widget.js"></script>
```

## Overview

**Architecture — Standard Mode:**

```
Browser (ai-widget.js)          Server
  Mic → VAD → audio chunks  ──→  WebSocket (ws://...?mode=standard)
                                    ↓
                                  Whisper STT → text
                                    ↓
                                  GPT-4o → response text
                                    ↓
                                  OpenAI TTS → audio
  Speaker ← audio chunks    ←──  WebSocket
```

**Architecture — Realtime Mode:**

```
Browser (ai-widget.js)          Server
  Mic → audio stream         ──→  WebSocket (ws://...?mode=realtime)
                                    ↓
                                  OpenAI Realtime API
                                  (server VAD, streaming speech-to-speech)
                                    ↓
  Speaker ← audio stream    ←──  WebSocket
```

**Tech Stack:**
- Frontend: Plain JS — no framework, no build tools, one file
- Backend: Node.js + WebSocket
- AI: OpenAI (Standard: Whisper STT + GPT-4o + TTS-1 | Realtime: OpenAI Realtime API)

**Key design:** All AI prompts live on the server as named presets loaded from external JSON config files. The client only sends a preset name (e.g. `receptionist`), never the actual prompt. This keeps your instructions secure and prevents prompt injection.

---

## Project Structure

```
voice-ai-js-starter-main/
├── ai-widget.js              ← Drop-in widget library (or use CDN)
├── README.md                 ← This file
├── server/
│   ├── index-openai.js       ← Standard mode server (STT → LLM → TTS pipeline)
│   ├── index-realtime.js     ← Dual-mode server (standard + realtime)
│   ├── .env                  ← API keys (gitignored)
│   ├── presets/              ← Preset JSON config files (gitignored)
│   │   ├── receptionist.json
│   │   ├── sales.json
│   │   ├── support.json
│   │   └── .gitkeep
│   ├── lib/
│   │   ├── presets.js        ← Preset loader (reads presets/*.json at startup)
│   │   ├── assistant.js      ← Standard mode assistant
│   │   ├── realtime-relay.js ← OpenAI Realtime API relay
│   │   ├── conversation.js
│   │   ├── stt.js
│   │   ├── tts.js
│   │   └── audio.js
│   └── package.json
└── web/
    ├── ai-widget.js           ← Copy of widget for demo
    └── index.html             ← Demo page with preset + mode selector
```

---

## 1. Server Setup

### Install

```bash
cd voice-ai-js-starter-main/server
npm install
```

### Configure API Key

Edit `server/.env`:

```
OPENAI_API_KEY=sk-your-openai-api-key
```

That's the only key you need. Get one at https://platform.openai.com/api-keys

### Define Presets

Presets are stored as individual JSON files in `server/presets/`. Each file defines one preset:

`server/presets/receptionist.json`:
```json
{
  "instructions": "You are a friendly AI receptionist...",
  "openingMessage": "Hello! Welcome. How can I help you today?",
  "voiceName": "nova"
}
```

Each preset defines:

| Field | Description |
|-------|-------------|
| `instructions` | System prompt — the AI's personality and behavior rules |
| `openingMessage` | What the bot says when a user connects |
| `voiceName` | TTS voice: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer` |

The preset files are gitignored so your prompt instructions stay private.

### Start

**Standard mode only** (STT + LLM + TTS pipeline):

```bash
node index-openai.js
```

**Dual mode** (supports both standard and realtime via `?mode=` query param):

```bash
node index-realtime.js
```

Output:
```
Loaded 3 preset(s): receptionist, sales, support
WebSocket server running on ws://localhost:8000
Supports both standard and realtime modes (via ?mode=standard|realtime)
```

---

## 2. Standard vs Realtime Mode

| | Standard | Realtime |
|---|---|---|
| **Server** | `index-openai.js` or `index-realtime.js` | `index-realtime.js` only |
| **Pipeline** | Whisper STT → GPT-4o → TTS-1 | OpenAI Realtime API (speech-to-speech) |
| **VAD** | Client-side (browser) | Server-side (OpenAI) |
| **Latency** | Higher (sequential API calls) | Lower (streaming speech-to-speech) |
| **Turn detection** | Client sends EOS after silence | Server VAD handles automatically |
| **Client param** | `mode: 'standard'` (default) | `mode: 'realtime'` |

Both modes use the same presets and the same widget — the only difference is the `mode` option.

---

## 3. Demo Page

```bash
cd voice-ai-js-starter-main/web
python3 -m http.server 3000
```

Open http://localhost:3000/index.html

The demo page has dropdowns for both **preset** and **mode** — switch between presets and toggle standard/realtime to compare latency and behavior.

---

## 4. Integrate into Your Page

### Step 1: Add the script

Use the CDN (recommended):

```html
<script src="https://cdn.jsdelivr.net/gh/importsource/ai-voice-widget@main/ai-widget.js"></script>
```

Or copy `ai-widget.js` into your static files folder and reference it locally.

### Step 2: Initialize

Standard mode (default):

```html
<script>
  AIWidget.init({
    server: 'ws://localhost:8000',
    assistant: 'receptionist'
  });
</script>
```

Realtime mode (lower latency, requires `index-realtime.js` server):

```html
<script>
  AIWidget.init({
    server: 'ws://localhost:8000',
    assistant: 'receptionist',
    mode: 'realtime'
  });
</script>
```

Done. A floating voice widget appears at the bottom-right of your page.

### All Options

```html
<script>
  AIWidget.init({
    server:    'ws://localhost:8000', // Required — WebSocket server URL
    assistant: 'receptionist',           // Optional — preset name (default: 'receptionist')
    mode:      'standard',               // Optional — 'standard' or 'realtime' (default: 'standard')
    title:     'AI Receptionist',        // Optional — widget title
    subtitle:  'Talk to AI Receptionist',// Optional — idle state text
    position:  'bottom-right',           // Optional — 'bottom-right' or 'bottom-left'
    style:     {},                       // Optional — CSS variable overrides (see section 6)
  });
</script>
```

### Switch Preset or Mode at Runtime

```js
AIWidget.setOptions({ assistant: 'sales', mode: 'realtime' });
```

Takes effect on the next connection (click the orb to start a new conversation).

### Remove Widget

```js
AIWidget.destroy();
```

---

## 5. Adding a New Preset

1. Create a new JSON file in `server/presets/`, e.g. `server/presets/booking.json`:

```json
{
  "instructions": "You are an AI booking assistant for a hotel.\nHelp guests check availability, make reservations, and answer questions about amenities.\nKeep responses short and conversational.\nIf the user says bye, say goodbye and use [endCall].",
  "openingMessage": "Welcome! Would you like to book a room or check availability?",
  "voiceName": "alloy"
}
```

2. Restart the server — the new preset is auto-discovered
3. Use it from the client: `AIWidget.init({ server: '...', assistant: 'booking' })`

---

## 6. Customizing the Widget Style

The widget uses CSS custom properties (variables), so you can change its size, colors, and layout without editing `ai-widget.js`.

### Option A: Via `style` in `init()`

Pass a `style` object — keys are variable names (without the `--aiw-` prefix):

```html
<script>
  AIWidget.init({
    server: 'ws://localhost:8000',
    assistant: 'receptionist',
    style: {
      'width':       '320px',
      'orb-size':    '44px',
      'bg':          'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      'border':      'rgba(100, 100, 255, 0.2)',
      'orb-idle':    'linear-gradient(145deg, #4361ee, #3a0ca3)',
      'orb-listen':  'linear-gradient(145deg, #f72585, #b5179e)',
      'color-idle':  '#4361ee',
      'color-listen':'#f72585',
      'title-color': '#e0e0ff',
      'bottom':      '32px',
      'side':        '32px',
    }
  });
</script>
```

### Option B: Via CSS on your page

Override variables on the `.aiw-wrap` selector:

```css
.aiw-wrap {
  --aiw-width: 320px;
  --aiw-orb-size: 44px;
  --aiw-bg: #1e293b;
  --aiw-border: rgba(100, 200, 255, 0.2);
  --aiw-orb-idle: linear-gradient(145deg, #0ea5e9, #0284c7);
  --aiw-color-idle: #0ea5e9;
  --aiw-bottom: 32px;
  --aiw-side: 32px;
}
```

### Option C: Update at runtime

```js
AIWidget.setStyle({
  'width': '300px',
  'orb-idle': 'linear-gradient(145deg, #22c55e, #16a34a)',
  'color-idle': '#22c55e',
});
```

### All CSS Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `--aiw-width` | `380px` | Widget pill width |
| `--aiw-radius` | `60px` | Pill border radius |
| `--aiw-padding` | `10px 16px 10px 10px` | Pill inner padding |
| `--aiw-gap` | `14px` | Gap between orb and text |
| `--aiw-bottom` | `24px` | Distance from bottom of viewport |
| `--aiw-side` | `24px` | Distance from left or right edge |
| `--aiw-bg` | dark gradient | Pill background |
| `--aiw-border` | `rgba(200,140,60,.2)` | Pill border color |
| `--aiw-shadow` | dark shadow | Pill box shadow |
| `--aiw-orb-size` | `52px` | Orb button diameter |
| `--aiw-orb-idle` | orange gradient | Orb idle state background |
| `--aiw-orb-listen` | red gradient | Orb listening state background |
| `--aiw-orb-think` | same as idle | Orb thinking state background |
| `--aiw-orb-speak` | same as idle | Orb speaking state background |
| `--aiw-title-size` | `.95rem` | Title font size |
| `--aiw-title-color` | `#fff` | Title text color |
| `--aiw-status-size` | `.82rem` | Status text font size |
| `--aiw-color-idle` | `#e88c14` | Idle / thinking / speaking text color |
| `--aiw-color-listen` | `#4ade80` | Listening text and dot color |
| `--aiw-font` | system fonts | Font family |
| `--aiw-zindex` | `9999` | CSS z-index |

---

## 7. Widget States

| State | Orb | Status Text |
|-------|-----|-------------|
| **Idle** | Orange with mic icon | "Talk to AI Receptionist" |
| **Listening** | Red pulsing with stop icon | Green dot + "Listening... speak now" |
| **Thinking** | Orange with spinner | "AI is thinking..." |
| **Speaking** | Orange pulsing with wave icon | "AI is speaking..." |

Click the orb to start. Click again to hang up.

---

## 8. How It Works

### Standard Mode

1. **User clicks the orb** — browser requests microphone permission
2. **WebSocket connects** with `?assistant=receptionist&mode=standard`
3. **Server looks up the preset** and creates an assistant with that config
4. **Server sends greeting** audio
5. **Widget plays audio** and shows "AI is speaking..."
6. **Playback ends** — switches to "Listening... speak now"
7. **User speaks** — browser-side VAD detects speech
8. **Audio streams** to server as Float32Array chunks
9. **User stops speaking** — VAD detects 800ms silence, sends EOS
10. **Server transcribes** (Whisper) → generates response (GPT-4o) → converts to speech (TTS)
11. **Response audio streams** back and plays
12. **Cycle repeats** until user disconnects
13. **User can interrupt** — speaking while the bot is talking cuts it off

### Realtime Mode

1. **User clicks the orb** — browser requests microphone permission
2. **WebSocket connects** with `?assistant=receptionist&mode=realtime`
3. **Server opens a session** with OpenAI Realtime API using the preset's instructions and voice
4. **Server sends opening message** via the Realtime API
5. **Audio streams continuously** from browser to server to OpenAI
6. **Server-side VAD** (OpenAI) detects when the user starts and stops speaking
7. **OpenAI generates response** as a streaming audio response (speech-to-speech)
8. **Response audio streams** back through the server to the browser
9. **Cycle repeats** — no explicit turn-taking needed, VAD handles it automatically
10. **User can interrupt** — speaking while the bot is talking cancels the current response
11. **End call detection** — if the assistant says goodbye with `[endCall]`, the server plays a beep and disconnects

---

## 9. API Reference

### `AIWidget.init(options)`

Initialize and render the widget. Call once on page load.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `server` | string | — | WebSocket server URL (required) |
| `assistant` | string | `'receptionist'` | Preset name defined in server's presets |
| `mode` | string | `'standard'` | `'standard'` or `'realtime'` |
| `title` | string | `'AI Receptionist'` | Widget title text |
| `subtitle` | string | `'Talk to AI Receptionist'` | Idle state status text |
| `position` | string | `'bottom-right'` | `'bottom-right'` or `'bottom-left'` |
| `style` | object | `null` | CSS variable overrides (see section 6) |

### `AIWidget.setOptions(options)`

Update `server`, `assistant`, or `mode` at runtime. Takes effect on the next connection.

### `AIWidget.setStyle(styleObj)`

Update CSS variables at runtime. Changes are applied immediately. Keys can be short names (e.g. `'width'`) or full variable names (e.g. `'--aiw-width'`).

### `AIWidget.destroy()`

Disconnect and remove the widget from the page.

---

## 10. Production Deployment

### Server

Deploy `server/` to any Node.js host (Railway, Render, Fly.io, AWS, etc.):

```bash
cd server
npm install
node index-realtime.js
```

Or use Docker:

```bash
docker build -t ai-voice-server .
docker run -p 8000:8000 -e OPENAI_API_KEY=sk-... ai-voice-server
```

**Important:** The preset JSON files in `server/presets/` are gitignored. After deploying code via git, copy the preset files to the server separately:

```bash
scp server/presets/*.json user@server:/path/to/server/presets/
```

### Frontend

- Use `wss://` (not `ws://`) when your page is served over HTTPS
- `ai-widget.js` can be served from CDN or any static host
- No build step required

```html
<script src="https://cdn.jsdelivr.net/gh/importsource/ai-voice-widget@main/ai-widget.js"></script>
<script>
  AIWidget.init({
    server: 'wss://your-api-server.com/ws',
    assistant: 'receptionist',
    mode: 'realtime'
  });
</script>
```

### Security

- `OPENAI_API_KEY` stays on the server — never exposed to clients
- Prompts live in gitignored JSON files — never pushed to the repo
- Clients only send a preset name, never the actual prompt
- Unknown preset names fall back to the default (`receptionist`)
- Consider adding origin checks and rate limiting in production
