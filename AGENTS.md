# AGENTS.md — Tài Liệu Kiến Trúc & Data Structs Cho AI Agent (`tiktok-live-temple-rpc`)

> **READ FIRST CHO MỌI AI AGENT:** Đọc file này đầu tiên để nắm toàn bộ kiến trúc module, cấu trúc dữ liệu (`struct` / `schema`), hợp đồng JSON-RPC 2.0 và quy tắc bất biến của dự án mà không cần đọc mò từng file nguồn.

---

## 1. Tổng Quan Kiến Trúc & Triết Lý Thiết Kế

- **Bài toán cốt lõi:** Ứng dụng phát trực tiếp tương tác (**Interactive TikTok Live Sanctuary 9:16 `1080×1920`**) chạy **Local-First 24/7** trên máy streamer cho OBS Studio / TikTok Live Studio, tích hợp giọng đọc AI tiếng Việt **ZeroTTS (`zeroweight-ai/ZeroTTS`, 48kHz ONNX)**.
- **Mẫu kiến trúc (Architecture Pattern):** **Capability-Oriented Modular Monolith + JSON-RPC 2.0 Command Pipeline + Python AI Sidecar**.
  - **Không dùng** kiến trúc đa tầng doanh nghiệp rườm rà và **không dùng** bundler (Webpack/Vite).
  - Toàn bộ Backend (`server.js`, `src/**`) và Frontend (`public/js/**`) thống nhất chuẩn **100% Native ES Modules (`"type": "module"`)**, độ sâu thư mục tối đa `≤ 2`.
  - Backend tách thành **3 vùng năng lực một chiều**:
    1. `src/sanctuary/` (**Pure Domain**): Luật chùa, điểm Công Đức, bộ quẻ Linh Xăm, lọc tiếng Việt, quản lý State. **Không chứa bất kỳ lệnh gọi mạng, Express, WebSocket hay Python nào** → Unit test chạy dưới `15ms`.
    2. `src/integrations/` (**External Adapters**): Kết nối `tiktok-live-connector`, quản lý tiến trình con Python ZeroTTS qua JSONL `stdin/stdout` + dọn cache `.wav` LRU, và bộ hẹn giờ giả lập `autoSim`.
    3. `src/rpc/` (**Transport & Wire Protocol**): Bảng định tuyến phẳng 16 phương thức JSON-RPC 2.0 (`rpcMethods.js`) + máy chủ HTTP Express & WebSocket `/ws` (`transport.js`).

```text
[TikTok Live / OBS UI / Webhook]
        │
        ▼
  src/rpc/transport.js  +  src/integrations/{tiktokLive,autoSim}.js
        │
        ▼
  src/rpc/rpcMethods.js (Bảng 16 JSON-RPC 2.0 Methods)
        │
        ├──► src/sanctuary/rituals.js ──► { sanitizer.js, rules.js, fortunes.js, stateStore.js }
        │         └── trả về { event: RitualEvent, state: TemplePublicState }
        │
        └──► src/integrations/zeroTts.js ◄══ JSONL stdin/stdout ══► python/tts_worker.py (ONNX 48kHz)
```

---

## 2. Bản Đồ Thư Mục & Bảng Chỉ Đường Tác Vụ (Task → File Routing)

