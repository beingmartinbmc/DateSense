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

  busy = signal(false);
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

  /** Generate the scorecard image and share it (or download as fallback). */
  async shareCard(): Promise<void> {
    this.busy.set(true);
    this.statusMessage.set(null);
    try {
      const blob = await this.renderCardImage();
      const file = new File([blob], 'datesense-verdict.png', { type: 'image/png' });
      const shareUrl = this.buildShareUrl();

      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
        share?: (data?: ShareData) => Promise<void>;
      };

      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: 'My DateSense verdict',
          text: `${this.result().brutal_verdict} — analyze yours at DateSense`,
          url: shareUrl,
        });
      } else {
        this.downloadBlob(blob, 'datesense-verdict.png');
        this.statusMessage.set('Image saved. Share it anywhere!');
        setTimeout(() => this.statusMessage.set(null), 3000);
      }
    } catch {
      this.statusMessage.set('Could not generate the card. Please try again.');
      setTimeout(() => this.statusMessage.set(null), 3000);
    } finally {
      this.busy.set(false);
    }
  }

  async downloadCard(): Promise<void> {
    this.busy.set(true);
    try {
      const blob = await this.renderCardImage();
      this.downloadBlob(blob, 'datesense-verdict.png');
    } catch {
      this.statusMessage.set('Could not generate the card. Please try again.');
      setTimeout(() => this.statusMessage.set(null), 3000);
    } finally {
      this.busy.set(false);
    }
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ── Canvas rendering ─────────────────────────────────────────────────────
  // The shareable image is drawn entirely on a canvas (no external libs, no
  // chat content). 1080x1350 = the standard Instagram/TikTok portrait ratio.

  private renderCardImage(): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      const W = 1080;
      const H = 1350;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas unavailable'));
        return;
      }

      const r = this.result();

      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#1b1033');
      bg.addColorStop(0.55, '#3a1145');
      bg.addColorStop(1, '#5b1338');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Soft glow blobs
      this.radialGlow(ctx, W * 0.2, H * 0.18, 420, 'rgba(236,72,153,0.35)');
      this.radialGlow(ctx, W * 0.85, H * 0.8, 460, 'rgba(139,92,246,0.32)');

      // Brand
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = '700 46px Inter, system-ui, sans-serif';
      ctx.fillText('DateSense', W / 2, 120);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '600 22px Inter, system-ui, sans-serif';
      ctx.fillText('AI DATING VERDICT', W / 2, 158);

      // Archetype pill
      const pillText = (r.archetype || 'Mixed Signals').toUpperCase();
      ctx.font = '800 30px Inter, system-ui, sans-serif';
      const pillW = ctx.measureText(pillText).width + 80;
      const pillX = (W - pillW) / 2;
      this.roundRect(ctx, pillX, 215, pillW, 70, 35);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffd1ec';
      ctx.fillText(pillText, W / 2, 260);

      // Brutal verdict (wrapped)
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 60px Inter, system-ui, sans-serif';
      const verdict = r.brutal_verdict || 'The verdict is in.';
      const lines = this.wrapText(ctx, `"${verdict}"`, W - 160);
      let vy = 430;
      for (const line of lines.slice(0, 4)) {
        ctx.fillText(line, W / 2, vy);
        vy += 76;
      }

      // Score rings row
      const ringY = Math.max(vy + 60, 760);
      this.drawScoreRing(ctx, W * 0.25, ringY, r.attraction_score, 'Attraction', '#ec4899');
      this.drawScoreRing(ctx, W * 0.5, ringY, 100 - r.ghosting_risk, 'Staying', '#10b981');
      this.drawScoreRing(ctx, W * 0.75, ringY, r.rizz_score, 'Your Rizz', '#8b5cf6');

      // Rizz roast strip
      const roast = r.rizz_roast;
      if (roast) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = 'italic 600 30px Inter, system-ui, sans-serif';
        const roastLines = this.wrapText(ctx, `"${roast}"`, W - 200);
        let ry = ringY + 230;
        for (const line of roastLines.slice(0, 3)) {
          ctx.fillText(line, W / 2, ry);
          ry += 42;
        }
      }

      // Footer CTA
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '700 34px Inter, system-ui, sans-serif';
      ctx.fillText('Analyze your talking stage', W / 2, H - 120);
      ctx.fillStyle = '#ffd1ec';
      ctx.font = '800 36px Inter, system-ui, sans-serif';
      ctx.fillText(this.shareHost(), W / 2, H - 72);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        'image/png',
        0.92,
      );
    });
  }

  private shareHost(): string {
    try {
      return location.host || 'datesense';
    } catch {
      return 'datesense';
    }
  }

  private radialGlow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawScoreRing(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    value: number,
    label: string,
    color: string,
  ): void {
    const radius = 88;
    const lineWidth = 16;
    const start = -Math.PI / 2;
    const pct = Math.max(0, Math.min(100, value)) / 100;

    // track
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.stroke();

    // value arc
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, start + pct * Math.PI * 2);
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.stroke();

    // number
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = '800 54px Inter, system-ui, sans-serif';
    ctx.fillText(`${Math.round(value)}`, cx, cy + 18);

    // label
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '700 24px Inter, system-ui, sans-serif';
    ctx.fillText(label, cx, cy + radius + 44);
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }
}
