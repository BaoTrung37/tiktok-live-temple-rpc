import {
  KNEELING_POSE_KEYS,
  LABELED_SEAT_INDICES,
  SPRITE_FRAMES,
  STAGE_WIDTH,
  VIP_CUSHION_COORDS,
  buildHallSeatCoords,
  preloadSpriteFrames,
  randInt,
  shortenName
} from './stageConfig.js';

/**
 * Điều khiển toàn bộ cảnh quan sân khấu Chánh Điện 9:16 (1080 x 1920):
 * - Co giãn khung OBS / Web
 * - Lư hương, 6 Đệm Quỳ VIP, Đạo Tràng 40 Phật tử (5-frame Pose Stack + KneelingProstrationDirector), Chủ lễ 8-frame bước đi & Tam Bái
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

  function createPoseStackElement() {
    const stackEl = document.createElement('div');
    stackEl.className = 'seat-pose-stack';
    const frames = {};
    for (const poseKey of KNEELING_POSE_KEYS) {
      const img = document.createElement('img');
      img.src = SPRITE_FRAMES[poseKey];
      img.alt = '';
      img.decoding = 'async';
      img.setAttribute('data-pose', poseKey);
      img.className =
        poseKey === 'kneel'
          ? 'devotee-sprite seat-pose-frame active'
          : 'devotee-sprite seat-pose-frame';
      stackEl.appendChild(img);
      frames[poseKey] = img;
    }
    return { stackEl, frames };
  }

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

  // 4. Dựng Hàng 6 Đệm Quỳ VIP Bền Vững (Top 6 Thí Chủ trên bục gỗ y=1188, không bị reset khi update state)
  const vipSlots = [];

  (function initVipCushionSlots() {
    if (!vipCushionsLayer) return;
    vipCushionsLayer.replaceChildren();
    VIP_CUSHION_COORDS.forEach((coord, idx) => {
      const slotEl = document.createElement('div');
      slotEl.className = 'vip-devotee-slot';
      slotEl.dataset.vipRank = String(coord.rank);
      slotEl.hidden = true;
      slotEl.style.left = `${coord.x}px`;
      slotEl.style.top = `${coord.y}px`;
      slotEl.style.zIndex = String(12 + idx);

      const { stackEl, frames } = createPoseStackElement();

      const pillEl = document.createElement('div');
      pillEl.className = 'vip-rank-pill';
      const numEl = document.createElement('span');
      numEl.className = 'vip-rank-num';
      numEl.textContent = String(coord.rank);
      const nameEl = document.createElement('span');
      nameEl.className = 'vip-rank-name';
      pillEl.append(numEl, nameEl);

      slotEl.append(stackEl, pillEl);
      vipCushionsLayer.appendChild(slotEl);

      vipSlots.push({
        id: `vip-${idx}`,
        kind: 'vip',
        index: idx,
        side: idx < 3 ? 'L' : 'R',
        row: -1,
        col: idx < 3 ? idx : idx - 3,
        el: slotEl,
        frames,
        nameEl,
        lastRenderedName: '',
        currentPose: 'kneel',
        occupied: false,
        hasViewerBadge: false,
        busy: false,
        busyOrigin: 'idle',
        cooldownUntil: 0,
        timers: []
      });
    });
  })();

  function renderVipCushions(leaderboard = []) {
    if (!vipSlots.length) return;
    for (let idx = 0; idx < vipSlots.length; idx++) {
      const slot = vipSlots[idx];
      const dev = leaderboard[idx];
      if (dev) {
        const shortName = shortenName(dev.name, 12);
        if (slot.lastRenderedName !== shortName) {
          slot.nameEl.textContent = shortName;
          slot.lastRenderedName = shortName;
        }
        slot.el.hidden = false;
        slot.occupied = true;
        slot.hasViewerBadge = true;
      } else {
        if (slot.occupied) {
          clearSlotAnimation(slot);
        }
        slot.occupied = false;
        slot.hasViewerBadge = false;
        slot.lastRenderedName = '';
        slot.el.hidden = true;
      }
    }
  }

  // 5. Dựng Đạo Tràng 40 Phật Tử Quỳ Lễ Hai Bên Thảm Đỏ (DOM Bền Vững 5 Hàng x 4 Cột mỗi bên)
  const hallSlots = [];

  (function initHallSeatSlots() {
    if (!congregationHall) return;
    congregationHall.replaceChildren();

    hallSeatCoords.forEach((seat, idx) => {
      const seatEl = document.createElement('div');
      seatEl.className = 'hall-seat';
      seatEl.dataset.seatIdx = String(idx);
      seatEl.style.left = `${seat.x}px`;
      seatEl.style.top = `${seat.y}px`;
      seatEl.style.zIndex = String(20 + seat.row * 2);
      seatEl.style.transform = `translate(-50%, -100%) scale(${seat.scale})`;

      const { stackEl, frames } = createPoseStackElement();

      const badgeEl = document.createElement('div');
      badgeEl.className = 'seat-badge';
      badgeEl.hidden = true;
      const avatarEl = document.createElement('span');
      avatarEl.className = 'seat-avatar';
      const usernameEl = document.createElement('span');
      usernameEl.className = 'seat-username';
      badgeEl.append(avatarEl, usernameEl);

      seatEl.append(stackEl, badgeEl);
      congregationHall.appendChild(seatEl);

      hallSlots.push({
        id: `hall-${idx}`,
        kind: 'hall',
        index: idx,
        side: seat.side,
        row: seat.row,
        col: seat.col,
        el: seatEl,
        frames,
        badgeEl,
        avatarEl,
        usernameEl,
        lastBadgeKey: '',
        currentPose: 'kneel',
        occupied: true,
        hasViewerBadge: false,
        busy: false,
        busyOrigin: 'idle',
        cooldownUntil: 0,
        timers: []
      });
    });
  })();

  function renderCongregationHall(leaderboard = []) {
    if (!hallSlots.length) return;
    const hallViewers = leaderboard.slice(6, 6 + LABELED_SEAT_INDICES.length);
    const sig = JSON.stringify(hallViewers.map((d) => `${d.name}:${d.avatar || ''}`));
    if (sig === lastRenderedLeaderboardJson) return;
    lastRenderedLeaderboardJson = sig;

    const seatViewerMap = new Map();
    hallViewers.forEach((viewer, idx) => {
      seatViewerMap.set(LABELED_SEAT_INDICES[idx], viewer);
    });

    for (let idx = 0; idx < hallSlots.length; idx++) {
      const slot = hallSlots[idx];
      const viewer = seatViewerMap.get(idx);
      if (viewer) {
        const badgeKey = `${viewer.name}::${viewer.avatar || ''}`;
        if (slot.lastBadgeKey !== badgeKey) {
          slot.lastBadgeKey = badgeKey;
          slot.usernameEl.textContent = shortenName(viewer.name, 11);
          if (viewer.avatar) {
            const avImg = document.createElement('img');
            avImg.src = viewer.avatar;
            avImg.alt = '';
            slot.avatarEl.replaceChildren(avImg);
          } else {
            slot.avatarEl.textContent = String(viewer.name || 'P').charAt(0).toUpperCase();
          }
        }
        slot.badgeEl.hidden = false;
        slot.hasViewerBadge = true;
      } else {
        slot.lastBadgeKey = '';
        slot.badgeEl.hidden = true;
        slot.hasViewerBadge = false;
      }
    }
  }

  // 5B. Bộ Điều Phối Lạy Phật Ngẫu Nhiên Tự Nhiên & Sóng Hành Lễ (KneelingProstrationDirector)
  const allKneelingSlots = [...vipSlots, ...hallSlots];
  const MAX_CONCURRENT_AMBIENT_BOWS = 5;
  const AMBIENT_TICK_MIN_MS = 1000;
  const AMBIENT_TICK_MAX_MS = 2200;
  let ambientTickTimer = null;

  function setSlotPose(slot, poseKey) {
    if (!slot || slot.currentPose === poseKey) return;
    const prev = slot.frames[slot.currentPose];
    const next = slot.frames[poseKey];
    if (prev) prev.classList.remove('active');
    if (next) next.classList.add('active');
    slot.currentPose = poseKey;
  }

  function clearSlotAnimation(slot) {
    if (!slot) return;
    while (slot.timers.length > 0) {
      clearTimeout(slot.timers.pop());
    }
    slot.busy = false;
    slot.busyOrigin = 'idle';
    setSlotPose(slot, 'kneel');
  }

  function scheduleSlotPose(slot, delayMs, poseKey) {
    const tid = setTimeout(() => {
      setSlotPose(slot, poseKey);
    }, Math.max(0, Math.round(delayMs)));
    slot.timers.push(tid);
  }

  function finishSlotSequence(slot, finishMs, cooldownMinMs, cooldownMaxMs) {
    const tid = setTimeout(() => {
      slot.timers.length = 0;
      setSlotPose(slot, 'kneel');
      slot.busy = false;
      slot.busyOrigin = 'idle';
      slot.cooldownUntil = Date.now() + randInt(cooldownMinMs, cooldownMaxMs);
    }, Math.max(0, Math.round(finishMs)));
    slot.timers.push(tid);
  }

  function playSlotProstration(slot, style = 'fullBow', origin = 'ambient', initialDelayMs = 0) {
    if (!slot || !slot.occupied) return;
    while (slot.timers.length > 0) {
      clearTimeout(slot.timers.pop());
    }
    slot.busy = true;
    slot.busyOrigin = origin;

    const speed = 0.9 + Math.random() * 0.24;
    let t = Math.max(0, initialDelayMs);

    if (style === 'prayerNod') {
      // Khấn vái nhẹ thành tâm (~20%)
      scheduleSlotPose(slot, t, 'forehead');
      t += randInt(330, 440) * speed;
      scheduleSlotPose(slot, t, 'bowMid');
      t += randInt(450, 650) * speed;
      scheduleSlotPose(slot, t, 'forehead');
      t += 250 * speed;
      finishSlotSequence(
        slot,
        t,
        origin === 'wave' ? 2400 : 5500,
        origin === 'wave' ? 5000 : 11000
      );
      return;
    }

    if (style === 'threeBows') {
      // Đảnh lễ Tam Bái 3 lạy liên tiếp (~10%, ưu tiên VIP & ghế có tên người xem)
      for (let cycle = 0; cycle < 3; cycle++) {
        scheduleSlotPose(slot, t, 'forehead');
        t += 200 * speed;
        scheduleSlotPose(slot, t, 'bowMid');
        t += 170 * speed;
        scheduleSlotPose(slot, t, 'prostrate');
        t += 170 * speed;
        scheduleSlotPose(slot, t, 'prostrateDeep');
        t += randInt(480, 680);
        scheduleSlotPose(slot, t, 'prostrate');
        t += 180 * speed;
        scheduleSlotPose(slot, t, 'bowMid');
        t += 180 * speed;
        scheduleSlotPose(slot, t, 'kneel');
        t += 320 * speed;
      }
      scheduleSlotPose(slot, t, 'forehead');
      t += 280 * speed;
      finishSlotSequence(slot, t, 11000, 18000);
      return;
    }

    // Mặc định: Lạy sát đất Ngũ thể đầu địa (~70%)
    scheduleSlotPose(slot, t, 'forehead');
    t += 220 * speed;
    scheduleSlotPose(slot, t, 'bowMid');
    t += 180 * speed;
    scheduleSlotPose(slot, t, 'prostrate');
    t += 180 * speed;
    scheduleSlotPose(slot, t, 'prostrateDeep');
    t += origin === 'wave' ? randInt(380, 560) : randInt(580, 900);
    scheduleSlotPose(slot, t, 'prostrate');
    t += 190 * speed;
    scheduleSlotPose(slot, t, 'bowMid');
    t += 190 * speed;
    scheduleSlotPose(slot, t, 'forehead');
    t += 220 * speed;
    finishSlotSequence(
      slot,
      t,
      origin === 'wave' ? 2500 : 7000,
      origin === 'wave' ? 5500 : 14000
    );
  }

  function pickAmbientBowStyle(slot) {
    const r = Math.random();
    if (slot.kind === 'vip' || slot.hasViewerBadge) {
      if (r < 0.65) return 'fullBow';
      if (r < 0.82) return 'prayerNod';
      return 'threeBows';
    }
    if (r < 0.72) return 'fullBow';
    if (r < 0.93) return 'prayerNod';
    return 'threeBows';
  }

  function hasBusyImmediateNeighbor(candidate) {
    for (let i = 0; i < allKneelingSlots.length; i++) {
      const other = allKneelingSlots[i];
      if (
        other !== candidate &&
        other.busy &&
        other.kind === candidate.kind &&
        other.side === candidate.side &&
        other.row === candidate.row &&
        Math.abs(other.col - candidate.col) <= 1
      ) {
        return true;
      }
    }
    return false;
  }

  function pickWeightedCandidate(pool) {
    if (!pool.length) return null;
    let totalWeight = 0;
    for (let i = 0; i < pool.length; i++) {
      const s = pool[i];
      totalWeight += s.kind === 'vip' ? 2.2 : s.hasViewerBadge ? 1.6 : 1.0;
    }
    let roll = Math.random() * totalWeight;
    for (let i = 0; i < pool.length; i++) {
      const s = pool[i];
      const w = s.kind === 'vip' ? 2.2 : s.hasViewerBadge ? 1.6 : 1.0;
      roll -= w;
      if (roll <= 0) return s;
    }
    return pool[pool.length - 1];
  }

  function runAmbientProstrationTick() {
    ambientTickTimer = null;
    if (document.hidden) return;

    const now = Date.now();
    let activeAmbientCount = 0;
    for (let i = 0; i < allKneelingSlots.length; i++) {
      const s = allKneelingSlots[i];
      if (s.busy && s.busyOrigin === 'ambient') activeAmbientCount++;
    }

    const freeCapacity = MAX_CONCURRENT_AMBIENT_BOWS - activeAmbientCount;
    if (freeCapacity > 0) {
      const wantTwoChance = activeAmbientCount <= 1 ? 0.65 : 0.35;
      const pickCount = Math.min(freeCapacity, Math.random() < wantTwoChance ? 2 : 1);

      for (let p = 0; p < pickCount; p++) {
        const eligible = [];
        const spacedEligible = [];
        for (let i = 0; i < allKneelingSlots.length; i++) {
          const s = allKneelingSlots[i];
          if (!s.occupied || s.busy || now < s.cooldownUntil) continue;
          eligible.push(s);
          if (!hasBusyImmediateNeighbor(s)) spacedEligible.push(s);
        }

        const chosen = pickWeightedCandidate(spacedEligible.length ? spacedEligible : eligible);
        if (!chosen) break;

        const staggerMs = p === 0 ? 0 : randInt(260, 680);
        playSlotProstration(chosen, pickAmbientBowStyle(chosen), 'ambient', staggerMs);
      }
    }

    scheduleNextAmbientTick(randInt(AMBIENT_TICK_MIN_MS, AMBIENT_TICK_MAX_MS));
  }

  function scheduleNextAmbientTick(delayMs) {
    if (ambientTickTimer !== null) {
      clearTimeout(ambientTickTimer);
      ambientTickTimer = null;
    }
    if (document.hidden) return;
    ambientTickTimer = setTimeout(runAmbientProstrationTick, delayMs);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (ambientTickTimer !== null) {
        clearTimeout(ambientTickTimer);
        ambientTickTimer = null;
      }
      for (let i = 0; i < allKneelingSlots.length; i++) {
        if (allKneelingSlots[i].busy) {
          clearSlotAnimation(allKneelingSlots[i]);
        }
      }
    } else {
      scheduleNextAmbientTick(650);
    }
  });

  // Khởi động nhịp hành lễ ngẫu nhiên tự nhiên dưới Chánh Điện
  scheduleNextAmbientTick(850);

  function pulseHallBowing(intensity = 'normal') {
    const joinProbability = intensity === 'grand' ? 0.65 : 0.3;
    for (let i = 0; i < allKneelingSlots.length; i++) {
      const slot = allKneelingSlots[i];
      if (!slot.occupied || slot.busy) continue;
      if (Math.random() > joinProbability) continue;
      const waveRowIndex = slot.row + 1; // VIP (row -1 -> 0) dẫn đầu, tiếp theo hàng 0 -> 4
      const waveDelay = waveRowIndex * 90 + randInt(0, 75);
      playSlotProstration(slot, 'fullBow', 'wave', waveDelay);
    }
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
        pulseHallBowing('normal');
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 890, 935, '#ffd54f');
        break;
      }

      case 'ringBell': {
        audio.playTempleBell(1.0);
        pulseHallBowing('grand');
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
        pulseHallBowing('grand');
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
    triggerRitualVisuals,
    allKneelingSlots,
    playSlotProstration,
    pulseHallBowing
  };
}
