import { ControlEvent, TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';

const TIKTOK_RESOLVE_TIMEOUT_MS = 5000;
const GIFT_TRACKER_MAX_ENTRIES = 500;

export function isTikTokHostname(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'tiktok.com' || host.endsWith('.tiktok.com');
}

export async function resolveTikTokUsername(rawInput, fetchImpl = fetch) {
  const input = String(rawInput || '').trim();
  if (!input) {
    throw new Error('Vui lòng nhập @username hoặc link TikTok Live cần kết nối');
  }

  const looksLikeUrl = /^https?:\/\//i.test(input) || input.includes('tiktok.com/');
  if (looksLikeUrl) {
    const urlToFetch = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    let parsedUrl;
    try {
      parsedUrl = new URL(urlToFetch);
    } catch (_) {
      throw new Error('Đường dẫn TikTok Live không hợp lệ');
    }

    if (
      (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') ||
      !isTikTokHostname(parsedUrl.hostname)
    ) {
      throw new Error('Chỉ chấp nhận đường dẫn thuộc tên miền tiktok.com');
    }

    const directMatch = parsedUrl.pathname.match(/^\/@([^/?#]+)/i);
    if (directMatch && directMatch[1]) {
      return directMatch[1];
    }

    try {
      const resp = await fetchImpl(parsedUrl.toString(), {
        redirect: 'follow',
        signal: AbortSignal.timeout(TIKTOK_RESOLVE_TIMEOUT_MS)
      });
      const finalUrl = resp?.url || '';
      if (finalUrl) {
        const finalParsed = new URL(finalUrl);
        if (!isTikTokHostname(finalParsed.hostname)) {
          throw new Error('Link rút gọn chuyển hướng ra ngoài tiktok.com');
        }
        const resolvedMatch = finalParsed.pathname.match(/^\/@([^/?#]+)/i);
        if (resolvedMatch && resolvedMatch[1]) {
          return resolvedMatch[1];
        }
      }
    } catch (err) {
      console.warn('[TikTok URL Resolve Warning]', err.message);
    }

    throw new Error('Không giải mã được @username từ đường dẫn TikTok Live');
  }

  return input.replace(/^@/, '').split(/[/?#]/)[0].trim();
}

export function extractUserFromEvent(data) {
  const u = data?.user || data || {};
  const uniqueId = u.uniqueId || u.displayId || data?.uniqueId || '';
  const user = u.nickname || uniqueId || data?.nickname || 'Thí Chủ';
  const avatar =
    u.profilePictureUrl ||
    u.avatarLarge?.urlList?.[0] ||
    u.avatarThumb?.urlList?.[0] ||
    u.avatarMedium?.urlList?.[0] ||
    data?.profilePictureUrl ||
    '';
  return { user, uniqueId, avatar };
}

/**
 * Tính số lượng quà tăng thêm (delta) chuẩn xác cho cả quà thường lẫn chuỗi combo (streak).
 * Luôn xóa `groupId` ngay khi nhận gói `repeatEnd === true` để không bao giờ nuốt lần tặng quà đơn kế tiếp.
 */
export function computeGiftComboDelta(giftComboTracker, data, uniqueId, giftId) {
  const giftObj = data?.gift || data?.giftDetails || {};
  const repeatCount = Math.max(1, Number(data?.repeatCount || data?.comboCount || 1));
  const isStreakGift =
    Number(giftObj?.giftType ?? data?.giftType) === 1 || typeof data?.repeatEnd === 'boolean';

  if (!isStreakGift) {
    return repeatCount;
  }

  const groupId = String(data?.groupId || `${uniqueId}_${giftId}`);
  const prevCount = giftComboTracker.get(groupId) || 0;

  if (data?.repeatEnd) {
    giftComboTracker.delete(groupId);
    if (prevCount > 0 && repeatCount <= prevCount) {
      return 0;
    }
    return Math.max(1, repeatCount - prevCount);
  }

  if (repeatCount <= prevCount) {
    return 0;
  }

  const deltaCount = repeatCount - prevCount;
  giftComboTracker.set(groupId, repeatCount);
  if (giftComboTracker.size > GIFT_TRACKER_MAX_ENTRIES) {
    const firstKey = giftComboTracker.keys().next().value;
    giftComboTracker.delete(firstKey);
  }
  return deltaCount;
}

export function createTikTokLiveConnector({
  store,
  rituals,
  onStateChange = null,
  onViewerCount = null
}) {
  let tiktokConn = null;
  let activeConnectSeq = 0;
  const giftComboTracker = new Map();

  function broadcastState() {
    if (onStateChange) onStateChange(store.getPublicState());
  }

  async function connect(usernameOrUrl) {
    const seq = ++activeConnectSeq;
    const cleanUser = await resolveTikTokUsername(usernameOrUrl);
    if (!cleanUser) {
      throw new Error('Không tìm thấy @username hợp lệ từ dữ liệu nhập vào');
    }
    if (seq !== activeConnectSeq) {
      return store.state.tiktok;
    }

    if (tiktokConn) {
      const oldConn = tiktokConn;
      tiktokConn = null;
      try {
        await oldConn.disconnect();
      } catch (_) {}
      if (seq !== activeConnectSeq) {
        return store.state.tiktok;
      }
    }

    store.setTikTokStatus({
      connected: false,
      connecting: true,
      username: cleanUser,
      roomId: null,
      viewerCount: 0,
      lastError: null
    });
    broadcastState();

    const conn = new TikTokLiveConnection(cleanUser, {
      processInitialData: true,
      fetchRoomInfoOnConnect: false,
      enableExtendedGiftInfo: false
    });
    tiktokConn = conn;
    const isCurrentConn = () => conn === tiktokConn && seq === activeConnectSeq;

    conn.on(ControlEvent.CONNECTED, (roomState) => {
      if (!isCurrentConn()) return;
      store.setTikTokStatus({
        connected: true,
        connecting: false,
        roomId: roomState?.roomId || conn?.roomId || null,
        lastError: null
      });
      console.log(`[TikTok Live] Đã kết nối phòng @${cleanUser} (roomId: ${store.state.tiktok.roomId})`);
      broadcastState();
    });

    conn.on(ControlEvent.DISCONNECTED, () => {
      if (!isCurrentConn()) return;
      store.setTikTokStatus({
        connected: false,
        connecting: false
      });
      console.log(`[TikTok Live] Đã ngắt kết nối @${cleanUser}`);
      broadcastState();
    });

    conn.on(ControlEvent.ERROR, (err) => {
      if (!isCurrentConn()) return;
      const lastError = err?.message || String(err);
      store.setTikTokStatus({ lastError });
      console.warn('[TikTok Live Warning]', lastError);
      broadcastState();
    });

    conn.on(WebcastEvent.ROOM_USER, (data) => {
      if (!isCurrentConn()) return;
      const viewerCount = Number(data?.total ?? data?.viewerCount ?? 0);
      if (viewerCount > 0) {
        store.setTikTokStatus({ viewerCount });
        if (onViewerCount) onViewerCount({ viewerCount });
      }
    });

    conn.on(WebcastEvent.MEMBER, (data) => {
      if (!isCurrentConn()) return;
      const { user, uniqueId, avatar } = extractUserFromEvent(data);
      store.recordDevotee(user, uniqueId, avatar, 1, 0, 0, 'Đã vào Chánh Điện lễ Phật');
      broadcastState();
    });

    conn.on(WebcastEvent.CHAT, (data) => {
      if (!isCurrentConn()) return;
      const { user, uniqueId, avatar } = extractUserFromEvent(data);
      const commentText = data?.content || data?.comment || '';
      console.log(`[TikTok Chat] ${user}: ${commentText}`);
      rituals.parseViewerComment(commentText, user, uniqueId, avatar);
    });

    conn.on(WebcastEvent.LIKE, (data) => {
      if (!isCurrentConn()) return;
      const { user, uniqueId, avatar } = extractUserFromEvent(data);
      const likeCount = Math.min(15, Math.max(1, Number(data?.count ?? data?.likeCount ?? 1)));
      rituals.strikeWoodenFish({ user, uniqueId, avatar, count: likeCount });
    });

    const handleSocialEvent = (data) => {
      if (!isCurrentConn()) return;
      const { user, uniqueId, avatar } = extractUserFromEvent(data);
      rituals.ringBell({
        user,
        uniqueId,
        avatar,
        count: 1,
        wish: 'Hữu duyên tương ngộ nơi cửa Phật, cầu bình an may mắn',
        readTts: false
      });
    };

    conn.on(WebcastEvent.FOLLOW, handleSocialEvent);
    conn.on(WebcastEvent.SHARE, handleSocialEvent);
    conn.on(WebcastEvent.SOCIAL, (data) => {
      if (!isCurrentConn()) return;
      const action = String(data?.action || '');
      const disp = String(data?.common?.displayText?.displayType || data?.displayType || '').toLowerCase();
      if (action === '1' || action === '3' || disp.includes('follow') || disp.includes('share')) {
        handleSocialEvent(data);
      }
    });

    conn.on(WebcastEvent.GIFT, (data) => {
      if (!isCurrentConn()) return;
      const { user, uniqueId, avatar } = extractUserFromEvent(data);
      const giftObj = data?.gift || data?.giftDetails || {};
      const giftId = String(data?.giftId || giftObj?.id || 'rose');
      const deltaCount = computeGiftComboDelta(giftComboTracker, data, uniqueId, giftId);
      if (deltaCount <= 0) return;

      const diamondCount = Math.max(1, Number(giftObj?.diamondCount || data?.diamondCount || 1));
      const totalCoins = diamondCount * deltaCount;
      const rawGiftName = giftObj?.name || data?.giftName || giftObj?.describe || 'Hoa Hồng Tâm Thành';
      const displayGiftName = deltaCount > 1 ? `${deltaCount}x ${rawGiftName}` : rawGiftName;

      console.log(`[TikTok Gift] ${user} gửi ${displayGiftName} (${totalCoins} xu)`);

      rituals.offerGift({
        user,
        uniqueId,
        avatar,
        coins: totalCoins,
        giftName: displayGiftName,
        wish: `Thành tâm dâng ${displayGiftName} kính lễ Đức Phật A Di Đà`
      });
    });

    try {
      const roomState = await conn.connect();
      if (!isCurrentConn()) {
        try {
          conn.disconnect();
        } catch (_) {}
        return store.state.tiktok;
      }
      store.setTikTokStatus({
        connected: true,
        connecting: false,
        roomId: roomState?.roomId || conn?.roomId || null
      });
      broadcastState();
      return store.state.tiktok;
    } catch (err) {
      const lastError =
        err?.message || 'Không thể kết nối phòng Live (kiểm tra tài khoản đang phát Live chưa)';
      if (isCurrentConn()) {
        store.setTikTokStatus({
          connected: false,
          connecting: false,
          lastError
        });
        broadcastState();
      }
      throw new Error(lastError);
    }
  }

  function disconnect() {
    activeConnectSeq += 1;
    if (tiktokConn) {
      const oldConn = tiktokConn;
      tiktokConn = null;
      try {
        oldConn.disconnect();
      } catch (_) {}
    }
    store.setTikTokStatus({
      connected: false,
      connecting: false,
      viewerCount: 0
    });
    broadcastState();
    return store.state.tiktok;
  }

  return {
    connect,
    disconnect
  };
}
