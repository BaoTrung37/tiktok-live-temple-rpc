import { describe, expect, test } from 'bun:test';
import {
  isBlockedSpamOrToxic,
  sanitizeUserName,
  sanitizeWishText
} from '../src/sanctuary/sanitizer.js';

describe('sanctuary/sanitizer', () => {
  test('chuẩn hóa chữ nghệ thuật toán học Unicode (NFKC -> NFC) về tiếng Việt chuẩn', () => {
    expect(sanitizeUserName('𝒯𝒽𝒾ê𝓃 𝒯â𝓂 88')).toBe('Thiên Tâm 88');
    expect(sanitizeWishText('𝒞ầ𝓊 𝒷ì𝓃𝒽 𝒶𝓃 [rose] [smile]')).toBe('Cầu bình an');
  });

  test('chặn ký tự lạ Cuneiform (𒐫), Zalgo và từ khóa phản cảm / lừa đảo', () => {
    expect(isBlockedSpamOrToxic('𒐫𒐫 spam')).toBe(true);
    expect(isBlockedSpamOrToxic('A\u0300\u0301\u0302\u0303 zalgo')).toBe(true);
    expect(isBlockedSpamOrToxic('vào nhóm telegram nhận lộc')).toBe(true);
    expect(isBlockedSpamOrToxic('Con thành tâm cầu bình an')).toBe(false);
  });

  test('trả về tên mặc định "Thí Chủ Hữu Duyên" khi tên rỗng, toàn icon hoặc chứa từ cấm', () => {
    expect(sanitizeUserName('')).toBe('Thí Chủ Hữu Duyên');
    expect(sanitizeUserName('🪷🔥🙏')).toBe('Thí Chủ Hữu Duyên');
    expect(sanitizeUserName('admin telegram')).toBe('Thí Chủ Hữu Duyên');
  });

  test('lọc sạch emote ngoặc vuông, gộp ký tự lặp quá mức và cắt dấu câu dư ở cuối', () => {
    expect(sanitizeWishText('[cry] Nam mô A Di Đà Phậtttttt!!!!')).toBe('Nam mô A Di Đà Phậtt');
    expect(sanitizeWishText('Cầu bình an!!! Gia đạo êm ấm...')).toBe('Cầu bình an! Gia đạo êm ấm');
    expect(sanitizeWishText('vào telegram ngay')).toBe('');
  });
});
