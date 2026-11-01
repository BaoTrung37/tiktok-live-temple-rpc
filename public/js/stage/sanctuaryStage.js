import {
  LABELED_SEAT_INDICES,
  SPRITE_FRAMES,
  STAGE_WIDTH,
  VIP_CUSHION_COORDS,
  buildHallSeatCoords,
  preloadSpriteFrames,
  shortenName
} from './stageConfig.js';

/**
 * Điều khiển toàn bộ cảnh quan sân khấu Chánh Điện 9:16 (1080 x 1920):
 * - Co giãn khung OBS / Web
 * - Lư hương, 6 Đệm Quỳ VIP, Đạo Tràng 40 Phật tử, Chủ lễ 8-frame bước đi & Tam Bái
 * - Đèn Hoa Đăng, Tờ Giải Quẻ Linh Xăm (đồng bộ giọng đọc) & Banner Đại Lễ
 */
export function createSanctuaryStage({ particles, audio }) {
  preloadSpriteFrames();

  const stageWrapper = document.getElementById('stageWrapper');
  const stage9x16 = document.getElementById('stage9x16');
  const incenseHolder = document.getElementById('incenseSticksHolder');
  const vipCushionsLayer = document.getElementById('vipCushionsLayer');
  const congregationHall = document.getElementById('congregationHall');
  const hallSeatCoords = buildHallSeatCoords();

  let renderedStickCount = 0;
  let lastRenderedLeaderboardJson = '';
  let prostrationTimers = [];
  let fortuneTimer = null;
  let grandTimer = null;

  function fitStage() {
    if (!stageWrapper || !stage9x16) return;
    const rect = stageWrapper.getBoundingClientRect();
    const scale = rect.width / STAGE_WIDTH;
    stage9x16.style.transform = `scale(${scale})`;
  }
  window.addEventListener('resize', fitStage);
  fitStage();

  document.getElementById('fortuneModal')?.addEventListener('click', () => {
    document.getElementById('fortuneModal')?.classList.remove('visible');
  });

  function renderIncenseSticks(count) {
    if (!incenseHolder) return;
    const target = Math.max(3, Math.min(27, Number(count) || 9));
    if (target === renderedStickCount && incenseHolder.children.length > 0) return;
    renderedStickCount = target;
    incenseHolder.replaceChildren();

    const tips = [];
    for (let i = 0; i < target; i++) {
      const stick = document.createElement('div');
      stick.className = 'incense-stick';

      const spread = target === 1 ? 0 : (i / (target - 1) - 0.5) * 2;
      const leftPx = 65 + spread * 28 + Math.sin(i * 2.1) * 2;
      const angleDeg = spread * 12 + Math.cos(i * 1.5) * 1.5;
      const heightPx = 76 + (i % 3) * 6;

      stick.style.left = `${leftPx}px`;
      stick.style.height = `${heightPx}px`;
      stick.style.transform = `rotate(${angleDeg}deg)`;

      const ember = document.createElement('div');
      ember.className = 'incense-ember';
      ember.style.animationDelay = `${(i * 0.15) % 1.1}s`;
      stick.appendChild(ember);
      incenseHolder.appendChild(stick);

      const rad = (angleDeg * Math.PI) / 180;
      const tipX = 540 + (leftPx - 65) + Math.sin(rad) * heightPx;
      const tipY = 895 - Math.cos(rad) * heightPx;
      tips.push({ x: tipX, y: tipY });
    }
    particles.setIncenseTips(tips);
  }

  function renderVipCushions(leaderboard = []) {
    if (!vipCushionsLayer) return;
    const frag = document.createDocumentFragment();
    VIP_CUSHION_COORDS.forEach((slot, idx) => {
      const dev = leaderboard[idx];
      if (!dev) return;

      const slotEl = document.createElement('div');
      slotEl.className = 'vip-devotee-slot';
      slotEl.style.left = `${slot.x}px`;
      slotEl.style.top = `${slot.y}px`;
      slotEl.style.zIndex = String(12 + idx);

      const img = document.createElement('img');
      img.src = SPRITE_FRAMES.kneel;
      img.alt = 'VIP Devotee';
      img.className = 'devotee-sprite';

      const pill = document.createElement('div');
      pill.className = 'vip-rank-pill';
      const rankNum = document.createElement('span');
      rankNum.className = 'vip-rank-num';
      rankNum.textContent = String(slot.rank);
      const rankName = document.createElement('span');
      rankName.className = 'vip-rank-name';
      rankName.textContent = shortenName(dev.name, 12);

      pill.append(rankNum, rankName);
      slotEl.append(img, pill);
      frag.appendChild(slotEl);
    });
    vipCushionsLayer.replaceChildren(frag);
  }

  function renderCongregationHall(leaderboard = []) {
    if (!congregationHall) return;
    const hallViewers = leaderboard.slice(6);
    const sig = JSON.stringify(hallViewers.map((d) => `${d.name}:${d.merit}`));
    if (sig === lastRenderedLeaderboardJson && congregationHall.children.length > 0) return;
    lastRenderedLeaderboardJson = sig;

    const seatViewerMap = new Map();
    hallViewers.forEach((viewer, idx) => {
      if (idx < LABELED_SEAT_INDICES.length) {
        seatViewerMap.set(LABELED_SEAT_INDICES[idx], viewer);
      }
    });

    const frag = document.createDocumentFragment();
    hallSeatCoords.forEach((seat, idx) => {
      const seatEl = document.createElement('div');
      seatEl.className = 'hall-seat';
      seatEl.dataset.seatIdx = String(idx);
      seatEl.style.left = `${seat.x}px`;
      seatEl.style.top = `${seat.y}px`;
      seatEl.style.zIndex = String(20 + seat.row * 2);
      seatEl.style.transform = `translate(-50%, -100%) scale(${seat.scale})`;

      const img = document.createElement('img');
      img.src = SPRITE_FRAMES.kneel;
      img.alt = 'Phật tử';
      img.className = 'devotee-sprite';
      img.style.animationDelay = `${((idx * 0.27) % 3.5).toFixed(2)}s`;
      seatEl.appendChild(img);

      const viewer = seatViewerMap.get(idx);
      if (viewer) {
        const badge = document.createElement('div');
        badge.className = 'seat-badge';
        const avatarSpan = document.createElement('span');
        avatarSpan.className = 'seat-avatar';
        if (viewer.avatar) {
          const avImg = document.createElement('img');
          avImg.src = viewer.avatar;
          avImg.alt = '';
          avatarSpan.appendChild(avImg);
        } else {
          avatarSpan.textContent = String(viewer.name || 'P').charAt(0).toUpperCase();
        }
        const nameSpan = document.createElement('span');
        nameSpan.className = 'seat-username';
        nameSpan.textContent = shortenName(viewer.name, 11);
        badge.append(avatarSpan, nameSpan);
        seatEl.appendChild(badge);
      }

      frag.appendChild(seatEl);
    });
    congregationHall.replaceChildren(frag);
  }

  function pulseHallBowing() {
    if (!congregationHall) return;
    const seats = congregationHall.querySelectorAll('.hall-seat');
    seats.forEach((el, i) => {
      if (i % 4 !== 0) return;
      const img = el.querySelector('.devotee-sprite');
      if (!img) return;
      const delay = (i % 4) * 80;
      setTimeout(() => { img.src = SPRITE_FRAMES.forehead; }, delay);
      setTimeout(() => { img.src = SPRITE_FRAMES.bowMid; }, delay + 140);
      setTimeout(() => { img.src = SPRITE_FRAMES.prostrateDeep; }, delay + 300);
      setTimeout(() => { img.src = SPRITE_FRAMES.bowMid; }, delay + 620);
      setTimeout(() => { img.src = SPRITE_FRAMES.kneel; }, delay + 780);
    });
  }

  function clearProstrationTimers() {
    while (prostrationTimers.length > 0) {
      clearTimeout(prostrationTimers.pop());
    }
  }

  function setCentralPose(poseKey) {
    const stack = document.getElementById('centralSpriteStack');
    if (!stack) return;
    const frames = stack.querySelectorAll('.pose-frame');
    frames.forEach((img) => {
      img.classList.toggle('active', img.getAttribute('data-pose') === poseKey);
    });
  }

  function schedulePose(ms, poseKey) {
    prostrationTimers.push(
      setTimeout(() => {
        setCentralPose(poseKey);
      }, ms)
    );
  }

  function playThreeBowsSequence(startDelayMs = 0) {
    schedulePose(startDelayMs, 'kneelDown');
    schedulePose(startDelayMs + 160, 'kneel');

    const bowOffsets = [startDelayMs + 320, startDelayMs + 1820, startDelayMs + 3320];
    bowOffsets.forEach((t0) => {
      schedulePose(t0, 'forehead');
      schedulePose(t0 + 170, 'bowMid');
      schedulePose(t0 + 330, 'prostrate');
      schedulePose(t0 + 490, 'prostrateDeep');
      schedulePose(t0 + 860, 'prostrate');
      schedulePose(t0 + 1020, 'bowMid');
      schedulePose(t0 + 1180, 'kneel');
    });

    schedulePose(startDelayMs + 4800, 'forehead');
    schedulePose(startDelayMs + 5350, 'kneel');
  }

  function updateCentralWorshipper(user, avatar, actionLabel, wish, doThreeBows = true) {
    const nameEl = document.getElementById('centralName');
    const actEl = document.getElementById('centralAction');
    const wishEl = document.getElementById('centralWishBubble');
    const avatarEl = document.getElementById('centralAvatar');
    const beam = document.getElementById('sacredLightBeam');

    if (nameEl) nameEl.textContent = user || 'Thí Chủ Hữu Duyên';
    if (actEl) actEl.textContent = actionLabel || '✨ Dâng hương cầu an';
    if (wishEl) wishEl.textContent = `“${wish || 'Nam Mô A Di Đà Phật, cầu bình an cát tường'}”`;

    if (avatarEl) {
      if (avatar) {
        const avImg = document.createElement('img');
        avImg.src = avatar;
        avImg.alt = '';
        avatarEl.replaceChildren(avImg);
      } else {
        avatarEl.textContent = String(user || '🙏').trim().charAt(0).toUpperCase();
      }
    }

    if (doThreeBows) {
      clearProstrationTimers();
      const centralEl = document.getElementById('centralWorshipper');
      if (centralEl) centralEl.classList.remove('walking-up');
      playThreeBowsSequence(0);
    }
    if (beam) {
      beam.classList.add('intense');
      setTimeout(() => beam.classList.remove('intense'), 4500);
    }

    const haloSys = document.getElementById('buddhaHaloSystem');
    const lotusHand = document.getElementById('lotusHandHalo');
    if (haloSys) {
      haloSys.classList.add('flare');
      setTimeout(() => haloSys.classList.remove('flare'), 3600);
    }
    if (lotusHand) {
      lotusHand.classList.add('flare');
      setTimeout(() => lotusHand.classList.remove('flare'), 3600);
    }
    particles.spawnBellWave(540, 260, 2);

    const hudName = document.getElementById('devoteeNameLine');
    const hudAct = document.getElementById('devoteeActionTag');
    if (hudName) hudName.textContent = user || 'Thí Chủ';
    if (hudAct) hudAct.textContent = actionLabel || 'Dâng hương';
  }

  function animateWalkerOnCarpet(user, avatar, actionLabel, wish) {
    const centralEl = document.getElementById('centralWorshipper');
    if (!centralEl) return;

    clearProstrationTimers();
    updateCentralWorshipper(user, avatar, actionLabel, wish, false);

    centralEl.classList.remove('walking-up');
    void centralEl.offsetWidth;
    centralEl.classList.add('walking-up');

    setCentralPose('walk1');
    for (let step = 1; step <= 10; step++) {
      schedulePose(step * 185, step % 2 === 0 ? 'walk1' : 'walk2');
    }

    prostrationTimers.push(
      setTimeout(() => {
        centralEl.classList.remove('walking-up');
      }, 2100)
    );
    playThreeBowsSequence(2050);
  }

  function spawnSkyLantern(user, wish) {
    const layer = document.getElementById('skyLanternsLayer');
    if (!layer) return;
    const lantern = document.createElement('div');
    lantern.className = 'sky-lantern';
    const leftPos = 80 + Math.floor(Math.random() * 640);
    lantern.style.left = `${leftPos}px`;

    const userEl = document.createElement('div');
    userEl.className = 'sky-lantern-user';
    userEl.textContent = `🙏 ${user}`;

    const wishEl = document.createElement('div');
    wishEl.className = 'sky-lantern-wish';
    wishEl.textContent = `“${wish}”`;

    lantern.append(userEl, wishEl);
    layer.appendChild(lantern);
    setTimeout(() => {
      lantern.remove();
    }, 10600);
  }

  function showFortuneModal(user, fortune) {
    if (!fortune) return;
    const modal = document.getElementById('fortuneModal');
    if (!modal) return;
    document.getElementById('fortuneRankBadge').textContent = fortune.rank.toUpperCase();
    document.getElementById('fortuneTitle').textContent = `Quẻ Số ${fortune.number} — ${fortune.title}`;
    document.getElementById('fortuneDevotee').textContent = `Thí chủ cầu quẻ: ${user}`;
    document.getElementById('fortunePoem').textContent = fortune.poem;
    document.getElementById('fortuneMeaning').textContent = `Lời bàn: ${fortune.meaning}`;

    modal.classList.add('visible');
    clearTimeout(fortuneTimer);
    fortuneTimer = setTimeout(() => {
      modal.classList.remove('visible');
    }, 15000);
  }

  function showGrandCeremonyBanner(user, giftName, merit) {
    const banner = document.getElementById('grandCeremonyBanner');
    if (!banner) return;
    document.getElementById('grandTitle').textContent = `🐉 ${String(giftName || '').toUpperCase()} 🐉`;
    document.getElementById('grandSub').textContent = `Đại Thí Chủ ${user} • Công Đức Vô Lượng (+${merit} CĐ)`;
    banner.classList.add('visible');
    clearTimeout(grandTimer);
    grandTimer = setTimeout(() => {
      banner.classList.remove('visible');
    }, 6800);
  }

  function triggerRitualVisuals(ev) {
    if (!ev) return;

    if (ev.ttsText && ev.type !== 'drawFortune') {
      audio.enqueueTts(ev.ttsText, { voice: ev.ttsVoice || 'maichi' });
    }

    switch (ev.type) {
      case 'burnIncense': {
        audio.playIncenseChime();
        particles.spawnIncenseBurst(540, 895);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 540, 860, '#ffe082');
        animateWalkerOnCarpet(ev.user, ev.avatar, `🔥 Dâng ${ev.count} nén hương (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'strikeWoodenFish': {
        audio.playWoodenFish();
        pulseHallBowing();
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 890, 935, '#ffd54f');
        break;
      }

      case 'ringBell': {
        audio.playTempleBell(1.0);
        pulseHallBowing();
        particles.spawnBellWave(540, 510, 4);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 190, 935, '#fff3b0');
        updateCentralWorshipper(ev.user, ev.avatar, `🔔 Thỉnh Đại Hồng Chung (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'sendPrayer': {
        audio.playIncenseChime();
        spawnSkyLantern(ev.user, ev.wish);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 540, 920, '#ffb74d');
        animateWalkerOnCarpet(ev.user, ev.avatar, `🏮 Cầu phúc (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'offerGift': {
        audio.playIncenseChime();
        audio.playTempleBell(0.85);
        particles.spawnIncenseBurst(540, 895);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 540, 840, '#fff3b0');
        animateWalkerOnCarpet(ev.user, ev.avatar, `🪷 Dâng ${ev.giftName} (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'grandCeremony': {
        audio.playTempleBell(1.2);
        setTimeout(() => audio.playTempleBell(1.1), 900);
        particles.spawnGrandCeremonyRain();
        pulseHallBowing();
        showGrandCeremonyBanner(ev.user, ev.giftName, ev.merit);
        animateWalkerOnCarpet(ev.user, ev.avatar, `🐉 ${ev.giftName} (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'drawFortune': {
        audio.playFortuneShake();
        updateCentralWorshipper(
          ev.user,
          ev.avatar,
          '🎋 Đang xin xăm...',
          `Thí chủ ${ev.user} đang thành tâm xin quẻ...`,
          false
        );
        // Chỉ hiển thị tờ Quẻ Xăm đúng thời điểm giọng đọc bắt đầu vang lên
        audio.enqueueTts(ev.ttsText || '', {
          voice: ev.ttsVoice || 'maichi',
          onStart: () => {
            audio.playIncenseChime();
            showFortuneModal(ev.user, ev.fortune);
            updateCentralWorshipper(
              ev.user,
              ev.avatar,
              `🎋 Quẻ số ${ev.fortune?.number} (${ev.fortune?.rank})`,
              ev.fortune?.meaning || '',
              true
            );
          },
          onEnd: () => {
            clearTimeout(fortuneTimer);
            fortuneTimer = setTimeout(() => {
              document.getElementById('fortuneModal')?.classList.remove('visible');
            }, 1800);
          }
        });
        break;
      }
    }
  }

  return {
    fitStage,
    renderIncenseSticks,
    renderVipCushions,
    renderCongregationHall,
    updateCentralWorshipper,
    triggerRitualVisuals
  };
}
