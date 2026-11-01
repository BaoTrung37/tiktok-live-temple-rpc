import { SIM_DEVOTEES } from '../sanctuary/rules.js';

export function createAutoSimulator({ store, rituals }) {
  let autoSimTimer = null;

  function runSingleStep() {
    const pick = SIM_DEVOTEES[Math.floor(Math.random() * SIM_DEVOTEES.length)];
    const roll = Math.random();
    if (roll < 0.3) {
      rituals.burnIncense({ user: pick.user, uniqueId: pick.uniqueId, count: 3, wish: pick.wish });
    } else if (roll < 0.55) {
      rituals.sendPrayer({ user: pick.user, uniqueId: pick.uniqueId, wish: pick.wish });
    } else if (roll < 0.75) {
      rituals.drawFortune({ user: pick.user, uniqueId: pick.uniqueId, topic: pick.wish });
    } else if (roll < 0.9) {
      rituals.offerGift({
        user: pick.user,
        uniqueId: pick.uniqueId,
        giftType: 'lotus',
        coins: 15,
        giftName: 'Hoa Sen Vàng Tinh Khiết'
      });
    } else {
      rituals.ringBell({
        user: pick.user,
        uniqueId: pick.uniqueId,
        count: 1,
        wish: pick.wish,
        readTts: true
      });
    }
  }

  function configure(enabled) {
    store.state.settings.autoSim = Boolean(enabled);
    if (autoSimTimer) {
      clearInterval(autoSimTimer);
      autoSimTimer = null;
    }
    if (store.state.settings.autoSim) {
      runSingleStep();
      autoSimTimer = setInterval(runSingleStep, store.state.settings.autoSimIntervalMs || 9500);
    }
  }

  function stop() {
    if (autoSimTimer) {
      clearInterval(autoSimTimer);
      autoSimTimer = null;
    }
  }

  return {
    configure,
    runSingleStep,
    stop
  };
}