### Cây thư mục chuẩn
```text
tiktok-live-temple-rpc/
├── AGENTS.md                        # Tài liệu kiến trúc & Data Structs chuẩn cho AI Agent
├── GEMINI.md                        # Điểm neo tự động nạp ngữ cảnh cho Antigravity / Gemini
├── package.json                     # Native ESM ("type": "module"), scripts: start, dev, test, check
├── bun.lock                         # Lockfile duy nhất của JS (dùng Bun)
├── requirements.txt                 # Khóa phiên bản thư viện Python cho .venv
├── server.js                        # Composition Root (~100 dòng): lắp ráp dependency & graceful shutdown
├── src/
│   ├── config.js                    # Biến môi trường & đường dẫn tập trung (PORT, STATE_FILE, TTS_CACHE_DIR...)
│   ├── sanctuary/                   # [PURE DOMAIN — 0 Network/Process I/O]
│   │   ├── fortunes.js              # FORTUNE_DECK (bộ quẻ Linh Xăm) & drawRandomFortune()
│   │   ├── rules.js                 # GIFT_LABELS, resolveGiftOffering(), COMMENT_INTENT_RULES, SIM_DEVOTEES
│   │   ├── sanitizer.js             # Lọc Cuneiform/Zalgo/từ cấm, chuẩn hóa NFKC->NFC cho tên & lời khấn
│   │   ├── stateStore.js            # Quản lý TempleState, Bảng Vàng Công Đức & lưu đĩa debounce
│   │   └── rituals.js               # Thực thi 8 nghi thức + parseViewerComment() (cooldown 3.5s/user)
│   ├── integrations/                # [ADAPTERS NGOẠI VI]
│   │   ├── zeroTts.js               # Quản lý daemon Python JSONL, gộp request trùng & xóa LRU .wav (>300 file)
│   │   ├── tiktokLive.js            # Kết nối phòng TikTok Live, giải mã link rút gọn, tính delta combo quà
│   │   └── autoSim.js               # Tự động giả lập thí chủ hành lễ khi bật settings.autoSim
│   └── rpc/                         # [GIAO VẬN HTTP & WEBSOCKET JSON-RPC 2.0]
│       ├── rpcMethods.js            # Bảng ánh xạ phẳng toàn bộ 16 JSON-RPC methods
│       └── transport.js             # Express (/rpc, /api/state, /api/tts, /api/health, static) + WS (/ws)
├── python/
│   └── tts_worker.py                # Daemon ZeroTTS ONNX (chuẩn hóa số/viết tắt TV, chống clipping, fix HF symlink)
├── public/                          # [FRONTEND ZERO-BUILD NATIVE ESM]
│   ├── index.html                   # Giao diện Chánh Điện 9:16 + Quick Dock (nạp /js/liveApp.js)
│   ├── admin.html                   # Trang Admin JSON-RPC 2.0 (nạp /js/adminApp.js)
│   ├── css/
│   │   ├── live.css                 # Layout 1080x1920 GPU-composited (không dùng filter blur)
│   │   └── admin.css                # Giao diện trang Admin
│   ├── js/
│   │   ├── liveApp.js               # Entrypoint màn hình Live 9:16 & chế độ ?obs=1
│   │   ├── adminApp.js              # Entrypoint trang Admin
│   │   ├── shared/rpcClient.js      # Client JSON-RPC 2.0 (WS auto-reconnect + HTTP POST fallback)
│   │   ├── stage/
│   │   │   ├── stageConfig.js       # Hằng số 1080x1920, SPRITE_FRAMES (8 tư thế), tọa độ 6 VIP & 40 ghế Đạo Tràng
│   │   │   ├── sanctuaryStage.js    # Điều khiển Lư hương, Chủ lễ Tam Bái, VIP, Đạo Tràng, Hoa đăng, Tờ Quẻ Xăm
│   │   │   ├── particleCanvas.js    # Động cơ hạt 2D 30 FPS Offscreen-Sprite (Khói hương, Hoa sen, Sóng âm)
│   │   │   └── audioEngine.js       # Nhạc nền auto-ducking, Pháp khí Web Audio, hàng đợi TTS có onStart/onEnd
│   │   └── ui/hudAndDock.js         # Render HUD, Bảng TẤM LÒNG THÀNH, Nhật ký sự kiện & nút bấm Quick Dock
│   └── assets/                      # amitabha_stage.png + 8 sprite devotee*.png (+ bg_chant.m4a tùy chọn)
└── tests/                           # Bộ kiểm thử tự động Bun (`bun test`)
    ├── sanitizer.test.js
    ├── rituals.test.js
    └── rpcMethods.test.js
```

### Bảng chỉ đường sửa code nhanh cho Agent
| Yêu cầu thay đổi | File cần sửa (Chính xác) |
| :--- | :--- |
| Thêm / sửa nội dung Quẻ Linh Xăm | `src/sanctuary/fortunes.js` |
| Đổi điểm Công Đức, bậc xu Quà tặng, từ khóa Comment | `src/sanctuary/rules.js` |
| Cập nhật danh sách từ cấm, lọc ký tự spam TikTok | `src/sanctuary/sanitizer.js` (và `python/tts_worker.py` nếu đổi cách đọc số/từ viết tắt) |
| Thêm một nghi thức tâm linh / lệnh RPC mới | 1. `src/sanctuary/rituals.js` → 2. `src/rpc/rpcMethods.js` → 3. `public/js/stage/sanctuaryStage.js` |
| Sửa logic kết nối TikTok Live / tính combo quà / tim | `src/integrations/tiktokLive.js` |
| Chỉnh giọng đọc AI, cache WAV hoặc xử lý tín hiệu âm thanh | `src/integrations/zeroTts.js` & `python/tts_worker.py` |
| Chỉnh vị trí ghế quỳ, 8 frame lạy Phật, tọa độ sân khấu `1080×1920` | `public/js/stage/stageConfig.js` & `public/js/stage/sanctuaryStage.js` |
| Chỉnh hạt khói hương, cánh hoa sen rơi, sóng âm chuông | `public/js/stage/particleCanvas.js` |
| Chỉnh tiếng chuông/mõ Web Audio, nhạc nền hoặc hàng đợi phát TTS | `public/js/stage/audioEngine.js` |
| Chỉnh HUD đáy, bảng `TẤM LÒNG THÀNH` hoặc nút điều khiển Quick Dock | `public/js/ui/hudAndDock.js` & `public/index.html` |

