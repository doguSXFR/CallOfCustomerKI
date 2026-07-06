import Twilio from 'twilio';
import { env } from '../config/env.js';
import { createLogger } from '@cock/shared';

const log = createLogger('twilio');

const client = Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

/**
 * Generate TwiML to connect an incoming call to our WebSocket Media Stream
 */
export function generateStreamTwiML(wsUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="caller" value="{{From}}" />
      <Parameter name="called" value="{{To}}" />
    </Stream>
  </Connect>
</Response>`;
}

/**
 * Generate TwiML to say something and then connect to stream
 */
export function generateGreetingTwiML(greeting: string, wsUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-DE">${greeting}</Say>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="caller" value="{{From}}" />
      <Parameter name="called" value="{{To}}" />
    </Stream>
  </Connect>
</Response>`;
}

/**
 * Generate TwiML to transfer the call to a human agent
 */
export function generateTransferTwiML(transferNumber: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-DE">Einen Moment bitte, ich verbinde Sie mit einem Mitarbeiter.</Say>
  <Dial>${transferNumber}</Dial>
</Response>`;
}

/**
 * Generate TwiML to end the call with a message
 */
export function generateHangupTwiML(goodbye: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-DE">${goodbye}</Say>
  <Hangup/>
</Response>`;
}

/**
 * Make an outbound call
 */
export async function makeOutboundCall(
  to: string,
  from: string = env.TWILIO_PHONE_NUMBER,
  wsUrl?: string
) {
  try {
    const twiml = wsUrl
      ? generateStreamTwiML(wsUrl)
      : generateHangupTwiML('Dies ist ein Testanruf.');

    const call = await client.calls.create({
      to,
      from,
      twiml,
    });

    log.info(`Outbound call initiated`, { callSid: call.sid, to });
    return call;
  } catch (error) {
    log.error(`Failed to make outbound call`, { to, error: String(error) });
    throw error;
  }
}

export { client as twilioClient };
