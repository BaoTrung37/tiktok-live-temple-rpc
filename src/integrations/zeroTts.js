import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Quản lý tiến trình Python ZeroTTS Sidecar (JSONL stdin/stdout) & tự động dọn cache LRU .wav.
 */
export class ZeroTTSManager {
  constructor({
    projectRoot,
    workerScript,
    venvPythonBin,
    cacheDir,
    maxCacheFiles = 300,
    getPreferredVoice = () => 'maichi',
    onStatusChange = null,
    autoStart = true
  }) {
    this.projectRoot = projectRoot;
    this.workerScript = workerScript;
    this.venvPythonBin = venvPythonBin;
    this.cacheDir = cacheDir;
    this.maxCacheFiles = maxCacheFiles;
    this.getPreferredVoice = getPreferredVoice;
    this.onStatusChange = onStatusChange;

    this.proc = null;
    this.ready = false;
    this.status = 'starting';
    this.voice = 'maichi';
    this.voices = ['maichi'];
    this.model = 'zeroweight-ai/ZeroTTS';
    this.pending = new Map();
    this.inflight = new Map();
    this.reqCounter = 0;
    this.newSynthCountSincePrune = 0;
    this.buffer = '';

    if (autoStart) {
      this.startWorker();
    }
  }

  resolvePythonBin() {
    if (this.venvPythonBin && fs.existsSync(this.venvPythonBin)) {
      return this.venvPythonBin;
    }
    return 'python3';
  }

  notifyStatus() {
    if (this.onStatusChange) {
      this.onStatusChange(this.getStatus());
    }
  }

  flushPendingWithError(errorMessage) {
    for (const [, item] of this.pending) {
      clearTimeout(item.timer);
      item.resolve({ ok: false, error: errorMessage });
    }
    this.pending.clear();
  }

  startWorker() {
    const pyBin = this.resolvePythonBin();
    console.log(`[ZeroTTS] Khởi chạy worker với ${pyBin} (Giọng mặc định: Mai Chi)...`);

    this.status = 'loading';
    this.proc = spawn(pyBin, [this.workerScript], {
      cwd: this.projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ZEROTTS_CACHE_DIR: this.cacheDir
      }
    });

    this.proc.on('error', (err) => {
      console.error(`[ZeroTTS] Không thể khởi chạy tiến trình Python (${pyBin}):`, err.message);
      this.ready = false;
      this.status = 'error';
      this.flushPendingWithError(`ZeroTTS spawn error: ${err.message}`);
      this.notifyStatus();
    });

    this.proc.stdin?.on('error', (err) => {
      console.warn('[ZeroTTS stdin Warning]', err.message);
    });

    this.proc.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString('utf8');
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        this.handleWorkerLine(line.trim());
      }
    });

    this.proc.stderr.on('data', (chunk) => {
      const msg = chunk.toString('utf8').trim();
      if (msg) console.log(`[ZeroTTS stderr] ${msg}`);
    });

    this.proc.on('exit', (code) => {
      console.warn(`[ZeroTTS] Worker thoát với mã ${code}`);
      this.ready = false;
      this.status = 'stopped';
      this.flushPendingWithError('ZeroTTS worker exited');
      this.notifyStatus();
    });
  }

  handleWorkerLine(line) {
    try {
      const msg = JSON.parse(line);
      if (msg.type === 'status') {
        this.status = msg.status;
        this.model = msg.model || this.model;
        this.notifyStatus();
      } else if (msg.type === 'ready') {
        this.ready = true;
        this.status = 'ready';
        this.voice = msg.voice || 'maichi';
        this.voices = msg.voices || ['maichi'];
        this.model = msg.model || this.model;
        console.log(`[ZeroTTS] Sẵn sàng sau ${msg.loadSec}s! Giọng: ${this.voice} (${this.voices.join(', ')})`);
        this.notifyStatus();
        this.pruneCacheIfNeeded().catch(() => {});
      } else if (msg.type === 'result' && msg.id !== undefined && msg.id !== null) {
        const entry = this.pending.get(msg.id);
        if (entry) {
          clearTimeout(entry.timer);
          this.pending.delete(msg.id);
          entry.resolve(msg);
        }
        if (msg.ok && !msg.cached) {
          this.newSynthCountSincePrune += 1;
          if (this.newSynthCountSincePrune >= 25) {
            this.newSynthCountSincePrune = 0;
            this.pruneCacheIfNeeded().catch(() => {});
          }
        }
      } else if (msg.type === 'error') {
        console.error('[ZeroTTS Error]', msg.error);
        this.status = 'error';
        this.notifyStatus();
      }
    } catch (_) {
      console.log('[ZeroTTS stdout]', line);
    }
  }

  getStatus() {
    return {
      ready: this.ready,
      status: this.status,
      engine: 'ZeroTTS (zeroweight-ai/ZeroTTS)',
      voice: this.getPreferredVoice() || this.voice || 'maichi',
      voices: this.voices,
      model: this.model
    };
  }

  synthesize(text, voiceOverride) {
    const cleanText = String(text || '').trim();
    if (!cleanText) return Promise.resolve({ ok: false, error: 'Empty text' });
    const voice = (voiceOverride || this.getPreferredVoice() || 'maichi').toLowerCase();
    const dedupKey = `${voice}::${cleanText}`;

    if (this.inflight.has(dedupKey)) {
      return this.inflight.get(dedupKey);
    }

    const promise = new Promise((resolve) => {
      if (!this.proc || !this.ready || !this.proc.stdin || this.proc.stdin.destroyed) {
        return resolve({ ok: false, error: `ZeroTTS đang ở trạng thái: ${this.status}` });
      }
      const id = ++this.reqCounter;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ ok: false, error: 'ZeroTTS synthesis timeout' });
      }, 30000);

      this.pending.set(id, { resolve, timer });
      const payload = JSON.stringify({ id, text: cleanText, voice }) + '\n';
      try {
        this.proc.stdin.write(payload);
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        resolve({ ok: false, error: err?.message || 'ZeroTTS stdin write failed' });
      }
    }).finally(() => {
      this.inflight.delete(dedupKey);
    });

    this.inflight.set(dedupKey, promise);
    return promise;
  }

  async pruneCacheIfNeeded() {
    if (!this.cacheDir || this.maxCacheFiles <= 0) return;
    const names = await fs.promises.readdir(this.cacheDir).catch(() => []);
    const wavFiles = names.filter((n) => n.endsWith('.wav'));
    if (wavFiles.length <= this.maxCacheFiles) return;

    const entries = await Promise.all(
      wavFiles.map(async (name) => {
        const fullPath = path.join(this.cacheDir, name);
        const st = await fs.promises.stat(fullPath).catch(() => null);
        return st ? { fullPath, mtimeMs: st.mtimeMs } : null;
      })
    );
    const valid = entries.filter(Boolean).sort((a, b) => a.mtimeMs - b.mtimeMs);
    const toDeleteCount = valid.length - this.maxCacheFiles;
    for (let i = 0; i < toDeleteCount; i++) {
      await fs.promises.unlink(valid[i].fullPath).catch(() => {});
    }
  }

  shutdown() {
    if (this.proc) {
      try {
        this.proc.stdin?.end();
        this.proc.kill('SIGTERM');
      } catch (_) {}
      this.proc = null;
    }
  }
}
