import { Router, type Request, type Response } from 'express';
import { getActiveCalls } from '../handlers/twilio-media.handler.js';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    activeCalls: getActiveCalls().size,
    timestamp: new Date().toISOString(),
  });
});

router.get('/calls', (_req: Request, res: Response) => {
  const calls = getActiveCalls();
  const callList = Array.from(calls.entries()).map(([sid, pipeline]) => ({
    callSid: sid,
    messageCount: pipeline.getMessages().length,
  }));

  res.json({ activeCalls: callList });
});

export default router;
