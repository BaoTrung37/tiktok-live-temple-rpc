import { shortenName } from '../stage/stageConfig.js';

/**
 * Quản lý Thanh Trạng Thái Đỉnh, HUD Dưới Đáy (Bảng TẤM LÒNG THÀNH) và Bảng Điều Khiển Nhanh (Quick Dock).
 * Cam kết an toàn XSS: Mọi tên thí chủ & lời cầu nguyện từ TikTok đều gắn qua `textContent` / DOM Node.
 */
export function createHudAndDock({ stage, audio, rpcClient }) {
  let currentState = null;
  let hasInitializedRealLeader = false;

  const sliderMusicVol = document.getElementById('sliderMusicVol');
  const valMusicVol = document.getElementById('valMusicVol');
  const sliderTtsVol = document.getElementById('sliderTtsVol');
  const valTtsVol = document.getElementById('valTtsVol');

  function syncVolumeSlidersFromAudio() {
    const musicPct = Math.round(audio.bgBaseVolume * 100);
    const ttsPct = Math.round(audio.ttsVolume * 100);
    if (sliderMusicVol) sliderMusicVol.value = String(musicPct);
    if (valMusicVol) valMusicVol.textContent = `${musicPct}%`;
    if (sliderTtsVol) sliderTtsVol.value = String(ttsPct);
    if (valTtsVol) valTtsVol.textContent = `${ttsPct}%`;
  }

  function unlockAudioOnce() {
    audio.ensureContext();
    const btnUnlock = document.getElementById('btnUnlockAudio');
    if (btnUnlock) {
      btnUnlock.textContent = '🔊 Âm Thanh Chùa & Giọng Đọc Đã Sẵn Sàng';
      btnUnlock.classList.remove('gold');
      btnUnlock.classList.add('active-toggle');
    }
  }

  function getDevoteeInputs() {
    const user = document.getElementById('inputDevoteeName')?.value.trim() || 'Thí Chủ Hữu Duyên';
    const wish =
      document.getElementById('inputDevoteeWish')?.value.trim() ||
      'Cầu gia đình bình an, vạn sự cát tường như ý';
    return { user, wish };
  }

  function formatEventSummary(ev) {
    switch (ev.type) {
      case 'burnIncense':
        return `🔥 Thắp ${ev.count} nén hương (+${ev.merit} CĐ)`;
      case 'strikeWoodenFish':
        return `🪵 Gõ mõ (+${ev.merit} CĐ)`;
      case 'ringBell':
        return `🔔 Thỉnh Đại Hồng Chung (+${ev.merit} CĐ)`;
      case 'sendPrayer':
        return `🏮 Thả hoa đăng: “${ev.wish || ''}”`;
      case 'offerGift':
        return `🪷 Dâng ${ev.giftName} (+${ev.merit} CĐ)`;
      case 'grandCeremony':
        return `🐉 ĐẠI LỄ: ${ev.giftName} (+${ev.merit} CĐ)`;
      case 'drawFortune':
        return `🎋 Gieo quẻ số ${ev.fortune?.number} (${ev.fortune?.rank})`;
      default:
        return `✨ Tích thêm +${ev.merit || 0} Công Đức`;
    }
  }

  function renderLeaderboard(lb) {
    const lbEl = document.getElementById('leaderboardList');
    if (!lbEl) return;

    if (!lb.length) {
      const empty = document.createElement('div');
      empty.className = 'leader-item';
      const label = document.createElement('span');
      label.className = 'leader-name';
      label.textContent = 'Đang chờ thí chủ khai hương...';
      empty.appendChild(label);
      lbEl.replaceChildren(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    lb.slice(0, 4).forEach((item) => {
      const row = document.createElement('div');
      row.className = 'leader-item';

      const rank = document.createElement('span');
      rank.className = 'leader-rank';
      rank.textContent = String(item.rank);

      const name = document.createElement('span');
      name.className = 'leader-name';
      name.textContent = shortenName(item.name, 15);

      const merit = document.createElement('span');
      merit.className = 'leader-merit';
      merit.textContent = Number(item.merit || 0).toLocaleString('vi-VN');

      row.append(rank, name, merit);
      frag.appendChild(row);
    });
    lbEl.replaceChildren(frag);
  }

  function renderEventFeed(events = []) {
    const feedEl = document.getElementById('eventFeed');
    if (!feedEl) return;

    const frag = document.createDocumentFragment();
    events.slice(0, 8).forEach((ev) => {
      const item = document.createElement('div');
      item.className = 'event-feed-item';

      const userStrong = document.createElement('strong');
      userStrong.textContent = ev.user || 'Thí Chủ';

      item.append(userStrong, document.createTextNode(` — ${formatEventSummary(ev)}`));
      frag.appendChild(item);
    });
    feedEl.replaceChildren(frag);
  }

  function updateUIState(st) {
    if (!st) return;
    currentState = st;

    audio.configureBgChantAsset(Boolean(st.assets?.hasBgChant));
    if (typeof st.settings?.ttsVoice === 'string') {
      audio.ttsVoice = st.settings.ttsVoice;
    }
    if (typeof st.settings?.ttsEnabled === 'boolean') {
      audio.ttsEnabled = st.settings.ttsEnabled;
      const btnTts = document.getElementById('btnToggleTts');
      if (btnTts) {
        btnTts.textContent = `🎙️ Giọng Đọc: ${audio.ttsEnabled ? 'BẬT' : 'TẮT'}`;
        btnTts.classList.toggle('active-toggle', audio.ttsEnabled);
      }
    }
    if (typeof st.settings?.bgMusicEnabled === 'boolean') {
      const prevMusic = audio.bgMusicEnabled;
      audio.bgMusicEnabled = st.settings.bgMusicEnabled;
      if (prevMusic !== audio.bgMusicEnabled) {
        if (!audio.bgMusicEnabled) {
          audio.stopZenAmbience();
        } else if (audio.unlocked) {
          audio.startZenAmbience();
        }
      }
      const btnMusic = document.getElementById('btnToggleMusic');
      if (btnMusic) {
        btnMusic.textContent = `🎵 Nhạc Nền: ${audio.bgMusicEnabled ? 'BẬT' : 'TẮT'}`;
        btnMusic.classList.toggle('active-toggle', audio.bgMusicEnabled);
      }
    }

    const statIncense = document.getElementById('statIncense');
    const statMerit = document.getElementById('statMerit');
    const statWoodenFish = document.getElementById('statWoodenFish');
    if (statIncense) statIncense.textContent = Number(st.totalIncense || 0).toLocaleString('vi-VN');
    if (statMerit) statMerit.textContent = Number(st.totalMerit || 0).toLocaleString('vi-VN');
    if (statWoodenFish) {
      statWoodenFish.textContent = Number(st.woodenFishHits || 0).toLocaleString('vi-VN');
    }

    stage.renderIncenseSticks(st.activeIncenseSticks || 9);

    const lb = Array.isArray(st.leaderboard) ? st.leaderboard : [];
    stage.renderVipCushions(lb);
    stage.renderCongregationHall(lb);
    renderLeaderboard(lb);

    if (!hasInitializedRealLeader && lb.length > 0) {
      hasInitializedRealLeader = true;
      const top1 = lb[0];
      stage.updateCentralWorshipper(
        top1.name,
        top1.avatar,
        `✨ Top 1 Công Đức (${Number(top1.merit || 0).toLocaleString('vi-VN')} CĐ)`,
        top1.lastWish || 'Nam Mô A Di Đà Phật, cầu bình an cát tường',
        false
      );
    }

    const liveDot = document.getElementById('liveDot');
    const liveStatusText = document.getElementById('liveStatusText');
    if (liveDot && liveStatusText) {
      if (st.tiktok?.connected) {
        liveDot.classList.add('connected');
        liveStatusText.textContent = `LIVE @${st.tiktok.username} • ${st.tiktok.viewerCount || 0} người xem`;
      } else if (st.tiktok?.connecting) {
        liveDot.classList.remove('connected');
        liveStatusText.textContent = `Đang kết nối @${st.tiktok.username}...`;
      } else {
        liveDot.classList.remove('connected');
        liveStatusText.textContent = 'CHÙA LINH ỨNG • ĐỨC PHẬT A DI ĐÀ';
      }
    }

    const inputTikTokUser = document.getElementById('inputTikTokUser');
    if (
      inputTikTokUser &&
      document.activeElement !== inputTikTokUser &&
      st.tiktok?.username &&
      !inputTikTokUser.dataset.userEdited
    ) {
      inputTikTokUser.value = `@${st.tiktok.username}`;
    }

    const btnAutoSim = document.getElementById('btnToggleAutoSim');
    if (btnAutoSim) {
      const autoOn = Boolean(st.settings?.autoSim);
      btnAutoSim.textContent = `🤖 Tự động Giả lập Người Xem: ${autoOn ? 'BẬT' : 'TẮT'}`;
      btnAutoSim.classList.toggle('active-toggle', autoOn);
    }

    renderEventFeed(Array.isArray(st.recentEvents) ? st.recentEvents : []);
  }

  function updateViewerCount(params = {}) {
    if (!currentState?.tiktok?.connected) return;
    currentState.tiktok.viewerCount = Number(params.viewerCount || 0);
    const liveStatusText = document.getElementById('liveStatusText');
    if (liveStatusText) {
      liveStatusText.textContent = `LIVE @${currentState.tiktok.username} • ${currentState.tiktok.viewerCount} người xem`;
    }
  }

  function bindInteractions() {
    syncVolumeSlidersFromAudio();
    window.addEventListener('pointerdown', unlockAudioOnce, { once: true });

    document.getElementById('btnUnlockAudio')?.addEventListener('click', () => {
      unlockAudioOnce();
      audio.playTempleBell(0.9);
    });

    sliderMusicVol?.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      if (valMusicVol) valMusicVol.textContent = `${pct}%`;
      audio.setMusicVolume(pct / 100);
    });

    sliderTtsVol?.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      if (valTtsVol) valTtsVol.textContent = `${pct}%`;
      audio.setTtsVolume(pct / 100);
    });

    const btnToggleTts = document.getElementById('btnToggleTts');
    btnToggleTts?.addEventListener('click', () => {
      unlockAudioOnce();
      audio.ttsEnabled = !audio.ttsEnabled;
      btnToggleTts.textContent = `🎙️ Giọng Đọc: ${audio.ttsEnabled ? 'BẬT' : 'TẮT'}`;
      btnToggleTts.classList.toggle('active-toggle', audio.ttsEnabled);
      rpcClient.call('temple.updateSettings', { ttsEnabled: audio.ttsEnabled });
    });

    const btnToggleMusic = document.getElementById('btnToggleMusic');
    btnToggleMusic?.addEventListener('click', () => {
      unlockAudioOnce();
      audio.bgMusicEnabled = !audio.bgMusicEnabled;
      if (audio.bgMusicEnabled) {
        audio.startZenAmbience();
      } else {
        audio.stopZenAmbience();
      }
      btnToggleMusic.textContent = `🎵 Nhạc Nền: ${audio.bgMusicEnabled ? 'BẬT' : 'TẮT'}`;
      btnToggleMusic.classList.toggle('active-toggle', audio.bgMusicEnabled);
      rpcClient.call('temple.updateSettings', { bgMusicEnabled: audio.bgMusicEnabled });
    });

    const inputTikTokUser = document.getElementById('inputTikTokUser');
    inputTikTokUser?.addEventListener('input', () => {
      inputTikTokUser.dataset.userEdited = '1';
    });

    document.getElementById('btnConnectTikTok')?.addEventListener('click', () => {
      const username = inputTikTokUser?.value.trim() || '';
      if (!username) return;
      rpcClient.call('live.connect', { username });
    });

    document.getElementById('btnToggleAutoSim')?.addEventListener('click', () => {
      unlockAudioOnce();
      const nextEnabled = !Boolean(currentState?.settings?.autoSim);
      rpcClient.call('live.setAutoSim', { enabled: nextEnabled });
    });

    const triggerBurnIncense = () => {
      unlockAudioOnce();
      rpcClient.call('temple.burnIncense', { ...getDevoteeInputs(), count: 3 });
    };
    const triggerSendPrayer = () => {
      unlockAudioOnce();
      rpcClient.call('temple.sendPrayer', getDevoteeInputs());
    };
    const triggerOfferLotus = () => {
      unlockAudioOnce();
      rpcClient.call('temple.offerGift', {
        ...getDevoteeInputs(),
        giftType: 'lotus',
        coins: 20,
        giftName: 'Đài Hoa Sen Vàng'
      });
    };
    const triggerRingBell = () => {
      unlockAudioOnce();
      rpcClient.call('temple.ringBell', { ...getDevoteeInputs(), count: 1, readTts: true });
    };
    const triggerDrawFortune = () => {
      unlockAudioOnce();
      const { user, wish } = getDevoteeInputs();
      rpcClient.call('temple.drawFortune', { user, topic: wish });
    };

    document.getElementById('incenseBurnerZone')?.addEventListener('click', triggerBurnIncense);
    document.getElementById('cardIncense')?.addEventListener('click', triggerBurnIncense);
    document.getElementById('btnRpcIncense')?.addEventListener('click', triggerBurnIncense);

    document.getElementById('cardBlessing')?.addEventListener('click', triggerSendPrayer);
    document.getElementById('btnRpcLantern')?.addEventListener('click', triggerSendPrayer);

    document.getElementById('cardLotus')?.addEventListener('click', triggerOfferLotus);
    document.getElementById('btnRpcGiftLotus')?.addEventListener('click', triggerOfferLotus);

    document.getElementById('woodenFishStation')?.addEventListener('click', () => {
      unlockAudioOnce();
      rpcClient.call('temple.strikeWoodenFish', { user: getDevoteeInputs().user, count: 1 });
    });
    document.getElementById('btnRpcWoodenFish')?.addEventListener('click', () => {
      unlockAudioOnce();
      rpcClient.call('temple.strikeWoodenFish', { user: getDevoteeInputs().user, count: 5 });
    });

    document.getElementById('bellStation')?.addEventListener('click', triggerRingBell);
    document.getElementById('btnRpcBell')?.addEventListener('click', triggerRingBell);

    document.getElementById('fortuneCylinder')?.addEventListener('click', triggerDrawFortune);
    document.getElementById('btnRpcFortune')?.addEventListener('click', triggerDrawFortune);

    document.getElementById('btnRpcGrandCeremony')?.addEventListener('click', () => {
      unlockAudioOnce();
      rpcClient.call('temple.grandCeremony', {
        ...getDevoteeInputs(),
        coins: 299,
        giftName: 'Đại Lễ Kim Long Chầu Phật'
      });
    });
  }

  bindInteractions();

  return {
    updateUIState,
    updateViewerCount
  };
}
