import fs from 'node:fs';
import { sanitizeUserName, sanitizeWishText } from './sanitizer.js';

export const DEFAULT_STATE = {
  totalIncense: 108,
  totalMerit: 1080,
  woodenFishHits: 360,
  bellRings: 36,
  lanternCount: 18,
  fortuneCount: 12,
  activeIncenseSticks: 9,
  haloIntensity: 0.45,
  offerings: {
    lotus: 3,
    fruit: 2,
    lamp: 2,
    dragon: 1
  },
  devotees: {},
  recentEvents: [],
  settings: {
    ttsEnabled: true,
    ttsVoice: 'maichi',
    bgMusicEnabled: true,
    sfxEnabled: true,
    smokeDensity: 1.0,
    autoSim: false,
    autoSimIntervalMs: 9500
  },
  tiktok: {
    connected: false,
    connecting: false,
    username: 'zenfacts_vn',
    roomId: null,
    viewerCount: 0,
    lastError: null
  }
};

function cloneDefaultState() {
  return structuredClone(DEFAULT_STATE);
}

export function sanitizeSettingsPatch(patch = {}, baseSettings = DEFAULT_STATE.settings) {
  const next = { ...baseSettings };
  if (!patch || typeof patch !== 'object') return next;

  if (typeof patch.ttsEnabled === 'boolean') next.ttsEnabled = patch.ttsEnabled;
  if (typeof patch.bgMusicEnabled === 'boolean') next.bgMusicEnabled = patch.bgMusicEnabled;
  if (typeof patch.sfxEnabled === 'boolean') next.sfxEnabled = patch.sfxEnabled;
  if (typeof patch.autoSim === 'boolean') next.autoSim = patch.autoSim;

  if (typeof patch.ttsVoice === 'string') {
    const cleanVoice = patch.ttsVoice.trim().toLowerCase();
    if (/^[a-z0-9_-]{2,24}$/.test(cleanVoice)) {
      next.ttsVoice = cleanVoice;
    }
  }

  if (patch.smokeDensity !== undefined) {
    const density = Number(patch.smokeDensity);
    if (Number.isFinite(density)) {
      next.smokeDensity = Math.max(0, Math.min(3, density));
    }
  }

  if (patch.autoSimIntervalMs !== undefined) {
    const interval = Number(patch.autoSimIntervalMs);
    if (Number.isFinite(interval)) {
      next.autoSimIntervalMs = Math.max(2500, Math.min(120000, Math.round(interval)));
    }
  }

  return next;
}

/**
 * Kho quản lý trạng thái Chánh Điện & Bảng Vàng Công Đức.
 * Có thể chạy ở chế độ in-memory (`persist: false`) khi chạy Unit Test.
 */
