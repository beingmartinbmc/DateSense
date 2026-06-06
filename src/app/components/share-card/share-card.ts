import { Component, input, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AnalysisResponse } from '../../services/api.service';
import { ResultStore } from '../../services/result-store.service';

@Component({
  selector: 'app-share-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './share-card.html',
  styleUrl: './share-card.css',
})
export class ShareCard {
  result = input.required<AnalysisResponse>();

  private store = inject(ResultStore);

  copied = signal(false);
  statusMessage = signal<string | null>(null);

  /** Builds the full shareable URL with the encoded result in the hash. */
  private buildShareUrl(): string {
    const token = this.store.encodeShareToken(this.result());
    const base = `${location.origin}${location.pathname}`;
    return `${base}#/r/${token}`;
  }

  async copyLink(): Promise<void> {
    const url = this.buildShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    } catch {
      this.statusMessage.set('Could not copy link. Long-press to copy manually.');
      setTimeout(() => this.statusMessage.set(null), 3000);
    }
  }
}
