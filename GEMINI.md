# GEMINI.md — Antigravity / Gemini First-Read Guide (`tiktok-live-temple-rpc`)

> **BẮT BUỘC ĐỌC TRƯỚC KHI SỬA CODE:** Toàn bộ bản đồ kiến trúc, bảng chỉ đường sửa file (`Task → File Routing`) và đặc tả chi tiết các `Data Structs` / hợp đồng `JSON-RPC 2.0` của dự án này được định nghĩa đầy đủ tại **[`AGENTS.md`](./AGENTS.md)**. Hãy đọc [`AGENTS.md`](./AGENTS.md) ngay lập tức trước khi thực hiện bất kỳ thay đổi nào.

## Tóm Tắt Nhanh Các Nguyên Tắc Sống Còn

1. **Kiến trúc & Công nghệ:**
   - **Capability-Oriented Modular Monolith + JSON-RPC 2.0 Pipeline + Python ZeroTTS Sidecar**.
   - **100% Native ES Modules (`"type": "module"`)** trên **Bun.js** (`server.js`, `src/{sanctuary,integrations,rpc}`) + **Zero-Build Browser ESM** (`public/js/{shared,stage,ui}`) + **Python `.venv`** (`python/tts_worker.py`).
2. **Ranh giới Module Bất Biến:**
   - `src/sanctuary/` là **Pure Domain** (0 I/O mạng, 0 tiến trình con). Tuyệt đối không import `integrations/` hoặc `rpc/` vào `sanctuary/`.
   - Không dùng `innerHTML` cho dữ liệu người xem TikTok; không dùng `filter: blur()`, `backdrop-filter` hay `ctx.shadowBlur` trên màn hình Live `9:16` (`1080×1920`, khóa `30 FPS`).
3. **Lệnh Kiểm Tra Bắt Buộc Sau Khi Sửa Code:**
   ```bash
   cd /Users/admin/Trung/Money/tiktok-live-temple-rpc && bun run check && bun test && python3 -m py_compile python/tts_worker.py
   ```
4. **Cổng chạy thực tế trong Workspace:**
   - Mặc định `PORT=3000`. Khi chạy song song cùng `tiktok-live-bar` (đang giữ cổng `3000`), luôn chạy dự án này với `PORT=3100 bun start`.
