import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { buildScreenshotPrompt, buildManualPrompt, DATESENSE_SYSTEM_CONTEXT } from '../prompt';

export interface AnalysisResponse {
  attraction_score: number;
  ghosting_risk: number;
  conversation_health: number;
  insights: string[];
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
      attraction_score: Number(data.attraction_score) || 0,
      ghosting_risk: Number(data.ghosting_risk) || 0,
      conversation_health: Number(data.conversation_health) || 0,
      insights: Array.isArray(data.insights) ? data.insights : [],
      reply_suggestions: Array.isArray(data.reply_suggestions) ? data.reply_suggestions : [],
      date_ideas: Array.isArray(data.date_ideas) ? data.date_ideas : [],
    };
  }
}
