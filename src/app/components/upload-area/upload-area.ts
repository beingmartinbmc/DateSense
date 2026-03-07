import { Component, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-upload-area',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './upload-area.html',
  styleUrl: './upload-area.css',
})
export class UploadArea {
  fileSelected = output<File>();
  isDragging = signal(false);
  errorMessage = signal<string | null>(null);

  private readonly allowedTypes = ['image/png', 'image/jpg', 'image/jpeg'];
  private readonly maxSize = 10 * 1024 * 1024; // 10MB

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.validateAndEmit(files[0]);
    }
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.validateAndEmit(input.files[0]);
      input.value = '';
    }
  }

  private validateAndEmit(file: File): void {
    this.errorMessage.set(null);

    if (!this.allowedTypes.includes(file.type)) {
      this.errorMessage.set('Unsupported file format. Please upload PNG or JPG.');
      return;
    }

    if (file.size > this.maxSize) {
      this.errorMessage.set('File too large. Maximum size is 10MB.');
      return;
    }

    this.fileSelected.emit(file);
  }
}
