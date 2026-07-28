/**
 * Default (development) environment.
 *
 * The API gateway URL is intentionally configurable so it is no longer
 * hard-coded inside the service. For production builds this file is swapped
 * out via the `fileReplacements` entry in angular.json.
 *
 * NOTE: A public SPA can never fully hide an endpoint — real abuse protection
 * (rate limiting, origin allow-list, request-size caps, daily quota, anonymous
 * session tokens) must live on the gateway itself. The client-side pieces here
 * (cooldown, retry budget, request caps) are defense-in-depth, not a substitute.
 */
export const environment = {
  production: false,
  /** Base URL of the OpenAI proxy gateway. */
  apiUrl: 'https://ai-gateway-production-0388.up.railway.app/api/v1/openai-proxy',
  /** Per-request timeout (ms) before we abort and surface a friendly error. */
  requestTimeoutMs: 45_000,
  /** Max automatic retries for transient (5xx / 429 / network) failures. */
  maxRetries: 2,
  /** Base backoff delay (ms); grows exponentially with jitter per attempt. */
  retryBaseDelayMs: 800,
  /** Minimum gap (ms) between two analyses from the same client (anti-spam). */
  analyzeCooldownMs: 4_000,
  /** Soft client-side daily analysis quota (UX guard, not security). */
  dailyAnalysisQuota: 40,
  /** Optional analytics. Leave domain empty to disable Plausible. */
  analytics: {
    plausibleDomain: '',
    plausibleSrc: 'https://plausible.io/js/script.js',
  },
};
