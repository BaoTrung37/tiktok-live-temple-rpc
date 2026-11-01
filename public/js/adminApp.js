import { TempleRpcClient } from './shared/rpcClient.js';

/**
 * Entrypoint trang Quản trị JSON-RPC 2.0 (/admin).
 * Tái sử dụng TempleRpcClient (chế độ HTTP POST /rpc) để kiểm thử toàn bộ nghi thức & ZeroTTS.
 */
const rpcClient = new TempleRpcClient({ autoConnectWs: false });

async function refreshStatus() {
  try {
    const res = await fetch('/api/state');
    const st = await res.json();
    const banner = document.getElementById('statusBanner');
    if (banner) {
      banner.textContent = `Hương đã thắp: ${st.totalIncense} | Tổng Công Đức: ${st.totalMerit} | ZeroTTS: ${st.tts?.status} (Giọng: ${st.tts?.voice})`;
    }
  } catch (_) {}
}

async function sendRpc(method, extraParams = {}) {
  const user = document.getElementById('rpcUser')?.value.trim() || 'Thí Chủ';
  const wish = document.getElementById('rpcWish')?.value.trim() || '';
  const data = await rpcClient.callHttp(method, { user, wish, ...extraParams });
  const out = document.getElementById('rpcOutput');
  if (out) {
    out.textContent = JSON.stringify(data, null, 2);
  }
  refreshStatus();
  return data;
}

document.querySelectorAll('[data-rpc-method]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const method = btn.dataset.rpcMethod;
    let extra = {};
    if (btn.dataset.rpcParams) {
      try {
        extra = JSON.parse(btn.dataset.rpcParams);
      } catch (_) {}
    }
    sendRpc(method, extra);
  });
});

document.getElementById('btnConn')?.addEventListener('click', () => {
  const username = document.getElementById('ttUser')?.value.trim() || '';
  sendRpc('live.connect', { username });
});

document.getElementById('btnDisc')?.addEventListener('click', () => {
  sendRpc('live.disconnect', {});
});

document.getElementById('btnSendComment')?.addEventListener('click', () => {
  const comment = document.getElementById('simComment')?.value.trim() || '';
  sendRpc('temple.comment', { comment });
});

document.getElementById('btnSpeakMaiChi')?.addEventListener('click', async () => {
  const text = document.getElementById('ttsDirectText')?.value.trim() || '';
  const data = await sendRpc('temple.speak', { text, voice: 'maichi', broadcast: true });
  if (data?.result?.url) {
    const player = document.getElementById('adminAudioPreview');
    if (player) {
      player.src = data.result.url;
      player.play().catch(() => {});
    }
  }
});

refreshStatus();
setInterval(refreshStatus, 4000);
