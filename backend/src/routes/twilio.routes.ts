import { Router, type Request, type Response } from 'express';
import { generateStreamTwiML, generateGreetingTwiML, makeOutboundCall } from '../services/twilio.service.js';
import { createLogger } from '@cock/shared';

const log = createLogger('routes');
const router = Router();

/**
 * POST /twilio/incoming — Twilio webhook for incoming calls
 * Twilio sends a POST when a call comes in. We respond with TwiML
 * that connects the call to our WebSocket Media Stream.
 */
router.post('/incoming', (req: Request, res: Response) => {
  const { CallSid, From, To } = req.body;

  log.info('Incoming call', { callSid: CallSid, from: From, to: To });

  // Build WebSocket URL for Media Stream
  const wsProtocol = req.secure ? 'wss' : 'ws';
  const host = req.get('host') || 'localhost:3000';
  const wsUrl = `${wsProtocol}://${host}/ws/twilio/media`;

  // Respond with TwiML — say greeting then connect to stream
  const greeting = 'Willkommen! Wie kann ich Ihnen helfen?';
  const twiml = generateGreetingTwiML(greeting, wsUrl);

  res.type('text/xml').send(twiml);
});

/**
 * POST /twilio/outbound — Make an outbound call (API endpoint)
 */
router.post('/outbound', async (req: Request, res: Response) => {
  const { to } = req.body;

  if (!to) {
    return res.status(400).json({ error: 'Missing "to" phone number' });
  }

  try {
    const wsProtocol = req.secure ? 'wss' : 'ws';
    const host = req.get('host') || 'localhost:3000';
    const wsUrl = `${wsProtocol}://${host}/ws/twilio/media`;

    const call = await makeOutboundCall(to, undefined, wsUrl);
    res.json({ success: true, callSid: call.sid });
  } catch (error) {
    log.error('Outbound call failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to initiate call' });
  }
});

/**
 * POST /twilio/status — Call status callback from Twilio
 */
router.post('/status', (req: Request, res: Response) => {
  const { CallSid, CallStatus, CallDuration } = req.body;
  log.info('Call status update', { callSid: CallSid, status: CallStatus, duration: CallDuration });
  res.sendStatus(200);
});

export default router;
