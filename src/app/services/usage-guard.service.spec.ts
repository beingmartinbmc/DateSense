import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UsageGuardService } from './usage-guard.service';
import { environment } from '../../environments/environment';

/**
 * Self-contained in-memory localStorage so these tests run regardless of the
 * configured test environment (node or jsdom) and never leak state.
 */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

describe('UsageGuardService', () => {
  let guard: UsageGuardService;

  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    guard = new UsageGuardService();
  });

  it('allows analysis initially', () => {
    expect(guard.canAnalyze(1_000)).toBe(true);
    expect(guard.blockReason(1_000)).toBeNull();
  });

  it('enforces a cooldown window after an analysis', () => {
    const t0 = 1_000_000;
    guard.recordAnalysis(t0);

    // Immediately after: blocked.
    expect(guard.canAnalyze(t0 + 500)).toBe(false);
    expect(guard.cooldownRemainingMs(t0 + 500)).toBeGreaterThan(0);
    expect(guard.blockReason(t0 + 500)).toMatch(/Easy there/);

    // After the cooldown elapses: allowed again.
    const after = t0 + environment.analyzeCooldownMs + 1;
    expect(guard.canAnalyze(after)).toBe(true);
    expect(guard.cooldownRemainingMs(after)).toBe(0);
  });

  it('tracks daily quota usage and persists it', () => {
    const t0 = 2_000_000;
    guard.recordAnalysis(t0);
    expect(guard.getQuota(t0).used).toBe(1);

    // A fresh instance should read persisted quota for the same day.
    const guard2 = new UsageGuardService();
    expect(guard2.getQuota(t0).used).toBe(1);
  });

  it('exhausts quota at the configured limit', () => {
    let t = 5_000_000;
    for (let i = 0; i < environment.dailyAnalysisQuota; i++) {
      // Space them past the cooldown so only quota is the limiter.
      t += environment.analyzeCooldownMs + 1;
      guard.recordAnalysis(t);
    }
    expect(guard.isQuotaExhausted(t)).toBe(true);
    expect(guard.blockReason(t)).toMatch(/limit/i);
    expect(guard.canAnalyze(t + environment.analyzeCooldownMs + 1)).toBe(false);
  });

  it('resets the quota on a new calendar day', () => {
    const day1 = new Date('2026-01-01T10:00:00').getTime();
    guard.recordAnalysis(day1);
    expect(guard.getQuota(day1).used).toBe(1);

    const day2 = new Date('2026-01-02T10:00:00').getTime();
    expect(guard.getQuota(day2).used).toBe(0);
  });

  it('degrades gracefully when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {},
      clear: () => {},
    });
    // Should not throw; falls back to a clean quota.
    expect(() => guard.getQuota(1_000)).not.toThrow();
    expect(guard.getQuota(1_000).used).toBe(0);
  });
});