---

## 3. Đặc Tả Cấu Trúc Dữ Liệu Cốt Lõi (`Core Data Structs & Schemas`)

Dự án viết bằng JavaScript ESM thuần; dưới đây là định nghĩa `struct` chuẩn hóa (theo cú pháp TypeScript interface) phản ánh **chính xác 100%** dữ liệu chạy trong RAM, lưu trên đĩa và truyền qua WebSocket/HTTP.

### 3.1. State Lưu Đĩa & State Công Khai (`src/sanctuary/stateStore.js`)

```ts
/** Hồ sơ tích lũy Công Đức của từng người xem (key trong `state.devotees` là `(uniqueId || name).slice(0, 40)`) */
interface DevoteeProfile {
  name: string;        // Tên hiển thị đã qua sanitizeUserName() (tối đa 26 ký tự, mặc định "Thí Chủ Hữu Duyên")
  uniqueId: string;    // ID tài khoản TikTok (vd: "ngocanh.98")
  avatar: string;      // URL ảnh đại diện TikTok hoặc ""
  merit: number;       // Tổng điểm Công Đức tích lũy
  incense: number;     // Tổng số nén hương đã thắp
  gifts: number;       // Tổng số lần dâng lễ vật / quà
  lastWish: string;    // Lời cầu nguyện sạch gần nhất (tối đa 120 ký tự)
}

/** Một dòng trên Bảng Vàng Công Đức (Top 1..6 ngồi ghế VIP, Top 7..24 ngồi Đạo Tràng, Top 1..4 hiện ở HUD đáy) */
interface LeaderboardEntry {
  rank: number;        // Thứ hạng 1-based (sắp xếp giảm dần theo `merit`)
  name: string;
  uniqueId: string;
  avatar: string;
  merit: number;
  incense: number;
  lastWish: string;
}

interface TempleOfferingsCount {
  lotus: number;       // Đài Hoa Sen Vàng (1–4 xu)
  lamp: number;        // Đèn Lưu Ly Trí Tuệ (5–19 xu)
  fruit: number;       // Mâm Ngũ Quả Cát Tường (20–99 xu)
  dragon: number;      // Đại Lễ Kim Long Chầu Phật (>= 100 xu)
}

interface TempleSettings {
  ttsEnabled: boolean;         // Mặc định: true
  ttsVoice: string;            // Mặc định: "maichi" (1 trong 8 giọng ZeroTTS)
  bgMusicEnabled: boolean;     // Mặc định: true
  sfxEnabled: boolean;         // Mặc định: true
  smokeDensity: number;        // Mặc định: 1.0
  autoSim: boolean;            // Mặc định: false (giả lập thí chủ tự động)
  autoSimIntervalMs: number;   // Mặc định: 9500
}

interface TikTokConnectionStatus {
  connected: boolean;
  connecting: boolean;
  username: string;            // Mặc định: "zenfacts_vn" (không có dấu @ ở đầu)
  roomId: string | null;
  viewerCount: number;
  lastError: string | null;
}

interface ZeroTtsStatus {
  ready: boolean;              // true khi Python worker đã nạp xong model ONNX lên RAM
  status: string;              // "init" | "starting" | "loading_model" | "ready" | "stopped" | "error:..."
  voice: string;               // Giọng ưu tiên hiện tại, mặc định "maichi"
}

/** Cấu trúc JSON lưu bền vững xuống `data/merit-state.json` (debounce 1200ms) */
interface TemplePersistedState {
  totalIncense: number;        // Khởi tạo: 108
  totalMerit: number;          // Khởi tạo: 1080
  woodenFishHits: number;      // Khởi tạo: 360
  bellRings: number;           // Khởi tạo: 36
  lanternCount: number;        // Khởi tạo: 18
  fortuneCount: number;        // Khởi tạo: 12
  activeIncenseSticks: number; // Số chân nhang đang cháy trên lư (3..36, UI hiển thị tối đa 27)
  offerings: TempleOfferingsCount;
  devotees: Record<string, DevoteeProfile>;
  settings: TempleSettings;
}

/** Cấu trúc trả về qua `GET /api/state`, `temple.getState` và WebSocket `temple.state` */
interface TemplePublicState extends Omit<TemplePersistedState, 'devotees'> {
  haloIntensity: number;       // Cường độ hào quang Phật (0.35 .. 1.0)
  leaderboard: LeaderboardEntry[]; // Tối đa 24 thí chủ dẫn đầu
  recentEvents: RitualEvent[];     // Tối đa 15 sự kiện gần nhất (RAM giữ tối đa 35)
  tiktok: TikTokConnectionStatus;
  tts: ZeroTtsStatus;
  assets: {
    hasBgChant: boolean;       // true nếu có file `public/assets/bg_chant.m4a` trên đĩa
  };
}
```

