import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-score-card',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  templateUrl: './score-card.html',
  styleUrl: './score-card.css',
})
export class ScoreCard {
  label = input.required<string>();
  score = input.required<number>();
  color = input<'pink' | 'amber' | 'emerald'>('pink');
}
