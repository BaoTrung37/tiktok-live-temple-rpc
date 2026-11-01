import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROJECT_ROOT = path.resolve(__dirname, '..');
export const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
export const DATA_DIR = path.join(PROJECT_ROOT, 'data');
export const TTS_CACHE_DIR = path.join(DATA_DIR, 'tts-cache');
export const STATE_FILE = path.join(DATA_DIR, 'merit-state.json');
export const PYTHON_WORKER_FILE = path.join(PROJECT_ROOT, 'python', 'tts_worker.py');
export const VENV_PYTHON_BIN = path.join(PROJECT_ROOT, '.venv', 'bin', 'python');
export const BG_CHANT_FILE = path.join(PUBLIC_DIR, 'assets', 'bg_chant.m4a');

export const PORT = Number(process.env.PORT) || 3000;
export const DEFAULT_TIKTOK_USER = process.env.TIKTOK_USER ?? 'zenfacts_vn';
export const TTS_CACHE_MAX_FILES = Number(process.env.TTS_CACHE_MAX_FILES) || 300;

const EXTRA_ALLOWED_ORIGINS = new Set(
  String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * Kiểm tra Origin hợp lệ cho máy chủ Local-First (chặn các trang web lạ gọi chéo miền CSRF/CSWSH vào localhost).
 * Cho phép các công cụ không gửi Origin (OBS, curl, Streamer.bot, webhook) và mọi cổng trên loopback.
 */
export function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (EXTRA_ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const parsed = new URL(origin);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())
    );
  } catch (_) {
    return false;
  }
}

export function ensureDataDirectories() {
  fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });
}

export function hasCustomBgChantFile() {
  return fs.existsSync(BG_CHANT_FILE);
}
