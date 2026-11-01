/**
 * Bảng Quy Tắc Nghiệp Vụ Chùa Linh Ứng (Ritual, Gift Tiers, Comment Intents & Auto-Sim Registry)
 * Muốn điều chỉnh bậc xu quà tặng, hệ số Công Đức hoặc từ khóa bình luận: chỉ cần sửa file này.
 */

import { sanitizeWishText } from './sanitizer.js';

export const VALID_GIFT_TYPES = ['lotus', 'fruit', 'lamp', 'dragon'];

export const GIFT_LABELS = {
  lotus: 'Đài Hoa Sen Vàng',
  fruit: 'Mâm Ngũ Quả Cát Tường',
  lamp: 'Đèn Lưu Ly Trí Tuệ',
  dragon: 'Đại Lễ Kim Long Chầu Phật'
};

export function resolveGiftOffering(params = {}) {
  const coins = Math.max(1, Number(params.coins) || 10);
  const giftType = VALID_GIFT_TYPES.includes(params.giftType)
    ? params.giftType
    : coins >= 100
      ? 'dragon'
      : coins >= 20
        ? 'fruit'
        : coins >= 5
          ? 'lamp'
          : 'lotus';

  const cleanGiftName = params.giftName ? sanitizeWishText(params.giftName).slice(0, 48) : '';
  const giftName = cleanGiftName || GIFT_LABELS[giftType];
  const multiplier = coins >= 100 ? 50 : coins >= 10 ? 30 : 20;
  const merit = Math.max(20, coins * multiplier);

  return { coins, giftType, giftName, merit };
}

export const COMMENT_COOLDOWN_MS = 3500;
export const COMMENT_COOLDOWN_MAX_ENTRIES = 600;

/**
 * Thứ tự ưu tiên phân tích bình luận người xem (khớp từ trên xuống dưới).
 */
export const COMMENT_INTENT_RULES = [
  {
    intent: 'drawFortune',
    keywords: ['xin xăm', 'xin xam', 'gieo quẻ', 'gieo que', 'rút quẻ', 'rut que', 'quẻ', 'que']
  },
  {
    intent: 'ringBell',
    keywords: ['chuông', 'chuong', 'thỉnh chuông']
  },
  {
    intent: 'strikeWoodenFish',
    keywords: ['gõ mõ', 'go mo', 'tụng kinh']
  },
  {
    intent: 'burnIncense3',
    keywords: [
      'thắp hương',
      'thap huong',
      'dâng hương',
      'dang huong',
      'bái phật',
      'bai phat',
      'lạy phật',
      'lay phat'
    ]
  },
  {
    intent: 'sendPrayer',
    keywords: [
      'cầu',
      'cau ',
      'nguyện',
      'nguyen',
      'nam mô',
      'nam mo',
      'mô phật',
      'mo phat',
      'a di đà',
      'a di da',
      'bình an',
      'tài lộc',
      'chúc'
    ]
  }
];

export const SIM_DEVOTEES = [
  { user: 'Ngọc Anh Nguyễn', uniqueId: 'ngocanh.98', wish: 'Con thành tâm cầu cho bố mẹ luôn mạnh khỏe, bình an' },
  { user: 'Trần Minh Quân', uniqueId: 'minhquan_bds', wish: 'Cầu tháng mới công việc thuận buồm xuôi gió, tài lộc hanh thông' },
  { user: 'Diệu Thảo Tâm An', uniqueId: 'tam_an_99', wish: 'Nam Mô A Di Đà Phật, nguyện cầu thế giới hòa bình chúng sinh an lạc' },
  { user: 'Lê Hoàng Nam', uniqueId: 'hoangnam.dev', wish: 'Cầu thi cử đỗ đạt điểm cao, sự nghiệp rộng mở' },
  { user: 'Phạm Thanh Hà', uniqueId: 'thanhha.lotus', wish: 'Cầu gia đạo êm ấm, con cái ngoan ngoãn học giỏi' },
  { user: 'Vũ Đức Thịnh', uniqueId: 'ducthinh88', wish: 'Con xin gieo một quẻ cầu tài lộc đầu năm' }
];
