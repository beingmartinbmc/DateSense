import { Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../services/api.service';
import { AnalyticsService } from '../../services/analytics.service';
import { ReplyTone, REPLY_TONES } from '../../models/analysis.model';

@Component({
  selector: 'app-reply-list',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './reply-list.html',
  styleUrl: './reply-list.css',
})
export class ReplyList {
  /** Initial replies produced by the main analysis. */
  replies = input.required<string[]>();
  /** Optional context so regeneration stays on-topic. */
  archetype = input<string | undefined>(undefined);
  brutalVerdict = input<string | undefined>(undefined);
  /** The transcript the analysis reconstructed — without it, rewritten replies
   * have no conversation to reference and come back generic. */
  conversationDigest = input<string | undefined>(undefined);

  private api = inject(ApiService);
  private analytics = inject(AnalyticsService);

  readonly tones = REPLY_TONES;
  /** The currently displayed replies (swapped out when a tone is regenerated). */
  private regenerated = signal<string[] | null>(null);
  displayReplies = computed(() => this.regenerated() ?? this.replies());

  activeTone = signal<ReplyTone | null>(null);
  isRegenerating = signal(false);
  regenError = signal<string | null>(null);
  copiedIndex = signal<number | null>(null);

  async copyReply(text: string, index: number): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copiedIndex.set(index);
      this.analytics.track('reply_copied', { index });
      setTimeout(() => this.copiedIndex.set(null), 1500);
    } catch {
      // clipboard API may not be available
    }
  }

  regenerate(tone: ReplyTone): void {
    if (this.isRegenerating()) return;
    this.regenError.set(null);
    this.activeTone.set(tone);
    this.isRegenerating.set(true);
    this.copiedIndex.set(null);
    this.analytics.track('replies_regenerated', { tone });

    this.api
      .regenerateReplies({
        tone,
        chatMessages: this.conversationDigest(),
        archetype: this.archetype(),
        brutalVerdict: this.brutalVerdict(),
        count: this.replies().length || 5,
      })
      .subscribe({
        next: (replies) => {
          this.regenerated.set(replies);
          this.isRegenerating.set(false);
        },
        error: (error) => {
          console.error('Reply regeneration failed', error);
          this.isRegenerating.set(false);
          this.activeTone.set(null);
          this.regenError.set(
            error?.message?.trim() || 'Could not regenerate replies. Please try again.',
          );
        },
      });
  }
}
