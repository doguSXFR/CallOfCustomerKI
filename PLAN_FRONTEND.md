# Voice Chat Frontend — Plan

## Ziel
React WebFrontend das per Mikrofon mit dem C.O.C.K Backend spricht.
Kein Twilio — direkt Browser-Mic → Deepgram STT → OpenAI LLM → ElevenLabs TTS → Browser-Speaker.

## Architektur

```
┌─────────────────────────────────────────────┐
│  Browser (React + Vite + TypeScript)        │
│                                             │
│  ┌─────────┐    ┌──────────┐    ┌────────┐ │
│  │ Mic     │───▶│ WebSocket│◀──▶│ Speaker│ │
│  │ Capture │    │ Client   │    │ Output │ │
│  └─────────┘    └──────────┘    └────────┘ │
│       ↓               ↑              ↑      │
│  MediaRecorder    Audio chunks   Audio resp  │
│  (PCM 16kHz)     (mulaw/PCM)   (MP3/PCM)   │
└─────────────────────────────────────────────┘
        ↕ WebSocket (wss://backend:3000)
┌─────────────────────────────────────────────┐
│  Backend (Express + WS)                     │
│                                             │
│  /ws/voice/stream — neuer Endpoint          │
│                                             │
│  Browser Audio → Deepgram STT (WebSocket)   │
│       ↓ is_final                            │
│  OpenAI LLM (Streaming)                     │
│       ↓ Token-by-Token                      │
│  ElevenLabs TTS (Streaming)                 │
│       ↓ Audio chunks                        │
│  Browser Audio Out                          │
└─────────────────────────────────────────────┘
```

## Frontend Features

### Pages/Components
1. **VoiceChat.tsx** — Hauptkomponente
   - Roter Button zum Sprechen (Push-to-Talk oder Toggle)
   - Waveform-Animation während Sprechen/Zuhören
   - Chat-Log mit User/Assistant Messages
   - Status-Anzeige (Listening → Processing → Speaking)

2. **Waveform.tsx** — Audio-Visualizer
   - Web Audio API AnalyserNode
   - Animierte Balken oder Kreis

3. **useAudioCapture.ts** — Custom Hook
   - MediaDevices.getUserMedia()
   - PCM 16kHz Export (via AudioWorklet)
   - WebSocket Streaming

4. **useAudioPlayback.ts** — Custom Hook
   - MP3/Audio Chunk Playback
   - Audio Queue für flüssige Wiedergabe

5. **WebSocket Client** — Connection Manager
   - Auto-Reconnect
   - Heartbeat

### Tech Stack
- Vite + React 18 + TypeScript
- TailwindCSS (minimal styling)
- Web Audio API (AudioWorklet für PCM-Conversion)

## Backend Änderungen

### Neuer Endpoint: `/ws/voice/stream`
- Nimmt PCM Audio vom Browser entgegen (nicht Twilio mulaw!)
- Pipe's durch Deepgram STT
- LLM → TTS Pipeline
- Schickt Audio-Chunks zurück als JSON { type: "audio", data: "base64..." }
- Schickt Transcripts zurück als JSON { type: "transcript", text: "...", role: "user"|"assistant" }

### Unterschied zu Twilio Endpoint:
- Twilio: mulaw 8kHz base64 in `media` event
- Browser: raw PCM 16kHz in beliebigem Format
- Kein TwiML, keine Telephonie
- Einfacher WebSocket-Handshake

## Dateistruktur (neu)

```
frontend/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── components/
    │   ├── VoiceChat.tsx
    │   ├── Waveform.tsx
    │   ├── ChatLog.tsx
    │   └── StatusIndicator.tsx
    ├── hooks/
    │   ├── useAudioCapture.ts
    │   ├── useAudioPlayback.ts
    │   └── useVoiceWebSocket.ts
    ├── lib/
    │   ├── websocket.ts
    │   └── audio-utils.ts
    └── styles/
        └── globals.css
```

## Schritte

1. Frontend-Projekt mit Vite + React + TS + Tailwind aufsetzen
2. Backend: /ws/voice/stream Endpoint erstellen
3. AudioCapture Hook (Mic → PCM → WebSocket)
4. AudioPlayback Hook (WebSocket → Audio Queue → Speaker)
5. VoiceChat UI komponieren
6. Waveform Visualizer
7. Testen mit echtem Deepgram/OpenAI/ElevenLabs
