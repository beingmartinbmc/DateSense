import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-date-ideas',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  templateUrl: './date-ideas.html',
  styleUrl: './date-ideas.css',
})
export class DateIdeas {
  ideas = input.required<string[]>();

  readonly emojis = ['☕', '🚶', '📸', '🎵', '🎨', '🍕'];

  emojiFor(index: number): string {
    return this.emojis[index % this.emojis.length];
  }
}
