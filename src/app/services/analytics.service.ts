import { Injectable, isDevMode } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Canonical funnel events. Keeping them centralized means every call site uses
 * the same names, so the dashboard stays meaningful:
 *   page_view → analysis_started → analysis_succeeded → share_*.
 */
export type AnalyticsEvent =
  | 'page_view'
  | 'demo_clicked'
  | 'mode_selected'
  | 'screenshots_uploaded'
  | 'manual_submitted'
  | 'analysis_started'
  | 'analysis_succeeded'
  | 'analysis_failed'
  | 'analysis_retried'
  | 'reply_copied'
  | 'replies_regenerated'
  | 'share_link_copied'
  | 'card_downloaded'
  | 'native_share_used'
  | 'shared_link_opened'
  | 'session_cleared';

type PlausibleFn = (event: string, opts?: { props?: Record<string, string | number | boolean> }) => void;

declare global {
  interface Window {
    plausible?: PlausibleFn & { q?: unknown[] };
  }
}

/**
 * Privacy-friendly analytics wrapper.
 *
 * - No cookies, no PII, no chat content is ever sent — only event names and a
 *   tiny set of safe numeric/string props (e.g. file count, error kind).
 * - Uses Plausible when `analytics.plausibleDomain` is configured; otherwise it
 *   silently no-ops (and logs in dev) so local development is never blocked.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private initialized = false;

  /** Inject the Plausible snippet once, only if a domain is configured. */
  init(): void {
    if (this.initialized || typeof document === 'undefined') return;
    this.initialized = true;

    const domain = environment.analytics?.plausibleDomain?.trim();
    if (!domain) return;

    // Stub queue so events fired before the script loads are not lost.
    window.plausible =
      window.plausible ||
      function (...args: unknown[]) {
        (window.plausible!.q = window.plausible!.q || []).push(args);
      };

    const script = document.createElement('script');
    script.defer = true;
    script.setAttribute('data-domain', domain);
    script.src = environment.analytics.plausibleSrc;
    document.head.appendChild(script);
  }

  /** Record a funnel event with optional safe (non-PII) properties. */
  track(event: AnalyticsEvent, props?: Record<string, string | number | boolean>): void {
    try {
      if (typeof window !== 'undefined' && typeof window.plausible === 'function') {
        window.plausible(event, props ? { props } : undefined);
        return;
      }
      if (isDevMode()) {
        // eslint-disable-next-line no-console
        console.debug('[analytics]', event, props ?? {});
      }
    } catch {
      // Analytics must never break the app.
    }
  }
}
