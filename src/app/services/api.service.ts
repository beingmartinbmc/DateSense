import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { buildScreenshotPrompt, buildManualPrompt, DATESENSE_SYSTEM_CONTEXT } from '../prompt';

export type ConversationStage = 'Opening' | 'Building Rapport' | 'Momentum Window' | 'Stalling' | 'Dead' | 'Unknown';

export type ConversationMomentum = 'Rising' | 'Flat' | 'Fading' | 'Unknown';

export interface AnalysisResponse {
  attraction_score: number;
  ghosting_risk: number;
  conversation_health: number;
  response_effort_balance: number;
  meetup_readiness: number;
  confidence_score: number;
  rizz_score: number;
  conversation_stage: ConversationStage;
  momentum: ConversationMomentum;
  archetype: string;
  brutal_verdict: string;
  rizz_roast: string;
  insights: string[];
  green_flags: string[];
  red_flags: string[];
  fake_golddigger_risk: string;
  fake_golddigger_reason: string;
  next_move: string;
  reply_suggestions: string[];
  date_ideas: string[];
}

export interface ManualInputData {
  yourName?: string;
  theirName?: string;
  yourAge?: string;
  theirAge?: string;
  platform?: string;
  chatDuration?: string;
  chatMessages: string;
  yourBio?: string;
  theirBio?: string;
  additionalContext?: string;
}

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
  private readonly apiUrl =
    'https://ai-gateway-production-0388.up.railway.app/api/v1/openai-proxy';

  private readonly proxyOptions = {
    maxTokens: 2200,
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
            .pipe(map((res) => this.parseResponse(res)))
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
    });

    const body = this.buildProxyRequest([
      { role: 'system', content: DATESENSE_SYSTEM_CONTEXT },
      { role: 'user', content: prompt },
    ]);

    return this.http
      .post<any>(this.apiUrl, body)
      .pipe(map((res) => this.parseResponse(res)));
  }

  private buildProxyRequest(messages: OpenAiProxyMessage[]): OpenAiProxyRequest {
    return {
      messages,
      ...this.proxyOptions,
    };
  }

  private parseResponse(raw: any): AnalysisResponse {
    const content = this.extractContent(raw);
    const data = this.parseJsonPayload(content);

    return {
      attraction_score: this.normalizeScore(data.attraction_score),
      ghosting_risk: this.normalizeScore(data.ghosting_risk),
      conversation_health: this.normalizeScore(data.conversation_health),
      response_effort_balance: this.normalizeScore(data.response_effort_balance),
      meetup_readiness: this.normalizeScore(data.meetup_readiness),
      confidence_score: this.normalizeScore(data.confidence_score),
      rizz_score: this.normalizeScore(data.rizz_score),
      conversation_stage: this.normalizeStage(data.conversation_stage),
      momentum: this.normalizeMomentum(data.momentum),
      archetype: this.normalizeText(data.archetype, 'Mixed Signals'),
      brutal_verdict: this.normalizeText(data.brutal_verdict, 'Too little to go on — give it another exchange before reading the tea leaves.'),
      rizz_roast: this.normalizeText(data.rizz_roast, 'Not enough to roast yet — send a few more messages and try again.'),
      insights: this.normalizeStringList(data.insights),
      green_flags: this.normalizeStringList(data.green_flags),
      red_flags: this.normalizeStringList(data.red_flags),
      fake_golddigger_risk: this.normalizeRisk(data.fake_golddigger_risk),
      fake_golddigger_reason: this.normalizeText(data.fake_golddigger_reason, 'No red flags detected'),
      next_move: this.normalizeText(data.next_move, 'Keep the conversation simple and wait for clearer signals before forcing the next step.'),
      reply_suggestions: this.normalizeStringList(data.reply_suggestions),
      date_ideas: this.normalizeStringList(data.date_ideas),
    };
  }

  private extractContent(raw: any): string {
    const root = raw?.data ?? raw;
    const candidates = [
      root?.choices?.[0]?.message?.content,
      root?.output?.[0]?.content,
      root?.output,
      root?.output_text,
      root?.text,
      root?.content,
      this.looksLikeAnalysisObject(root) ? JSON.stringify(root) : null,
      this.looksLikeAnalysisObject(raw) ? JSON.stringify(raw) : null,
      typeof raw === 'string' ? raw : null,
    ];

    for (const candidate of candidates) {
      const normalized = this.stringifyContent(candidate);
      if (normalized) {
        return normalized;
      }
    }

    throw new Error('Could not extract AI response');
  }

  private stringifyContent(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (!Array.isArray(value)) {
      return '';
    }

    return value
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if (!item || typeof item !== 'object') {
          return '';
        }

        if ('text' in item && typeof item.text === 'string') {
          return item.text;
        }

        if ('content' in item) {
          return this.stringifyContent(item.content);
        }

        return '';
      })
      .join('\n')
      .trim();
  }

  private parseJsonPayload(content: string): any {
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const repaired = this.repairPrematureObjectClose(cleaned);
    const extracted = this.extractJsonObject(cleaned);
    const repairedExtracted = this.extractJsonObject(repaired);

    const candidates = [
      cleaned,
      repaired,
      repairedExtracted,
      extracted,
      this.normalizeLikelyJson(repaired),
      this.normalizeLikelyJson(cleaned),
      repairedExtracted ? this.normalizeLikelyJson(repairedExtracted) : null,
      extracted ? this.normalizeLikelyJson(extracted) : null,
    ].filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0);

    for (const candidate of candidates) {
      const parsed = this.tryParseJson(candidate);
      if (parsed) {
        return parsed;
      }
    }

    throw new Error('The AI returned an invalid response format. Please retry.');
  }

  private repairPrematureObjectClose(text: string): string {
    let out = '';
    let depth = 0;
    let inString = false;
    let escaped = false;
    let i = 0;
    const len = text.length;

    while (i < len) {
      const ch = text[i];

      if (inString) {
        out += ch;
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        i += 1;
        continue;
      }

      if (ch === '"') {
        inString = true;
        out += ch;
        i += 1;
        continue;
      }

      if (ch === '{' || ch === '[') {
        depth += 1;
        out += ch;
        i += 1;
        continue;
      }

      if (ch === '}' && depth === 1) {
        let j = i + 1;
        while (j < len && /\s/.test(text[j])) {
          j += 1;
        }

        if (j < len && text[j] === ',') {
          let k = j + 1;
          while (k < len && /\s/.test(text[k])) {
            k += 1;
          }
          if (k < len && text[k] === '"') {
            i += 1;
            continue;
          }
        } else if (j < len && text[j] === '"') {
          out += ',';
          i += 1;
          continue;
        }
      }

      if (ch === '}' || ch === ']') {
        depth -= 1;
        out += ch;
        i += 1;
        continue;
      }

      out += ch;
      i += 1;
    }

    return out;
  }

  private tryParseJson(text: string): any | null {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  private extractJsonObject(text: string): string | null {
    let depth = 0;
    let start = -1;
    let inString = false;
    let escaped = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          continue;
        }

        if (char === '"') {
          inString = false;
        }

        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === '{') {
        if (depth === 0) {
          start = index;
        }
        depth += 1;
        continue;
      }

      if (char === '}' && depth > 0) {
        depth -= 1;
        if (depth === 0 && start !== -1) {
          return text.slice(start, index + 1);
        }
      }
    }

    return null;
  }

  private normalizeLikelyJson(text: string): string {
    const apostropheNormalized = text.replace(/[\u2018\u2019]/g, "'");
    const quoteRewritten = this.rewriteCurlyStrings(apostropheNormalized);
    return this.insertMissingArrayCommas(quoteRewritten);
  }

  private rewriteCurlyStrings(text: string): string {
    let out = '';
    let i = 0;
    const len = text.length;

    while (i < len) {
      const ch = text[i];

      if (ch === '"') {
        const start = i;
        i += 1;
        while (i < len) {
          const c = text[i];
          if (c === '\\') {
            i += 2;
            continue;
          }
          if (c === '"') {
            i += 1;
            break;
          }
          i += 1;
        }
        out += text.slice(start, i);
        continue;
      }

      if (ch === '\u201C') {
        i += 1;
        let content = '';
        while (i < len && text[i] !== '\u201D') {
          const c = text[i];
          if (c === '\\' || c === '"') {
            content += '\\' + c;
          } else {
            content += c;
          }
          i += 1;
        }
        if (i < len) {
          i += 1;
        }
        out += '"' + content + '"';
        continue;
      }

      out += ch;
      i += 1;
    }

    return out;
  }

  private insertMissingArrayCommas(text: string): string {
    let out = '';
    let i = 0;
    const len = text.length;

    while (i < len) {
      const ch = text[i];

      if (ch === '"') {
        const start = i;
        i += 1;
        while (i < len) {
          const c = text[i];
          if (c === '\\') {
            i += 2;
            continue;
          }
          if (c === '"') {
            i += 1;
            break;
          }
          i += 1;
        }
        out += text.slice(start, i);

        let j = i;
        while (j < len && /\s/.test(text[j])) {
          j += 1;
        }
        if (j < len && text[j] === '"') {
          out += ',';
        }
        continue;
      }

      out += ch;
      i += 1;
    }

    return out;
  }

  private looksLikeAnalysisObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value) && (
      'conversation_health' in value ||
      'attraction_score' in value ||
      'ghosting_risk' in value ||
      'reply_suggestions' in value
    );
  }

  private normalizeScore(value: unknown): number {
    const score = Number(value);
    if (!Number.isFinite(score)) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private normalizeStringList(value: unknown): string[] {
    if (typeof value === 'string') {
      return value
        .split(/\n+/)
        .map((item) => item.replace(/^[-*•\s]+/, '').trim())
        .filter((item) => item.length > 0);
    }

    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private normalizeText(value: unknown, fallback: string): string {
    if (typeof value !== 'string') {
      return fallback;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : fallback;
  }

  private normalizeRisk(value: unknown): string {
    const allowed = ['None', 'Low', 'Medium', 'High'];
    const normalized = this.normalizeText(value, 'None');
    return allowed.includes(normalized) ? normalized : 'None';
  }

  private normalizeStage(value: unknown): ConversationStage {
    const allowed: ConversationStage[] = ['Opening', 'Building Rapport', 'Momentum Window', 'Stalling', 'Dead', 'Unknown'];
    const normalized = this.normalizeText(value, 'Unknown') as ConversationStage;
    return allowed.includes(normalized) ? normalized : 'Unknown';
  }

  private normalizeMomentum(value: unknown): ConversationMomentum {
    const allowed: ConversationMomentum[] = ['Rising', 'Flat', 'Fading', 'Unknown'];
    const normalized = this.normalizeText(value, 'Unknown') as ConversationMomentum;
    return allowed.includes(normalized) ? normalized : 'Unknown';
  }
}
