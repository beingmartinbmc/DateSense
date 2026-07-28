import { Injectable, signal } from '@angular/core';
import { AnalysisResponse } from './api.service';

const STORAGE_KEY = 'datesense:last-result';

/**
 * Holds the most recent analysis result so the dashboard survives a page
 * refresh (router navigation state alone is wiped on reload) and so results
 * can be encoded into a shareable link.
 *
 * Screenshots are intentionally NOT persisted or shared — only the analysis
 * payload, which contains no raw chat messages. This keeps shared links safe
 * by default (no chats, no names, no faces leak out).
 */
@Injectable({ providedIn: 'root' })
export class ResultStore {
  readonly result = signal<AnalysisResponse | null>(null);
  readonly imageUrls = signal<string[]>([]);

  set(result: AnalysisResponse, imageUrls: string[] = []): void {
    this.result.set(result);
    this.imageUrls.set(imageUrls);
    this.persist(result);
  }

  clear(): void {
    this.revokeImages();
    this.result.set(null);
    this.imageUrls.set([]);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // sessionStorage may be unavailable (private mode / SSR) — ignore.
    }
  }

  /** Restore from sessionStorage after a refresh. Returns true if a result was found. */
  restore(): boolean {
    if (this.result()) return true;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as AnalysisResponse;
      this.result.set(parsed);
      return true;
    } catch {
      return false;
    }
  }

  private persist(result: AnalysisResponse): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    } catch {
      // Storage full or unavailable — non-fatal, dashboard still works in-memory.
    }
  }

  private revokeImages(): void {
    for (const url of this.imageUrls()) {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    }
  }

  // ── Shareable link encoding ────────────────────────────────────────────────
  // We pack a trimmed result into a URL-safe base64 string placed in the hash
  // fragment so it never hits a server. This gives shareable, refresh-proof
  // links with zero backend.

  /** A compact, share-safe subset of the analysis (no raw chat content exists in it anyway). */
  encodeShareToken(result: AnalysisResponse): string {
    const payload = {
      a: result.attraction_score,
      g: result.ghosting_risk,
      h: result.conversation_health,
      e: result.response_effort_balance,
      m: result.meetup_readiness,
      c: result.confidence_score,
      r: result.rizz_score,
      st: result.conversation_stage,
      mo: result.momentum,
      ar: result.archetype,
      bv: result.brutal_verdict,
      rr: result.rizz_roast,
      gf: result.green_flags,
      rf: result.red_flags,
      fr: result.fake_golddigger_risk,
    };
    return this.toBase64Url(JSON.stringify(payload));
  }

  /** Reconstruct a (partial) AnalysisResponse from a share token. */
  decodeShareToken(token: string): AnalysisResponse | null {
    try {
      const json = this.fromBase64Url(token);
      const p = JSON.parse(json);
      return {
        attraction_score: p.a ?? 0,
        ghosting_risk: p.g ?? 0,
        conversation_health: p.h ?? 0,
        response_effort_balance: p.e ?? 0,
        meetup_readiness: p.m ?? 0,
        confidence_score: p.c ?? 0,
        rizz_score: p.r ?? 0,
        conversation_stage: p.st ?? 'Unknown',
        momentum: p.mo ?? 'Unknown',
        archetype: p.ar ?? 'Mixed Signals',
        brutal_verdict: p.bv ?? '',
        rizz_roast: p.rr ?? '',
        insights: [],
        green_flags: Array.isArray(p.gf) ? p.gf : [],
        red_flags: Array.isArray(p.rf) ? p.rf : [],
        fake_golddigger_risk: p.fr ?? 'None',
        fake_golddigger_reason: '',
        next_move: '',
        reply_suggestions: [],
        date_ideas: [],
        // Deliberately never encoded into a share token — it is the closest
        // thing to the raw chat, and shared links must stay content-free.
        conversation_digest: '',
      };
    } catch {
      return null;
    }
  }

  private toBase64Url(input: string): string {
    const b64 = btoa(unescape(encodeURIComponent(input)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private fromBase64Url(input: string): string {
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return decodeURIComponent(escape(atob(padded)));
  }
}
