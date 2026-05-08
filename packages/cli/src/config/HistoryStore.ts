import { mkdir, readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

type HistoryType = 'secrets' | 'preflight';

const MAX_FILES_PER_SLOT = 50;

export class HistoryStore {
  constructor(private readonly configDir: string) {}

  /**
   * Persist a scan or preflight result.
   * Failures are silently swallowed — history is a side effect, never a blocker.
   */
  async save(type: HistoryType, tenantId: string, data: unknown): Promise<void> {
    try {
      const dir = this.slotDir(tenantId);
      await mkdir(dir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      await writeFile(join(dir, `${type}-${ts}.json`), JSON.stringify(data, null, 2), 'utf8');
      await this.prune(type, dir);
    } catch {
      // intentionally silent
    }
  }

  /**
   * Load the most recent saved result for the given type.
   * Returns null if no history exists or on any read error.
   */
  async loadLatest<T>(type: HistoryType, tenantId: string): Promise<T | null> {
    try {
      const dir = this.slotDir(tenantId);
      const files = await this.listFiles(type, dir);
      if (files.length === 0) return null;
      const raw = await readFile(join(dir, files[files.length - 1]), 'utf8');
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private slotDir(tenantId: string): string {
    return join(this.configDir, 'history', tenantId);
  }

  private async listFiles(type: HistoryType, dir: string): Promise<string[]> {
    try {
      const all = await readdir(dir);
      return all
        .filter((f) => f.startsWith(`${type}-`) && f.endsWith('.json'))
        .sort();
    } catch {
      return [];
    }
  }

  private async prune(type: HistoryType, dir: string): Promise<void> {
    const files = await this.listFiles(type, dir);
    if (files.length <= MAX_FILES_PER_SLOT) return;
    const stale = files.slice(0, files.length - MAX_FILES_PER_SLOT);
    await Promise.all(stale.map((f) => unlink(join(dir, f)).catch(() => undefined)));
  }
}
