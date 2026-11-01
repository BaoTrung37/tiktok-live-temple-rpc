import { drawRandomFortune } from './fortunes.js';
import {
  COMMENT_COOLDOWN_MAX_ENTRIES,
  COMMENT_COOLDOWN_MS,
  COMMENT_INTENT_RULES,
  resolveGiftOffering
} from './rules.js';
import { isBlockedSpamOrToxic, sanitizeUserName, sanitizeWishText } from './sanitizer.js';

/**
 * Động cơ thực thi các nghi thức tâm linh & phân tích bình luận người xem.
 * Hoàn toàn không phụ thuộc Express/WebSocket/Python — thông báo ra ngoài qua callbacks.
 */
export function createRitualEngine({
  store,
  onEvent = null,
  onStateChange = null,
  onAutoSimToggle = null
}) {
  const commentCooldownMap = new Map();

  function emitRitualEvent(event) {
    store.saveState();
    const publicState = store.getPublicState();
    const payload = { event, state: publicState };
    if (onEvent) onEvent(payload);
    return payload;
  }

  function emitStateOnly() {
    const publicState = store.getPublicState();
    if (onStateChange) onStateChange(publicState);
    return publicState;
  }

  function burnIncense(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(9, Number(params.count) || 3));
    const wish = sanitizeWishText(params.wish) || 'Thành tâm dâng hương bái Phật, cầu bình an cát tường';
    const merit = count * 5;

    store.state.totalIncense += count;
    store.state.activeIncenseSticks = Math.min(36, store.state.activeIncenseSticks + count);
    const devotee = store.recordDevotee(user, uniqueId, avatar, merit, count, 0, wish);

    const ttsText =
      params.readTts === false
        ? ''
        : `Nam mô A Di Đà Phật. Cảm tạ thí chủ ${devotee.name} đã thành tâm thắp ${count} nén hương thơm. ${wish}.`;

    const event = store.pushEventLog({
      type: 'burnIncense',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit,
      wish,
      ttsText,
      ttsVoice: store.state.settings.ttsVoice || 'maichi'
    });

    return emitRitualEvent(event);
  }

  function strikeWoodenFish(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(50, Number(params.count) || 1));
    const merit = count;

    store.state.woodenFishHits += count;
    const devotee = store.recordDevotee(user, uniqueId, avatar, merit, 0, 0);

    const event = store.pushEventLog({
      type: 'strikeWoodenFish',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit,
      ttsText: params.ttsText ? sanitizeWishText(params.ttsText) : ''
    });

    return emitRitualEvent(event);
  }

  function ringBell(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(9, Number(params.count) || 1));
    const wish = sanitizeWishText(params.wish) || 'Thỉnh chuông Bát Nhã, phiền não tiêu tan, trí tuệ sáng ngời';
    const merit = count * 10;

    store.state.bellRings += count;
    const devotee = store.recordDevotee(user, uniqueId, avatar, merit, 0, 0, wish);

    const ttsText = params.readTts
      ? `Thí chủ ${devotee.name} thỉnh Đại Hồng Chung cầu nguyện: ${wish}.`
      : '';

    const event = store.pushEventLog({
      type: 'ringBell',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit,
      wish,
      ttsText,
      ttsVoice: store.state.settings.ttsVoice || 'maichi'
    });

    return emitRitualEvent(event);
  }

  function sendPrayer(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const wish = sanitizeWishText(params.wish) || 'Cầu cho quốc thái dân an, gia đình mạnh khỏe hạnh phúc';
    const merit = 10;

    store.state.lanternCount += 1;
    const devotee = store.recordDevotee(user, uniqueId, avatar, merit, 1, 0, wish);

    const ttsText =
      params.readTts === false
        ? ''
        : `Lời cầu nguyện của thí chủ ${devotee.name}: ${wish}. Nam mô A Di Đà Phật.`;

    const event = store.pushEventLog({
      type: 'sendPrayer',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      wish,
      merit,
      ttsText,
      ttsVoice: store.state.settings.ttsVoice || 'maichi'
    });

    return emitRitualEvent(event);
  }

  function offerGift(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const { coins, giftType, giftName, merit } = resolveGiftOffering(params);

    store.state.offerings[giftType] = (store.state.offerings[giftType] || 0) + 1;
    store.state.totalIncense += 3;
    store.state.activeIncenseSticks = Math.min(36, store.state.activeIncenseSticks + 3);

    const wish = sanitizeWishText(params.wish) || `Dâng cúng ${giftName} lên Tam Bảo`;
    const devotee = store.recordDevotee(user, uniqueId, avatar, merit, 3, 1, wish);

    const ttsText =
      params.readTts === false
        ? ''
        : `Công đức vô lượng! Cảm tạ thí chủ ${devotee.name} đã phát tâm dâng cúng ${giftName}, tích thêm ${merit} điểm công đức. Nguyện cầu chư Phật gia hộ cho thí chủ vạn sự cát tường như ý.`;

    const event = store.pushEventLog({
      type: giftType === 'dragon' ? 'grandCeremony' : 'offerGift',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      giftType,
      giftName,
      coins,
      merit,
      wish,
      ttsText,
      ttsVoice: store.state.settings.ttsVoice || 'maichi'
    });

    return emitRitualEvent(event);
  }

  function drawFortune(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const topic = sanitizeWishText(params.topic) || 'Gia đạo, Tài lộc và Bình an';
    const fortune = drawRandomFortune();
    const merit = 10;

    store.state.fortuneCount += 1;
    const devotee = store.recordDevotee(
      user,
      uniqueId,
      avatar,
      merit,
      0,
      0,
      `Xin xăm: Quẻ số ${fortune.number} (${fortune.rank})`
    );

    const ttsText =
      params.readTts === false
        ? ''
        : `Thí chủ ${devotee.name} vừa gieo được ${fortune.ttsSummary}`;

    const event = store.pushEventLog({
      type: 'drawFortune',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      topic,
      fortune,
      merit,
      ttsText,
      ttsVoice: store.state.settings.ttsVoice || 'maichi'
    });

    return emitRitualEvent(event);
  }

  function grandCeremony(params = {}) {
    return offerGift({
      ...params,
      giftType: 'dragon',
      coins: Math.max(100, Number(params.coins) || 199),
      giftName: params.giftName || 'Đại Lễ Hào Quang Vạn Trượng'
    });
  }

  function updateSettings(params = {}) {
    store.updateSettings(params);
    if (typeof params.autoSim === 'boolean' && onAutoSimToggle) {
      onAutoSimToggle(params.autoSim);
    }
    return emitStateOnly();
  }

  function resetMerit() {
    store.resetMerit();
    return emitStateOnly();
  }

  function parseViewerComment(commentText, user, uniqueId, avatar, now = Date.now()) {
    const raw = String(commentText || '').trim();
    if (!raw || isBlockedSpamOrToxic(raw)) {
      return null;
    }

    const cleanWish = sanitizeWishText(raw);
    if (!cleanWish || cleanWish.length < 3) {
      return null;
    }

    const userKey = uniqueId || user || '';
    if (userKey) {
      const lastTs = commentCooldownMap.get(userKey) || 0;
      if (now - lastTs < COMMENT_COOLDOWN_MS) {
        return null;
      }
      commentCooldownMap.set(userKey, now);
      if (commentCooldownMap.size > COMMENT_COOLDOWN_MAX_ENTRIES) {
        const oldestKey = commentCooldownMap.keys().next().value;
        commentCooldownMap.delete(oldestKey);
      }
    }

    const cleanUser = sanitizeUserName(user);
    const lower = cleanWish.toLowerCase();

    for (const rule of COMMENT_INTENT_RULES) {
      if (rule.keywords.some((kw) => lower.includes(kw))) {
        switch (rule.intent) {
          case 'drawFortune':
            return drawFortune({ user: cleanUser, uniqueId, avatar, topic: cleanWish });
          case 'ringBell':
            return ringBell({ user: cleanUser, uniqueId, avatar, count: 1, wish: cleanWish, readTts: true });
          case 'strikeWoodenFish':
            return strikeWoodenFish({ user: cleanUser, uniqueId, avatar, count: 3 });
          case 'burnIncense3':
            return burnIncense({ user: cleanUser, uniqueId, avatar, count: 3, wish: cleanWish });
          case 'sendPrayer':
            return sendPrayer({ user: cleanUser, uniqueId, avatar, wish: cleanWish });
        }
      }
    }

    return burnIncense({ user: cleanUser, uniqueId, avatar, count: 1, wish: cleanWish });
  }

  return {
    burnIncense,
    strikeWoodenFish,
    ringBell,
    sendPrayer,
    offerGift,
    drawFortune,
    grandCeremony,
    updateSettings,
    resetMerit,
    parseViewerComment
  };
}
