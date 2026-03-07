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
    'https://epic-backend-fp9aqm99k-beingmartinbmcs-projects.vercel.app/api/generic-vision';

  constructor(private http: HttpClient) {}

  analyzeScreenshot(file: File): Observable<AnalysisResponse> {
    return new Observable<AnalysisResponse>((subscriber) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        const mimeType = file.type || 'image/png';

        const body = {
          prompt: buildScreenshotPrompt(),
          context: DATESENSE_SYSTEM_CONTEXT,
          images: [{ base64, mimeType }],
        };

        this.http
          .post<any>(this.apiUrl, body)
          .pipe(map((res) => this.parseResponse(res)))
          .subscribe({
            next: (v) => { subscriber.next(v); subscriber.complete(); },
            error: (e) => subscriber.error(e),
          });
      };
      reader.onerror = () => subscriber.error(new Error('Failed to read file'));
      reader.readAsDataURL(file);
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
    // The backend may return the JSON directly or wrapped in a text field
    let data = raw;

    if (typeof raw === 'string') {
      data = JSON.parse(raw);
    } else if (typeof raw?.text === 'string') {
      // Strip markdown code fences if present
      let text = raw.text.trim();
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      data = JSON.parse(text);
    } else if (typeof raw?.content === 'string') {
      let text = raw.content.trim();
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      data = JSON.parse(text);
    } else if (raw?.choices?.[0]?.message?.content) {
      let text = raw.choices[0].message.content.trim();
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      data = JSON.parse(text);
    }

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
