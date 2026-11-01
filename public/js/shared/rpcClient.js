/**
 * Client JSON-RPC 2.0 dùng chung cho màn hình Live 9:16 và trang Quản trị (/admin).
 * Hỗ trợ kênh WebSocket thời gian thực (/ws, tự kết nối lại) + fallback HTTP POST /rpc.
 */
export class TempleRpcClient {
  constructor({
    autoConnectWs = true,
    onState = null,
    onEvent = null,
    onTtsPlay = null,
    onViewerCount = null,
    onTtsStatus = null
  } = {}) {
    this.onState = onState;
    this.onEvent = onEvent;
    this.onTtsPlay = onTtsPlay;
    this.onViewerCount = onViewerCount;
    this.onTtsStatus = onTtsStatus;

    this.ws = null;
    this.rpcId = 1;
    this.pendingWsCalls = new Map();
    this.closedExplicitly = false;

    if (autoConnectWs) {
      this.connectWebSocket();
    }
  }

  connectWebSocket() {
    if (this.closedExplicitly) return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    this.ws = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id !== undefined && this.pendingWsCalls.has(msg.id)) {
          const entry = this.pendingWsCalls.get(msg.id);
          clearTimeout(entry.timer);
          this.pendingWsCalls.delete(msg.id);
          entry.resolve(msg);
          return;
        }

        switch (msg.method) {
          case 'temple.state':
            if (this.onState) this.onState(msg.params);
            break;
          case 'temple.event':
            if (msg.params?.state && this.onState) this.onState(msg.params.state);
            if (msg.params?.event && this.onEvent) this.onEvent(msg.params.event);
            break;
          case 'tts.play':
            if (this.onTtsPlay) this.onTtsPlay(msg.params);
            break;
          case 'temple.viewerCount':
            if (this.onViewerCount) this.onViewerCount(msg.params);
            break;
          case 'tts.status':
            if (this.onTtsStatus) this.onTtsStatus(msg.params);
            break;
        }
      } catch (_) {}
    };

    ws.onclose = () => {
      for (const [, entry] of this.pendingWsCalls) {
        clearTimeout(entry.timer);
        entry.resolve({ jsonrpc: '2.0', error: { code: -32001, message: 'WebSocket closed' } });
      }
      this.pendingWsCalls.clear();
      if (!this.closedExplicitly) {
        setTimeout(() => this.connectWebSocket(), 2000);
      }
    };
  }

  async callHttp(method, params = {}) {
    const id = this.rpcId++;
    const payload = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };
    try {
      const res = await fetch('/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32003, message: `HTTP ${res.status}` }
        };
      }
      return await res.json();
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32003, message: err?.message || 'Network error' }
      };
    }
  }

  async call(method, params = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const id = this.rpcId++;
      const payload = { jsonrpc: '2.0', id, method, params };
      return await new Promise((resolve) => {
        const timer = setTimeout(() => {
          this.pendingWsCalls.delete(id);
          resolve({ jsonrpc: '2.0', id, error: { code: -32002, message: 'RPC timeout' } });
        }, 15000);
        this.pendingWsCalls.set(id, { resolve, timer });
        this.ws.send(JSON.stringify(payload));
      });
    }

    const data = await this.callHttp(method, params);
    if (data?.result?.state && this.onState) this.onState(data.result.state);
    if (data?.result?.event && this.onEvent) this.onEvent(data.result.event);
    return data;
  }
}
