import { Component, signal, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { UploadArea } from '../../components/upload-area/upload-area';
import { ImagePreview } from '../../components/image-preview/image-preview';
import { ApiService, AnalysisResponse, ManualInputData } from '../../services/api.service';
import { UsageGuardService } from '../../services/usage-guard.service';
import { AnalyticsService } from '../../services/analytics.service';
import { SAMPLE_CHAT } from '../../sample-chat';

export interface FilePreview {
  file: File;
  url: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatProgressSpinnerModule, MatIconModule, UploadArea, ImagePreview],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit, OnDestroy {
  filePreviews = signal<FilePreview[]>([]);
  isLoading = signal(false);
  loadingMessage = signal('');
  errorMessage = signal<string | null>(null);

  /** Platform-aware keyboard hint for the paste tip. */
  readonly pasteShortcut = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
    ? '⌘V'
    : 'Ctrl+V';

  private readonly loadingMessages = [
    'Analyzing your conversation...',
    'Detecting engagement signals...',
    'Predicting ghosting risk...',
    'Generating insights...',
  ];

  constructor(
    private apiService: ApiService,
    private router: Router,
    private usageGuard: UsageGuardService,
    private analytics: AnalyticsService,
  ) {}

  ngOnInit(): void {
    this.analytics.init();
    this.analytics.track('page_view', { page: 'home' });
    this.incrementFlagCounter();
  }

  private incrementFlagCounter(): void {
    const img = new Image();
    img.src = 'https://s01.flagcounter.com/count2/giRi/bg_FFFFFF/txt_000000/border_CCCCCC/columns_2/maxflags_10/viewers_0/labels_0/pageviews_0/flags_0/percent_0/';
  }

  private readonly maxTotalFiles = 10;

  onFilesSelected(files: File[]): void {
    this.errorMessage.set(null);
    const current = this.filePreviews().length;
    if (current + files.length > this.maxTotalFiles) {
      this.errorMessage.set(`Maximum ${this.maxTotalFiles} screenshots allowed.`);
      return;
    }
    const newPreviews = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    this.filePreviews.update((existing) => [...existing, ...newPreviews]);
  }

  removeFile(index: number): void {
    this.filePreviews.update((list) => {
      URL.revokeObjectURL(list[index].url);
      return list.filter((_, i) => i !== index);
    });
    this.errorMessage.set(null);
  }

  /** Run the analysis on a built-in demo conversation — zero friction for first-timers. */
  tryDemo(): void {
    this.errorMessage.set(null);
    this.analytics.track('demo_clicked');
    this.analyzeManual(SAMPLE_CHAT);
  }

  /** Allow pasting a screenshot straight from the clipboard (Cmd/Ctrl+V). */
  @HostListener('document:paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    if (this.isLoading()) return;
    const items = event.clipboardData?.items;
    if (!items) return;

    const images: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) images.push(file);
      }
    }

    if (images.length === 0) return;
    event.preventDefault();
    this.onFilesSelected(images);
  }

  ngOnDestroy(): void {
    for (const preview of this.filePreviews()) {
      URL.revokeObjectURL(preview.url);
    }
  }

  analyze(): void {
    const previews = this.filePreviews();
    if (previews.length === 0) return;

    // Client-side anti-spam guard (cooldown + soft daily quota). This is UX /
    // defense-in-depth only — the gateway is the real enforcement point.
    const block = this.usageGuard.blockReason();
    if (block) {
      this.errorMessage.set(block);
      this.analytics.track('analysis_failed', { reason: 'rate_limited', mode: 'screenshots' });
      return;
    }
    this.usageGuard.recordAnalysis();

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.cycleLoadingMessages();

    const files = previews.map((p) => p.file);
    const imageUrls = previews.map((p) => p.url);

    this.analytics.track('analysis_started', { mode: 'screenshots', files: files.length });

    this.apiService.analyzeScreenshots(files).subscribe({
      next: (response: AnalysisResponse) => {
        this.isLoading.set(false);
        this.analytics.track('analysis_succeeded', { mode: 'screenshots' });
        this.router.navigate(['/dashboard'], {
          state: { result: response, imageUrls },
        });
      },
      error: (error) => {
        console.error('Screenshot analysis failed', error);
        this.isLoading.set(false);
        this.analytics.track('analysis_failed', { mode: 'screenshots', reason: 'request_error' });
        this.errorMessage.set(this.getErrorMessage(error));
      },
    });
  }

  private analyzeManual(data: ManualInputData): void {
    const block = this.usageGuard.blockReason();
    if (block) {
      this.errorMessage.set(block);
      this.analytics.track('analysis_failed', { reason: 'rate_limited', mode: 'manual' });
      return;
    }
    this.usageGuard.recordAnalysis();

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.cycleLoadingMessages();

    this.analytics.track('analysis_started', { mode: 'manual' });

    this.apiService.analyzeManual(data).subscribe({
      next: (response: AnalysisResponse) => {
        this.isLoading.set(false);
        this.analytics.track('analysis_succeeded', { mode: 'manual' });
        this.router.navigate(['/dashboard'], {
          state: { result: response },
        });
      },
      error: (error) => {
        console.error('Manual analysis failed', error);
        this.isLoading.set(false);
        this.analytics.track('analysis_failed', { mode: 'manual', reason: 'request_error' });
        this.errorMessage.set(this.getErrorMessage(error));
      },
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage = this.extractHttpErrorMessage(error.error);
      if (backendMessage) {
        return backendMessage;
      }

      if (typeof error.message === 'string' && error.message.trim().length > 0) {
        return error.message;
      }

      return 'Analysis failed. Please retry.';
    }

    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

    return 'Analysis failed. Please retry.';
  }

  private extractHttpErrorMessage(value: unknown): string | null {
    if (!value) {
      return null;
    }

    if (typeof value === 'string') {
      const normalized = value.trim();
      return normalized.length > 0 ? normalized : null;
    }

    if (typeof value !== 'object') {
      return null;
    }

    const candidateRecord = value as Record<string, unknown>;
    const keys = ['message', 'error', 'details'];

    for (const key of keys) {
      const candidate = candidateRecord[key];
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    return null;
  }

  private cycleLoadingMessages(): void {
    let index = 0;
    this.loadingMessage.set(this.loadingMessages[0]);
    const interval = setInterval(() => {
      if (!this.isLoading()) {
        clearInterval(interval);
        return;
      }
      index = (index + 1) % this.loadingMessages.length;
      this.loadingMessage.set(this.loadingMessages[index]);
    }, 2000);
  }
}
