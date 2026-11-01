import { TempleRpcClient } from './shared/rpcClient.js';
import { TempleAudioEngine } from './stage/audioEngine.js';
import { TempleParticleEngine } from './stage/particleCanvas.js';
import { createSanctuaryStage } from './stage/sanctuaryStage.js';
import { createHudAndDock } from './ui/hudAndDock.js';

/**
 * Entrypoint màn hình Chánh Điện 9:16 (http://localhost:PORT/ và /?obs=1).
 * Lắp ráp Động cơ Hạt 30FPS, Động cơ Âm thanh, Sân khấu Chánh Điện, HUD & Kết nối JSON-RPC 2.0.
 */
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('obs') === '1') {
  document.body.classList.add('obs-mode');
}

const canvas = document.getElementById('templeCanvas');
const particles = new TempleParticleEngine(canvas);
const audio = new TempleAudioEngine();
const stage = createSanctuaryStage({ particles, audio });

let hud = null;

const rpcClient = new TempleRpcClient({
  autoConnectWs: true,
  onState: (st) => hud?.updateUIState(st),
  onEvent: (ev) => stage.triggerRitualVisuals(ev),
  onTtsPlay: (payload) => {
    if (payload?.text) {
      audio.enqueueTts(payload.text, {
        voice: payload.voice || 'maichi',
        url: payload.url || null
      });
    }
  },
  onViewerCount: (payload) => hud?.updateViewerCount(payload)
});

hud = createHudAndDock({ stage, audio, rpcClient });

stage.renderIncenseSticks(9);
stage.renderCongregationHall([]);

fetch('/api/state')
  .then((res) => res.json())
  .then((st) => hud.updateUIState(st))
  .catch(() => {});

window.__TEMPLE_DEBUG__ = {
  stage,
  particles,
  audio,
  rpcClient,
  hud
};