### 3.2. Cấu Trúc Quẻ Xăm & Sự Kiện Nghi Thức (`src/sanctuary/fortunes.js`, `rituals.js`)

```ts
interface FortuneStick {
  number: number;      // Số thứ tự quẻ (1, 8, 12, 18, 24, 36, 52, 68, 81, 99)
  rank: string;        // "Thượng Thượng Cát" | "Đại Cát" | "Thượng Cát" | "Trung Cát"
  title: string;       // Tên quẻ Hán-Việt + giải nghĩa ngắn
  poem: string;        // Thơ giải quẻ 4 câu (ngăn cách bằng `\n`)
  meaning: string;     // Lời bàn chi tiết hiển thị trên tờ sớ
  ttsSummary: string;  // Câu tóm tắt chuẩn hóa để ZeroTTS đọc vang lên
}

interface BaseRitualEvent {
  id: string;          // vd: "evt_1762000000000_a1b2"
  timestamp: string;   // ISO 8601
  user: string;        // Tên thí chủ đã lọc sạch
  uniqueId: string;
  avatar: string;
  merit: number;       // Điểm Công Đức cộng thêm từ nghi thức này
  ttsText: string;     // Chuỗi lời khấn/cảm tạ để đọc TTS ("" nếu không đọc)
  ttsVoice?: string;   // Mặc định "maichi"
}

type RitualEvent =
  | (BaseRitualEvent & { type: 'burnIncense'; count: number; wish: string })
  | (BaseRitualEvent & { type: 'strikeWoodenFish'; count: number })
  | (BaseRitualEvent & { type: 'ringBell'; count: number; wish: string })
  | (BaseRitualEvent & { type: 'sendPrayer'; wish: string })
  | (BaseRitualEvent & {
      type: 'offerGift' | 'grandCeremony';
      giftType: 'lotus' | 'lamp' | 'fruit' | 'dragon';
      giftName: string;
      coins: number;
      wish: string;
    })
  | (BaseRitualEvent & {
      type: 'drawFortune';
      topic: string;
      fortune: FortuneStick;
    });

/** Kết quả trả về thống nhất của mọi hàm nghi thức trong `rituals.js` */
interface RitualExecutionResult {
  event: RitualEvent;
  state: TemplePublicState;
}
```

### 3.3. Hợp Đồng Giao Thức JSON-RPC 2.0 (`POST /rpc` & `WS /ws`)

