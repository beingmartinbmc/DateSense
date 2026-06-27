import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface QuotaState {
  /** Analyses used today. */
  used: number;
  /** Soft daily limit from environment config. */
  limit: number;
  /** Local date key (YYYY-MM-DD) the counter belongs to. */
  day: string;
}

const QUOTA_KEY = 'datesense.usage.quota';

/**
 * Client-side abuse guard.
 *
 * IMPORTANT: this is a UX / defense-in-depth layer, NOT a security control.
 * A public SPA cannot truly hide an endpoint, so the real protection (origin
 * allow-list, server rate limiting, per-IP quotas, anonymous session tokens)
 * MUST live on the gateway. What we do here:
 *
 *  - Cooldown: block rapid-fire repeat submissions (accidental double-clicks
 *    and trivial spam) within `analyzeCooldownMs`.
 *  - Soft daily quota: discourage casual hammering and give honest UX feedback.
 *
 * State is stored in localStorage and resets per local calendar day.
 */
@Injectable({ providedIn: 'root' })
export class UsageGuardService {
  private lastAnalysisAt = Number.NEGATIVE_INFINITY;

  /** ms remaining on the cooldown, or 0 if a new analysis is allowed now. */
  cooldownRemainingMs(now: number = Date.now()): number {
    const elapsed = now - this.lastAnalysisAt;
    const remaining = environment.analyzeCooldownMs - elapsed;
    return remaining > 0 ? remaining : 0;
  }

  /** True when the cooldown window has elapsed. */
  canAnalyze(now: number = Date.now()): boolean {
    return this.cooldownRemainingMs(now) === 0 && !this.isQuotaExhausted(now);
  }

  /** Record that an analysis was just started (arms the cooldown + quota). */
  recordAnalysis(now: number = Date.now()): void {
    this.lastAnalysisAt = now;
    const state = this.readQuota(now);
    this.writeQuota({ ...state, used: state.used + 1 });
  }

  /** Current quota snapshot for today. */
  getQuota(now: number = Date.now()): QuotaState {
    return this.readQuota(now);
  }

  isQuotaExhausted(now: number = Date.now()): boolean {
    const state = this.readQuota(now);
    return state.used >= state.limit;
  }

  /** Human-friendly reason the user can't analyze right now (or null). */
  blockReason(now: number = Date.now()): string | null {
    if (this.isQuotaExhausted(now)) {
      return `You've hit today's free analysis limit (${environment.dailyAnalysisQuota}). Come back tomorrow!`;
    }
    const remaining = this.cooldownRemainingMs(now);
    if (remaining > 0) {
      const secs = Math.ceil(remaining / 1000);
      return `Easy there — give it ${secs}s before the next analysis.`;
    }
    return null;
  }

  private readQuota(now: number): QuotaState {
    const today = this.dayKey(now);
    const fallback: QuotaState = { used: 0, limit: environment.dailyAnalysisQuota, day: today };

    try {
      if (typeof localStorage === 'undefined') return fallback;
      const raw = localStorage.getItem(QUOTA_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Partial<QuotaState>;
      if (parsed.day !== today) return fallback; // new day → reset
      return {
        used: typeof parsed.used === 'number' && parsed.used >= 0 ? parsed.used : 0,
        limit: environment.dailyAnalysisQuota,
        day: today,
      };
    } catch {
      return fallback;
    }
  }

  private writeQuota(state: QuotaState): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(QUOTA_KEY, JSON.stringify(state));
    } catch {
      // Private mode / storage full — quota silently degrades to per-session.
    }
  }

  private dayKey(now: number): string {
    const d = new Date(now);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
