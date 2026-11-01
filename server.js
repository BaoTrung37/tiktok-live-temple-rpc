import {
  DEFAULT_TIKTOK_USER,
  PORT,
  PROJECT_ROOT,
  PUBLIC_DIR,
  PYTHON_WORKER_FILE,
  STATE_FILE,
  TTS_CACHE_DIR,
  TTS_CACHE_MAX_FILES,
  VENV_PYTHON_BIN,
  ensureDataDirectories,
  hasCustomBgChantFile
} from './src/config.js';
import { createAutoSimulator } from './src/integrations/autoSim.js';
import { createTikTokLiveConnector } from './src/integrations/tiktokLive.js';
import { ZeroTTSManager } from './src/integrations/zeroTts.js';
import { createRpcDispatcher } from './src/rpc/rpcMethods.js';
import { createTransportServer } from './src/rpc/transport.js';
import { createRitualEngine } from './src/sanctuary/rituals.js';
import { createStateStore } from './src/sanctuary/stateStore.js';

ensureDataDirectories();

let zeroTts = null;
let transport = null;
let autoSim = null;
let rpcDispatcher = null;

const store = createStateStore({
  stateFile: STATE_FILE,
  persist: true,
  getTtsStatus: () => (zeroTts ? zeroTts.getStatus() : { ready: false, status: 'init', voice: 'maichi' }),
  hasBgChant: hasCustomBgChantFile
});

const rituals = createRitualEngine({
  store,
  onEvent: (payload) => transport?.broadcastNotification('temple.event', payload),
  onStateChange: (publicState) => transport?.broadcastNotification('temple.state', publicState),
  onAutoSimToggle: (enabled) => autoSim?.configure(enabled)
});

autoSim = createAutoSimulator({ store, rituals });

zeroTts = new ZeroTTSManager({
  projectRoot: PROJECT_ROOT,
  workerScript: PYTHON_WORKER_FILE,
  venvPythonBin: VENV_PYTHON_BIN,
  cacheDir: TTS_CACHE_DIR,
  maxCacheFiles: TTS_CACHE_MAX_FILES,
  getPreferredVoice: () => store.state.settings.ttsVoice || 'maichi',
  onStatusChange: (status) => transport?.broadcastNotification('tts.status', status)
});

const tiktokLive = createTikTokLiveConnector({
  store,
  rituals,
  onStateChange: (publicState) => transport?.broadcastNotification('temple.state', publicState),
  onViewerCount: (payload) => transport?.broadcastNotification('temple.viewerCount', payload)
});

transport = createTransportServer({
  store,
  zeroTts,
  getRpcHandler: () => rpcDispatcher.handleRpcCall,
  publicDir: PUBLIC_DIR,
  ttsCacheDir: TTS_CACHE_DIR
});

rpcDispatcher = createRpcDispatcher({
  store,
  rituals,
  zeroTts,
  tiktokLive,
  autoSim,
  onBroadcast: (method, params) => transport.broadcastNotification(method, params)
});

transport.server.listen(PORT, () => {
  console.log('============================================================');
  console.log('🪷 CHÙA ONLINE TIKTOK LIVE RPC ĐÃ KHỞI ĐỘNG');
  console.log(`📺 Màn hình Live (9:16 OBS): http://localhost:${PORT}`);
  console.log(`🎛️ Bảng điều khiển RPC Admin: http://localhost:${PORT}/admin`);
  console.log(`🔌 JSON-RPC 2.0 Endpoint   : http://localhost:${PORT}/rpc (ws://localhost:${PORT}/ws)`);
  console.log('============================================================');

  if (store.state.settings.autoSim) {
    autoSim.configure(true);
  }

  const defaultChannel = DEFAULT_TIKTOK_USER || store.state.tiktok?.username;
  if (defaultChannel) {
    tiktokLive.connect(defaultChannel).catch((err) => {
      console.warn(`[Auto-Connect @${defaultChannel}] Chưa kết nối được ngay:`, err.message);
    });
  }
});

let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[Shutdown] Nhận tín hiệu ${signal}, đang lưu trạng thái và đóng tiến trình...`);
  autoSim.stop();
  tiktokLive.disconnect();
  zeroTts.shutdown();
  await store.flushSave().catch(() => {});
  for (const client of transport.wss.clients) {
    try {
      client.terminate();
    } catch (_) {}
  }
  transport.wss.close();
  transport.server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
