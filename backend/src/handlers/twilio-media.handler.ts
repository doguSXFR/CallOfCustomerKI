import { WebSocket } from 'ws';
import { CallPipelineService } from '../services/call-pipeline.service.js';
import { createLogger, type TwilioMediaEvent } from '@cock/shared';

const log = createLogger('twilio-ws');

const activeCalls = new Map<string, CallPipelineService>();

/**
 * Handle a Twilio Media Stream WebSocket connection.
 *
 * Flow:
 * 1. Twilio connects via WebSocket and sends 'connected' event
 * 2. Twilio sends 'start' event with stream/call metadata
 * 3. Twilio sends 'media' events with base64 mulaw audio chunks (~20ms each)
 * 4. We pipe audio through CallPipelineService (STT → LLM → TTS)
 * 5. TTS audio chunks are sent back via WebSocket
 * 6. Twilio sends 'stop' when call ends
 */
export function handleTwilioMediaStream(ws: WebSocket) {
  let pipeline: CallPipelineService | null = null;
  let streamSid: string | null = null;
  let callSid: string | null = null;

  ws.on('message', (raw: Buffer) => {
    try {
      const event: TwilioMediaEvent = JSON.parse(raw.toString());

      switch (event.event) {
        case 'connected':
          log.info('Twilio WebSocket connected');
          break;

        case 'start':
          streamSid = event.start!.streamSid;
          callSid = event.start!.callSid;
          log.info('Media stream started', { streamSid, callSid }, callSid);

          // Create and start the call pipeline
          pipeline = new CallPipelineService(callSid);
          setupPipelineEvents(pipeline, ws, streamSid, callSid);
          pipeline.start();
          activeCalls.set(callSid, pipeline);
          break;

        case 'media':
          if (pipeline && event.media?.payload) {
            // Feed raw audio to the pipeline
            pipeline.feedAudio(event.media.payload);
          }
          break;

        case 'stop':
          log.info('Media stream stopped', { streamSid, callSid }, callSid ?? undefined);
          cleanup();
          break;
      }
    } catch (error) {
      log.error('WebSocket message error', { error: String(error) });
    }
  });

  ws.on('close', () => {
    log.info('WebSocket closed', { callSid }, callSid ?? undefined);
    cleanup();
  });

  ws.on('error', (error) => {
    log.error('WebSocket error', { error: String(error) }, callSid ?? undefined);
    cleanup();
  });

  function cleanup() {
    if (callSid) {
      activeCalls.delete(callSid);
    }
    pipeline?.stop();
    pipeline = null;
  }
}

/**
 * Wire pipeline events back to Twilio via WebSocket
 */
function setupPipelineEvents(
  pipeline: CallPipelineService,
  ws: WebSocket,
  streamSid: string,
  callSid: string
) {
  // When TTS produces audio → send it back to Twilio
  pipeline.on('audio_out', (audioBuffer: Buffer) => {
    if (ws.readyState !== WebSocket.OPEN) return;

    // Send audio back as media message
    const message = {
      event: 'media',
      streamSid,
      media: {
        payload: audioBuffer.toString('base64'),
      },
    };

    ws.send(JSON.stringify(message));
  });

  // Log pipeline events
  pipeline.on('pipeline_event', (event) => {
    log.debug('Pipeline event', { type: event.type }, callSid);
  });
}

/**
 * Get all active call pipelines (for monitoring/debugging)
 */
export function getActiveCalls(): Map<string, CallPipelineService> {
  return activeCalls;
}
