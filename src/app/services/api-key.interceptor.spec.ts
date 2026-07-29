import { describe, it, expect, afterEach } from 'vitest';
import { HttpRequest } from '@angular/common/http';
import { EMPTY } from 'rxjs';
import { apiKeyInterceptor } from './api-key.interceptor';
import { environment } from '../../environments/environment';

const originalKey = environment.apiKey;

/** Runs the interceptor and hands back the request it forwarded downstream. */
function intercept(url: string): HttpRequest<unknown> {
  const req = new HttpRequest('POST', url, {});
  let forwarded!: HttpRequest<unknown>;
  apiKeyInterceptor(req, (r) => {
    forwarded = r;
    return EMPTY;
  }).subscribe();
  return forwarded;
}

describe('apiKeyInterceptor', () => {
  afterEach(() => {
    environment.apiKey = originalKey;
  });

  it('sends X-API-Key on gateway requests when a key is configured', () => {
    environment.apiKey = 'test-key';
    expect(intercept(environment.apiUrl).headers.get('X-API-Key')).toBe('test-key');
  });

  it('omits the header entirely when no key is configured', () => {
    environment.apiKey = '';
    expect(intercept(environment.apiUrl).headers.has('X-API-Key')).toBe(false);
  });

  it('omits the header when the build-time placeholder was never substituted', () => {
    environment.apiKey = '__AI_GATEWAY_API_KEY__';
    expect(intercept(environment.apiUrl).headers.has('X-API-Key')).toBe(false);
  });

  it('never leaks the key to other hosts', () => {
    environment.apiKey = 'test-key';
    expect(intercept('https://plausible.io/api/event').headers.has('X-API-Key')).toBe(false);
  });
});
