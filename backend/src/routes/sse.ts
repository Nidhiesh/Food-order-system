import { Router, Request, Response } from 'express';
import { sseManager } from '../services/sseManager';

const router = Router();

/**
 * GET /api/sse/stream
 * Public SSE endpoint — any browser tab subscribes here to receive real-time events.
 */
router.get('/stream', (req: Request, res: Response) => {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering if behind a proxy
  res.flushHeaders();

  // Send an initial "connected" event so the client knows the stream is live
  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'SSE stream connected' })}\n\n`);

  // Register this client
  const clientId = sseManager.addClient(res);

  // Send a heartbeat every 20 seconds to keep the connection alive through proxies
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 20_000);

  // On disconnect, clean up
  req.on('close', () => {
    clearInterval(heartbeat);
    sseManager.removeClient(clientId);
  });
});

export default router;