export function createStateStore({
  stateFile = null,
  persist = true,
  debounceMs = 1200,
  getTtsStatus = null,
  hasBgChant = null
} = {}) {
  function loadInitialState() {
    if (persist && stateFile) {
      try {
        if (fs.existsSync(stateFile)) {
          const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
          return {
            ...cloneDefaultState(),
            ...saved,
            devotees: saved.devotees || {},
            offerings: { ...DEFAULT_STATE.offerings, ...(saved.offerings || {}) },
            settings: sanitizeSettingsPatch(saved.settings, DEFAULT_STATE.settings),
            tiktok: { ...DEFAULT_STATE.tiktok }
          };
        }
      } catch (err) {
        console.warn('[State] Không đọc được merit-state.json, dùng mặc định:', err.message);
      }
    }
    return cloneDefaultState();
  }

  const state = loadInitialState();
  let saveTimer = null;

  function buildPersistedSnapshot() {
    return {
      totalIncense: state.totalIncense,
      totalMerit: state.totalMerit,
      woodenFishHits: state.woodenFishHits,
      bellRings: state.bellRings,
      lanternCount: state.lanternCount,
      fortuneCount: state.fortuneCount,
      activeIncenseSticks: state.activeIncenseSticks,
      offerings: state.offerings,
      devotees: state.devotees,
      settings: state.settings
    };
  }

  function saveState() {
    if (!persist || !stateFile) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      fs.promises
        .writeFile(stateFile, JSON.stringify(buildPersistedSnapshot(), null, 2), 'utf8')
        .catch((err) => {
          console.error('[State] Lỗi lưu file:', err.message);
        });
    }, debounceMs);
  }

  async function flushSave() {
    if (!persist || !stateFile) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    await fs.promises.writeFile(stateFile, JSON.stringify(buildPersistedSnapshot(), null, 2), 'utf8');
  }

  function getLeaderboard(limit = 6) {
    return Object.values(state.devotees)
      .sort((a, b) => b.merit - a.merit)
      .slice(0, limit)
      .map((d, index) => ({
        rank: index + 1,
        name: d.name,
        uniqueId: d.uniqueId,
        avatar: d.avatar || '',
        merit: d.merit,
        incense: d.incense || 0,
        lastWish: d.lastWish || ''
      }));
  }

  function recordDevotee(user, uniqueId, avatar, meritDelta, incenseDelta = 0, giftDelta = 0, wish = '') {
    const displayName = sanitizeUserName(user || uniqueId);
    const cleanWish = sanitizeWishText(wish);
    const key = (uniqueId || displayName).slice(0, 40);
    if (!state.devotees[key]) {
      state.devotees[key] = {
        name: displayName,
        uniqueId: uniqueId || displayName.toLowerCase().replace(/\s+/g, ''),
        avatar: avatar || '',
        merit: 0,
        incense: 0,
        gifts: 0,
        lastWish: ''
      };
    }
    const dev = state.devotees[key];
    dev.name = displayName;
    if (avatar) dev.avatar = avatar;
    dev.merit += meritDelta;
    dev.incense += incenseDelta;
    dev.gifts += giftDelta;
    if (cleanWish) dev.lastWish = cleanWish;

    state.totalMerit += meritDelta;
    state.haloIntensity = Math.min(1.0, 0.35 + (state.totalMerit % 1000) / 1400);
    return dev;
  }

  function pushEventLog(evt) {
    const entry = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...evt
    };
    state.recentEvents.unshift(entry);
    if (state.recentEvents.length > 35) {
      state.recentEvents.length = 35;
    }
    return entry;
  }

  function updateSettings(patch = {}) {
    state.settings = sanitizeSettingsPatch(patch, state.settings);
    saveState();
    return state.settings;
  }

  function setTikTokStatus(patch = {}) {
    state.tiktok = {
      ...state.tiktok,
      ...patch
    };
    return state.tiktok;
  }

  function resetMerit() {
    state.totalIncense = 9;
    state.totalMerit = 0;
    state.woodenFishHits = 0;
    state.bellRings = 0;
    state.lanternCount = 0;
    state.fortuneCount = 0;
    state.activeIncenseSticks = 3;
    state.offerings = { lotus: 1, fruit: 1, lamp: 1, dragon: 0 };
    state.devotees = {};
    state.recentEvents = [];
    saveState();
    return getPublicState();
  }

  function getPublicState() {
    return {
      totalIncense: state.totalIncense,
      totalMerit: state.totalMerit,
      woodenFishHits: state.woodenFishHits,
      bellRings: state.bellRings,
      lanternCount: state.lanternCount,
      fortuneCount: state.fortuneCount,
      activeIncenseSticks: state.activeIncenseSticks,
      haloIntensity: state.haloIntensity,
      offerings: state.offerings,
      leaderboard: getLeaderboard(24),
      recentEvents: state.recentEvents.slice(0, 15),
      settings: state.settings,
      tiktok: state.tiktok,
      tts: getTtsStatus
        ? getTtsStatus()
        : { ready: false, status: 'init', voice: state.settings.ttsVoice || 'maichi' },
      assets: {
        hasBgChant: typeof hasBgChant === 'function' ? Boolean(hasBgChant()) : Boolean(hasBgChant)
      }
    };
  }

  return {
    state,
    saveState,
    flushSave,
    getLeaderboard,
    recordDevotee,
    pushEventLog,
    updateSettings,
    setTikTokStatus,
    resetMerit,
    getPublicState
  };
}
