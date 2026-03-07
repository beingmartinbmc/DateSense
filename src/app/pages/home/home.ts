import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { UploadArea } from '../../components/upload-area/upload-area';
import { ImagePreview } from '../../components/image-preview/image-preview';
import { ManualInput, ManualInputData } from '../../components/manual-input/manual-input';
import { ApiService, AnalysisResponse, ManualInputData as ManualInputPayload } from '../../services/api.service';

export type InputMode = 'screenshot' | 'manual';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, MatTabsModule, MatButtonModule, MatCardModule, MatProgressSpinnerModule, MatIconModule, UploadArea, ImagePreview, ManualInput],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  activeTab = signal<InputMode>('screenshot');
  selectedFile = signal<File | null>(null);
  previewUrl = signal<string | null>(null);
  manualData = signal<ManualInputData | null>(null);
  isLoading = signal(false);
  loadingMessage = signal('');
  errorMessage = signal<string | null>(null);

  private readonly loadingMessages = [
    'Analyzing your conversation...',
    'Detecting engagement signals...',
    'Predicting ghosting risk...',
    'Generating insights...',
  ];

  constructor(
    private apiService: ApiService,
    private router: Router,
  ) {}

  switchTab(tab: InputMode): void {
    this.activeTab.set(tab);
    this.errorMessage.set(null);
  }

  onFileSelected(file: File): void {
    this.selectedFile.set(file);
    this.errorMessage.set(null);
    const url = URL.createObjectURL(file);
    this.previewUrl.set(url);
  }

  removeFile(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.selectedFile.set(null);
    this.previewUrl.set(null);
    this.errorMessage.set(null);
  }

  onManualSubmit(data: ManualInputData): void {
    this.manualData.set(data);
    this.analyzeManual(data);
  }

  analyze(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.cycleLoadingMessages();

    this.apiService.analyzeScreenshot(file).subscribe({
      next: (response: AnalysisResponse) => {
        this.isLoading.set(false);
        this.router.navigate(['/dashboard'], {
          state: { result: response, imageUrl: this.previewUrl() },
        });
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('Analysis failed. Please retry.');
      },
    });
  }

  private analyzeManual(data: ManualInputData): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.cycleLoadingMessages();

    this.apiService.analyzeManual(data).subscribe({
      next: (response: AnalysisResponse) => {
        this.isLoading.set(false);
        this.router.navigate(['/dashboard'], {
          state: { result: response },
        });
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('Analysis failed. Please retry.');
      },
    });
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
