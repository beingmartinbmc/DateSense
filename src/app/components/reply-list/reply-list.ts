import { Component, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-reply-list',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './reply-list.html',
  styleUrl: './reply-list.css',
})
export class ReplyList {
  replies = input.required<string[]>();
  copiedIndex = signal<number | null>(null);

  async copyReply(text: string, index: number): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copiedIndex.set(index);
      setTimeout(() => this.copiedIndex.set(null), 1500);
    } catch {
      // clipboard API may not be available
    }
  }
}
