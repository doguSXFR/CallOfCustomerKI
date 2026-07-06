# 🐔 CallOfCustomerKI (C.O.C.K)

AI-powered phone agent — answers calls, has conversations, books appointments.

## Architecture

```
Phone Call
    ↓
Twilio (SIP / Media Streams)
    ↓ WebSocket (mulaw 8kHz audio)
Express + WS Server
    ↓
┌─────────────────────────────────┐
│       Call Pipeline             │
│                                 │
│  ┌─────┐  ┌─────┐  ┌───────┐  │
│  │ STT │→ │ LLM │→ │  TTS  │  │
│  │DG   │  │OpenAI│ │Eleven │  │
│  └─────┘  └─────┘  └───────┘  │
│  <100ms   ~500ms   ~200ms TTFB │
└─────────────────────────────────┘
    ↓ WebSocket (audio back)
Twilio → Phone
```

| Component | Provider | Latency | Cost |
|-----------|----------|---------|------|
| **STT** | Deepgram Nova-3 | <100ms | $0.0043/min |
| **LLM** | OpenAI GPT-4o-mini | ~500ms | ~$0.001/call |
| **TTS** | ElevenLabs Turbo v2.5 | ~200ms TTFB | ~$0.01/min |
| **Telephony** | Twilio Media Streams | - | $0.007/min |
| **Total** | | ~800ms pipeline | **~$0.02/min** |

## Project Structure

```
CallOfCustomerKI/
├── shared/          # Shared types, constants, utils (importable by frontend later)
│   └── src/
│       ├── types/       # TypeScript interfaces
│       ├── constants/   # Config constants + default prompts
│       └── utils/       # Audio conversion, logger
├── backend/         # Express + WebSocket server
│   └── src/
│       ├── config/      # Environment config (zod validated)
│       ├── services/    # Twilio, Deepgram STT, OpenAI LLM, ElevenLabs TTS
│       ├── handlers/    # WebSocket connection handler
│       ├── routes/      # Express REST routes
│       └── index.ts     # Entry point
├── package.json     # Monorepo workspace root
└── .env.example     # Required env vars
```

## Setup

```bash
# 1. Install deps
npm install

# 2. Configure
cp .env.example .env
# Fill in API keys

# 3. Build shared
npm run build --workspace=shared

# 4. Run dev
npm run dev
```

## Twilio Configuration

1. Buy a phone number in Twilio Console
2. Set the Voice webhook to: `https://your-server.com/twilio/incoming`
3. Set status callback to: `https://your-server.com/twilio/status`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/twilio/incoming` | POST | Twilio incoming call webhook |
| `/twilio/outbound` | POST | Make outbound call `{ "to": "+43..." }` |
| `/twilio/status` | POST | Twilio call status callback |
| `/health` | GET | Health check + active call count |
| `/calls` | GET | List active call sessions |

## Next Steps

- [ ] Add function calling (appointment booking, FAQ lookup)
- [ ] Call recording + transcription storage
- [ ] Web dashboard for call monitoring
- [ ] Multi-language support
- [ ] Transfer to human agent flow