#### 16 Phương thức Request → Response (`src/rpc/rpcMethods.js`)
| Method | Params đầu vào chính | Kết quả `result` trả về |
| :--- | :--- | :--- |
| `temple.getState` | `{}` | `TemplePublicState` |
| `temple.burnIncense` | `{ user?, uniqueId?, avatar?, count?: 1..9, wish?, readTts?: boolean }` | `RitualExecutionResult` (`+5 * count` CĐ) |
| `temple.strikeWoodenFish` | `{ user?, uniqueId?, avatar?, count?: 1..50, ttsText? }` | `RitualExecutionResult` (`+1 * count` CĐ) |
| `temple.ringBell` | `{ user?, uniqueId?, avatar?, count?: 1..9, wish?, readTts?: boolean }` | `RitualExecutionResult` (`+10 * count` CĐ) |
| `temple.sendPrayer` | `{ user?, uniqueId?, avatar?, wish?, readTts?: boolean }` | `RitualExecutionResult` (`+10` CĐ) |
| `temple.offerGift` | `{ user?, uniqueId?, avatar?, coins?: number, giftType?, giftName?, wish? }` | `RitualExecutionResult` (`coins * 20\|30\|50` CĐ) |
| `temple.drawFortune` | `{ user?, uniqueId?, avatar?, topic?, readTts?: boolean }` | `RitualExecutionResult` (`+10` CĐ) |
| `temple.grandCeremony` | `{ user?, uniqueId?, avatar?, coins?: >=100, giftName?, wish? }` | `RitualExecutionResult` (`type: 'grandCeremony'`) |
| `temple.updateSettings` | `Partial<TempleSettings>` | `TemplePublicState` |
| `temple.resetMerit` | `{}` | `TemplePublicState` |
| `temple.comment` | `{ comment: string, user?, uniqueId?, avatar? }` | `RitualExecutionResult \| null` |
| `temple.speak` | `{ text: string, voice?: string, broadcast?: boolean }` | `ZeroTtsSynthResult` |
| `temple.ttsStatus` | `{}` | `ZeroTtsStatus` |
| `live.connect` | `{ username: string }` (`@user` hoặc URL `tiktok.com`) | `TikTokConnectionStatus` |
| `live.disconnect` | `{}` | `TikTokConnectionStatus` |
| `live.setAutoSim` | `{ enabled: boolean }` | `TemplePublicState` |

#### 5 Sự kiện Server Push qua WebSocket (`/ws`, không có `id`)
- `temple.state` → `params: TemplePublicState` (gửi ngay khi WS vừa kết nối hoặc khi đổi cài đặt/trạng thái phòng Live).
- `temple.event` → `params: RitualExecutionResult` (`{ event, state }`, kích hoạt hoạt ảnh trên sân khấu 9:16).
- `temple.viewerCount` → `params: { viewerCount: number }`.
- `tts.play` → `params: { text: string, voice: string, url: string }` (khi gọi `temple.speak` từ Admin).
- `tts.status` → `params: ZeroTtsStatus`.

### 3.4. Giao Thức IPC JSONL Giữa Bun & Python Sidecar (`zeroTts.js` ↔ `python/tts_worker.py`)

```ts
/** Dòng JSON gửi qua `stdin` tới `python/tts_worker.py` */
interface ZeroTtsWorkerRequest {
  id: number;          // Số thứ tự tăng dần (1, 2, 3...)
  text: string;        // Câu tiếng Việt cần đọc
  voice: string;       // Mặc định: "maichi"
}

/** Dòng JSON nhận từ `stdout` của `python/tts_worker.py` */
type ZeroTtsWorkerMessage =
  | { type: 'status'; status: string; model: string }
  | {
      type: 'ready';
      model: string;
      voice: string | null;
      voices: string[];
      sampleRate: number;
      loadSec: number;
    }
  | { type: 'error'; fatal?: boolean; error: string; trace?: string }
  | {
      type: 'result';
      id: number;
      ok: true;
      cached: boolean;
      voice: string;
      file: string;
      url: string;     // vd: "/tts-cache/maichi_<sha1>.wav"
      synthSec: number;
      durationSec?: number;
    }
  | { type: 'result'; id: number | null; ok: false; error: string };
```

---

## 4. Năm Luồng Thực Thi Đặc Thù Phải Ghi Nhớ

1. **Chuẩn hóa tiếng Việt 2 tầng chống vỡ giọng AI:**
   - **Tầng 1 (`src/sanctuary/sanitizer.js`):** Chuẩn hóa `NFKC → NFC` (biến chữ kiểu toán học `𝒯𝒽𝒾ê𝓃 𝒯â𝓂` thành `Thiên Tâm`), chặn ký tự Cuneiform `𒐫`, Zalgo, Braille, từ phản cảm/lừa đảo (`telegram`...), xóa emote `[rose]`, cắt dấu câu dư ở cuối lời khấn.
   - **Tầng 2 (`python/tts_worker.py`):** Mở rộng từ viết tắt (`cđ` → `công đức`, `ko` → `không`), chuyển mọi con số sang chữ tiếng Việt (`108` → `một trăm lẻ tám`) trước khi đưa vào bộ âm vị IPA của ZeroTTS.
