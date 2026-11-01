import { describe, expect, test } from 'bun:test';
import { createRitualEngine } from '../src/sanctuary/rituals.js';
import { resolveGiftOffering } from '../src/sanctuary/rules.js';
import { createStateStore } from '../src/sanctuary/stateStore.js';

function createInMemoryEnv() {
  const events = [];
  const store = createStateStore({ persist: false, hasBgChant: false });
  const rituals = createRitualEngine({
    store,
    onEvent: (payload) => events.push(payload)
  });
  return { store, rituals, events };
}

describe('sanctuary/rituals & stateStore', () => {
  test('tính đúng Công Đức, số nén hương và sắp xếp Bảng Vàng Công Đức', () => {
    const { store, rituals } = createInMemoryEnv();
    const initialMerit = store.state.totalMerit;

    const r1 = rituals.burnIncense({ user: 'Minh Tâm', uniqueId: 'minhtam', count: 3 });
    expect(r1.event.type).toBe('burnIncense');
    expect(r1.event.merit).toBe(15);
    expect(store.state.totalMerit).toBe(initialMerit + 15);

    const r2 = rituals.grandCeremony({ user: 'Đại Thí Chủ', uniqueId: 'vip01', coins: 200 });
    expect(r2.event.type).toBe('grandCeremony');
    expect(r2.event.merit).toBe(10000);

    const lb = store.getLeaderboard(6);
    expect(lb[0].name).toBe('Đại Thí Chủ');
    expect(lb[0].rank).toBe(1);
    expect(lb[1].name).toBe('Minh Tâm');
    expect(lb[1].rank).toBe(2);
  });

  test('phân bậc quà tặng theo số xu TikTok (1..4, 5..19, 20..99, >=100)', () => {
    expect(resolveGiftOffering({ coins: 1 })).toEqual({
      coins: 1,
      giftType: 'lotus',
      giftName: 'Đài Hoa Sen Vàng',
      merit: 20
    });
    expect(resolveGiftOffering({ coins: 5 }).giftType).toBe('lamp');
    expect(resolveGiftOffering({ coins: 25 })).toEqual({
      coins: 25,
      giftType: 'fruit',
      giftName: 'Mâm Ngũ Quả Cát Tường',
      merit: 750
    });
    expect(resolveGiftOffering({ coins: 150 })).toEqual({
      coins: 150,
      giftType: 'dragon',
      giftName: 'Đại Lễ Kim Long Chầu Phật',
      merit: 7500
    });
  });

  test('phân tích bình luận người xem (có dấu & không dấu) và chặn spam 3.5 giây/user', () => {
    const { rituals } = createInMemoryEnv();
    const t0 = 1_700_000_000_000;

    const fortuneRes = rituals.parseViewerComment('con xin gieo que dau thang', 'An Nhiên', 'an1', '', t0);
    expect(fortuneRes?.event.type).toBe('drawFortune');
    expect(fortuneRes?.event.fortune.number).toBeGreaterThan(0);

    // Gửi tiếp sau 1 giây cùng uniqueId -> bị cooldown chặn
    const blockedSpam = rituals.parseViewerComment('thắp hương tiếp', 'An Nhiên', 'an1', '', t0 + 1000);
    expect(blockedSpam).toBeNull();

    // Sau 4 giây -> hết cooldown, khớp từ khóa không dấu "thap huong" -> 3 nén hương
    const incenseRes = rituals.parseViewerComment('con thanh tam thap huong', 'An Nhiên', 'an1', '', t0 + 4000);
    expect(incenseRes?.event.type).toBe('burnIncense');
    expect(incenseRes?.event.count).toBe(3);

    // Các nhóm từ khóa còn lại
    expect(rituals.parseViewerComment('thỉnh chuông cầu an', 'Bình', 'b1', '', t0)?.event.type).toBe('ringBell');
    expect(rituals.parseViewerComment('cùng gõ mõ tụng kinh', 'Châu', 'c1', '', t0)?.event.type).toBe(
      'strikeWoodenFish'
    );
    expect(rituals.parseViewerComment('Nam mô A Di Đà Phật', 'Dũng', 'd1', '', t0)?.event.type).toBe(
      'sendPrayer'
    );
  });

  test('resetMerit đặt lại toàn bộ thống kê và xóa danh sách thí chủ', () => {
    const { store, rituals } = createInMemoryEnv();
    rituals.burnIncense({ user: 'Thí Chủ A', count: 3 });
    const resetState = rituals.resetMerit();
    expect(resetState.totalMerit).toBe(0);
    expect(resetState.leaderboard).toHaveLength(0);
    expect(store.state.activeIncenseSticks).toBe(3);
  });

  test('lọc sạch giftName, ttsText và kẹp biên an toàn cho updateSettings', () => {
    const { store, rituals } = createInMemoryEnv();

    const blockedGift = rituals.offerGift({
      user: 'Thiện Tâm',
      coins: 20,
      giftName: 'vào telegram nhận quà'
    });
    expect(blockedGift.event.giftName).toBe('Mâm Ngũ Quả Cát Tường');

    const blockedFish = rituals.strikeWoodenFish({
      user: 'Thiện Tâm',
      count: 2,
      ttsText: 'vào telegram ngay'
    });
    expect(blockedFish.event.ttsText).toBe('');

    const updated = rituals.updateSettings({
      autoSimIntervalMs: 1,
      smokeDensity: 99,
      ttsEnabled: false,
      pollutedKey: 'should_not_persist'
    });
    expect(updated.settings.autoSimIntervalMs).toBe(2500);
    expect(updated.settings.smokeDensity).toBe(3);
    expect(updated.settings.ttsEnabled).toBe(false);
    expect('pollutedKey' in store.state.settings).toBe(false);
  });
});
