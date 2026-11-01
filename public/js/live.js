/**
 * Live 9:16 Client Controller — Chánh Điện Đức Phật A Di Đà & Đạo Tràng Phật Tử Quỳ Lễ
 * - Hiển thị 6 Đệm Quỳ VIP (Top 6 Bảng Vàng Công Đức)
 * - Hiển thị 40 Phật Tử mặc áo lam quỳ hai bên thảm đỏ + thẻ tên người xem
 * - Hiệu ứng người xem bước dọc thảm đỏ lên trước Lư Hương Đồng dâng hương
 * - Giọng đọc ZeroTTS (Mai Chi) + Pháp khí Web Audio
 */
(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get('obs') === '1') {
    document.body.classList.add('obs-mode');
  }

  // 1. Tự động co giãn khung 1080x1920 vừa khít Stage Wrapper (9:16)
  const stageWrapper = document.getElementById('stageWrapper');
  const stage9x16 = document.getElementById('stage9x16');

  function fitStage() {
    if (!stageWrapper || !stage9x16) return;
    const rect = stageWrapper.getBoundingClientRect();
    const scale = rect.width / 1080;
    stage9x16.style.transform = `scale(${scale})`;
  }
  window.addEventListener('resize', fitStage);
  fitStage();

  // 2. Khởi tạo Particle Engine & Audio Engine (ZeroTTS Mai Chi)
  const canvas = document.getElementById('templeCanvas');
  const particles = new window.TempleParticleEngine(canvas);
  const audio = new window.TempleAudioEngine();

  function unlockAudioOnce() {
    audio.ensureContext();
    const btnUnlock = document.getElementById('btnUnlockAudio');
    if (btnUnlock) {
      btnUnlock.textContent = '✅ Âm Thanh Chùa Đã Sẵn Sàng';
      btnUnlock.classList.remove('gold');
      btnUnlock.classList.add('active-toggle');
    }
  }
  window.addEventListener('pointerdown', unlockAudioOnce, { once: true });

  // 3. Vẽ các nén nhang đang cháy trong Lư Hương Đỉnh Đồng (x=540, y=895)
  const incenseHolder = document.getElementById('incenseSticksHolder');
  let renderedStickCount = 0;

  function renderIncenseSticks(count) {
    const target = Math.max(3, Math.min(27, Number(count) || 9));
    if (target === renderedStickCount && incenseHolder.children.length > 0) return;
    renderedStickCount = target;
    incenseHolder.innerHTML = '';

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

  // Preload toàn bộ 8 frame nhân vật vào bộ nhớ để chuyển frame mượt 0ms
  const SPRITE_FRAMES = {
    walk1: '/assets/devotee_walk.png',
    walk2: '/assets/devotee_walk_2.png',
    kneelDown: '/assets/devotee_kneel_down.png',
    kneel: '/assets/devotee.png',
    forehead: '/assets/devotee_bow.png',
    bowMid: '/assets/devotee_bow_mid.png',
    prostrate: '/assets/devotee_prostrate.png',
    prostrateDeep: '/assets/devotee_prostrate_deep.png'
  };
  const KNEELING_POSE_KEYS = ['kneel', 'forehead', 'bowMid', 'prostrate', 'prostrateDeep'];

  Object.values(SPRITE_FRAMES).forEach((url) => {
    const img = new Image();
    img.src = url;
  });

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

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  // 4. Dựng Hàng 6 Đệm Quỳ VIP Bền Vững (Top 6 Thí Chủ trên bục gỗ y=1188, không bị reset khi update state)
  const VIP_CUSHION_COORDS = [
    { x: 140, y: 1188, rank: 1 },
    { x: 268, y: 1188, rank: 2 },
    { x: 392, y: 1188, rank: 3 },
    { x: 688, y: 1188, rank: 4 },
    { x: 812, y: 1188, rank: 5 },
    { x: 940, y: 1188, rank: 6 }
  ];
  const vipCushionsLayer = document.getElementById('vipCushionsLayer');
  const vipSlots = [];

  (function initVipCushionSlots() {
    if (!vipCushionsLayer) return;
    vipCushionsLayer.innerHTML = '';
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
  const congregationHall = document.getElementById('congregationHall');
  const HALL_SEAT_COORDS = [];
  const LABELED_SEAT_INDICES = [
    3, 4, 11, 12, 19, 20, 27, 28, 35, 36, 2, 5, 10, 13, 18, 21, 26, 29
  ];
  const hallSlots = [];

  (function buildHallGridAndSeats() {
    const rows = 5;
    const colsPerSide = 4;
    for (let r = 0; r < rows; r++) {
      const progress = r / (rows - 1); // 0 (xa) -> 1 (gần)
      const y = Math.round(1290 + progress * 355); // 1290 -> 1645
      const scale = +(0.76 + progress * 0.28).toFixed(2);

      // Cánh trái thảm đỏ
      const leftInnerX = Math.round(335 - progress * 48); // mép thảm mở rộng dần
      const leftOuterX = 48;
      for (let c = 0; c < colsPerSide; c++) {
        const t = c / (colsPerSide - 1);
        const x = Math.round(leftOuterX + t * (leftInnerX - leftOuterX));
        HALL_SEAT_COORDS.push({ side: 'L', row: r, col: c, x, y, scale });
      }

      // Cánh phải thảm đỏ
      const rightInnerX = Math.round(745 + progress * 48);
      const rightOuterX = 1032;
      for (let c = 0; c < colsPerSide; c++) {
        const t = c / (colsPerSide - 1);
        const x = Math.round(rightInnerX + t * (rightOuterX - rightInnerX));
        HALL_SEAT_COORDS.push({ side: 'R', row: r, col: c, x, y, scale });
      }
    }

    if (!congregationHall) return;
    congregationHall.innerHTML = '';

    HALL_SEAT_COORDS.forEach((seat, idx) => {
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

  let lastRenderedLeaderboardJson = '';

  function renderCongregationHall(leaderboard = []) {
    if (!hallSlots.length) return;
    // Những người xếp từ hạng 7 trở đi ngồi ở các vị trí đầu tiên cạnh thảm đỏ
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

  let prostrationTimers = [];
  function clearProstrationTimers() {
    while (prostrationTimers.length > 0) {
      clearTimeout(prostrationTimers.pop());
    }
  }

  // Chuyển đổi tức thời giữa 8 khung hình đã giải mã sẵn trên GPU (KHÔNG BAO GIỜ BỊ MẤT HÌNH)
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

  // Chuỗi 8 khung hình Đảnh lễ Tam Bái mượt mà (Hạ gối -> Chắp tay ngực -> Đưa lên trán -> Nghiêng 45° -> Chống tay -> Lạy sát đất -> Ngẩng lên)
  function playThreeBowsSequence(startDelayMs = 0) {
    schedulePose(startDelayMs, 'kneelDown');
    schedulePose(startDelayMs + 160, 'kneel');

    const bowOffsets = [startDelayMs + 320, startDelayMs + 1820, startDelayMs + 3320];
    bowOffsets.forEach((t0) => {
      schedulePose(t0, 'forehead');            // 1. Chắp tay đưa lên trán
      schedulePose(t0 + 170, 'bowMid');        // 2. Cúi gập lưng 45°
      schedulePose(t0 + 330, 'prostrate');     // 3. Vươn hai tay chống xuống đệm
      schedulePose(t0 + 490, 'prostrateDeep'); // 4. Lạy sát đất (Ngũ thể đầu địa)
      schedulePose(t0 + 860, 'prostrate');     // 5. Bắt đầu nâng đầu lên
      schedulePose(t0 + 1020, 'bowMid');       // 6. Nâng lưng lên góc 45°
      schedulePose(t0 + 1180, 'kneel');        // 7. Ngồi quỳ thẳng lưng
    });

    schedulePose(startDelayMs + 4800, 'forehead');
    schedulePose(startDelayMs + 5350, 'kneel');
  }

  // Hiệu ứng thí chủ ĐỨNG ĐI BỘ từng bước dọc thảm đỏ rồi Hạ gối Quỳ Đảnh Lễ (trên cùng 1 nhân vật, không bao giờ mất hình)
  function animateWalkerOnCarpet(user, avatar, actionLabel, wish) {
    const centralEl = document.getElementById('centralWorshipper');
    if (!centralEl) return;

    clearProstrationTimers();
    updateCentralWorshipper(user, avatar, actionLabel, wish, false);

    // Khởi động bước đi từ cuối thảm đỏ lên chính điện
    centralEl.classList.remove('walking-up');
    void centralEl.offsetWidth;
    centralEl.classList.add('walking-up');

    setCentralPose('walk1');
    for (let step = 1; step <= 10; step++) {
      schedulePose(step * 185, step % 2 === 0 ? 'walk1' : 'walk2');
    }

    // Khi bước tới trước Lư Hương (2.05s): dừng bước, hạ gối quỳ xuống đệm và bắt đầu Đảnh lễ 3 lạy
    prostrationTimers.push(
      setTimeout(() => {
        centralEl.classList.remove('walking-up');
      }, 2100)
    );
    playThreeBowsSequence(2050);
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
        avatarEl.innerHTML = `<img src="${escapeHtml(avatar)}" alt="" />`;
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

    // Cập nhật dòng thông báo dưới thanh HUD
    const hudName = document.getElementById('devoteeNameLine');
    const hudAct = document.getElementById('devoteeActionTag');
    if (hudName) hudName.textContent = user || 'Thí Chủ';
    if (hudAct) hudAct.textContent = actionLabel || 'Dâng hương';
  }

  // 6. Cập nhật toàn bộ giao diện theo State từ Server
  let hasInitializedRealLeader = false;

  function updateUIState(st) {
    if (!st) return;

    document.getElementById('statIncense').textContent = Number(st.totalIncense || 0).toLocaleString('vi-VN');
    document.getElementById('statMerit').textContent = Number(st.totalMerit || 0).toLocaleString('vi-VN');
    document.getElementById('statWoodenFish').textContent = Number(st.woodenFishHits || 0).toLocaleString('vi-VN');

    renderIncenseSticks(st.activeIncenseSticks || 9);

    const lb = Array.isArray(st.leaderboard) ? st.leaderboard : [];
    renderVipCushions(lb);
    renderCongregationHall(lb);

    // Đồng bộ tên Chủ Lễ mặc định theo người dẫn đầu thực tế nếu chưa có sự kiện mới
    if (!hasInitializedRealLeader && lb.length > 0) {
      hasInitializedRealLeader = true;
      const topDev = lb[0];
      updateCentralWorshipper(
        topDev.name,
        topDev.avatar,
        `✨ Công đức: ${Number(topDev.merit).toLocaleString('vi-VN')} CĐ`,
        topDev.lastWish || 'Nam Mô A Di Đà Phật, cầu bình an cát tường',
        false
      );
    }

    // Cập nhật Bảng TẤM LÒNG THÀNH ở góc dưới phải (Top 4)
    const lbList = document.getElementById('leaderboardList');
    if (lbList) {
      lbList.innerHTML = lb
        .slice(0, 4)
        .map(
          (item) => `
          <div class="leader-item">
            <span class="leader-rank">${item.rank}</span>
            <span class="leader-name">${escapeHtml(shortenName(item.name, 14))}</span>
            <span class="leader-merit">${Number(item.merit).toLocaleString('vi-VN')}</span>
          </div>
        `
        )
        .join('');
    }

    // Trạng thái kết nối TikTok Live
    const liveDot = document.getElementById('liveDot');
    const liveText = document.getElementById('liveStatusText');
    if (st.tiktok?.connected) {
      liveDot.classList.add('connected');
      liveText.textContent = `LIVE @${st.tiktok.username} • ${st.tiktok.viewerCount || 0} mắt`;
    } else if (st.tiktok?.connecting) {
      liveDot.classList.remove('connected');
      liveText.textContent = `Đang kết nối @${st.tiktok.username}...`;
    } else {
      liveDot.classList.remove('connected');
      liveText.textContent = st.settings?.autoSim
        ? 'CHÙA LINH ỨNG • TỰ ĐỘNG GIẢ LẬP ĐÔNG NGƯỜI'
        : 'CHÙA LINH ỨNG • ĐỨC PHẬT A DI ĐÀ';
    }

    const btnAutoSim = document.getElementById('btnToggleAutoSim');
    if (btnAutoSim && st.settings) {
      btnAutoSim.textContent = st.settings.autoSim
        ? '🤖 Tự động Giả lập Người Xem: ĐANG BẬT'
        : '🤖 Tự động Giả lập Người Xem: TẮT';
      btnAutoSim.classList.toggle('active-toggle', Boolean(st.settings.autoSim));
    }
    if (st.settings) {
      if (typeof st.settings.musicVolume === 'number') {
        audio.setMusicVolume(st.settings.musicVolume);
        const sMus = document.getElementById('sliderMusicVol');
        const vMus = document.getElementById('valMusicVol');
        const pct = Math.round(st.settings.musicVolume * 100);
        if (sMus) sMus.value = String(pct);
        if (vMus) vMus.textContent = `${pct}%`;
      }
      if (typeof st.settings.ttsVolume === 'number') {
        audio.setTtsVolume(st.settings.ttsVolume);
        const sTts = document.getElementById('sliderTtsVol');
        const vTts = document.getElementById('valTtsVol');
        const pct = Math.round(st.settings.ttsVolume * 100);
        if (sTts) sTts.value = String(pct);
        if (vTts) vTts.textContent = `${pct}%`;
      }
    }


    const feed = document.getElementById('eventFeed');
    if (feed && Array.isArray(st.recentEvents)) {
      feed.innerHTML = st.recentEvents
        .slice(0, 8)
        .map((ev) => `<div class="event-feed-item">${formatEventSummary(ev)}</div>`)
        .join('');
    }
  }

  function formatEventSummary(ev) {
    switch (ev.type) {
      case 'burnIncense':
        return `🔥 <strong>${escapeHtml(ev.user)}</strong> dâng ${ev.count} nén nhang (+${ev.merit} CĐ)`;
      case 'strikeWoodenFish':
        return `🪵 <strong>${escapeHtml(ev.user)}</strong> gõ mõ ${ev.count} nhịp (+${ev.merit} CĐ)`;
      case 'ringBell':
        return `🔔 <strong>${escapeHtml(ev.user)}</strong> thỉnh Đại Hồng Chung (+${ev.merit} CĐ)`;
      case 'sendPrayer':
        return `🏮 <strong>${escapeHtml(ev.user)}</strong> cầu phúc: “${escapeHtml(ev.wish)}”`;
      case 'offerGift':
      case 'grandCeremony':
        return `🪷 <strong>${escapeHtml(ev.user)}</strong> dâng <em>${escapeHtml(ev.giftName)}</em> (+${ev.merit} CĐ)`;
      case 'drawFortune':
        return `🎋 <strong>${escapeHtml(ev.user)}</strong> gieo được Quẻ số ${ev.fortune?.number} (${ev.fortune?.rank})`;
      default:
        return `✨ <strong>${escapeHtml(ev.user || 'Thí chủ')}</strong> tương tác`;
    }
  }

  // 7. Xử lý hiệu ứng khi có Nghi Thức mới
  let fortuneTimer = null;
  let grandTimer = null;

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
          `🎋 Đang xin xăm...`,
          `Thí chủ ${ev.user} đang thành tâm xin quẻ...`,
          false
        );
        // Chỉ hiển thị tờ Quẻ Xăm đúng thời điểm giọng đọc bắt đầu vang lên!
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

  function spawnSkyLantern(user, wish) {
    const layer = document.getElementById('skyLanternsLayer');
    if (!layer) return;
    const lantern = document.createElement('div');
    lantern.className = 'sky-lantern';
    const leftPos = 80 + Math.floor(Math.random() * 640);
    lantern.style.left = `${leftPos}px`;
    lantern.innerHTML = `
      <div class="sky-lantern-user">🙏 ${escapeHtml(user)}</div>
      <div class="sky-lantern-wish">“${escapeHtml(wish)}”</div>
    `;
    layer.appendChild(lantern);
    setTimeout(() => {
      lantern.remove();
    }, 10600);
  }

  function showFortuneModal(user, fortune) {
    if (!fortune) return;
    const modal = document.getElementById('fortuneModal');
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

  document.getElementById('fortuneModal')?.addEventListener('click', () => {
    document.getElementById('fortuneModal').classList.remove('visible');
  });

  function showGrandCeremonyBanner(user, giftName, merit) {
    const banner = document.getElementById('grandCeremonyBanner');
    document.getElementById('grandTitle').textContent = `🐉 ${giftName.toUpperCase()} 🐉`;
    document.getElementById('grandSub').textContent = `Đại Thí Chủ ${user} • Công Đức Vô Lượng (+${merit} CĐ)`;
    banner.classList.add('visible');
    clearTimeout(grandTimer);
    grandTimer = setTimeout(() => {
      banner.classList.remove('visible');
    }, 6800);
  }

  // 8. Kết nối JSON-RPC 2.0 WebSocket & Gửi Lệnh RPC
  let ws = null;
  let rpcId = 1;

  function connectWebSocket() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.method === 'temple.state') {
          updateUIState(msg.params);
        } else if (msg.method === 'temple.event') {
          if (msg.params?.state) updateUIState(msg.params.state);
          if (msg.params?.event) triggerRitualVisuals(msg.params.event);
        } else if (msg.method === 'tts.play') {
          if (msg.params?.url) {
            audio.enqueueTts(msg.params.text || 'Nam mô A Di Đà Phật', {
              voice: msg.params.voice || 'maichi',
              url: msg.params.url
            });
          }
        }
      } catch (_) {}
    };

    ws.onclose = () => {
      setTimeout(connectWebSocket, 2000);
    };
  }
  connectWebSocket();

  async function callRpc(method, params = {}) {
    audio.ensureContext();
    const payload = {
      jsonrpc: '2.0',
      id: rpcId++,
      method,
      params
    };
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return;
    }
    const res = await fetch('/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data?.result?.state) updateUIState(data.result.state);
    if (data?.result?.event) triggerRitualVisuals(data.result.event);
    return data;
  }

  function getFormInput() {
    const user = document.getElementById('inputDevoteeName')?.value.trim() || 'Quỳnh_Finn';
    const wish =
      document.getElementById('inputDevoteeWish')?.value.trim() ||
      'Cầu cho gia đình bình an, tài lộc hanh thông';
    return { user, wish };
  }

  // Gắn sự kiện tương tác trực tiếp trên màn hình 9:16 & Thanh HUD dưới đáy
  document.getElementById('incenseBurnerZone')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.burnIncense', { user, count: 3, wish });
  });

  document.getElementById('cardIncense')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.burnIncense', { user, count: 3, wish });
  });

  document.getElementById('cardBlessing')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.sendPrayer', { user, wish });
  });

  document.getElementById('cardLotus')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.offerGift', {
      user,
      giftType: 'lotus',
      coins: 20,
      giftName: 'Đài Hoa Sen Vàng',
      wish
    });
  });

  document.getElementById('woodenFishStation')?.addEventListener('click', () => {
    const { user } = getFormInput();
    callRpc('temple.strikeWoodenFish', { user, count: 1 });
  });

  document.getElementById('bellStation')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.ringBell', { user, count: 1, wish, readTts: true });
  });

  document.getElementById('fortuneCylinder')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.drawFortune', { user, topic: wish });
  });

  // Các nút trên Quick RPC Dock bên phải
  document.getElementById('btnRpcIncense')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.burnIncense', { user, count: 3, wish });
  });

  document.getElementById('btnRpcLantern')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.sendPrayer', { user, wish });
  });

  document.getElementById('btnRpcWoodenFish')?.addEventListener('click', () => {
    const { user } = getFormInput();
    callRpc('temple.strikeWoodenFish', { user, count: 5 });
  });

  document.getElementById('btnRpcBell')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.ringBell', { user, count: 1, wish, readTts: true });
  });

  document.getElementById('btnRpcFortune')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.drawFortune', { user, topic: wish });
  });

  document.getElementById('btnRpcGiftLotus')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.offerGift', {
      user,
      giftType: 'lotus',
      coins: 20,
      giftName: 'Đài Hoa Sen Vàng',
      wish
    });
  });

  document.getElementById('btnRpcGrandCeremony')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.grandCeremony', {
      user,
      coins: 299,
      giftName: 'Đại Lễ Kim Long Chầu Phật',
      wish
    });
  });

  document.getElementById('btnConnectTikTok')?.addEventListener('click', () => {
    const username = document.getElementById('inputTikTokUser')?.value.trim();
    if (!username) return;
    callRpc('live.connect', { username });
  });

  let autoSimState = false;
  document.getElementById('btnToggleAutoSim')?.addEventListener('click', () => {
    autoSimState = !autoSimState;
    callRpc('live.setAutoSim', { enabled: autoSimState });
  });

  document.getElementById('btnToggleTts')?.addEventListener('click', (e) => {
    audio.ttsEnabled = !audio.ttsEnabled;
    const btn = e.currentTarget;
    btn.textContent = `🎙️ Giọng Đọc: ${audio.ttsEnabled ? 'BẬT' : 'TẮT'}`;
    btn.classList.toggle('active-toggle', audio.ttsEnabled);
  });

  document.getElementById('btnToggleMusic')?.addEventListener('click', (e) => {
    audio.bgMusicEnabled = !audio.bgMusicEnabled;
    if (audio.bgMusicEnabled) {
      audio.startZenAmbience();
    } else {
      audio.stopZenAmbience();
    }
    const btn = e.currentTarget;
    btn.textContent = `🎵 Nhạc Nền: ${audio.bgMusicEnabled ? 'BẬT' : 'TẮT'}`;
    btn.classList.toggle('active-toggle', audio.bgMusicEnabled);
  });

  // Khởi tạo và gắn sự kiện thanh trượt chỉnh âm lượng Nhạc nền & Giọng đọc
  const sliderMusicVol = document.getElementById('sliderMusicVol');
  const valMusicVol = document.getElementById('valMusicVol');
  if (sliderMusicVol && valMusicVol) {
    const initMusPct = Math.round(audio.bgBaseVolume * 100);
    sliderMusicVol.value = String(initMusPct);
    valMusicVol.textContent = `${initMusPct}%`;
    sliderMusicVol.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      valMusicVol.textContent = `${pct}%`;
      audio.ensureContext();
      audio.setMusicVolume(pct / 100);
    });
    sliderMusicVol.addEventListener('change', (e) => {
      const pct = Number(e.target.value);
      callRpc('temple.updateSettings', { musicVolume: +(pct / 100).toFixed(2) });
    });
  }

  const sliderTtsVol = document.getElementById('sliderTtsVol');
  const valTtsVol = document.getElementById('valTtsVol');
  if (sliderTtsVol && valTtsVol) {
    const initTtsPct = Math.round(audio.ttsVolume * 100);
    sliderTtsVol.value = String(initTtsPct);
    valTtsVol.textContent = `${initTtsPct}%`;
    sliderTtsVol.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      valTtsVol.textContent = `${pct}%`;
      audio.setTtsVolume(pct / 100);
    });
    sliderTtsVol.addEventListener('change', (e) => {
      const pct = Number(e.target.value);
      callRpc('temple.updateSettings', { ttsVolume: +(pct / 100).toFixed(2) });
    });
  }

  function shortenName(name, maxLen = 13) {
    const str = String(name || '');
    return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
