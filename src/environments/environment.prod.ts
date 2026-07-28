/**
 * Production environment. Swapped in for `environment.ts` at build time via
 * angular.json `fileReplacements`.
 *
 * The API URL can be overridden at deploy time without code changes by
 * editing this file in CI, but the long-term fix for abuse is gateway-side
 * enforcement (origin allow-list, rate limit, quota, session tokens).
 */
export const environment = {
  production: true,
  apiUrl: 'https://ai-gateway-production-0388.up.railway.app/api/v1/openai-proxy',
  requestTimeoutMs: 45_000,
  maxRetries: 2,
  retryBaseDelayMs: 800,
  analyzeCooldownMs: 4_000,
  dailyAnalysisQuota: 40,
  analytics: {
    // Set this to your verified domain to turn on Plausible in production.
    plausibleDomain: '',
    plausibleSrc: 'https://plausible.io/js/script.js',
  },
};
