import { Injectable, isDevMode } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Canonical funnel events. Every name here MUST have a live call site —
 * declaring events nobody fires makes a dashboard look like it has coverage it
 * doesn't. The loop we care about closes on itself, so `shared_link_opened`
 * over `share_link_copied` is the viral coefficient:
 *
 *   page_view → screenshots_uploaded → analysis_started → analysis_succeeded
 *             → share_link_copied → shared_link_opened → page_view
 */
export type AnalyticsEvent =
  | 'page_view'
  | 'demo_clicked'
  | 'screenshots_uploaded'
  | 'analysis_started'
  | 'analysis_succeeded'
  | 'analysis_failed'
  | 'reply_copied'
  | 'replies_regenerated'
  | 'share_link_copied'
  | 'shared_link_opened';

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
