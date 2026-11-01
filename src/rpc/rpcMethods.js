/**
 * Bảng định tuyến phẳng toàn bộ 16 phương thức JSON-RPC 2.0 (Single Source of Truth cho API).
 */
export function createRpcDispatcher({
  store,
  rituals,
  zeroTts,
  tiktokLive,
  autoSim,
  onBroadcast = null
}) {
  const methods = {
    'temple.getState': () => store.getPublicState(),
    'temple.burnIncense': (params) => rituals.burnIncense(params),
    'temple.strikeWoodenFish': (params) => rituals.strikeWoodenFish(params),
    'temple.ringBell': (params) => rituals.ringBell(params),
    'temple.sendPrayer': (params) => rituals.sendPrayer(params),
    'temple.offerGift': (params) => rituals.offerGift(params),
    'temple.drawFortune': (params) => rituals.drawFortune(params),
    'temple.grandCeremony': (params) => rituals.grandCeremony(params),
    'temple.updateSettings': (params) => rituals.updateSettings(params),
    'temple.resetMerit': () => rituals.resetMerit(),
    'temple.comment': (params) =>
      rituals.parseViewerComment(params.comment, params.user, params.uniqueId, params.avatar),
    'temple.speak': async (params) => {
      const res = await zeroTts.synthesize(params.text, params.voice || 'maichi');
      if (res.ok && params.broadcast !== false && onBroadcast) {
        onBroadcast('tts.play', {
          text: params.text,
          voice: res.voice,
          url: res.url
        });
      }
      return res;
    },
    'temple.ttsStatus': () => zeroTts.getStatus(),
    'live.connect': async (params) => await tiktokLive.connect(params.username),
    'live.disconnect': () => tiktokLive.disconnect(),
    'live.setAutoSim': (params) => {
      autoSim.configure(Boolean(params.enabled));
      store.saveState();
      const publicState = store.getPublicState();
      if (onBroadcast) onBroadcast('temple.state', publicState);
      return publicState;
    }
  };

  async function handleRpcCall(method, params = {}) {
    const handler = methods[method];
    if (!handler) {
      throw new Error(`Không tìm thấy phương thức JSON-RPC: ${method}`);
    }
    return await handler(params || {});
  }

  return {
    methods,
    handleRpcCall
  };
}
