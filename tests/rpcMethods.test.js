import { describe, expect, test } from 'bun:test';
import { createRpcDispatcher } from '../src/rpc/rpcMethods.js';
import { createRitualEngine } from '../src/sanctuary/rituals.js';
import { createStateStore } from '../src/sanctuary/stateStore.js';

describe('rpc/rpcMethods (16 JSON-RPC 2.0 methods)', () => {
  function setupRpcTestHarness() {
    const broadcasts = [];
    const store = createStateStore({
      persist: false,
      getTtsStatus: () => ({ ready: true, status: 'ready', voice: 'maichi' }),
      hasBgChant: false
    });
    const rituals = createRitualEngine({
      store,
      onEvent: (payload) => broadcasts.push({ method: 'temple.event', params: payload }),
      onStateChange: (st) => broadcasts.push({ method: 'temple.state', params: st })
    });

    const zeroTts = {
      getStatus: () => ({ ready: true, status: 'ready', voice: 'maichi' }),
      synthesize: async (text, voice) => ({
        ok: true,
        cached: false,
        voice,
        url: '/tts-cache/test.wav',
        text
      })
    };

    const tiktokLive = {
      connect: async (username) => {
        store.setTikTokStatus({ connected: true, username: username.replace(/^@/, '') });
        return { ok: true, status: store.state.tiktok };
      },
      disconnect: () => {
        store.setTikTokStatus({ connected: false });
        return { ok: true, status: store.state.tiktok };
      }
    };

    const autoSim = {
      configure: (enabled) => {
        store.state.settings.autoSim = enabled;
      }
    };

    const dispatcher = createRpcDispatcher({
      store,
      rituals,
      zeroTts,
      tiktokLive,
      autoSim,
      onBroadcast: (method, params) => broadcasts.push({ method, params })
    });

    return { dispatcher, broadcasts, store };
  }

  test('đăng ký đủ 16 phương thức JSON-RPC 2.0 chuẩn', () => {
    const { dispatcher } = setupRpcTestHarness();
    expect(Object.keys(dispatcher.methods)).toHaveLength(16);
    expect(Object.keys(dispatcher.methods).sort()).toEqual(
      [
        'temple.getState',
        'temple.burnIncense',
        'temple.strikeWoodenFish',
        'temple.ringBell',
        'temple.sendPrayer',
        'temple.offerGift',
        'temple.drawFortune',
        'temple.grandCeremony',
        'temple.updateSettings',
        'temple.resetMerit',
        'temple.comment',
        'temple.speak',
        'temple.ttsStatus',
        'live.connect',
        'live.disconnect',
        'live.setAutoSim'
      ].sort()
    );
  });

  test('thực thi đầy đủ các lệnh nghi thức, giọng đọc TTS, TikTok Live và AutoSim qua handleRpcCall', async () => {
    const { dispatcher, broadcasts } = setupRpcTestHarness();

    const state = await dispatcher.handleRpcCall('temple.getState');
    expect(state.tts.ready).toBe(true);
    expect(state.assets.hasBgChant).toBe(false);

    const incense = await dispatcher.handleRpcCall('temple.burnIncense', { user: 'Thiện Tâm', count: 3 });
    expect(incense.event.merit).toBe(15);

    const speak = await dispatcher.handleRpcCall('temple.speak', {
      text: 'Nam mô A Di Đà Phật',
      voice: 'maichi',
      broadcast: true
    });
    expect(speak.ok).toBe(true);
    expect(broadcasts.some((b) => b.method === 'tts.play' && b.params.url === '/tts-cache/test.wav')).toBe(
      true
    );

    const conn = await dispatcher.handleRpcCall('live.connect', { username: '@chualinhung' });
    expect(conn.status.connected).toBe(true);
    expect(conn.status.username).toBe('chualinhung');

    const disc = await dispatcher.handleRpcCall('live.disconnect');
    expect(disc.status.connected).toBe(false);

    const simState = await dispatcher.handleRpcCall('live.setAutoSim', { enabled: true });
    expect(simState.settings.autoSim).toBe(true);
  });

  test('ném lỗi rõ ràng khi gọi phương thức JSON-RPC không tồn tại', async () => {
    const { dispatcher } = setupRpcTestHarness();
    await expect(dispatcher.handleRpcCall('temple.unknownMethod', {})).rejects.toThrow(
      'Không tìm thấy phương thức JSON-RPC: temple.unknownMethod'
    );
  });
});
