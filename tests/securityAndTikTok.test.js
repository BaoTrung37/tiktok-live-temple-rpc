import { describe, expect, test } from 'bun:test';
import { isAllowedOrigin } from '../src/config.js';
import {
  computeGiftComboDelta,
  resolveTikTokUsername
} from '../src/integrations/tiktokLive.js';

describe('security & TikTok integration helpers', () => {
  test('isAllowedOrigin chỉ chấp nhận loopback, Same-Origin tunnel hoặc request không có Origin, chặn tên miền lạ', () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
    expect(isAllowedOrigin('')).toBe(true);
    expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:3100')).toBe(true);
    expect(isAllowedOrigin('https://temple-live.trycloudflare.com', 'temple-live.trycloudflare.com')).toBe(
      true
    );
    expect(isAllowedOrigin('https://evil.example.com', 'temple-live.trycloudflare.com')).toBe(
      false
    );
    expect(isAllowedOrigin('https://evil.example.com', 'localhost:3100')).toBe(false);
    expect(isAllowedOrigin('http://localhost.evil.com:3000')).toBe(false);
  });

  test('resolveTikTokUsername chống SSRF và giải mã đúng link TikTok hợp lệ', async () => {
    expect(await resolveTikTokUsername('@zenfacts_vn')).toBe('zenfacts_vn');
    expect(await resolveTikTokUsername('https://www.tiktok.com/@chualinhung/live')).toBe(
      'chualinhung'
    );

    // Chặn SSRF trực tiếp tới IP nội bộ / metadata server
    let fetchCalled = false;
    const spyFetch = async () => {
      fetchCalled = true;
      return { url: 'https://www.tiktok.com/@should_not_reach' };
    };
    await expect(
      resolveTikTokUsername('http://127.0.0.1:8080/internal-admin', spyFetch)
    ).rejects.toThrow('Chỉ chấp nhận đường dẫn thuộc tên miền tiktok.com');
    await expect(
      resolveTikTokUsername('http://169.254.169.254/latest/meta-data/', spyFetch)
    ).rejects.toThrow('Chỉ chấp nhận đường dẫn thuộc tên miền tiktok.com');
    expect(fetchCalled).toBe(false);

    // Cho phép link rút gọn vt.tiktok.com khi redirect về tiktok.com/@user
    const resolvedShort = await resolveTikTokUsername('https://vt.tiktok.com/ZSY12345/', async () => ({
      url: 'https://www.tiktok.com/@thichuminhtam/live'
    }));
    expect(resolvedShort).toBe('thichuminhtam');

    // Chặn link rút gọn bị redirect ra ngoài tiktok.com
    await expect(
      resolveTikTokUsername('https://vt.tiktok.com/ZSY99999/', async () => ({
        url: 'http://127.0.0.1:9000/@admin'
      }))
    ).rejects.toThrow('Không giải mã được @username');
  });

  test('computeGiftComboDelta tính chuẩn chuỗi combo và không nuốt quà lẻ kế tiếp', () => {
    const tracker = new Map();

    // Chuỗi combo 1: gói 1 (1 bông), sau đó TikTok gộp gói kết thúc (4 bông, repeatEnd: true)
    expect(
      computeGiftComboDelta(tracker, { giftType: 1, repeatCount: 1, repeatEnd: false }, 'u1', 'rose')
    ).toBe(1);
    expect(
      computeGiftComboDelta(tracker, { giftType: 1, repeatCount: 4, repeatEnd: true }, 'u1', 'rose')
    ).toBe(3);

    // Ngay sau đó cùng người xem bấm tặng 1 bông hồng lẻ (repeatCount: 1, repeatEnd: true) -> PHẢI được tính là 1!
    expect(
      computeGiftComboDelta(tracker, { giftType: 1, repeatCount: 1, repeatEnd: true }, 'u1', 'rose')
    ).toBe(1);

    // Chuỗi combo 2: 1 -> 2 -> 2 (gói chốt không tăng thêm số lượng) -> 1, 1, 0
    expect(
      computeGiftComboDelta(tracker, { giftType: 1, repeatCount: 1, repeatEnd: false }, 'u1', 'rose')
    ).toBe(1);
    expect(
      computeGiftComboDelta(tracker, { giftType: 1, repeatCount: 2, repeatEnd: false }, 'u1', 'rose')
    ).toBe(1);
    expect(
      computeGiftComboDelta(tracker, { giftType: 1, repeatCount: 2, repeatEnd: true }, 'u1', 'rose')
    ).toBe(0);

    // Quà lớn không phải combo (giftType: 2, không có repeatEnd) -> luôn tính đủ mỗi lần gửi
    expect(computeGiftComboDelta(tracker, { giftType: 2, repeatCount: 1 }, 'u1', 'dragon')).toBe(1);
    expect(computeGiftComboDelta(tracker, { giftType: 2, repeatCount: 1 }, 'u1', 'dragon')).toBe(1);
  });
});
