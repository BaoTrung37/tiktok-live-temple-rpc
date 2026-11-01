import http from 'node:http';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { WebSocketServer } from 'ws';
import { isAllowedOrigin } from '../config.js';

/**
 * Tầng giao vận HTTP Express + WebSocket JSON-RPC 2.0 (/rpc, /ws, /api/state, /api/tts, /api/health).
 */
export function createTransportServer({
  store,
  zeroTts,
  getRpcHandler,
  publicDir,
  ttsCacheDir
}) {
  const startedAt = Date.now();
  const app = express();

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && !isAllowedOrigin(origin)) {
      return res.status(403).json({
        ok: false,
        error: 'Forbidden cross-origin request'
      });
    }
    next();
  });

  app.use(
    cors({
      origin(origin, callback) {
        callback(null, isAllowedOrigin(origin));
      }
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use('/tts-cache', express.static(ttsCacheDir, { maxAge: '7d' }));
  app.use(express.static(publicDir));

  app.get('/favicon.ico', (_req, res) => {
    res.status(204).end();
  });

  app.get('/admin', (_req, res) => {
    res.sendFile(path.join(publicDir, 'admin.html'));
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      wsClients: wss.clients.size,
      tts: zeroTts.getStatus(),
      tiktok: store.state.tiktok
    });
  });

  app.get('/api/state', (_req, res) => {
    res.json(store.getPublicState());
  });

  app.all('/api/tts', async (req, res) => {
    const text = String(req.body?.text || req.query?.text || '').trim();
    const voice = String(
      req.body?.voice || req.query?.voice || store.state.settings.ttsVoice || 'maichi'
    ).trim();
    if (!text) {
      return res.status(400).json({ ok: false, error: 'Thiếu nội dung text cần đọc' });
    }
    const result = await zeroTts.synthesize(text, voice);
    res.json(result);
  });

  app.post('/rpc', async (req, res) => {
    const { jsonrpc, id, method, params } = req.body || {};
    if (!method) {
      return res.status(400).json({
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32600, message: 'Invalid JSON-RPC Request: thiếu method' }
      });
    }
    try {
      const handleRpcCall = getRpcHandler();
      const result = await handleRpcCall(method, params || {});
      res.json({
        jsonrpc: jsonrpc || '2.0',
        id: id ?? null,
        result
      });
    } catch (err) {
      res.status(200).json({
        jsonrpc: jsonrpc || '2.0',
        id: id ?? null,
        error: { code: -32000, message: err.message || 'Server error' }
      });
    }
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    verifyClient: ({ origin }, callback) => {
      if (!isAllowedOrigin(origin)) {
        callback(false, 403, 'Forbidden Origin');
        return;
      }
      callback(true);
    }
  });

  function broadcastNotification(method, params) {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params
    });
    for (const client of wss.clients) {
      if (client.readyState === 1) {
        client.send(payload);
      }
    }
  }

  wss.on('connection', (ws) => {
    ws.send(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'temple.state',
        params: store.getPublicState()
      })
    );

    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString('utf8'));
      } catch (_) {
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32700, message: 'Parse error' }
          })
        );
        return;
      }
      if (!msg || !msg.method) {
        if (msg && msg.id !== undefined) {
          ws.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              error: { code: -32600, message: 'Invalid JSON-RPC Request: thiếu method' }
            })
          );
        }
        return;
      }
      try {
        const handleRpcCall = getRpcHandler();
        const result = await handleRpcCall(msg.method, msg.params || {});
        if (msg.id !== undefined) {
          ws.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              result
            })
          );
        }
      } catch (err) {
        if (msg.id !== undefined) {
          ws.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              error: { code: -32000, message: err.message || 'RPC Error' }
            })
          );
        }
      }
    });
  });

  return {
    app,
    server,
    wss,
    broadcastNotification
  };
}
