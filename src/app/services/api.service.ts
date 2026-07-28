import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, retry, timer, throwError, timeout } from 'rxjs';
import {
  buildScreenshotPrompt,
  buildManualPrompt,
  buildReplyTonePrompt,
  DATESENSE_SYSTEM_CONTEXT,
} from '../prompt';
import { parseAnalysisResponse, normalizeStringList, parseJsonPayload, extractContent } from './analysis-parser';
import {
  AnalysisResponse,
  ConversationMomentum,
  ConversationStage,
  ManualInputData,
  ReplyTone,
} from '../models/analysis.model';
import { environment } from '../../environments/environment';

// Re-export domain types from their canonical home so existing imports
// (`from '../../services/api.service'`) keep working unchanged.
export type {
  AnalysisResponse,
  ConversationMomentum,
  ConversationStage,
  ManualInputData,
  ReplyTone,
} from '../models/analysis.model';

type OpenAiMessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >;

interface OpenAiProxyMessage {
  role: 'system' | 'user';
  content: OpenAiMessageContent;
}

interface OpenAiProxyRequest {
  messages: OpenAiProxyMessage[];
  maxTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly apiUrl = environment.apiUrl;

  private readonly proxyOptions = {
    // Headroom for `conversation_digest` (~300 tokens) on top of the report.
    // Too low and the JSON truncates mid-object, forcing the parser's repair
    // path and costing us the trailing fields.
    maxTokens: 2800,
    temperature: 0.2,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
  };

  // Screenshots are sent as base64 data URLs inside the JSON body. Raw phone
  // screenshots (PNG, multiple MB each) inflate ~37% under base64 and quickly
  // blow past the gateway's request-size limit, surfacing as a generic server
  // error. Downscaling + JPEG re-encoding keeps payloads small while staying
  // legible for the vision model (which itself caps the long edge near ~2048px).
  private readonly maxImageEdge = 2000;
  private readonly imageQuality = 0.85;

  constructor(private http: HttpClient) {}

  analyzeScreenshots(files: File[]): Observable<AnalysisResponse> {
    return new Observable<AnalysisResponse>((subscriber) => {
      Promise.all(files.map((file) => this.readImageAsDataUrl(file)))
        .then((dataUrls) => {
          const body = this.buildProxyRequest([
            { role: 'system', content: DATESENSE_SYSTEM_CONTEXT },
            {
              role: 'user',
              content: [
                { type: 'text', text: buildScreenshotPrompt() },
                ...dataUrls.map((url) => ({
                  type: 'image_url' as const,
                  image_url: { url },
                })),
              ],
            },
          ]);

          this.http
            .post<any>(this.apiUrl, body)
            .pipe(this.resilientPipe(), map((res) => this.parseResponse(res)))
            .subscribe({
              next: (v) => { subscriber.next(v); subscriber.complete(); },
              error: (e) => subscriber.error(e),
            });
        })
        .catch((e) => subscriber.error(e));
    });
  }

  private async readImageAsDataUrl(file: File): Promise<string> {
    try {
      return await this.compressImage(file);
    } catch {
      return this.readRawDataUrl(file);
    }
  }

  private readRawDataUrl(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  private compressImage(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
        reject(new Error('Canvas compression unavailable'));
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        try {
          const scale = Math.min(1, this.maxImageEdge / Math.max(img.width, img.height));
          const targetWidth = Math.max(1, Math.round(img.width * scale));
          const targetHeight = Math.max(1, Math.round(img.height * scale));

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context unavailable'));
            return;
          }

          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          const dataUrl = canvas.toDataURL('image/jpeg', this.imageQuality);
          if (!dataUrl || dataUrl === 'data:,') {
            reject(new Error('Image encoding failed'));
            return;
          }

          resolve(dataUrl);
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Image compression failed'));
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image'));
      };

      img.src = objectUrl;
    });
  }

  analyzeManual(data: ManualInputData): Observable<AnalysisResponse> {
    const prompt = buildManualPrompt({
      yourName: data.yourName,
      theirName: data.theirName,
      yourAge: data.yourAge,
      theirAge: data.theirAge,
      platform: data.platform,
      chatDuration: data.chatDuration,
      chatMessages: data.chatMessages,
      yourBio: data.yourBio,
      theirBio: data.theirBio,
      additionalContext: data.additionalContext,
      goal: data.goal,
    });

    const body = this.buildProxyRequest([
      { role: 'system', content: DATESENSE_SYSTEM_CONTEXT },
      { role: 'user', content: prompt },
    ]);

    return this.http
      .post<any>(this.apiUrl, body)
      .pipe(this.resilientPipe(), map((res) => this.parseResponse(res)));
  }

  /**
   * Regenerate ONLY the reply suggestions in a different tone, reusing the
   * conversation context the user already provided. Cheaper + faster than a
   * full re-analysis, and keeps the rest of the report stable.
   */
  regenerateReplies(input: {
    tone: ReplyTone;
    chatMessages?: string;
    archetype?: string;
    brutalVerdict?: string;
    count?: number;
  }): Observable<string[]> {
    const prompt = buildReplyTonePrompt({
      tone: input.tone,
      chatMessages: input.chatMessages,
      archetype: input.archetype,
      brutalVerdict: input.brutalVerdict,
      count: input.count,
    });

    const body = this.buildProxyRequest(
      [
        { role: 'system', content: DATESENSE_SYSTEM_CONTEXT },
        { role: 'user', content: prompt },
      ],
      // A touch more warmth/variety for creative reply writing.
      { temperature: 0.8, maxTokens: 700 },
    );

    return this.http.post<any>(this.apiUrl, body).pipe(
      this.resilientPipe(),
      map((res) => {
        const content = extractContent(res);
        const data = parseJsonPayload(content);
        const replies = normalizeStringList(data?.reply_suggestions);
        if (replies.length === 0) {
          throw new Error('The AI did not return any replies. Please retry.');
        }
        return replies;
      }),
    );
  }

  private buildProxyRequest(
    messages: OpenAiProxyMessage[],
    overrides?: Partial<typeof this.proxyOptions>,
  ): OpenAiProxyRequest {
    return {
      messages,
      ...this.proxyOptions,
      ...overrides,
    };
  }

  /**
   * Shared resilience operators for every gateway call:
   *  - a hard per-request timeout so a hung gateway can't freeze the UI, and
   *  - bounded retries with exponential backoff + jitter for transient faults
   *    (network errors, 429s, and 5xx). 4xx (except 429) are NOT retried since
   *    they won't succeed on a repeat.
   */
  private resilientPipe<T>() {
    return (source: Observable<T>): Observable<T> =>
      source.pipe(
        timeout(environment.requestTimeoutMs),
        retry({
          count: environment.maxRetries,
          delay: (error, retryCount) => {
            if (!this.isRetryable(error)) {
              return throwError(() => error);
            }
            const backoff = environment.retryBaseDelayMs * Math.pow(2, retryCount - 1);
            const jitter = Math.random() * environment.retryBaseDelayMs;
            return timer(backoff + jitter);
          },
        }),
      );
  }

  private isRetryable(error: any): boolean {
    // RxJS TimeoutError → worth one more shot.
    if (error?.name === 'TimeoutError') return true;
    const status = error?.status;
    // No status usually means a network/CORS failure (status 0).
    if (status === undefined || status === null) return true;
    if (status === 0) return true;
    if (status === 429) return true;
    return status >= 500 && status < 600;
  }

  private parseResponse(raw: any): AnalysisResponse {
    return parseAnalysisResponse(raw);
  }
}
