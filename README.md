# AI Voice Widget

A real-time voice conversation widget that lets website visitors talk to an AI assistant. Drop a single `<script>` tag into any webpage and your site gets a floating voice chat widget — no build tools required.

**CDN:**
```html
<script src="https://cdn.jsdelivr.net/gh/importsource/ai-voice-widget@main/ai-widget.js"></script>
```

## Overview

**Architecture:**

```
Browser (ai-widget.js)          Server (index-openai.js)
  Mic → VAD → audio chunks  ──→  WebSocket (ws://...)
                                    ↓
                                  Whisper STT → text
                                    ↓
                                  GPT-4o-mini → response text
                                    ↓
                                  OpenAI TTS → audio
  Speaker ← audio chunks    ←──  WebSocket
```

**Tech Stack:**
- Frontend: Plain JS — no framework, no build tools, one file
- Backend: Node.js + WebSocket
- AI: OpenAI (Whisper STT, GPT-4o-mini LLM, TTS-1 speech)

**Key design:** All AI prompts live on the server as named presets. The client only sends a preset name (e.g. `receptionist`), never the actual prompt. This keeps your instructions secure and prevents prompt injection.

---

## Project Structure

```
voice-ai-js-starter-main/
├── ai-widget.js              ← Drop-in widget library (or use CDN)
├── README.md                 ← This file
├── server/
│   ├── index-openai.js       ← WebSocket server with preset definitions
│   ├── .env                  ← API keys
│   ├── lib/                  ← Server internals (assistant, STT, TTS, etc.)
│   └── package.json
└── web/
    ├── ai-widget.js           ← Copy of widget for demo
    └── index.html             ← Demo page with preset selector
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

Edit `server/index-openai.js` to add or modify presets:

```js
const PRESETS = {
  receptionist: {
    instructions: 'You are a friendly AI receptionist...',
    openingMessage: 'Hello! Welcome. How can I help you today?',
    voiceName: 'nova',
  },
  sales: {
    instructions: 'You are a persuasive AI sales assistant...',
    openingMessage: 'Hi there! Looking for something special today?',
    voiceName: 'shimmer',
  },
  support: {
    instructions: 'You are a patient AI tech support assistant...',
    openingMessage: 'Hi! I\'m here to help with any technical issues.',
    voiceName: 'echo',
  },
};
```

Each preset defines:

| Field | Description |
|-------|-------------|
| `instructions` | System prompt — the AI's personality and behavior rules |
| `openingMessage` | What the bot says when a user connects |
| `voiceName` | TTS voice: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer` |

### Start

```bash
node index-openai.js
```

Output:
```
WebSocket server running on ws://localhost:8000
Available presets: receptionist, sales, support
```

---

## 2. Demo Page

```bash
cd voice-ai-js-starter-main/web
python3 -m http.server 3000
```

Open http://localhost:3000/index.html

The demo page has a preset dropdown — switch between `receptionist`, `sales`, and `support` to test different AI personalities.

---

## 3. Integrate into Your Page

### Step 1: Add the script

Use the CDN (recommended):

```html
<script src="https://cdn.jsdelivr.net/gh/importsource/ai-voice-widget@main/ai-widget.js"></script>
```

Or copy `ai-widget.js` into your static files folder and reference it locally.

### Step 2: Initialize

```html
<script>
  AIWidget.init({
    server: 'ws://localhost:8000',          // Your WebSocket server URL
    assistant: 'receptionist'
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
    title:     'AI Receptionist',        // Optional — widget title
    subtitle:  'Talk to AI Receptionist',// Optional — idle state text
    position:  'bottom-right',           // Optional — 'bottom-right' or 'bottom-left'
    style:     {},                       // Optional — CSS variable overrides (see section 5)
  });
</script>
```

### Switch Preset at Runtime

```js
AIWidget.setOptions({ assistant: 'sales' });
```

Takes effect on the next connection (click the orb to start a new conversation).

### Remove Widget

```js
AIWidget.destroy();
```

---

## 4. Adding a New Preset

1. Open `server/index-openai.js`
2. Add a new entry to `PRESETS`:

```js
const PRESETS = {
  // ...existing presets...

  booking: {
    instructions: `You are an AI booking assistant for a hotel.
Help guests check availability, make reservations, and answer questions about amenities.
Keep responses short and conversational.
If the user says bye, say goodbye and use [endCall].`,
    openingMessage: 'Welcome! Would you like to book a room or check availability?',
    voiceName: 'alloy',
  },
};
```

3. Restart the server: `node index-openai.js`
4. Use it from the client: `AIWidget.init({ server: '...', assistant: 'booking' })`

If running as a service, restart it after changes. See `DEPLOYMENT.md` for details.

---

## 5. Customizing the Widget Style

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

## 6. Widget States

| State | Orb | Status Text |
|-------|-----|-------------|
| **Idle** | Orange with mic icon | "Talk to AI Receptionist" |
| **Listening** | Red pulsing with stop icon | Green dot + "Listening... speak now" |
| **Thinking** | Orange with spinner | "AI is thinking..." |
| **Speaking** | Orange pulsing with wave icon | "AI is speaking..." |

Click the orb to start. Click again to hang up.

---

## 7. How It Works

1. **User clicks the orb** — browser requests microphone permission
2. **WebSocket connects** with `?assistant=receptionist` query param
3. **Server looks up the preset** and creates an assistant with that config
4. **Server sends greeting** audio
5. **Widget plays audio** and shows "AI is speaking..."
6. **Playback ends** — switches to "Listening... speak now"
7. **User speaks** — browser-side VAD detects speech
8. **Audio streams** to server as Float32Array chunks
9. **User stops speaking** — VAD detects 800ms silence, sends EOS
10. **Server transcribes** (Whisper) → generates response (GPT) → converts to speech (TTS)
11. **Response audio streams** back and plays
12. **Cycle repeats** until user disconnects
13. **User can interrupt** — speaking while the bot is talking cuts it off

---

## 8. API Reference

### `AIWidget.init(options)`

Initialize and render the widget. Call once on page load.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `server` | string | — | WebSocket server URL (required) |
| `assistant` | string | `'receptionist'` | Preset name defined in server's `PRESETS` |
| `title` | string | `'AI Receptionist'` | Widget title text |
| `subtitle` | string | `'Talk to AI Receptionist'` | Idle state status text |
| `position` | string | `'bottom-right'` | `'bottom-right'` or `'bottom-left'` |
| `style` | object | `null` | CSS variable overrides (see section 5) |

### `AIWidget.setOptions(options)`

Update `server` or `assistant` at runtime. Takes effect on the next connection.

### `AIWidget.setStyle(styleObj)`

Update CSS variables at runtime. Changes are applied immediately. Keys can be short names (e.g. `'width'`) or full variable names (e.g. `'--aiw-width'`).

### `AIWidget.destroy()`

Disconnect and remove the widget from the page.

---

## 9. Production Deployment

### Server

Deploy `server/` to any Node.js host (Railway, Render, Fly.io, AWS, etc.):

```bash
cd server
npm install
node index-openai.js
```

Or use Docker:

```bash
docker build -t ai-voice-server .
docker run -p 8000:8000 -e OPENAI_API_KEY=sk-... ai-voice-server
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
    assistant: 'receptionist'
  });
</script>
```

### Security

- `OPENAI_API_KEY` stays on the server — never exposed to clients
- Prompts stay on the server — clients only send a preset name
- Unknown preset names fall back to the default (`receptionist`)
- Consider adding origin checks and rate limiting in production
