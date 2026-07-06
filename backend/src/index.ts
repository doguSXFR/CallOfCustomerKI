import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { env } from './config/env.js';
import { handleTwilioMediaStream } from './handlers/twilio-media.handler.js';
import twilioRoutes from './routes/twilio.routes.js';
import healthRoutes from './routes/health.routes.js';
import { createLogger } from '@cock/shared';

const log = createLogger('server');

// ── Express App ──
const app = express();
app.use(express.urlencoded({ extended: true })); // Twilio sends form-encoded
app.use(express.json());

// Routes
app.use('/twilio', twilioRoutes);
app.use('/', healthRoutes);

// ── HTTP Server + WebSocket ──
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Twilio Media Stream WebSocket endpoint
wss.on('connection', (ws, req) => {
  const path = req.url;

  if (path === '/ws/twilio/media') {
    log.info('New Twilio Media Stream connection');
    handleTwilioMediaStream(ws);
  } else {
    log.warn('Unknown WebSocket path', { path });
    ws.close();
  }
});

// ── Start ──
server.listen(env.PORT, env.HOST, () => {
  log.info(`🚀 C.O.C.K Server running on http://${env.HOST}:${env.PORT}`);
  log.info(`📞 Twilio webhook: POST /twilio/incoming`);
  log.info(`🔌 WebSocket: ws://${env.HOST}:${env.PORT}/ws/twilio/media`);
  log.info(`❤️  Health: http://${env.HOST}:${env.PORT}/health`);
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
