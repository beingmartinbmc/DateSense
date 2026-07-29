import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

/**
 * The token `environment.prod.ts` ships with. CI rewrites it with the real key;
 * if that substitution never ran we must treat it as "no key" rather than send
 * it, otherwise a build misconfiguration looks like a gateway outage.
 */
const UNSUBSTITUTED_KEY = '__AI_GATEWAY_API_KEY__';

/**
 * Attaches the gateway's `X-API-Key` to every proxy call from one place, so new
 * call sites can never forget it. Scoped to `apiUrl` so the key is never sent
 * to any other host.
 *
 * The key is baked into a public static bundle and is therefore readable by
 * anyone with devtools. It identifies the caller for rate limiting and lets the
 * gateway revoke this app specifically — it is not a secret.
 */
export const apiKeyInterceptor: HttpInterceptorFn = (req, next) => {
  const key = environment.apiKey;
  if (!key || key === UNSUBSTITUTED_KEY || !req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { 'X-API-Key': key } }));
};