2. **Đồng bộ Tờ Giải Quẻ Xăm (`drawFortune`) với Giọng Đọc Mai Chi:**
   - Trong `public/js/stage/sanctuaryStage.js`, sự kiện `drawFortune` **KHÔNG** mở `#fortuneModal` ngay khi nhận WebSocket. Nó gọi `audio.enqueueTts(ev.ttsText, { onStart, onEnd })`: lúc chờ tổng hợp WAV thì hiển thị `"Đang xin xăm..."` và lắc ống xăm; đúng khoảnh khắc file WAV bắt đầu phát (`onStart`) mới mở tờ Giải Quẻ và đóng lại sau khi đọc xong (`onEnd`).
3. **Tính Delta Combo Quà TikTok (`giftStreakTracker`):**
   - Trong `src/integrations/tiktokLive.js`, quà loại combo (`giftType === 1`) gửi nhiều gói liên tiếp với `repeatCount` tăng dần. Hệ thống lưu số đếm trước đó theo khóa `${uniqueId}_${giftId}` để chỉ cộng phần chênh lệch `deltaCount`, tránh nhân bội điểm Công Đức.
4. **Không gây lỗi 404 ngầm khi thiếu file nhạc nền tùy chọn:**
   - File `public/assets/bg_chant.m4a` nằm trong `.gitignore` (người dùng tự chép nếu muốn). Backend báo cờ `state.assets.hasBgChant`; `audioEngine.js` chỉ gọi `new Audio('/assets/bg_chant.m4a')` khi `hasBgChant === true`, ngược lại dùng bộ tổng hợp chuông thiền ngũ cung Web Audio (`0` lỗi 404).
5. **Tự động xử lý Symlink HuggingFace Hub 2.x cho ONNXRuntime:**
   - `huggingface-hub >= 2.x` chia nhỏ thư mục `blobs/` khiến `onnxruntime >= 1.20` từ chối nạp file `.onnx.data` qua symlink (`External data path escapes model directory`). Hàm `materialize_snapshot_symlinks()` trong `python/tts_worker.py` tự động chuyển symlink trong snapshot cache thành hardlink (`0` byte dung lượng tốn thêm) trước khi khởi tạo `ZeroTTS`.

---

## 5. Các Quy Tắc Bất Biến (Architectural Guardrails)

1. **Giữ `src/sanctuary/` thuần khiết 100%:** Cấm `import` bất kỳ module nào từ `src/integrations/`, `src/rpc/`, `express`, `ws`, hay `child_process` vào `src/sanctuary/`.
2. **Chống XSS tuyệt đối trên giao diện Live:** Mọi chuỗi xuất phát từ người xem TikTok (`user`, `wish`, `giftName`, `comment`) bắt buộc gán qua `element.textContent` hoặc `document.createTextNode()`. **Cấm** nối chuỗi người dùng vào `innerHTML`.
3. **Bảo toàn hiệu năng 30 FPS siêu nhẹ cho OBS 24/7:**
   - Trong `public/css/live.css`: **Cấm** thêm `filter: blur(...)`, `filter: drop-shadow(...)` động hoặc `backdrop-filter` lên các phần tử chuyển động.
   - Trong `public/js/stage/particleCanvas.js`: Giữ khóa `30 FPS`, vẽ từ Offscreen Canvas (`drawImage`), **cấm** dùng `ctx.shadowBlur` hay `createRadialGradient` trong hàm `animate()`.
4. **Hệ tọa độ sân khấu cố định `1080×1920`:** Mọi tọa độ phần tử trong `#stage9x16` tính theo pixel chuẩn `1080×1920`; việc thu phóng theo cửa sổ trình duyệt do hàm `fitStage()` đảm nhiệm qua `transform: scale(wrapperWidth / 1080)`.

---

## 6. Quy Trình Kiểm Chứng Bắt Buộc Sau Khi Sửa Code

Sau bất kỳ thay đổi nào trên codebase, Agent **BẮT BUỘC** chạy đủ 3 lệnh kiểm tra sau tại thư mục gốc dự án và đảm bảo `exit code = 0`:

```bash
# 1. Kiểm tra cú pháp toàn bộ ES Modules (Backend + Frontend + Tests)
bun run check

# 2. Chạy toàn bộ Unit & RPC Integration Tests
bun test

# 3. Kiểm tra cú pháp Python ZeroTTS Worker
python3 -m py_compile python/tts_worker.py
```

> **Lưu ý khi khởi chạy Server trong Workspace `/Users/admin/Trung/Money`:**
> Mặc định `bun start` lắng nghe cổng `3000`. Nếu cổng `3000` đang được sử dụng bởi dự án khác trong workspace (ví dụ `tiktok-live-bar`), hãy khởi chạy trên cổng riêng: `PORT=3100 bun start`.
