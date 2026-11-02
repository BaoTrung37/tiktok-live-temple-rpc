/**
 * Cấu hình tọa độ khung 9:16 (1080 x 1920), bộ 8 frame nhân vật Phật tử và lưới chỗ ngồi Đạo Tràng.
 */
export const STAGE_WIDTH = 1080;
export const STAGE_HEIGHT = 1920;

export const SPRITE_FRAMES = {
  walk1: '/assets/devotee_walk.png',
  walk2: '/assets/devotee_walk_2.png',
  kneelDown: '/assets/devotee_kneel_down.png',
  kneel: '/assets/devotee.png',
  forehead: '/assets/devotee_bow.png',
  bowMid: '/assets/devotee_bow_mid.png',
  prostrate: '/assets/devotee_prostrate.png',
  prostrateDeep: '/assets/devotee_prostrate_deep.png'
};

export const KNEELING_POSE_KEYS = ['kneel', 'forehead', 'bowMid', 'prostrate', 'prostrateDeep'];

export function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export const VIP_CUSHION_COORDS = [
  { x: 140, y: 1188, rank: 1 },
  { x: 268, y: 1188, rank: 2 },
  { x: 392, y: 1188, rank: 3 },
  { x: 688, y: 1188, rank: 4 },
  { x: 812, y: 1188, rank: 5 },
  { x: 940, y: 1188, rank: 6 }
];

export const LABELED_SEAT_INDICES = [
  3, 4, 11, 12, 19, 20, 27, 28, 35, 36, 2, 5, 10, 13, 18, 21, 26, 29
];

export function buildHallSeatCoords() {
  const coords = [];
  const rows = 5;
  const colsPerSide = 4;

  for (let r = 0; r < rows; r++) {
    const progress = r / (rows - 1);
    const y = Math.round(1290 + progress * 355);
    const scale = +(0.76 + progress * 0.28).toFixed(2);

    const leftInnerX = Math.round(335 - progress * 48);
    const leftOuterX = 48;
    for (let c = 0; c < colsPerSide; c++) {
      const t = c / (colsPerSide - 1);
      const x = Math.round(leftOuterX + t * (leftInnerX - leftOuterX));
      coords.push({ side: 'L', row: r, col: c, x, y, scale });
    }

    const rightInnerX = Math.round(745 + progress * 48);
    const rightOuterX = 1032;
    for (let c = 0; c < colsPerSide; c++) {
      const t = c / (colsPerSide - 1);
      const x = Math.round(rightInnerX + t * (rightOuterX - rightInnerX));
      coords.push({ side: 'R', row: r, col: c, x, y, scale });
    }
  }

  return coords;
}

export function preloadSpriteFrames() {
  Object.values(SPRITE_FRAMES).forEach((url) => {
    const img = new Image();
    img.src = url;
  });
}

export function shortenName(name, maxLen = 13) {
  const str = String(name || '');
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}
