import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { handleTwilioMediaStream } from './handlers/twilio-media.handler.js';
import { handleVoiceStream } from './handlers/voice-stream.handler.js';
import twilioRoutes from './routes/twilio.routes.js';
import healthRoutes from './routes/health.routes.js';
import { createLogger } from '@cock/shared';

const log = createLogger('server');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Express App ──
const app = express();
app.use(express.urlencoded({ extended: true })); // Twilio sends form-encoded
app.use(express.json());

// Routes (API routes must be before static files)
app.use('/twilio', twilioRoutes);
app.use('/', healthRoutes);

// ── Serve Frontend Static Files ──
// In Docker: /app/frontend/dist, locally: ../../frontend/dist from backend/src
const frontendDist = process.env.FRONTEND_DIST_PATH || path.resolve(__dirname, '../../frontend/dist');
log.info(`Serving frontend from: ${frontendDist}`);
app.use(express.static(frontendDist));

// SPA fallback: all non-API routes → index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// ── HTTP Server + WebSocket ──
const server = createServer(app);
const wss = new WebSocketServer({ server });

// WebSocket endpoint routing
wss.on('connection', (ws, req) => {
  const path = req.url;

  if (path === '/ws/twilio/media') {
    log.info('New Twilio Media Stream connection');
    handleTwilioMediaStream(ws);
  } else if (path === '/ws/voice/stream') {
    log.info('New Browser Voice Stream connection');
    handleVoiceStream(ws);
  } else {
    log.warn('Unknown WebSocket path', { path });
    ws.close();
  }
});

// ── Start ──
server.listen(env.PORT, env.HOST, () => {
  log.info(`🚀 C.O.C.K Server running on http://${env.HOST}:${env.PORT}`);
  log.info(`📞 Twilio webhook: POST /twilio/incoming`);
  log.info(`🔌 Twilio WS:    ws://${env.HOST}:${env.PORT}/ws/twilio/media`);
  log.info(`🎤 Voice WS:     ws://${env.HOST}:${env.PORT}/ws/voice/stream`);
  log.info(`❤️  Health:       http://${env.HOST}:${env.PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down...');
  server.close(() => process.exit(0));
});
