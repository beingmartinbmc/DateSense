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
  conversation_stage: ConversationStage;
  momentum: ConversationMomentum;
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

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly apiUrl =
    'https://epic-backend-f9tfcyn1d-beingmartinbmcs-projects.vercel.app/api/generic-vision';

  constructor(private http: HttpClient) {}

  analyzeScreenshots(files: File[]): Observable<AnalysisResponse> {
    return new Observable<AnalysisResponse>((subscriber) => {
      const promises = files.map(
        (file) =>
          new Promise<{ base64: string; mimeType: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                base64: (reader.result as string).split(',')[1],
                mimeType: file.type || 'image/png',
              });
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
          }),
      );

      Promise.all(promises)
        .then((images) => {
          const body = {
            prompt: buildScreenshotPrompt(),
            context: DATESENSE_SYSTEM_CONTEXT,
            images,
          };

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

  analyzeManual(data: ManualInputData): Observable<AnalysisResponse> {
    const body = {
      prompt: buildManualPrompt({
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
      }),
      context: DATESENSE_SYSTEM_CONTEXT,
    };

    return this.http
      .post<any>(this.apiUrl, body)
      .pipe(map((res) => this.parseResponse(res)));
  }

  private parseResponse(raw: any): AnalysisResponse {
    let content: string | null = null;

    // Backend wraps OpenAI response in { success, data: { choices: [...] } }
    const root = raw?.data ?? raw;

    if (root?.choices?.[0]?.message?.content) {
      content = root.choices[0].message.content;
    } else if (typeof root?.text === 'string') {
      content = root.text;
    } else if (typeof root?.content === 'string') {
      content = root.content;
    } else if (typeof raw === 'string') {
      content = raw;
    }

    if (!content) {
      throw new Error('Could not extract AI response');
    }

    // Strip markdown code fences if present
    let text = content.trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const data = JSON.parse(text);

    return {
      attraction_score: this.normalizeScore(data.attraction_score),
      ghosting_risk: this.normalizeScore(data.ghosting_risk),
      conversation_health: this.normalizeScore(data.conversation_health),
      response_effort_balance: this.normalizeScore(data.response_effort_balance),
      meetup_readiness: this.normalizeScore(data.meetup_readiness),
      confidence_score: this.normalizeScore(data.confidence_score),
      conversation_stage: this.normalizeStage(data.conversation_stage),
      momentum: this.normalizeMomentum(data.momentum),
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

  private normalizeScore(value: unknown): number {
    const score = Number(value);
    if (!Number.isFinite(score)) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private normalizeStringList(value: unknown): string[] {
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
